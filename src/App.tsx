import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Activity,
  Bell,
  Bike,
  Bluetooth,
  Database,
  FileSpreadsheet,
  History,
  ListChecks,
  Lock,
  Menu,
  PanelLeftClose,
  PanelLeftOpen,
  X,
} from 'lucide-react';
import type { User } from 'firebase/auth';
import { ConfirmModal } from './components/ConfirmModal';
import { DashboardView } from './components/DashboardView';
import { GoalsNotificationsView } from './components/GoalsNotificationsView';
import { HistoryView } from './components/HistoryView';
import { LoginScreen } from './components/LoginScreen';
import { ProgramsView } from './components/ProgramsView';
import { SettingsIntegrationsView } from './components/SettingsIntegrationsView';
import {
  DEFAULT_GOALS,
  DEFAULT_PROGRAMS,
  DEFAULT_WEEKLY_SCHEDULE,
  formatDuration,
  INITIAL_WORKOUT_HISTORY,
} from './data/defaultData';
import { logoutSession } from './services/authService';
import { bluetoothBike, type LiveBikeReading } from './services/bluetoothBike';
import {
  appendWorkoutToSheets,
  createBikeawareSpreadsheet,
  ensureBikeawareTabs,
  getGoogleSheetsAccessToken,
  initGoogleSheetsAuth,
  inspectSpreadsheet,
  loadAllDataFromSheets,
  signInWithGoogleForSheets,
  signOutGoogleSheets,
  syncAllDataToSheets,
} from './services/googleSheets';
import {
  disconnectStrava,
  fetchStravaStatus,
  startStravaOAuthPopup,
  syncWorkoutToGoogleFit,
  uploadWorkoutToStrava,
  type StravaStatusInfo,
} from './services/integrationsService';
import { dispatchPushNotification } from './services/notificationsService';
import type {
  BleConnectionState,
  ConfirmDialogRequest,
  DailyGoalsConfig,
  FitnessIntegrationsConfig,
  GoalNotificationLog,
  NavSection,
  SheetsConfig,
  TelemetryPoint,
  TrainingProgram,
  WeekdayKey,
  WorkoutSession,
  WeeklySchedule,
} from './types/bike';

const STORAGE_KEYS = {
  workouts: 'bikeaware_workouts_v1',
  programs: 'bikeaware_programs_v1',
  schedule: 'bikeaware_schedule_v1',
  goals: 'bikeaware_goals_v1',
  sheetsMeta: 'bikeaware_sheets_meta_v1',
  integrations: 'bikeaware_integrations_v1',
  sidebarCollapsed: 'bikeaware_sidebar_collapsed_v1',
};

function readStorage<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return fallback;
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

const EMPTY_POINT: TelemetryPoint = {
  elapsedSec: 0,
  timestamp: 0,
  speedKmh: 0,
  cadenceRpm: 0,
  powerWatts: 0,
  heartRateBpm: 0,
  resistanceLevel: 6,
  distanceKm: 0,
  caloriesKcal: 0,
};

const NAV_ITEMS: { id: NavSection; label: string; icon: React.ComponentType<{ className?: string }> }[] = [
  { id: 'dashboard', label: 'Dashboard Live', icon: Activity },
  { id: 'programs', label: 'Programmi', icon: ListChecks },
  { id: 'history', label: 'Cronologia & PDF', icon: History },
  { id: 'goals', label: 'Obiettivi & Notifiche', icon: Bell },
  { id: 'settings', label: 'Sheets & Integrazioni', icon: Database },
];

const WEEKDAY_JS_MAP: WeekdayKey[] = ['dom', 'lun', 'mar', 'mer', 'gio', 'ven', 'sab'];

interface ToastItem {
  id: string;
  title: string;
  message: string;
  tone: 'info' | 'success' | 'warning';
}

