import React, { useMemo, useState } from 'react';
import {
  Download,
  FileDown,
  FileText,
  Search,
  Share2,
  Trash2,
  X,
} from 'lucide-react';
import {
  Area,
  AreaChart,
  Bar,
  CartesianGrid,
  ComposedChart,
  Line,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { formatDuration } from '../data/defaultData';
import {
  exportHistorySummaryPdf,
  exportSingleWorkoutPdf,
  exportWorkoutsCsv,
  exportWorkoutTcx,
} from '../services/exportService';
import type { WorkoutSession } from '../types/bike';

interface HistoryViewProps {
  workouts: WorkoutSession[];
  stravaConnected: boolean;
  onDeleteWorkout: (workout: WorkoutSession) => void;
  onUploadToStrava: (workout: WorkoutSession) => Promise<void>;
  onNavigateToDashboard: () => void;
}

export const HistoryView: React.FC<HistoryViewProps> = ({
  workouts,
  stravaConnected,
  onDeleteWorkout,
  onUploadToStrava,
  onNavigateToDashboard,
}) => {
  const [period, setPeriod] = useState<'7d' | '30d' | 'all'>('30d');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedWorkoutId, setSelectedWorkoutId] = useState<string | null>(null);
  const [uploadingId, setUploadingId] = useState<string | null>(null);

  const filtered = useMemo(() => {
    const now = Date.now();
    const cutoff =
      period === '7d'
        ? now - 7 * 86_400_000
        : period === '30d'
        ? now - 30 * 86_400_000
        : 0;
    const q = searchQuery.trim().toLowerCase();

    return [...workouts]
      .filter((w) => new Date(w.dateIso).getTime() >= cutoff)
      .filter((w) => {
        if (!q) return true;
        return (
          w.title.toLowerCase().includes(q) ||
          w.programName.toLowerCase().includes(q) ||
          w.notes.toLowerCase().includes(q)
        );
      })
      .sort((a, b) => new Date(b.dateIso).getTime() - new Date(a.dateIso).getTime());
  }, [workouts, period, searchQuery]);

  const selectedWorkout = useMemo(
    () => workouts.find((w) => w.id === selectedWorkoutId) || null,
    [workouts, selectedWorkoutId]
  );

  const summary = useMemo(() => {
    const count = filtered.length;
    const dist = filtered.reduce((a, w) => a + w.distanceKm, 0);
    const dur = filtered.reduce((a, w) => a + w.durationSec, 0);
    const kcal = filtered.reduce((a, w) => a + w.caloriesKcal, 0);
    const avgW =
      count > 0 ? Math.round(filtered.reduce((a, w) => a + w.avgPowerWatts, 0) / count) : 0;
    return { count, dist, dur, kcal, avgW };
  }, [filtered]);

  const trendData = useMemo(() => {
    return [...filtered]
      .reverse()
      .map((w) => ({
        date: new Date(w.dateIso).toLocaleDateString('it-IT', {
          day: '2-digit',
          month: '2-digit',
        }),
        distanceKm: Number(w.distanceKm.toFixed(1)),
        avgPowerWatts: w.avgPowerWatts,
        caloriesKcal: w.caloriesKcal,
      }));
  }, [filtered]);

  const periodLabel =
    period === '7d' ? 'Ultimi 7 giorni' : period === '30d' ? 'Ultimi 30 giorni' : 'Storico completo';

  const handleStravaUpload = async (w: WorkoutSession) => {
    setUploadingId(w.id);
    try {
      await onUploadToStrava(w);
    } finally {
      setUploadingId(null);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header & Exports */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div>
          <h1 className="font-display text-xl font-semibold text-[#E8F0FA]">
            Cronologia Allenamenti e Report PDF
          </h1>
          <p className="text-sm text-[#94ACC8]">
            Analizza i progressi nel tempo, ispeziona la telemetria salvata ed esporta report PDF o TCX.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <button
            type="button"
            disabled={filtered.length === 0}
            onClick={() => exportHistorySummaryPdf(filtered, periodLabel)}
            className="px-4 py-2 rounded-lg bg-sky-500 hover:bg-sky-400 disabled:opacity-40 text-[#05101F] text-xs font-semibold transition-colors flex items-center gap-2 whitespace-nowrap shrink-0"
          >
            <FileText className="w-3.5 h-3.5" />
            Esporta Report PDF
          </button>
          <button
            type="button"
            disabled={filtered.length === 0}
            onClick={() => exportWorkoutsCsv(filtered)}
            className="px-3.5 py-2 rounded-lg bg-[#12243F] hover:bg-[#193053] disabled:opacity-40 border border-[#233F66] text-[#E8F0FA] text-xs font-medium transition-colors flex items-center gap-2 whitespace-nowrap shrink-0"
          >
            <FileDown className="w-3.5 h-3.5 text-sky-400" />
            Esporta CSV
          </button>
        </div>
      </div>

      {/* Filters & Search */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-center gap-1 p-1 rounded-lg bg-[#0C1A2E] border border-[#1B3252] w-fit">
          {([
            ['7d', 'Ultimi 7 giorni'],
            ['30d', 'Ultimi 30 giorni'],
            ['all', 'Tutto'],
          ] as const).map(([key, label]) => (
            <button
              key={key}
              type="button"
              onClick={() => setPeriod(key)}
              className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors whitespace-nowrap ${
                period === key ? 'bg-[#173054] text-sky-300' : 'text-[#94ACC8] hover:text-[#E8F0FA]'
              }`}
            >
              {label}
            </button>
          ))}
        </div>

        <div className="relative w-full sm:w-72">
          <Search className="w-4 h-4 text-[#647E9E] absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="search"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Cerca titolo, programma o note..."
            className="w-full h-9 rounded-lg bg-[#0C1A2E] border border-[#1B3252] pl-9 pr-3 text-xs text-[#E8F0FA] placeholder:text-[#526D8E] focus:outline-none focus:border-sky-400"
          />
        </div>
      </div>

      {/* Aggregated KPI Strip */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        {[
          { label: 'Sessioni', value: String(summary.count), sub: periodLabel },
          { label: 'Distanza totale', value: `${summary.dist.toFixed(1)} km`, sub: 'Somma periodo' },
          { label: 'Tempo in sella', value: formatDuration(summary.dur), sub: 'Durata cumulata' },
          { label: 'Potenza media', value: `${summary.avgW} W`, sub: 'Media sessioni' },
          { label: 'Calorie bruciate', value: `${summary.kcal} kcal`, sub: 'Energia totale' },
        ].map((kpi) => (
          <div
            key={kpi.label}
            className="rounded-xl bg-[#0C1A2E] border border-[#1B3252] p-4"
          >
            <div className="text-xs text-[#94ACC8]">{kpi.label}</div>
            <div className="mt-2 font-mono-tabular text-2xl font-bold text-[#E8F0FA]">
              {kpi.value}
            </div>
            <div className="mt-1 text-xs text-[#647E9E]">{kpi.sub}</div>
          </div>
        ))}
      </div>

      {/* Progression Chart */}
      {trendData.length > 0 && (
        <section className="rounded-xl bg-[#0C1A2E] border border-[#1B3252] p-5">
          <div className="mb-4">
            <h2 className="font-display text-base font-semibold text-[#E8F0FA]">
              Andamento Distanza e Potenza Media
            </h2>
            <p className="text-xs text-[#94ACC8]">
              Confronto tra chilometri percorsi (barre blu) e watt medi espressi (linea ciano) per sessione.
            </p>
          </div>
          <div className="h-64 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart data={trendData} margin={{ top: 8, right: 12, left: -12, bottom: 0 }}>
                <CartesianGrid stroke="#162B47" strokeDasharray="3 3" vertical={false} />
                <XAxis
                  dataKey="date"
                  stroke="#647E9E"
                  tick={{ fill: '#7E99B8', fontSize: 11, fontFamily: 'JetBrains Mono' }}
                />
                <YAxis
                  yAxisId="left"
                  stroke="#647E9E"
                  tick={{ fill: '#7E99B8', fontSize: 11, fontFamily: 'JetBrains Mono' }}
                />
                <YAxis
                  yAxisId="right"
                  orientation="right"
                  stroke="#647E9E"
                  tick={{ fill: '#7E99B8', fontSize: 11, fontFamily: 'JetBrains Mono' }}
                />
                <Tooltip
                  contentStyle={{
                    backgroundColor: '#07111F',
                    borderColor: '#233F66',
                    borderRadius: '8px',
                    fontSize: '12px',
                    color: '#E8F0FA',
                  }}
                />
                <Bar
                  yAxisId="left"
                  dataKey="distanceKm"
                  name="Distanza (km)"
                  fill="#1E4B85"
                  radius={[4, 4, 0, 0]}
                  maxBarSize={36}
                />
                <Line
                  yAxisId="right"
                  type="monotone"
                  dataKey="avgPowerWatts"
                  name="Potenza media (W)"
                  stroke="#38BDF8"
                  strokeWidth={2.5}
                  dot={{ r: 3.5, fill: '#38BDF8' }}
                />
              </ComposedChart>
            </ResponsiveContainer>
          </div>
        </section>
      )}

      {/* History Data Table */}
      <section className="rounded-xl bg-[#0C1A2E] border border-[#1B3252] overflow-hidden">
        {filtered.length === 0 ? (
          <div className="p-10 text-center">
            <p className="text-sm font-medium text-[#E8F0FA]">
              Nessun allenamento trovato nel periodo selezionato
            </p>
            <p className="mt-1 text-xs text-[#94ACC8]">
              Avvia una nuova sessione dalla dashboard per registrare i dati della cyclette.
            </p>
            <button
              type="button"
              onClick={onNavigateToDashboard}
              className="mt-4 px-4 py-2 rounded-lg bg-sky-500 hover:bg-sky-400 text-[#05101F] text-xs font-semibold"
            >
              Vai alla Dashboard Live
            </button>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse min-w-[820px]">
              <thead>
                <tr className="bg-[#091526] border-b border-[#1B3252] text-xs text-[#94ACC8]">
                  <th className="py-3 px-4 font-medium">Data</th>
                  <th className="py-3 px-4 font-medium">Allenamento</th>
                  <th className="py-3 px-4 font-medium text-right">Durata</th>
                  <th className="py-3 px-4 font-medium text-right">Distanza</th>
                  <th className="py-3 px-4 font-medium text-right">Potenza Med.</th>
                  <th className="py-3 px-4 font-medium text-right">Cadenza</th>
                  <th className="py-3 px-4 font-medium text-right">FC Media</th>
                  <th className="py-3 px-4 font-medium text-right">Calorie</th>
                  <th className="py-3 px-4 font-medium text-right">Azioni</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#162944] text-sm">
                {filtered.map((w) => (
                  <tr
                    key={w.id}
                    onClick={() => setSelectedWorkoutId(w.id)}
                    className={`cursor-pointer transition-colors ${
                      selectedWorkoutId === w.id ? 'bg-[#132642]' : 'hover:bg-[#10213A]'
                    }`}
                  >
                    <td className="py-3 px-4 font-mono-tabular text-xs text-[#94ACC8] whitespace-nowrap">
                      {new Date(w.dateIso).toLocaleDateString('it-IT', {
                        day: '2-digit',
                        month: 'short',
                        year: 'numeric',
                      })}
                    </td>
                    <td className="py-3 px-4">
                      <div className="font-medium text-[#E8F0FA]">{w.title}</div>
                      <div className="text-xs text-[#7E99B8]">
                        {w.programName}
                        {w.syncedToSheets ? ' · Sheets' : ''}
                        {w.syncedToStrava ? ' · Strava' : ''}
                        {w.syncedToGoogleFit ? ' · Fit' : ''}
                      </div>
                    </td>
                    <td className="py-3 px-4 text-right font-mono-tabular text-[#E8F0FA]">
                      {formatDuration(w.durationSec)}
                    </td>
                    <td className="py-3 px-4 text-right font-mono-tabular text-[#E8F0FA]">
                      {w.distanceKm.toFixed(1)} km
                    </td>
                    <td className="py-3 px-4 text-right font-mono-tabular text-sky-300">
                      {w.avgPowerWatts} W
                    </td>
                    <td className="py-3 px-4 text-right font-mono-tabular text-[#C3D5EA]">
                      {w.avgCadenceRpm} RPM
                    </td>
                    <td className="py-3 px-4 text-right font-mono-tabular text-[#C3D5EA]">
                      {w.avgHeartRateBpm > 0 ? `${w.avgHeartRateBpm} BPM` : '-'}
                    </td>
                    <td className="py-3 px-4 text-right font-mono-tabular text-[#C3D5EA]">
                      {w.caloriesKcal} kcal
                    </td>
                    <td
                      className="py-3 px-4 text-right whitespace-nowrap"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <div className="inline-flex items-center gap-1.5">
                        <button
                          type="button"
                          onClick={() => exportSingleWorkoutPdf(w)}
                          title="Esporta report PDF"
                          aria-label={`Esporta PDF per ${w.title}`}
                          className="p-1.5 rounded bg-[#12243F] hover:bg-[#1A3358] text-sky-300"
                        >
                          <FileText className="w-3.5 h-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => exportWorkoutTcx(w)}
                          title="Scarica file .TCX per Strava / Google Fit"
                          aria-label={`Scarica TCX per ${w.title}`}
                          className="p-1.5 rounded bg-[#12243F] hover:bg-[#1A3358] text-[#C3D5EA]"
                        >
                          <Download className="w-3.5 h-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => onDeleteWorkout(w)}
                          title="Elimina sessione"
                          aria-label={`Elimina ${w.title}`}
                          className="p-1.5 rounded bg-[#12243F] hover:bg-rose-950/60 text-[#94ACC8] hover:text-rose-300"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* Selected Session Detail Panel */}
      {selectedWorkout && (
        <section className="rounded-xl bg-[#0C1A2E] border border-sky-500/40 p-6 space-y-5">
          <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4 pb-4 border-b border-[#1B3252]">
            <div>
              <div className="text-xs text-[#94ACC8]">
                {new Date(selectedWorkout.dateIso).toLocaleString('it-IT', {
                  dateStyle: 'full',
                  timeStyle: 'short',
                })}{' '}
                · {selectedWorkout.programName}
              </div>
              <h2 className="mt-1 font-display text-lg font-semibold text-[#E8F0FA]">
                {selectedWorkout.title}
              </h2>
              {selectedWorkout.notes && (
                <p className="mt-1 text-sm text-[#94ACC8]">{selectedWorkout.notes}</p>
              )}
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={() => exportSingleWorkoutPdf(selectedWorkout)}
                className="px-3.5 py-2 rounded-lg bg-sky-500 hover:bg-sky-400 text-[#05101F] text-xs font-semibold flex items-center gap-1.5 whitespace-nowrap"
              >
                <FileText className="w-3.5 h-3.5" />
                Report PDF
              </button>
              <button
                type="button"
                onClick={() => exportWorkoutTcx(selectedWorkout)}
                className="px-3.5 py-2 rounded-lg bg-[#12243F] hover:bg-[#193053] border border-[#233F66] text-[#E8F0FA] text-xs font-medium flex items-center gap-1.5 whitespace-nowrap"
              >
                <Download className="w-3.5 h-3.5 text-sky-400" />
                Scarica .TCX
              </button>
              {stravaConnected && !selectedWorkout.syncedToStrava && (
                <button
                  type="button"
                  disabled={uploadingId === selectedWorkout.id}
                  onClick={() => handleStravaUpload(selectedWorkout)}
                  className="px-3.5 py-2 rounded-lg bg-[#12243F] hover:bg-[#193053] border border-amber-500/40 text-amber-300 text-xs font-medium flex items-center gap-1.5 whitespace-nowrap disabled:opacity-50"
                >
                  <Share2 className="w-3.5 h-3.5" />
                  {uploadingId === selectedWorkout.id ? 'Invio...' : 'Invia a Strava'}
                </button>
              )}
              <button
                type="button"
                onClick={() => setSelectedWorkoutId(null)}
                aria-label="Chiudi dettaglio"
                className="p-2 text-[#7E99B8] hover:text-[#E8F0FA]"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-6 gap-4 text-xs">
            <div>
              <div className="text-[#647E9E]">Velocità Media / Max</div>
              <div className="mt-1 font-mono-tabular text-base font-semibold text-[#E8F0FA]">
                {selectedWorkout.avgSpeedKmh.toFixed(1)} / {selectedWorkout.maxSpeedKmh.toFixed(1)} km/h
              </div>
            </div>
            <div>
              <div className="text-[#647E9E]">Potenza Media / Picco</div>
              <div className="mt-1 font-mono-tabular text-base font-semibold text-sky-300">
                {selectedWorkout.avgPowerWatts} / {selectedWorkout.maxPowerWatts} W
              </div>
            </div>
            <div>
              <div className="text-[#647E9E]">Cadenza Media</div>
              <div className="mt-1 font-mono-tabular text-base font-semibold text-emerald-400">
                {selectedWorkout.avgCadenceRpm} RPM
              </div>
            </div>
            <div>
              <div className="text-[#647E9E]">FC Media / Max</div>
              <div className="mt-1 font-mono-tabular text-base font-semibold text-rose-400">
                {selectedWorkout.avgHeartRateBpm || '-'} / {selectedWorkout.maxHeartRateBpm || '-'} BPM
              </div>
            </div>
            <div>
              <div className="text-[#647E9E]">Resistenza Media</div>
              <div className="mt-1 font-mono-tabular text-base font-semibold text-[#E8F0FA]">
                Livello {selectedWorkout.avgResistance}/20
              </div>
            </div>
            <div>
              <div className="text-[#647E9E]">Energia</div>
              <div className="mt-1 font-mono-tabular text-base font-semibold text-amber-300">
                {selectedWorkout.caloriesKcal} kcal
              </div>
            </div>
          </div>

          {selectedWorkout.samples.length > 1 && (
            <div className="h-60 w-full pt-2">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart
                  data={selectedWorkout.samples.map((s) => ({
                    ...s,
                    timeLabel: formatDuration(s.elapsedSec),
                  }))}
                  margin={{ top: 8, right: 12, left: -12, bottom: 0 }}
                >
                  <CartesianGrid stroke="#162B47" strokeDasharray="3 3" vertical={false} />
                  <XAxis
                    dataKey="timeLabel"
                    stroke="#647E9E"
                    tick={{ fill: '#7E99B8', fontSize: 11, fontFamily: 'JetBrains Mono' }}
                  />
                  <YAxis
                    stroke="#647E9E"
                    tick={{ fill: '#7E99B8', fontSize: 11, fontFamily: 'JetBrains Mono' }}
                  />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: '#07111F',
                      borderColor: '#233F66',
                      borderRadius: '8px',
                      fontSize: '12px',
                      color: '#E8F0FA',
                    }}
                  />
                  <Area
                    type="monotone"
                    dataKey="powerWatts"
                    name="Potenza (W)"
                    stroke="#38BDF8"
                    fill="#38BDF8"
                    fillOpacity={0.18}
                    strokeWidth={2}
                  />
                  <Area
                    type="monotone"
                    dataKey="heartRateBpm"
                    name="FC (BPM)"
                    stroke="#F43F5E"
                    fill="#F43F5E"
                    fillOpacity={0.08}
                    strokeWidth={1.8}
                  />
                  <Area
                    type="monotone"
                    dataKey="cadenceRpm"
                    name="Cadenza (RPM)"
                    stroke="#22C55E"
                    fill="none"
                    strokeWidth={1.5}
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          )}
        </section>
      )}
    </div>
  );
};
