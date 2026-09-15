'use client';

import { Suspense, useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';
import DashboardLayout from '@/components/layout/DashboardLayout';
import RoleGuard from '@/components/auth/RoleGuard';
import { useDataStore } from '@/lib/data-store';
import { useAuth } from '@/lib/auth';
import { hasPermission, ROUTE_ROLES } from '@/lib/permissions';
import { Complaint } from '@/lib/types';
import { formatDate, formatDateTime, getStatusColor } from '@/lib/utils';
import { Search, Plus, AlertTriangle, Eye, X, Download } from 'lucide-react';

const STATUS_OPTIONS = [
  'submitted', 'acknowledged', 'under_review', 'assigned', 'info_required',
  'investigation', 'escalated', 'resolved', 'closed', 'reopened', 'rejected',
];

function ComplaintsPage() {
  const { complaints, companies, isLoaded } = useDataStore();
  const { user } = useAuth();
  const searchParams = useSearchParams();

  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [selected, setSelected] = useState<Complaint | null>(null);

  const canViewAll = hasPermission(user?.role, 'canViewAllComplaints');

  useEffect(() => {
    const query = searchParams.get('q');
    if (query) setSearch(query);
  }, [searchParams]);

  /**
   * Officers see every complaint. Exporters see complaints filed against their
   * own companies; buyers see the complaints they filed themselves.
   */
  const visibleComplaints = useMemo(() => {
    if (canViewAll) return complaints;
    if (!user) return [];
    const myCompanyNames = new Set(
      companies
        .filter(company => company.owner_id === user.id)
        .flatMap(company => [company.legal_name, company.trading_name ?? ''])
        .filter(Boolean)
        .map(name => name.toLowerCase()),
    );
    const myRegistrationNumbers = new Set(
      companies.filter(company => company.owner_id === user.id).map(company => company.registration_number),
    );
    return complaints.filter(complaint =>
      complaint.email.toLowerCase() === user.email.toLowerCase()
      || (complaint.exporter_company && myCompanyNames.has(complaint.exporter_company.toLowerCase()))
      || (complaint.export_registration_number && myRegistrationNumbers.has(complaint.export_registration_number)));
  }, [complaints, companies, canViewAll, user]);

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    return visibleComplaints.filter(complaint => {
      const matchSearch = !term
        || complaint.tracking_number.toLowerCase().includes(term)
        || complaint.subject.toLowerCase().includes(term)
        || complaint.category.toLowerCase().includes(term)
        || complaint.full_name.toLowerCase().includes(term);
      const matchStatus = !statusFilter || complaint.status === statusFilter;
      return matchSearch && matchStatus;
    });
  }, [visibleComplaints, search, statusFilter]);

  const handleExportCSV = () => {
    if (filtered.length === 0) return;
    const headers = ['Tracking #', 'Category', 'Subject', 'Priority', 'Status', 'Days Pending', 'SLA Deadline', 'Created'];
    const escape = (value: unknown) => `"${String(value ?? '').replace(/"/g, '""')}"`;
    const rows = filtered.map(complaint => [
      complaint.tracking_number, complaint.category, complaint.subject, complaint.priority,
      complaint.status, complaint.days_pending, complaint.sla_deadline, complaint.created_at,
    ]);
    const csv = [headers, ...rows].map(row => row.map(escape).join(',')).join('\n');
    const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }));
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = `complaints-${new Date().toISOString().slice(0, 10)}.csv`;
    anchor.click();
    URL.revokeObjectURL(url);
  };

  return (
    <DashboardLayout>
      <RoleGuard allow={ROUTE_ROLES['/dashboard/complaints']}>
        {/* Detail modal */}
        {selected && (
          <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
            <div className="bg-white rounded-xl shadow-xl w-full max-w-lg max-h-[85vh] overflow-y-auto p-6">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h2 className="text-lg font-bold">{selected.tracking_number}</h2>
                  <p className="text-sm text-gray-500">{selected.category}</p>
                </div>
                <button onClick={() => setSelected(null)} aria-label="Close" className="p-1 hover:bg-gray-100 rounded"><X className="w-5 h-5" /></button>
              </div>
              <div className="space-y-3 text-sm">
                <div className="flex gap-2">
                  <span className={`badge ${getStatusColor(selected.priority)}`}>{selected.priority}</span>
                  <span className={`badge ${getStatusColor(selected.status)}`}>{selected.status.replace(/_/g, ' ')}</span>
                </div>
                <div><span className="text-gray-500">Subject:</span><p className="font-medium">{selected.subject}</p></div>
                <div><span className="text-gray-500">Description:</span><p className="whitespace-pre-line">{selected.description}</p></div>
                <div className="grid sm:grid-cols-2 gap-3 pt-2 border-t">
                  <div><span className="text-gray-500">Complainant:</span><p>{selected.full_name}</p></div>
                  <div><span className="text-gray-500">Country:</span><p>{selected.country}</p></div>
                  <div><span className="text-gray-500">Exporter named:</span><p>{selected.exporter_company || '—'}</p></div>
                  <div><span className="text-gray-500">Export record:</span><p>{selected.export_record_number || '—'}</p></div>
                  <div><span className="text-gray-500">Submitted:</span><p>{formatDateTime(selected.created_at)}</p></div>
                  <div><span className="text-gray-500">SLA deadline:</span><p>{formatDate(selected.sla_deadline)}</p></div>
                </div>
                {selected.resolution_summary && (
                  <div className="p-3 bg-green-50 rounded-lg">
                    <p className="font-medium text-green-800 mb-1">Resolution</p>
                    <p className="text-green-700">{selected.resolution_summary}</p>
                  </div>
                )}
              </div>
              <div className="flex gap-3 mt-6">
                <Link href={`/complaints/track?tracking=${encodeURIComponent(selected.tracking_number)}`} className="btn-outline">Public tracking view</Link>
                <button onClick={() => setSelected(null)} className="btn-primary">Close</button>
              </div>
            </div>
          </div>
        )}

        <div className="space-y-6">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">Complaints</h1>
              <p className="text-gray-500">
                {canViewAll ? 'All complaints registered with the portal' : 'Complaints you filed or that involve your company'}
              </p>
            </div>
            <div className="flex gap-2">
              <button onClick={handleExportCSV} disabled={filtered.length === 0} className="btn-outline flex items-center gap-2 disabled:opacity-50">
                <Download className="w-4 h-4" /> Export CSV
              </button>
              <Link href="/complaints/submit" className="btn-primary flex items-center gap-2">
                <Plus className="w-4 h-4" /> New Complaint
              </Link>
            </div>
          </div>

          <div className="card">
            <div className="p-4 border-b flex flex-col md:flex-row gap-3">
              <div className="flex items-center gap-2 bg-gray-100 rounded-lg px-3 py-2 flex-1">
                <Search className="w-4 h-4 text-gray-400" />
                <input
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                  placeholder="Search by tracking number, subject, or category..."
                  aria-label="Search complaints"
                  className="bg-transparent border-none outline-none text-sm flex-1"
                />
              </div>
              <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)} aria-label="Filter by status" className="input-field md:w-48">
                <option value="">All Statuses</option>
                {STATUS_OPTIONS.map(status => (
                  <option key={status} value={status}>{status.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())}</option>
                ))}
              </select>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="text-left p-3 font-medium text-gray-500">Tracking #</th>
                    <th className="text-left p-3 font-medium text-gray-500">Category</th>
                    <th className="text-left p-3 font-medium text-gray-500">Subject</th>
                    <th className="text-left p-3 font-medium text-gray-500">Priority</th>
                    <th className="text-left p-3 font-medium text-gray-500">Status</th>
                    <th className="text-left p-3 font-medium text-gray-500">Days Pending</th>
                    <th className="text-left p-3 font-medium text-gray-500">Date</th>
                    <th className="text-left p-3 font-medium text-gray-500">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map(complaint => (
                    <tr key={complaint.id} className="border-t hover:bg-gray-50">
                      <td className="p-3 font-mono text-gov-green-600">{complaint.tracking_number}</td>
                      <td className="p-3">{complaint.category}</td>
                      <td className="p-3 max-w-xs truncate">{complaint.subject}</td>
                      <td className="p-3"><span className={`badge ${getStatusColor(complaint.priority)}`}>{complaint.priority}</span></td>
                      <td className="p-3"><span className={`badge ${getStatusColor(complaint.status)}`}>{complaint.status.replace(/_/g, ' ')}</span></td>
                      <td className="p-3">{complaint.days_pending}</td>
                      <td className="p-3 text-gray-500">{formatDate(complaint.created_at)}</td>
                      <td className="p-3">
                        <button onClick={() => setSelected(complaint)} className="p-1.5 rounded hover:bg-blue-50" title="View" aria-label={`View ${complaint.tracking_number}`}>
                          <Eye className="w-4 h-4 text-blue-500" />
                        </button>
                      </td>
                    </tr>
                  ))}
                  {filtered.length === 0 && (
                    <tr>
                      <td colSpan={8} className="p-12 text-center text-gray-400">
                        <AlertTriangle className="w-10 h-10 mx-auto mb-3 text-gray-300" />
                        <p className="text-sm">
                          {!isLoaded ? 'Loading complaints…'
                            : visibleComplaints.length === 0 ? 'No complaints involve your account yet.'
                              : 'No complaints match the current filters.'}
                        </p>
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
            <div className="p-3 border-t text-sm text-gray-500">
              Showing {filtered.length} of {visibleComplaints.length} complaints
            </div>
          </div>
        </div>
      </RoleGuard>
    </DashboardLayout>
  );
}

/**
 * useSearchParams() requires a Suspense boundary so this route can still be
 * prerendered as static HTML.
 */
export default function ComplaintsRoute() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-gray-50 flex items-center justify-center text-sm text-gray-500">Loading complaints…</div>}>
      <ComplaintsPage />
    </Suspense>
  );
}
