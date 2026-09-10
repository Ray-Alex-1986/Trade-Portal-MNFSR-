'use client';

import { useState } from 'react';
import DashboardLayout from '@/components/layout/DashboardLayout';
import { mockCompanies, mockExportRecords, mockComplaints, mockUsers, monthlyExportData, exportsByProduct, exportsByCountry } from '@/lib/mock-data';
import { formatNumber, getStatusColor } from '@/lib/utils';
import { Users, Package, FileCheck, AlertTriangle, TrendingUp, Globe, Clock, CheckCircle, XCircle, BarChart3, Shield } from 'lucide-react';
import { AreaChart, Area, BarChart, Bar, PieChart, Pie, Cell, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';

const COLORS = ['#006B3F', '#D4AF37', '#0ea5e9', '#8b5cf6', '#ef4444', '#f97316', '#06b6d4', '#84cc16', '#ec4899', '#14b8a6'];

export default function AdminDashboardPage() {
  const [period, setPeriod] = useState('12m');

  const kpis = [
    { label: 'Registered Companies', value: mockCompanies.length + 2817, icon: Users, color: 'text-blue-600 bg-blue-50', trend: '+12%' },
    { label: 'Verified Exporters', value: mockCompanies.filter(c => c.status === 'approved').length + 2650, icon: CheckCircle, color: 'text-green-600 bg-green-50', trend: '+8%' },
    { label: 'Pending Registrations', value: mockCompanies.filter(c => ['submitted', 'under_tdap_review', 'under_nafsa_review'].includes(c.status)).length + 143, icon: Clock, color: 'text-yellow-600 bg-yellow-50', trend: '-5%' },
    { label: 'Active Users', value: mockUsers.filter(u => u.is_active).length + 2146, icon: Users, color: 'text-indigo-600 bg-indigo-50', trend: '+15%' },
    { label: 'Total Export Records', value: mockExportRecords.length + 15174, icon: Package, color: 'text-purple-600 bg-purple-50', trend: '+22%' },
    { label: 'Approved Consignments', value: mockExportRecords.filter(r => r.status === 'approved').length + 12450, icon: FileCheck, color: 'text-green-600 bg-green-50', trend: '+18%' },
    { label: 'Pending Certifications', value: 143, icon: Shield, color: 'text-orange-600 bg-orange-50', trend: '-3%' },
    { label: 'Est. Export Value (USD)', value: '45.2M', icon: TrendingUp, color: 'text-green-600 bg-green-50', trend: '+28%' },
    { label: 'Total Complaints', value: mockComplaints.length + 872, icon: AlertTriangle, color: 'text-red-600 bg-red-50', trend: '+4%' },
    { label: 'Open Complaints', value: mockComplaints.filter(c => !['resolved', 'closed'].includes(c.status)).length + 136, icon: AlertTriangle, color: 'text-orange-600 bg-orange-50', trend: '-8%' },
    { label: 'Resolved Complaints', value: mockComplaints.filter(c => ['resolved', 'closed'].includes(c.status)).length + 756, icon: CheckCircle, color: 'text-green-600 bg-green-50', trend: '+12%' },
    { label: 'Avg Resolution (days)', value: '14.2', icon: Clock, color: 'text-blue-600 bg-blue-50', trend: '-15%' },
    { label: 'SPS Compliance Rate', value: '94.2%', icon: Shield, color: 'text-green-600 bg-green-50', trend: '+2%' },
    { label: 'Countries Served', value: 87, icon: Globe, color: 'text-cyan-600 bg-cyan-50', trend: '+5' },
    { label: 'SLA Compliance', value: '88.5%', icon: BarChart3, color: 'text-purple-600 bg-purple-50', trend: '+3%' },
    { label: 'PSI Compliance Rate', value: '91.8%', icon: FileCheck, color: 'text-green-600 bg-green-50', trend: '+1%' },
  ];

  const verificationStatusData = [
    { name: 'Verified', value: 2650 },
    { name: 'Pending', value: 143 },
    { name: 'Rejected', value: 28 },
    { name: 'Additional Info', value: 26 },
  ];

  const consignmentStatusData = [
    { name: 'Approved', value: 12450 },
    { name: 'Under Review', value: 1200 },
    { name: 'Shipped', value: 890 },
    { name: 'Delivered', value: 544 },
    { name: 'Rejected', value: 150 },
  ];

  const complaintsByCategory = [
    { name: 'Quality', value: 245 }, { name: 'SPS', value: 180 }, { name: 'Quantity', value: 120 },
    { name: 'Packaging', value: 95 }, { name: 'Documentation', value: 88 }, { name: 'Delay', value: 75 },
    { name: 'Payment', value: 52 }, { name: 'Other', value: 37 },
  ];

  const complaintTrend = [
    { month: 'Sep 25', received: 65, resolved: 58 }, { month: 'Oct 25', received: 72, resolved: 65 },
    { month: 'Nov 25', received: 58, resolved: 62 }, { month: 'Dec 25', received: 80, resolved: 70 },
    { month: 'Jan 26', received: 75, resolved: 68 }, { month: 'Feb 26', received: 62, resolved: 72 },
    { month: 'Mar 26', received: 85, resolved: 78 }, { month: 'Apr 26', received: 90, resolved: 82 },
    { month: 'May 26', received: 78, resolved: 85 }, { month: 'Jun 26', received: 70, resolved: 75 },
    { month: 'Jul 26', received: 82, resolved: 80 }, { month: 'Aug 26', received: 76, resolved: 79 },
  ];

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">MNFSR Super Admin Dashboard</h1>
            <p className="text-gray-500">National Export Monitoring & Management Overview</p>
          </div>
          <div className="flex gap-3 items-center">
            <select value={period} onChange={e => setPeriod(e.target.value)} className="input-field w-40">
              <option value="1m">Last Month</option>
              <option value="3m">Last 3 Months</option>
              <option value="6m">Last 6 Months</option>
              <option value="12m">Last 12 Months</option>
              <option value="ytd">Year to Date</option>
            </select>
          </div>
        </div>

        {/* KPI Grid */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {kpis.map(kpi => (
            <div key={kpi.label} className="card p-4">
              <div className="flex items-center justify-between mb-2">
                <div className={`w-9 h-9 rounded-lg ${kpi.color} flex items-center justify-center`}>
                  <kpi.icon className="w-4 h-4" />
                </div>
                <span className={`text-xs font-medium ${kpi.trend.startsWith('+') ? 'text-green-600' : 'text-red-600'}`}>
                  {kpi.trend}
                </span>
              </div>
              <p className="text-xl font-bold text-gray-900">{typeof kpi.value === 'number' ? formatNumber(kpi.value) : kpi.value}</p>
              <p className="text-xs text-gray-500">{kpi.label}</p>
            </div>
          ))}
        </div>

        {/* Charts Row 1 */}
        <div className="grid md:grid-cols-2 gap-6">
          <div className="card p-6">
            <h3 className="font-semibold text-gray-900 mb-4">Export Registrations by Month</h3>
            <ResponsiveContainer width="100%" height={250}>
              <AreaChart data={monthlyExportData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="month" tick={{ fontSize: 10 }} />
                <YAxis tick={{ fontSize: 10 }} />
                <Tooltip />
                <Area type="monotone" dataKey="submissions" stroke="#006B3F" fill="#006B3F" fillOpacity={0.15} strokeWidth={2} name="Registrations" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
          <div className="card p-6">
            <h3 className="font-semibold text-gray-900 mb-4">Export Value by Month (USD)</h3>
            <ResponsiveContainer width="100%" height={250}>
              <LineChart data={monthlyExportData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="month" tick={{ fontSize: 10 }} />
                <YAxis tick={{ fontSize: 10 }} tickFormatter={v => `${(v/1000000).toFixed(1)}M`} />
                <Tooltip formatter={(v: any) => `$${(Number(v)/1000000).toFixed(1)}M`} />
                <Line type="monotone" dataKey="value" stroke="#D4AF37" strokeWidth={2} dot={{ fill: '#D4AF37' }} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Charts Row 2 */}
        <div className="grid md:grid-cols-3 gap-6">
          <div className="card p-6">
            <h3 className="font-semibold text-gray-900 mb-4">Top Exported Commodities</h3>
            <ResponsiveContainer width="100%" height={250}>
              <BarChart data={exportsByProduct} layout="vertical">
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis type="number" tick={{ fontSize: 9 }} />
                <YAxis dataKey="name" type="category" width={80} tick={{ fontSize: 9 }} />
                <Tooltip />
                <Bar dataKey="value" fill="#006B3F" radius={[0, 4, 4, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
          <div className="card p-6">
            <h3 className="font-semibold text-gray-900 mb-4">Exports by Destination</h3>
            <ResponsiveContainer width="100%" height={250}>
              <PieChart>
                <Pie data={exportsByCountry.slice(0, 8)} cx="50%" cy="50%" outerRadius={80} dataKey="value" label={({ name }) => (name || '').substring(0, 8)}>
                  {exportsByCountry.slice(0, 8).map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          </div>
          <div className="card p-6">
            <h3 className="font-semibold text-gray-900 mb-4">Company Verification Status</h3>
            <ResponsiveContainer width="100%" height={250}>
              <PieChart>
                <Pie data={verificationStatusData} cx="50%" cy="50%" innerRadius={50} outerRadius={80} dataKey="value" label={({ name, value }: any) => `${name || ''}: ${value || 0}`}>
                  {verificationStatusData.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Charts Row 3 */}
        <div className="grid md:grid-cols-2 gap-6">
          <div className="card p-6">
            <h3 className="font-semibold text-gray-900 mb-4">Complaints by Category</h3>
            <ResponsiveContainer width="100%" height={250}>
              <BarChart data={complaintsByCategory}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="name" tick={{ fontSize: 10 }} />
                <YAxis tick={{ fontSize: 10 }} />
                <Tooltip />
                <Bar dataKey="value" fill="#ef4444" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
          <div className="card p-6">
            <h3 className="font-semibold text-gray-900 mb-4">Complaint Resolution Trend</h3>
            <ResponsiveContainer width="100%" height={250}>
              <LineChart data={complaintTrend}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="month" tick={{ fontSize: 10 }} />
                <YAxis tick={{ fontSize: 10 }} />
                <Tooltip />
                <Line type="monotone" dataKey="received" stroke="#ef4444" strokeWidth={2} name="Received" />
                <Line type="monotone" dataKey="resolved" stroke="#22c55e" strokeWidth={2} name="Resolved" />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Recent Activity */}
        <div className="card">
          <div className="p-4 border-b flex items-center justify-between">
            <h3 className="font-semibold text-gray-900">Recent Activity & Pending Actions</h3>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50">
                <tr>
                  <th className="text-left p-3 font-medium text-gray-500">Type</th>
                  <th className="text-left p-3 font-medium text-gray-500">Reference</th>
                  <th className="text-left p-3 font-medium text-gray-500">Description</th>
                  <th className="text-left p-3 font-medium text-gray-500">Status</th>
                  <th className="text-left p-3 font-medium text-gray-500">Date</th>
                </tr>
              </thead>
              <tbody>
                {[
                  { type: 'Registration', ref: 'REG-2024028', desc: 'Sukkur Dates Trading - New registration', status: 'Pending', date: 'Sep 9, 2026' },
                  { type: 'Export', ref: 'EXP-2025058', desc: 'Basmati Rice to China - 150 MT', status: 'Under Review', date: 'Sep 9, 2026' },
                  { type: 'Complaint', ref: 'CMP-2025019', desc: 'Quality concern from UAE buyer', status: 'Investigation', date: 'Sep 8, 2026' },
                  { type: 'Registration', ref: 'REG-2024025', desc: 'Thatta Seafood Exports - Approved', status: 'Approved', date: 'Sep 8, 2026' },
                  { type: 'Export', ref: 'EXP-2025055', desc: 'Mango (Chaunsa) to Saudi Arabia - Shipped', status: 'Shipped', date: 'Sep 7, 2026' },
                ].map((item, i) => (
                  <tr key={i} className="border-t hover:bg-gray-50">
                    <td className="p-3"><span className="badge bg-gray-100 text-gray-700">{item.type}</span></td>
                    <td className="p-3 font-mono text-gov-green-600">{item.ref}</td>
                    <td className="p-3">{item.desc}</td>
                    <td className="p-3"><span className={`badge ${getStatusColor(item.status)}`}>{item.status}</span></td>
                    <td className="p-3 text-gray-500">{item.date}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
}
