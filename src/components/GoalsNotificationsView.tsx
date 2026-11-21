import React, { useState } from 'react';
import { Bell, BellRing, Check, Save, Target, Volume2 } from 'lucide-react';
import { WEEKDAY_LABELS } from '../data/defaultData';
import {
  getNotificationPermission,
  requestNotificationPermission,
  type PushPermissionState,
} from '../services/notificationsService';
import type { DailyGoalsConfig, GoalNotificationLog, WeekdayKey } from '../types/bike';

interface GoalsNotificationsViewProps {
  goals: DailyGoalsConfig;
  notificationLogs: GoalNotificationLog[];
  onSaveGoals: (nextGoals: DailyGoalsConfig) => void;
  onSendTestNotification: () => void;
  onClearLogs: () => void;
}

export const GoalsNotificationsView: React.FC<GoalsNotificationsViewProps> = ({
  goals,
  notificationLogs,
  onSaveGoals,
  onSendTestNotification,
  onClearLogs,
}) => {
  const [draft, setDraft] = useState<DailyGoalsConfig>(goals);
  const [permission, setPermission] = useState<PushPermissionState>(getNotificationPermission());
  const [savedFeedback, setSavedFeedback] = useState(false);

  const toggleDay = (day: WeekdayKey) => {
    setDraft((prev) => {
      const exists = prev.reminderDays.includes(day);
      return {
        ...prev,
        reminderDays: exists
          ? prev.reminderDays.filter((d) => d !== day)
          : [...prev.reminderDays, day],
      };
    });
  };

  const handleRequestPermission = async () => {
    const result = await requestNotificationPermission();
    setPermission(result);
    if (result === 'granted') {
      setDraft((prev) => ({ ...prev, notificationsEnabled: true }));
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSaveGoals(draft);
    setSavedFeedback(true);
    window.setTimeout(() => setSavedFeedback(false), 2200);
  };

  const permissionLabel =
    permission === 'granted'
      ? 'Autorizzate dal browser'
      : permission === 'denied'
      ? 'Bloccate dal browser (attivi gli avvisi in-app)'
      : permission === 'unsupported'
      ? 'API Push non supportata (attivi gli avvisi in-app)'
      : 'In attesa di autorizzazione';

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-xl font-semibold text-[#E8F0FA]">
          Obiettivi Quotidiani e Notifiche Push
        </h1>
        <p className="text-sm text-[#94ACC8]">
          Definisci i traguardi giornalieri e ricevi notifiche push per mantenere costante il ritmo di allenamento.
        </p>
      </div>

      <form onSubmit={handleSubmit} className="grid grid-cols-1 xl:grid-cols-12 gap-6 items-start">
        {/* Daily Targets & Physiological Zones */}
        <section className="xl:col-span-7 rounded-xl bg-[#0C1A2E] border border-[#1B3252] p-6 space-y-5">
          <div className="flex items-center gap-2.5 pb-4 border-b border-[#1B3252]">
            <Target className="w-4 h-4 text-sky-400" />
            <div>
              <h2 className="font-display text-base font-semibold text-[#E8F0FA]">
                Traguardi Giornalieri e Soglie Fisiologiche
              </h2>
              <p className="text-xs text-[#94ACC8]">
                Usati nella dashboard per calcolare l'avanzamento quotidiano e le zone di potenza.
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <label className="block text-xs text-[#94ACC8] mb-1.5">
                Obiettivo durata (min/giorno)
              </label>
              <input
                type="number"
                min={10}
                max={240}
                value={draft.targetMinutes}
                onChange={(e) =>
                  setDraft({ ...draft, targetMinutes: Math.max(10, Number(e.target.value) || 30) })
                }
                className="w-full h-10 rounded-lg bg-[#07111F] border border-[#233F66] px-3 font-mono-tabular text-sm text-[#E8F0FA] focus:outline-none focus:border-sky-400"
              />
            </div>

            <div>
              <label className="block text-xs text-[#94ACC8] mb-1.5">
                Obiettivo distanza (km/giorno)
              </label>
              <input
                type="number"
                min={2}
                max={150}
                step={1}
                value={draft.targetDistanceKm}
                onChange={(e) =>
                  setDraft({
                    ...draft,
                    targetDistanceKm: Math.max(2, Number(e.target.value) || 15),
                  })
                }
                className="w-full h-10 rounded-lg bg-[#07111F] border border-[#233F66] px-3 font-mono-tabular text-sm text-[#E8F0FA] focus:outline-none focus:border-sky-400"
              />
            </div>

            <div>
              <label className="block text-xs text-[#94ACC8] mb-1.5">
                Obiettivo calorie (kcal/giorno)
              </label>
              <input
                type="number"
                min={50}
                max={3000}
                step={10}
                value={draft.targetCaloriesKcal}
                onChange={(e) =>
                  setDraft({
                    ...draft,
                    targetCaloriesKcal: Math.max(50, Number(e.target.value) || 350),
                  })
                }
                className="w-full h-10 rounded-lg bg-[#07111F] border border-[#233F66] px-3 font-mono-tabular text-sm text-[#E8F0FA] focus:outline-none focus:border-sky-400"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2 border-t border-[#162944]">
            <div>
              <label className="block text-xs text-[#94ACC8] mb-1.5">
                FTP personale — Potenza di soglia (Watt)
              </label>
              <input
                type="number"
                min={80}
                max={450}
                value={draft.ftpWatts}
                onChange={(e) =>
                  setDraft({ ...draft, ftpWatts: Math.max(80, Number(e.target.value) || 200) })
                }
                className="w-full h-10 rounded-lg bg-[#07111F] border border-[#233F66] px-3 font-mono-tabular text-sm text-[#E8F0FA] focus:outline-none focus:border-sky-400"
              />
            </div>
            <div>
              <label className="block text-xs text-[#94ACC8] mb-1.5">
                Frequenza cardiaca massima (BPM)
              </label>
              <input
                type="number"
                min={120}
                max={220}
                value={draft.maxHeartRateBpm}
                onChange={(e) =>
                  setDraft({
                    ...draft,
                    maxHeartRateBpm: Math.max(120, Number(e.target.value) || 180),
                  })
                }
                className="w-full h-10 rounded-lg bg-[#07111F] border border-[#233F66] px-3 font-mono-tabular text-sm text-[#E8F0FA] focus:outline-none focus:border-sky-400"
              />
            </div>
          </div>

          {/* Push Reminder Schedule */}
          <div className="pt-4 border-t border-[#162944] space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <h3 className="text-sm font-semibold text-[#E8F0FA]">
                  Promemoria Quotidiano e Avvisi Traguardo
                </h3>
                <p className="text-xs text-[#94ACC8]">
                  Stato notifiche: <span className="text-[#E8F0FA]">{permissionLabel}</span>
                </p>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                {permission !== 'granted' && permission !== 'unsupported' && (
                  <button
                    type="button"
                    onClick={handleRequestPermission}
                    className="px-3.5 py-2 rounded-lg bg-[#12243F] hover:bg-[#193053] border border-sky-500/40 text-sky-300 text-xs font-medium flex items-center gap-1.5 whitespace-nowrap"
                  >
                    <Bell className="w-3.5 h-3.5" />
                    Attiva Notifiche Push
                  </button>
                )}
                <button
                  type="button"
                  onClick={onSendTestNotification}
                  className="px-3.5 py-2 rounded-lg bg-[#12243F] hover:bg-[#193053] border border-[#233F66] text-[#E8F0FA] text-xs font-medium flex items-center gap-1.5 whitespace-nowrap"
                >
                  <BellRing className="w-3.5 h-3.5 text-sky-400" />
                  Invia Notifica di Test
                </button>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-12 gap-4 items-end">
              <div className="sm:col-span-4">
                <label className="block text-xs text-[#94ACC8] mb-1.5">
                  Orario promemoria quotidiano
                </label>
                <input
                  type="time"
                  value={draft.reminderTime}
                  onChange={(e) => setDraft({ ...draft, reminderTime: e.target.value })}
                  className="w-full h-10 rounded-lg bg-[#07111F] border border-[#233F66] px-3 font-mono-tabular text-sm text-[#E8F0FA] focus:outline-none focus:border-sky-400"
                />
              </div>

              <div className="sm:col-span-8">
                <span className="block text-xs text-[#94ACC8] mb-1.5">Giorni attivi</span>
                <div className="flex flex-wrap gap-1.5">
                  {WEEKDAY_LABELS.map((d) => {
                    const active = draft.reminderDays.includes(d.key);
                    return (
                      <button
                        key={d.key}
                        type="button"
                        onClick={() => toggleDay(d.key)}
                        className={`h-10 px-3 rounded-lg border text-xs font-medium transition-colors ${
                          active
                            ? 'bg-[#173054] border-sky-400/60 text-sky-200'
                            : 'bg-[#07111F] border-[#1B3252] text-[#647E9E] hover:text-[#C3D5EA]'
                        }`}
                      >
                        {d.short}
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>

            <div className="space-y-2.5 pt-2">
              {[
                {
                  key: 'notificationsEnabled' as const,
                  label: 'Abilita notifiche push per il promemoria quotidiano se l\'obiettivo non è raggiunto',
                },
                {
                  key: 'notifyAt50Percent' as const,
                  label: 'Notifica intermedia al raggiungimento del 50% dell\'obiettivo giornaliero',
                },
                {
                  key: 'notifyAt100Percent' as const,
                  label: 'Notifica di completamento al 100% di durata, distanza o calorie',
                },
                {
                  key: 'notifyOnIntervalChange' as const,
                  label: 'Avvisa al cambio di intervallo durante un programma guidato',
                },
                {
                  key: 'soundCueEnabled' as const,
                  label: 'Segnale acustico delicato al cambio fase o raggiungimento traguardo',
                },
              ].map((item) => (
                <label
                  key={item.key}
                  className="flex items-center gap-3 text-xs text-[#C3D5EA] cursor-pointer select-none"
                >
                  <input
                    type="checkbox"
                    checked={draft[item.key]}
                    onChange={(e) => setDraft({ ...draft, [item.key]: e.target.checked })}
                    className="w-4 h-4 rounded border-[#233F66] bg-[#07111F] accent-sky-400"
                  />
                  <span className="flex items-center gap-1.5">
                    {item.key === 'soundCueEnabled' && (
                      <Volume2 className="w-3.5 h-3.5 text-sky-400" />
                    )}
                    {item.label}
                  </span>
                </label>
              ))}
            </div>
          </div>

          <div className="pt-3 flex items-center justify-end gap-3">
            {savedFeedback && (
              <span className="text-xs text-emerald-400 flex items-center gap-1">
                <Check className="w-3.5 h-3.5" /> Preferenze salvate
              </span>
            )}
            <button
              type="submit"
              className="px-4 py-2.5 rounded-lg bg-sky-500 hover:bg-sky-400 text-[#05101F] text-xs font-semibold flex items-center gap-2"
            >
              <Save className="w-3.5 h-3.5" />
              Salva Obiettivi e Notifiche
            </button>
          </div>
        </section>

        {/* Recent Notifications Feed */}
        <section className="xl:col-span-5 rounded-xl bg-[#0C1A2E] border border-[#1B3252] p-6">
          <div className="flex items-center justify-between gap-2 pb-4 border-b border-[#1B3252]">
            <div>
              <h2 className="font-display text-base font-semibold text-[#E8F0FA]">
                Registro Notifiche Recenti
              </h2>
              <p className="text-xs text-[#94ACC8]">
                Avvisi generati da traguardi, promemoria e programmi guidati.
              </p>
            </div>
            {notificationLogs.length > 0 && (
              <button
                type="button"
                onClick={onClearLogs}
                className="text-xs text-[#7E99B8] hover:text-[#E8F0FA]"
              >
                Pulisci
              </button>
            )}
          </div>

          <div className="mt-4 space-y-3 max-h-[430px] overflow-y-auto pr-1">
            {notificationLogs.length === 0 ? (
              <div className="py-10 text-center text-xs text-[#647E9E]">
                Nessuna notifica ancora registrata. Usa <strong className="text-[#94ACC8]">Invia Notifica di Test</strong> per verificare il funzionamento.
              </div>
            ) : (
              notificationLogs.map((log) => (
                <div
                  key={log.id}
                  className="p-3.5 rounded-lg bg-[#081322] border border-[#172B47]"
                >
                  <div className="flex items-baseline justify-between gap-2">
                    <span className="text-xs font-semibold text-[#E8F0FA]">{log.title}</span>
                    <span className="font-mono-tabular text-[11px] text-[#647E9E] shrink-0">
                      {new Date(log.timestamp).toLocaleTimeString('it-IT', {
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </span>
                  </div>
                  <p className="mt-1 text-xs text-[#94ACC8] leading-relaxed">{log.body}</p>
                </div>
              ))
            )}
          </div>
        </section>
      </form>
    </div>
  );
};
