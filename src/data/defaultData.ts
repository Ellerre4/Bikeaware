import type {
  DailyGoalsConfig,
  TelemetryPoint,
  TrainingProgram,
  WeekdayKey,
  WeeklySchedule,
  WorkoutSession,
} from '../types/bike';

export const DEFAULT_GOALS: DailyGoalsConfig = {
  targetMinutes: 45,
  targetDistanceKm: 18,
  targetCaloriesKcal: 420,
  ftpWatts: 210,
  maxHeartRateBpm: 184,
  notificationsEnabled: true,
  reminderTime: '18:30',
  reminderDays: ['lun', 'mar', 'gio', 'ven', 'sab'],
  notifyAt50Percent: true,
  notifyAt100Percent: true,
  notifyOnIntervalChange: true,
  soundCueEnabled: true,
};

export const DEFAULT_PROGRAMS: TrainingProgram[] = [
  {
    id: 'prog-hiit-3030',
    name: 'HIIT Sprint 30/30',
    category: 'HIIT',
    description:
      'Blocchi brevi ad alta potenza per stimolare il VO2 max con recuperi attivi controllati.',
    createdAt: '2026-11-01T08:00:00.000Z',
    blocks: [
      {
        id: 'b-hiit-1',
        label: 'Riscaldamento progressivo',
        phase: 'warmup',
        durationSec: 300,
        targetResistance: 5,
        targetCadenceRpm: 82,
        targetPowerWatts: 125,
      },
      {
        id: 'b-hiit-2',
        label: 'Sprint 1',
        phase: 'sprint',
        durationSec: 30,
        targetResistance: 14,
        targetCadenceRpm: 102,
        targetPowerWatts: 275,
      },
      {
        id: 'b-hiit-3',
        label: 'Recupero 1',
        phase: 'recovery',
        durationSec: 30,
        targetResistance: 4,
        targetCadenceRpm: 75,
        targetPowerWatts: 100,
      },
      {
        id: 'b-hiit-4',
        label: 'Sprint 2',
        phase: 'sprint',
        durationSec: 30,
        targetResistance: 15,
        targetCadenceRpm: 104,
        targetPowerWatts: 285,
      },
      {
        id: 'b-hiit-5',
        label: 'Recupero 2',
        phase: 'recovery',
        durationSec: 30,
        targetResistance: 4,
        targetCadenceRpm: 75,
        targetPowerWatts: 100,
      },
      {
        id: 'b-hiit-6',
        label: 'Sprint 3',
        phase: 'sprint',
        durationSec: 30,
        targetResistance: 15,
        targetCadenceRpm: 105,
        targetPowerWatts: 290,
      },
      {
        id: 'b-hiit-7',
        label: 'Recupero 3',
        phase: 'recovery',
        durationSec: 30,
        targetResistance: 4,
        targetCadenceRpm: 75,
        targetPowerWatts: 100,
      },
      {
        id: 'b-hiit-8',
        label: 'Sprint 4',
        phase: 'sprint',
        durationSec: 30,
        targetResistance: 16,
        targetCadenceRpm: 105,
        targetPowerWatts: 295,
      },
      {
        id: 'b-hiit-9',
        label: 'Defaticamento sciolto',
        phase: 'cooldown',
        durationSec: 240,
        targetResistance: 3,
        targetCadenceRpm: 74,
        targetPowerWatts: 95,
      },
    ],
  },
  {
    id: 'prog-zone2-base',
    name: 'Fondo Aerobico Zona 2',
    category: 'Aerobico',
    description:
      'Seduta costante per costruire resistenza cardiovascolare e ossidazione lipidica a cadenza fluida.',
    createdAt: '2026-11-02T08:00:00.000Z',
    blocks: [
      {
        id: 'b-z2-1',
        label: 'Avvio morbido',
        phase: 'warmup',
        durationSec: 300,
        targetResistance: 5,
        targetCadenceRpm: 80,
        targetPowerWatts: 120,
      },
      {
        id: 'b-z2-2',
        label: 'Fondo aerobico centrale',
        phase: 'endurance',
        durationSec: 1800,
        targetResistance: 8,
        targetCadenceRpm: 86,
        targetPowerWatts: 155,
      },
      {
        id: 'b-z2-3',
        label: 'Defaticamento',
        phase: 'cooldown',
        durationSec: 300,
        targetResistance: 4,
        targetCadenceRpm: 75,
        targetPowerWatts: 100,
      },
    ],
  },
  {
    id: 'prog-salita-prog',
    name: 'Salita Progressiva Resistenza',
    category: 'Resistenza',
    description:
      'Incremento graduale della resistenza magnetica simulando un passo alpino a cadenza di forza.',
    createdAt: '2026-11-03T08:00:00.000Z',
    blocks: [
      {
        id: 'b-sal-1',
        label: 'Riscaldamento pianura',
        phase: 'warmup',
        durationSec: 300,
        targetResistance: 5,
        targetCadenceRpm: 84,
        targetPowerWatts: 125,
      },
      {
        id: 'b-sal-2',
        label: 'Pendenza 4% — Ritmo medio',
        phase: 'endurance',
        durationSec: 420,
        targetResistance: 9,
        targetCadenceRpm: 78,
        targetPowerWatts: 168,
      },
      {
        id: 'b-sal-3',
        label: 'Pendenza 7% — Soglia forza',
        phase: 'tempo',
        durationSec: 420,
        targetResistance: 12,
        targetCadenceRpm: 72,
        targetPowerWatts: 198,
      },
      {
        id: 'b-sal-4',
        label: 'Strappo finale 10%',
        phase: 'sprint',
        durationSec: 180,
        targetResistance: 15,
        targetCadenceRpm: 68,
        targetPowerWatts: 235,
      },
      {
        id: 'b-sal-5',
        label: 'Discesa e recupero',
        phase: 'cooldown',
        durationSec: 300,
        targetResistance: 4,
        targetCadenceRpm: 80,
        targetPowerWatts: 105,
      },
    ],
  },
  {
    id: 'prog-ftp-4x5',
    name: 'Intervalli Soglia FTP 4x5\'',
    category: 'Soglia',
    description:
      'Quattro ripetute da 5 minuti al 95–100% della soglia funzionale per innalzare la potenza sostenibile.',
    createdAt: '2026-11-04T08:00:00.000Z',
    blocks: [
      {
        id: 'b-ftp-1',
        label: 'Riscaldamento',
        phase: 'warmup',
        durationSec: 360,
        targetResistance: 6,
        targetCadenceRpm: 85,
        targetPowerWatts: 130,
      },
      {
        id: 'b-ftp-2',
        label: 'Soglia 1',
        phase: 'tempo',
        durationSec: 300,
        targetResistance: 11,
        targetCadenceRpm: 88,
        targetPowerWatts: 205,
      },
      {
        id: 'b-ftp-3',
        label: 'Recupero 1',
        phase: 'recovery',
        durationSec: 150,
        targetResistance: 5,
        targetCadenceRpm: 78,
        targetPowerWatts: 110,
      },
      {
        id: 'b-ftp-4',
        label: 'Soglia 2',
        phase: 'tempo',
        durationSec: 300,
        targetResistance: 11,
        targetCadenceRpm: 88,
        targetPowerWatts: 208,
      },
      {
        id: 'b-ftp-5',
        label: 'Recupero 2',
        phase: 'recovery',
        durationSec: 150,
        targetResistance: 5,
        targetCadenceRpm: 78,
        targetPowerWatts: 110,
      },
      {
        id: 'b-ftp-6',
        label: 'Soglia 3',
        phase: 'tempo',
        durationSec: 300,
        targetResistance: 12,
        targetCadenceRpm: 86,
        targetPowerWatts: 210,
      },
      {
        id: 'b-ftp-7',
        label: 'Recupero 3',
        phase: 'recovery',
        durationSec: 150,
        targetResistance: 5,
        targetCadenceRpm: 78,
        targetPowerWatts: 110,
      },
      {
        id: 'b-ftp-8',
        label: 'Soglia 4',
        phase: 'tempo',
        durationSec: 300,
        targetResistance: 12,
        targetCadenceRpm: 86,
        targetPowerWatts: 212,
      },
      {
        id: 'b-ftp-9',
        label: 'Defaticamento',
        phase: 'cooldown',
        durationSec: 300,
        targetResistance: 4,
        targetCadenceRpm: 76,
        targetPowerWatts: 98,
      },
    ],
  },
  {
    id: 'prog-recovery-20',
    name: 'Recupero Attivo 20\'',
    category: 'Recupero',
    description:
      'Pedalata rigenerante a bassa resistenza per favorire il recupero muscolare tra sessioni intense.',
    createdAt: '2026-11-05T08:00:00.000Z',
    blocks: [
      {
        id: 'b-rec-1',
        label: 'Scioglimento leggero',
        phase: 'recovery',
        durationSec: 1200,
        targetResistance: 4,
        targetCadenceRpm: 82,
        targetPowerWatts: 105,
      },
    ],
  },
];

