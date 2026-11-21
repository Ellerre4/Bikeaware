import { initializeApp, getApps } from 'firebase/app';
import {
  getAuth,
  GoogleAuthProvider,
  onAuthStateChanged,
  signInWithPopup,
  type User,
} from 'firebase/auth';
import firebaseConfig from '../../firebase-applet-config.json';
import type {
  DailyGoalsConfig,
  TrainingProgram,
  WeeklySchedule,
  WorkoutSession,
} from '../types/bike';

// Minimal Google Workspace scope for Google Sheets backend database
export const GOOGLE_SHEETS_SCOPES = ['https://www.googleapis.com/auth/spreadsheets'];

const app = getApps().length > 0 ? getApps()[0] : initializeApp(firebaseConfig);
const auth = getAuth(app);

const provider = new GoogleAuthProvider();
GOOGLE_SHEETS_SCOPES.forEach((scope) => provider.addScope(scope));

// Strict in-memory OAuth access token cache (NEVER persisted in localStorage/sessionStorage)
let isSigningIn = false;
let cachedAccessToken: string | null = null;

export const initGoogleSheetsAuth = (
  onAuthSuccess?: (user: User, token: string) => void,
  onAuthRequired?: () => void
) => {
  return onAuthStateChanged(auth, (user: User | null) => {
    if (user) {
      if (cachedAccessToken) {
        onAuthSuccess?.(user, cachedAccessToken);
      } else if (!isSigningIn) {
        cachedAccessToken = null;
        onAuthRequired?.();
      }
    } else {
      cachedAccessToken = null;
      onAuthRequired?.();
    }
  });
};

export const signInWithGoogleForSheets = async (): Promise<{
  user: User;
  accessToken: string;
}> => {
  try {
    isSigningIn = true;
    const result = await signInWithPopup(auth, provider);
    const credential = GoogleAuthProvider.credentialFromResult(result);
    if (!credential?.accessToken) {
      throw new Error('Token di accesso Google Sheets non ottenuto. Riprova l\'accesso.');
    }
    cachedAccessToken = credential.accessToken;
    return { user: result.user, accessToken: cachedAccessToken };
  } finally {
    isSigningIn = false;
  }
};

export const getGoogleSheetsAccessToken = (): string | null => cachedAccessToken;

export const signOutGoogleSheets = async (): Promise<void> => {
  await auth.signOut();
  cachedAccessToken = null;
};

export function extractSpreadsheetId(input: string): string | null {
  const trimmed = input.trim();
  if (!trimmed) return null;
  const urlMatch = trimmed.match(/\/spreadsheets\/d\/([a-zA-Z0-9-_]+)/);
  if (urlMatch?.[1]) return urlMatch[1];
  if (/^[a-zA-Z0-9-_]{20,}$/.test(trimmed)) return trimmed;
  return null;
}

async function sheetsFetch<T>(url: string, options: RequestInit = {}): Promise<T> {
  if (!cachedAccessToken) {
    throw new Error('Sessione Google non attiva. Effettua prima l\'accesso con Google.');
  }
  const res = await fetch(url, {
    ...options,
    headers: {
      Authorization: `Bearer ${cachedAccessToken}`,
      'Content-Type': 'application/json',
      ...(options.headers || {}),
    },
  });
  if (!res.ok) {
    const errBody = await res.json().catch(() => ({}));
    const msg =
      errBody?.error?.message || `Errore Google Sheets API (${res.status}).`;
    if (res.status === 401) {
      cachedAccessToken = null;
    }
    throw new Error(msg);
  }
  return (await res.json()) as T;
}

const TAB_WORKOUTS = 'Allenamenti';
const TAB_PROGRAMS = 'Programmi';
const TAB_GOALS = 'Obiettivi';

const WORKOUT_HEADERS = [
  'ID',
  'DataISO',
  'Titolo',
  'Programma',
  'DurataSec',
  'DistanzaKm',
  'VelocitaMediaKmh',
  'VelocitaMaxKmh',
  'PotenzaMediaW',
  'PotenzaMaxW',
  'CadenzaMediaRpm',
  'FcMediaBpm',
  'FcMaxBpm',
  'CalorieKcal',
  'ResistenzaMedia',
  'Sorgente',
  'Note',
  'StravaSync',
  'GoogleFitSync',
  'CampioniJSON',
];

