'use client';

import { useState } from 'react';
import DashboardLayout from '@/components/layout/DashboardLayout';
import RoleGuard from '@/components/auth/RoleGuard';
import { useDataStore } from '@/lib/data-store';
import { useToast } from '@/components/ui/Toast';
import { ROUTE_ROLES } from '@/lib/permissions';
import { ProvinceApiSource, CronInterval } from '@/lib/types';
import { formatDateTime, getStatusColor } from '@/lib/utils';
import Link from 'next/link';
import {
  Plug, Plus, RefreshCw, Pencil, Trash2, ChevronDown, ChevronUp,
  Clock, Database, CheckCircle, XCircle, AlertTriangle, Activity,
  ExternalLink, Settings2, History
} from 'lucide-react';

const CRON_LABELS: Record<CronInterval, string> = {
  every_5m: 'Every 5 minutes',
  every_15m: 'Every 15 minutes',
  every_30m: 'Every 30 minutes',
  hourly: 'Every hour',
  every_6h: 'Every 6 hours',
  daily: 'Daily',
  weekly: 'Weekly',
  custom: 'Custom cron',
};

const CRON_OPTIONS: { value: CronInterval; label: string }[] = [
  { value: 'every_5m', label: 'Every 5 minutes' },
  { value: 'every_15m', label: 'Every 15 minutes' },
  { value: 'every_30m', label: 'Every 30 minutes' },
  { value: 'hourly', label: 'Every hour' },
  { value: 'every_6h', label: 'Every 6 hours' },
  { value: 'daily', label: 'Daily' },
  { value: 'weekly', label: 'Weekly' },
  { value: 'custom', label: 'Custom cron expression' },
];

