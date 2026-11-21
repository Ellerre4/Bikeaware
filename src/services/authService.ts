// In-memory session token (never written to localStorage or sessionStorage)
let inMemorySessionToken: string | null = null;
let authRuntimeMode: 'server' | 'static-ghpages' = 'server';

// Precomputed salted SHA-256 hash used ONLY when hosted statically on GitHub Pages without Node backend
const STATIC_SALT = 'ba_ghp_salt_4e8a1b7c9d2f5a31';
const STATIC_DEFAULT_HASH =
  '97485e2c5a5c4fd98b863ef82b411ac41fbb2dfdd094bb40a4f5803c97dca026';

let customStaticDigest: { salt: string; hashHex: string } | null = null;

async function sha256Hex(input: string): Promise<string> {
  const data = new TextEncoder().encode(input);
  const digest = await crypto.subtle.digest('SHA-256', data);
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

function constantTimeCompare(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) {
    diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return diff === 0;
}

export interface LoginResult {
  ok: boolean;
  error?: string;
  attemptsRemaining?: number;
  mode?: 'server' | 'static-ghpages';
}

export async function loginWithPin(pin: string): Promise<LoginResult> {
  const cleanPin = pin.trim();
  if (!cleanPin) {
    return { ok: false, error: 'Inserisci la password di accesso.' };
  }

  try {
    const res = await fetch('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ pin: cleanPin }),
    });

    if (res.status !== 404) {
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        return {
          ok: false,
          error: data.error || 'Password non corretta.',
          attemptsRemaining: data.attemptsRemaining,
        };
      }
      inMemorySessionToken = data.token;
      authRuntimeMode = 'server';
      return { ok: true, mode: 'server' };
    }
  } catch {
    // Fallback below only when running on static hosting (e.g. GitHub Pages) without /api server
  }

  // Static GitHub Pages fallback verification using Web Crypto SHA-256
  authRuntimeMode = 'static-ghpages';
  const salt = customStaticDigest?.salt ?? STATIC_SALT;
  const expected = customStaticDigest?.hashHex ?? STATIC_DEFAULT_HASH;
  const computed = await sha256Hex(`${salt}:${cleanPin}`);

  if (!constantTimeCompare(computed, expected)) {
    return { ok: false, error: 'Password non corretta.' };
  }

  inMemorySessionToken = `static-session-${Date.now()}`;
  return { ok: true, mode: 'static-ghpages' };
}

export async function changeAppPin(
  currentPin: string,
  newPin: string
): Promise<{ ok: boolean; error?: string }> {
  if (authRuntimeMode === 'server' && inMemorySessionToken) {
    const res = await fetch('/api/auth/change-pin', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${inMemorySessionToken}`,
      },
      body: JSON.stringify({ currentPin, newPin }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      return { ok: false, error: data.error || 'Impossibile aggiornare la password.' };
    }
    return { ok: true };
  }

  // Static mode update (in-memory for current session)
  const salt = customStaticDigest?.salt ?? STATIC_SALT;
  const expected = customStaticDigest?.hashHex ?? STATIC_DEFAULT_HASH;
  const check = await sha256Hex(`${salt}:${currentPin.trim()}`);
  if (!constantTimeCompare(check, expected)) {
    return { ok: false, error: 'Password attuale non corretta.' };
  }
  if (!/^[a-zA-Z0-9]{6,20}$/.test(newPin.trim())) {
    return {
      ok: false,
      error: 'La nuova password deve avere tra 6 e 20 caratteri alfanumerici.',
    };
  }
  const newSalt = `ba_custom_${Date.now()}`;
  const newHash = await sha256Hex(`${newSalt}:${newPin.trim()}`);
  customStaticDigest = { salt: newSalt, hashHex: newHash };
  return { ok: true };
}

export async function logoutSession(): Promise<void> {
  if (authRuntimeMode === 'server' && inMemorySessionToken) {
    try {
      await fetch('/api/auth/logout', {
        method: 'POST',
        headers: { Authorization: `Bearer ${inMemorySessionToken}` },
      });
    } catch {
      // Ignore network errors on logout
    }
  }
  inMemorySessionToken = null;
}

export function getSessionToken(): string | null {
  return inMemorySessionToken;
}

export function getAuthRuntimeMode(): 'server' | 'static-ghpages' {
  return authRuntimeMode;
}
