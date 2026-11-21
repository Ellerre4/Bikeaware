import 'dotenv/config';
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import express from 'express';
import type { NextFunction, Request, Response } from 'express';

const PORT = 3000;
const IS_PROD = process.env.NODE_ENV === 'production';

// Ephemeral in-memory HMAC key for session tokens
const SESSION_SECRET = crypto.randomBytes(32);
const SESSION_TTL_MS = 12 * 60 * 60 * 1000; // 12 hours

// Precomputed salted scrypt digest for the user's configured default PIN (no plaintext stored)
const DEFAULT_PIN_SALT = 'ba_srv_salt_9f3c7a2e1d8b4f60';
const DEFAULT_PIN_HASH_HEX =
  '50e0dffbfa2eefe4dc7c8e0c757800a14396f5037d7c988fbcedcf8d4ba6df7c';

let runtimeCustomPin: { salt: string; hashHex: string } | null = null;

interface RateLimitEntry {
  count: number;
  resetAt: number;
}
const loginAttempts = new Map<string, RateLimitEntry>();

interface StravaTokens {
  accessToken: string;
  refreshToken: string;
  expiresAt: number;
  athleteName: string;
  athleteId: number;
}

interface PendingOAuthState {
  sessionId: string;
  expiresAt: number;
}

const activeSessions = new Map<string, { createdAt: number; expiresAt: number }>();
const stravaTokensBySession = new Map<string, StravaTokens>();
const pendingStravaStates = new Map<string, PendingOAuthState>();

function verifyPin(candidate: string): boolean {
  if (typeof candidate !== 'string' || candidate.length < 4 || candidate.length > 32) {
    return false;
  }

  // Environment override takes top precedence
  const envPin = process.env.APP_ACCESS_PIN?.trim();
  if (envPin) {
    const salt = 'ba_env_override_salt_v1';
    const expected = crypto.scryptSync(envPin, salt, 32);
    const actual = crypto.scryptSync(candidate, salt, 32);
    return crypto.timingSafeEqual(expected, actual);
  }

  // Runtime updated PIN (if user changed PIN during session)
  if (runtimeCustomPin) {
    const expected = Buffer.from(runtimeCustomPin.hashHex, 'hex');
    const actual = crypto.scryptSync(candidate, runtimeCustomPin.salt, 32);
    return expected.length === actual.length && crypto.timingSafeEqual(expected, actual);
  }

  // Default configured PIN hash
  const expected = Buffer.from(DEFAULT_PIN_HASH_HEX, 'hex');
  const actual = crypto.scryptSync(candidate, DEFAULT_PIN_SALT, 32);
  return expected.length === actual.length && crypto.timingSafeEqual(expected, actual);
}

function createSessionToken(): { token: string; sessionId: string; expiresAt: number } {
  const sessionId = crypto.randomBytes(16).toString('hex');
  const expiresAt = Date.now() + SESSION_TTL_MS;
  activeSessions.set(sessionId, { createdAt: Date.now(), expiresAt });
  const payload = `${sessionId}.${expiresAt}`;
  const sig = crypto.createHmac('sha256', SESSION_SECRET).update(payload).digest('hex');
  return { token: `${payload}.${sig}`, sessionId, expiresAt };
}

function verifySessionToken(token: string | undefined): string | null {
  if (!token) return null;
  const parts = token.split('.');
  if (parts.length !== 3) return null;
  const [sessionId, expiresAtStr, sig] = parts;
  const payload = `${sessionId}.${expiresAtStr}`;
  const expectedSig = crypto.createHmac('sha256', SESSION_SECRET).update(payload).digest('hex');
  const sigBuf = Buffer.from(sig, 'hex');
  const expBuf = Buffer.from(expectedSig, 'hex');
  if (sigBuf.length !== expBuf.length || !crypto.timingSafeEqual(sigBuf, expBuf)) {
    return null;
  }
  const expiresAt = Number(expiresAtStr);
  if (!Number.isFinite(expiresAt) || Date.now() > expiresAt) {
    activeSessions.delete(sessionId);
    return null;
  }
  if (!activeSessions.has(sessionId)) {
    return null;
  }
  return sessionId;
}

interface AuthedRequest extends Request {
  sessionId?: string;
}

