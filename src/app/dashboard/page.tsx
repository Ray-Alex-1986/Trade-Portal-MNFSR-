'use client';

import { useAuth } from '@/lib/auth';
import { isAdminSection } from '@/lib/auth';
import DashboardLayout from '@/components/layout/DashboardLayout';
import { useDataStore } from '@/lib/data-store';
import { monthlyExportData, exportsByProduct, exportsByCountry } from '@/lib/mock-data';
import { formatNumber, formatCurrency, getStatusColor } from '@/lib/utils';
import { Package, FileCheck, AlertTriangle, Clock, CheckCircle, XCircle, TrendingUp, Globe, BarChart3, FileText, Search, Users } from 'lucide-react';
import Link from 'next/link';
import { AreaChart, Area, BarChart, Bar, PieChart, Pie, Cell, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';

const COLORS = ['#006B3F', '#D4AF37', '#0ea5e9', '#8b5cf6', '#ef4444', '#f97316', '#06b6d4', '#84cc16'];

export default function DashboardPage() {
  const { user } = useAuth();
  const { exportRecords, complaints, companies } = useDataStore();

  const role = user?.role ?? 'exporter';
  const userIsAdmin = isAdminSection(role) || role === 'tic';
  const isBuyer = role === 'buyer';

  const myRecords = userIsAdmin
    ? exportRecords  // Admins / TIC see all records
    : exportRecords.filter(r => r.exporter_id === user?.id);  // Exporters see their own
  const myComplaints = complaints.filter(c => c.status !== 'closed').slice(0, 5);

  // Buyer-specific: verified exporters list
  const verifiedExporters = companies.filter(c => c.status === 'approved');

  const stats = {
    total: myRecords.length,
    drafts: myRecords.filter(r => r.status === 'draft').length,
    pending: myRecords.filter(r => ['submitted', 'under_tdap_review', 'under_nafsa_review', 'additional_info_required'].includes(r.status)).length,
    approved: myRecords.filter(r => r.status === 'approved').length,
    rejected: myRecords.filter(r => r.status === 'rejected').length,
    shipped: myRecords.filter(r => ['shipped', 'ready_for_shipment'].includes(r.status)).length,
    completed: myRecords.filter(r => ['delivered', 'closed'].includes(r.status)).length,
    complaints: complaints.length,
  };

  const statusDistribution = [
    { name: 'Draft', value: stats.drafts },
    { name: 'Pending', value: stats.pending },
    { name: 'Approved', value: stats.approved },
    { name: 'Rejected', value: stats.rejected },
    { name: 'Shipped', value: stats.shipped },
    { name: 'Completed', value: stats.completed },
  ].filter(s => s.value > 0);

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Welcome, {user?.full_name}</h1>
            <p className="text-gray-500">Here's an overview of your export activities</p>
          </div>
          <div className="flex gap-3">
            <Link href="/dashboard/exports/new" className="btn-primary flex items-center gap-2">
              <FileText className="w-4 h-4" /> New Export Record
            </Link>
          </div>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[
            { label: 'Total Records', value: stats.total, icon: Package, color: 'text-blue-600 bg-blue-50' },
            { label: 'Draft Submissions', value: stats.drafts, icon: FileText, color: 'text-gray-600 bg-gray-50' },
            { label: 'Pending Reviews', value: stats.pending, icon: Clock, color: 'text-yellow-600 bg-yellow-50' },
            { label: 'Approved', value: stats.approved, icon: CheckCircle, color: 'text-green-600 bg-green-50' },
            { label: 'Rejected', value: stats.rejected, icon: XCircle, color: 'text-red-600 bg-red-50' },
            { label: 'In Progress', value: stats.shipped, icon: TrendingUp, color: 'text-indigo-600 bg-indigo-50' },
            { label: 'Completed', value: stats.completed, icon: FileCheck, color: 'text-green-600 bg-green-50' },
            { label: 'Complaints', value: stats.complaints, icon: AlertTriangle, color: 'text-orange-600 bg-orange-50' },
          ].map(stat => (
            <div key={stat.label} className="card p-4">
              <div className="flex items-center gap-3">
                <div className={`w-10 h-10 rounded-lg ${stat.color} flex items-center justify-center`}>
                  <stat.icon className="w-5 h-5" />
                </div>
                <div>
                  <p className="text-2xl font-bold text-gray-900">{stat.value}</p>
                  <p className="text-xs text-gray-500">{stat.label}</p>
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Empty state for new exporters */}
        {!userIsAdmin && !isBuyer && myRecords.length === 0 && (
          <div className="card p-8 text-center">
            <div className="w-16 h-16 bg-gov-green-50 rounded-full flex items-center justify-center mx-auto mb-4">
              <Package className="w-8 h-8 text-gov-green-400" />
            </div>
            <h3 className="text-lg font-bold text-gray-900 mb-2">Welcome to the Export Portal!</h3>
            <p className="text-gray-500 mb-6 max-w-md mx-auto">You don't have any export records yet. Start by creating your first export record to track consignments, manage certifications, and monitor compliance.</p>
            <div className="flex gap-3 justify-center">
              <Link href="/dashboard/exports/new" className="btn-primary flex items-center gap-2">
                <FileText className="w-4 h-4" /> Create First Export Record
              </Link>
              <Link href="/dashboard/complaints/new" className="btn-outline">
                File a Complaint
              </Link>
            </div>
          </div>
        )}

        {/* Buyer view: Verified Exporters */}
        {isBuyer && (
          <div className="card">
            <div className="flex items-center justify-between p-4 border-b">
              <h3 className="font-semibold text-gray-900 flex items-center gap-2"><Users className="w-4 h-4" /> Verified Exporters</h3>
              <span className="text-sm text-gray-500">{verifiedExporters.length} approved companies</span>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="text-left p-3 font-medium text-gray-500">Company</th>
                    <th className="text-left p-3 font-medium text-gray-500">Province</th>
                    <th className="text-left p-3 font-medium text-gray-500">Business Type</th>
                    <th className="text-left p-3 font-medium text-gray-500">Products</th>
                    <th className="text-left p-3 font-medium text-gray-500">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {verifiedExporters.length === 0 ? (
                    <tr><td colSpan={5} className="p-8 text-center text-gray-400">No verified exporters yet.</td></tr>
                  ) : (
                    verifiedExporters.slice(0, 10).map(c => (
                      <tr key={c.id} className="border-t hover:bg-gray-50">
                        <td className="p-3">
                          <div>
                            <p className="font-medium text-gray-900">{c.legal_name}</p>
                            <p className="text-xs text-gray-500">{c.registration_number}</p>
                          </div>
                        </td>
                        <td className="p-3 text-gray-500">{c.province}</td>
                        <td className="p-3 text-gray-500">{c.nature_of_business}</td>
                        <td className="p-3 text-gray-500">{c.main_export_categories.join(', ') || '-'}</td>
                        <td className="p-3"><span className="badge bg-green-100 text-green-800">Verified</span></td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Charts */}
        <div className="grid md:grid-cols-2 gap-6">
          <div className="card p-6">
            <h3 className="font-semibold text-gray-900 mb-4">Monthly Export Submissions</h3>
            <ResponsiveContainer width="100%" height={220}>
              <AreaChart data={monthlyExportData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="month" tick={{ fontSize: 10 }} />
                <YAxis tick={{ fontSize: 10 }} />
                <Tooltip />
                <Area type="monotone" dataKey="submissions" stroke="#006B3F" fill="#006B3F" fillOpacity={0.15} strokeWidth={2} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
          <div className="card p-6">
            <h3 className="font-semibold text-gray-900 mb-4">Export Value Trend</h3>
            <ResponsiveContainer width="100%" height={220}>
              <LineChart data={monthlyExportData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="month" tick={{ fontSize: 10 }} />
                <YAxis tick={{ fontSize: 10 }} tickFormatter={v => `${(v/1000000).toFixed(1)}M`} />
                <Tooltip formatter={(v: any) => `$${(Number(v)/1000000).toFixed(1)}M`} />
                <Line type="monotone" dataKey="value" stroke="#D4AF37" strokeWidth={2} />
              </LineChart>
            </ResponsiveContainer>
          </div>
          <div className="card p-6">
            <h3 className="font-semibold text-gray-900 mb-4">Exports by Product Category</h3>
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={exportsByProduct.slice(0, 6)}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="name" tick={{ fontSize: 9 }} />
                <YAxis tick={{ fontSize: 10 }} />
                <Tooltip />
                <Bar dataKey="value" fill="#006B3F" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
          <div className="card p-6">
            <h3 className="font-semibold text-gray-900 mb-4">Record Status Distribution</h3>
            <ResponsiveContainer width="100%" height={220}>
              <PieChart>
                <Pie data={statusDistribution} cx="50%" cy="50%" innerRadius={50} outerRadius={80} dataKey="value" label={({ name, value }: any) => `${name || ''}: ${value || 0}`}>
                  {statusDistribution.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Recent Records */}
        <div className="card">
          <div className="flex items-center justify-between p-4 border-b">
            <h3 className="font-semibold text-gray-900">Recent Export Records</h3>
            <Link href="/dashboard/exports" className="text-sm text-gov-green-500 hover:underline">View All</Link>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50">
                <tr>
                  <th className="text-left p-3 font-medium text-gray-500">Consignment #</th>
                  <th className="text-left p-3 font-medium text-gray-500">Product</th>
                  <th className="text-left p-3 font-medium text-gray-500">Destination</th>
                  <th className="text-left p-3 font-medium text-gray-500">Status</th>
                  <th className="text-left p-3 font-medium text-gray-500">Date</th>
                </tr>
              </thead>
              <tbody>
                {myRecords.length === 0 ? (
                  <tr><td colSpan={5} className="p-8 text-center text-gray-400">No export records found. Click "New Export Record" to get started.</td></tr>
                ) : (
                myRecords.slice(0, 5).map(record => (
                  <tr key={record.id} className="border-t hover:bg-gray-50">
                    <td className="p-3 font-mono text-gov-green-600">{record.consignment_number}</td>
                    <td className="p-3">{record.product}</td>
                    <td className="p-3">{record.destination_country}</td>
                    <td className="p-3"><span className={`badge ${getStatusColor(record.status)}`}>{record.status.replace(/_/g, ' ').toUpperCase()}</span></td>
                    <td className="p-3 text-gray-500">{new Date(record.created_at).toLocaleDateString()}</td>
                  </tr>
                ))
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Notifications */}
        <div className="card">
          <div className="p-4 border-b">
            <h3 className="font-semibold text-gray-900">Pending Actions & Notifications</h3>
          </div>
          <div className="divide-y">
            {[
              { text: 'Export record EXP-2025003 approved by TDAP', time: '2 hours ago', type: 'success' },
              { text: 'SPS Certificate for EXP-2025010 verified by NAFSA', time: '1 day ago', type: 'success' },
              { text: 'Additional information requested for EXP-2025015', time: '2 days ago', type: 'warning' },
              { text: 'Complaint CMP-2025005 status updated to Under Review', time: '3 days ago', type: 'info' },
            ].map((n, i) => (
              <div key={i} className="p-4 flex items-center gap-3 hover:bg-gray-50">
                <div className={`w-2 h-2 rounded-full ${n.type === 'success' ? 'bg-green-500' : n.type === 'warning' ? 'bg-yellow-500' : 'bg-blue-500'}`} />
                <p className="text-sm text-gray-700 flex-1">{n.text}</p>
                <span className="text-xs text-gray-400">{n.time}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
}
