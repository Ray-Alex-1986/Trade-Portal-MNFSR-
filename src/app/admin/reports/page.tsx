'use client';

import { useMemo, useState } from 'react';
import DashboardLayout from '@/components/layout/DashboardLayout';
import RoleGuard from '@/components/auth/RoleGuard';
import { ROUTE_ROLES } from '@/lib/permissions';
import { useDataStore } from '@/lib/data-store';
import { Download, FileText, FileSpreadsheet, Printer } from 'lucide-react';

type ReportId =
  | 'registered_exporters' | 'pending_applications' | 'system_users'
  | 'product_exports' | 'country_exports' | 'province_exports' | 'export_trends'
  | 'sps_certificates' | 'psi_reports' | 'complaint_register' | 'complaint_aging'
  | 'sla_compliance' | 'officer_performance' | 'audit_trail';

type ReportDefinition = { id: ReportId; name: string; desc: string; category: string };
type ReportRow = Record<string, string | number | boolean | null | undefined>;

const REPORTS: ReportDefinition[] = [
  { id: 'registered_exporters', name: 'Registered Exporters Report', desc: 'Registered companies with their current verification status', category: 'Registration' },
  { id: 'pending_applications', name: 'Pending Verification Applications', desc: 'Applications awaiting a review decision', category: 'Registration' },
  { id: 'system_users', name: 'Active & Inactive Users', desc: 'System users grouped by current activity status', category: 'Users' },
  { id: 'product_exports', name: 'Product-wise Exports', desc: 'Export volumes and values by product', category: 'Export' },
  { id: 'country_exports', name: 'Country-wise Exports', desc: 'Export volumes and values by destination country', category: 'Export' },
  { id: 'province_exports', name: 'Province-wise Exports', desc: 'Export volumes and values by production province', category: 'Export' },
  { id: 'export_trends', name: 'Monthly & Annual Export Trends', desc: 'Submitted export records by month', category: 'Trends' },
  { id: 'sps_certificates', name: 'SPS Certificate Status', desc: 'DDP SPS document verification status', category: 'Certification' },
  { id: 'psi_reports', name: 'PSI Report Status', desc: 'Pre-shipment inspection document verification status', category: 'Certification' },
  { id: 'complaint_register', name: 'Complaint Register', desc: 'Complaints with their current status and priority', category: 'Complaints' },
  { id: 'complaint_aging', name: 'Complaint Aging Report', desc: 'Open complaints with their current age in days', category: 'Complaints' },
  { id: 'sla_compliance', name: 'SLA Compliance Report', desc: 'Complaints assessed against their SLA deadline', category: 'Compliance' },
  { id: 'officer_performance', name: 'Officer Performance Report', desc: 'Current officer accounts and their institutions', category: 'Administration' },
  { id: 'audit_trail', name: 'Full Audit Trail Report', desc: 'Recorded system activity visible to this role', category: 'Audit' },
];

const isInRange = (value: string, from: string, to: string) => {
  const date = value.slice(0, 10);
  return (!from || date >= from) && (!to || date <= to);
};

const downloadCsv = (fileName: string, rows: ReportRow[]) => {
  if (rows.length === 0) {
    window.alert('There is no live data in the selected date range.');
    return;
  }
  const columns = Array.from(new Set(rows.flatMap(row => Object.keys(row))));
  const escape = (value: unknown) => `"${String(value ?? '').replace(/"/g, '""')}"`;
  const csv = [columns.join(','), ...rows.map(row => columns.map(column => escape(row[column])).join(','))].join('\n');
  const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }));
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = fileName;
  anchor.click();
  URL.revokeObjectURL(url);
};