export const DEFAULT_WEEKLY_SCHEDULE: WeeklySchedule = {
  lun: 'prog-zone2-base',
  mar: 'prog-hiit-3030',
  mer: null,
  gio: 'prog-ftp-4x5',
  ven: 'prog-recovery-20',
  sab: 'prog-salita-prog',
  dom: null,
};

function buildSampleSeries(
  durationSec: number,
  basePower: number,
  baseCadence: number,
  baseHr: number,
  baseRes: number,
  seed: number
): TelemetryPoint[] {
  const points: TelemetryPoint[] = [];
  const step = Math.max(15, Math.floor(durationSec / 40));
  let dist = 0;
  let kcal = 0;
  const startTs = Date.now() - durationSec * 1000;

  for (let s = 0; s <= durationSec; s += step) {
    const progress = s / durationSec;
    const warmupFactor = progress < 0.12 ? 0.72 + progress * 2.3 : progress > 0.88 ? 0.75 : 1;
    const wave = Math.sin(progress * Math.PI * 6 + seed) * 0.14;
    const power = Math.max(70, Math.round(basePower * warmupFactor * (1 + wave)));
    const cadence = Math.max(62, Math.round(baseCadence + Math.cos(progress * 10 + seed) * 7));
    const speed = Number((18 + power / 14.5).toFixed(1));
    const hr = Math.min(185, Math.max(98, Math.round(baseHr * (0.82 + 0.18 * progress) + wave * 24)));
    const resistance = Math.min(20, Math.max(2, Math.round(baseRes * (1 + wave * 0.7))));
    if (s > 0) {
      dist += (speed * step) / 3600;
      kcal += (power * step) / 1000;
    }
    points.push({
      elapsedSec: s,
      timestamp: startTs + s * 1000,
      speedKmh: speed,
      cadenceRpm: cadence,
      powerWatts: power,
      heartRateBpm: hr,
      resistanceLevel: resistance,
      distanceKm: Number(dist.toFixed(2)),
      caloriesKcal: Math.round(kcal),
    });
  }
  return points;
}

