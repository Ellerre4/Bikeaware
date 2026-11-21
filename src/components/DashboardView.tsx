import React, { useMemo, useState } from 'react';
import {
  Activity,
  Bluetooth,
  BluetoothOff,
  Flame,
  Gauge,
  Heart,
  Minus,
  Pause,
  Play,
  Plus,
  Radio,
  Save,
  Sliders,
  Square,
  Timer,
  Trash2,
  X,
  Zap,
} from 'lucide-react';
import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { formatDuration, getProgramTotalDuration, PHASE_META } from '../data/defaultData';
import type {
  BleConnectionState,
  DailyGoalsConfig,
  TelemetryPoint,
  TrainingProgram,
  WorkoutSession,
} from '../types/bike';

interface DashboardViewProps {
  bleState: BleConnectionState;
  isWebBtSupported: boolean;
  livePoint: TelemetryPoint;
  sessionSamples: TelemetryPoint[];
  isRecording: boolean;
  isPaused: boolean;
  elapsedSec: number;
  resistanceLevel: number;
  activeProgram: TrainingProgram | null;
  programs: TrainingProgram[];
  goals: DailyGoalsConfig;
  todayWorkouts: WorkoutSession[];
  isExpandedFocus?: boolean;
  onConnectBluetooth: () => void;
  onConnectHrStrap: () => void;
  onStartSimulator: () => void;
  onDisconnectBle: () => void;
  onStartSession: () => void;
  onPauseResume: () => void;
  onPauseSession: () => void;
  onResumeSession: () => void;
  onResetSession: () => void;
  onFinishAndSave: (title: string, notes: string) => void;
  onChangeResistance: (level: number) => void;
  onSelectProgram: (programId: string | null) => void;
  onNavigateToGoals: () => void;
  onNavigateToPrograms: () => void;
}

type ChartMetricKey = 'powerWatts' | 'cadenceRpm' | 'speedKmh' | 'heartRateBpm';

const METRIC_SERIES: {
  key: ChartMetricKey;
  label: string;
  short: string;
  unit: string;
  color: string;
}[] = [
  { key: 'powerWatts', label: 'Potenza', short: 'W', unit: 'W', color: '#38BDF8' },
  { key: 'cadenceRpm', label: 'Cadenza', short: 'RPM', unit: 'RPM', color: '#22C55E' },
  { key: 'speedKmh', label: 'Velocità', short: 'km/h', unit: 'km/h', color: '#F59E0B' },
  { key: 'heartRateBpm', label: 'FC', short: 'BPM', unit: 'BPM', color: '#F43F5E' },
];

