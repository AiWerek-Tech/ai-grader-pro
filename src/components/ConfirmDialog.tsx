'use client';

import { AlertTriangle, Loader2, ShieldAlert, Trash2, X } from 'lucide-react';

interface ConfirmDialogProps {
  isOpen: boolean;
  title: string;
  description: string;
  confirmText?: string;
  cancelText?: string;
  variant?: 'danger' | 'warning' | 'info';
  loading?: boolean;
  onConfirm: () => void | Promise<void>;
  onCancel: () => void;
}

/**
 * Dialog konfirmasi modern pengganti window.confirm() bawaan browser,
 * agar tampil konsisten di Desktop, Mobile Browser, maupun Android WebView.
 */
export function ConfirmDialog({
  isOpen,
  title,
  description,
  confirmText = 'Ya, Lanjutkan',
  cancelText = 'Batal',
  variant = 'danger',
  loading = false,
  onConfirm,
  onCancel,
}: ConfirmDialogProps) {
  if (!isOpen) return null;

  const isDanger = variant === 'danger';
  const isWarning = variant === 'warning';

  const iconBgClass = isDanger
    ? 'bg-rose-500/10 text-rose-500 border-rose-500/20'
    : isWarning
      ? 'bg-amber-500/10 text-amber-500 border-amber-500/20'
      : 'bg-indigo-500/10 text-indigo-500 border-indigo-500/20';

  const confirmBtnClass = isDanger
    ? 'bg-rose-600 hover:bg-rose-500 shadow-rose-500/25'
    : isWarning
      ? 'bg-amber-600 hover:bg-amber-500 shadow-amber-500/25'
      : 'bg-indigo-600 hover:bg-indigo-500 shadow-indigo-500/25';

  return (
    <div
      className="fixed inset-0 z-[150] bg-black/70 lg:backdrop-blur-sm flex items-end sm:items-center justify-center sm:p-4 animate-in fade-in duration-150 print:hidden"
      onClick={(e) => {
        if (e.target === e.currentTarget && !loading) onCancel();
      }}
      role="alertdialog"
      aria-modal="true"
      aria-labelledby="confirm-dialog-title"
    >
      <div className="bg-white dark:bg-[#0d111d] border border-slate-200 dark:border-white/15 rounded-t-3xl sm:rounded-3xl w-full max-w-md p-6 sm:p-7 shadow-2xl space-y-5 animate-in slide-in-from-bottom-4 sm:zoom-in-95 duration-200">
        <div className="flex items-start justify-between gap-3">
          <div className={`w-12 h-12 rounded-2xl border flex items-center justify-center shrink-0 ${iconBgClass}`}>
            {isDanger ? (
              <Trash2 className="w-6 h-6" />
            ) : isWarning ? (
              <AlertTriangle className="w-6 h-6" />
            ) : (
              <ShieldAlert className="w-6 h-6" />
            )}
          </div>
          <button
            type="button"
            onClick={onCancel}
            disabled={loading}
            aria-label="Tutup dialog"
            className="p-2 rounded-xl bg-slate-100 dark:bg-white/5 text-slate-500 hover:text-slate-900 dark:hover:text-white transition-colors disabled:opacity-40"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div>
          <h3 id="confirm-dialog-title" className="text-lg font-black text-slate-900 dark:text-white tracking-tight">
            {title}
          </h3>
          <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-400 mt-1.5 leading-relaxed whitespace-pre-line font-medium">
            {description}
          </p>
        </div>

        <div className="flex flex-col-reverse sm:flex-row gap-2.5 pt-1">
          <button
            type="button"
            onClick={onCancel}
            disabled={loading}
            className="flex-1 py-3.5 px-4 rounded-2xl bg-slate-100 dark:bg-white/[0.04] hover:bg-slate-200 dark:hover:bg-white/[0.08] text-slate-700 dark:text-slate-300 font-black text-xs uppercase tracking-wider border border-slate-200 dark:border-white/10 transition-all active:scale-95 disabled:opacity-40"
          >
            {cancelText}
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={loading}
            className={`flex-1 py-3.5 px-4 rounded-2xl text-white font-black text-xs uppercase tracking-wider flex items-center justify-center gap-2 shadow-lg transition-all active:scale-95 disabled:opacity-50 ${confirmBtnClass}`}
          >
            {loading && <Loader2 className="w-4 h-4 animate-spin" />}
            <span>{confirmText}</span>
          </button>
        </div>
      </div>
    </div>
  );
}