export const INITIAL_WORKOUT_HISTORY: WorkoutSession[] = [
  {
    id: 'wkt-20261119-01',
    dateIso: '2026-11-19T18:15:00.000Z',
    title: 'Fondo Aerobico Zona 2',
    programId: 'prog-zone2-base',
    programName: 'Fondo Aerobico Zona 2',
    durationSec: 2400,
    distanceKm: 19.4,
    avgSpeedKmh: 29.1,
    maxSpeedKmh: 33.4,
    avgPowerWatts: 158,
    maxPowerWatts: 192,
    avgCadenceRpm: 86,
    avgHeartRateBpm: 138,
    maxHeartRateBpm: 151,
    caloriesKcal: 396,
    avgResistance: 8,
    source: 'bluetooth',
    notes: 'Ottima stabilità cardiaca su tutto il blocco centrale.',
    syncedToSheets: false,
    syncedToStrava: false,
    syncedToGoogleFit: false,
    samples: buildSampleSeries(2400, 158, 86, 138, 8, 1.2),
  },
  {
    id: 'wkt-20261117-01',
    dateIso: '2026-11-17T19:00:00.000Z',
    title: 'Intervalli Soglia FTP 4x5\'',
    programId: 'prog-ftp-4x5',
    programName: 'Intervalli Soglia FTP 4x5\'',
    durationSec: 2310,
    distanceKm: 20.6,
    avgSpeedKmh: 32.1,
    maxSpeedKmh: 37.8,
    avgPowerWatts: 184,
    maxPowerWatts: 236,
    avgCadenceRpm: 85,
    avgHeartRateBpm: 156,
    maxHeartRateBpm: 174,
    caloriesKcal: 445,
    avgResistance: 10,
    source: 'bluetooth',
    notes: 'Quarta ripetuta impegnativa ma cadenza mantenuta sopra 85 RPM.',
    syncedToSheets: false,
    syncedToStrava: false,
    syncedToGoogleFit: false,
    samples: buildSampleSeries(2310, 184, 85, 156, 10, 2.7),
  },
  {
    id: 'wkt-20261115-01',
    dateIso: '2026-11-15T10:30:00.000Z',
    title: 'Salita Progressiva Resistenza',
    programId: 'prog-salita-prog',
    programName: 'Salita Progressiva Resistenza',
    durationSec: 1620,
    distanceKm: 13.8,
    avgSpeedKmh: 30.7,
    maxSpeedKmh: 35.2,
    avgPowerWatts: 176,
    maxPowerWatts: 248,
    avgCadenceRpm: 76,
    avgHeartRateBpm: 152,
    maxHeartRateBpm: 171,
    caloriesKcal: 312,
    avgResistance: 11,
    source: 'bluetooth',
    notes: 'Buona spinta sul blocco al 10% di pendenza simulata.',
    syncedToSheets: false,
    syncedToStrava: false,
    syncedToGoogleFit: false,
    samples: buildSampleSeries(1620, 176, 76, 152, 11, 3.8),
  },
  {
    id: 'wkt-20261112-01',
    dateIso: '2026-11-12T18:40:00.000Z',
    title: 'HIIT Sprint 30/30',
    programId: 'prog-hiit-3030',
    programName: 'HIIT Sprint 30/30',
    durationSec: 1380,
    distanceKm: 12.1,
    avgSpeedKmh: 31.6,
    maxSpeedKmh: 41.2,
    avgPowerWatts: 169,
    maxPowerWatts: 304,
    avgCadenceRpm: 89,
    avgHeartRateBpm: 159,
    maxHeartRateBpm: 179,
    caloriesKcal: 268,
    avgResistance: 9,
    source: 'bluetooth',
    notes: 'Picco massimo sopra i 300 W nel terzo sprint.',
    syncedToSheets: false,
    syncedToStrava: false,
    syncedToGoogleFit: false,
    samples: buildSampleSeries(1380, 169, 89, 159, 9, 4.9),
  },
  {
    id: 'wkt-20261109-01',
    dateIso: '2026-11-09T17:50:00.000Z',
    title: 'Recupero Attivo 20\'',
    programId: 'prog-recovery-20',
    programName: 'Recupero Attivo 20\'',
    durationSec: 1200,
    distanceKm: 8.6,
    avgSpeedKmh: 25.8,
    maxSpeedKmh: 28.4,
    avgPowerWatts: 108,
    maxPowerWatts: 128,
    avgCadenceRpm: 83,
    avgHeartRateBpm: 118,
    maxHeartRateBpm: 129,
    caloriesKcal: 142,
    avgResistance: 4,
    source: 'bluetooth',
    notes: 'Gambe leggere, defaticamento post-allenamento.',
    syncedToSheets: false,
    syncedToStrava: false,
    syncedToGoogleFit: false,
    samples: buildSampleSeries(1200, 108, 83, 118, 4, 5.4),
  },
];

