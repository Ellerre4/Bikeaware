import React, { useEffect, useState } from 'react';
import {
  CheckCircle2,
  Cloud,
  ExternalLink,
  FileSpreadsheet,
  KeyRound,
  Link2,
  LogOut,
  RefreshCw,
  Share2,
  Shield,
  UploadCloud,
} from 'lucide-react';
import type { User } from 'firebase/auth';
import { changeAppPin } from '../services/authService';
import {
  fetchStravaConfig,
  type StravaConfigInfo,
  type StravaStatusInfo,
} from '../services/integrationsService';
import type { FitnessIntegrationsConfig, SheetsConfig } from '../types/bike';
import { GoogleSignInButton } from './GoogleSignInButton';

interface SettingsIntegrationsViewProps {
  googleUser: User | null;
  googleTokenReady: boolean;
  isGoogleSigningIn: boolean;
  sheetsConfig: SheetsConfig | null;
  isSheetsBusy: boolean;
  stravaStatus: StravaStatusInfo;
  integrations: FitnessIntegrationsConfig;
  onGoogleSignIn: () => void;
  onGoogleSignOut: () => void;
  onCreateNewSpreadsheet: () => void;
  onLinkExistingSpreadsheet: (urlOrId: string) => void;
  onSyncToSheets: () => void;
  onLoadFromSheets: () => void;
  onToggleSheetsAutoSync: (enabled: boolean) => void;
  onDisconnectSpreadsheet: () => void;
  onConnectStrava: () => void;
  onDisconnectStrava: () => void;
  onUpdateIntegrations: (next: FitnessIntegrationsConfig) => void;
  onLockApp: () => void;
}

