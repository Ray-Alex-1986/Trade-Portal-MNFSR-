'use client';

import { useState } from 'react';
import DashboardLayout from '@/components/layout/DashboardLayout';
import RoleGuard from '@/components/auth/RoleGuard';
import { useDataStore } from '@/lib/data-store';
import { ROUTE_ROLES } from '@/lib/permissions';
import { User, UserRole } from '@/lib/types';
import { Search, Plus, Edit, Trash2, Shield, UserCheck, UserX, X, Save, CheckCircle, AlertTriangle } from 'lucide-react';

interface UserState {
  id: string; full_name: string; email: string; role: string; institution?: string | null;
  is_active: boolean; last_login?: string | null;
}

export default function UserManagementPage() {
  const { users, addUser, updateUser, deleteUser } = useDataStore();
  const [search, setSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState('');
  const [editingUser, setEditingUser] = useState<UserState | null>(null);
  const [showAdd, setShowAdd] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);
  const [toast, setToast] = useState<{ msg: string; type: 'success' | 'error' } | null>(null);

  const [newUser, setNewUser] = useState({ full_name: '', email: '', role: 'exporter', institution: '' });

  const showToast = (msg: string, type: 'success' | 'error' = 'success') => { setToast({ msg, type }); setTimeout(() => setToast(null), 3000); };

  const filtered = users.filter(u => {
    const matchSearch = !search || u.full_name.toLowerCase().includes(search.toLowerCase()) || u.email.toLowerCase().includes(search.toLowerCase());
    const matchRole = !roleFilter || u.role === roleFilter;
    return matchSearch && matchRole;
  });

  const roleLabels: Record<string, string> = {
    super_admin: 'MNFSR Super Admin', moc_admin: 'MoC Admin', tdap_admin: 'TDAP Admin',
    tdap_officer: 'TDAP Officer', nafsa_admin: 'NAFSA Admin', nafsa_officer: 'NAFSA Officer',
    tic: 'TIC', exporter: 'Exporter', buyer: 'Buyer', auditor: 'Auditor',
  };

  const handleEdit = (user: User) => { setEditingUser({ ...user }); };
  const handleSaveEdit = () => {
    if (!editingUser) return;
    if (!editingUser.full_name.trim() || !editingUser.email.trim()) {
      showToast('Full name and email are required.', 'error');
      return;
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(editingUser.email.trim())) {
      showToast('Please enter a valid email address.', 'error');
      return;
    }
    if (users.some(u => u.id !== editingUser.id && u.email.toLowerCase() === editingUser.email.trim().toLowerCase())) {
      showToast('Another user with this email already exists.', 'error');
      return;
    }
    updateUser(editingUser.id, {
      full_name: editingUser.full_name.trim(),
      email: editingUser.email.trim(),
      role: editingUser.role as UserRole,
      institution: editingUser.institution || undefined,
      is_active: editingUser.is_active,
    });
    showToast(`User "${editingUser.full_name}" updated successfully`);
    setEditingUser(null);
  };

  const handleToggleActive = (userId: string) => {
    const user = users.find(u => u.id === userId);
    if (!user) return;
    updateUser(userId, { is_active: !user.is_active });
    showToast(`User "${user.full_name}" ${!user.is_active ? 'activated' : 'deactivated'}`);
  };

  const handleDelete = (userId: string) => {
    const user = users.find(u => u.id === userId);
    deleteUser(userId);
    setDeleteConfirm(null);
    showToast(`User "${user?.full_name}" deleted successfully`);
  };

  const handleAddUser = () => {
    if (!newUser.full_name.trim() || !newUser.email.trim()) return;
    if (!/^\S+@\S+\.\S+$/.test(newUser.email.trim())) {
      showToast('Please enter a valid email address.', 'error');
      return;
    }
    if (users.some(u => u.email.toLowerCase() === newUser.email.trim().toLowerCase())) {
      showToast('A user with this email already exists.', 'error');
      return;
    }
    addUser({ full_name: newUser.full_name.trim(), email: newUser.email.trim(), role: newUser.role, institution: newUser.institution || undefined });
    showToast(`User "${newUser.full_name}" added successfully`);
    setNewUser({ full_name: '', email: '', role: 'exporter', institution: '' });
    setShowAdd(false);
  };

  return (
    <DashboardLayout>
      <RoleGuard allow={ROUTE_ROLES['/admin/users']}>
      {toast && (
        <div className={`fixed top-4 right-4 z-50 flex items-center gap-2 px-4 py-3 rounded-lg shadow-lg max-w-md ${toast.type === 'error' ? 'bg-red-600' : 'bg-green-600'} text-white`}>
          {toast.type === 'error' ? <AlertTriangle className="w-4 h-4 flex-shrink-0" /> : <CheckCircle className="w-4 h-4 flex-shrink-0" />}
          <span className="text-sm">{toast.msg}</span>
        </div>
      )}

      <div className="space-y-6">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">User Management</h1>
            <p className="text-gray-500">Manage system users, roles, and permissions</p>
          </div>
          <button onClick={() => setShowAdd(true)} className="btn-primary flex items-center gap-2"><Plus className="w-4 h-4" /> Add User</button>
        </div>

        {/* Add User Modal */}
        {showAdd && (
          <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
            <div className="bg-white rounded-xl shadow-xl w-full max-w-md p-6">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-bold">Add New User</h2>
                <button onClick={() => setShowAdd(false)} className="p-1 hover:bg-gray-100 rounded"><X className="w-5 h-5" /></button>
              </div>
              <div className="space-y-3">
                <div><label className="block text-sm font-medium text-gray-700 mb-1">Full Name *</label><input value={newUser.full_name} onChange={e => setNewUser({ ...newUser, full_name: e.target.value })} className="input-field" placeholder="Enter full name" /></div>
                <div><label className="block text-sm font-medium text-gray-700 mb-1">Email *</label><input type="email" value={newUser.email} onChange={e => setNewUser({ ...newUser, email: e.target.value })} className="input-field" placeholder="Enter email" /></div>
                <div><label className="block text-sm font-medium text-gray-700 mb-1">Role *</label>
                  <select value={newUser.role} onChange={e => setNewUser({ ...newUser, role: e.target.value })} className="input-field">
                    {Object.entries(roleLabels).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                  </select>
                </div>
                <div><label className="block text-sm font-medium text-gray-700 mb-1">Institution</label><input value={newUser.institution} onChange={e => setNewUser({ ...newUser, institution: e.target.value })} className="input-field" placeholder="e.g., TDAP, NAFSA" /></div>
              </div>
              <div className="flex gap-3 mt-6">
                <button onClick={handleAddUser} disabled={!newUser.full_name || !newUser.email} className="btn-primary flex-1 disabled:opacity-50">Add User</button>
                <button onClick={() => setShowAdd(false)} className="btn-outline flex-1">Cancel</button>
              </div>
            </div>
          </div>
        )}

        {/* Edit User Modal */}
        {editingUser && (
          <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
            <div className="bg-white rounded-xl shadow-xl w-full max-w-md p-6">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-bold">Edit User</h2>
                <button onClick={() => setEditingUser(null)} className="p-1 hover:bg-gray-100 rounded"><X className="w-5 h-5" /></button>
              </div>
              <div className="space-y-3">
                <div><label className="block text-sm font-medium text-gray-700 mb-1">Full Name</label><input value={editingUser.full_name} onChange={e => setEditingUser({ ...editingUser, full_name: e.target.value })} className="input-field" /></div>
                <div><label className="block text-sm font-medium text-gray-700 mb-1">Email</label><input type="email" value={editingUser.email} onChange={e => setEditingUser({ ...editingUser, email: e.target.value })} className="input-field" /></div>
                <div><label className="block text-sm font-medium text-gray-700 mb-1">Role</label>
                  <select value={editingUser.role} onChange={e => setEditingUser({ ...editingUser, role: e.target.value })} className="input-field">
                    {Object.entries(roleLabels).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                  </select>
                </div>
                <div><label className="block text-sm font-medium text-gray-700 mb-1">Institution</label><input value={editingUser.institution || ''} onChange={e => setEditingUser({ ...editingUser, institution: e.target.value || null })} className="input-field" /></div>
                <div className="flex items-center gap-2">
                  <input type="checkbox" checked={editingUser.is_active} onChange={e => setEditingUser({ ...editingUser, is_active: e.target.checked })} className="rounded" id="edit-active" />
                  <label htmlFor="edit-active" className="text-sm text-gray-700">Active</label>
                </div>
              </div>
              <div className="flex gap-3 mt-6">
                <button onClick={handleSaveEdit} className="btn-primary flex-1 flex items-center justify-center gap-2"><Save className="w-4 h-4" /> Save Changes</button>
                <button onClick={() => setEditingUser(null)} className="btn-outline flex-1">Cancel</button>
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
              <h3 className="text-lg font-bold text-gray-900 mb-2">Delete User?</h3>
              <p className="text-gray-500 text-sm mb-6">This will permanently remove <strong>{users.find(u => u.id === deleteConfirm)?.full_name}</strong> from the system.</p>
              <div className="flex gap-3">
                <button onClick={() => handleDelete(deleteConfirm)} className="bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded-lg flex-1">Delete</button>
                <button onClick={() => setDeleteConfirm(null)} className="btn-outline flex-1">Cancel</button>
              </div>
            </div>
          </div>
        )}

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
                        <button onClick={() => handleEdit(user)} className="p-1.5 rounded hover:bg-blue-50" title="Edit"><Edit className="w-4 h-4 text-blue-500" /></button>
                        <button onClick={() => handleToggleActive(user.id)} className="p-1.5 rounded hover:bg-gray-100" title={user.is_active ? 'Deactivate' : 'Activate'}>
                          {user.is_active ? <UserX className="w-4 h-4 text-orange-500" /> : <UserCheck className="w-4 h-4 text-green-500" />}
                        </button>
                        <button onClick={() => setDeleteConfirm(user.id)} className="p-1.5 rounded hover:bg-red-50" title="Delete"><Trash2 className="w-4 h-4 text-red-400" /></button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="p-3 border-t text-sm text-gray-500">Showing {filtered.length} of {users.length} users</div>
        </div>
      </div>
      </RoleGuard>
    </DashboardLayout>
  );
}
