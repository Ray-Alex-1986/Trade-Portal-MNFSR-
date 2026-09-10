'use client';

import { useState } from 'react';
import DashboardLayout from '@/components/layout/DashboardLayout';
import { mockExportRecords, mockCompanies, mockComplaints } from '@/lib/mock-data';
import { Download, FileText, FileSpreadsheet, Printer } from 'lucide-react';

const reports = [
  { name: 'Registered Exporters Report', desc: 'Complete list of all registered exporters with verification status', count: 2847, category: 'Registration' },
  { name: 'Pending Verification Applications', desc: 'Applications awaiting verification review', count: 143, category: 'Registration' },
  { name: 'Active & Inactive Users', desc: 'System users categorized by activity status', count: 2156, category: 'Users' },
  { name: 'Product-wise Exports', desc: 'Export volumes and values by product category', count: 15234, category: 'Export' },
  { name: 'Country-wise Exports', desc: 'Export data grouped by destination country', count: 87, category: 'Export' },
  { name: 'Province-wise Exports', desc: 'Export data by province of origin', count: 6, category: 'Export' },
  { name: 'Monthly & Annual Export Trends', desc: '12-month export quantity and value trends', count: 12, category: 'Trends' },
  { name: 'SPS Certificate Status', desc: 'Status of all SPS certificates', count: 14500, category: 'Certification' },
  { name: 'PSI Report Status', desc: 'Status of all pre-shipment inspection reports', count: 13800, category: 'Certification' },
  { name: 'Complaint Register', desc: 'All complaints with current status and priority', count: 892, category: 'Complaints' },
  { name: 'Complaint Aging Report', desc: 'Complaints grouped by days pending', count: 136, category: 'Complaints' },
  { name: 'SLA Compliance Report', desc: 'SLA compliance rate by officer and institution', count: 88, category: 'Compliance' },
  { name: 'Officer Performance Report', desc: 'Workload and performance metrics by officer', count: 24, category: 'Administration' },
  { name: 'Full Audit Trail Report', desc: 'Complete system activity log', count: 45230, category: 'Audit' },
];

export default function ReportsPage() {
  const [selectedReport, setSelectedReport] = useState<string | null>(null);
  const [categoryFilter, setCategoryFilter] = useState('');

  const filtered = reports.filter(r => !categoryFilter || r.category === categoryFilter);
  const categories = [...new Set(reports.map(r => r.category))];

  const handleExport = (format: string) => {
    alert(`Demo: Exporting "${selectedReport}" as ${format}. In production, this would generate a branded Government of Pakistan report.`);
  };

  return (
    <DashboardLayout>
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
                    key={report.name}
                    onClick={() => setSelectedReport(report.name)}
                    className={`p-4 cursor-pointer hover:bg-gray-50 ${selectedReport === report.name ? 'bg-gov-green-50 border-l-4 border-gov-green-500' : ''}`}
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
              {selectedReport ? (
                <div className="space-y-4">
                  <div className="p-3 bg-gov-green-50 rounded-lg">
                    <p className="font-medium text-gov-green-800">{selectedReport}</p>
                    <p className="text-sm text-gov-green-600">{reports.find(r => r.name === selectedReport)?.count.toLocaleString()} records</p>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Date Range</label>
                    <div className="grid grid-cols-2 gap-2">
                      <input type="date" className="input-field text-sm" defaultValue="2025-09-01" />
                      <input type="date" className="input-field text-sm" defaultValue="2026-09-09" />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <button onClick={() => handleExport('PDF')} className="w-full flex items-center gap-3 p-3 border rounded-lg hover:bg-red-50 hover:border-red-200 transition-colors">
                      <FileText className="w-5 h-5 text-red-500" />
                      <div className="text-left"><p className="font-medium text-sm">Export as PDF</p><p className="text-xs text-gray-500">With GoP branding</p></div>
                    </button>
                    <button onClick={() => handleExport('Excel')} className="w-full flex items-center gap-3 p-3 border rounded-lg hover:bg-green-50 hover:border-green-200 transition-colors">
                      <FileSpreadsheet className="w-5 h-5 text-green-500" />
                      <div className="text-left"><p className="font-medium text-sm">Export as Excel/XLSX</p><p className="text-xs text-gray-500">Formatted spreadsheet</p></div>
                    </button>
                    <button onClick={() => handleExport('CSV')} className="w-full flex items-center gap-3 p-3 border rounded-lg hover:bg-blue-50 hover:border-blue-200 transition-colors">
                      <Download className="w-5 h-5 text-blue-500" />
                      <div className="text-left"><p className="font-medium text-sm">Export as CSV</p><p className="text-xs text-gray-500">Raw data format</p></div>
                    </button>
                    <button onClick={() => handleExport('Print')} className="w-full flex items-center gap-3 p-3 border rounded-lg hover:bg-gray-50 transition-colors">
                      <Printer className="w-5 h-5 text-gray-500" />
                      <div className="text-left"><p className="font-medium text-sm">Print-Friendly View</p><p className="text-xs text-gray-500">Optimized layout</p></div>
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
    </DashboardLayout>
  );
}
