'use client';

import { useMemo } from 'react';
import Link from 'next/link';
import DashboardLayout from '@/components/layout/DashboardLayout';
import RoleGuard from '@/components/auth/RoleGuard';
import { useAuth } from '@/lib/auth';
import { useDataStore } from '@/lib/data-store';
import { hasPermission, ROUTE_ROLES } from '@/lib/permissions';
import { formatDate, getStatusColor } from '@/lib/utils';
import {
  Package, FileCheck, AlertTriangle, Clock, CheckCircle, XCircle, TrendingUp,
  FileText, Users, ArrowRight, Info,
} from 'lucide-react';
import { AreaChart, Area, BarChart, Bar, PieChart, Pie, Cell, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';

const COLORS = ['#006B3F', '#D4AF37', '#0ea5e9', '#8b5cf6', '#ef4444', '#f97316', '#06b6d4', '#84cc16'];
const FX_TO_USD: Record<string, number> = { USD: 1, PKR: 1 / 278, EUR: 1.08, GBP: 1.27, AED: 0.272294 };

const PENDING_STATUSES = ['submitted', 'under_tdap_review', 'under_nafsa_review', 'additional_info_required'];

function relativeTime(value: string) {
  const elapsedSeconds = Math.max(0, Math.floor((Date.now() - new Date(value).getTime()) / 1000));
  if (elapsedSeconds < 60) return 'Just now';
  if (elapsedSeconds < 3600) return `${Math.floor(elapsedSeconds / 60)}m ago`;
  if (elapsedSeconds < 86400) return `${Math.floor(elapsedSeconds / 3600)}h ago`;
  return `${Math.floor(elapsedSeconds / 86400)}d ago`;
}

export default function DashboardPage() {
  const { user } = useAuth();
  const { exportRecords, complaints, companies, notifications, isLoaded } = useDataStore();

  const canViewAllRecords = hasPermission(user?.role, 'canViewAllExportRecords');
  const canCreateRecord = hasPermission(user?.role, 'canCreateExportRecord');
  const canViewAllComplaints = hasPermission(user?.role, 'canViewAllComplaints');
  const isBuyer = user?.role === 'buyer';

  const myRecords = useMemo(
    () => (canViewAllRecords ? exportRecords : exportRecords.filter(record => record.exporter_id === user?.id)),
    [exportRecords, user?.id, canViewAllRecords],
  );

  /** The exporter's own registration drives what they are allowed to do next. */
  const myCompanies = useMemo(
    () => companies.filter(company => company.owner_id === user?.id),
    [companies, user?.id],
  );
  const myCompany = myCompanies.find(company => company.status === 'approved') ?? myCompanies[0];

  const myComplaints = useMemo(() => {
    if (canViewAllComplaints) return complaints;
    if (!user) return [];
    const names = new Set(myCompanies.flatMap(company => [company.legal_name, company.trading_name ?? '']).filter(Boolean).map(name => name.toLowerCase()));
    return complaints.filter(complaint =>
      complaint.email.toLowerCase() === user.email.toLowerCase()
      || (complaint.exporter_company && names.has(complaint.exporter_company.toLowerCase())));
  }, [complaints, canViewAllComplaints, user, myCompanies]);

  const myNotifications = useMemo(
    () => notifications.filter(item => !user || item.user_id === user.id),
    [notifications, user],
  );

  const verifiedExporters = useMemo(
    () => companies.filter(company => company.status === 'approved'),
    [companies],
  );

  const monthlyExportData = useMemo(() => {
    const now = new Date();
    const months = Array.from({ length: 6 }, (_, index) => {
      const date = new Date(now.getFullYear(), now.getMonth() - 5 + index, 1);
      return { year: date.getFullYear(), monthIndex: date.getMonth(), month: date.toLocaleString('en-US', { month: 'short' }), submissions: 0, value: 0 };
    });
    for (const record of myRecords) {
      const createdAt = new Date(record.created_at);
      const bucket = months.find(item => item.year === createdAt.getFullYear() && item.monthIndex === createdAt.getMonth());
      if (!bucket) continue;
      bucket.submissions += 1;
      bucket.value += record.estimated_value * (FX_TO_USD[record.currency?.toUpperCase()] ?? 1);
    }
    return months.map(({ year: _year, monthIndex: _monthIndex, ...entry }) => entry);
  }, [myRecords]);

  const exportsByProduct = useMemo(() => Array.from(
    myRecords.reduce((counts, record) => {
      const product = record.product.trim();
      if (product) counts.set(product, (counts.get(product) ?? 0) + 1);
      return counts;
    }, new Map<string, number>()).entries(),
    ([name, value]) => ({ name, value }),
  ).sort((a, b) => b.value - a.value || a.name.localeCompare(b.name)), [myRecords]);

  const stats = {
    total: myRecords.length,
    drafts: myRecords.filter(r => r.status === 'draft').length,
    pending: myRecords.filter(r => PENDING_STATUSES.includes(r.status)).length,
    approved: myRecords.filter(r => r.status === 'approved').length,
    rejected: myRecords.filter(r => r.status === 'rejected').length,
    shipped: myRecords.filter(r => ['shipped', 'ready_for_shipment'].includes(r.status)).length,
    completed: myRecords.filter(r => ['delivered', 'closed'].includes(r.status)).length,
    complaints: myComplaints.length,
  };

  const statusDistribution = [
    { name: 'Draft', value: stats.drafts },
    { name: 'Pending', value: stats.pending },
    { name: 'Approved', value: stats.approved },
    { name: 'Rejected', value: stats.rejected },
    { name: 'Shipped', value: stats.shipped },
    { name: 'Completed', value: stats.completed },
  ].filter(s => s.value > 0);

  const actionNeeded = myRecords.filter(record => ['additional_info_required', 'rejected'].includes(record.status));

  return (
    <DashboardLayout>
      <RoleGuard allow={ROUTE_ROLES['/dashboard']}>
        <div className="space-y-6">
          {/* Header */}
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">Welcome, {user?.full_name}</h1>
              <p className="text-gray-500">
                {isBuyer ? 'Verify exporters and follow up on complaints you filed'
                  : canViewAllRecords ? 'Portal-wide export activity for your institution'
                    : 'Here is an overview of your export activities'}
              </p>
            </div>
            <div className="flex flex-wrap gap-3">
              {canCreateRecord && (
                <Link href="/dashboard/exports/new" className="btn-primary flex items-center gap-2">
                  <FileText className="w-4 h-4" /> New Export Record
                </Link>
              )}
              <Link href="/complaints/submit" className="btn-outline flex items-center gap-2">
                <AlertTriangle className="w-4 h-4" /> File a Complaint
              </Link>
            </div>
          </div>

          {/* Registration status for exporters */}
          {canCreateRecord && (
            <div className="card p-4">
              {myCompany ? (
                <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
                  <div>
                    <p className="text-sm text-gray-500">Company registration</p>
                    <p className="font-semibold text-gray-900">{myCompany.legal_name}</p>
                    <p className="text-xs text-gray-400 font-mono">{myCompany.registration_number}</p>
                  </div>
                  <div className="flex flex-wrap items-center gap-2 text-xs">
                    <span className={`badge ${getStatusColor(myCompany.status === 'approved' ? 'Approved' : myCompany.status === 'rejected' ? 'Rejected' : 'Pending')}`}>
                      {myCompany.status.replace(/_/g, ' ').toUpperCase()}
                    </span>
                    <span className="text-gray-500">TDAP: {myCompany.tdap_review_status.replace(/_/g, ' ')}</span>
                    <span className="text-gray-500">NAFSA: {myCompany.nafsa_review_status.replace(/_/g, ' ')}</span>
                  </div>
                </div>
              ) : (
                <div className="flex items-start gap-2 text-sm text-gray-600">
                  <Info className="w-4 h-4 mt-0.5 flex-shrink-0 text-gray-400" />
                  <span>No company registration is linked to this account yet. Submit a registration to start filing export records.</span>
                </div>
              )}
              {myCompany && myCompany.status !== 'approved' && (
                <p className="mt-3 text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-lg p-2">
                  Export records can be submitted once both review stages approve your registration.
                </p>
              )}
            </div>
          )}

          {/* Records needing the exporter's attention */}
          {actionNeeded.length > 0 && (
            <div className="card p-4 border-amber-200 bg-amber-50">
              <div className="flex items-start gap-2">
                <AlertTriangle className="w-5 h-5 text-amber-500 flex-shrink-0 mt-0.5" />
                <div className="flex-1">
                  <p className="font-medium text-amber-900">{actionNeeded.length} record{actionNeeded.length === 1 ? '' : 's'} need your attention</p>
                  <ul className="mt-1 space-y-1 text-sm text-amber-800">
                    {actionNeeded.slice(0, 3).map(record => (
                      <li key={record.id}>
                        <span className="font-mono">{record.consignment_number}</span> — {record.status.replace(/_/g, ' ')}
                      </li>
                    ))}
                  </ul>
                  <Link href="/dashboard/exports" className="inline-flex items-center gap-1 mt-2 text-sm font-medium text-amber-900 hover:underline">
                    Review and resubmit <ArrowRight className="w-3.5 h-3.5" />
                  </Link>
                </div>
              </div>
            </div>
          )}

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
          {canCreateRecord && isLoaded && myRecords.length === 0 && (
            <div className="card p-8 text-center">
              <div className="w-16 h-16 bg-gov-green-50 rounded-full flex items-center justify-center mx-auto mb-4">
                <Package className="w-8 h-8 text-gov-green-400" />
              </div>
              <h3 className="text-lg font-bold text-gray-900 mb-2">Welcome to the Export Portal</h3>
              <p className="text-gray-500 mb-6 max-w-md mx-auto">
                You do not have any export records yet. Create your first export record to track consignments, manage certifications, and monitor compliance.
              </p>
              <div className="flex gap-3 justify-center">
                <Link href="/dashboard/exports/new" className="btn-primary flex items-center gap-2">
                  <FileText className="w-4 h-4" /> Create First Export Record
                </Link>
                <Link href="/complaints/submit" className="btn-outline">File a Complaint</Link>
              </div>
            </div>
          )}

          {/* Buyer view: Verified Exporters */}
          {isBuyer && (
            <div className="card">
              <div className="flex items-center justify-between p-4 border-b">
                <h3 className="font-semibold text-gray-900 flex items-center gap-2"><Users className="w-4 h-4" /> Verified Exporters</h3>
                <div className="flex items-center gap-3">
                  <span className="text-sm text-gray-500">{verifiedExporters.length} approved companies</span>
                  <Link href="/dashboard/exporters" className="text-sm text-gov-green-600 hover:underline">View all</Link>
                </div>
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
                      verifiedExporters.slice(0, 10).map(company => (
                        <tr key={company.id} className="border-t hover:bg-gray-50">
                          <td className="p-3">
                            <p className="font-medium text-gray-900">{company.legal_name}</p>
                            <p className="text-xs text-gray-500 font-mono">{company.registration_number}</p>
                          </td>
                          <td className="p-3 text-gray-500">{company.province}</td>
                          <td className="p-3 text-gray-500">{company.nature_of_business}</td>
                          <td className="p-3 text-gray-500">{company.main_export_categories.join(', ') || '—'}</td>
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
          {myRecords.length > 0 && (
            <div className="grid md:grid-cols-2 gap-6">
              <div className="card p-6">
                <h3 className="font-semibold text-gray-900 mb-4">Monthly Export Submissions</h3>
                <ResponsiveContainer width="100%" height={220}>
                  <AreaChart data={monthlyExportData}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="month" tick={{ fontSize: 10 }} />
                    <YAxis tick={{ fontSize: 10 }} allowDecimals={false} />
                    <Tooltip />
                    <Area type="monotone" dataKey="submissions" stroke="#006B3F" fill="#006B3F" fillOpacity={0.15} strokeWidth={2} name="Submissions" />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
              <div className="card p-6">
                <h3 className="font-semibold text-gray-900 mb-4">Export Value Trend (USD)</h3>
                <ResponsiveContainer width="100%" height={220}>
                  <LineChart data={monthlyExportData}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="month" tick={{ fontSize: 10 }} />
                    <YAxis tick={{ fontSize: 10 }} tickFormatter={value => `${(Number(value) / 1_000_000).toFixed(1)}M`} />
                    <Tooltip formatter={value => `$${(Number(value) / 1_000_000).toFixed(2)}M`} />
                    <Line type="monotone" dataKey="value" stroke="#D4AF37" strokeWidth={2} name="Value" />
                  </LineChart>
                </ResponsiveContainer>
              </div>
              <div className="card p-6">
                <h3 className="font-semibold text-gray-900 mb-4">Exports by Product</h3>
                <ResponsiveContainer width="100%" height={220}>
                  <BarChart data={exportsByProduct.slice(0, 6)}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="name" tick={{ fontSize: 9 }} />
                    <YAxis tick={{ fontSize: 10 }} allowDecimals={false} />
                    <Tooltip />
                    <Bar dataKey="value" fill="#006B3F" radius={[4, 4, 0, 0]} name="Records" />
                  </BarChart>
                </ResponsiveContainer>
              </div>
              <div className="card p-6">
                <h3 className="font-semibold text-gray-900 mb-4">Record Status Distribution</h3>
                <ResponsiveContainer width="100%" height={220}>
                  <PieChart>
                    <Pie
                      data={statusDistribution}
                      cx="50%"
                      cy="50%"
                      innerRadius={50}
                      outerRadius={80}
                      dataKey="value"
                      label={entry => `${entry.name ?? ''}: ${entry.value ?? 0}`}
                    >
                      {statusDistribution.map((entry, index) => <Cell key={entry.name} fill={COLORS[index % COLORS.length]} />)}
                    </Pie>
                    <Tooltip />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            </div>
          )}

          {/* Recent Records */}
          {!isBuyer && (
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
                      <tr>
                        <td colSpan={5} className="p-8 text-center text-gray-400">
                          {isLoaded ? 'No export records found.' : 'Loading export records…'}
                        </td>
                      </tr>
                    ) : (
                      myRecords.slice(0, 5).map(record => (
                        <tr key={record.id} className="border-t hover:bg-gray-50">
                          <td className="p-3 font-mono text-gov-green-600">{record.consignment_number}</td>
                          <td className="p-3">{record.product}</td>
                          <td className="p-3">{record.destination_country || '—'}</td>
                          <td className="p-3"><span className={`badge ${getStatusColor(record.status)}`}>{record.status.replace(/_/g, ' ').toUpperCase()}</span></td>
                          <td className="p-3 text-gray-500">{formatDate(record.created_at)}</td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Notifications */}
          <div className="card">
            <div className="flex items-center justify-between p-4 border-b">
              <h3 className="font-semibold text-gray-900">Pending Actions &amp; Notifications</h3>
              <Link href="/dashboard/notifications" className="text-sm text-gov-green-500 hover:underline">View All</Link>
            </div>
            <div className="divide-y">
              {myNotifications.length === 0 ? (
                <div className="p-6 text-center text-sm text-gray-400">No notifications yet.</div>
              ) : myNotifications.slice(0, 5).map(notification => (
                <div key={notification.id} className="p-4 flex items-center gap-3 hover:bg-gray-50">
                  <div className={`w-2 h-2 rounded-full flex-shrink-0 ${notification.type === 'success' ? 'bg-green-500' : notification.type === 'warning' ? 'bg-yellow-500' : notification.type === 'error' ? 'bg-red-500' : 'bg-blue-500'}`} />
                  <p className="text-sm text-gray-700 flex-1">
                    <span className="font-medium">{notification.title}</span>: {notification.message}
                  </p>
                  <span className="text-xs text-gray-400 whitespace-nowrap">{relativeTime(notification.created_at)}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </RoleGuard>
    </DashboardLayout>
  );
}
