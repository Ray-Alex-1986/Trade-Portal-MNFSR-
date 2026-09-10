'use client';

import { useState } from 'react';
import DashboardLayout from '@/components/layout/DashboardLayout';
import { mockUsers } from '@/lib/mock-data';
import { getStatusColor } from '@/lib/utils';
import { Search, Plus, Edit, Shield, UserCheck, UserX } from 'lucide-react';

export default function UserManagementPage() {
  const [search, setSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState('');

  const filtered = mockUsers.filter(u => {
    const matchSearch = !search || u.full_name.toLowerCase().includes(search.toLowerCase()) || u.email.toLowerCase().includes(search.toLowerCase());
    const matchRole = !roleFilter || u.role === roleFilter;
    return matchSearch && matchRole;
  });

  const roleLabels: Record<string, string> = {
    super_admin: 'MNFSR Super Admin', moc_admin: 'MoC Admin', tdap_admin: 'TDAP Admin',
    tdap_officer: 'TDAP Officer', nafsa_admin: 'NAFSA Admin', nafsa_officer: 'NAFSA Officer',
    tic: 'TIC', exporter: 'Exporter', buyer: 'Buyer', auditor: 'Auditor',
  };

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">User Management</h1>
            <p className="text-gray-500">Manage system users, roles, and permissions</p>
          </div>
          <button className="btn-primary flex items-center gap-2"><Plus className="w-4 h-4" /> Add User</button>
        </div>

        <div className="card">
          <div className="p-4 border-b flex flex-col md:flex-row gap-3">
            <div className="flex items-center gap-2 bg-gray-100 rounded-lg px-3 py-2 flex-1">
              <Search className="w-4 h-4 text-gray-400" />
              <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search users..." className="bg-transparent border-none outline-none text-sm flex-1" />
            </div>
            <select value={roleFilter} onChange={e => setRoleFilter(e.target.value)} className="input-field md:w-48">
              <option value="">All Roles</option>
              {Object.entries(roleLabels).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
            </select>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50">
                <tr>
                  <th className="text-left p-3 font-medium text-gray-500">User</th>
                  <th className="text-left p-3 font-medium text-gray-500">Email</th>
                  <th className="text-left p-3 font-medium text-gray-500">Role</th>
                  <th className="text-left p-3 font-medium text-gray-500">Institution</th>
                  <th className="text-left p-3 font-medium text-gray-500">Status</th>
                  <th className="text-left p-3 font-medium text-gray-500">Last Login</th>
                  <th className="text-left p-3 font-medium text-gray-500">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map(user => (
                  <tr key={user.id} className="border-t hover:bg-gray-50">
                    <td className="p-3">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 bg-gov-green-100 text-gov-green-700 rounded-full flex items-center justify-center font-bold text-sm">
                          {user.full_name.charAt(0)}
                        </div>
                        <span className="font-medium">{user.full_name}</span>
                      </div>
                    </td>
                    <td className="p-3 text-gray-500">{user.email}</td>
                    <td className="p-3"><span className="badge bg-gov-green-50 text-gov-green-700">{roleLabels[user.role]}</span></td>
                    <td className="p-3 text-gray-500">{user.institution || '-'}</td>
                    <td className="p-3"><span className={`badge ${user.is_active ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>{user.is_active ? 'Active' : 'Inactive'}</span></td>
                    <td className="p-3 text-gray-500">{user.last_login ? new Date(user.last_login).toLocaleDateString() : '-'}</td>
                    <td className="p-3">
                      <div className="flex gap-2">
                        <button className="p-1.5 rounded hover:bg-gray-100" title="Edit"><Edit className="w-4 h-4 text-gray-500" /></button>
                        <button className="p-1.5 rounded hover:bg-gray-100" title="Toggle Active">{user.is_active ? <UserX className="w-4 h-4 text-red-500" /> : <UserCheck className="w-4 h-4 text-green-500" />}</button>
                      </div>
                    </td>
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