export const DashboardView: React.FC<DashboardViewProps> = ({
  bleState,
  isWebBtSupported,
  livePoint,
  sessionSamples,
  isRecording,
  isPaused,
  elapsedSec,
  resistanceLevel,
  activeProgram,
  programs,
  goals,
  todayWorkouts,
  isExpandedFocus = false,
  onConnectBluetooth,
  onConnectHrStrap,
  onStartSimulator,
  onDisconnectBle,
  onStartSession,
  onPauseSession,
  onResumeSession,
  onResetSession,
  onFinishAndSave,
  onChangeResistance,
  onSelectProgram,
  onNavigateToGoals,
  onNavigateToPrograms,
}) => {
  const [visibleMetrics, setVisibleMetrics] = useState<Record<ChartMetricKey, boolean>>({
    powerWatts: true,
    cadenceRpm: true,
    speedKmh: false,
    heartRateBpm: true,
  });
  const [chartWindow, setChartWindow] = useState<'60s' | '5m' | 'all'>('5m');
  const [showSaveForm, setShowSaveForm] = useState(false);
  const [saveTitle, setSaveTitle] = useState('');
  const [saveNotes, setSaveNotes] = useState('');

  const isConnectedOrSim =
    bleState.status === 'connected' || bleState.status === 'simulating';
  const isFreeSession = activeProgram === null;

  // Active interval block calculation when a program is loaded
  const intervalInfo = useMemo(() => {
    if (!activeProgram || activeProgram.blocks.length === 0) return null;
    const totalDur = getProgramTotalDuration(activeProgram);
    let acc = 0;
    for (let i = 0; i < activeProgram.blocks.length; i++) {
      const b = activeProgram.blocks[i];
      if (elapsedSec < acc + b.durationSec) {
        return {
          index: i,
          current: b,
          next: activeProgram.blocks[i + 1] || null,
          blockRemainingSec: acc + b.durationSec - elapsedSec,
          blockElapsedSec: elapsedSec - acc,
          totalDur,
          completed: false,
        };
      }
      acc += b.durationSec;
    }
    const last = activeProgram.blocks[activeProgram.blocks.length - 1];
    return {
      index: activeProgram.blocks.length - 1,
      current: last,
      next: null,
      blockRemainingSec: 0,
      blockElapsedSec: last.durationSec,
      totalDur,
      completed: true,
    };
  }, [activeProgram, elapsedSec]);

  // Filtered live chart data
  const chartData = useMemo(() => {
    if (sessionSamples.length === 0) return [];
    const maxSec = chartWindow === '60s' ? 60 : chartWindow === '5m' ? 300 : Infinity;
    const latestSec = sessionSamples[sessionSamples.length - 1].elapsedSec;
    const filtered =
      maxSec === Infinity
        ? sessionSamples
        : sessionSamples.filter((s) => latestSec - s.elapsedSec <= maxSec);
    return filtered.map((p) => ({
      ...p,
      timeLabel: formatDuration(p.elapsedSec),
    }));
  }, [sessionSamples, chartWindow]);

  // Today's cumulative progress (saved workouts today + current active session)
  const todayStats = useMemo(() => {
    const savedMin = todayWorkouts.reduce((a, w) => a + w.durationSec / 60, 0);
    const savedDist = todayWorkouts.reduce((a, w) => a + w.distanceKm, 0);
    const savedKcal = todayWorkouts.reduce((a, w) => a + w.caloriesKcal, 0);

    return {
      minutes: Number((savedMin + elapsedSec / 60).toFixed(1)),
      distanceKm: Number((savedDist + livePoint.distanceKm).toFixed(2)),
      caloriesKcal: Math.round(savedKcal + livePoint.caloriesKcal),
    };
  }, [todayWorkouts, elapsedSec, livePoint.distanceKm, livePoint.caloriesKcal]);

  const toggleMetric = (key: ChartMetricKey) => {
    setVisibleMetrics((prev) => {
      const next = { ...prev, [key]: !prev[key] };
      if (!Object.values(next).some(Boolean)) return prev;
      return next;
    });
  };

  const openSaveDialog = () => {
    if (isRecording && !isPaused) {
      onPauseSession();
    }
    setSaveTitle(activeProgram ? activeProgram.name : 'Sessione Libera');
    setSaveNotes('');
    setShowSaveForm(true);
  };

  const handleBigPlay = () => {
    if (!isRecording) {
      onStartSession();
    } else if (isPaused) {
      onResumeSession();
    }
  };

  const handleBigPause = () => {
    if (isRecording && !isPaused) {
      onPauseSession();
    }
  };

  const handleBigStop = () => {
    if (!isRecording && elapsedSec === 0) return;
    openSaveDialog();
  };

  const handleDiscardSession = () => {
    setShowSaveForm(false);
    onResetSession();
  };

  const confirmSave = (e: React.FormEvent) => {
    e.preventDefault();
    onFinishAndSave(
      saveTitle.trim() || (activeProgram ? activeProgram.name : 'Sessione Libera'),
      saveNotes.trim()
    );
    setShowSaveForm(false);
  };

  const powerZone = useMemo(() => {
    const ratio = goals.ftpWatts > 0 ? livePoint.powerWatts / goals.ftpWatts : 0;
    if (livePoint.powerWatts === 0) return { label: 'In attesa', textClass: 'text-[#647E9E]' };
    if (ratio < 0.56) return { label: 'Z1 Recupero', textClass: 'text-emerald-400' };
    if (ratio < 0.76) return { label: 'Z2 Aerobico', textClass: 'text-emerald-300' };
    if (ratio < 0.91) return { label: 'Z3 Tempo', textClass: 'text-amber-400' };
    if (ratio < 1.06) return { label: 'Z4 Soglia', textClass: 'text-orange-400' };
    return { label: 'Z5 VO2 / Sprint', textClass: 'text-rose-400' };
  }, [livePoint.powerWatts, goals.ftpWatts]);

  const powerFtpPercent =
    goals.ftpWatts > 0 ? Math.round((livePoint.powerWatts / goals.ftpWatts) * 100) : 0;
  const powerScaleMax = Math.max(260, Math.round(goals.ftpWatts * 1.45));
  const powerBarPercent = Math.max(
    0,
    Math.min(100, Math.round((livePoint.powerWatts / powerScaleMax) * 100))
  );

  // Fluid metric font scale that adapts proportionally to viewport width & height
  const primaryValueClass = isExpandedFocus
    ? 'font-mono-tabular font-bold text-[#E8F0FA] leading-none text-[clamp(1.4rem,3vw,3.1rem)]'
    : 'font-mono-tabular font-bold text-[#E8F0FA] leading-none text-[clamp(1.25rem,2.4vw,2.35rem)]';

  const secondaryValueClass = isExpandedFocus
    ? 'font-mono-tabular font-bold text-[#E8F0FA] leading-none text-[clamp(1.2rem,2.4vw,2.5rem)]'
    : 'font-mono-tabular font-bold text-[#E8F0FA] leading-none text-[clamp(1.1rem,2vw,2rem)]';

  return (
    <div className="flex-1 min-h-0 flex flex-col gap-2 sm:gap-3 overflow-hidden">
      {/* 1. Compact Bluetooth & Program Selector Strip */}
      <section className="shrink-0 rounded-xl bg-[#0C1A2E] border border-[#1B3252] px-3 py-2 sm:px-4 sm:py-2.5">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex flex-wrap items-center gap-2 sm:gap-3 min-w-0">
            <div className="flex items-center gap-2 pr-2 sm:pr-3 border-r border-[#1B3252] min-w-0">
              <Bluetooth
                className={`w-4 h-4 shrink-0 ${
                  isConnectedOrSim ? 'text-sky-400' : 'text-[#647E9E]'
                }`}
              />
              <div className="text-xs min-w-0">
                <div className="font-medium text-[#E8F0FA] flex items-center gap-1.5 truncate">
                  {bleState.status === 'connected' && (
                    <>
                      <span className="w-2 h-2 rounded-full bg-emerald-400 shrink-0" aria-hidden="true" />
                      <span className="truncate">{bleState.deviceName}</span>
                    </>
                  )}
                  {bleState.status === 'simulating' && (
                    <>
                      <span className="w-2 h-2 rounded-full bg-sky-400 shrink-0" aria-hidden="true" />
                      <span className="truncate">{bleState.deviceName}</span>
                    </>
                  )}
                  {bleState.status === 'connecting' && <span>Ricerca BLE...</span>}
                  {(bleState.status === 'disconnected' || bleState.status === 'error') && (
                    <span>Cyclette non connessa</span>
                  )}
                </div>
                <div className="hidden md:block text-[11px] text-[#7E99B8] truncate">
                  {bleState.protocol
                    ? `Protocollo ${bleState.protocol} · 1 Hz`
                    : isWebBtSupported
                    ? 'FTMS · Speed/Cadence · Power'
                    : 'Web Bluetooth non rilevato · Usa Simulatore'}
                </div>
              </div>
            </div>

            {!isConnectedOrSim ? (
              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={onConnectBluetooth}
                  disabled={bleState.status === 'connecting'}
                  className="px-2.5 sm:px-3 py-1.5 rounded-lg bg-sky-500 hover:bg-sky-400 disabled:opacity-50 text-[#05101F] text-xs font-semibold transition-colors flex items-center gap-1.5 whitespace-nowrap"
                >
                  <Bluetooth className="w-3.5 h-3.5" />
                  <span className="hidden sm:inline">Connetti BLE</span>
                  <span className="sm:hidden">BLE</span>
                </button>
                <button
                  type="button"
                  onClick={onStartSimulator}
                  className="px-2.5 sm:px-3 py-1.5 rounded-lg bg-[#12243F] hover:bg-[#193053] border border-[#233F66] text-[#E8F0FA] text-xs font-medium transition-colors flex items-center gap-1.5 whitespace-nowrap"
                >
                  <Radio className="w-3.5 h-3.5 text-sky-400" />
                  <span className="hidden sm:inline">Simulatore BLE</span>
                  <span className="sm:hidden">Simula</span>
                </button>
              </div>
            ) : (
              <div className="flex items-center gap-1.5">
                {bleState.status === 'connected' && (
                  <button
                    type="button"
                    onClick={onConnectHrStrap}
                    className="px-2.5 py-1.5 rounded-lg bg-[#12243F] hover:bg-[#193053] border border-[#233F66] text-[#E8F0FA] text-xs font-medium flex items-center gap-1.5 whitespace-nowrap"
                  >
                    <Heart className="w-3.5 h-3.5 text-rose-400" />
                    <span className="hidden sm:inline">Cardio</span>
                  </button>
                )}
                <button
                  type="button"
                  onClick={onDisconnectBle}
                  className="px-2.5 py-1.5 rounded-lg bg-[#12243F] hover:bg-rose-950/50 border border-[#233F66] text-[#94ACC8] hover:text-rose-200 text-xs font-medium flex items-center gap-1.5 whitespace-nowrap"
                >
                  <BluetoothOff className="w-3.5 h-3.5" />
                  <span className="hidden sm:inline">Disconnetti</span>
                </button>
              </div>
            )}
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <select
              aria-label="Programma di allenamento attivo"
              value={activeProgram?.id || ''}
              onChange={(e) => onSelectProgram(e.target.value || null)}
              disabled={isRecording}
              className="h-8 rounded-lg bg-[#07111F] border border-[#233F66] px-2.5 text-xs text-[#E8F0FA] focus:outline-none focus:border-sky-400 disabled:opacity-50 max-w-[180px] sm:max-w-[240px]"
            >
              <option value="">Sessione libera (solo dati live)</option>
              {programs.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name} ({Math.round(getProgramTotalDuration(p) / 60)} min)
                </option>
              ))}
            </select>
          </div>
        </div>

        {bleState.errorMessage && (
          <p className="mt-1.5 text-[11px] text-amber-300 truncate">{bleState.errorMessage}</p>
        )}
      </section>

      {/* 2. Compact Active Training Program Coach (Hidden in Sessione Libera) */}
      {activeProgram && intervalInfo && (
        <section className="shrink-0 rounded-xl bg-[#0C1A2E] border border-[#1B3252] px-3.5 py-2 sm:px-4 sm:py-2.5">
          <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1">
            <div className="flex flex-wrap items-baseline gap-2 min-w-0">
              <span className="text-xs font-semibold text-[#E8F0FA] truncate">
                {intervalInfo.completed ? 'Programma completato' : intervalInfo.current.label}
              </span>
              <span className="font-mono-tabular text-xs text-sky-400 font-medium">
                {intervalInfo.completed ? '00:00' : formatDuration(intervalInfo.blockRemainingSec)}
              </span>
              <span className="hidden md:inline text-[11px] text-[#7E99B8]">
                · Blocco {intervalInfo.index + 1}/{activeProgram.blocks.length}
              </span>
            </div>

            <div className="flex items-center gap-3 sm:gap-5 text-xs font-mono-tabular">
              <span className="text-[#94ACC8]">
                Target <strong className="text-sky-300">{intervalInfo.current.targetPowerWatts}W</strong>
              </span>
              <span className="text-[#94ACC8]">
                <strong className="text-emerald-400">{intervalInfo.current.targetCadenceRpm}</strong> RPM
              </span>
              <span className="text-[#94ACC8]">
                Res. <strong className="text-[#E8F0FA]">{intervalInfo.current.targetResistance}</strong>
              </span>
              {intervalInfo.next && (
                <span className="hidden xl:inline text-[11px] font-sans text-[#7E99B8] pl-3 border-l border-[#1B3252]">
                  Poi: {intervalInfo.next.label} ({formatDuration(intervalInfo.next.durationSec)})
                </span>
              )}
            </div>
          </div>

          <div className="mt-1.5 flex items-end gap-0.5 h-3.5 sm:h-4">
            {activeProgram.blocks.map((block, idx) => {
              const widthPct = (block.durationSec / Math.max(1, intervalInfo.totalDur)) * 100;
              const heightPct = Math.max(30, Math.min(100, (block.targetPowerWatts / 310) * 100));
              const isCurrent = idx === intervalInfo.index && !intervalInfo.completed;
              const isPast = idx < intervalInfo.index || intervalInfo.completed;
              const meta = PHASE_META[block.phase] || PHASE_META.endurance;
              return (
                <div
                  key={block.id}
                  style={{ width: `${widthPct}%`, height: `${heightPct}%` }}
                  title={`${block.label} · ${formatDuration(block.durationSec)} · ${block.targetPowerWatts} W`}
                  className={`rounded-t-xs transition-opacity ${meta.bgBar} ${
                    isCurrent ? 'opacity-100 ring-1 ring-white/70' : isPast ? 'opacity-30' : 'opacity-65'
                  }`}
                />
              );
            })}
          </div>
        </section>
      )}

      {/* 3. Adaptive 6-Metric Live Instrument Grid (3x2 on phone/tablet, 6x1 on desktop) */}
      <section className="shrink-0 grid grid-cols-3 lg:grid-cols-6 gap-2 sm:gap-3">
        <div className="rounded-xl bg-[#0C1A2E] border border-[#1B3252] p-2.5 sm:p-3.5 flex flex-col justify-between">
          <div className="flex items-center justify-between text-[11px] sm:text-xs text-[#94ACC8]">
            <span>Potenza</span>
            <Zap className="w-3.5 h-3.5 text-sky-400 shrink-0" />
          </div>
          <div className="mt-1.5 sm:mt-2 flex items-baseline gap-1">
            <span className={primaryValueClass}>{livePoint.powerWatts}</span>
            <span className="text-[11px] text-[#647E9E]">W</span>
          </div>
          <div className={`mt-1 text-[11px] font-medium truncate ${powerZone.textClass}`}>
            {powerZone.label}
          </div>
        </div>

        <div className="rounded-xl bg-[#0C1A2E] border border-[#1B3252] p-2.5 sm:p-3.5 flex flex-col justify-between">
          <div className="flex items-center justify-between text-[11px] sm:text-xs text-[#94ACC8]">
            <span>Cadenza</span>
            <Activity className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
          </div>
          <div className="mt-1.5 sm:mt-2 flex items-baseline gap-1">
            <span className={primaryValueClass}>{livePoint.cadenceRpm}</span>
            <span className="text-[11px] text-[#647E9E]">RPM</span>
          </div>
          <div className="mt-1 text-[11px] text-[#94ACC8] truncate">
            {intervalInfo ? `Target ${intervalInfo.current.targetCadenceRpm}` : 'Pedalata'}
          </div>
        </div>

        <div className="rounded-xl bg-[#0C1A2E] border border-[#1B3252] p-2.5 sm:p-3.5 flex flex-col justify-between">
          <div className="flex items-center justify-between text-[11px] sm:text-xs text-[#94ACC8]">
            <span>Velocità</span>
            <Gauge className="w-3.5 h-3.5 text-amber-400 shrink-0" />
          </div>
          <div className="mt-1.5 sm:mt-2 flex items-baseline gap-1">
            <span className={primaryValueClass}>{livePoint.speedKmh.toFixed(1)}</span>
            <span className="text-[11px] text-[#647E9E]">km/h</span>
          </div>
          <div className="mt-1 text-[11px] text-[#94ACC8] font-mono-tabular truncate">
            {livePoint.distanceKm.toFixed(2)} km
          </div>
        </div>

        <div className="rounded-xl bg-[#0C1A2E] border border-[#1B3252] p-2.5 sm:p-3.5 flex flex-col justify-between">
          <div className="flex items-center justify-between text-[11px] sm:text-xs text-[#94ACC8]">
            <span className="truncate">Freq. Card.</span>
            <Heart className="w-3.5 h-3.5 text-rose-400 shrink-0" />
          </div>
          <div className="mt-1.5 sm:mt-2 flex items-baseline gap-1">
            <span className={primaryValueClass}>
              {livePoint.heartRateBpm > 0 ? livePoint.heartRateBpm : '--'}
            </span>
            <span className="text-[11px] text-[#647E9E]">BPM</span>
          </div>
          <div className="mt-1 text-[11px] text-[#94ACC8] font-mono-tabular truncate">
            {livePoint.heartRateBpm > 0
              ? `${Math.round((livePoint.heartRateBpm / goals.maxHeartRateBpm) * 100)}% max`
              : 'Opzionale'}
          </div>
        </div>

        <div className="rounded-xl bg-[#0C1A2E] border border-[#1B3252] p-2.5 sm:p-3.5 flex flex-col justify-between">
          <div className="flex items-center justify-between text-[11px] sm:text-xs text-[#94ACC8]">
            <span>Tempo</span>
            <Timer className="w-3.5 h-3.5 text-sky-400 shrink-0" />
          </div>
          <div className="mt-1.5 sm:mt-2">
            <span className={secondaryValueClass}>{formatDuration(elapsedSec)}</span>
          </div>
          <div className="mt-1 flex items-center gap-1 text-[11px] text-[#94ACC8] font-mono-tabular truncate">
            <Flame className="w-3 h-3 text-amber-400 shrink-0" />
            <span>{livePoint.caloriesKcal} kcal</span>
          </div>
        </div>

        <div className="rounded-xl bg-[#0C1A2E] border border-[#1B3252] p-2.5 sm:p-3.5 flex flex-col justify-between">
          <div className="flex items-center justify-between text-[11px] sm:text-xs text-[#94ACC8]">
            <span>Resistenza</span>
            <Sliders className="w-3.5 h-3.5 text-sky-400 shrink-0" />
          </div>
          <div className="mt-1.5 sm:mt-2 flex items-center justify-between gap-1">
            <button
              type="button"
              onClick={() => onChangeResistance(resistanceLevel - 1)}
              disabled={resistanceLevel <= 1}
              aria-label="Riduci resistenza"
              className="w-7 h-7 sm:w-8 sm:h-8 rounded-lg bg-[#12243F] hover:bg-[#1A3358] border border-[#233F66] flex items-center justify-center text-[#E8F0FA] disabled:opacity-40 shrink-0"
            >
              <Minus className="w-3.5 h-3.5" />
            </button>
            <span className={secondaryValueClass}>{resistanceLevel}</span>
            <button
              type="button"
              onClick={() => onChangeResistance(resistanceLevel + 1)}
              disabled={resistanceLevel >= 20}
              aria-label="Aumenta resistenza"
              className="w-7 h-7 sm:w-8 sm:h-8 rounded-lg bg-[#12243F] hover:bg-[#1A3358] border border-[#233F66] flex items-center justify-center text-[#E8F0FA] disabled:opacity-40 shrink-0"
            >
              <Plus className="w-3.5 h-3.5" />
            </button>
          </div>
          <div className="mt-1 text-[11px] text-[#94ACC8] truncate">Livello 1–20</div>
        </div>
      </section>

      {/* 3b. Full-Width Progressive Real-Time Power Bar (Green -> Amber -> Red) */}
      <section
        aria-label="Indicatore progressivo potenza in tempo reale"
        className="shrink-0 rounded-xl bg-[#0C1A2E] border border-[#1B3252] px-3.5 py-2 sm:px-4 sm:py-2.5"
      >
        <div className="flex items-center justify-between gap-3 text-[11px] sm:text-xs mb-1.5">
          <div className="flex items-center gap-2 min-w-0">
            <Zap className="w-3.5 h-3.5 text-sky-400 shrink-0" />
            <span className="font-medium text-[#E8F0FA] whitespace-nowrap">Potenza</span>
            <span className="font-mono-tabular font-semibold text-[#E8F0FA] whitespace-nowrap">
              {livePoint.powerWatts} W
            </span>
            <span className="text-[#415B7C]" aria-hidden="true">
              ·
            </span>
            <span className={`font-medium truncate ${powerZone.textClass}`}>{powerZone.label}</span>
          </div>

          <div className="flex items-center gap-2.5 font-mono-tabular text-[11px] text-[#7E99B8] shrink-0">
            <span className="hidden md:inline">
              FTP {goals.ftpWatts}W · Max scala {powerScaleMax}W
            </span>
            <span className="text-[#E8F0FA] font-semibold">
              {livePoint.powerWatts > 0 ? `${powerFtpPercent}% FTP` : '0% FTP'}
            </span>
          </div>
        </div>

        <div
          role="progressbar"
          aria-label="Livello di potenza in tempo reale"
          aria-valuemin={0}
          aria-valuemax={powerScaleMax}
          aria-valuenow={livePoint.powerWatts}
          className="relative h-3 sm:h-3.5 w-full rounded-full bg-[#07111F] overflow-hidden border border-[#162944]"
        >
          {/* Subtle dim background track showing full green->red range faintly */}
          <div className="absolute inset-0 bg-gradient-to-r from-emerald-500/12 via-amber-400/12 to-rose-500/12" />
          {/* Active progressive gradient fill */}
          <div
            className="absolute inset-0 bg-gradient-to-r from-emerald-500 via-amber-400 to-rose-500 transition-[clip-path] duration-200 ease-out"
            style={{ clipPath: `inset(0 ${100 - powerBarPercent}% 0 0)` }}
          />
          {/* Zone dividers (Z2, Z3, FTP/Z4, Z5) */}
          <div className="absolute inset-y-0 left-[38%] w-px bg-[#07111F]/75 pointer-events-none" />
          <div className="absolute inset-y-0 left-[52%] w-px bg-[#07111F]/75 pointer-events-none" />
          <div
            title={`Soglia FTP (${goals.ftpWatts} W)`}
            className="absolute inset-y-0 left-[69%] w-0.5 bg-[#E8F0FA]/55 pointer-events-none"
          />
          <div className="absolute inset-y-0 left-[78%] w-px bg-[#07111F]/75 pointer-events-none" />
        </div>

        <div className="hidden sm:flex items-center justify-between mt-1 text-[10px] font-mono-tabular text-[#647E9E]">
          <span>0 W</span>
          <span>Z1–Z2 Aerobico</span>
          <span>Z3 Tempo</span>
          <span className="text-[#94ACC8]">FTP ({goals.ftpWatts} W)</span>
          <span>Z5 Sprint ({powerScaleMax} W)</span>
        </div>
      </section>

      {/* 4. Fluid Telemetry Chart Section (Flexes to fill 100% of remaining viewport height) */}
      <section className="flex-1 min-h-0 flex flex-col lg:grid lg:grid-cols-12 gap-2.5 sm:gap-3 overflow-hidden">
        {/* Live Chart Container */}
        <div
          className={`flex-1 min-h-0 flex flex-col rounded-xl bg-[#0C1A2E] border border-[#1B3252] p-3 sm:p-4 ${
            isFreeSession
              ? 'lg:col-span-12'
              : isExpandedFocus
              ? 'lg:col-span-9'
              : 'lg:col-span-8'
          }`}
        >
          <div className="shrink-0 flex flex-wrap items-center justify-between gap-2 mb-2">
            <div className="flex flex-wrap items-center gap-1.5">
              <h2 className="font-display text-xs sm:text-sm font-semibold text-[#E8F0FA] mr-1.5">
                Telemetria Live
              </h2>
              {METRIC_SERIES.map((m) => {
                const active = visibleMetrics[m.key];
                return (
                  <button
                    key={m.key}
                    type="button"
                    onClick={() => toggleMetric(m.key)}
                    className={`px-2 py-1 rounded-md border text-[11px] font-medium transition-colors flex items-center gap-1.5 whitespace-nowrap ${
                      active
                        ? 'bg-[#12243F] border-[#2A4A75] text-[#E8F0FA]'
                        : 'bg-[#091526] border-[#162944] text-[#647E9E] hover:text-[#94ACC8]'
                    }`}
                  >
                    <span
                      className="w-2 h-2 rounded-xs shrink-0"
                      style={{ backgroundColor: active ? m.color : '#334E73' }}
                      aria-hidden="true"
                    />
                    <span className="hidden sm:inline">{m.label}</span>
                    <span className="sm:hidden">{m.short}</span>
                  </button>
                );
              })}
            </div>

            <div className="flex items-center gap-1 p-0.5 rounded-lg bg-[#07111F] border border-[#1B3252]">
              {(['60s', '5m', 'all'] as const).map((win) => (
                <button
                  key={win}
                  type="button"
                  onClick={() => setChartWindow(win)}
                  className={`px-2 py-0.5 text-[11px] font-medium rounded transition-colors whitespace-nowrap ${
                    chartWindow === win
                      ? 'bg-[#162C4D] text-sky-300'
                      : 'text-[#7E99B8] hover:text-[#E8F0FA]'
                  }`}
                >
                  {win === '60s' ? '1m' : win === '5m' ? '5m' : 'Tutto'}
                </button>
              ))}
            </div>
          </div>

          <div className="flex-1 min-h-0 w-full">
            {chartData.length > 1 ? (
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={chartData} margin={{ top: 6, right: 8, left: -18, bottom: 0 }}>
                  <defs>
                    {METRIC_SERIES.map((m) => (
                      <linearGradient key={m.key} id={`grad-${m.key}`} x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor={m.color} stopOpacity={0.28} />
                        <stop offset="100%" stopColor={m.color} stopOpacity={0.02} />
                      </linearGradient>
                    ))}
                  </defs>
                  <CartesianGrid stroke="#162B47" strokeDasharray="3 3" vertical={false} />
                  <XAxis
                    dataKey="timeLabel"
                    stroke="#647E9E"
                    tick={{ fill: '#7E99B8', fontSize: 10, fontFamily: 'JetBrains Mono' }}
                    minTickGap={28}
                  />
                  <YAxis
                    stroke="#647E9E"
                    tick={{ fill: '#7E99B8', fontSize: 10, fontFamily: 'JetBrains Mono' }}
                  />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: '#07111F',
                      borderColor: '#233F66',
                      borderRadius: '8px',
                      fontSize: '12px',
                      color: '#E8F0FA',
                    }}
                    labelStyle={{ color: '#94ACC8', fontFamily: 'JetBrains Mono' }}
                  />
                  {METRIC_SERIES.map(
                    (m) =>
                      visibleMetrics[m.key] && (
                        <Area
                          key={m.key}
                          type="monotone"
                          dataKey={m.key}
                          name={`${m.label} (${m.unit})`}
                          stroke={m.color}
                          strokeWidth={2}
                          fill={`url(#grad-${m.key})`}
                          isAnimationActive={false}
                        />
                      )
                  )}
                </AreaChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-full rounded-lg border border-dashed border-[#1E375A] bg-[#081322] flex flex-col items-center justify-center text-center p-4">
                <Activity className="w-6 h-6 text-[#38BDF8]/60 mb-1.5" />
                <p className="text-xs sm:text-sm font-medium text-[#C3D5EA]">
                  {isFreeSession
                    ? 'Sessione libera pronta · Solo dati live'
                    : 'Pronto per la registrazione telemetrica'}
                </p>
                <p className="mt-0.5 text-[11px] sm:text-xs text-[#7E99B8] max-w-md">
                  Premi il tasto verde <strong className="text-emerald-400">Avvia</strong> in basso per iniziare la sessione e visualizzare le curve in tempo reale.
                </p>
              </div>
            )}
          </div>
        </div>

        {/* Daily Goals Panel (Hidden in Sessione Libera; compact 3-col strip on mobile, sidebar card on desktop) */}
        {!isFreeSession && (
          <div
            className={`shrink-0 lg:shrink rounded-xl bg-[#0C1A2E] border border-[#1B3252] p-2.5 sm:p-4 flex flex-col justify-between overflow-hidden ${
              isExpandedFocus ? 'lg:col-span-3' : 'lg:col-span-4'
            }`}
          >
            <div className="flex items-center justify-between gap-2 mb-2 lg:mb-3">
              <div className="min-w-0">
                <h2 className="font-display text-xs sm:text-sm font-semibold text-[#E8F0FA] truncate">
                  Obiettivi Quotidiani
                </h2>
                <p className="hidden lg:block text-[11px] text-[#94ACC8]">
                  Promemoria alle {goals.reminderTime}
                </p>
              </div>
              <button
                type="button"
                onClick={onNavigateToGoals}
                className="text-[11px] font-medium text-sky-400 hover:text-sky-300 whitespace-nowrap"
              >
                Modifica
              </button>
            </div>

            <div className="grid grid-cols-3 lg:grid-cols-1 gap-2.5 lg:gap-4 my-auto">
              {[
                {
                  label: 'Durata',
                  current: todayStats.minutes,
                  target: goals.targetMinutes,
                  unit: 'min',
                  barColor: 'bg-sky-400',
                },
                {
                  label: 'Distanza',
                  current: todayStats.distanceKm,
                  target: goals.targetDistanceKm,
                  unit: 'km',
                  barColor: 'bg-emerald-400',
                },
                {
                  label: 'Calorie',
                  current: todayStats.caloriesKcal,
                  target: goals.targetCaloriesKcal,
                  unit: 'kcal',
                  barColor: 'bg-amber-400',
                },
              ].map((item) => {
                const pct = Math.min(100, Math.round((item.current / Math.max(1, item.target)) * 100));
                return (
                  <div key={item.label}>
                    <div className="flex items-baseline justify-between gap-1 text-[11px] mb-1">
                      <span className="text-[#C3D5EA] font-medium truncate">{item.label}</span>
                      <span className="font-mono-tabular text-[#94ACC8] shrink-0">
                        <strong className="text-[#E8F0FA]">{item.current}</strong>/{item.target}
                        <span className="hidden xl:inline"> {item.unit}</span>
                      </span>
                    </div>
                    <div className="h-1.5 w-full rounded-full bg-[#07111F] overflow-hidden">
                      <div
                        className={`h-full rounded-full transition-all duration-300 ${item.barColor}`}
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>

            <div className="hidden lg:flex mt-3 pt-3 border-t border-[#1B3252] items-center justify-between text-[11px]">
              <span className="text-[#94ACC8] truncate pr-2">
                {activeProgram ? activeProgram.name : 'Sessione libera'}
              </span>
              <button
                type="button"
                onClick={onNavigateToPrograms}
                className="font-medium text-sky-400 hover:text-sky-300 whitespace-nowrap shrink-0"
              >
                Programmi
              </button>
            </div>
          </div>
        )}
      </section>

      {/* 5. Bottom Large Round Ergonomic Pedaling Controls Dock */}
      <section
        aria-label="Controlli rapidi sessione di pedalata"
        className="shrink-0 rounded-xl bg-[#0C1A2E] border border-[#1B3252] px-3 py-2 sm:px-6 sm:py-3 flex items-center justify-between gap-2 sm:gap-4"
      >
        {/* Left: Resistance Down (-) */}
        <div className="flex flex-col items-center gap-1 shrink-0">
          <button
            type="button"
            onClick={() => onChangeResistance(resistanceLevel - 1)}
            disabled={resistanceLevel <= 1}
            aria-label="Abbassa resistenza"
            className={`w-12 h-12 sm:w-16 sm:h-16 xl:w-[74px] xl:h-[74px] rounded-full flex items-center justify-center transition-transform active:scale-95 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-sky-400 ${
              resistanceLevel <= 1
                ? 'bg-[#12243F] border border-[#233F66] text-[#526D8E] cursor-not-allowed'
                : 'bg-[#122642] hover:bg-[#1A375E] border-2 border-sky-400/75 text-sky-300 shadow-lg shadow-sky-950/50 cursor-pointer'
            }`}
          >
            <Minus className="w-5 h-5 sm:w-7 sm:h-7 stroke-[2.5]" />
          </button>
          <span className="text-[11px] font-medium text-[#C3D5EA] whitespace-nowrap">
            Res. −
          </span>
        </div>

        {/* Center: Play (Green), Pause (Yellow), Stop (Red) */}
        <div className="flex items-center justify-center gap-3 sm:gap-6 xl:gap-8">
          {/* Play (Green) */}
          <div className="flex flex-col items-center gap-1">
            <button
              type="button"
              onClick={handleBigPlay}
              disabled={isRecording && !isPaused}
              aria-label={!isRecording ? 'Avvia sessione' : 'Riprendi sessione'}
              className={`w-12 h-12 sm:w-16 sm:h-16 xl:w-[74px] xl:h-[74px] rounded-full flex items-center justify-center transition-transform active:scale-95 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-emerald-400 ${
                isRecording && !isPaused
                  ? 'bg-emerald-500/25 border-2 border-emerald-400 text-emerald-300 cursor-default'
                  : 'bg-emerald-500 hover:bg-emerald-400 text-[#04130B] shadow-lg shadow-emerald-950/60 cursor-pointer'
              }`}
            >
              <Play className="w-5 h-5 sm:w-7 sm:h-7 xl:w-8 xl:h-8 fill-current ml-0.5" />
            </button>
            <span className="text-[11px] font-medium text-[#C3D5EA] whitespace-nowrap">
              {!isRecording ? 'Avvia' : isPaused ? 'Riprendi' : 'Attiva'}
            </span>
          </div>

          {/* Pause (Yellow) */}
          <div className="flex flex-col items-center gap-1">
            <button
              type="button"
              onClick={handleBigPause}
              disabled={!isRecording || isPaused}
              aria-label="Metti in pausa la sessione"
              className={`w-12 h-12 sm:w-16 sm:h-16 xl:w-[74px] xl:h-[74px] rounded-full flex items-center justify-center transition-transform active:scale-95 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-amber-300 ${
                isRecording && isPaused
                  ? 'bg-amber-400/25 border-2 border-amber-400 text-amber-300 cursor-default'
                  : !isRecording
                  ? 'bg-[#12243F] border border-[#233F66] text-[#526D8E] cursor-not-allowed'
                  : 'bg-amber-400 hover:bg-amber-300 text-[#1A1202] shadow-lg shadow-amber-950/50 cursor-pointer'
              }`}
            >
              <Pause className="w-5 h-5 sm:w-7 sm:h-7 xl:w-8 xl:h-8 fill-current" />
            </button>
            <span className="text-[11px] font-medium text-[#C3D5EA] whitespace-nowrap">
              {isRecording && isPaused ? 'In pausa' : 'Pausa'}
            </span>
          </div>

          {/* Stop (Red) */}
          <div className="flex flex-col items-center gap-1">
            <button
              type="button"
              onClick={handleBigStop}
              disabled={!isRecording && elapsedSec === 0}
              aria-label="Ferma la sessione per salvare o eliminare"
              className={`w-12 h-12 sm:w-16 sm:h-16 xl:w-[74px] xl:h-[74px] rounded-full flex items-center justify-center transition-transform active:scale-95 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-rose-400 ${
                !isRecording && elapsedSec === 0
                  ? 'bg-[#12243F] border border-[#233F66] text-[#526D8E] cursor-not-allowed'
                  : 'bg-rose-500 hover:bg-rose-400 text-white shadow-lg shadow-rose-950/60 cursor-pointer'
              }`}
            >
              <Square className="w-4 h-4 sm:w-6 sm:h-6 xl:w-7 xl:h-7 fill-current" />
            </button>
            <span className="text-[11px] font-medium text-[#C3D5EA] whitespace-nowrap">
              Stop
            </span>
          </div>
        </div>

        {/* Right: Resistance Up (+) */}
        <div className="flex flex-col items-center gap-1 shrink-0">
          <button
            type="button"
            onClick={() => onChangeResistance(resistanceLevel + 1)}
            disabled={resistanceLevel >= 20}
            aria-label="Alza resistenza"
            className={`w-12 h-12 sm:w-16 sm:h-16 xl:w-[74px] xl:h-[74px] rounded-full flex items-center justify-center transition-transform active:scale-95 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-sky-400 ${
              resistanceLevel >= 20
                ? 'bg-[#12243F] border border-[#233F66] text-[#526D8E] cursor-not-allowed'
                : 'bg-[#122642] hover:bg-[#1A375E] border-2 border-sky-400/75 text-sky-300 shadow-lg shadow-sky-950/50 cursor-pointer'
            }`}
          >
            <Plus className="w-5 h-5 sm:w-7 sm:h-7 stroke-[2.5]" />
          </button>
          <span className="text-[11px] font-medium text-[#C3D5EA] whitespace-nowrap">
            Res. +
          </span>
        </div>
      </section>

      {/* Stop Session Modal: Save or Discard */}
      {showSaveForm && (
        <div
          className="fixed inset-0 z-50 bg-[#030914]/80 backdrop-blur-xs flex items-center justify-center p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="stop-session-modal-title"
        >
          <form
            onSubmit={confirmSave}
            className="w-full max-w-lg rounded-xl bg-[#0C1A2E] border border-[#233F66] p-6 space-y-5 shadow-2xl"
          >
            <div className="flex items-start justify-between gap-4">
              <div>
                <h3
                  id="stop-session-modal-title"
                  className="font-display text-lg font-semibold text-[#E8F0FA]"
                >
                  Sessione terminata
                </h3>
                <p className="mt-1 text-xs text-[#94ACC8] font-mono-tabular">
                  Durata {formatDuration(elapsedSec)} · {livePoint.distanceKm.toFixed(2)} km ·{' '}
                  {livePoint.caloriesKcal} kcal
                </p>
              </div>
              <button
                type="button"
                onClick={() => setShowSaveForm(false)}
                aria-label="Chiudi e mantieni in pausa"
                className="p-1.5 text-[#7E99B8] hover:text-[#E8F0FA]"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-3.5">
              <div>
                <label className="block text-xs text-[#94ACC8] mb-1.5">Titolo allenamento</label>
                <input
                  type="text"
                  value={saveTitle}
                  onChange={(e) => setSaveTitle(e.target.value)}
                  required
                  className="w-full h-10 rounded-lg bg-[#07111F] border border-[#233F66] px-3 text-sm text-[#E8F0FA] focus:outline-none focus:border-sky-400"
                />
              </div>
              <div>
                <label className="block text-xs text-[#94ACC8] mb-1.5">
                  Note personali (opzionale)
                </label>
                <input
                  type="text"
                  value={saveNotes}
                  onChange={(e) => setSaveNotes(e.target.value)}
                  placeholder="Sensazioni, cadenza, recupero..."
                  className="w-full h-10 rounded-lg bg-[#07111F] border border-[#233F66] px-3 text-sm text-[#E8F0FA] placeholder:text-[#526D8E] focus:outline-none focus:border-sky-400"
                />
              </div>
            </div>

            <div className="pt-2 border-t border-[#1B3252] flex flex-col-reverse sm:flex-row sm:items-center justify-between gap-3">
              <button
                type="button"
                onClick={handleDiscardSession}
                className="h-11 px-4 rounded-lg bg-rose-950/60 hover:bg-rose-900/70 border border-rose-500/40 text-rose-200 text-xs font-semibold flex items-center justify-center gap-2 transition-colors whitespace-nowrap"
              >
                <Trash2 className="w-4 h-4" />
                Elimina Sessione
              </button>

              <div className="flex items-center gap-2.5 justify-end">
                <button
                  type="button"
                  onClick={() => setShowSaveForm(false)}
                  className="h-11 px-4 rounded-lg bg-[#12243F] hover:bg-[#193053] border border-[#233F66] text-xs font-medium text-[#E8F0FA] whitespace-nowrap"
                >
                  Mantieni in pausa
                </button>
                <button
                  type="submit"
                  className="h-11 px-5 rounded-lg bg-emerald-500 hover:bg-emerald-400 text-[#05101F] text-xs font-semibold flex items-center justify-center gap-2 transition-colors whitespace-nowrap"
                >
                  <Save className="w-4 h-4" />
                  Salva Sessione
                </button>
              </div>
            </div>
          </form>
        </div>
      )}
    </div>
  );
};
