'use client';

import { useState, useMemo } from 'react';
import DashboardLayout from '@/components/layout/DashboardLayout';
import RoleGuard from '@/components/auth/RoleGuard';
import { useDataStore } from '@/lib/data-store';
import { ROUTE_ROLES } from '@/lib/permissions';
import { formatDateTime } from '@/lib/utils';
import { PROVINCES } from '@/lib/mock-data';
import {
  Database, Filter, Search, MapPin, FileText, Package,
  ChevronLeft, ChevronRight
} from 'lucide-react';
import Link from 'next/link';

const RECORD_TYPE_LABELS: Record<string, string> = {
  export_permit: 'Export Permit',
  phyto_certificate: 'Phyto Certificate',
  quality_inspection: 'Quality Inspection',
  trade_license: 'Trade License',
  origin_certificate: 'Origin Certificate',
};

const PAGE_SIZE = 15;

export default function ProvinceDataListingPage() {
  const { provinceApiSources, provinceDataRecords } = useDataStore();

  const [provinceFilter, setProvinceFilter] = useState<string>('all');
  const [sourceFilter, setSourceFilter] = useState<string>('all');
  const [typeFilter, setTypeFilter] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [currentPage, setCurrentPage] = useState(1);

  const recordTypes = [...new Set(provinceDataRecords.map(r => r.record_type))];

  const filteredRecords = useMemo(() => {
    return provinceDataRecords.filter(r => {
      if (provinceFilter !== 'all' && r.province !== provinceFilter) return false;
      if (sourceFilter !== 'all' && r.source_id !== sourceFilter) return false;
      if (typeFilter !== 'all' && r.record_type !== typeFilter) return false;
      if (searchQuery) {
        const q = searchQuery.toLowerCase();
        const dataStr = JSON.stringify(r.data).toLowerCase();
        return r.source_name.toLowerCase().includes(q)
          || r.province.toLowerCase().includes(q)
          || dataStr.includes(q);
      }
      return true;
    });
  }, [provinceDataRecords, provinceFilter, sourceFilter, typeFilter, searchQuery]);

  const totalPages = Math.max(1, Math.ceil(filteredRecords.length / PAGE_SIZE));
  const pagedRecords = filteredRecords.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);

  // Province summary
  const provinceSummary = PROVINCES.map(p => {
    const records = provinceDataRecords.filter(r => r.province === p);
    const sources = provinceApiSources.filter(s => s.province === p);
    return { province: p, recordCount: records.length, sourceCount: sources.length };
  }).filter(s => s.sourceCount > 0 || s.recordCount > 0);

  return (
    <DashboardLayout>
      <RoleGuard allow={ROUTE_ROLES['/admin/province-integrations/data']}>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <Link href="/admin/province-integrations" className="text-sm text-gov-green-600 hover:underline flex items-center gap-1">
                <ChevronLeft className="w-3 h-3" /> Back to Integrations
              </Link>
            </div>
            <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
              <Database className="w-7 h-7 text-gov-green-600" />
              Province Data Records
            </h1>
            <p className="text-gray-500 mt-1">Browse all records pulled from provincial API systems</p>
          </div>
          <div className="text-sm text-gray-500">
            {filteredRecords.length.toLocaleString()} record{filteredRecords.length !== 1 ? 's' : ''}
          </div>
        </div>

        {/* Province Summary Cards */}
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
          {provinceSummary.map(s => (
            <button
              key={s.province}
              onClick={() => { setProvinceFilter(s.province); setCurrentPage(1); }}
              className={`card p-3 text-left transition-all hover:shadow-md ${provinceFilter === s.province ? 'ring-2 ring-gov-green-500' : ''}`}
            >
              <div className="flex items-center gap-2 mb-2">
                <MapPin className="w-4 h-4 text-gov-green-600" />
                <span className="text-xs font-medium text-gray-900 truncate">{s.province}</span>
              </div>
              <div className="flex items-baseline gap-3">
                <div>
                  <p className="text-lg font-bold text-gray-900">{s.recordCount}</p>
                  <p className="text-xs text-gray-400">records</p>
                </div>
                <div>
                  <p className="text-sm font-medium text-gray-600">{s.sourceCount}</p>
                  <p className="text-xs text-gray-400">sources</p>
                </div>
              </div>
            </button>
          ))}
        </div>

        {/* Filters */}
        <div className="card p-4">
          <div className="flex flex-wrap items-center gap-3">
            <div className="flex items-center gap-2 text-sm text-gray-500">
              <Filter className="w-4 h-4" /> Filters:
            </div>
            <div className="flex items-center gap-1.5">
              <Search className="w-4 h-4 text-gray-400" />
              <input
                type="text" value={searchQuery}
                onChange={e => { setSearchQuery(e.target.value); setCurrentPage(1); }}
                placeholder="Search records..."
                className="border border-gray-300 rounded-lg px-3 py-1.5 text-sm w-56 focus:ring-2 focus:ring-gov-green-500 focus:border-transparent"
              />
            </div>
            <select
              value={provinceFilter}
              onChange={e => { setProvinceFilter(e.target.value); setCurrentPage(1); }}
              className="border border-gray-300 rounded-lg px-3 py-1.5 text-sm focus:ring-2 focus:ring-gov-green-500"
            >
              <option value="all">All Provinces</option>
              {PROVINCES.map(p => <option key={p} value={p}>{p}</option>)}
            </select>
            <select
              value={sourceFilter}
              onChange={e => { setSourceFilter(e.target.value); setCurrentPage(1); }}
              className="border border-gray-300 rounded-lg px-3 py-1.5 text-sm focus:ring-2 focus:ring-gov-green-500"
            >
              <option value="all">All Sources</option>
              {provinceApiSources.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
            <select
              value={typeFilter}
              onChange={e => { setTypeFilter(e.target.value); setCurrentPage(1); }}
              className="border border-gray-300 rounded-lg px-3 py-1.5 text-sm focus:ring-2 focus:ring-gov-green-500"
            >
              <option value="all">All Types</option>
              {recordTypes.map(t => <option key={t} value={t}>{RECORD_TYPE_LABELS[t] || t}</option>)}
            </select>
            {(provinceFilter !== 'all' || sourceFilter !== 'all' || typeFilter !== 'all' || searchQuery) && (
              <button
                onClick={() => { setProvinceFilter('all'); setSourceFilter('all'); setTypeFilter('all'); setSearchQuery(''); setCurrentPage(1); }}
                className="text-sm text-red-500 hover:text-red-700"
              >
                Clear filters
              </button>
            )}
          </div>
        </div>

        {/* Records Table */}
        <div className="card">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50">
                <tr>
                  <th className="text-left p-3 font-medium text-gray-500">Province</th>
                  <th className="text-left p-3 font-medium text-gray-500">Source</th>
                  <th className="text-left p-3 font-medium text-gray-500">Type</th>
                  <th className="text-left p-3 font-medium text-gray-500">Reference</th>
                  <th className="text-left p-3 font-medium text-gray-500">Product</th>
                  <th className="text-left p-3 font-medium text-gray-500">Qty</th>
                  <th className="text-left p-3 font-medium text-gray-500">Exporter</th>
                  <th className="text-left p-3 font-medium text-gray-500">Destination</th>
                  <th className="text-left p-3 font-medium text-gray-500">Status</th>
                  <th className="text-left p-3 font-medium text-gray-500">Synced</th>
                </tr>
              </thead>
              <tbody>
                {pagedRecords.map(record => (
                  <tr key={record.id} className="border-t hover:bg-gray-50">
                    <td className="p-3">
                      <span className="text-xs px-2 py-1 rounded-full bg-gov-green-50 text-gov-green-700 font-medium">
                        {record.province}
                      </span>
                    </td>
                    <td className="p-3 text-gray-600 max-w-32 truncate">{record.source_name}</td>
                    <td className="p-3">
                      <span className="text-xs px-2 py-0.5 rounded bg-blue-50 text-blue-700">
                        {RECORD_TYPE_LABELS[record.record_type] || record.record_type}
                      </span>
                    </td>
                    <td className="p-3 font-mono text-xs text-gov-green-600">
                      {(record.data.reference_number as string) || '—'}
                    </td>
                    <td className="p-3 text-gray-800">{(record.data.product as string) || '—'}</td>
                    <td className="p-3 text-gray-600">{(record.data.quantity as number)?.toLocaleString() || '—'} {(record.data.unit as string) || ''}</td>
                    <td className="p-3 text-gray-600 max-w-32 truncate">{(record.data.exporter_name as string) || '—'}</td>
                    <td className="p-3 text-gray-600">{(record.data.destination as string) || '—'}</td>
                    <td className="p-3">
                      <span className="text-xs px-2 py-0.5 rounded-full bg-gray-100 text-gray-700">
                        {(record.data.status as string) || 'synced'}
                      </span>
                    </td>
                    <td className="p-3 text-xs text-gray-500">{formatDateTime(record.synced_at)}</td>
                  </tr>
                ))}
                {pagedRecords.length === 0 && (
                  <tr>
                    <td colSpan={10} className="p-8 text-center text-gray-400">
                      <Database className="w-8 h-8 mx-auto mb-2 opacity-40" />
                      <p>No records found. {provinceFilter !== 'all' || sourceFilter !== 'all' ? 'Try adjusting your filters.' : 'Trigger a sync from the integrations page to pull data.'}</p>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between p-4 border-t">
              <p className="text-sm text-gray-500">
                Showing {((currentPage - 1) * PAGE_SIZE) + 1}–{Math.min(currentPage * PAGE_SIZE, filteredRecords.length)} of {filteredRecords.length}
              </p>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                  disabled={currentPage === 1}
                  className="p-1.5 rounded-lg border text-gray-500 hover:bg-gray-50 disabled:opacity-30"
                >
                  <ChevronLeft className="w-4 h-4" />
                </button>
                <span className="text-sm text-gray-600">Page {currentPage} of {totalPages}</span>
                <button
                  onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                  disabled={currentPage === totalPages}
                  className="p-1.5 rounded-lg border text-gray-500 hover:bg-gray-50 disabled:opacity-30"
                >
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
      </RoleGuard>
    </DashboardLayout>
  );
}
