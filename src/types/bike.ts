export type NavSection = 'dashboard' | 'programs' | 'history' | 'goals' | 'settings';

export type IntervalPhaseType = 'warmup' | 'endurance' | 'tempo' | 'sprint' | 'recovery' | 'cooldown';

export interface TelemetryPoint {
  elapsedSec: number;
  timestamp: number;
  speedKmh: number;
  cadenceRpm: number;
  powerWatts: number;
  heartRateBpm: number;
  resistanceLevel: number;
  distanceKm: number;
  caloriesKcal: number;
}

export interface IntervalBlock {
  id: string;
  label: string;
  phase: IntervalPhaseType;
  durationSec: number;
  targetResistance: number; // 1-20
  targetCadenceRpm: number;
  targetPowerWatts: number;
}

export type ProgramCategory = 'HIIT' | 'Resistenza' | 'Aerobico' | 'Soglia' | 'Recupero';

export interface TrainingProgram {
  id: string;
  name: string;
  category: ProgramCategory;
  description: string;
  blocks: IntervalBlock[];
  createdAt: string;
}

export type WeekdayKey = 'lun' | 'mar' | 'mer' | 'gio' | 'ven' | 'sab' | 'dom';

export type WeeklySchedule = Record<WeekdayKey, string | null>; // programId or null (Riposo)

export interface WorkoutSession {
  id: string;
  dateIso: string; // ISO string
  title: string;
  programId: string | null;
  programName: string;
  durationSec: number;
  distanceKm: number;
  avgSpeedKmh: number;
  maxSpeedKmh: number;
  avgPowerWatts: number;
  maxPowerWatts: number;
  avgCadenceRpm: number;
  avgHeartRateBpm: number;
  maxHeartRateBpm: number;
  caloriesKcal: number;
  avgResistance: number;
  source: 'bluetooth' | 'simulator';
  notes: string;
  syncedToSheets: boolean;
  syncedToStrava: boolean;
  syncedToGoogleFit: boolean;
  stravaActivityUrl?: string;
  samples: TelemetryPoint[];
}

export interface DailyGoalsConfig {
  targetMinutes: number;
  targetDistanceKm: number;
  targetCaloriesKcal: number;
  ftpWatts: number;
  maxHeartRateBpm: number;
  notificationsEnabled: boolean;
  reminderTime: string; // HH:mm
  reminderDays: WeekdayKey[];
  notifyAt50Percent: boolean;
  notifyAt100Percent: boolean;
  notifyOnIntervalChange: boolean;
  soundCueEnabled: boolean;
}

export interface GoalNotificationLog {
  id: string;
  timestamp: string;
  title: string;
  body: string;
  type: 'goal' | 'reminder' | 'interval' | 'system';
}

export interface SheetsConfig {
  spreadsheetId: string;
  spreadsheetTitle: string;
  spreadsheetUrl: string;
  lastSyncIso: string | null;
  autoSyncOnSave: boolean;
}

export interface FitnessIntegrationsConfig {
  stravaAutoSync: boolean;
  googleFitAutoExportTcx: boolean;
  googleFitWebhookUrl: string;
}

export interface BleConnectionState {
  status: 'disconnected' | 'connecting' | 'connected' | 'simulating' | 'error';
  deviceName: string | null;
  protocol: 'FTMS' | 'CSC' | 'CPS' | 'SIM' | null;
  supportsResistanceControl: boolean;
  errorMessage: string | null;
}

export interface ConfirmDialogRequest {
  title: string;
  description: string;
  details?: string[];
  confirmLabel: string;
  cancelLabel?: string;
  destructive?: boolean;
  onConfirm: () => Promise<void> | void;
}
