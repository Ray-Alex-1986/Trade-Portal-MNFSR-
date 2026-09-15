'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { AlertTriangle, CheckCircle, Info, X } from 'lucide-react';

export type ToastType = 'success' | 'error' | 'info';

interface ToastState {
  message: string;
  type: ToastType;
}

const STYLES: Record<ToastType, string> = {
  success: 'bg-green-600',
  error: 'bg-red-600',
  info: 'bg-blue-600',
};

/**
 * Shared toast used across the portal so every action reports its outcome the
 * same way. Errors stay on screen longer than confirmations, and the timer is
 * cleared on unmount so a navigation mid-action cannot update a dead component.
 */
export function useToast() {
  const [toast, setToast] = useState<ToastState | null>(null);
  const timer = useRef<number | null>(null);

  const clear = useCallback(() => {
    if (timer.current !== null) window.clearTimeout(timer.current);
    timer.current = null;
    setToast(null);
  }, []);

  const showToast = useCallback((message: string, type: ToastType = 'success') => {
    if (timer.current !== null) window.clearTimeout(timer.current);
    setToast({ message, type });
    timer.current = window.setTimeout(() => setToast(null), type === 'error' ? 6000 : 3500);
  }, []);

  useEffect(() => () => {
    if (timer.current !== null) window.clearTimeout(timer.current);
  }, []);

  const ToastView = useCallback(() => {
    if (!toast) return null;
    const Icon = toast.type === 'error' ? AlertTriangle : toast.type === 'info' ? Info : CheckCircle;
    return (
      <div
        role="status"
        aria-live="polite"
        className={`fixed top-4 right-4 z-[60] flex items-start gap-2 px-4 py-3 rounded-lg shadow-lg max-w-md text-white ${STYLES[toast.type]}`}
      >
        <Icon className="w-4 h-4 flex-shrink-0 mt-0.5" />
        <span className="text-sm">{toast.message}</span>
        <button type="button" aria-label="Dismiss notification" onClick={clear} className="ml-1 opacity-80 hover:opacity-100">
          <X className="w-4 h-4" />
        </button>
      </div>
    );
  }, [toast, clear]);

  return { toast, showToast, clearToast: clear, ToastView };
}