export default function ProvinceIntegrationsPage() {
  const {
    provinceApiSources, provinceSyncLogs, provinceDataRecords, masterItems,
    addProvinceApiSource, updateProvinceApiSource, deleteProvinceApiSource, triggerProvinceSync,
  } = useDataStore();
  const provinces = masterItems.provinces;

  const { showToast, ToastView } = useToast();
  const [busy, setBusy] = useState(false);
  const [syncingId, setSyncingId] = useState<string | null>(null);
  const [formError, setFormError] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [editingSource, setEditingSource] = useState<ProvinceApiSource | null>(null);
  const [expandedSource, setExpandedSource] = useState<string | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);

  // Form state
  const [formName, setFormName] = useState('');
  const [formProvince, setFormProvince] = useState('');
  const [formSystem, setFormSystem] = useState('');
  const [formUrl, setFormUrl] = useState('');
  const [formApiKey, setFormApiKey] = useState('');
  const [formCron, setFormCron] = useState<CronInterval>('daily');
  const [formCronExpr, setFormCronExpr] = useState('');
  const [formActive, setFormActive] = useState(true);

  const openAdd = () => {
    setEditingSource(null);
    setFormError('');
    setFormName(''); setFormProvince(provinces[0] ?? ''); setFormSystem(''); setFormUrl('');
    setFormApiKey(''); setFormCron('daily'); setFormCronExpr(''); setFormActive(true);
    setShowForm(true);
  };

  const openEdit = (src: ProvinceApiSource) => {
    setEditingSource(src);
    setFormError('');
    setFormName(src.name); setFormProvince(src.province); setFormSystem(src.system_name);
    setFormUrl(src.api_url); setFormApiKey(src.api_key || ''); setFormCron(src.cron_interval);
    setFormCronExpr(src.cron_expression || ''); setFormActive(src.is_active);
    setShowForm(true);
  };

  /** Province endpoints must be public HTTPS URLs; the sync proxy rejects anything else. */
  const validateForm = (): string | null => {
    if (!formName.trim()) return 'Enter a source name.';
    if (!formProvince) return 'Select a province.';
    if (!formUrl.trim()) return 'Enter the API URL.';
    let parsed: URL;
    try {
      parsed = new URL(formUrl.trim());
    } catch {
      return 'Enter a full API URL including https://';
    }
    if (!['http:', 'https:'].includes(parsed.protocol)) return 'Only HTTP and HTTPS API URLs are supported.';
    if (parsed.username || parsed.password) return 'Remove credentials from the API URL and use the API key field instead.';
    if (formCron === 'custom' && !formCronExpr.trim()) return 'Enter a cron expression for the custom schedule.';
    return null;
  };

  const handleSave = async () => {
    const problem = validateForm();
    if (problem) {
      setFormError(problem);
      return;
    }
    setFormError('');
    const payload = {
      name: formName.trim(), province: formProvince, system_name: formSystem.trim(),
      api_url: formUrl.trim(), api_key: formApiKey.trim() || undefined,
      cron_interval: formCron, cron_expression: formCron === 'custom' ? formCronExpr.trim() : undefined,
      is_active: formActive,
    };
    setBusy(true);
    try {
      const result = editingSource
        ? await updateProvinceApiSource(editingSource.id, payload)
        : await addProvinceApiSource(payload);
      if (result.error) {
        setFormError(result.error);
        return;
      }
      showToast(editingSource ? `Source "${payload.name}" updated.` : `Source "${payload.name}" created.`);
      setShowForm(false);
    } finally {
      setBusy(false);
    }
  };

  const handleSync = async (sourceId: string) => {
    const source = provinceApiSources.find(item => item.id === sourceId);
    setSyncingId(sourceId);
    try {
      const result = await triggerProvinceSync(sourceId);
      if (result.error) {
        showToast(result.error, 'error');
        return;
      }
      showToast(`Sync completed for ${source?.name ?? 'the source'}.`);
    } finally {
      setSyncingId(null);
    }
  };

  const handleDelete = async (id: string) => {
    const source = provinceApiSources.find(item => item.id === id);
    setBusy(true);
    try {
      const result = await deleteProvinceApiSource(id);
      if (result.error) {
        showToast(result.error, 'error');
        return;
      }
      showToast(`Source "${source?.name ?? ''}" deleted with its sync history.`);
      setDeleteConfirm(null);
    } finally {
      setBusy(false);
    }
  };

  const handleToggleActive = async (source: ProvinceApiSource) => {
    setBusy(true);
    try {
      const result = await updateProvinceApiSource(source.id, { is_active: !source.is_active });
      if (result.error) {
        showToast(result.error, 'error');
        return;
      }
      showToast(`Source "${source.name}" ${source.is_active ? 'paused' : 'activated'}.`);
    } finally {
      setBusy(false);
    }
  };

  // Stats
  const activeSources = provinceApiSources.filter(s => s.is_active).length;
  const totalRecords = provinceDataRecords.length;
  const todayLogs = provinceSyncLogs.filter(l => {
    const d = new Date(l.started_at);
    const now = new Date();
    return d.toDateString() === now.toDateString();
  });
  const successRate = todayLogs.length > 0
    ? Math.round((todayLogs.filter(l => l.status === 'success').length / todayLogs.length) * 100)
    : 0;

  return (
    <DashboardLayout>
      <RoleGuard allow={ROUTE_ROLES['/admin/province-integrations']}>
      <ToastView />
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
              <Plug className="w-7 h-7 text-gov-green-600" />
              Province API Integrations
            </h1>
            <p className="text-gray-500 mt-1">Manage external API connections from provincial systems and configure automated data sync</p>
          </div>
          <div className="flex gap-3">
            <Link href="/admin/province-integrations/data" className="btn-outline flex items-center gap-2 text-sm">
              <Database className="w-4 h-4" /> View Pulled Data
            </Link>
            <button onClick={openAdd} className="btn-primary flex items-center gap-2">
              <Plus className="w-4 h-4" /> Add New Source
            </button>
          </div>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="card p-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg text-blue-600 bg-blue-50 flex items-center justify-center">
                <Plug className="w-5 h-5" />
              </div>
              <div>
                <p className="text-2xl font-bold text-gray-900">{provinceApiSources.length}</p>
                <p className="text-xs text-gray-500">Total Sources</p>
              </div>
            </div>
          </div>
          <div className="card p-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg text-green-600 bg-green-50 flex items-center justify-center">
                <Activity className="w-5 h-5" />
              </div>
              <div>
                <p className="text-2xl font-bold text-gray-900">{activeSources}</p>
                <p className="text-xs text-gray-500">Active Connections</p>
              </div>
            </div>
          </div>
          <div className="card p-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg text-indigo-600 bg-indigo-50 flex items-center justify-center">
                <Database className="w-5 h-5" />
              </div>
              <div>
                <p className="text-2xl font-bold text-gray-900">{totalRecords.toLocaleString()}</p>
                <p className="text-xs text-gray-500">Records Pulled</p>
              </div>
            </div>
          </div>
          <div className="card p-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg text-emerald-600 bg-emerald-50 flex items-center justify-center">
                <CheckCircle className="w-5 h-5" />
              </div>
              <div>
                <p className="text-2xl font-bold text-gray-900">{successRate}%</p>
                <p className="text-xs text-gray-500">Today's Sync Success</p>
              </div>
            </div>
          </div>
        </div>

        {/* Sources Table */}
        <div className="card">
          <div className="p-4 border-b flex items-center justify-between">
            <h3 className="font-semibold text-gray-900">Configured API Sources</h3>
            <span className="text-sm text-gray-500">{provinceApiSources.length} source{provinceApiSources.length !== 1 ? 's' : ''}</span>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50">
                <tr>
                  <th className="text-left p-3 font-medium text-gray-500">Source Name</th>
                  <th className="text-left p-3 font-medium text-gray-500">Province</th>
                  <th className="text-left p-3 font-medium text-gray-500">System</th>
                  <th className="text-left p-3 font-medium text-gray-500">API URL</th>
                  <th className="text-left p-3 font-medium text-gray-500">Cron Schedule</th>
                  <th className="text-left p-3 font-medium text-gray-500">Last Sync</th>
                  <th className="text-left p-3 font-medium text-gray-500">Status</th>
                  <th className="text-right p-3 font-medium text-gray-500">Actions</th>
                </tr>
              </thead>
              <tbody>
                {provinceApiSources.map(src => (
                  <SourceRow
                    key={src.id}
                    source={src}
                    syncLogs={provinceSyncLogs.filter(l => l.source_id === src.id)}
                    recordCount={provinceDataRecords.filter(r => r.source_id === src.id).length}
                    isExpanded={expandedSource === src.id}
                    isSyncing={syncingId === src.id || src.last_sync_status === 'running'}
                    isBusy={busy}
                    isDeleteConfirm={deleteConfirm === src.id}
                    onToggleExpand={() => setExpandedSource(expandedSource === src.id ? null : src.id)}
                    onEdit={() => openEdit(src)}
                    onDelete={() => { void handleDelete(src.id); }}
                    onDeleteConfirm={() => setDeleteConfirm(src.id)}
                    onDeleteCancel={() => setDeleteConfirm(null)}
                    onSync={() => { void handleSync(src.id); }}
                    onToggleActive={() => { void handleToggleActive(src); }}
                  />
                ))}
                {provinceApiSources.length === 0 && (
                  <tr>
                    <td colSpan={8} className="p-8 text-center text-gray-400">
                      <Plug className="w-8 h-8 mx-auto mb-2 opacity-40" />
                      <p>No API sources configured. Click "Add New Source" to connect a provincial system.</p>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Recent Sync History */}
        <div className="card">
          <div className="p-4 border-b flex items-center gap-2">
            <History className="w-4 h-4 text-gray-500" />
            <h3 className="font-semibold text-gray-900">Recent Sync Activity</h3>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50">
                <tr>
                  <th className="text-left p-3 font-medium text-gray-500">Source</th>
                  <th className="text-left p-3 font-medium text-gray-500">Province</th>
                  <th className="text-left p-3 font-medium text-gray-500">Status</th>
                  <th className="text-left p-3 font-medium text-gray-500">Records</th>
                  <th className="text-left p-3 font-medium text-gray-500">Duration</th>
                  <th className="text-left p-3 font-medium text-gray-500">Triggered</th>
                  <th className="text-left p-3 font-medium text-gray-500">Time</th>
                  <th className="text-left p-3 font-medium text-gray-500">Error</th>
                </tr>
              </thead>
              <tbody>
                {provinceSyncLogs.slice(0, 15).map(log => (
                  <tr key={log.id} className="border-t hover:bg-gray-50">
                    <td className="p-3 font-medium text-gray-800">{log.source_name}</td>
                    <td className="p-3">{log.province}</td>
                    <td className="p-3">
                      <span className={`badge ${getStatusColor(log.status)}`}>
                        {log.status.toUpperCase()}
                      </span>
                    </td>
                    <td className="p-3 font-mono">{log.records_pulled}</td>
                    <td className="p-3 text-gray-500">{log.duration_ms ? `${(log.duration_ms / 1000).toFixed(1)}s` : '—'}</td>
                    <td className="p-3">
                      <span className={`text-xs px-2 py-0.5 rounded-full ${log.triggered_by === 'manual' ? 'bg-blue-50 text-blue-700' : 'bg-gray-100 text-gray-600'}`}>
                        {log.triggered_by}
                      </span>
                    </td>
                    <td className="p-3 text-gray-500 text-xs">{formatDateTime(log.started_at)}</td>
                    <td className="p-3 text-red-500 text-xs max-w-48 truncate">{log.error_message || '—'}</td>
                  </tr>
                ))}
                {provinceSyncLogs.length === 0 && (
                  <tr>
                    <td colSpan={8} className="p-6 text-center text-gray-400">No sync activity yet.</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Add/Edit Form Modal */}
        {showForm && (
          <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={() => setShowForm(false)}>
            <div className="bg-white rounded-xl shadow-xl w-full max-w-lg max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
              <div className="p-6 border-b">
                <h2 className="text-lg font-bold text-gray-900">
                  {editingSource ? 'Edit API Source' : 'Add New API Source'}
                </h2>
                <p className="text-sm text-gray-500 mt-1">
                  {editingSource ? 'Update the integration settings' : 'Connect a new provincial system API'}
                </p>
              </div>
              <div className="p-6 space-y-4">
                {formError && (
                  <div className="flex items-start gap-2 p-3 bg-red-50 border border-red-200 text-red-700 rounded-lg text-sm">
                    <AlertTriangle className="w-4 h-4 flex-shrink-0 mt-0.5" />
                    <span>{formError}</span>
                  </div>
                )}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Source Name *</label>
                  <input
                    type="text" value={formName} onChange={e => setFormName(e.target.value)}
                    placeholder="e.g. Punjab Agriculture Export Portal"
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-gov-green-500 focus:border-transparent"
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Province *</label>
                    <select
                      value={formProvince} onChange={e => setFormProvince(e.target.value)}
                      className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-gov-green-500"
                    >
                      <option value="">Select province</option>
                      {provinces.map(province => <option key={province} value={province}>{province}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">System Name</label>
                    <input
                      type="text" value={formSystem} onChange={e => setFormSystem(e.target.value)}
                      placeholder="e.g. Punjab Agri-Export System"
                      className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-gov-green-500"
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">API URL *</label>
                  <input
                    type="url" value={formUrl} onChange={e => setFormUrl(e.target.value)}
                    placeholder="https://api.province-system.gov.pk/v1/data"
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm font-mono focus:ring-2 focus:ring-gov-green-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">API Key (optional)</label>
                  <input
                    type="password" value={formApiKey} onChange={e => setFormApiKey(e.target.value)}
                    placeholder="Bearer token or API key"
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm font-mono focus:ring-2 focus:ring-gov-green-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Cron Schedule *</label>
                  <select
                    value={formCron} onChange={e => setFormCron(e.target.value as CronInterval)}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-gov-green-500"
                  >
                    {CRON_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                  </select>
                  {formCron === 'custom' && (
                    <input
                      type="text" value={formCronExpr} onChange={e => setFormCronExpr(e.target.value)}
                      placeholder="*/30 * * * *"
                      className="w-full mt-2 border border-gray-300 rounded-lg px-3 py-2 text-sm font-mono focus:ring-2 focus:ring-gov-green-500"
                    />
                  )}
                  <p className="text-xs text-gray-400 mt-1">
                    {CRON_LABELS[formCron] || 'Custom schedule'}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <input
                    type="checkbox" id="form-active" checked={formActive}
                    onChange={e => setFormActive(e.target.checked)}
                    className="w-4 h-4 text-gov-green-600 border-gray-300 rounded"
                  />
                  <label htmlFor="form-active" className="text-sm text-gray-700">
                    Enable this integration (active)
                  </label>
                </div>
              </div>
              <div className="p-6 border-t flex justify-end gap-3">
                <button onClick={() => setShowForm(false)} className="px-4 py-2 text-sm text-gray-600 hover:text-gray-800">
                  Cancel
                </button>
                <button
                  onClick={handleSave}
                  disabled={busy || !formName.trim() || !formProvince || !formUrl.trim()}
                  className="btn-primary disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {busy ? 'Saving...' : editingSource ? 'Update Source' : 'Add Source'}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </RoleGuard>
    </DashboardLayout>
  );
}

// ---------- Source Row Component ----------

function SourceRow({
  source, syncLogs, recordCount, isExpanded, isSyncing, isBusy, isDeleteConfirm,
  onToggleExpand, onEdit, onDelete, onDeleteConfirm, onDeleteCancel, onSync, onToggleActive,
}: {
  source: ProvinceApiSource;
  syncLogs: ReturnType<typeof useDataStore>['provinceSyncLogs'];
  recordCount: number;
  isExpanded: boolean;
  isSyncing: boolean;
  isBusy: boolean;
  isDeleteConfirm: boolean;
  onToggleExpand: () => void;
  onEdit: () => void;
  onDelete: () => void;
  onDeleteConfirm: () => void;
  onDeleteCancel: () => void;
  onSync: () => void;
  onToggleActive: () => void;
}) {
  const statusBadge = source.last_sync_status
    ? <span className={`badge ${getStatusColor(source.last_sync_status)}`}>{source.last_sync_status.toUpperCase()}</span>
    : <span className="badge bg-gray-100 text-gray-600">NEVER</span>;

  return (
    <>
      <tr className="border-t hover:bg-gray-50">
        <td className="p-3">
          <div className="flex items-center gap-2">
            <button onClick={onToggleExpand} className="text-gray-400 hover:text-gray-600">
              {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
            </button>
            <div>
              <p className="font-medium text-gray-900">{source.name}</p>
              <p className="text-xs text-gray-400">{source.id}</p>
            </div>
          </div>
        </td>
        <td className="p-3">
          <span className="text-xs px-2 py-1 rounded-full bg-gov-green-50 text-gov-green-700 font-medium">
            {source.province}
          </span>
        </td>
        <td className="p-3 text-gray-600">{source.system_name || '—'}</td>
        <td className="p-3">
          <div className="flex items-center gap-1 max-w-48">
            <span className="font-mono text-xs text-gray-600 truncate">{source.api_url}</span>
            <ExternalLink className="w-3 h-3 text-gray-400 flex-shrink-0" />
          </div>
        </td>
        <td className="p-3">
          <div className="flex items-center gap-1 text-xs text-gray-600">
            <Clock className="w-3 h-3" />
            {CRON_LABELS[source.cron_interval]}
          </div>
          {source.cron_expression && (
            <p className="text-xs font-mono text-gray-400 mt-0.5">{source.cron_expression}</p>
          )}
        </td>
        <td className="p-3">
          {source.last_sync_at ? (
            <div>
              <p className="text-xs text-gray-600">{formatDateTime(source.last_sync_at)}</p>
              <p className="text-xs text-gray-400">{source.last_sync_records} records</p>
            </div>
          ) : (
            <span className="text-xs text-gray-400">Never</span>
          )}
        </td>
        <td className="p-3">
          <div className="flex flex-col gap-1">
            {statusBadge}
            <button
              onClick={onToggleActive}
              disabled={isBusy}
              title={source.is_active ? 'Pause this integration' : 'Activate this integration'}
              className={`text-xs mt-1 disabled:opacity-50 ${source.is_active ? 'text-green-600 hover:text-green-800' : 'text-gray-400 hover:text-gray-600'}`}
            >
              {source.is_active ? '● Active' : '○ Inactive'}
            </button>
          </div>
        </td>
        <td className="p-3">
          <div className="flex items-center justify-end gap-1">
            <button
              onClick={onSync}
              disabled={isSyncing || isBusy || !source.is_active}
              className="p-1.5 rounded-lg text-blue-600 hover:bg-blue-50 disabled:opacity-50"
              title={source.is_active ? 'Sync Now' : 'Activate the source to sync'}
            >
              <RefreshCw className={`w-4 h-4 ${isSyncing ? 'animate-spin' : ''}`} />
            </button>
            <button onClick={onEdit} className="p-1.5 rounded-lg text-gray-500 hover:bg-gray-100" title="Edit">
              <Pencil className="w-4 h-4" />
            </button>
            {isDeleteConfirm ? (
              <div className="flex items-center gap-1">
                <button onClick={onDelete} className="text-xs px-2 py-1 bg-red-600 text-white rounded hover:bg-red-700">
                  Delete
                </button>
                <button onClick={onDeleteCancel} className="text-xs px-2 py-1 text-gray-500 hover:text-gray-700">
                  Cancel
                </button>
              </div>
            ) : (
              <button onClick={onDeleteConfirm} className="p-1.5 rounded-lg text-red-500 hover:bg-red-50" title="Delete">
                <Trash2 className="w-4 h-4" />
              </button>
            )}
          </div>
        </td>
      </tr>

      {/* Expanded Details */}
      {isExpanded && (
        <tr className="bg-gray-50">
          <td colSpan={8} className="p-4">
            <div className="grid md:grid-cols-3 gap-4">
              {/* Connection Details */}
              <div className="bg-white rounded-lg p-4 border">
                <h4 className="font-medium text-gray-900 text-sm mb-3 flex items-center gap-2">
                  <Settings2 className="w-4 h-4" /> Connection Details
                </h4>
                <dl className="space-y-2 text-xs">
                  <div className="flex justify-between">
                    <dt className="text-gray-500">API URL</dt>
                    <dd className="font-mono text-gray-800 truncate max-w-48">{source.api_url}</dd>
                  </div>
                  <div className="flex justify-between">
                    <dt className="text-gray-500">API Key</dt>
                    <dd className="text-gray-800">{source.api_key ? '••••••••' : 'Not set'}</dd>
                  </div>
                  <div className="flex justify-between">
                    <dt className="text-gray-500">Cron Schedule</dt>
                    <dd className="text-gray-800">{CRON_LABELS[source.cron_interval]}</dd>
                  </div>
                  {source.cron_expression && (
                    <div className="flex justify-between">
                      <dt className="text-gray-500">Cron Expression</dt>
                      <dd className="font-mono text-gray-800">{source.cron_expression}</dd>
                    </div>
                  )}
                  <div className="flex justify-between">
                    <dt className="text-gray-500">Total Records</dt>
                    <dd className="font-semibold text-gray-800">{source.total_records_pulled.toLocaleString()}</dd>
                  </div>
                  <div className="flex justify-between">
                    <dt className="text-gray-500">Local Records</dt>
                    <dd className="font-semibold text-gray-800">{recordCount}</dd>
                  </div>
                </dl>
              </div>

              {/* Last Sync Info */}
              <div className="bg-white rounded-lg p-4 border">
                <h4 className="font-medium text-gray-900 text-sm mb-3 flex items-center gap-2">
                  <RefreshCw className="w-4 h-4" /> Last Sync
                </h4>
                {source.last_sync_at ? (
                  <dl className="space-y-2 text-xs">
                    <div className="flex justify-between">
                      <dt className="text-gray-500">Time</dt>
                      <dd className="text-gray-800">{formatDateTime(source.last_sync_at)}</dd>
                    </div>
                    <div className="flex justify-between">
                      <dt className="text-gray-500">Status</dt>
                      <dd><span className={`badge ${getStatusColor(source.last_sync_status || '')}`}>{(source.last_sync_status || 'unknown').toUpperCase()}</span></dd>
                    </div>
                    <div className="flex justify-between">
                      <dt className="text-gray-500">Records Pulled</dt>
                      <dd className="font-semibold text-gray-800">{source.last_sync_records ?? 0}</dd>
                    </div>
                    {source.last_sync_error && (
                      <div className="mt-2 p-2 bg-red-50 rounded text-red-600 text-xs">
                        <AlertTriangle className="w-3 h-3 inline mr-1" />
                        {source.last_sync_error}
                      </div>
                    )}
                  </dl>
                ) : (
                  <p className="text-xs text-gray-400">No sync has run yet. Click "Sync Now" to trigger the first pull.</p>
                )}
              </div>

              {/* Recent Logs */}
              <div className="bg-white rounded-lg p-4 border">
                <h4 className="font-medium text-gray-900 text-sm mb-3 flex items-center gap-2">
                  <History className="w-4 h-4" /> Recent Syncs
                </h4>
                <div className="space-y-2">
                  {syncLogs.slice(0, 5).map(log => (
                    <div key={log.id} className="flex items-center justify-between text-xs">
                      <div className="flex items-center gap-2">
                        {log.status === 'success' ? <CheckCircle className="w-3 h-3 text-green-500" /> :
                         log.status === 'failed' ? <XCircle className="w-3 h-3 text-red-500" /> :
                         <AlertTriangle className="w-3 h-3 text-yellow-500" />}
                        <span className="text-gray-600">{log.records_pulled} records</span>
                      </div>
                      <span className="text-gray-400">{formatDateTime(log.started_at)}</span>
                    </div>
                  ))}
                  {syncLogs.length === 0 && (
                    <p className="text-xs text-gray-400">No sync history</p>
                  )}
                </div>
              </div>
            </div>
          </td>
        </tr>
      )}
    </>
  );
}