const PROGRAM_HEADERS = ['ID', 'Nome', 'Categoria', 'Descrizione', 'CreatoIl', 'BlocchiJSON'];
const GOAL_HEADERS = ['Chiave', 'ValoreJSON', 'AggiornatoIl'];

export interface SpreadsheetMetadata {
  spreadsheetId: string;
  title: string;
  spreadsheetUrl: string;
  sheetTitles: string[];
}

export async function inspectSpreadsheet(idOrUrl: string): Promise<SpreadsheetMetadata> {
  const spreadsheetId = extractSpreadsheetId(idOrUrl);
  if (!spreadsheetId) {
    throw new Error('URL o ID del foglio Google Sheets non valido.');
  }
  const data = await sheetsFetch<{
    spreadsheetId: string;
    spreadsheetUrl: string;
    properties: { title: string };
    sheets: Array<{ properties: { title: string } }>;
  }>(
    `https://sheets.googleapis.com/v4/spreadsheets/${encodeURIComponent(spreadsheetId)}?fields=spreadsheetId,spreadsheetUrl,properties.title,sheets.properties.title`
  );

  return {
    spreadsheetId: data.spreadsheetId,
    title: data.properties?.title || 'Foglio Google Sheets',
    spreadsheetUrl:
      data.spreadsheetUrl || `https://docs.google.com/spreadsheets/d/${data.spreadsheetId}`,
    sheetTitles: (data.sheets || []).map((s) => s.properties.title),
  };
}

export async function createBikeawareSpreadsheet(
  title = 'Bikeaware - Registro Allenamenti'
): Promise<SpreadsheetMetadata> {
  const created = await sheetsFetch<{
    spreadsheetId: string;
    spreadsheetUrl: string;
    properties: { title: string };
    sheets: Array<{ properties: { title: string } }>;
  }>('https://sheets.googleapis.com/v4/spreadsheets', {
    method: 'POST',
    body: JSON.stringify({
      properties: { title, locale: 'it_IT' },
      sheets: [
        { properties: { title: TAB_WORKOUTS } },
        { properties: { title: TAB_PROGRAMS } },
        { properties: { title: TAB_GOALS } },
      ],
    }),
  });

  // Populate initial header rows
  await sheetsFetch(
    `https://sheets.googleapis.com/v4/spreadsheets/${encodeURIComponent(created.spreadsheetId)}/values:batchUpdate`,
    {
      method: 'POST',
      body: JSON.stringify({
        valueInputOption: 'RAW',
        data: [
          { range: `${TAB_WORKOUTS}!A1:T1`, values: [WORKOUT_HEADERS] },
          { range: `${TAB_PROGRAMS}!A1:F1`, values: [PROGRAM_HEADERS] },
          { range: `${TAB_GOALS}!A1:C1`, values: [GOAL_HEADERS] },
        ],
      }),
    }
  );

  return {
    spreadsheetId: created.spreadsheetId,
    title: created.properties?.title || title,
    spreadsheetUrl:
      created.spreadsheetUrl || `https://docs.google.com/spreadsheets/d/${created.spreadsheetId}`,
    sheetTitles: [TAB_WORKOUTS, TAB_PROGRAMS, TAB_GOALS],
  };
}

export async function ensureBikeawareTabs(spreadsheetId: string): Promise<SpreadsheetMetadata> {
  const meta = await inspectSpreadsheet(spreadsheetId);
  const missing = [TAB_WORKOUTS, TAB_PROGRAMS, TAB_GOALS].filter(
    (tab) => !meta.sheetTitles.includes(tab)
  );

  if (missing.length > 0) {
    await sheetsFetch(
      `https://sheets.googleapis.com/v4/spreadsheets/${encodeURIComponent(spreadsheetId)}:batchUpdate`,
      {
        method: 'POST',
        body: JSON.stringify({
          requests: missing.map((title) => ({ addSheet: { properties: { title } } })),
        }),
      }
    );

    const headerWrites = missing.map((tab) => ({
      range:
        tab === TAB_WORKOUTS
          ? `${TAB_WORKOUTS}!A1:T1`
          : tab === TAB_PROGRAMS
          ? `${TAB_PROGRAMS}!A1:F1`
          : `${TAB_GOALS}!A1:C1`,
      values: [
        tab === TAB_WORKOUTS
          ? WORKOUT_HEADERS
          : tab === TAB_PROGRAMS
          ? PROGRAM_HEADERS
          : GOAL_HEADERS,
      ],
    }));

    await sheetsFetch(
      `https://sheets.googleapis.com/v4/spreadsheets/${encodeURIComponent(spreadsheetId)}/values:batchUpdate`,
      {
        method: 'POST',
        body: JSON.stringify({
          valueInputOption: 'RAW',
          data: headerWrites,
        }),
      }
    );
  }

  return inspectSpreadsheet(spreadsheetId);
}