function requireAuth(req: AuthedRequest, res: Response, next: NextFunction): void {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    res.status(401).json({ error: 'Autenticazione richiesta' });
    return;
  }
  const token = authHeader.slice('Bearer '.length).trim();
  const sessionId = verifySessionToken(token);
  if (!sessionId) {
    res.status(401).json({ error: 'Sessione scaduta o non valida' });
    return;
  }
  req.sessionId = sessionId;
  next();
}

function getAppBaseUrl(): string {
  const raw = process.env.APP_URL?.trim();
  if (raw && raw !== 'MY_APP_URL' && /^https?:\/\//i.test(raw)) {
    return raw.replace(/\/+$/, '');
  }
  return `http://localhost:${PORT}`;
}

function getStravaRedirectUri(): string {
  return `${getAppBaseUrl()}/auth/strava/callback`;
}

async function refreshStravaTokenIfNeeded(
  sessionId: string,
  tokens: StravaTokens
): Promise<StravaTokens | null> {
  const nowSec = Math.floor(Date.now() / 1000);
  if (tokens.expiresAt > nowSec + 120) {
    return tokens;
  }

  const clientId = process.env.STRAVA_CLIENT_ID?.trim();
  const clientSecret = process.env.STRAVA_CLIENT_SECRET?.trim();
  if (!clientId || !clientSecret) return null;

  const response = await fetch('https://www.strava.com/oauth/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      client_id: clientId,
      client_secret: clientSecret,
      grant_type: 'refresh_token',
      refresh_token: tokens.refreshToken,
    }),
  });

  if (!response.ok) return null;
  const data = (await response.json()) as {
    access_token: string;
    refresh_token: string;
    expires_at: number;
  };
  const updated: StravaTokens = {
    ...tokens,
    accessToken: data.access_token,
    refreshToken: data.refresh_token,
    expiresAt: data.expires_at,
  };
  stravaTokensBySession.set(sessionId, updated);
  return updated;
}

