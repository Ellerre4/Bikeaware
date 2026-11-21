import React, { useState } from 'react';
import { AlertTriangle, CheckCircle2, X } from 'lucide-react';
import type { ConfirmDialogRequest } from '../types/bike';

interface ConfirmModalProps {
  request: ConfirmDialogRequest | null;
  onClose: () => void;
}

export const ConfirmModal: React.FC<ConfirmModalProps> = ({ request, onClose }) => {
  const [isBusy, setIsBusy] = useState(false);

  if (!request) return null;

  const handleConfirm = async () => {
    setIsBusy(true);
    try {
      await request.onConfirm();
      onClose();
    } finally {
      setIsBusy(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 bg-[#030914]/80 backdrop-blur-xs flex items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="confirm-modal-title"
    >
      <div className="w-full max-w-md rounded-xl bg-[#0C1A2E] border border-[#233F66] p-6 shadow-2xl">
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-start gap-3">
            <div
              className={`w-9 h-9 rounded-lg flex items-center justify-center shrink-0 ${
                request.destructive
                  ? 'bg-rose-950/60 text-rose-400 border border-rose-500/30'
                  : 'bg-sky-950/60 text-sky-400 border border-sky-500/30'
              }`}
            >
              {request.destructive ? (
                <AlertTriangle className="w-4 h-4" />
              ) : (
                <CheckCircle2 className="w-4 h-4" />
              )}
            </div>
            <div>
              <h3
                id="confirm-modal-title"
                className="font-display text-base font-semibold text-[#E8F0FA]"
              >
                {request.title}
              </h3>
              <p className="mt-1.5 text-sm text-[#94ACC8] leading-relaxed">
                {request.description}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={isBusy}
            aria-label="Chiudi finestra di conferma"
            className="p-1.5 text-[#7E99B8] hover:text-[#E8F0FA] transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {request.details && request.details.length > 0 && (
          <ul className="mt-4 pt-4 border-t border-[#1B3252] space-y-1.5 text-xs text-[#94ACC8]">
            {request.details.map((item, idx) => (
              <li key={idx} className="flex items-start gap-2">
                <span className="text-sky-400" aria-hidden="true">
                  ·
                </span>
                <span>{item}</span>
              </li>
            ))}
          </ul>
        )}

        <div className="mt-6 flex items-center justify-end gap-3">
          <button
            type="button"
            onClick={onClose}
            disabled={isBusy}
            className="px-4 py-2 rounded-lg bg-[#12243F] hover:bg-[#193053] border border-[#233F66] text-sm font-medium text-[#E8F0FA] transition-colors whitespace-nowrap"
          >
            {request.cancelLabel || 'Annulla'}
          </button>
          <button
            type="button"
            onClick={handleConfirm}
            disabled={isBusy}
            className={`px-4 py-2 rounded-lg text-sm font-semibold transition-colors whitespace-nowrap disabled:opacity-50 ${
              request.destructive
                ? 'bg-rose-500 hover:bg-rose-400 text-[#07111F]'
                : 'bg-sky-500 hover:bg-sky-400 text-[#05101F]'
            }`}
          >
            {isBusy ? 'Operazione in corso...' : request.confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
};