export default function App() {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [activeNav, setActiveNav] = useState<NavSection>('dashboard');
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState<boolean>(() =>
    readStorage<boolean>(STORAGE_KEYS.sidebarCollapsed, false)
  );
  const [dismissedSheetsBanner, setDismissedSheetsBanner] = useState(false);

  // Persisted domain state (never auth tokens!)
  const [workouts, setWorkouts] = useState<WorkoutSession[]>(() =>
    readStorage(STORAGE_KEYS.workouts, INITIAL_WORKOUT_HISTORY)
  );
  const [programs, setPrograms] = useState<TrainingProgram[]>(() =>
    readStorage(STORAGE_KEYS.programs, DEFAULT_PROGRAMS)
  );
  const [weeklySchedule, setWeeklySchedule] = useState<WeeklySchedule>(() =>
    readStorage(STORAGE_KEYS.schedule, DEFAULT_WEEKLY_SCHEDULE)
  );
  const [goals, setGoals] = useState<DailyGoalsConfig>(() =>
    readStorage(STORAGE_KEYS.goals, DEFAULT_GOALS)
  );
  const [sheetsConfig, setSheetsConfig] = useState<SheetsConfig | null>(() =>
    readStorage<SheetsConfig | null>(STORAGE_KEYS.sheetsMeta, null)
  );
  const [integrations, setIntegrations] = useState<FitnessIntegrationsConfig>(() =>
    readStorage<FitnessIntegrationsConfig>(STORAGE_KEYS.integrations, {
      stravaAutoSync: true,
      googleFitAutoExportTcx: false,
      googleFitWebhookUrl: '',
    })
  );

  // Google Sheets OAuth state (access token cached strictly in memory inside googleSheets.ts)
  const [googleUser, setGoogleUser] = useState<User | null>(null);
  const [googleTokenReady, setGoogleTokenReady] = useState(false);
  const [isGoogleSigningIn, setIsGoogleSigningIn] = useState(false);
  const [isSheetsBusy, setIsSheetsBusy] = useState(false);

  // Strava state
  const [stravaStatus, setStravaStatus] = useState<StravaStatusInfo>({
    connected: false,
    athleteName: null,
  });

  // Live Bluetooth & Workout Session state
  const [bleState, setBleState] = useState<BleConnectionState>(() => bluetoothBike.getState());
  const [activeProgramId, setActiveProgramId] = useState<string | null>(
    DEFAULT_PROGRAMS[0]?.id ?? null
  );
  const [isRecording, setIsRecording] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [elapsedSec, setElapsedSec] = useState(0);
  const [resistanceLevel, setResistanceLevel] = useState(8);
  const [livePoint, setLivePoint] = useState<TelemetryPoint>(EMPTY_POINT);
  const [sessionSamples, setSessionSamples] = useState<TelemetryPoint[]>([]);

  // Notifications & Confirm modal
  const [notificationLogs, setNotificationLogs] = useState<GoalNotificationLog[]>([]);
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const [confirmRequest, setConfirmRequest] = useState<ConfirmDialogRequest | null>(null);

  // Refs for accurate 1-second accumulation & milestone tracking
  const latestReadingRef = useRef<LiveBikeReading>({
    speedKmh: 0,
    cadenceRpm: 0,
    powerWatts: 0,
    heartRateBpm: 0,
    resistanceLevel: 8,
  });
  const distanceKmRef = useRef(0);
  const caloriesKcalRef = useRef(0);
  const lastIntervalIndexRef = useRef<number>(-1);
  const fired50TodayRef = useRef(false);
  const fired100TodayRef = useRef(false);
  const lastReminderDateRef = useRef<string>('');

  // Persist non-sensitive app state
  useEffect(() => {
    localStorage.setItem(STORAGE_KEYS.workouts, JSON.stringify(workouts));
  }, [workouts]);
  useEffect(() => {
    localStorage.setItem(STORAGE_KEYS.programs, JSON.stringify(programs));
  }, [programs]);
  useEffect(() => {
    localStorage.setItem(STORAGE_KEYS.schedule, JSON.stringify(weeklySchedule));
  }, [weeklySchedule]);
  useEffect(() => {
    localStorage.setItem(STORAGE_KEYS.goals, JSON.stringify(goals));
  }, [goals]);
  useEffect(() => {
    if (sheetsConfig) {
      localStorage.setItem(STORAGE_KEYS.sheetsMeta, JSON.stringify(sheetsConfig));
    } else {
      localStorage.removeItem(STORAGE_KEYS.sheetsMeta);
    }
  }, [sheetsConfig]);
  useEffect(() => {
    localStorage.setItem(STORAGE_KEYS.integrations, JSON.stringify(integrations));
  }, [integrations]);
  useEffect(() => {
    localStorage.setItem(STORAGE_KEYS.sidebarCollapsed, JSON.stringify(sidebarCollapsed));
  }, [sidebarCollapsed]);

  const pushToast = useCallback(
    (title: string, message: string, tone: ToastItem['tone'] = 'info') => {
      const id = `toast-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
      setToasts((prev) => [...prev.slice(-2), { id, title, message, tone }]);
      window.setTimeout(() => {
        setToasts((prev) => prev.filter((t) => t.id !== id));
      }, 4500);
    },
    []
  );

  const recordAndNotify = useCallback(
    (
      title: string,
      body: string,
      type: GoalNotificationLog['type'],
      tone: 'milestone' | 'interval' = 'milestone'
    ) => {
      setNotificationLogs((prev) => [
        {
          id: `notif-${Date.now()}-${Math.random().toString(36).slice(2, 5)}`,
          timestamp: new Date().toISOString(),
          title,
          body,
          type,
        },
        ...prev.slice(0, 29),
      ]);
      dispatchPushNotification(title, body, {
        sound: goals.soundCueEnabled,
        tone,
      });
      pushToast(title, body, type === 'goal' ? 'success' : 'info');
    },
    [goals.soundCueEnabled, pushToast]
  );

  const activeProgram = useMemo(
    () => programs.find((p) => p.id === activeProgramId) || null,
    [programs, activeProgramId]
  );

  const todayWorkouts = useMemo(() => {
    const todayStr = new Date().toISOString().slice(0, 10);
    return workouts.filter((w) => w.dateIso.slice(0, 10) === todayStr);
  }, [workouts]);

  // Initialize Firebase Google Sheets auth listener
  useEffect(() => {
    const unsub = initGoogleSheetsAuth(
      (user) => {
        setGoogleUser(user);
        setGoogleTokenReady(Boolean(getGoogleSheetsAccessToken()));
      },
      () => {
        setGoogleTokenReady(false);
      }
    );
    return () => unsub();
  }, []);

  // Load Strava status after PIN login + listen for popup callback
  useEffect(() => {
    if (!isAuthenticated) return;
    fetchStravaStatus().then(setStravaStatus);

    const onMessage = (event: MessageEvent) => {
      const origin = event.origin;
      const isTrustedOrigin =
        origin === window.location.origin ||
        origin.endsWith('.run.app') ||
        origin.includes('localhost');
      if (!isTrustedOrigin) return;

      if (event.data?.type === 'STRAVA_OAUTH_SUCCESS') {
        fetchStravaStatus().then((st) => {
          setStravaStatus(st);
          pushToast(
            'Strava collegato',
            st.athleteName
              ? `Account ${st.athleteName} pronto per il salvataggio automatico.`
              : 'Account Strava pronto.',
            'success'
          );
        });
      } else if (event.data?.type === 'STRAVA_OAUTH_ERROR') {
        pushToast(
          'Collegamento Strava',
          event.data?.error || 'Autorizzazione non completata.',
          'warning'
        );
      }
    };
    window.addEventListener('message', onMessage);
    return () => window.removeEventListener('message', onMessage);
  }, [isAuthenticated, pushToast]);

  // Subscribe to Bluetooth / Simulator telemetry stream
  useEffect(() => {
    const unsubStatus = bluetoothBike.onStatus((st) => setBleState(st));
    const unsubTelemetry = bluetoothBike.onTelemetry((reading) => {
      latestReadingRef.current = reading;
      setLivePoint((prev) => ({
        ...prev,
        speedKmh: reading.speedKmh,
        cadenceRpm: reading.cadenceRpm,
        powerWatts: reading.powerWatts,
        heartRateBpm: reading.heartRateBpm,
        resistanceLevel: reading.resistanceLevel,
      }));
    });
    return () => {
      unsubStatus();
      unsubTelemetry();
    };
  }, []);

  // 1-second session recorder & guided interval engine
  useEffect(() => {
    if (!isRecording || isPaused) return;

    const timer = window.setInterval(() => {
      setElapsedSec((prevElapsed) => {
        const nextElapsed = prevElapsed + 1;
        const r = latestReadingRef.current;

        // Accumulate distance (km) and energy (kcal ~ Watts * s / 1000 for cycling efficiency ~24%)
        distanceKmRef.current += r.speedKmh / 3600;
        caloriesKcalRef.current += r.powerWatts / 1000;

        const point: TelemetryPoint = {
          elapsedSec: nextElapsed,
          timestamp: Date.now(),
          speedKmh: r.speedKmh,
          cadenceRpm: r.cadenceRpm,
          powerWatts: r.powerWatts,
          heartRateBpm: r.heartRateBpm,
          resistanceLevel: r.resistanceLevel,
          distanceKm: Number(distanceKmRef.current.toFixed(3)),
          caloriesKcal: Math.round(caloriesKcalRef.current),
        };

        setLivePoint(point);
        setSessionSamples((prev) => [...prev, point]);

        // Guided program interval check
        if (activeProgram && activeProgram.blocks.length > 0) {
          let acc = 0;
          for (let i = 0; i < activeProgram.blocks.length; i++) {
            const blk = activeProgram.blocks[i];
            if (nextElapsed < acc + blk.durationSec) {
              if (lastIntervalIndexRef.current !== i) {
                lastIntervalIndexRef.current = i;
                setResistanceLevel(blk.targetResistance);
                bluetoothBike.setResistanceLevel(blk.targetResistance);
                bluetoothBike.setSimulatorTargets({
                  resistance: blk.targetResistance,
                  targetCadenceRpm: blk.targetCadenceRpm,
                  targetPowerWatts: blk.targetPowerWatts,
                });
                if (goals.notifyOnIntervalChange && nextElapsed > 1) {
                  recordAndNotify(
                    `Nuovo intervallo: ${blk.label}`,
                    `Target ${blk.targetPowerWatts} W · ${blk.targetCadenceRpm} RPM · Resistenza ${blk.targetResistance}`,
                    'interval',
                    'interval'
                  );
                }
              }
              break;
            }
            acc += blk.durationSec;
          }
        }

        // Daily goal milestone push notification check (skipped in Sessione Libera)
        if (activeProgram) {
          const savedMin = todayWorkouts.reduce((a, w) => a + w.durationSec / 60, 0);
          const totalMin = savedMin + nextElapsed / 60;
          const progressPct = (totalMin / Math.max(1, goals.targetMinutes)) * 100;

          if (goals.notifyAt50Percent && progressPct >= 50 && !fired50TodayRef.current) {
            fired50TodayRef.current = true;
            recordAndNotify(
              'Metà obiettivo giornaliero raggiunto',
              `Hai completato ${Math.round(totalMin)} su ${goals.targetMinutes} minuti previsti oggi.`,
              'goal',
              'milestone'
            );
          }
          if (goals.notifyAt100Percent && progressPct >= 100 && !fired100TodayRef.current) {
            fired100TodayRef.current = true;
            recordAndNotify(
              'Obiettivo giornaliero completato',
              `Ottimo lavoro: hai raggiunto ${goals.targetMinutes} minuti di allenamento oggi.`,
              'goal',
              'milestone'
            );
          }
        }

        return nextElapsed;
      });
    }, 1000);

    return () => window.clearInterval(timer);
  }, [isRecording, isPaused, activeProgram, goals, todayWorkouts, recordAndNotify]);

  // Daily Reminder Push Scheduler (checks every 30 seconds)
  useEffect(() => {
    if (!isAuthenticated || !goals.notificationsEnabled) return;

    const checkReminder = () => {
      const now = new Date();
      const todayKey = now.toISOString().slice(0, 10);
      if (lastReminderDateRef.current === todayKey) return;

      const weekday = WEEKDAY_JS_MAP[now.getDay()];
      if (!goals.reminderDays.includes(weekday)) return;

      const currentHHMM = `${String(now.getHours()).padStart(2, '0')}:${String(
        now.getMinutes()
      ).padStart(2, '0')}`;
      if (currentHHMM !== goals.reminderTime) return;

      const todayMinutes = todayWorkouts.reduce((a, w) => a + w.durationSec / 60, 0);
      if (todayMinutes < goals.targetMinutes) {
        lastReminderDateRef.current = todayKey;
        const remaining = Math.max(1, Math.round(goals.targetMinutes - todayMinutes));
        recordAndNotify(
          'Promemoria allenamento Bikeaware',
          `Ti mancano ${remaining} minuti per completare l'obiettivo quotidiano di ${goals.targetMinutes} min.`,
          'reminder',
          'milestone'
        );
      }
    };

    const interval = window.setInterval(checkReminder, 30_000);
    return () => window.clearInterval(interval);
  }, [isAuthenticated, goals, todayWorkouts, recordAndNotify]);

  // Bluetooth & Session Handlers
  const handleConnectBluetooth = async () => {
    const ok = await bluetoothBike.connectBike();
    if (ok) {
      pushToast('Cyclette connessa', 'Telemetria Bluetooth attiva in tempo reale.', 'success');
    }
  };

  const handleConnectHrStrap = async () => {
    const ok = await bluetoothBike.connectHeartRateStrap();
    if (ok) {
      pushToast('Fascia cardio collegata', 'Lettura frequenza cardiaca attiva.', 'success');
    }
  };

  const handleStartSimulator = () => {
    const firstBlock = activeProgram?.blocks[0];
    if (firstBlock) {
      setResistanceLevel(firstBlock.targetResistance);
      bluetoothBike.setSimulatorTargets({
        resistance: firstBlock.targetResistance,
        targetCadenceRpm: firstBlock.targetCadenceRpm,
        targetPowerWatts: firstBlock.targetPowerWatts,
      });
    }
    bluetoothBike.startSimulator();
    pushToast(
      'Simulatore BLE attivo',
      'Generazione dati telemetrici FTMS pronta per test e demo.',
      'info'
    );
  };

  const handleDisconnectBle = () => {
    bluetoothBike.disconnect();
  };

  const handleStartSession = () => {
    if (bleState.status !== 'connected' && bleState.status !== 'simulating') {
      handleStartSimulator();
    }
    distanceKmRef.current = 0;
    caloriesKcalRef.current = 0;
    lastIntervalIndexRef.current = -1;
    setElapsedSec(0);
    setSessionSamples([]);
    setIsPaused(false);
    setIsRecording(true);
  };

  const handleResetSession = () => {
    setIsRecording(false);
    setIsPaused(false);
    setElapsedSec(0);
    distanceKmRef.current = 0;
    caloriesKcalRef.current = 0;
    lastIntervalIndexRef.current = -1;
    setSessionSamples([]);
    setLivePoint((prev) => ({
      ...prev,
      elapsedSec: 0,
      distanceKm: 0,
      caloriesKcal: 0,
    }));
  };

  const handleChangeResistance = (level: number) => {
    const clamped = Math.max(1, Math.min(20, level));
    setResistanceLevel(clamped);
    bluetoothBike.setResistanceLevel(clamped);
  };

  const handleFinishAndSave = async (title: string, notes: string) => {
    const samples = sessionSamples.length > 0 ? sessionSamples : [livePoint];
    const count = Math.max(1, samples.length);
    const avgPower = Math.round(samples.reduce((a, s) => a + s.powerWatts, 0) / count);
    const maxPower = Math.max(...samples.map((s) => s.powerWatts));
    const avgSpeed = Number((samples.reduce((a, s) => a + s.speedKmh, 0) / count).toFixed(1));
    const maxSpeed = Number(Math.max(...samples.map((s) => s.speedKmh)).toFixed(1));
    const avgCad = Math.round(samples.reduce((a, s) => a + s.cadenceRpm, 0) / count);
    const hrSamples = samples.filter((s) => s.heartRateBpm > 0);
    const avgHr =
      hrSamples.length > 0
        ? Math.round(hrSamples.reduce((a, s) => a + s.heartRateBpm, 0) / hrSamples.length)
        : 0;
    const maxHr = hrSamples.length > 0 ? Math.max(...hrSamples.map((s) => s.heartRateBpm)) : 0;
    const avgRes = Math.round(samples.reduce((a, s) => a + s.resistanceLevel, 0) / count);

    let newWorkout: WorkoutSession = {
      id: `wkt-${Date.now()}`,
      dateIso: new Date().toISOString(),
      title,
      programId: activeProgram?.id ?? null,
      programName: activeProgram?.name ?? 'Sessione libera',
      durationSec: Math.max(1, elapsedSec),
      distanceKm: Number(distanceKmRef.current.toFixed(2)),
      avgSpeedKmh: avgSpeed,
      maxSpeedKmh: maxSpeed,
      avgPowerWatts: avgPower,
      maxPowerWatts: maxPower,
      avgCadenceRpm: avgCad,
      avgHeartRateBpm: avgHr,
      maxHeartRateBpm: maxHr,
      caloriesKcal: Math.round(caloriesKcalRef.current),
      avgResistance: avgRes,
      source: bleState.status === 'connected' ? 'bluetooth' : 'simulator',
      notes,
      syncedToSheets: false,
      syncedToStrava: false,
      syncedToGoogleFit: false,
      samples,
    };

    // Automatic Strava sync if connected & enabled
    if (stravaStatus.connected && integrations.stravaAutoSync) {
      const stravaRes = await uploadWorkoutToStrava(newWorkout);
      if (stravaRes.ok) {
        newWorkout = {
          ...newWorkout,
          syncedToStrava: true,
          stravaActivityUrl: stravaRes.activityUrl,
        };
        pushToast('Strava aggiornato', 'Sessione caricata automaticamente su Strava.', 'success');
      } else {
        pushToast('Avviso Strava', stravaRes.error || 'Caricamento Strava non riuscito.', 'warning');
      }
    }

    // Automatic Google Fit sync if enabled
    if (integrations.googleFitAutoExportTcx || integrations.googleFitWebhookUrl.trim()) {
      const fitRes = await syncWorkoutToGoogleFit(newWorkout, {
        autoExportTcx: integrations.googleFitAutoExportTcx,
        webhookUrl: integrations.googleFitWebhookUrl,
      });
      if (fitRes.ok) {
        newWorkout = { ...newWorkout, syncedToGoogleFit: true };
        pushToast('Google Fit', fitRes.message, 'success');
      }
    }

    setWorkouts((prev) => [newWorkout, ...prev]);
    handleResetSession();
    pushToast(
      'Allenamento salvato',
      `${newWorkout.title} (${formatDuration(newWorkout.durationSec)} · ${newWorkout.distanceKm.toFixed(2)} km)`,
      'success'
    );

    // Propose confirmed append to Google Sheets if connected & auto-sync is on
    if (sheetsConfig && googleTokenReady && sheetsConfig.autoSyncOnSave) {
      setConfirmRequest({
        title: 'Salvare la sessione su Google Sheets?',
        description: `Vuoi aggiungere questa sessione al foglio "${sheetsConfig.spreadsheetTitle}" nella scheda Allenamenti?`,
        details: [
          `Allenamento: ${newWorkout.title}`,
          `Durata: ${formatDuration(newWorkout.durationSec)} · Distanza: ${newWorkout.distanceKm.toFixed(2)} km`,
          `Potenza media: ${newWorkout.avgPowerWatts} W · Calorie: ${newWorkout.caloriesKcal} kcal`,
        ],
        confirmLabel: 'Salva su Google Sheets',
        onConfirm: async () => {
          setIsSheetsBusy(true);
          try {
            await appendWorkoutToSheets(sheetsConfig.spreadsheetId, newWorkout);
            setWorkouts((prev) =>
              prev.map((item) =>
                item.id === newWorkout.id ? { ...item, syncedToSheets: true } : item
              )
            );
            setSheetsConfig((prev) =>
              prev ? { ...prev, lastSyncIso: new Date().toISOString() } : prev
            );
            pushToast(
              'Google Sheets aggiornato',
              'Riga allenamento aggiunta al tuo foglio personale.',
              'success'
            );
          } catch (err) {
            pushToast(
              'Errore Google Sheets',
              err instanceof Error ? err.message : 'Impossibile salvare sul foglio.',
              'warning'
            );
          } finally {
            setIsSheetsBusy(false);
          }
        },
      });
    }
  };

  // Google Sheets Actions (ALL mutating operations require explicit user confirmation!)
  const handleGoogleSignIn = async () => {
    setIsGoogleSigningIn(true);
    try {
      const result = await signInWithGoogleForSheets();
      setGoogleUser(result.user);
      setGoogleTokenReady(true);
      pushToast(
        'Accesso Google riuscito',
        `Connesso come ${result.user.email || result.user.displayName}.`,
        'success'
      );
    } catch (err) {
      pushToast(
        'Accesso Google non completato',
        err instanceof Error ? err.message : 'Riprova ad accedere con Google.',
        'warning'
      );
    } finally {
      setIsGoogleSigningIn(false);
    }
  };

  const handleGoogleSignOut = async () => {
    await signOutGoogleSheets();
    setGoogleUser(null);
    setGoogleTokenReady(false);
    pushToast('Account Google disconnesso', 'Token di accesso rimosso dalla memoria.', 'info');
  };

  const handleCreateNewSpreadsheet = () => {
    setConfirmRequest({
      title: 'Creare un nuovo foglio Google Sheets?',
      description:
        'Verrà creato il foglio "Bikeaware - Registro Allenamenti" nel tuo account Google con le schede Allenamenti, Programmi e Obiettivi.',
      details: [
        'Scheda Allenamenti: cronologia, metriche e telemetria campionata',
        'Scheda Programmi: programmi a intervalli personalizzati',
        'Scheda Obiettivi: obiettivi quotidiani e calendario settimanale',
      ],
      confirmLabel: 'Crea foglio',
      onConfirm: async () => {
        setIsSheetsBusy(true);
        try {
          const meta = await createBikeawareSpreadsheet();
          setSheetsConfig({
            spreadsheetId: meta.spreadsheetId,
            spreadsheetTitle: meta.title,
            spreadsheetUrl: meta.spreadsheetUrl,
            lastSyncIso: null,
            autoSyncOnSave: true,
          });
          pushToast('Foglio creato', `"${meta.title}" collegato come database.`, 'success');
        } catch (err) {
          pushToast(
            'Errore creazione foglio',
            err instanceof Error ? err.message : 'Operazione non riuscita.',
            'warning'
          );
        } finally {
          setIsSheetsBusy(false);
        }
      },
    });
  };

  const handleLinkExistingSpreadsheet = async (urlOrId: string) => {
    setIsSheetsBusy(true);
    try {
      const meta = await inspectSpreadsheet(urlOrId);
      const missingTabs = ['Allenamenti', 'Programmi', 'Obiettivi'].filter(
        (t) => !meta.sheetTitles.includes(t)
      );

      if (missingTabs.length > 0) {
        setConfirmRequest({
          title: `Inizializzare il foglio "${meta.title}"?`,
          description:
            'Il foglio selezionato non contiene ancora tutte le schede Bikeaware. Vuoi aggiungerle senza modificare le tue schede esistenti?',
          details: [
            `Foglio: ${meta.title}`,
            `Schede esistenti: ${meta.sheetTitles.join(', ')}`,
            `Schede da creare: ${missingTabs.join(', ')}`,
          ],
          confirmLabel: 'Collega e crea schede',
          onConfirm: async () => {
            setIsSheetsBusy(true);
            try {
              const updated = await ensureBikeawareTabs(meta.spreadsheetId);
              setSheetsConfig({
                spreadsheetId: updated.spreadsheetId,
                spreadsheetTitle: updated.title,
                spreadsheetUrl: updated.spreadsheetUrl,
                lastSyncIso: null,
                autoSyncOnSave: true,
              });
              pushToast('Foglio collegato', `"${updated.title}" pronto per la sincronizzazione.`, 'success');
            } finally {
              setIsSheetsBusy(false);
            }
          },
        });
      } else {
        setSheetsConfig({
          spreadsheetId: meta.spreadsheetId,
          spreadsheetTitle: meta.title,
          spreadsheetUrl: meta.spreadsheetUrl,
          lastSyncIso: null,
          autoSyncOnSave: true,
        });
        pushToast('Foglio collegato', `"${meta.title}" riconosciuto con tutte le schede.`, 'success');
      }
    } catch (err) {
      pushToast(
        'Impossibile leggere il foglio',
        err instanceof Error ? err.message : 'Verifica URL/ID e permessi.',
        'warning'
      );
    } finally {
      setIsSheetsBusy(false);
    }
  };

  const handleSyncToSheets = () => {
    if (!sheetsConfig) return;
    setConfirmRequest({
      title: 'Sincronizzare tutti i dati su Google Sheets?',
      description: `I dati locali verranno scritti nelle schede Allenamenti, Programmi e Obiettivi del foglio "${sheetsConfig.spreadsheetTitle}".`,
      details: [
        `${workouts.length} allenamenti da archiviare`,
        `${programs.length} programmi di allenamento`,
        'Obiettivi quotidiani e calendario settimanale',
      ],
      confirmLabel: 'Conferma sincronizzazione',
      onConfirm: async () => {
        setIsSheetsBusy(true);
        try {
          await syncAllDataToSheets(
            sheetsConfig.spreadsheetId,
            workouts,
            programs,
            goals,
            weeklySchedule
          );
          setWorkouts((prev) => prev.map((w) => ({ ...w, syncedToSheets: true })));
          setSheetsConfig((prev) =>
            prev ? { ...prev, lastSyncIso: new Date().toISOString() } : prev
          );
          pushToast('Sincronizzazione completata', 'Database Google Sheets aggiornato.', 'success');
        } catch (err) {
          pushToast(
            'Errore sincronizzazione',
            err instanceof Error ? err.message : 'Riprova dopo aver verificato la connessione.',
            'warning'
          );
        } finally {
          setIsSheetsBusy(false);
        }
      },
    });
  };

  const handleLoadFromSheets = async () => {
    if (!sheetsConfig) return;
    setIsSheetsBusy(true);
    try {
      const data = await loadAllDataFromSheets(sheetsConfig.spreadsheetId);
      let loadedParts: string[] = [];
      if (data.workouts) {
        setWorkouts(data.workouts);
        loadedParts.push(`${data.workouts.length} allenamenti`);
      }
      if (data.programs) {
        setPrograms(data.programs);
        loadedParts.push(`${data.programs.length} programmi`);
      }
      if (data.goals) {
        setGoals(data.goals);
        loadedParts.push('obiettivi');
      }
      if (data.schedule) {
        setWeeklySchedule(data.schedule);
      }
      setSheetsConfig((prev) =>
        prev ? { ...prev, lastSyncIso: new Date().toISOString() } : prev
      );
      pushToast(
        'Dati caricati da Google Sheets',
        loadedParts.length > 0
          ? `Importati: ${loadedParts.join(', ')}.`
          : 'Il foglio non contiene ancora righe salvate.',
        'success'
      );
    } catch (err) {
      pushToast(
        'Errore lettura Google Sheets',
        err instanceof Error ? err.message : 'Impossibile leggere il foglio.',
        'warning'
      );
    } finally {
      setIsSheetsBusy(false);
    }
  };

  // Delete Workout / Program with confirmation
  const handleDeleteWorkout = (workout: WorkoutSession) => {
    setConfirmRequest({
      title: 'Eliminare questa sessione?',
      description: `Vuoi rimuovere definitivamente "${workout.title}" dalla cronologia?`,
      details: [
        `Data: ${new Date(workout.dateIso).toLocaleDateString('it-IT')}`,
        `Distanza: ${workout.distanceKm.toFixed(1)} km · Durata: ${formatDuration(workout.durationSec)}`,
        sheetsConfig && googleTokenReady
          ? 'Ricorda di sincronizzare Google Sheets se desideri aggiornare anche il foglio cloud.'
          : 'La rimozione verrà applicata all\'archivio locale.',
      ],
      confirmLabel: 'Elimina sessione',
      destructive: true,
      onConfirm: () => {
        setWorkouts((prev) => prev.filter((item) => item.id !== workout.id));
        pushToast('Sessione eliminata', `"${workout.title}" rimossa dalla cronologia.`, 'info');
      },
    });
  };

  const handleDeleteProgram = (programId: string) => {
    const target = programs.find((p) => p.id === programId);
    if (!target) return;
    setConfirmRequest({
      title: 'Eliminare il programma?',
      description: `Confermi l'eliminazione del programma "${target.name}"?`,
      confirmLabel: 'Elimina programma',
      destructive: true,
      onConfirm: () => {
        setPrograms((prev) => prev.filter((p) => p.id !== programId));
        if (activeProgramId === programId) setActiveProgramId(null);
        pushToast('Programma eliminato', `"${target.name}" rimosso.`, 'info');
      },
    });
  };

  const handleSaveProgram = (program: TrainingProgram) => {
    setPrograms((prev) => {
      const exists = prev.some((p) => p.id === program.id);
      return exists ? prev.map((p) => (p.id === program.id ? program : p)) : [program, ...prev];
    });
    pushToast('Programma salvato', `"${program.name}" pronto per le tue sessioni.`, 'success');
  };

  const handleLoadProgramInDashboard = (programId: string | null) => {
    if (programId === null) {
      setActiveProgramId(null);
      bluetoothBike.setSimulatorTargets({
        resistance: resistanceLevel,
        targetCadenceRpm: 82,
        targetPowerWatts: Math.round(90 + resistanceLevel * 10),
      });
      setActiveNav('dashboard');
      pushToast(
        'Sessione Libera attivata',
        'La dashboard mostra solo i dati live senza obiettivi.',
        'info'
      );
      return;
    }

    const prog = programs.find((p) => p.id === programId);
    if (!prog) return;
    setActiveProgramId(programId);
    if (prog.blocks[0]) {
      setResistanceLevel(prog.blocks[0].targetResistance);
      bluetoothBike.setSimulatorTargets({
        resistance: prog.blocks[0].targetResistance,
        targetCadenceRpm: prog.blocks[0].targetCadenceRpm,
        targetPowerWatts: prog.blocks[0].targetPowerWatts,
      });
    }
    setActiveNav('dashboard');
    pushToast('Programma caricato', `"${prog.name}" pronto nella Dashboard Live.`, 'info');
  };

  const handleConnectStrava = async () => {
    const res = await startStravaOAuthPopup();
    if (!res.ok) {
      pushToast('Strava', res.error || 'Impossibile avviare il collegamento.', 'warning');
    }
  };

  const handleDisconnectStrava = async () => {
    await disconnectStrava();
    setStravaStatus({ connected: false, athleteName: null });
    pushToast('Strava disconnesso', 'Collegamento Strava rimosso.', 'info');
  };

  const handleManualStravaUpload = async (workout: WorkoutSession) => {
    const res = await uploadWorkoutToStrava(workout);
    if (res.ok) {
      setWorkouts((prev) =>
        prev.map((w) =>
          w.id === workout.id
            ? { ...w, syncedToStrava: true, stravaActivityUrl: res.activityUrl }
            : w
        )
      );
      pushToast('Inviato a Strava', `"${workout.title}" pubblicato su Strava.`, 'success');
    } else {
      pushToast('Errore Strava', res.error || 'Caricamento fallito.', 'warning');
    }
  };

  const handleLockApp = async () => {
    bluetoothBike.disconnect();
    await logoutSession();
    setIsAuthenticated(false);
    setActiveNav('dashboard');
  };

  if (!isAuthenticated) {
    return <LoginScreen onSuccess={() => setIsAuthenticated(true)} />;
  }

  const currentNavLabel = NAV_ITEMS.find((n) => n.id === activeNav)?.label ?? 'Dashboard Live';

  return (
    <div className="h-dvh overflow-hidden bg-[#07111F] text-[#E8F0FA] flex">
      {/* Desktop Sidebar (Collapsible to Left) */}
      {!sidebarCollapsed && (
        <aside className="hidden lg:flex lg:flex-col lg:w-64 lg:shrink-0 bg-[#091526] border-r border-[#1B3252] justify-between p-5 h-dvh overflow-y-auto">
          <div>
            <div className="flex items-center justify-between gap-2 px-1 pb-6 border-b border-[#162944]">
              <div className="flex items-center gap-3 min-w-0">
                <div className="w-9 h-9 rounded-lg bg-[#12243F] border border-[#233F66] flex items-center justify-center text-sky-400 shrink-0">
                  <Bike className="w-5 h-5" />
                </div>
                <span className="font-display text-lg font-bold tracking-tight text-[#E8F0FA] whitespace-nowrap">
                  Bikeaware
                </span>
              </div>
              <button
                type="button"
                onClick={() => setSidebarCollapsed(true)}
                title="Abbatti barra laterale per massimizzare la telemetria"
                aria-label="Abbatti barra laterale"
                aria-expanded={true}
                className="p-2 rounded-lg text-[#7E99B8] hover:text-[#E8F0FA] hover:bg-[#12243F] transition-colors shrink-0 focus-visible:outline-2 focus-visible:outline-sky-400"
              >
                <PanelLeftClose className="w-4 h-4" />
              </button>
            </div>

            <nav className="mt-6 space-y-1.5" aria-label="Navigazione principale">
              {NAV_ITEMS.map((item) => {
                const Icon = item.icon;
                const active = activeNav === item.id;
                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => setActiveNav(item.id)}
                    className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors whitespace-nowrap ${
                      active
                        ? 'bg-[#122642] text-sky-300 border border-[#22406A]'
                        : 'text-[#94ACC8] hover:text-[#E8F0FA] hover:bg-[#0E1E36] border border-transparent'
                    }`}
                  >
                    <Icon className={`w-4 h-4 shrink-0 ${active ? 'text-sky-400' : 'text-[#647E9E]'}`} />
                    <span>{item.label}</span>
                  </button>
                );
              })}
            </nav>
          </div>

          {/* Bottom Connection Summary & Lock */}
          <div className="pt-4 border-t border-[#162944] space-y-3 text-xs">
            <div className="px-2 space-y-1.5 text-[#94ACC8]">
              <div className="flex items-center justify-between">
                <span>Sensore BLE</span>
                <span
                  className={
                    bleState.status === 'connected' || bleState.status === 'simulating'
                      ? 'text-emerald-400 font-medium'
                      : 'text-[#647E9E]'
                  }
                >
                  {bleState.status === 'connected'
                    ? 'Connesso'
                    : bleState.status === 'simulating'
                    ? 'Simulatore'
                    : 'Off'}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span>Google Sheets</span>
                <span className={sheetsConfig && googleTokenReady ? 'text-sky-400 font-medium' : 'text-[#647E9E]'}>
                  {sheetsConfig && googleTokenReady ? 'Collegato' : 'Locale'}
                </span>
              </div>
            </div>

            <button
              type="button"
              onClick={handleLockApp}
              className="w-full h-9 px-3 rounded-lg bg-[#0D1D34] hover:bg-[#132642] border border-[#1B3252] text-xs font-medium text-[#94ACC8] hover:text-[#E8F0FA] flex items-center justify-center gap-2 transition-colors whitespace-nowrap"
            >
              <Lock className="w-3.5 h-3.5" />
              Blocca Accesso
            </button>
          </div>
        </aside>
      )}

      {/* Mobile Drawer Navigation */}
      {mobileMenuOpen && (
        <div className="fixed inset-0 z-40 lg:hidden flex">
          <div
            className="fixed inset-0 bg-[#030914]/75"
            onClick={() => setMobileMenuOpen(false)}
          />
          <aside className="relative w-64 max-w-[82vw] bg-[#091526] border-r border-[#1B3252] p-5 flex flex-col justify-between z-50">
            <div>
              <div className="flex items-center justify-between pb-5 border-b border-[#162944]">
                <div className="flex items-center gap-2.5">
                  <Bike className="w-5 h-5 text-sky-400" />
                  <span className="font-display text-lg font-bold text-[#E8F0FA]">Bikeaware</span>
                </div>
                <button
                  type="button"
                  onClick={() => setMobileMenuOpen(false)}
                  aria-label="Chiudi menu"
                  className="p-1.5 text-[#94ACC8]"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
              <nav className="mt-5 space-y-1.5">
                {NAV_ITEMS.map((item) => {
                  const Icon = item.icon;
                  const active = activeNav === item.id;
                  return (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => {
                        setActiveNav(item.id);
                        setMobileMenuOpen(false);
                      }}
                      className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium ${
                        active
                          ? 'bg-[#122642] text-sky-300 border border-[#22406A]'
                          : 'text-[#94ACC8] hover:text-[#E8F0FA]'
                      }`}
                    >
                      <Icon className="w-4 h-4 shrink-0" />
                      <span>{item.label}</span>
                    </button>
                  );
                })}
              </nav>
            </div>
            <button
              type="button"
              onClick={handleLockApp}
              className="w-full h-10 rounded-lg bg-[#12243F] border border-[#233F66] text-xs font-medium text-[#E8F0FA] flex items-center justify-center gap-2"
            >
              <Lock className="w-3.5 h-3.5" />
              Blocca Accesso
            </button>
          </aside>
        </div>
      )}

      {/* Main Content Area */}
      <div className="flex-1 min-w-0 min-h-0 flex flex-col">
        {/* Top Bar Contract: Compact Single-Row Breadcrumb + Primary Action */}
        <header className="h-11 sm:h-12 shrink-0 bg-[#091526]/95 border-b border-[#1B3252] px-3 sm:px-5 lg:px-6 flex items-center justify-between gap-4 z-30">
          <div className="flex items-center gap-2.5 min-w-0">
            <button
              type="button"
              onClick={() => setMobileMenuOpen(true)}
              aria-label="Apri menu di navigazione"
              className="lg:hidden p-1.5 -ml-1.5 text-[#94ACC8] hover:text-[#E8F0FA]"
            >
              <Menu className="w-5 h-5" />
            </button>
            <button
              type="button"
              onClick={() => setSidebarCollapsed((prev) => !prev)}
              title={
                sidebarCollapsed
                  ? 'Mostra barra delle schede'
                  : 'Abbatti barra laterale per vista estesa'
              }
              aria-label={
                sidebarCollapsed ? 'Mostra barra delle schede' : 'Abbatti barra delle schede'
              }
              aria-expanded={!sidebarCollapsed}
              className="hidden lg:inline-flex items-center justify-center p-1.5 -ml-1.5 rounded-lg text-[#94ACC8] hover:text-[#E8F0FA] hover:bg-[#12243F] transition-colors focus-visible:outline-2 focus-visible:outline-sky-400"
            >
              {sidebarCollapsed ? (
                <PanelLeftOpen className="w-4 h-4 text-sky-400" />
              ) : (
                <PanelLeftClose className="w-4 h-4" />
              )}
            </button>
            <div className="flex items-center gap-2 text-sm truncate">
              <span className="text-[#647E9E] hidden sm:inline">Bikeaware</span>
              <span className="text-[#415B7C] hidden sm:inline" aria-hidden="true">
                /
              </span>
              <span className="font-display font-semibold text-[#E8F0FA] truncate">
                {currentNavLabel}
              </span>
            </div>
          </div>

          <div className="flex items-center gap-2.5 shrink-0">
            {activeNav !== 'dashboard' ? (
              <button
                type="button"
                onClick={() => setActiveNav('dashboard')}
                className="px-3 py-1.5 rounded-lg bg-sky-500 hover:bg-sky-400 text-[#05101F] text-xs font-semibold transition-colors whitespace-nowrap shrink-0"
              >
                Sessione Live
              </button>
            ) : bleState.status === 'connected' || bleState.status === 'simulating' ? (
              <button
                type="button"
                onClick={() => setActiveNav('settings')}
                className="px-3 py-1.5 rounded-lg bg-[#12243F] hover:bg-[#193053] border border-[#233F66] text-[#E8F0FA] text-xs font-medium transition-colors flex items-center gap-1.5 whitespace-nowrap shrink-0"
              >
                <FileSpreadsheet className="w-3.5 h-3.5 text-sky-400" />
                {sheetsConfig && googleTokenReady ? 'Sheets Attivo' : 'Collega Sheets'}
              </button>
            ) : (
              <button
                type="button"
                onClick={handleConnectBluetooth}
                className="px-3 py-1.5 rounded-lg bg-sky-500 hover:bg-sky-400 text-[#05101F] text-xs font-semibold transition-colors flex items-center gap-1.5 whitespace-nowrap shrink-0"
              >
                <Bluetooth className="w-3.5 h-3.5" />
                Connetti BLE
              </button>
            )}
          </div>
        </header>

        {/* First-Access Inline Google Sheets Onboarding Banner (Compact Single Line, Hidden on Tiny Mobile Heights) */}
        {!dismissedSheetsBanner && (!sheetsConfig || !googleTokenReady) && activeNav === 'dashboard' && (
          <div className="hidden md:flex shrink-0 bg-[#0E1E36] border-b border-[#1B3252] px-5 lg:px-6 py-1.5 items-center justify-between gap-3">
            <div className="flex items-center gap-2 text-xs text-[#C3D5EA] truncate">
              <FileSpreadsheet className="w-3.5 h-3.5 text-sky-400 shrink-0" />
              <span className="truncate">
                {sheetsConfig
                  ? `Foglio "${sheetsConfig.spreadsheetTitle}" pronto: accedi con Google per attivare il backup cloud.`
                  : 'Collega un foglio Google Sheets gratuito come database personale per archiviare gli allenamenti.'}
              </span>
            </div>
            <div className="flex items-center gap-3 shrink-0">
              <button
                type="button"
                onClick={() => setActiveNav('settings')}
                className="text-xs font-semibold text-sky-400 hover:text-sky-300 whitespace-nowrap"
              >
                Configura Sheets →
              </button>
              <button
                type="button"
                onClick={() => setDismissedSheetsBanner(true)}
                aria-label="Chiudi avviso"
                className="text-[#647E9E] hover:text-[#E8F0FA]"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        )}

        {/* Active View Viewport */}
        <main
          className={`flex-1 min-h-0 w-full mx-auto ${
            activeNav === 'dashboard'
              ? `overflow-hidden flex flex-col px-2.5 sm:px-4 lg:px-6 py-2 sm:py-3 ${
                  sidebarCollapsed ? 'max-w-[1920px]' : 'max-w-[1600px]'
                }`
              : `overflow-y-auto px-4 sm:px-6 lg:px-8 py-6 ${
                  sidebarCollapsed ? 'max-w-[1720px]' : 'max-w-[1440px]'
                }`
          }`}
        >
          {activeNav === 'dashboard' && (
            <DashboardView
              bleState={bleState}
              isWebBtSupported={bluetoothBike.isWebBluetoothSupported()}
              livePoint={livePoint}
              sessionSamples={sessionSamples}
              isRecording={isRecording}
              isPaused={isPaused}
              elapsedSec={elapsedSec}
              resistanceLevel={resistanceLevel}
              activeProgram={activeProgram}
              programs={programs}
              goals={goals}
              todayWorkouts={todayWorkouts}
              isExpandedFocus={sidebarCollapsed}
              onConnectBluetooth={handleConnectBluetooth}
              onConnectHrStrap={handleConnectHrStrap}
              onStartSimulator={handleStartSimulator}
              onDisconnectBle={handleDisconnectBle}
              onStartSession={handleStartSession}
              onPauseResume={() => setIsPaused((p) => !p)}
              onPauseSession={() => setIsPaused(true)}
              onResumeSession={() => setIsPaused(false)}
              onResetSession={handleResetSession}
              onFinishAndSave={handleFinishAndSave}
              onChangeResistance={handleChangeResistance}
              onSelectProgram={(id) => setActiveProgramId(id)}
              onNavigateToGoals={() => setActiveNav('goals')}
              onNavigateToPrograms={() => setActiveNav('programs')}
            />
          )}

          {activeNav === 'programs' && (
            <ProgramsView
              programs={programs}
              weeklySchedule={weeklySchedule}
              activeProgramId={activeProgramId}
              onSaveProgram={handleSaveProgram}
              onDeleteProgram={handleDeleteProgram}
              onLoadProgramInDashboard={handleLoadProgramInDashboard}
              onUpdateWeeklySchedule={setWeeklySchedule}
            />
          )}

          {activeNav === 'history' && (
            <HistoryView
              workouts={workouts}
              stravaConnected={stravaStatus.connected}
              onDeleteWorkout={handleDeleteWorkout}
              onUploadToStrava={handleManualStravaUpload}
              onNavigateToDashboard={() => setActiveNav('dashboard')}
            />
          )}

          {activeNav === 'goals' && (
            <GoalsNotificationsView
              goals={goals}
              notificationLogs={notificationLogs}
              onSaveGoals={(next) => {
                setGoals(next);
                pushToast('Obiettivi aggiornati', 'Preferenze giornaliere salvate.', 'success');
              }}
              onSendTestNotification={() =>
                recordAndNotify(
                  'Notifica di test Bikeaware',
                  `Obiettivo attivo: ${goals.targetMinutes} min · ${goals.targetDistanceKm} km · Promemoria ore ${goals.reminderTime}.`,
                  'system',
                  'milestone'
                )
              }
              onClearLogs={() => setNotificationLogs([])}
            />
          )}

          {activeNav === 'settings' && (
            <SettingsIntegrationsView
              googleUser={googleUser}
              googleTokenReady={googleTokenReady}
              isGoogleSigningIn={isGoogleSigningIn}
              sheetsConfig={sheetsConfig}
              isSheetsBusy={isSheetsBusy}
              stravaStatus={stravaStatus}
              integrations={integrations}
              onGoogleSignIn={handleGoogleSignIn}
              onGoogleSignOut={handleGoogleSignOut}
              onCreateNewSpreadsheet={handleCreateNewSpreadsheet}
              onLinkExistingSpreadsheet={handleLinkExistingSpreadsheet}
              onSyncToSheets={handleSyncToSheets}
              onLoadFromSheets={handleLoadFromSheets}
              onToggleSheetsAutoSync={(enabled) =>
                setSheetsConfig((prev) => (prev ? { ...prev, autoSyncOnSave: enabled } : prev))
              }
              onDisconnectSpreadsheet={() => setSheetsConfig(null)}
              onConnectStrava={handleConnectStrava}
              onDisconnectStrava={handleDisconnectStrava}
              onUpdateIntegrations={(next) => {
                setIntegrations(next);
                pushToast('Integrazioni salvate', 'Impostazioni di sincronizzazione aggiornate.', 'success');
              }}
              onLockApp={handleLockApp}
            />
          )}
        </main>
      </div>

      {/* Confirmation Dialog Host (Mandatory for Google Sheets & Destructive Ops) */}
      <ConfirmModal request={confirmRequest} onClose={() => setConfirmRequest(null)} />

      {/* Subtle Bottom-Right Toast Stack */}
      {toasts.length > 0 && (
        <div
          aria-live="polite"
          className="fixed bottom-4 right-4 z-50 flex flex-col gap-2 w-80 max-w-[calc(100vw-2rem)]"
        >
          {toasts.map((toast) => (
            <div
              key={toast.id}
              className={`rounded-lg bg-[#0C1A2E] border p-3.5 shadow-xl text-xs ${
                toast.tone === 'success'
                  ? 'border-emerald-500/40'
                  : toast.tone === 'warning'
                  ? 'border-amber-500/40'
                  : 'border-[#233F66]'
              }`}
            >
              <div className="font-semibold text-[#E8F0FA]">{toast.title}</div>
              <div className="mt-0.5 text-[#94ACC8] leading-relaxed">{toast.message}</div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
