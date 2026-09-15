'use client';

import { Suspense, useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';
import DashboardLayout from '@/components/layout/DashboardLayout';
import RoleGuard from '@/components/auth/RoleGuard';
import { useToast } from '@/components/ui/Toast';
import { useDataStore } from '@/lib/data-store';
import { useAuth } from '@/lib/auth';
import { hasPermission, ROUTE_ROLES } from '@/lib/permissions';
import { ExportRecord } from '@/lib/types';
import { formatDate, formatDateTime, getStatusColor } from '@/lib/utils';
import { Search, Download, Plus, Edit, Trash2, Eye, X, Save, Info, Package } from 'lucide-react';

const EDITABLE_STATUSES = ['draft', 'submitted', 'additional_info_required', 'rejected'];
const RETURNED_STATUSES = ['rejected', 'additional_info_required'];
const PAGE_SIZE = 20;

const STATUS_OPTIONS = [
  'draft', 'submitted', 'under_tdap_review', 'under_nafsa_review',
  'additional_info_required', 'approved', 'rejected', 'ready_for_shipment',
  'shipped', 'delivered', 'closed', 'cancelled',
];

function ExportRecordsPage() {
  const { exportRecords, companies, masterItems, updateExportRecord, deleteExportRecord, isLoaded } = useDataStore();
  const { user } = useAuth();
  const { showToast, ToastView } = useToast();
  const searchParams = useSearchParams();

  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [page, setPage] = useState(1);
  const [viewRecord, setViewRecord] = useState<ExportRecord | null>(null);
  const [editRecord, setEditRecord] = useState<ExportRecord | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const products = masterItems.products || [];
  const countries = masterItems.countries || [];

  const canViewAll = hasPermission(user?.role, 'canViewAllExportRecords');
  const canCreate = hasPermission(user?.role, 'canCreateExportRecord');
  const isReadOnly = hasPermission(user?.role, 'isReadOnly');

  // Prefill from the header search box.
  useEffect(() => {
    const query = searchParams.get('q');
    if (query) setSearch(query);
  }, [searchParams]);

  /** Exporters only ever see their own consignments. */
  const records = useMemo(
    () => (canViewAll ? exportRecords : exportRecords.filter(record => record.exporter_id === user?.id)),
    [exportRecords, canViewAll, user?.id],
  );

  const companyName = (companyId: string) => companies.find(company => company.id === companyId)?.legal_name ?? '—';

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    return records.filter(record => {
      const matchSearch = !term
        || record.consignment_number.toLowerCase().includes(term)
        || record.product.toLowerCase().includes(term)
        || record.destination_country.toLowerCase().includes(term)
        || record.buyer_company.toLowerCase().includes(term);
      const matchStatus = !statusFilter || record.status === statusFilter;
      return matchSearch && matchStatus;
    });
  }, [records, search, statusFilter]);

  useEffect(() => { setPage(1); }, [search, statusFilter]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const currentPage = Math.min(page, totalPages);
  const visible = filtered.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);

  const canEditRecord = (record: ExportRecord) =>
    !isReadOnly && EDITABLE_STATUSES.includes(record.status) && (canViewAll || record.exporter_id === user?.id);
  const canDeleteRecord = (record: ExportRecord) => !isReadOnly && (canViewAll || record.exporter_id === user?.id);

  const handleDelete = async (id: string) => {
    const record = records.find(item => item.id === id);
    setBusy(true);
    try {
      const result = await deleteExportRecord(id);
      if (result.error) {
        showToast(result.error, 'error');
        return;
      }
      showToast(`Record ${record?.consignment_number ?? ''} deleted.`);
      setDeleteConfirm(null);
      if (viewRecord?.id === id) setViewRecord(null);
    } finally {
      setBusy(false);
    }
  };

  const startEdit = (record: ExportRecord) => {
    setViewRecord(null);
    setEditRecord({ ...record });
  };

  const setEditField = (field: keyof ExportRecord, value: string | number) => {
    setEditRecord(prev => prev ? { ...prev, [field]: value } : prev);
  };

  const handleSaveEdit = async () => {
    if (!editRecord) return;
    if (!editRecord.product.trim()) {
      showToast('Product is required.', 'error');
      return;
    }
    if (!editRecord.quantity || Number(editRecord.quantity) <= 0) {
      showToast('Quantity must be greater than zero.', 'error');
      return;
    }
    if (!editRecord.estimated_value || Number(editRecord.estimated_value) <= 0) {
      showToast('Estimated value must be greater than zero.', 'error');
      return;
    }
    if (!editRecord.destination_country) {
      showToast('Select a destination country.', 'error');
      return;
    }

    const wasReturned = RETURNED_STATUSES.includes(editRecord.status);
    setBusy(true);
    try {
      const result = await updateExportRecord(editRecord.id, {
        product: editRecord.product.trim(),
        hs_code: editRecord.hs_code,
        description: editRecord.description,
        quantity: Number(editRecord.quantity),
        unit: editRecord.unit,
        estimated_value: Number(editRecord.estimated_value),
        currency: editRecord.currency,
        destination_country: editRecord.destination_country,
        destination_port: editRecord.destination_port,
        buyer_name: editRecord.buyer_name,
        buyer_company: editRecord.buyer_company,
        buyer_country: editRecord.buyer_country,
        buyer_email: editRecord.buyer_email,
        buyer_phone: editRecord.buyer_phone,
        purchase_order: editRecord.purchase_order,
        transport_mode: editRecord.transport_mode,
        shipping_company: editRecord.shipping_company,
        container_number: editRecord.container_number,
        bill_of_lading: editRecord.bill_of_lading,
        intended_shipment_date: editRecord.intended_shipment_date,
        expected_departure: editRecord.expected_departure,
        expected_arrival: editRecord.expected_arrival,
        // Records returned by reviewers re-enter the review queue once corrected
        status: wasReturned ? 'submitted' : editRecord.status,
      });
      if (result.error) {
        showToast(result.error, 'error');
        return;
      }
      showToast(wasReturned
        ? `Record ${editRecord.consignment_number} updated and resubmitted for review.`
        : `Record ${editRecord.consignment_number} updated successfully.`);
      setEditRecord(null);
    } finally {
      setBusy(false);
    }
  };

  const handleExportCSV = () => {
    if (filtered.length === 0) {
      showToast('There are no records to export.', 'info');
      return;
    }
    const headers = ['Consignment #', 'Company', 'Product', 'Quantity', 'Unit', 'Destination', 'Value', 'Currency', 'Status', 'Created'];
    const escape = (value: unknown) => `"${String(value ?? '').replace(/"/g, '""')}"`;
    const rows = filtered.map(record => [
      record.consignment_number, companyName(record.company_id), record.product, record.quantity, record.unit,
      record.destination_country, record.estimated_value, record.currency, record.status, record.created_at,
    ]);
    const csv = [headers, ...rows].map(row => row.map(escape).join(',')).join('\n');
    const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }));
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = `export-records-${new Date().toISOString().slice(0, 10)}.csv`;
    anchor.click();
    URL.revokeObjectURL(url);
    showToast(`${filtered.length} record${filtered.length === 1 ? '' : 's'} exported to CSV.`);
  };

  return (
    <DashboardLayout>
      <RoleGuard allow={ROUTE_ROLES['/dashboard/exports']}>
        <ToastView />

        {/* View Record Modal */}
        {viewRecord && (
          <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
            <div className="bg-white rounded-xl shadow-xl w-full max-w-2xl max-h-[85vh] overflow-y-auto p-6">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h2 className="text-lg font-bold">{viewRecord.consignment_number}</h2>
                  <p className="text-sm text-gray-500">{companyName(viewRecord.company_id)}</p>
                </div>
                <button onClick={() => setViewRecord(null)} aria-label="Close" className="p-1 hover:bg-gray-100 rounded"><X className="w-5 h-5" /></button>
              </div>
              <div className="space-y-4 text-sm">
                <div className="grid sm:grid-cols-2 gap-3">
                  <div><span className="text-gray-500">Product:</span><p className="font-medium">{viewRecord.product}</p></div>
                  <div><span className="text-gray-500">HS Code:</span><p className="font-mono">{viewRecord.hs_code}</p></div>
                  <div><span className="text-gray-500">Quantity:</span><p className="font-medium">{viewRecord.quantity} {viewRecord.unit}</p></div>
                  <div><span className="text-gray-500">Value:</span><p className="font-medium">{viewRecord.currency} {viewRecord.estimated_value.toLocaleString()}</p></div>
                  <div><span className="text-gray-500">Destination:</span><p className="font-medium">{viewRecord.destination_country} {viewRecord.destination_port ? `(${viewRecord.destination_port})` : ''}</p></div>
                  <div><span className="text-gray-500">Status:</span><p><span className={`badge ${getStatusColor(viewRecord.status)}`}>{viewRecord.status.replace(/_/g, ' ').toUpperCase()}</span></p></div>
                  <div><span className="text-gray-500">Buyer:</span><p className="font-medium">{viewRecord.buyer_name || '—'}{viewRecord.buyer_company ? `, ${viewRecord.buyer_company}` : ''}</p></div>
                  <div><span className="text-gray-500">Buyer contact:</span><p className="font-medium">{viewRecord.buyer_email || '—'}</p></div>
                  <div><span className="text-gray-500">Transport:</span><p className="font-medium">{[viewRecord.transport_mode, viewRecord.shipping_company].filter(Boolean).join(' via ') || '—'}</p></div>
                  <div><span className="text-gray-500">Origin province:</span><p className="font-medium">{viewRecord.province_of_production || '—'}</p></div>
                  <div><span className="text-gray-500">TDAP stage:</span><p className="font-medium">{viewRecord.tdap_review_status?.replace(/_/g, ' ') || 'pending'}</p></div>
                  <div><span className="text-gray-500">NAFSA stage:</span><p className="font-medium">{viewRecord.nafsa_review_status?.replace(/_/g, ' ') || 'not started'}</p></div>
                  <div><span className="text-gray-500">Created:</span><p>{formatDateTime(viewRecord.created_at)}</p></div>
                  <div><span className="text-gray-500">Updated:</span><p>{formatDateTime(viewRecord.updated_at)}</p></div>
                </div>
                {viewRecord.description && (
                  <div className="p-3 bg-gray-50 rounded-lg"><span className="text-gray-500">Description:</span> {viewRecord.description}</div>
                )}
                <div>
                  <p className="font-medium text-gray-700 mb-2">Documents ({viewRecord.documents.length})</p>
                  {viewRecord.documents.length === 0 ? (
                    <p className="text-gray-400">No documents attached.</p>
                  ) : (
                    <div className="space-y-2">
                      {viewRecord.documents.map(document => (
                        <div key={document.id} className="flex items-center justify-between p-2 bg-gray-50 rounded-lg">
                          <span className="truncate">{document.document_type}</span>
                          <span className={`badge ${document.verification_status === 'verified' ? 'bg-green-100 text-green-800' : 'bg-yellow-100 text-yellow-800'}`}>
                            {document.verification_status}
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
              <div className="flex gap-3 mt-6">
                {canEditRecord(viewRecord) && (
                  <button onClick={() => startEdit(viewRecord)} className="btn-primary flex items-center gap-2"><Edit className="w-4 h-4" /> Edit</button>
                )}
                <button onClick={() => setViewRecord(null)} className="btn-outline">Close</button>
              </div>
            </div>
          </div>
        )}

        {/* Edit Record Modal */}
        {editRecord && (
          <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
            <div className="bg-white rounded-xl shadow-xl w-full max-w-2xl max-h-[85vh] overflow-y-auto p-6">
              <div className="flex items-center justify-between mb-1">
                <h2 className="text-lg font-bold">Edit {editRecord.consignment_number}</h2>
                <button onClick={() => setEditRecord(null)} aria-label="Close" className="p-1 hover:bg-gray-100 rounded"><X className="w-5 h-5" /></button>
              </div>
              {RETURNED_STATUSES.includes(editRecord.status) && (
                <div className="flex items-start gap-2 p-3 mb-4 bg-amber-50 border border-amber-200 text-amber-800 rounded-lg text-sm">
                  <Info className="w-4 h-4 flex-shrink-0 mt-0.5" />
                  <span>This record was returned for corrections. Saving will resubmit it for review.</span>
                </div>
              )}

              <div className="space-y-5">
                <div>
                  <h3 className="font-semibold text-gray-900 mb-3 text-sm uppercase tracking-wide">Export Item</h3>
                  <div className="grid md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Product *</label>
                      <select value={editRecord.product} onChange={e => setEditField('product', e.target.value)} className="input-field">
                        {[editRecord.product, ...products.filter(p => p !== editRecord.product)].filter(Boolean).map(p => <option key={p}>{p}</option>)}
                      </select>
                    </div>
                    <div><label className="block text-sm font-medium text-gray-700 mb-1">HS Code</label><input value={editRecord.hs_code} onChange={e => setEditField('hs_code', e.target.value)} className="input-field" /></div>
                    <div className="md:col-span-2"><label className="block text-sm font-medium text-gray-700 mb-1">Description</label><textarea value={editRecord.description} onChange={e => setEditField('description', e.target.value)} className="input-field" rows={2} /></div>
                    <div><label className="block text-sm font-medium text-gray-700 mb-1">Quantity *</label><input type="number" min="0" value={editRecord.quantity} onChange={e => setEditField('quantity', Number(e.target.value))} className="input-field" /></div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Unit</label>
                      <select value={editRecord.unit} onChange={e => setEditField('unit', e.target.value)} className="input-field">
                        <option>Metric Tons</option><option>Kilograms</option><option>Containers</option><option>Pieces</option>
                      </select>
                    </div>
                    <div><label className="block text-sm font-medium text-gray-700 mb-1">Estimated Value *</label><input type="number" min="0" value={editRecord.estimated_value} onChange={e => setEditField('estimated_value', Number(e.target.value))} className="input-field" /></div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Currency</label>
                      <select value={editRecord.currency} onChange={e => setEditField('currency', e.target.value)} className="input-field">
                        <option>USD</option><option>PKR</option><option>EUR</option><option>GBP</option><option>AED</option>
                      </select>
                    </div>
                  </div>
                </div>

                <div>
                  <h3 className="font-semibold text-gray-900 mb-3 text-sm uppercase tracking-wide">Buyer / Shipment</h3>
                  <div className="grid md:grid-cols-2 gap-4">
                    <div><label className="block text-sm font-medium text-gray-700 mb-1">Buyer Name</label><input value={editRecord.buyer_name} onChange={e => setEditField('buyer_name', e.target.value)} className="input-field" /></div>
                    <div><label className="block text-sm font-medium text-gray-700 mb-1">Buyer Company</label><input value={editRecord.buyer_company} onChange={e => setEditField('buyer_company', e.target.value)} className="input-field" /></div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Buyer Country</label>
                      <select value={editRecord.buyer_country} onChange={e => setEditField('buyer_country', e.target.value)} className="input-field">
                        <option value="">Select</option>
                        {countries.map(c => <option key={c}>{c}</option>)}
                      </select>
                    </div>
                    <div><label className="block text-sm font-medium text-gray-700 mb-1">Buyer Email</label><input type="email" value={editRecord.buyer_email} onChange={e => setEditField('buyer_email', e.target.value)} className="input-field" /></div>
                    <div><label className="block text-sm font-medium text-gray-700 mb-1">Buyer Phone</label><input value={editRecord.buyer_phone} onChange={e => setEditField('buyer_phone', e.target.value)} className="input-field" /></div>
                    <div><label className="block text-sm font-medium text-gray-700 mb-1">Purchase Order #</label><input value={editRecord.purchase_order} onChange={e => setEditField('purchase_order', e.target.value)} className="input-field" /></div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Destination Country *</label>
                      <select value={editRecord.destination_country} onChange={e => setEditField('destination_country', e.target.value)} className="input-field">
                        <option value="">Select</option>
                        {countries.map(c => <option key={c}>{c}</option>)}
                      </select>
                    </div>
                    <div><label className="block text-sm font-medium text-gray-700 mb-1">Destination Port</label><input value={editRecord.destination_port} onChange={e => setEditField('destination_port', e.target.value)} className="input-field" /></div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Transport Mode</label>
                      <select value={editRecord.transport_mode} onChange={e => setEditField('transport_mode', e.target.value)} className="input-field">
                        <option>Sea</option><option>Air</option><option>Road</option><option>Rail</option>
                      </select>
                    </div>
                    <div><label className="block text-sm font-medium text-gray-700 mb-1">Shipping Company</label><input value={editRecord.shipping_company} onChange={e => setEditField('shipping_company', e.target.value)} className="input-field" /></div>
                    <div><label className="block text-sm font-medium text-gray-700 mb-1">Container Number</label><input value={editRecord.container_number} onChange={e => setEditField('container_number', e.target.value)} className="input-field" /></div>
                    <div><label className="block text-sm font-medium text-gray-700 mb-1">Bill of Lading #</label><input value={editRecord.bill_of_lading} onChange={e => setEditField('bill_of_lading', e.target.value)} className="input-field" /></div>
                    <div><label className="block text-sm font-medium text-gray-700 mb-1">Intended Shipment Date</label><input type="date" value={editRecord.intended_shipment_date?.slice(0, 10) || ''} onChange={e => setEditField('intended_shipment_date', e.target.value)} className="input-field" /></div>
                    <div><label className="block text-sm font-medium text-gray-700 mb-1">Expected Departure</label><input type="date" value={editRecord.expected_departure?.slice(0, 10) || ''} onChange={e => setEditField('expected_departure', e.target.value)} className="input-field" /></div>
                    <div><label className="block text-sm font-medium text-gray-700 mb-1">Expected Arrival</label><input type="date" value={editRecord.expected_arrival?.slice(0, 10) || ''} onChange={e => setEditField('expected_arrival', e.target.value)} className="input-field" /></div>
                  </div>
                </div>
              </div>

              <div className="flex gap-3 mt-6 pt-4 border-t">
                <button onClick={handleSaveEdit} disabled={busy} className="btn-primary flex-1 flex items-center justify-center gap-2 disabled:opacity-50">
                  <Save className="w-4 h-4" /> {busy ? 'Saving...' : RETURNED_STATUSES.includes(editRecord.status) ? 'Save & Resubmit' : 'Save Changes'}
                </button>
                <button onClick={() => setEditRecord(null)} className="btn-outline flex-1">Cancel</button>
              </div>
            </div>
          </div>
        )}

        {/* Delete Confirm Modal */}
        {deleteConfirm && (
          <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
            <div className="bg-white rounded-xl shadow-xl w-full max-w-sm p-6 text-center">
              <div className="w-12 h-12 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <Trash2 className="w-6 h-6 text-red-600" />
              </div>
              <h3 className="text-lg font-bold text-gray-900 mb-2">Delete Record?</h3>
              <p className="text-gray-500 text-sm mb-6">
                This permanently removes <strong>{records.find(item => item.id === deleteConfirm)?.consignment_number}</strong>.
              </p>
              <div className="flex gap-3">
                <button onClick={() => handleDelete(deleteConfirm)} disabled={busy} className="bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded-lg flex-1 disabled:opacity-50">
                  {busy ? 'Deleting...' : 'Delete'}
                </button>
                <button onClick={() => setDeleteConfirm(null)} className="btn-outline flex-1">Cancel</button>
              </div>
            </div>
          </div>
        )}

        <div className="space-y-6">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">Export Records</h1>
              <p className="text-gray-500">
                {canViewAll ? 'All consignments submitted to the portal' : 'Manage your export consignments and track their status'}
              </p>
            </div>
            {canCreate && (
              <Link href="/dashboard/exports/new" className="btn-primary flex items-center gap-2">
                <Plus className="w-4 h-4" /> New Export Record
              </Link>
            )}
          </div>

          <div className="card">
            <div className="p-4 border-b flex flex-col md:flex-row gap-3">
              <div className="flex items-center gap-2 bg-gray-100 rounded-lg px-3 py-2 flex-1">
                <Search className="w-4 h-4 text-gray-400" />
                <input
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                  placeholder="Search by consignment #, product, buyer, or country..."
                  aria-label="Search export records"
                  className="bg-transparent border-none outline-none text-sm flex-1"
                />
              </div>
              <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)} aria-label="Filter by status" className="input-field md:w-52">
                <option value="">All Statuses</option>
                {STATUS_OPTIONS.map(status => (
                  <option key={status} value={status}>{status.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())}</option>
                ))}
              </select>
              <button onClick={handleExportCSV} className="btn-outline flex items-center gap-2 text-sm whitespace-nowrap">
                <Download className="w-4 h-4" /> Export CSV
              </button>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="text-left p-3 font-medium text-gray-500">Consignment #</th>
                    {canViewAll && <th className="text-left p-3 font-medium text-gray-500">Company</th>}
                    <th className="text-left p-3 font-medium text-gray-500">Product</th>
                    <th className="text-left p-3 font-medium text-gray-500">Quantity</th>
                    <th className="text-left p-3 font-medium text-gray-500">Destination</th>
                    <th className="text-left p-3 font-medium text-gray-500">Value</th>
                    <th className="text-left p-3 font-medium text-gray-500">Status</th>
                    <th className="text-left p-3 font-medium text-gray-500">Date</th>
                    <th className="text-left p-3 font-medium text-gray-500">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {visible.map(record => (
                    <tr key={record.id} className="border-t hover:bg-gray-50">
                      <td className="p-3 font-mono text-gov-green-600 font-medium">{record.consignment_number}</td>
                      {canViewAll && <td className="p-3 text-gray-500 max-w-[12rem] truncate">{companyName(record.company_id)}</td>}
                      <td className="p-3">{record.product}</td>
                      <td className="p-3">{record.quantity} {record.unit}</td>
                      <td className="p-3">{record.destination_country || '—'}</td>
                      <td className="p-3">{record.currency} {record.estimated_value.toLocaleString()}</td>
                      <td className="p-3"><span className={`badge ${getStatusColor(record.status)}`}>{record.status.replace(/_/g, ' ').toUpperCase()}</span></td>
                      <td className="p-3 text-gray-500">{formatDate(record.created_at)}</td>
                      <td className="p-3">
                        <div className="flex gap-1">
                          <button onClick={() => setViewRecord(record)} className="p-1.5 rounded hover:bg-blue-50" title="View" aria-label={`View ${record.consignment_number}`}>
                            <Eye className="w-4 h-4 text-blue-500" />
                          </button>
                          <button
                            onClick={() => startEdit(record)}
                            disabled={!canEditRecord(record)}
                            className="p-1.5 rounded hover:bg-green-50 disabled:opacity-30 disabled:cursor-not-allowed"
                            title={canEditRecord(record) ? 'Edit' : 'Locked — only draft, submitted, or returned records you own can be edited'}
                            aria-label={`Edit ${record.consignment_number}`}
                          >
                            <Edit className="w-4 h-4 text-green-500" />
                          </button>
                          <button
                            onClick={() => setDeleteConfirm(record.id)}
                            disabled={!canDeleteRecord(record)}
                            className="p-1.5 rounded hover:bg-red-50 disabled:opacity-30 disabled:cursor-not-allowed"
                            title={canDeleteRecord(record) ? 'Delete' : 'You cannot delete this record'}
                            aria-label={`Delete ${record.consignment_number}`}
                          >
                            <Trash2 className="w-4 h-4 text-red-400" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                  {visible.length === 0 && (
                    <tr>
                      <td colSpan={canViewAll ? 9 : 8} className="p-12 text-center text-gray-400">
                        <Package className="w-10 h-10 mx-auto mb-3 text-gray-300" />
                        <p className="text-sm">
                          {!isLoaded ? 'Loading export records…'
                            : records.length === 0
                              ? canCreate ? 'No export records yet. Create your first consignment to get started.' : 'No export records are available for your role.'
                              : 'No records match the current filters.'}
                        </p>
                        {records.length === 0 && canCreate && (
                          <Link href="/dashboard/exports/new" className="btn-primary inline-flex items-center gap-2 mt-4">
                            <Plus className="w-4 h-4" /> New Export Record
                          </Link>
                        )}
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

            <div className="p-4 border-t flex flex-col sm:flex-row items-center justify-between gap-3 text-sm text-gray-500">
              <span>
                {filtered.length === 0
                  ? 'No records'
                  : `Showing ${(currentPage - 1) * PAGE_SIZE + 1}–${Math.min(currentPage * PAGE_SIZE, filtered.length)} of ${filtered.length} records`}
              </span>
              {totalPages > 1 && (
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setPage(currentPage - 1)}
                    disabled={currentPage === 1}
                    className="px-3 py-1 border rounded-lg hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed"
                  >
                    Previous
                  </button>
                  <span>Page {currentPage} of {totalPages}</span>
                  <button
                    onClick={() => setPage(currentPage + 1)}
                    disabled={currentPage === totalPages}
                    className="px-3 py-1 border rounded-lg hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed"
                  >
                    Next
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      </RoleGuard>
    </DashboardLayout>
  );
}

/**
 * useSearchParams() requires a Suspense boundary so this route can still be
 * prerendered as static HTML.
 */
export default function ExportRecordsRoute() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-gray-50 flex items-center justify-center text-sm text-gray-500">Loading export records…</div>}>
      <ExportRecordsPage />
    </Suspense>
  );
}
