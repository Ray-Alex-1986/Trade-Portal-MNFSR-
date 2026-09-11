'use client';

import { useState } from 'react';
import DashboardLayout from '@/components/layout/DashboardLayout';
import { useDataStore } from '@/lib/data-store';
import { ExportRecord } from '@/lib/types';
import { getStatusColor } from '@/lib/utils';
import { Search, Download, Plus, Edit, Trash2, Eye, X, CheckCircle, AlertTriangle, Save, Info } from 'lucide-react';
import Link from 'next/link';

const EDITABLE_STATUSES = ['draft', 'submitted', 'additional_info_required', 'rejected'];
const isEditable = (status: string) => EDITABLE_STATUSES.includes(status);

export default function ExportRecordsPage() {
  const { exportRecords, masterItems, updateExportRecord, deleteExportRecord } = useDataStore();
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [viewRecord, setViewRecord] = useState<ExportRecord | null>(null);
  const [editRecord, setEditRecord] = useState<ExportRecord | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);
  const [toast, setToast] = useState<{ msg: string; type: 'success' | 'error' | 'info' } | null>(null);

  const products = masterItems.products || [];
  const countries = masterItems.countries || [];

  const showToast = (msg: string, type: 'success' | 'error' | 'info' = 'success') => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3500);
  };

  const records = exportRecords;

  const filtered = records.filter(r => {
    const matchSearch = !search || r.consignment_number.toLowerCase().includes(search.toLowerCase()) || r.product.toLowerCase().includes(search.toLowerCase()) || r.destination_country.toLowerCase().includes(search.toLowerCase());
    const matchStatus = !statusFilter || r.status === statusFilter;
    return matchSearch && matchStatus;
  });

  const handleDelete = (id: string) => {
    const record = records.find(r => r.id === id);
    deleteExportRecord(id);
    setDeleteConfirm(null);
    showToast(`Record "${record?.consignment_number}" deleted`);
  };

  const startEdit = (record: ExportRecord) => {
    setViewRecord(null);
    setEditRecord({ ...record });
  };

  const setEditField = (field: keyof ExportRecord, value: string | number) => {
    setEditRecord(prev => prev ? { ...prev, [field]: value } : prev);
  };

  const handleSaveEdit = () => {
    if (!editRecord) return;
    if (!editRecord.product.trim()) {
      showToast('Product is required.', 'error');
      return;
    }
    if (!editRecord.quantity || editRecord.quantity <= 0) {
      showToast('Quantity must be greater than zero.', 'error');
      return;
    }
    if (!editRecord.estimated_value || editRecord.estimated_value <= 0) {
      showToast('Estimated value must be greater than zero.', 'error');
      return;
    }
    const wasReturned = ['rejected', 'additional_info_required'].includes(editRecord.status);
    updateExportRecord(editRecord.id, {
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
    showToast(wasReturned
      ? `Record ${editRecord.consignment_number} updated and resubmitted for review.`
      : `Record ${editRecord.consignment_number} updated successfully.`);
    setEditRecord(null);
  };

  const handleExportCSV = () => {
    const headers = ['Consignment #', 'Product', 'Quantity', 'Unit', 'Destination', 'Value', 'Currency', 'Status', 'Date'];
    const rows = filtered.map(r => [r.consignment_number, r.product, r.quantity, r.unit, r.destination_country, r.estimated_value, r.currency, r.status, r.created_at]);
    const csv = [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = 'export-records.csv'; a.click();
    URL.revokeObjectURL(url);
    showToast('CSV exported successfully');
  };

  return (
    <DashboardLayout>
      {toast && (
        <div className={`fixed top-4 right-4 z-50 flex items-center gap-2 px-4 py-3 rounded-lg shadow-lg max-w-md ${toast.type === 'error' ? 'bg-red-600' : toast.type === 'info' ? 'bg-blue-600' : 'bg-green-600'} text-white`}>
          {toast.type === 'error' ? <AlertTriangle className="w-4 h-4 flex-shrink-0" /> : <CheckCircle className="w-4 h-4 flex-shrink-0" />}
          <span className="text-sm">{toast.msg}</span>
        </div>
      )}

      {/* View Record Modal */}
      {viewRecord && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-lg max-h-[80vh] overflow-y-auto p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-bold">{viewRecord.consignment_number}</h2>
              <button onClick={() => setViewRecord(null)} className="p-1 hover:bg-gray-100 rounded"><X className="w-5 h-5" /></button>
            </div>
            <div className="space-y-3 text-sm">
              <div className="grid grid-cols-2 gap-3">
                <div><span className="text-gray-500">Product:</span><p className="font-medium">{viewRecord.product}</p></div>
                <div><span className="text-gray-500">HS Code:</span><p className="font-mono">{viewRecord.hs_code}</p></div>
                <div><span className="text-gray-500">Quantity:</span><p className="font-medium">{viewRecord.quantity} {viewRecord.unit}</p></div>
                <div><span className="text-gray-500">Value:</span><p className="font-medium">{viewRecord.currency} {viewRecord.estimated_value.toLocaleString()}</p></div>
                <div><span className="text-gray-500">Destination:</span><p className="font-medium">{viewRecord.destination_country}</p></div>
                <div><span className="text-gray-500">Status:</span><p><span className={`badge ${getStatusColor(viewRecord.status)}`}>{viewRecord.status.replace(/_/g, ' ').toUpperCase()}</span></p></div>
                <div><span className="text-gray-500">Exporter ID:</span><p className="font-medium">{viewRecord.company_id}</p></div>
                <div><span className="text-gray-500">Buyer:</span><p className="font-medium">{viewRecord.buyer_name}</p></div>
                <div><span className="text-gray-500">Created:</span><p>{new Date(viewRecord.created_at).toLocaleString()}</p></div>
                <div><span className="text-gray-500">Updated:</span><p>{new Date(viewRecord.updated_at).toLocaleString()}</p></div>
              </div>
            </div>
            <div className="flex gap-3 mt-6">
              {isEditable(viewRecord.status) && (
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
              <button onClick={() => setEditRecord(null)} className="p-1 hover:bg-gray-100 rounded"><X className="w-5 h-5" /></button>
            </div>
            {['rejected', 'additional_info_required'].includes(editRecord.status) && (
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
                      {products.map(p => <option key={p}>{p}</option>)}
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
              <button onClick={handleSaveEdit} className="btn-primary flex-1 flex items-center justify-center gap-2"><Save className="w-4 h-4" /> {['rejected', 'additional_info_required'].includes(editRecord.status) ? 'Save & Resubmit' : 'Save Changes'}</button>
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
            <p className="text-gray-500 text-sm mb-6">This will permanently remove <strong>{records.find(r => r.id === deleteConfirm)?.consignment_number}</strong>.</p>
            <div className="flex gap-3">
              <button onClick={() => handleDelete(deleteConfirm)} className="bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded-lg flex-1">Delete</button>
              <button onClick={() => setDeleteConfirm(null)} className="btn-outline flex-1">Cancel</button>
            </div>
          </div>
        </div>
      )}

      <div className="space-y-6">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Export Records</h1>
            <p className="text-gray-500">Manage your export consignments and track their status</p>
          </div>
          <Link href="/dashboard/exports/new" className="btn-primary flex items-center gap-2">
            <Plus className="w-4 h-4" /> New Export Record
          </Link>
        </div>

        <div className="card">
          <div className="p-4 border-b flex flex-col md:flex-row gap-3">
            <div className="flex items-center gap-2 bg-gray-100 rounded-lg px-3 py-2 flex-1">
              <Search className="w-4 h-4 text-gray-400" />
              <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search by consignment #, product, or country..." className="bg-transparent border-none outline-none text-sm flex-1" />
            </div>
            <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)} className="input-field md:w-48">
              <option value="">All Statuses</option>
              <option value="draft">Draft</option>
              <option value="submitted">Submitted</option>
              <option value="under_tdap_review">Under TDAP Review</option>
              <option value="under_nafsa_review">Under NAFSA Review</option>
              <option value="additional_info_required">Additional Info Required</option>
              <option value="approved">Approved</option>
              <option value="rejected">Rejected</option>
              <option value="shipped">Shipped</option>
              <option value="delivered">Delivered</option>
            </select>
            <button onClick={handleExportCSV} className="btn-outline flex items-center gap-2 text-sm">
              <Download className="w-4 h-4" /> Export CSV
            </button>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50">
                <tr>
                  <th className="text-left p-3 font-medium text-gray-500">Consignment #</th>
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
                {filtered.slice(0, 20).map(record => (
                  <tr key={record.id} className="border-t hover:bg-gray-50">
                    <td className="p-3 font-mono text-gov-green-600 font-medium">{record.consignment_number}</td>
                    <td className="p-3">{record.product}</td>
                    <td className="p-3">{record.quantity} {record.unit}</td>
                    <td className="p-3">{record.destination_country}</td>
                    <td className="p-3">{record.currency} {record.estimated_value.toLocaleString()}</td>
                    <td className="p-3"><span className={`badge ${getStatusColor(record.status)}`}>{record.status.replace(/_/g, ' ').toUpperCase()}</span></td>
                    <td className="p-3 text-gray-500">{new Date(record.created_at).toLocaleDateString()}</td>
                    <td className="p-3">
                      <div className="flex gap-1">
                        <button onClick={() => setViewRecord(record)} className="p-1.5 rounded hover:bg-blue-50" title="View"><Eye className="w-4 h-4 text-blue-500" /></button>
                        {isEditable(record.status) ? (
                          <button onClick={() => startEdit(record)} className="p-1.5 rounded hover:bg-green-50" title="Edit"><Edit className="w-4 h-4 text-green-500" /></button>
                        ) : (
                          <button disabled className="p-1.5 rounded opacity-30 cursor-not-allowed" title="Locked — only draft, submitted, or returned records can be edited"><Edit className="w-4 h-4 text-green-500" /></button>
                        )}
                        <button onClick={() => setDeleteConfirm(record.id)} className="p-1.5 rounded hover:bg-red-50" title="Delete"><Trash2 className="w-4 h-4 text-red-400" /></button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="p-4 border-t flex items-center justify-between text-sm text-gray-500">
            <span>Showing {Math.min(filtered.length, 20)} of {filtered.length} records</span>
            <div className="flex gap-2">
              <button className="px-3 py-1 border rounded-lg hover:bg-gray-50">Previous</button>
              <button className="px-3 py-1 border rounded-lg bg-gov-green-500 text-white">1</button>
              <button className="px-3 py-1 border rounded-lg hover:bg-gray-50">2</button>
              <button className="px-3 py-1 border rounded-lg hover:bg-gray-50">3</button>
              <button className="px-3 py-1 border rounded-lg hover:bg-gray-50">Next</button>
            </div>
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
}
