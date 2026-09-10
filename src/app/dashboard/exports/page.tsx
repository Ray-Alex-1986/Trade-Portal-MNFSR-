'use client';

import { useState } from 'react';
import DashboardLayout from '@/components/layout/DashboardLayout';
import { mockExportRecords } from '@/lib/mock-data';
import { getStatusColor } from '@/lib/utils';
import { Search, Filter, Download, Plus } from 'lucide-react';
import Link from 'next/link';

export default function ExportRecordsPage() {
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');

  const filtered = mockExportRecords.filter(r => {
    const matchSearch = !search || r.consignment_number.toLowerCase().includes(search.toLowerCase()) || r.product.toLowerCase().includes(search.toLowerCase()) || r.destination_country.toLowerCase().includes(search.toLowerCase());
    const matchStatus = !statusFilter || r.status === statusFilter;
    return matchSearch && matchStatus;
  });

  return (
    <DashboardLayout>
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
            <button className="btn-outline flex items-center gap-2 text-sm">
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
                    <td className="p-3"><Link href={`/dashboard/exports/${record.id}`} className="text-gov-green-500 hover:underline text-xs">View</Link></td>
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
