import React, { useState } from 'react';
import {
  ArrowDown,
  ArrowUp,
  Calendar,
  Copy,
  Edit3,
  Play,
  Plus,
  Save,
  Trash2,
  X,
} from 'lucide-react';
import {
  formatDuration,
  getProgramTotalDuration,
  PHASE_META,
  WEEKDAY_LABELS,
} from '../data/defaultData';
import type {
  IntervalBlock,
  IntervalPhaseType,
  ProgramCategory,
  TrainingProgram,
  WeeklySchedule,
  WeekdayKey,
} from '../types/bike';

interface ProgramsViewProps {
  programs: TrainingProgram[];
  weeklySchedule: WeeklySchedule;
  activeProgramId: string | null;
  onSaveProgram: (program: TrainingProgram) => void;
  onDeleteProgram: (programId: string) => void;
  onLoadProgramInDashboard: (programId: string | null) => void;
  onUpdateWeeklySchedule: (schedule: WeeklySchedule) => void;
}

const CATEGORIES: ProgramCategory[] = ['HIIT', 'Resistenza', 'Aerobico', 'Soglia', 'Recupero'];
const PHASE_TYPES: IntervalPhaseType[] = [
  'warmup',
  'endurance',
  'tempo',
  'sprint',
  'recovery',
  'cooldown',
];

