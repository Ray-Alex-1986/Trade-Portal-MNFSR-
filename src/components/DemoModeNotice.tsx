'use client';

import { usePortalBackend } from '@/lib/supabase/use-mock';
import { AlertTriangle } from 'lucide-react';

/**
 * Shown on every entry point while the portal is running on browser-local
 * demo data. Without a database each browser keeps its own private copy, so
 * accounts and records created on one machine are invisible on every other
 * one. The notice disappears as soon as a backend is configured, which makes
 * it a quick way to confirm a deployment picked up its environment variables.
 */
export default function DemoModeNotice({ className = '' }: { className?: string }) {
  const backend = usePortalBackend();
  if (backend !== 'mock') return null;

  return (
    <div
      role="note"
      className={`bg-amber-100 border-b border-amber-300 text-amber-900 px-4 py-2 text-center text-xs sm:text-sm ${className}`}
    >
      <AlertTriangle className="w-4 h-4 inline-block mr-1.5 -mt-0.5" aria-hidden="true" />
      <span className="font-semibold">Demo mode:</span>{' '}
      no database is connected, so accounts and records are saved only in this browser and are not shared with other devices or users.
    </div>
  );
}