export default function ReportsPage() {
  const { users, companies, exportRecords, complaints, auditLogs } = useDataStore();
  const [selectedReport, setSelectedReport] = useState<ReportId | null>(null);
  const [categoryFilter, setCategoryFilter] = useState('');
  const [dateFrom, setDateFrom] = useState(() => `${new Date().getFullYear()}-01-01`);
  const [dateTo, setDateTo] = useState(() => new Date().toISOString().slice(0, 10));

  const reportRows = useMemo<Record<ReportId, ReportRow[]>>(() => {
    const filteredCompanies = companies.filter(company => isInRange(company.created_at, dateFrom, dateTo));
    const filteredUsers = users.filter(user => isInRange(user.created_at, dateFrom, dateTo));
    const filteredExports = exportRecords.filter(record => isInRange(record.created_at, dateFrom, dateTo));
    const filteredComplaints = complaints.filter(complaint => isInRange(complaint.created_at, dateFrom, dateTo));
    const filteredAuditLogs = auditLogs.filter(log => isInRange(log.created_at, dateFrom, dateTo));
    const documents = filteredExports.flatMap(record => record.documents.map(document => ({ ...document, consignment_number: record.consignment_number, product: record.product })));

    const summarizeExports = (field: 'product' | 'destination_country' | 'province_of_production', label: string) => Array.from(
      filteredExports.reduce((groups, record) => {
        const name = record[field].trim();
        if (!name) return groups;
        const current = groups.get(name) ?? { records: 0, quantity: 0, estimated_value_usd: 0 };
        current.records += 1;
        current.quantity += record.quantity;
        current.estimated_value_usd += record.estimated_value;
        groups.set(name, current);
        return groups;
      }, new Map<string, { records: number; quantity: number; estimated_value_usd: number }>()).entries(),
      ([name, totals]) => ({ [label]: name, ...totals }),
    ).sort((a, b) => Number(b.records) - Number(a.records));

    const monthlyExports = Array.from(
      filteredExports.reduce((groups, record) => {
        const month = record.created_at.slice(0, 7);
        const current = groups.get(month) ?? { records: 0, quantity: 0, estimated_value: 0 };
        current.records += 1;
        current.quantity += record.quantity;
        current.estimated_value += record.estimated_value;
        groups.set(month, current);
        return groups;
      }, new Map<string, { records: number; quantity: number; estimated_value: number }>()).entries(),
      ([month, totals]) => ({ month, ...totals }),
    ).sort((a, b) => a.month.localeCompare(b.month));

    return {
      registered_exporters: filteredCompanies.map(company => ({ registration_number: company.registration_number, legal_name: company.legal_name, province: company.province, status: company.status, tdap_review_status: company.tdap_review_status, nafsa_review_status: company.nafsa_review_status, submitted_at: company.created_at })),
      pending_applications: filteredCompanies.filter(company => ['submitted', 'under_tdap_review', 'under_nafsa_review', 'additional_info_required'].includes(company.status)).map(company => ({ registration_number: company.registration_number, legal_name: company.legal_name, status: company.status, province: company.province, submitted_at: company.created_at })),
      system_users: filteredUsers.map(user => ({ full_name: user.full_name, email: user.email, role: user.role, institution: user.institution, is_active: user.is_active, created_at: user.created_at, last_login: user.last_login })),
      product_exports: summarizeExports('product', 'product'),
      country_exports: summarizeExports('destination_country', 'destination_country'),
      province_exports: summarizeExports('province_of_production', 'province_of_production'),
      export_trends: monthlyExports,
      sps_certificates: documents.filter(document => document.document_type.toLowerCase().includes('sps')).map(document => ({ consignment_number: document.consignment_number, product: document.product, document_type: document.document_type, verification_status: document.verification_status, uploaded_at: document.upload_date })),
      psi_reports: documents.filter(document => document.document_type.toLowerCase().includes('psi') || document.document_type.toLowerCase().includes('pre-shipment')).map(document => ({ consignment_number: document.consignment_number, product: document.product, document_type: document.document_type, verification_status: document.verification_status, uploaded_at: document.upload_date })),
      complaint_register: filteredComplaints.map(complaint => ({ tracking_number: complaint.tracking_number, category: complaint.category, subject: complaint.subject, priority: complaint.priority, status: complaint.status, sla_deadline: complaint.sla_deadline, created_at: complaint.created_at, resolved_at: complaint.resolved_at })),
      complaint_aging: filteredComplaints.filter(complaint => !['resolved', 'closed', 'rejected'].includes(complaint.status)).map(complaint => ({ tracking_number: complaint.tracking_number, status: complaint.status, priority: complaint.priority, days_open: Math.max(0, Math.floor((Date.now() - new Date(complaint.created_at).getTime()) / 86_400_000)), sla_deadline: complaint.sla_deadline })),
      sla_compliance: filteredComplaints.map(complaint => ({ tracking_number: complaint.tracking_number, status: complaint.status, sla_deadline: complaint.sla_deadline, resolved_at: complaint.resolved_at, within_sla: complaint.resolved_at ? new Date(complaint.resolved_at) <= new Date(complaint.sla_deadline) : new Date() <= new Date(complaint.sla_deadline) })),
      officer_performance: filteredUsers.filter(user => user.role === 'tdap_officer' || user.role === 'nafsa_officer').map(user => ({ full_name: user.full_name, email: user.email, role: user.role, institution: user.institution, is_active: user.is_active, last_login: user.last_login })),
      audit_trail: filteredAuditLogs.map(log => ({ occurred_at: log.created_at, user_name: log.user_name, user_role: log.user_role, action: log.action, module: log.module, record_id: log.record_id, previous_value: log.previous_value, new_value: log.new_value })),
    };
  }, [users, companies, exportRecords, complaints, auditLogs, dateFrom, dateTo]);

  const reports = useMemo(() => REPORTS.map(report => ({ ...report, count: reportRows[report.id].length })), [reportRows]);
  const filtered = reports.filter(report => !categoryFilter || report.category === categoryFilter);
  const categories = [...new Set(reports.map(report => report.category))];
  const selected = reports.find(report => report.id === selectedReport);

  const handleExport = (format: 'csv' | 'excel' | 'print') => {
    if (!selected) return;
    if (format === 'print') {
      window.print();
      return;
    }
    downloadCsv(`${selected.id}-${dateFrom || 'all'}-to-${dateTo || 'all'}.csv`, reportRows[selected.id]);
  };

  return (
    <DashboardLayout>
      <RoleGuard allow={ROUTE_ROLES['/admin/reports']}>
      <div className="space-y-6">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Reports Center</h1>
            <p className="text-gray-500">Generate and export official reports</p>
          </div>
        </div>

        <div className="grid lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2">
            <div className="card">
              <div className="p-4 border-b flex gap-3">
                <select value={categoryFilter} onChange={e => setCategoryFilter(e.target.value)} className="input-field w-48">
                  <option value="">All Categories</option>
                  {categories.map(c => <option key={c}>{c}</option>)}
                </select>
              </div>
              <div className="divide-y">
                {filtered.map(report => (
                  <div
                    key={report.id}
                    onClick={() => setSelectedReport(report.id)}
                    className={`p-4 cursor-pointer hover:bg-gray-50 ${selectedReport === report.id ? 'bg-gov-green-50 border-l-4 border-gov-green-500' : ''}`}
                  >
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="font-medium text-gray-900">{report.name}</p>
                        <p className="text-sm text-gray-500">{report.desc}</p>
                      </div>
                      <span className="badge bg-gray-100 text-gray-700">{report.count.toLocaleString()} records</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <div>
            <div className="card p-6 sticky top-4">
              <h3 className="font-semibold text-gray-900 mb-4">Export Report</h3>
              {selected ? (
                <div className="space-y-4">
                  <div className="p-3 bg-gov-green-50 rounded-lg">
                    <p className="font-medium text-gov-green-800">{selected.name}</p>
                    <p className="text-sm text-gov-green-600">{selected.count.toLocaleString()} live rows in the selected date range</p>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Date Range</label>
                    <div className="grid grid-cols-2 gap-2">
                      <input type="date" className="input-field text-sm" value={dateFrom} onChange={event => setDateFrom(event.target.value)} />
                      <input type="date" className="input-field text-sm" value={dateTo} onChange={event => setDateTo(event.target.value)} />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <button onClick={() => handleExport('print')} className="w-full flex items-center gap-3 p-3 border rounded-lg hover:bg-red-50 hover:border-red-200 transition-colors">
                      <FileText className="w-5 h-5 text-red-500" />
                      <div className="text-left"><p className="font-medium text-sm">Print / Save as PDF</p><p className="text-xs text-gray-500">Uses your browser's print dialog</p></div>
                    </button>
                    <button onClick={() => handleExport('excel')} className="w-full flex items-center gap-3 p-3 border rounded-lg hover:bg-green-50 hover:border-green-200 transition-colors">
                      <FileSpreadsheet className="w-5 h-5 text-green-500" />
                      <div className="text-left"><p className="font-medium text-sm">Export for Excel</p><p className="text-xs text-gray-500">Excel-compatible CSV file</p></div>
                    </button>
                    <button onClick={() => handleExport('csv')} className="w-full flex items-center gap-3 p-3 border rounded-lg hover:bg-blue-50 hover:border-blue-200 transition-colors">
                      <Download className="w-5 h-5 text-blue-500" />
                      <div className="text-left"><p className="font-medium text-sm">Export as CSV</p><p className="text-xs text-gray-500">Live data in a portable format</p></div>
                    </button>
                    <button onClick={() => handleExport('print')} className="w-full flex items-center gap-3 p-3 border rounded-lg hover:bg-gray-50 transition-colors">
                      <Printer className="w-5 h-5 text-gray-500" />
                      <div className="text-left"><p className="font-medium text-sm">Print Current Report</p><p className="text-xs text-gray-500">Optimized by your browser</p></div>
                    </button>
                  </div>
                </div>
              ) : (
                <p className="text-sm text-gray-400 text-center py-8">Select a report to export</p>
              )}
            </div>
          </div>
        </div>
      </div>
      </RoleGuard>
    </DashboardLayout>
  );
}