function workoutToRow(w: WorkoutSession): (string | number | boolean)[] {
  // Keep telemetry compact (max 60 sampled points per row to stay well within Google Sheets cell limit)
  const stride = Math.max(1, Math.ceil(w.samples.length / 60));
  const compactSamples = w.samples.filter((_, idx) => idx % stride === 0).slice(0, 60);
  return [
    w.id,
    w.dateIso,
    w.title,
    w.programName,
    Math.round(w.durationSec),
    Number(w.distanceKm.toFixed(2)),
    Number(w.avgSpeedKmh.toFixed(1)),
    Number(w.maxSpeedKmh.toFixed(1)),
    Math.round(w.avgPowerWatts),
    Math.round(w.maxPowerWatts),
    Math.round(w.avgCadenceRpm),
    Math.round(w.avgHeartRateBpm),
    Math.round(w.maxHeartRateBpm),
    Math.round(w.caloriesKcal),
    Math.round(w.avgResistance),
    w.source,
    w.notes,
    w.syncedToStrava ? 'SI' : 'NO',
    w.syncedToGoogleFit ? 'SI' : 'NO',
    JSON.stringify(compactSamples),
  ];
}

function rowToWorkout(row: string[]): WorkoutSession | null {
  if (!row || !row[0] || row[0] === 'ID') return null;
  let samples = [];
  try {
    samples = row[19] ? JSON.parse(row[19]) : [];
  } catch {
    samples = [];
  }
  return {
    id: row[0],
    dateIso: row[1] || new Date().toISOString(),
    title: row[2] || 'Allenamento Cyclette',
    programId: null,
    programName: row[3] || 'Sessione libera',
    durationSec: Number(row[4]) || 0,
    distanceKm: Number(row[5]) || 0,
    avgSpeedKmh: Number(row[6]) || 0,
    maxSpeedKmh: Number(row[7]) || 0,
    avgPowerWatts: Number(row[8]) || 0,
    maxPowerWatts: Number(row[9]) || 0,
    avgCadenceRpm: Number(row[10]) || 0,
    avgHeartRateBpm: Number(row[11]) || 0,
    maxHeartRateBpm: Number(row[12]) || 0,
    caloriesKcal: Number(row[13]) || 0,
    avgResistance: Number(row[14]) || 6,
    source: row[15] === 'simulator' ? 'simulator' : 'bluetooth',
    notes: row[16] || '',
    syncedToSheets: true,
    syncedToStrava: row[17] === 'SI',
    syncedToGoogleFit: row[18] === 'SI',
    samples: Array.isArray(samples) ? samples : [],
  };
}

export async function appendWorkoutToSheets(
  spreadsheetId: string,
  workout: WorkoutSession
): Promise<void> {
  await ensureBikeawareTabs(spreadsheetId);
  await sheetsFetch(
    `https://sheets.googleapis.com/v4/spreadsheets/${encodeURIComponent(spreadsheetId)}/values/${encodeURIComponent(`${TAB_WORKOUTS}!A:T`)}:append?valueInputOption=RAW&insertDataOption=INSERT_ROWS`,
    {
      method: 'POST',
      body: JSON.stringify({
        values: [workoutToRow(workout)],
      }),
    }
  );
}

