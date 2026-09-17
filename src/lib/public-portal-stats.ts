'use client';

import { useEffect, useState } from 'react';
import { Company, Complaint, ExportRecord, User } from './types';
import { usePortalBackend } from './portal-backend';

export interface PublicPortalStats {
  registeredExporters: number;
  activeUsers: number;
  totalConsignments: number;
  totalQuantity: number;
  countriesServed: number;
  pendingVerifications: number;
  complaintsReceived: number;
  complaintsResolved: number;
  monthly: { month: string; submissions: number; value: number }[];
  products: { name: string; value: number }[];
  countries: { name: string; value: number }[];
}

const FX_TO_USD: Record<string, number> = {
  USD: 1,
  PKR: 1 / 278,
  EUR: 1.08,
  GBP: 1.27,
  AED: 0.272294,
};

const asNumber = (value: unknown) => typeof value === 'number' && Number.isFinite(value) ? value : Number(value) || 0;

const asChartRows = (value: unknown): { name: string; value: number }[] => Array.isArray(value)
  ? value.flatMap(row => {
    if (!row || typeof row !== 'object') return [];
    const item = row as Record<string, unknown>;
    const name = typeof item.name === 'string' ? item.name : '';
    return name ? [{ name, value: asNumber(item.value) }] : [];
  })
  : [];

const asMonthlyRows = (value: unknown): PublicPortalStats['monthly'] => Array.isArray(value)
  ? value.flatMap(row => {
    if (!row || typeof row !== 'object') return [];
    const item = row as Record<string, unknown>;
    const month = typeof item.month === 'string' ? item.month : '';
    return month ? [{ month, submissions: asNumber(item.submissions), value: asNumber(item.value) }] : [];
  })
  : [];

const countBy = (records: ExportRecord[], value: (record: ExportRecord) => string) => Array.from(
  records.reduce((counts, record) => {
    const key = value(record).trim();
    if (key) counts.set(key, (counts.get(key) ?? 0) + 1);
    return counts;
  }, new Map<string, number>())
    .entries(),
  ([name, count]) => ({ name, value: count }),
).sort((a, b) => b.value - a.value || a.name.localeCompare(b.name)).slice(0, 8);

export function summarizePublicPortalStats(
  users: User[],
  companies: Company[],
  exportRecords: ExportRecord[],
  complaints: Complaint[],
): PublicPortalStats {
  const now = new Date();
  const monthly = Array.from({ length: 12 }, (_, index) => {
    const date = new Date(now.getFullYear(), now.getMonth() - 11 + index, 1);
    return { year: date.getFullYear(), monthIndex: date.getMonth(), month: date.toLocaleString('en-US', { month: 'short' }), submissions: 0, value: 0 };
  });

  for (const record of exportRecords) {
    const createdAt = new Date(record.created_at);
    const bucket = monthly.find(item => item.year === createdAt.getFullYear() && item.monthIndex === createdAt.getMonth());
    if (!bucket) continue;
    bucket.submissions += 1;
    bucket.value += record.estimated_value * (FX_TO_USD[record.currency?.toUpperCase()] ?? 1);
  }

  return {
    registeredExporters: companies.filter(company => company.status === 'approved').length,
    activeUsers: users.filter(user => user.is_active).length,
    totalConsignments: exportRecords.length,
    totalQuantity: exportRecords.reduce((total, record) => total + (record.quantity || 0), 0),
    countriesServed: new Set(exportRecords.map(record => record.destination_country).filter(Boolean)).size,
    pendingVerifications: companies.filter(company => ['submitted', 'under_tdap_review', 'under_nafsa_review', 'additional_info_required'].includes(company.status)).length,
    complaintsReceived: complaints.length,
    complaintsResolved: complaints.filter(complaint => Boolean(complaint.resolved_at) || ['resolved', 'closed'].includes(complaint.status)).length,
    monthly: monthly.map(({ year: _year, monthIndex: _monthIndex, ...entry }) => entry),
    products: countBy(exportRecords, record => record.product),
    countries: countBy(exportRecords, record => record.destination_country),
  };
}

function mapPublicStats(payload: Record<string, unknown>): PublicPortalStats {
  return {
    registeredExporters: asNumber(payload.registeredExporters ?? payload.registered_exporters),
    activeUsers: asNumber(payload.activeUsers ?? payload.active_users),
    totalConsignments: asNumber(payload.totalConsignments ?? payload.total_consignments),
    totalQuantity: asNumber(payload.totalQuantity ?? payload.total_quantity),
    countriesServed: asNumber(payload.countriesServed ?? payload.countries_served),
    pendingVerifications: asNumber(payload.pendingVerifications ?? payload.pending_verifications),
    complaintsReceived: asNumber(payload.complaintsReceived ?? payload.complaints_received),
    complaintsResolved: asNumber(payload.complaintsResolved ?? payload.complaints_resolved),
    monthly: asMonthlyRows(payload.monthly),
    products: asChartRows(payload.products),
    countries: asChartRows(payload.countries),
  };
}

export function usePublicPortalStats(fallback: PublicPortalStats) {
  const backend = usePortalBackend();
  const [stats, setStats] = useState(fallback);
  const [isLoading, setIsLoading] = useState(backend !== 'mock');

  useEffect(() => {
    setStats(fallback);
  }, [fallback]);

  useEffect(() => {
    if (backend === 'mock') {
      setIsLoading(false);
      return;
    }

    let cancelled = false;
    const load = async () => {
      setIsLoading(true);
      try {
        const response = await fetch('/api/mysql/public-stats', { cache: 'no-store' });
        const payload = await response.json().catch(() => ({})) as Record<string, unknown>;
        if (!response.ok) throw new Error(typeof payload.error === 'string' ? payload.error : `HTTP ${response.status}`);
        if (!cancelled) setStats(mapPublicStats(payload));
      } catch (error) {
        console.error('[public-portal-stats]', error);
        if (!cancelled) setStats(fallback);
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    };

    void load();
    const intervalId = window.setInterval(() => { void load(); }, 30_000);
    return () => {
      cancelled = true;
      window.clearInterval(intervalId);
    };
  }, [backend, fallback]);

  return { stats, isLoading };
}
