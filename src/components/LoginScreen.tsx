import React, { useState } from 'react';
import { Bike, Delete, Eye, EyeOff, Lock, ShieldCheck } from 'lucide-react';
import { loginWithPin } from '../services/authService';

interface LoginScreenProps {
  onSuccess: () => void;
}

export const LoginScreen: React.FC<LoginScreenProps> = ({ onSuccess }) => {
  const [pin, setPin] = useState('');
  const [showPin, setShowPin] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e?: React.FormEvent) => {
    e?.preventDefault();
    if (!pin.trim() || isSubmitting) return;
    setIsSubmitting(true);
    setError(null);

    const res = await loginWithPin(pin);
    setIsSubmitting(false);

    if (res.ok) {
      setPin('');
      onSuccess();
    } else {
      setError(res.error || 'Password non corretta.');
      setPin('');
    }
  };

  const appendDigit = (digit: string) => {
    if (pin.length >= 12) return;
    setError(null);
    setPin((prev) => prev + digit);
  };

  const removeLastDigit = () => {
    setError(null);
    setPin((prev) => prev.slice(0, -1));
  };

  return (
    <div className="min-h-dvh bg-[#07111F] text-[#E8F0FA] flex items-center justify-center p-3 sm:p-6 overflow-y-auto">
      <div className="w-full max-w-4xl grid grid-cols-1 lg:grid-cols-12 border border-[#1B3252] rounded-xl bg-[#0C1A2E] overflow-hidden">
        {/* Left Brand & Overview Panel */}
        <div className="lg:col-span-6 p-8 sm:p-10 flex flex-col justify-between bg-[#091526] border-b lg:border-b-0 lg:border-r border-[#1B3252]">
          <div>
            <div className="flex items-center gap-3 mb-8">
              <div className="w-10 h-10 rounded-lg bg-[#122642] border border-[#24426B] flex items-center justify-center text-sky-400">
                <Bike className="w-5 h-5" />
              </div>
              <span className="font-display text-xl font-bold tracking-tight text-[#E8F0FA]">
                Bikeaware
              </span>
            </div>

            <h1 className="font-display text-2xl sm:text-3xl font-semibold tracking-tight text-[#E8F0FA] leading-snug">
              Telemetria personale per la tua cyclette Bluetooth.
            </h1>
            <p className="mt-4 text-sm text-[#94ACC8] leading-relaxed">
              Monitora potenza, cadenza, velocità e frequenza cardiaca in tempo reale, gestisci programmi a intervalli ed esporta i tuoi report in PDF o su Google Sheets.
            </p>
          </div>

          <div className="mt-10 pt-6 border-t border-[#1B3252] space-y-3 text-xs text-[#94ACC8]">
            <div className="flex items-center justify-between">
              <span>Connessione sensori</span>
              <span className="font-mono-tabular text-[#E8F0FA]">Web Bluetooth FTMS · CSC · HR</span>
            </div>
            <div className="flex items-center justify-between">
              <span>Archivio cloud</span>
              <span className="font-mono-tabular text-[#E8F0FA]">Google Sheets Personale</span>
            </div>
            <div className="flex items-center justify-between">
              <span>Esportazione & Sync</span>
              <span className="font-mono-tabular text-[#E8F0FA]">PDF · Strava · Google Fit</span>
            </div>
          </div>
        </div>

        {/* Right Security PIN Form */}
        <div className="lg:col-span-6 p-8 sm:p-10 flex flex-col justify-center">
          <div className="flex items-center gap-2.5 text-sky-400 mb-2">
            <Lock className="w-4 h-4" />
            <span className="text-xs font-medium tracking-wide text-[#94ACC8]">
              Accesso Protetto
            </span>
          </div>
          <h2 className="font-display text-xl font-semibold text-[#E8F0FA]">
            Sblocca la dashboard
          </h2>
          <p className="mt-1 text-sm text-[#94ACC8]">
            Inserisci la password personale per accedere ai tuoi dati di allenamento.
          </p>

          <form onSubmit={handleSubmit} className="mt-6 space-y-5">
            <div>
              <label
                htmlFor="pin-input"
                className="block text-xs font-medium text-[#94ACC8] mb-2"
              >
                Password di accesso
              </label>
              <div className="relative">
                <input
                  id="pin-input"
                  type={showPin ? 'text' : 'password'}
                  inputMode="numeric"
                  autoComplete="current-password"
                  autoFocus
                  value={pin}
                  onChange={(e) => {
                    setError(null);
                    setPin(e.target.value);
                  }}
                  placeholder="Inserisci codice di accesso"
                  className="w-full h-12 rounded-lg bg-[#07111F] border border-[#233F66] px-4 pr-12 text-base font-mono-tabular tracking-[0.22em] text-[#E8F0FA] placeholder:tracking-normal placeholder:font-sans placeholder:text-[#526D8E] focus:outline-none focus:border-sky-400 focus:ring-1 focus:ring-sky-400/50 transition-colors"
                />
                <button
                  type="button"
                  onClick={() => setShowPin((prev) => !prev)}
                  aria-label={showPin ? 'Nascondi password' : 'Mostra password'}
                  className="absolute right-2 top-1/2 -translate-y-1/2 p-2 text-[#7E99B8] hover:text-[#E8F0FA] transition-colors"
                >
                  {showPin ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>

              {/* 6-dot progress indicator */}
              <div className="mt-3 flex items-center gap-2" aria-hidden="true">
                {Array.from({ length: 6 }).map((_, idx) => (
                  <div
                    key={idx}
                    className={`h-1.5 flex-1 rounded-full transition-colors ${
                      idx < pin.length ? 'bg-sky-400' : 'bg-[#172B47]'
                    }`}
                  />
                ))}
              </div>
            </div>

            {error && (
              <div
                role="alert"
                className="px-3.5 py-2.5 rounded-lg bg-rose-950/50 border border-rose-500/40 text-xs text-rose-200"
              >
                {error}
              </div>
            )}

            {/* Compact Touch-Friendly Numeric Keypad */}
            <div className="grid grid-cols-3 gap-2">
              {['1', '2', '3', '4', '5', '6', '7', '8', '9'].map((num) => (
                <button
                  key={num}
                  type="button"
                  onClick={() => appendDigit(num)}
                  className="h-11 rounded-lg bg-[#11223A] hover:bg-[#172E4E] active:bg-[#1E3B63] border border-[#1E375A] font-mono-tabular text-base font-medium text-[#E8F0FA] transition-colors focus-visible:outline-2 focus-visible:outline-sky-400"
                >
                  {num}
                </button>
              ))}
              <button
                type="button"
                onClick={() => {
                  setPin('');
                  setError(null);
                }}
                className="h-11 rounded-lg bg-[#0D1C32] hover:bg-[#142847] border border-[#1B3252] text-xs font-medium text-[#94ACC8] hover:text-[#E8F0FA] transition-colors"
              >
                Pulisci
              </button>
              <button
                type="button"
                onClick={() => appendDigit('0')}
                className="h-11 rounded-lg bg-[#11223A] hover:bg-[#172E4E] active:bg-[#1E3B63] border border-[#1E375A] font-mono-tabular text-base font-medium text-[#E8F0FA] transition-colors"
              >
                0
              </button>
              <button
                type="button"
                onClick={removeLastDigit}
                aria-label="Cancella ultima cifra"
                className="h-11 rounded-lg bg-[#0D1C32] hover:bg-[#142847] border border-[#1B3252] flex items-center justify-center text-[#94ACC8] hover:text-[#E8F0FA] transition-colors"
              >
                <Delete className="w-4 h-4" />
              </button>
            </div>

            <button
              type="submit"
              disabled={isSubmitting || pin.length === 0}
              className="w-full h-11 rounded-lg bg-sky-500 hover:bg-sky-400 disabled:opacity-45 disabled:hover:bg-sky-500 text-[#05101F] font-semibold text-sm transition-colors flex items-center justify-center gap-2 whitespace-nowrap"
            >
              <ShieldCheck className="w-4 h-4" />
              {isSubmitting ? 'Verifica in corso...' : 'Accedi a Bikeaware'}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
};