export async function syncAllDataToSheets(
  spreadsheetId: string,
  workouts: WorkoutSession[],
  programs: TrainingProgram[],
  goals: DailyGoalsConfig,
  schedule: WeeklySchedule
): Promise<void> {
  await ensureBikeawareTabs(spreadsheetId);

  // Clear existing ranges cleanly before rewriting normalized database tables
  await sheetsFetch(
    `https://sheets.googleapis.com/v4/spreadsheets/${encodeURIComponent(spreadsheetId)}/values:batchClear`,
    {
      method: 'POST',
      body: JSON.stringify({
        ranges: [`${TAB_WORKOUTS}!A1:T2000`, `${TAB_PROGRAMS}!A1:F500`, `${TAB_GOALS}!A1:C50`],
      }),
    }
  );

  const nowIso = new Date().toISOString();
  const workoutRows = [WORKOUT_HEADERS, ...workouts.map(workoutToRow)];
  const programRows = [
    PROGRAM_HEADERS,
    ...programs.map((p) => [
      p.id,
      p.name,
      p.category,
      p.description,
      p.createdAt,
      JSON.stringify(p.blocks),
    ]),
  ];
  const goalRows = [
    GOAL_HEADERS,
    ['daily_goals', JSON.stringify(goals), nowIso],
    ['weekly_schedule', JSON.stringify(schedule), nowIso],
  ];

  await sheetsFetch(
    `https://sheets.googleapis.com/v4/spreadsheets/${encodeURIComponent(spreadsheetId)}/values:batchUpdate`,
    {
      method: 'POST',
      body: JSON.stringify({
        valueInputOption: 'RAW',
        data: [
          { range: `${TAB_WORKOUTS}!A1`, values: workoutRows },
          { range: `${TAB_PROGRAMS}!A1`, values: programRows },
          { range: `${TAB_GOALS}!A1`, values: goalRows },
        ],
      }),
    }
  );
}

export async function loadAllDataFromSheets(spreadsheetId: string): Promise<{
  workouts: WorkoutSession[] | null;
  programs: TrainingProgram[] | null;
  goals: DailyGoalsConfig | null;
  schedule: WeeklySchedule | null;
}> {
  const meta = await inspectSpreadsheet(spreadsheetId);
  const rangesToFetch: string[] = [];
  if (meta.sheetTitles.includes(TAB_WORKOUTS)) rangesToFetch.push(`${TAB_WORKOUTS}!A2:T2000`);
  if (meta.sheetTitles.includes(TAB_PROGRAMS)) rangesToFetch.push(`${TAB_PROGRAMS}!A2:F500`);
  if (meta.sheetTitles.includes(TAB_GOALS)) rangesToFetch.push(`${TAB_GOALS}!A2:C50`);

  if (rangesToFetch.length === 0) {
    return { workouts: null, programs: null, goals: null, schedule: null };
  }

  const query = rangesToFetch.map((r) => `ranges=${encodeURIComponent(r)}`).join('&');
  const res = await sheetsFetch<{
    valueRanges?: Array<{ range: string; values?: string[][] }>;
  }>(`https://sheets.googleapis.com/v4/spreadsheets/${encodeURIComponent(spreadsheetId)}/values:batchGet?${query}`);

  let workouts: WorkoutSession[] | null = null;
  let programs: TrainingProgram[] | null = null;
  let goals: DailyGoalsConfig | null = null;
  let schedule: WeeklySchedule | null = null;

  for (const vr of res.valueRanges || []) {
    const rows = vr.values || [];
    if (vr.range.includes(TAB_WORKOUTS)) {
      const parsed = rows.map(rowToWorkout).filter((w): w is WorkoutSession => Boolean(w));
      if (parsed.length > 0) workouts = parsed;
    } else if (vr.range.includes(TAB_PROGRAMS)) {
      const parsed: TrainingProgram[] = [];
      for (const r of rows) {
        if (!r[0]) continue;
        try {
          parsed.push({
            id: r[0],
            name: r[1] || 'Programma',
            category: (r[2] as TrainingProgram['category']) || 'Aerobico',
            description: r[3] || '',
            createdAt: r[4] || new Date().toISOString(),
            blocks: r[5] ? JSON.parse(r[5]) : [],
          });
        } catch {
          // Skip malformed program row
        }
      }
      if (parsed.length > 0) programs = parsed;
    } else if (vr.range.includes(TAB_GOALS)) {
      for (const r of rows) {
        if (r[0] === 'daily_goals' && r[1]) {
          try {
            goals = JSON.parse(r[1]);
          } catch {
            // Skip
          }
        }
        if (r[0] === 'weekly_schedule' && r[1]) {
          try {
            schedule = JSON.parse(r[1]);
          } catch {
            // Skip
          }
        }
      }
    }
  }

  return { workouts, programs, goals, schedule };
}
