'use client';

import { useEffect, useMemo, useState } from 'react';
import DashboardLayout from '@/components/layout/DashboardLayout';
import RoleGuard from '@/components/auth/RoleGuard';
import { useToast } from '@/components/ui/Toast';
import { useDataStore } from '@/lib/data-store';
import { ROLE_LABELS, ROUTE_ROLES } from '@/lib/permissions';
import { formatDateTime } from '@/lib/utils';
import { Search, Download, Shield } from 'lucide-react';

const PAGE_SIZE = 30;

export default function AuditLogsPage() {
  const { auditLogs, isLoaded } = useDataStore();
  const { showToast, ToastView } = useToast();
  const [search, setSearch] = useState('');
  const [moduleFilter, setModuleFilter] = useState('');
  const [page, setPage] = useState(1);

  const modules = useMemo(() => [...new Set(auditLogs.map(l => l.module))].sort(), [auditLogs]);

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    return auditLogs.filter(l => {
      const matchSearch = !term
        || l.user_name.toLowerCase().includes(term)
        || l.action.toLowerCase().includes(term)
        || l.record_id.toLowerCase().includes(term)
        || (l.new_value ?? '').toLowerCase().includes(term);
      const matchModule = !moduleFilter || l.module === moduleFilter;
      return matchSearch && matchModule;
    });
  }, [auditLogs, search, moduleFilter]);

  useEffect(() => { setPage(1); }, [search, moduleFilter]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const currentPage = Math.min(page, totalPages);
  const visible = filtered.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);

  /** Audit trails are exported for the record, so every filtered row is included. */
  const handleExport = () => {
    if (filtered.length === 0) {
      showToast('There are no audit entries to export.', 'info');
      return;
    }
    const headers = ['Timestamp', 'User', 'Role', 'Action', 'Module', 'Record ID', 'Previous Value', 'New Value', 'IP Address'];
    const escape = (value: unknown) => `"${String(value ?? '').replace(/"/g, '""')}"`;
    const rows = filtered.map(log => [
      log.created_at, log.user_name, log.user_role, log.action, log.module,
      log.record_id, log.previous_value ?? '', log.new_value ?? '', log.ip_address,
    ]);
    const csv = [headers, ...rows].map(row => row.map(escape).join(',')).join('\n');
    const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }));
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = `audit-logs-${new Date().toISOString().slice(0, 10)}.csv`;
    anchor.click();
    URL.revokeObjectURL(url);
    showToast(`${filtered.length} audit entr${filtered.length === 1 ? 'y' : 'ies'} exported to CSV.`);
  };

  return (
    <DashboardLayout>
      <RoleGuard allow={ROUTE_ROLES['/admin/audit-logs']}>
      <ToastView />
      <div className="space-y-6">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Audit Logs</h1>
            <p className="text-gray-500">Immutable system activity trail</p>
          </div>
          <button onClick={handleExport} className="btn-outline flex items-center gap-2"><Download className="w-4 h-4" /> Export Logs</button>
        </div>

        <div className="card">
          <div className="p-4 border-b flex flex-col md:flex-row gap-3">
            <div className="flex items-center gap-2 bg-gray-100 rounded-lg px-3 py-2 flex-1">
              <Search className="w-4 h-4 text-gray-400" />
              <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search by user, action, or record ID..." aria-label="Search audit logs" className="bg-transparent border-none outline-none text-sm flex-1" />
            </div>
            <select value={moduleFilter} onChange={e => setModuleFilter(e.target.value)} aria-label="Filter by module" className="input-field md:w-48">
              <option value="">All Modules</option>
              {modules.map(m => <option key={m}>{m}</option>)}
            </select>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50">
                <tr>
                  <th className="text-left p-3 font-medium text-gray-500">Date/Time</th>
                  <th className="text-left p-3 font-medium text-gray-500">User</th>
                  <th className="text-left p-3 font-medium text-gray-500">Role</th>
                  <th className="text-left p-3 font-medium text-gray-500">Action</th>
                  <th className="text-left p-3 font-medium text-gray-500">Module</th>
                  <th className="text-left p-3 font-medium text-gray-500">Record ID</th>
                  <th className="text-left p-3 font-medium text-gray-500">IP Address</th>
                </tr>
              </thead>
              <tbody>
                {visible.map(log => (
                  <tr key={log.id} className="border-t hover:bg-gray-50">
                    <td className="p-3 text-gray-500 whitespace-nowrap">{formatDateTime(log.created_at)}</td>
                    <td className="p-3 font-medium">{log.user_name || 'System'}</td>
                    <td className="p-3"><span className="badge bg-gray-100 text-gray-700">{ROLE_LABELS[log.user_role] || log.user_role}</span></td>
                    <td className="p-3">
                      {log.action}
                      {log.new_value && <span className="block text-xs text-gray-400 truncate max-w-xs">{log.new_value}</span>}
                    </td>
                    <td className="p-3"><span className="badge bg-blue-50 text-blue-700">{log.module}</span></td>
                    <td className="p-3 font-mono text-xs">{log.record_id || '—'}</td>
                    <td className="p-3 text-gray-400 font-mono text-xs">{log.ip_address}</td>
                  </tr>
                ))}
                {visible.length === 0 && (
                  <tr>
                    <td colSpan={7} className="p-12 text-center text-gray-400">
                      <Shield className="w-10 h-10 mx-auto mb-3 text-gray-300" />
                      <p className="text-sm">{!isLoaded ? 'Loading audit trail…' : auditLogs.length === 0 ? 'No activity has been recorded yet.' : 'No entries match the current filters.'}</p>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          <div className="p-4 border-t flex flex-col sm:flex-row items-center justify-between gap-3 text-sm text-gray-500">
            <span>
              {filtered.length === 0
                ? 'No entries'
                : `Showing ${(currentPage - 1) * PAGE_SIZE + 1}–${Math.min(currentPage * PAGE_SIZE, filtered.length)} of ${filtered.length} entries`}
            </span>
            {totalPages > 1 && (
              <div className="flex items-center gap-2">
                <button onClick={() => setPage(currentPage - 1)} disabled={currentPage === 1} className="px-3 py-1 border rounded-lg hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed">Previous</button>
                <span>Page {currentPage} of {totalPages}</span>
                <button onClick={() => setPage(currentPage + 1)} disabled={currentPage === totalPages} className="px-3 py-1 border rounded-lg hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed">Next</button>
              </div>
            )}
          </div>
        </div>
      </div>
      </RoleGuard>
    </DashboardLayout>
  );
}
