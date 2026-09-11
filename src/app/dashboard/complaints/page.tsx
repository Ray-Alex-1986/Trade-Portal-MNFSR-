'use client';

import { useState } from 'react';
import DashboardLayout from '@/components/layout/DashboardLayout';
import { useDataStore } from '@/lib/data-store';
import { getStatusColor } from '@/lib/utils';
import { Search, Plus, AlertTriangle } from 'lucide-react';
import Link from 'next/link';

export default function ComplaintsPage() {
  const [search, setSearch] = useState('');
  const { complaints } = useDataStore();

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Complaints</h1>
            <p className="text-gray-500">View and track your complaints</p>
          </div>
          <Link href="/complaints/submit" className="btn-primary flex items-center gap-2"><Plus className="w-4 h-4" /> New Complaint</Link>
        </div>

        <div className="card">
          <div className="p-4 border-b">
            <div className="flex items-center gap-2 bg-gray-100 rounded-lg px-3 py-2">
              <Search className="w-4 h-4 text-gray-400" />
              <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search complaints..." className="bg-transparent border-none outline-none text-sm flex-1" />
            </div>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50">
                <tr>
                  <th className="text-left p-3 font-medium text-gray-500">Tracking #</th>
                  <th className="text-left p-3 font-medium text-gray-500">Category</th>
                  <th className="text-left p-3 font-medium text-gray-500">Subject</th>
                  <th className="text-left p-3 font-medium text-gray-500">Priority</th>
                  <th className="text-left p-3 font-medium text-gray-500">Status</th>
                  <th className="text-left p-3 font-medium text-gray-500">Days Pending</th>
                  <th className="text-left p-3 font-medium text-gray-500">Date</th>
                </tr>
              </thead>
              <tbody>
                {complaints.map(c => (
                  <tr key={c.id} className="border-t hover:bg-gray-50">
                    <td className="p-3 font-mono text-gov-green-600">{c.tracking_number}</td>
                    <td className="p-3">{c.category}</td>
                    <td className="p-3 max-w-xs truncate">{c.subject}</td>
                    <td className="p-3"><span className={`badge ${getStatusColor(c.priority)}`}>{c.priority}</span></td>
                    <td className="p-3"><span className={`badge ${getStatusColor(c.status)}`}>{c.status.replace(/_/g, ' ')}</span></td>
                    <td className="p-3">{c.days_pending}</td>
                    <td className="p-3 text-gray-500">{new Date(c.created_at).toLocaleDateString()}</td>
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
