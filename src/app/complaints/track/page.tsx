'use client';

import { Suspense, useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { Search, CheckCircle, Clock, AlertTriangle } from 'lucide-react';
import Image from 'next/image';
import { Complaint } from '@/lib/types';
import { useDataStore } from '@/lib/data-store';
import { getStatusColor } from '@/lib/utils';
import { getSupabaseBrowserClient } from '@/lib/supabase/client';
import { usePortalBackend } from '@/lib/supabase/use-mock';
import DemoModeNotice from '@/components/DemoModeNotice';

function TrackComplaintPage() {
  const searchParams = useSearchParams();
  const [trackingNum, setTrackingNum] = useState('');
  const [result, setResult] = useState<Complaint | null>(null);
  const [searched, setSearched] = useState(false);
  const [isSearching, setIsSearching] = useState(false);
  const [error, setError] = useState('');
  const { complaints } = useDataStore();
  const backend = usePortalBackend();

  const lookup = useCallback(async (raw: string) => {
    const trackingNumber = raw.trim();
    if (!trackingNumber) return;
    setIsSearching(true);
    setError('');
    try {
      if (backend === 'mysql') {
        const response = await fetch(`/api/mysql/complaints/track?tracking_number=${encodeURIComponent(trackingNumber)}`, {
          cache: 'no-store',
        });
        const body = await response.json().catch(() => ({})) as { complaint?: Complaint | null; error?: string };
        if (!response.ok) throw new Error(body.error || `HTTP ${response.status}`);
        setResult(body.complaint ?? null);
      } else {
        const supabase = getSupabaseBrowserClient();
        if (supabase) {
          // SECURITY DEFINER RPC permits public tracking without exposing the
          // complaints table to anonymous users.
          const { data, error } = await supabase.rpc('get_complaint_by_tracking', {
            p_tracking_number: trackingNumber,
          });
          if (error) throw error;
          setResult(((data ?? [])[0] as Complaint | undefined) ?? null);
        } else {
          const found = complaints.find(c => c.tracking_number.toLowerCase() === trackingNumber.toLowerCase());
          setResult(found || null);
        }
      }
    } catch (lookupError) {
      console.error('[trackComplaint]', lookupError);
      setResult(null);
      setError('Complaint tracking is temporarily unavailable. Please try again shortly.');
    } finally {
      setSearched(true);
      setIsSearching(false);
    }
  }, [backend, complaints]);

  const handleSearch = () => { void lookup(trackingNum); };

  // Support deep links from the submission confirmation screen.
  useEffect(() => {
    const tracking = searchParams.get('tracking');
    if (!tracking) return;
    setTrackingNum(tracking);
    void lookup(tracking);
  }, [searchParams, lookup]);

  return (
    <div className="min-h-screen bg-gray-50">
      <DemoModeNotice />
      <header className="bg-gov-green-500 text-white py-4">
        <div className="max-w-4xl mx-auto px-4 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2">
            <Image src="/govt-pakistan-logo.png" alt="Government of Pakistan" width={36} height={36} />
            <div><p className="font-bold text-sm">Track Complaint</p><p className="text-xs text-gov-green-200">Government of Pakistan</p></div>
          </Link>
          <Link href="/complaints/submit" className="text-sm text-gov-green-100 hover:text-white">Submit Complaint</Link>
        </div>
      </header>

      <div className="max-w-2xl mx-auto px-4 py-12">
        <h1 className="text-2xl font-bold text-gray-900 text-center mb-2">Track Your Complaint</h1>
        <p className="text-gray-500 text-center mb-8">Enter your complaint tracking number to check its status</p>

        <div className="card p-6 mb-6">
          <div className="flex gap-3">
            <input
              value={trackingNum}
              onChange={e => setTrackingNum(e.target.value)}
              placeholder="Enter tracking number (e.g., CMP-2025001)"
              className="input-field flex-1"
              onKeyDown={e => e.key === 'Enter' && handleSearch()}
            />
            <button onClick={handleSearch} disabled={isSearching || !trackingNum.trim()} className="btn-primary flex items-center gap-2 disabled:opacity-50">
              <Search className="w-4 h-4" /> {isSearching ? 'Searching...' : 'Track'}
            </button>
          </div>
          <p className="text-xs text-gray-400 mt-2">Use the tracking number issued when your complaint was submitted.</p>
        </div>

        {searched && !result && (
          <div className="card p-8 text-center text-gray-500">
            <AlertTriangle className="w-12 h-12 mx-auto mb-3 text-yellow-400" />
            <p className="font-medium">{error ? 'Tracking is unavailable' : 'No complaint found with this tracking number'}</p>
            <p className="text-sm">{error || 'Please verify the tracking number and try again.'}</p>
          </div>
        )}

        {result && (
          <div className="card p-6 space-y-6">
            <div className="flex items-center justify-between">
              <h2 className="text-xl font-bold text-gray-900">{result.tracking_number}</h2>
              <span className={`badge text-sm ${getStatusColor(result.status)}`}>{result.status.replace(/_/g, ' ').toUpperCase()}</span>
            </div>

            <div className="grid md:grid-cols-2 gap-4 text-sm">
              <div><span className="text-gray-500">Category:</span> <span className="font-medium">{result.category}</span></div>
              <div><span className="text-gray-500">Priority:</span> <span className={`badge ${getStatusColor(result.priority)}`}>{result.priority}</span></div>
              <div><span className="text-gray-500">Subject:</span> <span className="font-medium">{result.subject}</span></div>
              <div><span className="text-gray-500">Submitted:</span> <span>{new Date(result.created_at).toLocaleDateString()}</span></div>
              <div><span className="text-gray-500">SLA Deadline:</span> <span>{new Date(result.sla_deadline).toLocaleDateString()}</span></div>
              <div><span className="text-gray-500">Days Pending:</span> <span>{result.days_pending}</span></div>
            </div>

            {/* Timeline */}
            <div>
              <h3 className="font-semibold text-gray-900 mb-3">Status Timeline</h3>
              <div className="space-y-3">
                {[
                  { label: 'Complaint Submitted', date: result.created_at, done: true },
                  { label: 'Acknowledged', date: result.created_at, done: ['acknowledged','under_review','assigned','investigation','resolved','closed'].includes(result.status) },
                  { label: 'Under Review', date: result.created_at, done: ['under_review','assigned','investigation','resolved','closed'].includes(result.status) },
                  { label: 'Assigned to Officer', date: result.created_at, done: ['assigned','investigation','resolved','closed'].includes(result.status) },
                  { label: 'Resolved', date: result.updated_at, done: ['resolved','closed'].includes(result.status) },
                ].map((step, i) => (
                  <div key={i} className="flex items-center gap-3">
                    <div className={`w-6 h-6 rounded-full flex items-center justify-center ${step.done ? 'bg-green-500 text-white' : 'bg-gray-200 text-gray-400'}`}>
                      {step.done ? <CheckCircle className="w-4 h-4" /> : <Clock className="w-3 h-3" />}
                    </div>
                    <div className="flex-1">
                      <p className={`text-sm ${step.done ? 'text-gray-900 font-medium' : 'text-gray-400'}`}>{step.label}</p>
                    </div>
                    {step.done && <span className="text-xs text-gray-500">{new Date(step.date).toLocaleDateString()}</span>}
                  </div>
                ))}
              </div>
            </div>

            {result.resolution_summary && (
              <div className="p-4 bg-green-50 rounded-lg">
                <h4 className="font-medium text-green-800 mb-1">Resolution Summary</h4>
                <p className="text-sm text-green-700">{result.resolution_summary}</p>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

/**
 * useSearchParams() requires a Suspense boundary so this route can still be
 * prerendered as static HTML.
 */
export default function TrackComplaintRoute() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-gray-50 flex items-center justify-center text-sm text-gray-500">Loading complaint tracking…</div>}>
      <TrackComplaintPage />
    </Suspense>
  );
}