function createEmptyBlock(index: number): IntervalBlock {
  return {
    id: `blk-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    label: `Blocco ${index + 1}`,
    phase: 'endurance',
    durationSec: 180,
    targetResistance: 8,
    targetCadenceRpm: 85,
    targetPowerWatts: 160,
  };
}

function createNewProgramDraft(): TrainingProgram {
  return {
    id: `prog-${Date.now()}`,
    name: 'Nuovo Programma Personalizzato',
    category: 'Aerobico',
    description: 'Sessione strutturata su misura per resistenza e potenza.',
    createdAt: new Date().toISOString(),
    blocks: [
      {
        id: `blk-w-${Date.now()}`,
        label: 'Riscaldamento',
        phase: 'warmup',
        durationSec: 300,
        targetResistance: 5,
        targetCadenceRpm: 82,
        targetPowerWatts: 120,
      },
      {
        id: `blk-m-${Date.now() + 1}`,
        label: 'Blocco centrale',
        phase: 'tempo',
        durationSec: 600,
        targetResistance: 10,
        targetCadenceRpm: 88,
        targetPowerWatts: 185,
      },
      {
        id: `blk-c-${Date.now() + 2}`,
        label: 'Defaticamento',
        phase: 'cooldown',
        durationSec: 240,
        targetResistance: 4,
        targetCadenceRpm: 76,
        targetPowerWatts: 100,
      },
    ],
  };
}

export const ProgramsView: React.FC<ProgramsViewProps> = ({
  programs,
  weeklySchedule,
  activeProgramId,
  onSaveProgram,
  onDeleteProgram,
  onLoadProgramInDashboard,
  onUpdateWeeklySchedule,
}) => {
  const [editingDraft, setEditingDraft] = useState<TrainingProgram | null>(null);
  const [categoryFilter, setCategoryFilter] = useState<'Tutte' | ProgramCategory>('Tutte');

  const filteredPrograms =
    categoryFilter === 'Tutte'
      ? programs
      : programs.filter((p) => p.category === categoryFilter);

  const handleDuplicate = (program: TrainingProgram) => {
    const copy: TrainingProgram = {
      ...program,
      id: `prog-${Date.now()}`,
      name: `${program.name} (Copia)`,
      createdAt: new Date().toISOString(),
      blocks: program.blocks.map((b, i) => ({
        ...b,
        id: `blk-copy-${Date.now()}-${i}`,
      })),
    };
    onSaveProgram(copy);
  };

  const updateDraftBlock = (idx: number, patch: Partial<IntervalBlock>) => {
    if (!editingDraft) return;
    const nextBlocks = editingDraft.blocks.map((b, i) => (i === idx ? { ...b, ...patch } : b));
    setEditingDraft({ ...editingDraft, blocks: nextBlocks });
  };

  const moveBlock = (idx: number, dir: -1 | 1) => {
    if (!editingDraft) return;
    const target = idx + dir;
    if (target < 0 || target >= editingDraft.blocks.length) return;
    const copy = [...editingDraft.blocks];
    [copy[idx], copy[target]] = [copy[target], copy[idx]];
    setEditingDraft({ ...editingDraft, blocks: copy });
  };

  const removeBlock = (idx: number) => {
    if (!editingDraft || editingDraft.blocks.length <= 1) return;
    setEditingDraft({
      ...editingDraft,
      blocks: editingDraft.blocks.filter((_, i) => i !== idx),
    });
  };

  const addBlock = () => {
    if (!editingDraft) return;
    setEditingDraft({
      ...editingDraft,
      blocks: [...editingDraft.blocks, createEmptyBlock(editingDraft.blocks.length)],
    });
  };

  const handleSaveDraft = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingDraft || !editingDraft.name.trim()) return;
    onSaveProgram({
      ...editingDraft,
      name: editingDraft.name.trim(),
      description: editingDraft.description.trim(),
    });
    setEditingDraft(null);
  };

  const handleScheduleChange = (day: WeekdayKey, programId: string) => {
    onUpdateWeeklySchedule({
      ...weeklySchedule,
      [day]: programId || null,
    });
  };

  return (
    <div className="space-y-6">
      {/* Header & Filter Row */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="font-display text-xl font-semibold text-[#E8F0FA]">
            Programmi di Allenamento e Sessioni
          </h1>
          <p className="text-sm text-[#94ACC8]">
            Imposta i blocchi di resistenza, cadenza e potenza per guidare ogni sessione in diretta.
          </p>
        </div>

        <button
          type="button"
          onClick={() => setEditingDraft(createNewProgramDraft())}
          className="px-4 py-2.5 rounded-lg bg-sky-500 hover:bg-sky-400 text-[#05101F] text-xs font-semibold transition-colors flex items-center gap-2 whitespace-nowrap shrink-0 self-start sm:self-auto"
        >
          <Plus className="w-4 h-4" />
          Nuovo Programma
        </button>
      </div>

      {/* Interactive Session Builder / Editor */}
      {editingDraft && (
        <form
          onSubmit={handleSaveDraft}
          className="rounded-xl bg-[#0C1A2E] border border-sky-500/40 p-6 space-y-6"
        >
          <div className="flex items-center justify-between gap-4 pb-4 border-b border-[#1B3252]">
            <div>
              <h2 className="font-display text-lg font-semibold text-[#E8F0FA]">
                Editor Programma di Sessione
              </h2>
              <p className="text-xs text-[#94ACC8] font-mono-tabular">
                Durata totale: {formatDuration(getProgramTotalDuration(editingDraft))} ·{' '}
                {editingDraft.blocks.length} intervalli configurati
              </p>
            </div>
            <button
              type="button"
              onClick={() => setEditingDraft(null)}
              aria-label="Chiudi editor"
              className="p-2 text-[#7E99B8] hover:text-[#E8F0FA]"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Program Metadata */}
          <div className="grid grid-cols-1 md:grid-cols-12 gap-4">
            <div className="md:col-span-5">
              <label className="block text-xs text-[#94ACC8] mb-1.5">Nome del programma</label>
              <input
                type="text"
                required
                value={editingDraft.name}
                onChange={(e) => setEditingDraft({ ...editingDraft, name: e.target.value })}
                className="w-full h-10 rounded-lg bg-[#07111F] border border-[#233F66] px-3 text-sm text-[#E8F0FA] focus:outline-none focus:border-sky-400"
              />
            </div>
            <div className="md:col-span-3">
              <label className="block text-xs text-[#94ACC8] mb-1.5">Categoria</label>
              <select
                value={editingDraft.category}
                onChange={(e) =>
                  setEditingDraft({
                    ...editingDraft,
                    category: e.target.value as ProgramCategory,
                  })
                }
                className="w-full h-10 rounded-lg bg-[#07111F] border border-[#233F66] px-3 text-sm text-[#E8F0FA] focus:outline-none focus:border-sky-400"
              >
                {CATEGORIES.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            </div>
            <div className="md:col-span-4">
              <label className="block text-xs text-[#94ACC8] mb-1.5">Descrizione</label>
              <input
                type="text"
                value={editingDraft.description}
                onChange={(e) => setEditingDraft({ ...editingDraft, description: e.target.value })}
                className="w-full h-10 rounded-lg bg-[#07111F] border border-[#233F66] px-3 text-sm text-[#E8F0FA] focus:outline-none focus:border-sky-400"
              />
            </div>
          </div>

          {/* Live Intensity Profile Preview */}
          <div>
            <div className="text-xs text-[#94ACC8] mb-2">Anteprima profilo di intensità</div>
            <div className="h-20 rounded-lg bg-[#07111F] border border-[#1B3252] p-3 flex items-end gap-1">
              {editingDraft.blocks.map((block) => {
                const total = Math.max(1, getProgramTotalDuration(editingDraft));
                const widthPct = (block.durationSec / total) * 100;
                const heightPct = Math.max(20, Math.min(100, (block.targetPowerWatts / 310) * 100));
                const meta = PHASE_META[block.phase] || PHASE_META.endurance;
                return (
                  <div
                    key={block.id}
                    style={{ width: `${widthPct}%`, height: `${heightPct}%` }}
                    title={`${block.label}: ${block.targetPowerWatts}W · ${formatDuration(block.durationSec)}`}
                    className={`rounded-t-xs ${meta.bgBar}`}
                  />
                );
              })}
            </div>
          </div>

          {/* Interval Blocks Table */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-[#C3D5EA]">Intervalli della sessione</span>
              <button
                type="button"
                onClick={addBlock}
                className="px-3 py-1.5 rounded-lg bg-[#12243F] hover:bg-[#193053] border border-[#233F66] text-xs font-medium text-sky-300 flex items-center gap-1.5 whitespace-nowrap"
              >
                <Plus className="w-3.5 h-3.5" />
                Aggiungi intervallo
              </button>
            </div>

            <div className="overflow-x-auto border border-[#1B3252] rounded-lg">
              <table className="w-full text-left border-collapse min-w-[740px]">
                <thead>
                  <tr className="bg-[#091526] border-b border-[#1B3252] text-xs text-[#94ACC8]">
                    <th className="py-2.5 px-3 font-medium">Etichetta</th>
                    <th className="py-2.5 px-3 font-medium">Fase</th>
                    <th className="py-2.5 px-3 font-medium text-right">Durata (sec)</th>
                    <th className="py-2.5 px-3 font-medium text-right">Resistenza</th>
                    <th className="py-2.5 px-3 font-medium text-right">Cadenza (RPM)</th>
                    <th className="py-2.5 px-3 font-medium text-right">Potenza (W)</th>
                    <th className="py-2.5 px-3 font-medium text-right">Ordine</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#162944] text-xs">
                  {editingDraft.blocks.map((block, idx) => (
                    <tr key={block.id} className="bg-[#0C1A2E]">
                      <td className="py-2 px-3">
                        <input
                          type="text"
                          value={block.label}
                          onChange={(e) => updateDraftBlock(idx, { label: e.target.value })}
                          className="w-full h-8 rounded bg-[#07111F] border border-[#1F3758] px-2.5 text-[#E8F0FA] focus:outline-none focus:border-sky-400"
                        />
                      </td>
                      <td className="py-2 px-3">
                        <select
                          value={block.phase}
                          onChange={(e) =>
                            updateDraftBlock(idx, {
                              phase: e.target.value as IntervalPhaseType,
                            })
                          }
                          className="h-8 rounded bg-[#07111F] border border-[#1F3758] px-2 text-[#E8F0FA] focus:outline-none focus:border-sky-400"
                        >
                          {PHASE_TYPES.map((pt) => (
                            <option key={pt} value={pt}>
                              {PHASE_META[pt].label}
                            </option>
                          ))}
                        </select>
                      </td>
                      <td className="py-2 px-3 text-right">
                        <input
                          type="number"
                          min={15}
                          max={3600}
                          step={15}
                          value={block.durationSec}
                          onChange={(e) =>
                            updateDraftBlock(idx, {
                              durationSec: Math.max(15, Number(e.target.value) || 30),
                            })
                          }
                          className="w-20 h-8 rounded bg-[#07111F] border border-[#1F3758] px-2 text-right font-mono-tabular text-[#E8F0FA]"
                        />
                      </td>
                      <td className="py-2 px-3 text-right">
                        <input
                          type="number"
                          min={1}
                          max={20}
                          value={block.targetResistance}
                          onChange={(e) =>
                            updateDraftBlock(idx, {
                              targetResistance: Math.min(20, Math.max(1, Number(e.target.value) || 1)),
                            })
                          }
                          className="w-16 h-8 rounded bg-[#07111F] border border-[#1F3758] px-2 text-right font-mono-tabular text-[#E8F0FA]"
                        />
                      </td>
                      <td className="py-2 px-3 text-right">
                        <input
                          type="number"
                          min={45}
                          max={130}
                          value={block.targetCadenceRpm}
                          onChange={(e) =>
                            updateDraftBlock(idx, {
                              targetCadenceRpm: Math.min(130, Math.max(45, Number(e.target.value) || 75)),
                            })
                          }
                          className="w-20 h-8 rounded bg-[#07111F] border border-[#1F3758] px-2 text-right font-mono-tabular text-[#E8F0FA]"
                        />
                      </td>
                      <td className="py-2 px-3 text-right">
                        <input
                          type="number"
                          min={50}
                          max={450}
                          step={5}
                          value={block.targetPowerWatts}
                          onChange={(e) =>
                            updateDraftBlock(idx, {
                              targetPowerWatts: Math.min(450, Math.max(50, Number(e.target.value) || 120)),
                            })
                          }
                          className="w-20 h-8 rounded bg-[#07111F] border border-[#1F3758] px-2 text-right font-mono-tabular text-[#E8F0FA]"
                        />
                      </td>
                      <td className="py-2 px-3 text-right">
                        <div className="inline-flex items-center gap-1">
                          <button
                            type="button"
                            onClick={() => moveBlock(idx, -1)}
                            disabled={idx === 0}
                            aria-label="Sposta su"
                            className="p-1.5 rounded bg-[#12243F] hover:bg-[#193053] text-[#94ACC8] disabled:opacity-30"
                          >
                            <ArrowUp className="w-3.5 h-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={() => moveBlock(idx, 1)}
                            disabled={idx === editingDraft.blocks.length - 1}
                            aria-label="Sposta giù"
                            className="p-1.5 rounded bg-[#12243F] hover:bg-[#193053] text-[#94ACC8] disabled:opacity-30"
                          >
                            <ArrowDown className="w-3.5 h-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={() => removeBlock(idx)}
                            disabled={editingDraft.blocks.length <= 1}
                            aria-label="Elimina intervallo"
                            className="p-1.5 rounded bg-[#12243F] hover:bg-rose-950/60 text-[#94ACC8] hover:text-rose-300 disabled:opacity-30"
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
          </div>

          <div className="flex items-center justify-end gap-3 pt-2">
            <button
              type="button"
              onClick={() => setEditingDraft(null)}
              className="px-4 py-2 rounded-lg bg-[#12243F] hover:bg-[#193053] text-xs font-medium text-[#E8F0FA]"
            >
              Annulla
            </button>
            <button
              type="submit"
              className="px-4 py-2 rounded-lg bg-sky-500 hover:bg-sky-400 text-[#05101F] text-xs font-semibold flex items-center gap-1.5"
            >
              <Save className="w-3.5 h-3.5" />
              Salva Programma
            </button>
          </div>
        </form>
      )}

      {/* Category Filter Bar */}
      <div className="flex flex-wrap items-center gap-1 p-1 rounded-lg bg-[#0C1A2E] border border-[#1B3252] w-fit">
        {(['Tutte', ...CATEGORIES] as const).map((cat) => (
          <button
            key={cat}
            type="button"
            onClick={() => setCategoryFilter(cat)}
            className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors whitespace-nowrap ${
              categoryFilter === cat
                ? 'bg-[#173054] text-sky-300'
                : 'text-[#94ACC8] hover:text-[#E8F0FA]'
            }`}
          >
            {cat}
          </button>
        ))}
      </div>

      {/* Program Library Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
        {/* Built-in Free Ride Card (Sessione Libera) */}
        {categoryFilter === 'Tutte' && (
          <article
            className={`rounded-xl bg-[#0C1A2E] border p-5 flex flex-col justify-between transition-colors ${
              activeProgramId === null ? 'border-sky-400/70' : 'border-[#1B3252]'
            }`}
          >
            <div>
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="text-xs text-[#94ACC8] flex items-center gap-2">
                    <span className="text-emerald-400 font-medium">Libera</span>
                    <span aria-hidden="true">·</span>
                    <span>Durata a piacere</span>
                    <span aria-hidden="true">·</span>
                    <span>Senza obiettivi</span>
                  </div>
                  <h3 className="mt-1 font-display text-base font-semibold text-[#E8F0FA]">
                    Sessione Libera
                  </h3>
                </div>
                {activeProgramId === null && (
                  <span className="text-xs font-medium text-emerald-400 shrink-0">Attivo</span>
                )}
              </div>

              <p className="mt-2 text-xs text-[#94ACC8] leading-relaxed">
                Pedalata senza vincoli né traguardi quotidiani: la dashboard mostra esclusivamente i dati live (potenza, cadenza, velocità, FC) e il grafico telemetrico a tutta larghezza.
              </p>

              {/* Calm flat free-ride visual baseline */}
              <div className="mt-4 h-12 flex items-end gap-1">
                {[38, 46, 52, 48, 56, 50, 44, 54, 48, 42].map((h, i) => (
                  <div
                    key={i}
                    style={{ width: '10%', height: `${h}%` }}
                    className="rounded-t-xs bg-sky-400/50"
                  />
                ))}
              </div>

              <div className="mt-3 pt-3 border-t border-[#162944] flex items-center justify-between text-xs text-[#94ACC8]">
                <span>Resistenza manuale 1–20</span>
                <span>Solo telemetria live</span>
              </div>
            </div>

            <div className="mt-5 flex items-center justify-between gap-2">
              <button
                type="button"
                onClick={() => onLoadProgramInDashboard(null)}
                className="flex-1 h-9 px-3 rounded-lg bg-sky-500 hover:bg-sky-400 text-[#05101F] text-xs font-semibold transition-colors flex items-center justify-center gap-1.5 whitespace-nowrap"
              >
                <Play className="w-3.5 h-3.5" />
                Avvia Sessione Libera
              </button>
            </div>
          </article>
        )}

        {filteredPrograms.map((program) => {
          const totalSec = getProgramTotalDuration(program);
          const avgW = Math.round(
            program.blocks.reduce((sum, b) => sum + b.targetPowerWatts * b.durationSec, 0) /
              Math.max(1, totalSec)
          );
          const estKcal = Math.round((avgW * totalSec) / 1000);
          const isActive = activeProgramId === program.id;

          return (
            <article
              key={program.id}
              className={`rounded-xl bg-[#0C1A2E] border p-5 flex flex-col justify-between transition-colors ${
                isActive ? 'border-sky-400/70' : 'border-[#1B3252]'
              }`}
            >
              <div>
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="text-xs text-[#94ACC8] flex items-center gap-2">
                      <span className="text-sky-400 font-medium">{program.category}</span>
                      <span aria-hidden="true">·</span>
                      <span className="font-mono-tabular">{formatDuration(totalSec)}</span>
                      <span aria-hidden="true">·</span>
                      <span>{program.blocks.length} blocchi</span>
                    </div>
                    <h3 className="mt-1 font-display text-base font-semibold text-[#E8F0FA]">
                      {program.name}
                    </h3>
                  </div>
                  {isActive && (
                    <span className="text-xs font-medium text-emerald-400 shrink-0">Attivo</span>
                  )}
                </div>

                <p className="mt-2 text-xs text-[#94ACC8] leading-relaxed">{program.description}</p>

                {/* Mini Intensity Profile */}
                <div className="mt-4 h-12 flex items-end gap-1">
                  {program.blocks.map((block) => {
                    const widthPct = (block.durationSec / Math.max(1, totalSec)) * 100;
                    const heightPct = Math.max(
                      22,
                      Math.min(100, (block.targetPowerWatts / 310) * 100)
                    );
                    const meta = PHASE_META[block.phase] || PHASE_META.endurance;
                    return (
                      <div
                        key={block.id}
                        style={{ width: `${widthPct}%`, height: `${heightPct}%` }}
                        title={`${block.label} · ${block.targetPowerWatts}W`}
                        className={`rounded-t-xs ${meta.bgBar} opacity-85`}
                      />
                    );
                  })}
                </div>

                <div className="mt-3 pt-3 border-t border-[#162944] flex items-center justify-between text-xs text-[#94ACC8] font-mono-tabular">
                  <span>Potenza media {avgW} W</span>
                  <span>Stima ~{estKcal} kcal</span>
                </div>
              </div>

              <div className="mt-5 flex items-center justify-between gap-2">
                <button
                  type="button"
                  onClick={() => onLoadProgramInDashboard(program.id)}
                  className="flex-1 h-9 px-3 rounded-lg bg-sky-500 hover:bg-sky-400 text-[#05101F] text-xs font-semibold transition-colors flex items-center justify-center gap-1.5 whitespace-nowrap"
                >
                  <Play className="w-3.5 h-3.5" />
                  Avvia in Dashboard
                </button>
                <button
                  type="button"
                  onClick={() => setEditingDraft(structuredClone(program))}
                  aria-label={`Modifica ${program.name}`}
                  className="h-9 px-2.5 rounded-lg bg-[#12243F] hover:bg-[#193053] border border-[#233F66] text-[#C3D5EA]"
                >
                  <Edit3 className="w-3.5 h-3.5" />
                </button>
                <button
                  type="button"
                  onClick={() => handleDuplicate(program)}
                  aria-label={`Duplica ${program.name}`}
                  className="h-9 px-2.5 rounded-lg bg-[#12243F] hover:bg-[#193053] border border-[#233F66] text-[#C3D5EA]"
                >
                  <Copy className="w-3.5 h-3.5" />
                </button>
                <button
                  type="button"
                  onClick={() => onDeleteProgram(program.id)}
                  aria-label={`Elimina ${program.name}`}
                  className="h-9 px-2.5 rounded-lg bg-[#12243F] hover:bg-rose-950/60 border border-[#233F66] hover:border-rose-500/40 text-[#94ACC8] hover:text-rose-300"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            </article>
          );
        })}
      </div>

      {/* Weekly Training Plan */}
      <section className="rounded-xl bg-[#0C1A2E] border border-[#1B3252] p-5">
        <div className="flex items-center gap-2.5 mb-4">
          <Calendar className="w-4 h-4 text-sky-400" />
          <div>
            <h2 className="font-display text-base font-semibold text-[#E8F0FA]">
              Calendario Settimanale Allenamenti
            </h2>
            <p className="text-xs text-[#94ACC8]">
              Assegna un programma a ciascun giorno della settimana per pianificare il carico di lavoro.
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-7 gap-3">
          {WEEKDAY_LABELS.map((day) => {
            const assignedId = weeklySchedule[day.key] || '';
            const isFreeDay = assignedId === '__free__';
            const assignedProg = isFreeDay
              ? null
              : programs.find((p) => p.id === assignedId) || null;
            return (
              <div
                key={day.key}
                className="rounded-lg bg-[#081322] border border-[#1B3252] p-3 flex flex-col justify-between gap-2.5"
              >
                <div className="flex items-center justify-between text-xs">
                  <span className="font-semibold text-[#E8F0FA]">{day.full}</span>
                  {assignedProg && (
                    <span className="font-mono-tabular text-[#7E99B8]">
                      {Math.round(getProgramTotalDuration(assignedProg) / 60)}m
                    </span>
                  )}
                  {isFreeDay && <span className="text-emerald-400">Libera</span>}
                </div>
                <select
                  aria-label={`Programma per ${day.full}`}
                  value={assignedId}
                  onChange={(e) => handleScheduleChange(day.key, e.target.value)}
                  className="w-full h-8 rounded bg-[#0C1A2E] border border-[#233F66] px-2 text-xs text-[#E8F0FA] focus:outline-none focus:border-sky-400"
                >
                  <option value="">Riposo</option>
                  <option value="__free__">Sessione Libera</option>
                  {programs.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name}
                    </option>
                  ))}
                </select>
                {isFreeDay ? (
                  <button
                    type="button"
                    onClick={() => onLoadProgramInDashboard(null)}
                    className="text-left text-xs text-sky-400 hover:text-sky-300 font-medium truncate"
                  >
                    Apri sessione libera →
                  </button>
                ) : assignedProg ? (
                  <button
                    type="button"
                    onClick={() => onLoadProgramInDashboard(assignedProg.id)}
                    className="text-left text-xs text-sky-400 hover:text-sky-300 font-medium truncate"
                  >
                    Carica sessione →
                  </button>
                ) : (
                  <span className="text-xs text-[#526D8E]">Giorno di recupero</span>
                )}
              </div>
            );
          })}
        </div>
      </section>
    </div>
  );
};