export const SettingsIntegrationsView: React.FC<SettingsIntegrationsViewProps> = ({
  googleUser,
  googleTokenReady,
  isGoogleSigningIn,
  sheetsConfig,
  isSheetsBusy,
  stravaStatus,
  integrations,
  onGoogleSignIn,
  onGoogleSignOut,
  onCreateNewSpreadsheet,
  onLinkExistingSpreadsheet,
  onSyncToSheets,
  onLoadFromSheets,
  onToggleSheetsAutoSync,
  onDisconnectSpreadsheet,
  onConnectStrava,
  onDisconnectStrava,
  onUpdateIntegrations,
  onLockApp,
}) => {
  const [sheetInput, setSheetInput] = useState(sheetsConfig?.spreadsheetId || '');
  const [stravaConfig, setStravaConfig] = useState<StravaConfigInfo | null>(null);
  const [currentPin, setCurrentPin] = useState('');
  const [newPin, setNewPin] = useState('');
  const [pinMsg, setPinMsg] = useState<{ type: 'ok' | 'err'; text: string } | null>(null);
  const [webhookInput, setWebhookInput] = useState(integrations.googleFitWebhookUrl);

  useEffect(() => {
    fetchStravaConfig().then(setStravaConfig);
  }, []);

  const handleLinkSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!sheetInput.trim()) return;
    onLinkExistingSpreadsheet(sheetInput.trim());
  };

  const handlePinChange = async (e: React.FormEvent) => {
    e.preventDefault();
    setPinMsg(null);
    const res = await changeAppPin(currentPin, newPin);
    if (res.ok) {
      setPinMsg({ type: 'ok', text: 'Password aggiornata per questa sessione.' });
      setCurrentPin('');
      setNewPin('');
    } else {
      setPinMsg({ type: 'err', text: res.error || 'Errore aggiornamento password.' });
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-xl font-semibold text-[#E8F0FA]">
          Database Google Sheets, Integrazioni Fitness e Sicurezza
        </h1>
        <p className="text-sm text-[#94ACC8]">
          Collega il tuo foglio Google Sheets come backend gratuito, attiva il salvataggio automatico su Strava o Google Fit e gestisci la sicurezza.
        </p>
      </div>

      {/* 1. Google Sheets Backend Database */}
      <section className="rounded-xl bg-[#0C1A2E] border border-[#1B3252] p-6 space-y-5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-[#1B3252]">
          <div className="flex items-start gap-3">
            <div className="w-9 h-9 rounded-lg bg-[#12243F] border border-[#233F66] flex items-center justify-center text-emerald-400 shrink-0">
              <FileSpreadsheet className="w-4 h-4" />
            </div>
            <div>
              <h2 className="font-display text-base font-semibold text-[#E8F0FA]">
                Google Sheets come Database Personale
              </h2>
              <p className="text-xs text-[#94ACC8]">
                Archivia gratuitamente cronologia allenamenti, programmi e obiettivi su un tuo foglio Google Sheets.
              </p>
            </div>
          </div>

          {googleUser && googleTokenReady ? (
            <div className="flex items-center gap-3 text-xs">
              <div className="text-right">
                <div className="font-medium text-[#E8F0FA]">
                  {googleUser.displayName || 'Account Google'}
                </div>
                <div className="text-[#7E99B8]">{googleUser.email}</div>
              </div>
              <button
                type="button"
                onClick={onGoogleSignOut}
                className="px-3 py-2 rounded-lg bg-[#12243F] hover:bg-[#193053] border border-[#233F66] text-[#C3D5EA] flex items-center gap-1.5 whitespace-nowrap"
              >
                <LogOut className="w-3.5 h-3.5" />
                Disconnetti
              </button>
            </div>
          ) : (
            <GoogleSignInButton
              onClick={onGoogleSignIn}
              disabled={isGoogleSigningIn}
              label={isGoogleSigningIn ? 'Accesso in corso...' : 'Sign in with Google'}
            />
          )}
        </div>

        {!googleTokenReady ? (
          <div className="rounded-lg bg-[#081322] border border-[#172B47] p-4 text-xs text-[#94ACC8] leading-relaxed">
            Accedi con il tuo account Google tramite il pulsante sopra per creare automaticamente il foglio <strong className="text-[#E8F0FA]">Bikeaware - Registro Allenamenti</strong> o collegare un foglio Google Sheets già esistente. Il token di accesso resta solo in memoria per la massima sicurezza.
          </div>
        ) : (
          <div className="space-y-5">
            {sheetsConfig ? (
              <div className="rounded-lg bg-[#081322] border border-emerald-500/30 p-4 flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                <div>
                  <div className="flex items-center gap-2 text-xs text-emerald-400 font-medium">
                    <CheckCircle2 className="w-4 h-4" />
                    <span>Foglio Google Sheets collegato</span>
                  </div>
                  <div className="mt-1 font-display text-sm font-semibold text-[#E8F0FA]">
                    {sheetsConfig.spreadsheetTitle}
                  </div>
                  <div className="mt-0.5 text-xs text-[#7E99B8] font-mono-tabular">
                    ID: {sheetsConfig.spreadsheetId}
                    {sheetsConfig.lastSyncIso
                      ? ` · Ultima sync: ${new Date(sheetsConfig.lastSyncIso).toLocaleString('it-IT')}`
                      : ' · Mai sincronizzato'}
                  </div>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    disabled={isSheetsBusy}
                    onClick={onSyncToSheets}
                    className="px-3.5 py-2 rounded-lg bg-sky-500 hover:bg-sky-400 disabled:opacity-50 text-[#05101F] text-xs font-semibold flex items-center gap-1.5 whitespace-nowrap"
                  >
                    <UploadCloud className="w-3.5 h-3.5" />
                    Sincronizza su Sheets
                  </button>
                  <button
                    type="button"
                    disabled={isSheetsBusy}
                    onClick={onLoadFromSheets}
                    className="px-3.5 py-2 rounded-lg bg-[#12243F] hover:bg-[#193053] disabled:opacity-50 border border-[#233F66] text-[#E8F0FA] text-xs font-medium flex items-center gap-1.5 whitespace-nowrap"
                  >
                    <RefreshCw className="w-3.5 h-3.5 text-sky-400" />
                    Carica da Sheets
                  </button>
                  <a
                    href={sheetsConfig.spreadsheetUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="px-3 py-2 rounded-lg bg-[#12243F] hover:bg-[#193053] border border-[#233F66] text-[#C3D5EA] text-xs font-medium flex items-center gap-1.5 whitespace-nowrap"
                  >
                    Apri Foglio
                    <ExternalLink className="w-3 h-3" />
                  </a>
                  <button
                    type="button"
                    onClick={onDisconnectSpreadsheet}
                    className="px-3 py-2 rounded-lg text-xs text-[#7E99B8] hover:text-rose-300"
                  >
                    Cambia foglio
                  </button>
                </div>
              </div>
            ) : (
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                <div className="rounded-lg bg-[#081322] border border-[#1B3252] p-4 flex flex-col justify-between gap-4">
                  <div>
                    <h3 className="text-sm font-semibold text-[#E8F0FA]">
                      Opzione 1 · Crea nuovo database automaticamente
                    </h3>
                    <p className="mt-1 text-xs text-[#94ACC8] leading-relaxed">
                      Crea un nuovo foglio Google Sheets nel tuo Drive già strutturato con le schede <span className="font-mono-tabular text-[#E8F0FA]">Allenamenti</span>, <span className="font-mono-tabular text-[#E8F0FA]">Programmi</span> e <span className="font-mono-tabular text-[#E8F0FA]">Obiettivi</span>.
                    </p>
                  </div>
                  <button
                    type="button"
                    disabled={isSheetsBusy}
                    onClick={onCreateNewSpreadsheet}
                    className="w-fit px-4 py-2 rounded-lg bg-sky-500 hover:bg-sky-400 disabled:opacity-50 text-[#05101F] text-xs font-semibold flex items-center gap-2 whitespace-nowrap"
                  >
                    <FileSpreadsheet className="w-3.5 h-3.5" />
                    {isSheetsBusy ? 'Creazione...' : 'Crea foglio Bikeaware'}
                  </button>
                </div>

                <form
                  onSubmit={handleLinkSubmit}
                  className="rounded-lg bg-[#081322] border border-[#1B3252] p-4 flex flex-col justify-between gap-4"
                >
                  <div>
                    <h3 className="text-sm font-semibold text-[#E8F0FA]">
                      Opzione 2 · Collega un foglio esistente
                    </h3>
                    <p className="mt-1 text-xs text-[#94ACC8]">
                      Incolla l'URL o l'ID di un tuo foglio Google Sheets per rilevarne automaticamente le schede.
                    </p>
                    <input
                      type="text"
                      value={sheetInput}
                      onChange={(e) => setSheetInput(e.target.value)}
                      placeholder="https://docs.google.com/spreadsheets/d/..."
                      className="mt-3 w-full h-9 rounded-lg bg-[#0C1A2E] border border-[#233F66] px-3 text-xs text-[#E8F0FA] placeholder:text-[#526D8E] focus:outline-none focus:border-sky-400"
                    />
                  </div>
                  <button
                    type="submit"
                    disabled={isSheetsBusy || !sheetInput.trim()}
                    className="w-fit px-4 py-2 rounded-lg bg-[#12243F] hover:bg-[#193053] disabled:opacity-40 border border-[#233F66] text-[#E8F0FA] text-xs font-medium flex items-center gap-2 whitespace-nowrap"
                  >
                    <Link2 className="w-3.5 h-3.5 text-sky-400" />
                    Collega Foglio
                  </button>
                </form>
              </div>
            )}

            {sheetsConfig && (
              <label className="flex items-center gap-3 text-xs text-[#C3D5EA] cursor-pointer">
                <input
                  type="checkbox"
                  checked={sheetsConfig.autoSyncOnSave}
                  onChange={(e) => onToggleSheetsAutoSync(e.target.checked)}
                  className="w-4 h-4 rounded border-[#233F66] bg-[#07111F] accent-sky-400"
                />
                <span>
                  Proponi il salvataggio immediato su Google Sheets al termine di ogni allenamento (sempre con finestra di conferma).
                </span>
              </label>
            )}
          </div>
        )}
      </section>

      {/* 2. Strava & Google Fit Auto-Sync */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Strava */}
        <section className="rounded-xl bg-[#0C1A2E] border border-[#1B3252] p-6 space-y-4">
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-start gap-3">
              <div className="w-9 h-9 rounded-lg bg-[#12243F] border border-[#233F66] flex items-center justify-center text-amber-400 shrink-0">
                <Share2 className="w-4 h-4" />
              </div>
              <div>
                <h2 className="font-display text-base font-semibold text-[#E8F0FA]">
                  Integrazione Strava
                </h2>
                <p className="text-xs text-[#94ACC8]">
                  Caricamento automatico delle sessioni VirtualRide su Strava API v3.
                </p>
              </div>
            </div>
            <span
              className={`text-xs font-medium ${
                stravaStatus.connected ? 'text-emerald-400' : 'text-[#7E99B8]'
              }`}
            >
              {stravaStatus.connected ? `Connesso · ${stravaStatus.athleteName}` : 'Non connesso'}
            </span>
          </div>

          <div className="flex flex-wrap items-center gap-2.5">
            {stravaStatus.connected ? (
              <button
                type="button"
                onClick={onDisconnectStrava}
                className="px-4 py-2 rounded-lg bg-[#12243F] hover:bg-rose-950/50 border border-[#233F66] text-xs font-medium text-[#E8F0FA]"
              >
                Disconnetti Strava
              </button>
            ) : (
              <button
                type="button"
                onClick={onConnectStrava}
                disabled={stravaConfig !== null && !stravaConfig.configured}
                className="px-4 py-2 rounded-lg bg-amber-500 hover:bg-amber-400 disabled:opacity-45 text-[#05101F] text-xs font-semibold whitespace-nowrap"
              >
                Collega Account Strava
              </button>
            )}
          </div>

          <label className="flex items-center gap-3 text-xs text-[#C3D5EA] cursor-pointer">
            <input
              type="checkbox"
              checked={integrations.stravaAutoSync}
              onChange={(e) =>
                onUpdateIntegrations({ ...integrations, stravaAutoSync: e.target.checked })
              }
              className="w-4 h-4 rounded border-[#233F66] bg-[#07111F] accent-sky-400"
            />
            <span>Carica automaticamente su Strava al salvataggio di ogni sessione</span>
          </label>

          <div className="pt-3 border-t border-[#162944] text-xs text-[#7E99B8] space-y-1">
            {stravaConfig && !stravaConfig.configured ? (
              <p>
                Per abilitare l'invio diretto API, imposta <code className="text-[#C3D5EA]">STRAVA_CLIENT_ID</code> e <code className="text-[#C3D5EA]">STRAVA_CLIENT_SECRET</code> nei segreti ambiente. Su GitHub Pages puoi sempre esportare in formato <strong className="text-[#E8F0FA]">.TCX</strong>.
              </p>
            ) : (
              <p>
                Callback URL configurata: <code className="text-[#C3D5EA] break-all">{stravaConfig?.redirectUri || '/auth/strava/callback'}</code>
              </p>
            )}
          </div>
        </section>

        {/* Google Fit / Health Connect */}
        <section className="rounded-xl bg-[#0C1A2E] border border-[#1B3252] p-6 space-y-4">
          <div className="flex items-start gap-3">
            <div className="w-9 h-9 rounded-lg bg-[#12243F] border border-[#233F66] flex items-center justify-center text-sky-400 shrink-0">
              <Cloud className="w-4 h-4" />
            </div>
            <div>
              <h2 className="font-display text-base font-semibold text-[#E8F0FA]">
                Integrazione Google Fit / Health Connect
              </h2>
              <p className="text-xs text-[#94ACC8]">
                Esporta automaticamente pacchetti .TCX compatibili o invia i riepiloghi a un tuo endpoint Apps Script / Health Connect bridge.
              </p>
            </div>
          </div>

          <label className="flex items-center gap-3 text-xs text-[#C3D5EA] cursor-pointer">
            <input
              type="checkbox"
              checked={integrations.googleFitAutoExportTcx}
              onChange={(e) =>
                onUpdateIntegrations({
                  ...integrations,
                  googleFitAutoExportTcx: e.target.checked,
                })
              }
              className="w-4 h-4 rounded border-[#233F66] bg-[#07111F] accent-sky-400"
            />
            <span>Genera e scarica automaticamente il file .TCX al termine di ogni allenamento</span>
          </label>

          <div>
            <label className="block text-xs text-[#94ACC8] mb-1.5">
              URL Webhook personale Google Apps Script / Bridge (opzionale, HTTPS)
            </label>
            <div className="flex gap-2">
              <input
                type="url"
                value={webhookInput}
                onChange={(e) => setWebhookInput(e.target.value)}
                placeholder="https://script.google.com/macros/s/.../exec"
                className="flex-1 h-9 rounded-lg bg-[#07111F] border border-[#233F66] px-3 text-xs text-[#E8F0FA] placeholder:text-[#526D8E] focus:outline-none focus:border-sky-400"
              />
              <button
                type="button"
                onClick={() =>
                  onUpdateIntegrations({
                    ...integrations,
                    googleFitWebhookUrl: webhookInput.trim(),
                  })
                }
                className="px-3.5 h-9 rounded-lg bg-[#12243F] hover:bg-[#193053] border border-[#233F66] text-xs font-medium text-[#E8F0FA]"
              >
                Salva
              </button>
            </div>
          </div>
        </section>
      </div>

      {/* 3. Security & GitHub Pages Hosting */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <section className="rounded-xl bg-[#0C1A2E] border border-[#1B3252] p-6 space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <KeyRound className="w-4 h-4 text-sky-400" />
              <h2 className="font-display text-base font-semibold text-[#E8F0FA]">
                Sicurezza e Password di Accesso
              </h2>
            </div>
            <button
              type="button"
              onClick={onLockApp}
              className="px-3 py-1.5 rounded-lg bg-[#12243F] hover:bg-[#193053] border border-[#233F66] text-xs font-medium text-[#E8F0FA]"
            >
              Blocca Sessione Ora
            </button>
          </div>

          <form onSubmit={handlePinChange} className="space-y-3">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs text-[#94ACC8] mb-1">Password attuale</label>
                <input
                  type="password"
                  value={currentPin}
                  onChange={(e) => setCurrentPin(e.target.value)}
                  required
                  className="w-full h-9 rounded-lg bg-[#07111F] border border-[#233F66] px-3 text-xs font-mono-tabular text-[#E8F0FA]"
                />
              </div>
              <div>
                <label className="block text-xs text-[#94ACC8] mb-1">Nuova password (6–20 car.)</label>
                <input
                  type="password"
                  value={newPin}
                  onChange={(e) => setNewPin(e.target.value)}
                  required
                  minLength={6}
                  className="w-full h-9 rounded-lg bg-[#07111F] border border-[#233F66] px-3 text-xs font-mono-tabular text-[#E8F0FA]"
                />
              </div>
            </div>
            {pinMsg && (
              <p
                className={`text-xs ${
                  pinMsg.type === 'ok' ? 'text-emerald-400' : 'text-rose-300'
                }`}
              >
                {pinMsg.text}
              </p>
            )}
            <button
              type="submit"
              className="px-4 py-2 rounded-lg bg-[#12243F] hover:bg-[#193053] border border-[#233F66] text-xs font-medium text-[#E8F0FA]"
            >
              Aggiorna Password
            </button>
          </form>
        </section>

        <section className="rounded-xl bg-[#0C1A2E] border border-[#1B3252] p-6 space-y-3">
          <div className="flex items-center gap-2.5">
            <Shield className="w-4 h-4 text-sky-400" />
            <h2 className="font-display text-base font-semibold text-[#E8F0FA]">
              Pronta per GitHub Pages
            </h2>
          </div>
          <p className="text-xs text-[#94ACC8] leading-relaxed">
            Bikeaware è configurata con percorsi relativi (<code className="text-[#E8F0FA]">base: './'</code>) e navigazione lato client per funzionare senza server su GitHub Pages.
          </p>
          <ul className="space-y-1.5 text-xs text-[#94ACC8]">
            <li>· Esegui <code className="text-[#E8F0FA]">npm run build</code> e pubblica la cartella <code className="text-[#E8F0FA]">dist/</code> su GitHub Pages (HTTPS obbligatorio per Web Bluetooth).</li>
            <li>· Aggiungi il dominio <code className="text-[#E8F0FA]">*.github.io</code> ai domini autorizzati in Firebase Auth per collegare Google Sheets al primo accesso.</li>
            <li>· I token OAuth e la sessione rimangono solo in memoria RAM, mai in <code className="text-[#E8F0FA]">localStorage</code>.</li>
          </ul>
        </section>
      </div>
    </div>
  );
};