async function startServer(): Promise<void> {
  const app = express();
  app.set('trust proxy', 1);
  app.use(express.json({ limit: '1mb' }));

  // --- AUTH ROUTES ---
  app.post('/api/auth/login', (req: Request, res: Response) => {
    const clientIp = req.ip || 'unknown';
    const now = Date.now();
    const record = loginAttempts.get(clientIp);

    if (record && now < record.resetAt && record.count >= 5) {
      const retrySec = Math.ceil((record.resetAt - now) / 1000);
      res.status(429).json({
        error: `Troppi tentativi falliti. Riprova tra ${retrySec} secondi.`,
        retryAfter: retrySec,
      });
      return;
    }

    const pin = typeof req.body?.pin === 'string' ? req.body.pin.trim() : '';
    if (!verifyPin(pin)) {
      const nextCount = record && now < record.resetAt ? record.count + 1 : 1;
      loginAttempts.set(clientIp, {
        count: nextCount,
        resetAt: record && now < record.resetAt ? record.resetAt : now + 60_000,
      });
      res.status(401).json({
        error: 'Password non corretta.',
        attemptsRemaining: Math.max(0, 5 - nextCount),
      });
      return;
    }

    loginAttempts.delete(clientIp);
    const session = createSessionToken();
    res.json({
      token: session.token,
      expiresAt: session.expiresAt,
      mode: 'server',
    });
  });

  app.get('/api/auth/session', requireAuth, (_req: AuthedRequest, res: Response) => {
    res.json({ authenticated: true });
  });

  app.post('/api/auth/logout', requireAuth, (req: AuthedRequest, res: Response) => {
    if (req.sessionId) {
      activeSessions.delete(req.sessionId);
      stravaTokensBySession.delete(req.sessionId);
    }
    res.json({ ok: true });
  });

  app.post('/api/auth/change-pin', requireAuth, (req: AuthedRequest, res: Response) => {
    if (process.env.APP_ACCESS_PIN?.trim()) {
      res.status(400).json({
        error:
          'Il PIN è gestito dalla variabile di ambiente APP_ACCESS_PIN. Aggiornala nelle impostazioni dei segreti del server.',
      });
      return;
    }
    const currentPin = typeof req.body?.currentPin === 'string' ? req.body.currentPin.trim() : '';
    const newPin = typeof req.body?.newPin === 'string' ? req.body.newPin.trim() : '';

    if (!verifyPin(currentPin)) {
      res.status(401).json({ error: 'Password attuale non corretta.' });
      return;
    }
    if (!/^[a-zA-Z0-9]{6,20}$/.test(newPin)) {
      res.status(400).json({
        error: 'La nuova password deve avere tra 6 e 20 caratteri alfanumerici.',
      });
      return;
    }

    const salt = crypto.randomBytes(16).toString('hex');
    const hashHex = crypto.scryptSync(newPin, salt, 32).toString('hex');
    runtimeCustomPin = { salt, hashHex };
    res.json({ ok: true });
  });

  // --- STRAVA OAUTH ROUTES ---
  app.get('/api/strava/config', requireAuth, (_req: AuthedRequest, res: Response) => {
    const configured = Boolean(
      process.env.STRAVA_CLIENT_ID?.trim() && process.env.STRAVA_CLIENT_SECRET?.trim()
    );
    res.json({
      configured,
      redirectUri: getStravaRedirectUri(),
    });
  });

  app.get('/api/strava/url', requireAuth, (req: AuthedRequest, res: Response) => {
    const clientId = process.env.STRAVA_CLIENT_ID?.trim();
    const clientSecret = process.env.STRAVA_CLIENT_SECRET?.trim();
    if (!clientId || !clientSecret) {
      res.status(503).json({
        error:
          'Credenziali Strava non configurate. Imposta STRAVA_CLIENT_ID e STRAVA_CLIENT_SECRET nelle variabili di ambiente.',
      });
      return;
    }

    const state = crypto.randomBytes(24).toString('hex');
    pendingStravaStates.set(state, {
      sessionId: req.sessionId!,
      expiresAt: Date.now() + 10 * 60_000,
    });

    const params = new URLSearchParams({
      client_id: clientId,
      redirect_uri: getStravaRedirectUri(),
      response_type: 'code',
      approval_prompt: 'auto',
      scope: 'read,activity:write',
      state,
    });

    res.json({
      url: `https://www.strava.com/oauth/authorize?${params.toString()}`,
    });
  });

  const handleStravaCallback = async (req: Request, res: Response): Promise<void> => {
    const code = typeof req.query.code === 'string' ? req.query.code : '';
    const state = typeof req.query.state === 'string' ? req.query.state : '';
    const oauthError = typeof req.query.error === 'string' ? req.query.error : '';

    if (oauthError) {
      res.status(400).send(`
        <!doctype html><html lang="it"><body style="background:#07111F;color:#E8F0FA;font-family:sans-serif;padding:24px;">
          <p>Autorizzazione Strava annullata.</p>
          <script>
            if (window.opener) {
              window.opener.postMessage({ type: 'STRAVA_OAUTH_ERROR', error: 'Autorizzazione annullata' }, '*');
              window.close();
            }
          </script>
        </body></html>
      `);
      return;
    }

    const pending = pendingStravaStates.get(state);
    pendingStravaStates.delete(state);

    if (!code || !pending || Date.now() > pending.expiresAt) {
      res.status(400).send(`
        <!doctype html><html lang="it"><body style="background:#07111F;color:#E8F0FA;font-family:sans-serif;padding:24px;">
          <p>Stato OAuth non valido o scaduto. Riprova dalla webapp.</p>
          <script>
            if (window.opener) {
              window.opener.postMessage({ type: 'STRAVA_OAUTH_ERROR', error: 'Stato OAuth non valido o scaduto' }, '*');
              window.close();
            }
          </script>
        </body></html>
      `);
      return;
    }

    const clientId = process.env.STRAVA_CLIENT_ID?.trim();
    const clientSecret = process.env.STRAVA_CLIENT_SECRET?.trim();
    if (!clientId || !clientSecret) {
      res.status(503).send('Credenziali Strava non configurate.');
      return;
    }

    try {
      const tokenRes = await fetch('https://www.strava.com/oauth/token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          client_id: clientId,
          client_secret: clientSecret,
          code,
          grant_type: 'authorization_code',
        }),
      });

      if (!tokenRes.ok) {
        throw new Error(`Strava token exchange failed (${tokenRes.status})`);
      }

      const tokenData = (await tokenRes.json()) as {
        access_token: string;
        refresh_token: string;
        expires_at: number;
        athlete?: { id?: number; firstname?: string; lastname?: string };
      };

      const athleteName =
        [tokenData.athlete?.firstname, tokenData.athlete?.lastname].filter(Boolean).join(' ') ||
        'Atleta Strava';

      stravaTokensBySession.set(pending.sessionId, {
        accessToken: tokenData.access_token,
        refreshToken: tokenData.refresh_token,
        expiresAt: tokenData.expires_at,
        athleteName,
        athleteId: tokenData.athlete?.id ?? 0,
      });

      res.send(`
        <!doctype html>
        <html lang="it">
          <body style="background:#07111F;color:#E8F0FA;font-family:sans-serif;padding:24px;">
            <p>Account Strava collegato con successo. Questa finestra si chiuderà automaticamente.</p>
            <script>
              if (window.opener) {
                window.opener.postMessage({ type: 'STRAVA_OAUTH_SUCCESS' }, '*');
                window.close();
              } else {
                window.location.href = '/';
              }
            </script>
          </body>
        </html>
      `);
    } catch (err) {
      console.error('Strava OAuth error:', err);
      res.status(500).send(`
        <!doctype html><html lang="it"><body style="background:#07111F;color:#E8F0FA;font-family:sans-serif;padding:24px;">
          <p>Errore durante il collegamento con Strava.</p>
          <script>
            if (window.opener) {
              window.opener.postMessage({ type: 'STRAVA_OAUTH_ERROR', error: 'Errore scambio token Strava' }, '*');
              window.close();
            }
          </script>
        </body></html>
      `);
    }
  };

  app.get(['/auth/strava/callback', '/auth/strava/callback/'], handleStravaCallback);

  app.get('/api/strava/status', requireAuth, (req: AuthedRequest, res: Response) => {
    const tokens = stravaTokensBySession.get(req.sessionId!);
    res.json({
      connected: Boolean(tokens),
      athleteName: tokens?.athleteName ?? null,
    });
  });

  app.post('/api/strava/disconnect', requireAuth, (req: AuthedRequest, res: Response) => {
    stravaTokensBySession.delete(req.sessionId!);
    res.json({ ok: true });
  });

  app.post('/api/strava/activity', requireAuth, async (req: AuthedRequest, res: Response) => {
    const rawTokens = stravaTokensBySession.get(req.sessionId!);
    if (!rawTokens) {
      res.status(400).json({ error: 'Account Strava non collegato.' });
      return;
    }

    const tokens = await refreshStravaTokenIfNeeded(req.sessionId!, rawTokens);
    if (!tokens) {
      stravaTokensBySession.delete(req.sessionId!);
      res.status(401).json({ error: 'Sessione Strava scaduta. Ricollega il tuo account.' });
      return;
    }

    const { name, startDateIso, elapsedSeconds, distanceMeters, description, avgWatts } =
      req.body ?? {};

    if (
      typeof name !== 'string' ||
      typeof startDateIso !== 'string' ||
      typeof elapsedSeconds !== 'number' ||
      elapsedSeconds <= 0
    ) {
      res.status(400).json({ error: 'Dati allenamento non validi per Strava.' });
      return;
    }

    try {
      const payload = {
        name: name.slice(0, 120),
        sport_type: 'VirtualRide',
        start_date_local: startDateIso,
        elapsed_time: Math.round(elapsedSeconds),
        distance: Math.max(0, Math.round(Number(distanceMeters) || 0)),
        description:
          typeof description === 'string'
            ? description.slice(0, 500)
            : `Allenamento indoor registrato con Bikeaware (${Math.round(Number(avgWatts) || 0)} W medi)`,
        trainer: 1,
      };

      const stravaRes = await fetch('https://www.strava.com/api/v3/activities', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${tokens.accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      });

      if (!stravaRes.ok) {
        const errText = await stravaRes.text();
        res.status(stravaRes.status).json({
          error: `Strava ha rifiutato il caricamento (${stravaRes.status}).`,
          details: errText.slice(0, 200),
        });
        return;
      }

      const created = (await stravaRes.json()) as { id: number; name: string };
      res.json({
        ok: true,
        activityId: created.id,
        activityUrl: `https://www.strava.com/activities/${created.id}`,
      });
    } catch (err) {
      console.error('Strava upload error:', err);
      res.status(502).json({ error: 'Errore di rete durante il caricamento su Strava.' });
    }
  });

  // --- VITE / STATIC SERVING ---
  if (!IS_PROD) {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distDir = path.resolve(process.cwd(), 'dist');
    if (fs.existsSync(distDir)) {
      app.use(express.static(distDir));
      app.get('*', (_req: Request, res: Response) => {
        res.sendFile(path.join(distDir, 'index.html'));
      });
    }
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Bikeaware server listening on http://0.0.0.0:${PORT}`);
  });
}

startServer().catch((err) => {
  console.error('Failed to start Bikeaware server:', err);
  process.exit(1);
});
