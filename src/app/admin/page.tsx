'use client';

import { useMemo, useState } from 'react';
import DashboardLayout from '@/components/layout/DashboardLayout';
import RoleGuard from '@/components/auth/RoleGuard';
import { useDataStore } from '@/lib/data-store';
import { useAuth } from '@/lib/auth';
import { getReviewStage, isInReviewQueue, ROUTE_ROLES } from '@/lib/permissions';
import { useToast } from '@/components/ui/Toast';
import { formatNumber, getStatusColor } from '@/lib/utils';
import { Users, Package, FileCheck, AlertTriangle, TrendingUp, Globe, Clock, CheckCircle, BarChart3, Shield, RotateCcw, Plug } from 'lucide-react';
import Link from 'next/link';
import { AreaChart, Area, BarChart, Bar, PieChart, Pie, Cell, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';

const COLORS = ['#006B3F', '#D4AF37', '#0ea5e9', '#8b5cf6', '#ef4444', '#f97316', '#06b6d4', '#84cc16', '#ec4899', '#14b8a6'];
const FX_TO_USD: Record<string, number> = { USD: 1, PKR: 1 / 278, EUR: 1.08, GBP: 1.27 };

type Period = '1m' | '3m' | '6m' | '12m' | 'ytd';
type DateBounds = { start: Date; end: Date };

const dateInBounds = (value: string | undefined, bounds: DateBounds) => {
  if (!value) return false;
  const date = new Date(value);
  return !Number.isNaN(date.getTime()) && date >= bounds.start && date <= bounds.end;
};

function getBounds(period: Period, now: Date): { current: DateBounds; previous: DateBounds } {
  const end = new Date(now);
  let start: Date;
  if (period === 'ytd') {
    start = new Date(now.getFullYear(), 0, 1);
  } else {
    const months = Number(period.slice(0, -1));
    start = new Date(now);
    start.setMonth(start.getMonth() - months);
  }
  const elapsed = end.getTime() - start.getTime();
  return {
    current: { start, end },
    previous: { start: new Date(start.getTime() - elapsed), end: new Date(start) },
  };
}

function formatValue(value: number | null, suffix = ''): string {
  if (value === null || Number.isNaN(value)) return '—';
  return `${value.toLocaleString(undefined, { maximumFractionDigits: 1 })}${suffix}`;
}

function formatUsd(value: number): string {
  if (value >= 1_000_000) return `$${(value / 1_000_000).toFixed(2)}M`;
  if (value >= 1_000) return `$${(value / 1_000).toFixed(1)}K`;
  return `$${value.toFixed(0)}`;
}

function trend(current: number | null, previous: number | null, lowerIsBetter = false) {
  if (current === null || previous === null || previous === 0) {
    return { label: current && current > 0 && previous === 0 ? 'New' : '—', positive: true };
  }
  const delta = ((current - previous) / Math.abs(previous)) * 100;
  const positive = lowerIsBetter ? delta <= 0 : delta >= 0;
  return { label: `${delta >= 0 ? '+' : ''}${delta.toFixed(0)}%`, positive };
}

function averageResolutionDays(items: { created_at: string; resolved_at?: string }[]): number | null {
  const durations = items
    .filter(item => item.resolved_at)
    .map(item => (new Date(item.resolved_at as string).getTime() - new Date(item.created_at).getTime()) / 86_400_000)
    .filter(value => Number.isFinite(value) && value >= 0);
  return durations.length ? durations.reduce((sum, value) => sum + value, 0) / durations.length : null;
}

function complianceRate(documents: { document_type: string; verification_status: string }[], type: string): number | null {
  const applicable = documents.filter(document => document.document_type === type);
  if (!applicable.length) return null;
  return (applicable.filter(document => document.verification_status === 'verified').length / applicable.length) * 100;
}

function slaCompliance(items: { status: string; sla_deadline: string; resolved_at?: string }[], now: Date): number | null {
  if (!items.length) return null;
  const compliant = items.filter(item => {
    const deadline = new Date(item.sla_deadline).getTime();
    const completion = item.resolved_at ? new Date(item.resolved_at).getTime() : now.getTime();
    return Number.isFinite(deadline) && completion <= deadline;
  }).length;
  return (compliant / items.length) * 100;
}

function monthKey(value: Date) {
  return `${value.getFullYear()}-${String(value.getMonth() + 1).padStart(2, '0')}`;
}

function buildMonthBuckets(bounds: DateBounds) {
  const cursor = new Date(bounds.start.getFullYear(), bounds.start.getMonth(), 1);
  const finalMonth = new Date(bounds.end.getFullYear(), bounds.end.getMonth(), 1);
  const buckets: { key: string; month: string }[] = [];
  while (cursor <= finalMonth) {
    buckets.push({
      key: monthKey(cursor),
      month: cursor.toLocaleDateString(undefined, { month: 'short', year: '2-digit' }),
    });
    cursor.setMonth(cursor.getMonth() + 1);
  }
  return buckets;
}

export default function AdminDashboardPage() {
  const [period, setPeriod] = useState<Period>('12m');
  const {
    isLoaded, companies, exportRecords, complaints, users, auditLogs, resetData,
    provinceApiSources, provinceDataRecords, provinceSyncLogs,
  } = useDataStore();
  const { user } = useAuth();
  const { showToast, ToastView } = useToast();
  const [resetting, setResetting] = useState(false);
  const myStage = getReviewStage(user?.role);
  const isSuperAdmin = user?.role === 'super_admin';

  const handleResetDemoData = async () => {
    if (!window.confirm('Reset all demo data to its initial state? This clears any changes you have made.')) return;
    setResetting(true);
    try {
      const result = await resetData();
      if (result.error) {
        showToast(result.error, 'error');
        return;
      }
      showToast('Demo data restored to its initial state.');
    } finally {
      setResetting(false);
    }
  };

  const dashboard = useMemo(() => {
    const now = new Date();
    const bounds = getBounds(period, now);
    const inCurrent = <T extends { created_at: string }>(items: T[]) => items.filter(item => dateInBounds(item.created_at, bounds.current));
    const inPrevious = <T extends { created_at: string }>(items: T[]) => items.filter(item => dateInBounds(item.created_at, bounds.previous));
    const currentCompanies = inCurrent(companies);
    const previousCompanies = inPrevious(companies);
    const currentRecords = inCurrent(exportRecords);
    const previousRecords = inPrevious(exportRecords);
    const currentComplaints = inCurrent(complaints);
    const previousComplaints = inPrevious(complaints);
    const currentResolved = complaints.filter(item => dateInBounds(item.resolved_at, bounds.current));
    const previousResolved = complaints.filter(item => dateInBounds(item.resolved_at, bounds.previous));

    const pendingFor = (items: typeof companies) => items.filter(company => isInReviewQueue(user?.role, company.status));
    const pendingExportsFor = (items: typeof exportRecords) => items.filter(record => isInReviewQueue(user?.role, record.status));
    const usdValue = (items: typeof exportRecords) => items.reduce(
      (sum, record) => sum + Number(record.estimated_value || 0) * (FX_TO_USD[record.currency] ?? 1),
      0,
    );
    const documents = currentRecords.flatMap(record => record.documents ?? []);
    const previousDocuments = previousRecords.flatMap(record => record.documents ?? []);
    const currentSla = slaCompliance(currentComplaints, now);
    const previousSla = slaCompliance(previousComplaints, bounds.previous.end);
    const currentAvgResolution = averageResolutionDays(currentResolved);
    const previousAvgResolution = averageResolutionDays(previousResolved);
    const currentSps = complianceRate(documents, 'DDP SPS Certificate');
    const previousSps = complianceRate(previousDocuments, 'DDP SPS Certificate');
    const currentPsi = complianceRate(documents, 'Pre-Shipment Inspection (PSI) Report');
    const previousPsi = complianceRate(previousDocuments, 'Pre-Shipment Inspection (PSI) Report');
    const currentActiveUsers = inCurrent(users).filter(userItem => userItem.is_active);
    const previousActiveUsers = inPrevious(users).filter(userItem => userItem.is_active);
    const currentCountries = new Set(currentRecords.map(record => record.destination_country).filter(Boolean));
    const previousCountries = new Set(previousRecords.map(record => record.destination_country).filter(Boolean));

    const buckets = buildMonthBuckets(bounds.current);
    const monthlyExports = buckets.map(bucket => {
      const records = currentRecords.filter(record => monthKey(new Date(record.created_at)) === bucket.key);
      return { ...bucket, records: records.length, value: usdValue(records) };
    });
    const complaintTrend = buckets.map(bucket => ({
      ...bucket,
      received: currentComplaints.filter(item => monthKey(new Date(item.created_at)) === bucket.key).length,
      resolved: currentResolved.filter(item => monthKey(new Date(item.resolved_at as string)) === bucket.key).length,
    }));
    const aggregateRecords = (field: 'product' | 'destination_country') => Object.entries(
      currentRecords.reduce<Record<string, { value: number; count: number }>>((acc, record) => {
        const name = record[field] || 'Unspecified';
        const previous = acc[name] ?? { value: 0, count: 0 };
        acc[name] = { value: previous.value + Number(record.estimated_value || 0) * (FX_TO_USD[record.currency] ?? 1), count: previous.count + 1 };
        return acc;
      }, {}),
    ).map(([name, value]) => ({ name, ...value })).sort((a, b) => b.value - a.value);

    const openComplaints = currentComplaints.filter(item => !['resolved', 'closed'].includes(item.status));
    const previousOpenComplaints = previousComplaints.filter(item => !['resolved', 'closed'].includes(item.status));
    const pendingRegistrations = pendingFor(currentCompanies);
    const pendingExports = pendingExportsFor(currentRecords);
    const currentValue = usdValue(currentRecords);
    const previousValue = usdValue(previousRecords);

    return {
      currentCompanies, currentRecords, currentComplaints, currentResolved, pendingRegistrations, pendingExports,
      openComplaints, monthlyExports, complaintTrend,
      productData: aggregateRecords('product'), destinationData: aggregateRecords('destination_country'),
      verificationStatusData: [
        { name: 'Verified', value: currentCompanies.filter(item => item.status === 'approved').length },
        { name: 'Pending', value: pendingRegistrations.length },
        { name: 'Rejected', value: currentCompanies.filter(item => item.status === 'rejected').length },
        { name: 'Additional Info', value: currentCompanies.filter(item => item.status === 'additional_info_required').length },
      ],
      complaintCategoryData: Object.entries(currentComplaints.reduce<Record<string, number>>((acc, item) => {
        acc[item.category] = (acc[item.category] ?? 0) + 1;
        return acc;
      }, {})).map(([name, value]) => ({ name, value })),
      kpis: [
        { label: 'Registered Companies', value: currentCompanies.length, icon: Users, color: 'text-blue-600 bg-blue-50', trend: trend(currentCompanies.length, previousCompanies.length) },
        { label: 'Verified Exporters', value: currentCompanies.filter(item => item.status === 'approved').length, icon: CheckCircle, color: 'text-green-600 bg-green-50', trend: trend(currentCompanies.filter(item => item.status === 'approved').length, previousCompanies.filter(item => item.status === 'approved').length) },
        { label: 'Pending Registrations', value: pendingRegistrations.length, icon: Clock, color: 'text-yellow-600 bg-yellow-50', trend: trend(pendingRegistrations.length, pendingFor(previousCompanies).length, true) },
        { label: 'Active Users', value: currentActiveUsers.length, icon: Users, color: 'text-indigo-600 bg-indigo-50', trend: trend(currentActiveUsers.length, previousActiveUsers.length) },
        { label: 'Total Export Records', value: currentRecords.length, icon: Package, color: 'text-purple-600 bg-purple-50', trend: trend(currentRecords.length, previousRecords.length) },
        { label: 'Approved Consignments', value: currentRecords.filter(item => item.status === 'approved').length, icon: FileCheck, color: 'text-green-600 bg-green-50', trend: trend(currentRecords.filter(item => item.status === 'approved').length, previousRecords.filter(item => item.status === 'approved').length) },
        { label: 'Pending Certifications', value: pendingExports.length, icon: Shield, color: 'text-orange-600 bg-orange-50', trend: trend(pendingExports.length, pendingExportsFor(previousRecords).length, true) },
        { label: 'Est. Export Value (USD)', value: formatUsd(currentValue), icon: TrendingUp, color: 'text-green-600 bg-green-50', trend: trend(currentValue, previousValue) },
        { label: 'Total Complaints', value: currentComplaints.length, icon: AlertTriangle, color: 'text-red-600 bg-red-50', trend: trend(currentComplaints.length, previousComplaints.length, true) },
        { label: 'Open Complaints', value: openComplaints.length, icon: AlertTriangle, color: 'text-orange-600 bg-orange-50', trend: trend(openComplaints.length, previousOpenComplaints.length, true) },
        { label: 'Resolved Complaints', value: currentResolved.length, icon: CheckCircle, color: 'text-green-600 bg-green-50', trend: trend(currentResolved.length, previousResolved.length) },
        { label: 'Avg Resolution (days)', value: formatValue(currentAvgResolution), icon: Clock, color: 'text-blue-600 bg-blue-50', trend: trend(currentAvgResolution, previousAvgResolution, true) },
        { label: 'SPS Compliance Rate', value: formatValue(currentSps, '%'), icon: Shield, color: 'text-green-600 bg-green-50', trend: trend(currentSps, previousSps) },
        { label: 'Countries Served', value: currentCountries.size, icon: Globe, color: 'text-cyan-600 bg-cyan-50', trend: trend(currentCountries.size, previousCountries.size) },
        { label: 'SLA Compliance', value: formatValue(currentSla, '%'), icon: BarChart3, color: 'text-purple-600 bg-purple-50', trend: trend(currentSla, previousSla) },
        { label: 'PSI Compliance Rate', value: formatValue(currentPsi, '%'), icon: FileCheck, color: 'text-green-600 bg-green-50', trend: trend(currentPsi, previousPsi) },
      ],
    };
  }, [companies, exportRecords, complaints, users, period, isSuperAdmin, user?.role]);

  const dashTitle = isSuperAdmin ? 'MNFSR Super Admin Dashboard'
    : myStage === 'tdap' ? 'TDAP Dashboard'
      : myStage === 'nafsa' ? 'NAFSA Dashboard'
        : 'Admin Dashboard';
  const dashSubtitle = isSuperAdmin ? 'National Export Monitoring & Management Overview'
    : myStage === 'tdap' ? 'Trade Development Authority — Review & Monitoring'
      : myStage === 'nafsa' ? 'National Food Safety Authority — Review & Monitoring'
        : 'Export Monitoring & Management';
  const activity = auditLogs.slice(0, 8);

  return (
    <DashboardLayout>
      <RoleGuard allow={ROUTE_ROLES['/admin']}>
        <ToastView />
        <div className="space-y-6">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">{dashTitle}</h1>
              <p className="text-gray-500">{dashSubtitle}</p>
            </div>
            <div className="flex gap-3 items-center">
              {isSuperAdmin && (
                <button onClick={handleResetDemoData} disabled={resetting} className="btn-outline flex items-center gap-2 text-sm disabled:opacity-50" title="Restore the demo dataset">
                  <RotateCcw className="w-4 h-4" /> {resetting ? 'Resetting...' : 'Reset Demo Data'}
                </button>
              )}
              <select value={period} onChange={event => setPeriod(event.target.value as Period)} className="input-field w-40" aria-label="Dashboard reporting period">
                <option value="1m">Last Month</option>
                <option value="3m">Last 3 Months</option>
                <option value="6m">Last 6 Months</option>
                <option value="12m">Last 12 Months</option>
                <option value="ytd">Year to Date</option>
              </select>
            </div>
          </div>

          {!isLoaded ? (
            <div className="card p-8 text-center text-gray-500">Loading live dashboard data…</div>
          ) : (
            <>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                {dashboard.kpis.map(kpi => (
                  <div key={kpi.label} className="card p-4">
                    <div className="flex items-center justify-between mb-2">
                      <div className={`w-9 h-9 rounded-lg ${kpi.color} flex items-center justify-center`}><kpi.icon className="w-4 h-4" /></div>
                      <span className={`text-xs font-medium ${kpi.trend.positive ? 'text-green-600' : 'text-red-600'}`}>{kpi.trend.label}</span>
                    </div>
                    <p className="text-xl font-bold text-gray-900">{typeof kpi.value === 'number' ? formatNumber(kpi.value) : kpi.value}</p>
                    <p className="text-xs text-gray-500">{kpi.label}</p>
                  </div>
                ))}
              </div>

              <div className="grid md:grid-cols-2 gap-6">
                <div className="card p-6">
                  <h3 className="font-semibold text-gray-900 mb-4">Export Records by Month</h3>
                  <ResponsiveContainer width="100%" height={250}>
                    <AreaChart data={dashboard.monthlyExports}>
                      <CartesianGrid strokeDasharray="3 3" /><XAxis dataKey="month" tick={{ fontSize: 10 }} /><YAxis tick={{ fontSize: 10 }} /><Tooltip />
                      <Area type="monotone" dataKey="records" stroke="#006B3F" fill="#006B3F" fillOpacity={0.15} strokeWidth={2} name="Records" />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
                <div className="card p-6">
                  <h3 className="font-semibold text-gray-900 mb-4">Export Value by Month (USD)</h3>
                  <ResponsiveContainer width="100%" height={250}>
                    <LineChart data={dashboard.monthlyExports}>
                      <CartesianGrid strokeDasharray="3 3" /><XAxis dataKey="month" tick={{ fontSize: 10 }} /><YAxis tick={{ fontSize: 10 }} tickFormatter={value => `$${(Number(value) / 1_000_000).toFixed(1)}M`} />
                      <Tooltip formatter={value => formatUsd(Number(value))} />
                      <Line type="monotone" dataKey="value" stroke="#D4AF37" strokeWidth={2} dot={{ fill: '#D4AF37' }} name="Value" />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              </div>

              <div className="grid md:grid-cols-3 gap-6">
                <div className="card p-6">
                  <h3 className="font-semibold text-gray-900 mb-4">Top Exported Commodities</h3>
                  <ResponsiveContainer width="100%" height={250}>
                    <BarChart data={dashboard.productData.slice(0, 8)} layout="vertical">
                      <CartesianGrid strokeDasharray="3 3" /><XAxis type="number" tick={{ fontSize: 9 }} /><YAxis dataKey="name" type="category" width={90} tick={{ fontSize: 9 }} /><Tooltip formatter={value => formatUsd(Number(value))} />
                      <Bar dataKey="value" fill="#006B3F" radius={[0, 4, 4, 0]} name="USD value" />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
                <div className="card p-6">
                  <h3 className="font-semibold text-gray-900 mb-4">Exports by Destination</h3>
                  <ResponsiveContainer width="100%" height={250}>
                    <PieChart><Pie data={dashboard.destinationData.slice(0, 8)} cx="50%" cy="50%" outerRadius={80} dataKey="value" label={({ name }) => String(name ?? '').substring(0, 8)}>
                      {dashboard.destinationData.slice(0, 8).map((item, index) => <Cell key={item.name} fill={COLORS[index % COLORS.length]} />)}
                    </Pie><Tooltip formatter={value => formatUsd(Number(value))} /></PieChart>
                  </ResponsiveContainer>
                </div>
                <div className="card p-6">
                  <h3 className="font-semibold text-gray-900 mb-4">Company Verification Status</h3>
                  <ResponsiveContainer width="100%" height={250}>
                    <PieChart><Pie data={dashboard.verificationStatusData} cx="50%" cy="50%" innerRadius={50} outerRadius={80} dataKey="value" label={({ name, value }) => `${name ?? ''}: ${value ?? 0}`}>
                      {dashboard.verificationStatusData.map((item, index) => <Cell key={item.name} fill={COLORS[index % COLORS.length]} />)}
                    </Pie><Tooltip /></PieChart>
                  </ResponsiveContainer>
                </div>
              </div>

              <div className="grid md:grid-cols-2 gap-6">
                <div className="card p-6">
                  <h3 className="font-semibold text-gray-900 mb-4">Complaints by Category</h3>
                  <ResponsiveContainer width="100%" height={250}>
                    <BarChart data={dashboard.complaintCategoryData}><CartesianGrid strokeDasharray="3 3" /><XAxis dataKey="name" tick={{ fontSize: 10 }} /><YAxis tick={{ fontSize: 10 }} /><Tooltip /><Bar dataKey="value" fill="#ef4444" radius={[4, 4, 0, 0]} /></BarChart>
                  </ResponsiveContainer>
                </div>
                <div className="card p-6">
                  <h3 className="font-semibold text-gray-900 mb-4">Complaint Resolution Trend</h3>
                  <ResponsiveContainer width="100%" height={250}>
                    <LineChart data={dashboard.complaintTrend}><CartesianGrid strokeDasharray="3 3" /><XAxis dataKey="month" tick={{ fontSize: 10 }} /><YAxis tick={{ fontSize: 10 }} /><Tooltip />
                      <Line type="monotone" dataKey="received" stroke="#ef4444" strokeWidth={2} name="Received" /><Line type="monotone" dataKey="resolved" stroke="#22c55e" strokeWidth={2} name="Resolved" />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              </div>

              <div className="card">
                <div className="p-4 border-b flex items-center justify-between">
                  <h3 className="font-semibold text-gray-900 flex items-center gap-2"><Plug className="w-4 h-4 text-gov-green-600" /> Province API Integrations</h3>
                  <div className="flex items-center gap-3"><span className="text-xs text-gray-500">{provinceApiSources.filter(source => source.is_active).length}/{provinceApiSources.length} active · {provinceDataRecords.length.toLocaleString()} records</span><Link href="/admin/province-integrations" className="text-sm text-gov-green-600 hover:underline">Manage Integrations</Link></div>
                </div>
                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4 p-4">
                  {provinceApiSources.map(source => {
                    const records = provinceDataRecords.filter(record => record.source_id === source.id).length;
                    const lastLog = provinceSyncLogs.find(log => log.source_id === source.id);
                    return <div key={source.id} className="rounded-lg border p-3 hover:shadow-sm transition-shadow"><div className="flex items-center justify-between mb-2"><span className={`w-2 h-2 rounded-full ${source.is_active ? 'bg-green-500' : 'bg-gray-300'}`} />{source.last_sync_status && <span className={`text-xs px-1.5 py-0.5 rounded ${source.last_sync_status === 'success' ? 'bg-green-50 text-green-700' : source.last_sync_status === 'failed' ? 'bg-red-50 text-red-700' : 'bg-yellow-50 text-yellow-700'}`}>{source.last_sync_status}</span>}</div><p className="text-sm font-medium text-gray-900 truncate">{source.province}</p><p className="text-xs text-gray-500 truncate mb-2">{source.name}</p><div className="flex items-baseline gap-2"><span className="text-lg font-bold text-gray-900">{records}</span><span className="text-xs text-gray-400">records</span></div>{lastLog && <p className="text-xs text-gray-400 mt-1">Last: {new Date(lastLog.started_at).toLocaleDateString()}</p>}</div>;
                  })}
                  {!provinceApiSources.length && <div className="col-span-full text-center py-4 text-gray-400 text-sm">No integrations configured. <Link href="/admin/province-integrations" className="text-gov-green-600 hover:underline">Set up your first API source</Link></div>}
                </div>
              </div>

              <div className="card">
                <div className="p-4 border-b"><h3 className="font-semibold text-gray-900">Recent Activity</h3></div>
                <div className="overflow-x-auto"><table className="w-full text-sm"><thead className="bg-gray-50"><tr><th className="text-left p-3 font-medium text-gray-500">Module</th><th className="text-left p-3 font-medium text-gray-500">Reference</th><th className="text-left p-3 font-medium text-gray-500">Action</th><th className="text-left p-3 font-medium text-gray-500">User</th><th className="text-left p-3 font-medium text-gray-500">Date</th></tr></thead><tbody>
                  {activity.map(item => <tr key={item.id} className="border-t hover:bg-gray-50"><td className="p-3"><span className="badge bg-gray-100 text-gray-700">{item.module}</span></td><td className="p-3 font-mono text-gov-green-600">{item.record_id || '—'}</td><td className="p-3">{item.action}{item.new_value ? ` — ${item.new_value}` : ''}</td><td className="p-3 text-gray-500">{item.user_name || 'System'}</td><td className="p-3 text-gray-500">{new Date(item.created_at).toLocaleString()}</td></tr>)}
                  {!activity.length && <tr><td colSpan={5} className="p-6 text-center text-gray-400">No activity has been recorded for this account.</td></tr>}
                </tbody></table></div>
              </div>
            </>
          )}
        </div>
      </RoleGuard>
    </DashboardLayout>
  );
}
