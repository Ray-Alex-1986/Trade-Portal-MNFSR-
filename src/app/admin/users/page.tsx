'use client';

import { useMemo, useState } from 'react';
import DashboardLayout from '@/components/layout/DashboardLayout';
import RoleGuard from '@/components/auth/RoleGuard';
import { useToast } from '@/components/ui/Toast';
import { useDataStore } from '@/lib/data-store';
import { useAuth } from '@/lib/auth';
import { ROLE_LABELS, ROUTE_ROLES } from '@/lib/permissions';
import { usePortalBackend } from '@/lib/portal-backend';
import { User, UserRole } from '@/lib/types';
import { formatDateTime } from '@/lib/utils';
import { Search, Plus, Edit, Trash2, UserCheck, UserX, X, Save, Users as UsersIcon } from 'lucide-react';

interface EditableUser {
  id: string;
  full_name: string;
  email: string;
  role: string;
  institution?: string | null;
  is_active: boolean;
}

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const ROLE_ENTRIES = Object.entries(ROLE_LABELS) as [UserRole, string][];

export default function UserManagementPage() {
  const { users, addUser, updateUser, deleteUser, masterItems, isLoaded } = useDataStore();
  const { user: currentUser } = useAuth();
  const backend = usePortalBackend();
  const { showToast, ToastView } = useToast();

  const [search, setSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [editingUser, setEditingUser] = useState<EditableUser | null>(null);
  const [showAdd, setShowAdd] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const [newUser, setNewUser] = useState({ full_name: '', email: '', role: 'exporter', institution: '', password: '' });

  // The demo backend keeps a local password; MySQL requires an administrator to
  // MySQL always requires an initial password for newly created accounts.
  const passwordRequired = backend === 'mysql';
  const minPasswordLength = backend === 'mock' ? 8 : 12;
  const institutions = masterItems.institutions ?? [];

  const filtered = useMemo(() => users.filter(item => {
    const term = search.trim().toLowerCase();
    const matchSearch = !term
      || item.full_name.toLowerCase().includes(term)
      || item.email.toLowerCase().includes(term)
      || (item.institution ?? '').toLowerCase().includes(term);
    const matchRole = !roleFilter || item.role === roleFilter;
    const matchStatus = !statusFilter || (statusFilter === 'active' ? item.is_active : !item.is_active);
    return matchSearch && matchRole && matchStatus;
  }), [users, search, roleFilter, statusFilter]);

  const resetAddForm = () => setNewUser({ full_name: '', email: '', role: 'exporter', institution: '', password: '' });

  const handleAddUser = async () => {
    const fullName = newUser.full_name.trim();
    const email = newUser.email.trim().toLowerCase();
    if (!fullName || !email) {
      showToast('Full name and email are required.', 'error');
      return;
    }
    if (!EMAIL_PATTERN.test(email)) {
      showToast('Please enter a valid email address.', 'error');
      return;
    }
    if (users.some(item => item.email.toLowerCase() === email)) {
      showToast('A user with this email already exists.', 'error');
      return;
    }
    const password = newUser.password.trim();
    if (passwordRequired && password.length < minPasswordLength) {
      showToast(`Set a temporary password with at least ${minPasswordLength} characters.`, 'error');
      return;
    }
    if (!passwordRequired && password && password.length < minPasswordLength) {
      showToast(`Passwords must contain at least ${minPasswordLength} characters.`, 'error');
      return;
    }

    setBusy(true);
    try {
      const result = await addUser({
        full_name: fullName,
        email,
        role: newUser.role,
        institution: newUser.institution.trim() || undefined,
        password: password || undefined,
      });
      if (result.error) {
        showToast(result.error, 'error');
        return;
      }
      showToast(password
        ? `User "${fullName}" added. Share the temporary password securely.`
        : `User "${fullName}" invited by email.`);
      resetAddForm();
      setShowAdd(false);
    } finally {
      setBusy(false);
    }
  };

  const handleSaveEdit = async () => {
    if (!editingUser) return;
    const fullName = editingUser.full_name.trim();
    const email = editingUser.email.trim().toLowerCase();
    if (!fullName || !email) {
      showToast('Full name and email are required.', 'error');
      return;
    }
    if (!EMAIL_PATTERN.test(email)) {
      showToast('Please enter a valid email address.', 'error');
      return;
    }
    if (users.some(item => item.id !== editingUser.id && item.email.toLowerCase() === email)) {
      showToast('Another user with this email already exists.', 'error');
      return;
    }

    setBusy(true);
    try {
      const result = await updateUser(editingUser.id, {
        full_name: fullName,
        email,
        role: editingUser.role as UserRole,
        institution: editingUser.institution?.trim() || undefined,
        is_active: editingUser.is_active,
      });
      if (result.error) {
        showToast(result.error, 'error');
        return;
      }
      showToast(`User "${fullName}" updated successfully.`);
      setEditingUser(null);
    } finally {
      setBusy(false);
    }
  };

  const handleToggleActive = async (target: User) => {
    if (target.id === currentUser?.id && target.is_active) {
      showToast('You cannot deactivate your own account.', 'error');
      return;
    }
    setBusy(true);
    try {
      const result = await updateUser(target.id, { is_active: !target.is_active });
      if (result.error) {
        showToast(result.error, 'error');
        return;
      }
      showToast(`User "${target.full_name}" ${target.is_active ? 'deactivated' : 'activated'}.`);
    } finally {
      setBusy(false);
    }
  };

  const handleDelete = async (userId: string) => {
    const target = users.find(item => item.id === userId);
    setBusy(true);
    try {
      const result = await deleteUser(userId);
      if (result.error) {
        showToast(result.error, 'error');
        return;
      }
      showToast(`User "${target?.full_name ?? 'Account'}" deleted successfully.`);
      setDeleteConfirm(null);
    } finally {
      setBusy(false);
    }
  };

  return (
    <DashboardLayout>
      <RoleGuard allow={ROUTE_ROLES['/admin/users']}>
        <ToastView />

        <div className="space-y-6">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">User Management</h1>
              <p className="text-gray-500">Manage system users, roles, and permissions</p>
            </div>
            <button onClick={() => { resetAddForm(); setShowAdd(true); }} className="btn-primary flex items-center gap-2">
              <Plus className="w-4 h-4" /> Add User
            </button>
          </div>

          {/* Add User Modal */}
          {showAdd && (
            <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
              <div className="bg-white rounded-xl shadow-xl w-full max-w-md p-6 max-h-[90vh] overflow-y-auto">
                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-lg font-bold">Add New User</h2>
                  <button onClick={() => setShowAdd(false)} aria-label="Close" className="p-1 hover:bg-gray-100 rounded"><X className="w-5 h-5" /></button>
                </div>
                <div className="space-y-3">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Full Name *</label>
                    <input value={newUser.full_name} onChange={e => setNewUser({ ...newUser, full_name: e.target.value })} className="input-field" placeholder="Enter full name" />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Email *</label>
                    <input type="email" value={newUser.email} onChange={e => setNewUser({ ...newUser, email: e.target.value })} className="input-field" placeholder="name@institution.gov.pk" />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Temporary Password {passwordRequired ? '*' : '(optional)'}
                    </label>
                    <input
                      type="password"
                      minLength={minPasswordLength}
                      autoComplete="new-password"
                      value={newUser.password}
                      onChange={e => setNewUser({ ...newUser, password: e.target.value })}
                      className="input-field"
                      placeholder={`At least ${minPasswordLength} characters`}
                    />
                    <p className="mt-1 text-xs text-gray-500">
                      {passwordRequired
                        ? 'Share this password securely with the new user.'
                        : 'Leave blank to email a password-setup invitation instead.'}
                    </p>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Role *</label>
                    <select value={newUser.role} onChange={e => setNewUser({ ...newUser, role: e.target.value })} className="input-field">
                      {ROLE_ENTRIES.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Institution</label>
                    <input
                      list="institution-options"
                      value={newUser.institution}
                      onChange={e => setNewUser({ ...newUser, institution: e.target.value })}
                      className="input-field"
                      placeholder="e.g., TDAP, NAFSA"
                    />
                    <datalist id="institution-options">
                      {institutions.map(name => <option key={name} value={name} />)}
                    </datalist>
                  </div>
                </div>
                <div className="flex gap-3 mt-6">
                  <button onClick={handleAddUser} disabled={busy} className="btn-primary flex-1 disabled:opacity-50">
                    {busy ? 'Saving...' : 'Add User'}
                  </button>
                  <button onClick={() => setShowAdd(false)} className="btn-outline flex-1">Cancel</button>
                </div>
              </div>
            </div>
          )}

          {/* Edit User Modal */}
          {editingUser && (
            <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
              <div className="bg-white rounded-xl shadow-xl w-full max-w-md p-6 max-h-[90vh] overflow-y-auto">
                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-lg font-bold">Edit User</h2>
                  <button onClick={() => setEditingUser(null)} aria-label="Close" className="p-1 hover:bg-gray-100 rounded"><X className="w-5 h-5" /></button>
                </div>
                <div className="space-y-3">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Full Name</label>
                    <input value={editingUser.full_name} onChange={e => setEditingUser({ ...editingUser, full_name: e.target.value })} className="input-field" />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
                    <input type="email" value={editingUser.email} onChange={e => setEditingUser({ ...editingUser, email: e.target.value })} className="input-field" />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Role</label>
                    <select value={editingUser.role} onChange={e => setEditingUser({ ...editingUser, role: e.target.value })} className="input-field">
                      {ROLE_ENTRIES.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Institution</label>
                    <input
                      list="institution-options-edit"
                      value={editingUser.institution || ''}
                      onChange={e => setEditingUser({ ...editingUser, institution: e.target.value || null })}
                      className="input-field"
                    />
                    <datalist id="institution-options-edit">
                      {institutions.map(name => <option key={name} value={name} />)}
                    </datalist>
                  </div>
                  <div className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={editingUser.is_active}
                      onChange={e => setEditingUser({ ...editingUser, is_active: e.target.checked })}
                      className="rounded"
                      id="edit-active"
                      disabled={editingUser.id === currentUser?.id}
                    />
                    <label htmlFor="edit-active" className="text-sm text-gray-700">
                      Active {editingUser.id === currentUser?.id && <span className="text-gray-400">(your own account)</span>}
                    </label>
                  </div>
                </div>
                <div className="flex gap-3 mt-6">
                  <button onClick={handleSaveEdit} disabled={busy} className="btn-primary flex-1 flex items-center justify-center gap-2 disabled:opacity-50">
                    <Save className="w-4 h-4" /> {busy ? 'Saving...' : 'Save Changes'}
                  </button>
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
                <p className="text-gray-500 text-sm mb-6">
                  This permanently removes <strong>{users.find(item => item.id === deleteConfirm)?.full_name}</strong> and their sign-in access.
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

          <div className="card">
            <div className="p-4 border-b flex flex-col md:flex-row gap-3">
              <div className="flex items-center gap-2 bg-gray-100 rounded-lg px-3 py-2 flex-1">
                <Search className="w-4 h-4 text-gray-400" />
                <input
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                  placeholder="Search by name, email, or institution..."
                  aria-label="Search users"
                  className="bg-transparent border-none outline-none text-sm flex-1"
                />
              </div>
              <select value={roleFilter} onChange={e => setRoleFilter(e.target.value)} aria-label="Filter by role" className="input-field md:w-48">
                <option value="">All Roles</option>
                {ROLE_ENTRIES.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
              </select>
              <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)} aria-label="Filter by status" className="input-field md:w-36">
                <option value="">All Statuses</option>
                <option value="active">Active</option>
                <option value="inactive">Inactive</option>
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
                  {filtered.map(item => (
                    <tr key={item.id} className="border-t hover:bg-gray-50">
                      <td className="p-3">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 bg-gov-green-100 text-gov-green-700 rounded-full flex items-center justify-center font-bold text-sm">
                            {item.full_name.charAt(0).toUpperCase()}
                          </div>
                          <span className="font-medium">
                            {item.full_name}
                            {item.id === currentUser?.id && <span className="ml-2 text-xs text-gray-400">(you)</span>}
                          </span>
                        </div>
                      </td>
                      <td className="p-3 text-gray-500">{item.email}</td>
                      <td className="p-3"><span className="badge bg-gov-green-50 text-gov-green-700">{ROLE_LABELS[item.role] ?? item.role}</span></td>
                      <td className="p-3 text-gray-500">{item.institution || '—'}</td>
                      <td className="p-3">
                        <span className={`badge ${item.is_active ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>
                          {item.is_active ? 'Active' : 'Inactive'}
                        </span>
                      </td>
                      <td className="p-3 text-gray-500">{item.last_login ? formatDateTime(item.last_login) : '—'}</td>
                      <td className="p-3">
                        <div className="flex gap-2">
                          <button
                            onClick={() => setEditingUser({
                              id: item.id, full_name: item.full_name, email: item.email,
                              role: item.role, institution: item.institution ?? null, is_active: item.is_active,
                            })}
                            className="p-1.5 rounded hover:bg-blue-50"
                            title="Edit"
                            aria-label={`Edit ${item.full_name}`}
                          >
                            <Edit className="w-4 h-4 text-blue-500" />
                          </button>
                          <button
                            onClick={() => handleToggleActive(item)}
                            disabled={busy || item.id === currentUser?.id}
                            className="p-1.5 rounded hover:bg-gray-100 disabled:opacity-30 disabled:cursor-not-allowed"
                            title={item.id === currentUser?.id ? 'You cannot change your own status' : item.is_active ? 'Deactivate' : 'Activate'}
                            aria-label={item.is_active ? `Deactivate ${item.full_name}` : `Activate ${item.full_name}`}
                          >
                            {item.is_active ? <UserX className="w-4 h-4 text-orange-500" /> : <UserCheck className="w-4 h-4 text-green-500" />}
                          </button>
                          <button
                            onClick={() => setDeleteConfirm(item.id)}
                            disabled={item.id === currentUser?.id}
                            className="p-1.5 rounded hover:bg-red-50 disabled:opacity-30 disabled:cursor-not-allowed"
                            title={item.id === currentUser?.id ? 'You cannot delete your own account' : 'Delete'}
                            aria-label={`Delete ${item.full_name}`}
                          >
                            <Trash2 className="w-4 h-4 text-red-400" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                  {filtered.length === 0 && (
                    <tr>
                      <td colSpan={7} className="p-10 text-center text-gray-400">
                        <UsersIcon className="w-10 h-10 mx-auto mb-2 text-gray-300" />
                        {isLoaded ? 'No users match the current filters.' : 'Loading users…'}
                      </td>
                    </tr>
                  )}
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
