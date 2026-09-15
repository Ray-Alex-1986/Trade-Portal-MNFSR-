'use client';

import { useState } from 'react';
import DashboardLayout from '@/components/layout/DashboardLayout';
import RoleGuard from '@/components/auth/RoleGuard';
import { useDataStore } from '@/lib/data-store';
import { ROUTE_ROLES } from '@/lib/permissions';
import { Search, Filter, Download } from 'lucide-react';

export default function AuditLogsPage() {
  const { auditLogs } = useDataStore();
  const [search, setSearch] = useState('');
  const [moduleFilter, setModuleFilter] = useState('');

  const modules = [...new Set(auditLogs.map(l => l.module))];

  const filtered = auditLogs.filter(l => {
    const matchSearch = !search || l.user_name.toLowerCase().includes(search.toLowerCase()) || l.action.toLowerCase().includes(search.toLowerCase()) || l.record_id.toLowerCase().includes(search.toLowerCase());
    const matchModule = !moduleFilter || l.module === moduleFilter;
    return matchSearch && matchModule;
  });

  const roleLabels: Record<string, string> = {
    super_admin: 'MNFSR Admin', moc_admin: 'MoC Admin', tdap_admin: 'TDAP Admin', tdap_officer: 'TDAP Officer',
    nafsa_admin: 'NAFSA Admin', nafsa_officer: 'NAFSA Officer', tic: 'TIC', exporter: 'Exporter', buyer: 'Buyer', auditor: 'Auditor',
  };

  return (
    <DashboardLayout>
      <RoleGuard allow={ROUTE_ROLES['/admin/audit-logs']}>
      <div className="space-y-6">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Audit Logs</h1>
            <p className="text-gray-500">Immutable system activity trail</p>
          </div>
          <button className="btn-outline flex items-center gap-2"><Download className="w-4 h-4" /> Export Logs</button>
        </div>

        <div className="card">
          <div className="p-4 border-b flex flex-col md:flex-row gap-3">
            <div className="flex items-center gap-2 bg-gray-100 rounded-lg px-3 py-2 flex-1">
              <Search className="w-4 h-4 text-gray-400" />
              <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search by user, action, or record ID..." className="bg-transparent border-none outline-none text-sm flex-1" />
            </div>
            <select value={moduleFilter} onChange={e => setModuleFilter(e.target.value)} className="input-field md:w-48">
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
                {filtered.slice(0, 30).map(log => (
                  <tr key={log.id} className="border-t hover:bg-gray-50">
                    <td className="p-3 text-gray-500 whitespace-nowrap">{new Date(log.created_at).toLocaleString()}</td>
                    <td className="p-3 font-medium">{log.user_name}</td>
                    <td className="p-3"><span className="badge bg-gray-100 text-gray-700">{roleLabels[log.user_role] || log.user_role}</span></td>
                    <td className="p-3">{log.action}</td>
                    <td className="p-3"><span className="badge bg-blue-50 text-blue-700">{log.module}</span></td>
                    <td className="p-3 font-mono text-xs">{log.record_id}</td>
                    <td className="p-3 text-gray-400 font-mono text-xs">{log.ip_address}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="p-4 border-t text-sm text-gray-500">
            Showing {Math.min(filtered.length, 30)} of {filtered.length} entries
          </div>
        </div>
      </div>
      </RoleGuard>
    </DashboardLayout>
  );
}
