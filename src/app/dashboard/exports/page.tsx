'use client';

import { useState } from 'react';
import DashboardLayout from '@/components/layout/DashboardLayout';
import { mockExportRecords } from '@/lib/mock-data';
import { getStatusColor } from '@/lib/utils';
import { Search, Filter, Download, Plus, Edit, Trash2, Eye, X, CheckCircle } from 'lucide-react';
import Link from 'next/link';

export default function ExportRecordsPage() {
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [records, setRecords] = useState(mockExportRecords.map(r => ({ ...r })));
  const [viewRecord, setViewRecord] = useState<typeof mockExportRecords[0] | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);
  const [toast, setToast] = useState('');

  const showToast = (msg: string) => { setToast(msg); setTimeout(() => setToast(''), 3000); };

  const filtered = records.filter(r => {
    const matchSearch = !search || r.consignment_number.toLowerCase().includes(search.toLowerCase()) || r.product.toLowerCase().includes(search.toLowerCase()) || r.destination_country.toLowerCase().includes(search.toLowerCase());
    const matchStatus = !statusFilter || r.status === statusFilter;
    return matchSearch && matchStatus;
  });

  const handleDelete = (id: string) => {
    const record = records.find(r => r.id === id);
    setRecords(prev => prev.filter(r => r.id !== id));
    setDeleteConfirm(null);
    showToast(`Record "${record?.consignment_number}" deleted`);
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
        <div className="fixed top-4 right-4 z-50 flex items-center gap-2 px-4 py-3 bg-green-600 text-white rounded-lg shadow-lg animate-pulse">
          <CheckCircle className="w-4 h-4" /> {toast}
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
              <button onClick={() => { showToast('Edit mode not available in demo'); setViewRecord(null); }} className="btn-primary flex items-center gap-2"><Edit className="w-4 h-4" /> Edit</button>
              <button onClick={() => setViewRecord(null)} className="btn-outline">Close</button>
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
                        <button onClick={() => { showToast('Edit mode not available in demo - use New Export Record form'); }} className="p-1.5 rounded hover:bg-green-50" title="Edit"><Edit className="w-4 h-4 text-green-500" /></button>
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
