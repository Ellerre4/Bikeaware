import { getAuthRuntimeMode, getSessionToken } from './authService';
import { exportWorkoutTcx } from './exportService';
import type { WorkoutSession } from '../types/bike';

export interface StravaConfigInfo {
  configured: boolean;
  redirectUri: string;
  serverAvailable: boolean;
}

export interface StravaStatusInfo {
  connected: boolean;
  athleteName: string | null;
}

function authHeaders(): HeadersInit {
  const token = getSessionToken();
  return token ? { Authorization: `Bearer ${token}` } : {};
}

export async function fetchStravaConfig(): Promise<StravaConfigInfo> {
  if (getAuthRuntimeMode() === 'static-ghpages') {
    return {
      configured: false,
      redirectUri: `${window.location.origin}/auth/strava/callback`,
      serverAvailable: false,
    };
  }
  try {
    const res = await fetch('/api/strava/config', { headers: authHeaders() });
    if (!res.ok) {
      return {
        configured: false,
        redirectUri: `${window.location.origin}/auth/strava/callback`,
        serverAvailable: false,
      };
    }
    const data = await res.json();
    return {
      configured: Boolean(data.configured),
      redirectUri: data.redirectUri || `${window.location.origin}/auth/strava/callback`,
      serverAvailable: true,
    };
  } catch {
    return {
      configured: false,
      redirectUri: `${window.location.origin}/auth/strava/callback`,
      serverAvailable: false,
    };
  }
}

export async function fetchStravaStatus(): Promise<StravaStatusInfo> {
  if (getAuthRuntimeMode() === 'static-ghpages') {
    return { connected: false, athleteName: null };
  }
  try {
    const res = await fetch('/api/strava/status', { headers: authHeaders() });
    if (!res.ok) return { connected: false, athleteName: null };
    return await res.json();
  } catch {
    return { connected: false, athleteName: null };
  }
}

export async function startStravaOAuthPopup(): Promise<{ ok: boolean; error?: string }> {
  const res = await fetch('/api/strava/url', { headers: authHeaders() });
  const data = await res.json().catch(() => ({}));
  if (!res.ok || !data.url) {
    return { ok: false, error: data.error || 'Impossibile avviare il collegamento Strava.' };
  }

  const popup = window.open(data.url, 'strava_oauth_popup', 'width=600,height=720');
  if (!popup) {
    return {
      ok: false,
      error: 'Popup bloccato dal browser. Consenti i popup per collegare Strava.',
    };
  }
  return { ok: true };
}

export async function disconnectStrava(): Promise<void> {
  if (getAuthRuntimeMode() === 'static-ghpages') return;
  await fetch('/api/strava/disconnect', {
    method: 'POST',
    headers: authHeaders(),
  });
}

export async function uploadWorkoutToStrava(
  workout: WorkoutSession
): Promise<{ ok: boolean; activityUrl?: string; error?: string }> {
  if (getAuthRuntimeMode() === 'static-ghpages') {
    return {
      ok: false,
      error: 'Upload diretto Strava richiede il backend OAuth; usa l\'export .TCX su GitHub Pages.',
    };
  }

  try {
    const res = await fetch('/api/strava/activity', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...authHeaders(),
      },
      body: JSON.stringify({
        name: workout.title,
        startDateIso: workout.dateIso,
        elapsedSeconds: workout.durationSec,
        distanceMeters: Math.round(workout.distanceKm * 1000),
        avgWatts: workout.avgPowerWatts,
        description: `Bikeaware · ${workout.programName} · Potenza media ${workout.avgPowerWatts}W · Cadenza ${workout.avgCadenceRpm} RPM${workout.notes ? ' · ' + workout.notes : ''}`,
      }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      return { ok: false, error: data.error || 'Errore durante l\'invio su Strava.' };
    }
    return { ok: true, activityUrl: data.activityUrl };
  } catch {
    return { ok: false, error: 'Errore di connessione verso il server Strava.' };
  }
}

export async function syncWorkoutToGoogleFit(
  workout: WorkoutSession,
  options: { autoExportTcx: boolean; webhookUrl?: string }
): Promise<{ ok: boolean; method: 'webhook' | 'tcx'; message: string }> {
  const cleanWebhook = options.webhookUrl?.trim();
  if (cleanWebhook && /^https:\/\//i.test(cleanWebhook)) {
    try {
      const res = await fetch(cleanWebhook, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          source: 'Bikeaware',
          sport: 'IndoorCycling',
          startTimeIso: workout.dateIso,
          durationSeconds: workout.durationSec,
          distanceMeters: Math.round(workout.distanceKm * 1000),
          caloriesKcal: workout.caloriesKcal,
          avgPowerWatts: workout.avgPowerWatts,
          avgHeartRateBpm: workout.avgHeartRateBpm,
          avgCadenceRpm: workout.avgCadenceRpm,
        }),
      });
      if (res.ok) {
        return {
          ok: true,
          method: 'webhook',
          message: 'Sessione inviata al bridge Google Fit / Health Connect.',
        };
      }
    } catch {
      // Fallback to TCX package below
    }
  }

  if (options.autoExportTcx) {
    exportWorkoutTcx(workout);
    return {
      ok: true,
      method: 'tcx',
      message: 'File .TCX generato automaticamente per importazione su Google Fit / Health Connect.',
    };
  }

  return {
    ok: false,
    method: 'tcx',
    message: 'Nessun metodo di invio Google Fit attivo.',
  };
}