export const WEEKDAY_LABELS: { key: WeekdayKey; short: string; full: string }[] = [
  { key: 'lun', short: 'Lun', full: 'Lunedì' },
  { key: 'mar', short: 'Mar', full: 'Martedì' },
  { key: 'mer', short: 'Mer', full: 'Mercoledì' },
  { key: 'gio', short: 'Gio', full: 'Giovedì' },
  { key: 'ven', short: 'Ven', full: 'Venerdì' },
  { key: 'sab', short: 'Sab', full: 'Sabato' },
  { key: 'dom', short: 'Dom', full: 'Domenica' },
];

export const PHASE_META: Record<
  string,
  { label: string; color: string; bgBar: string }
> = {
  warmup: { label: 'Riscaldamento', color: '#38BDF8', bgBar: 'bg-sky-400' },
  endurance: { label: 'Aerobico', color: '#22C55E', bgBar: 'bg-emerald-500' },
  tempo: { label: 'Soglia / Tempo', color: '#F59E0B', bgBar: 'bg-amber-500' },
  sprint: { label: 'Sprint / HIIT', color: '#F43F5E', bgBar: 'bg-rose-500' },
  recovery: { label: 'Recupero', color: '#60A5FA', bgBar: 'bg-blue-400' },
  cooldown: { label: 'Defaticamento', color: '#818CF8', bgBar: 'bg-indigo-400' },
};

export function getProgramTotalDuration(program: TrainingProgram): number {
  return program.blocks.reduce((sum, b) => sum + b.durationSec, 0);
}

export function formatDuration(totalSec: number): string {
  const s = Math.max(0, Math.floor(totalSec));
  const hrs = Math.floor(s / 3600);
  const mins = Math.floor((s % 3600) / 60);
  const secs = s % 60;
  if (hrs > 0) {
    return `${String(hrs).padStart(2, '0')}:${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
  }
  return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
}
