'use client';

import { useState } from 'react';
import DashboardLayout from '@/components/layout/DashboardLayout';
import RoleGuard from '@/components/auth/RoleGuard';
import { useToast } from '@/components/ui/Toast';
import { ROUTE_ROLES } from '@/lib/permissions';
import { useDataStore, MasterCategory } from '@/lib/data-store';
import { usePortalBackend } from '@/lib/supabase/use-mock';
import { Plus, Edit, Trash2, Database, X, Save, Lock } from 'lucide-react';

const categoryLabels: Record<MasterCategory, string> = {
  products: 'Products & Commodities',
  countries: 'Countries',
  provinces: 'Provinces',
  ports: 'Ports',
  complaint_categories: 'Complaint Categories',
  document_types: 'Document Types',
  roles: 'User Roles',
  institutions: 'Institutions',
};

/** Roles and institutions are lookup tables owned by the database schema. */
const READ_ONLY_CATEGORIES: MasterCategory[] = ['roles', 'institutions'];

export default function MasterDataPage() {
  const { masterItems, addMasterItem, updateMasterItem, deleteMasterItem } = useDataStore();
  const backend = usePortalBackend();
  const { showToast, ToastView } = useToast();

  const [category, setCategory] = useState<MasterCategory>('products');
  const [editingIndex, setEditingIndex] = useState<number | null>(null);
  const [editValue, setEditValue] = useState('');
  const [showAdd, setShowAdd] = useState(false);
  const [newItem, setNewItem] = useState('');
  const [deleteConfirm, setDeleteConfirm] = useState<number | null>(null);
  const [busy, setBusy] = useState(false);

  const items = masterItems[category] || [];
  // The demo backend keeps roles and institutions editable; real backends do not.
  const isReadOnly = backend !== 'mock' && READ_ONLY_CATEGORIES.includes(category);

  const handleAdd = async () => {
    const value = newItem.trim();
    if (!value) return;
    if (items.some(item => item.toLowerCase() === value.toLowerCase())) {
      showToast('This item already exists in the category.', 'error');
      return;
    }
    setBusy(true);
    try {
      const result = await addMasterItem(category, value);
      if (result.error) {
        showToast(result.error, 'error');
        return;
      }
      showToast(`"${value}" added to ${categoryLabels[category]}.`);
      setNewItem('');
      setShowAdd(false);
    } finally {
      setBusy(false);
    }
  };

  const handleEditStart = (index: number) => {
    setEditingIndex(index);
    setEditValue(items[index]);
  };

  const handleEditSave = async () => {
    if (editingIndex === null) return;
    const value = editValue.trim();
    if (!value) return;
    if (items.some((item, idx) => idx !== editingIndex && item.toLowerCase() === value.toLowerCase())) {
      showToast('Another item in this category already has this name.', 'error');
      return;
    }
    setBusy(true);
    try {
      const result = await updateMasterItem(category, editingIndex, value);
      if (result.error) {
        showToast(result.error, 'error');
        return;
      }
      showToast(`Item updated to "${value}".`);
      setEditingIndex(null);
      setEditValue('');
    } finally {
      setBusy(false);
    }
  };

  const handleDelete = async (index: number) => {
    const item = items[index];
    setBusy(true);
    try {
      const result = await deleteMasterItem(category, index);
      if (result.error) {
        showToast(result.error, 'error');
        return;
      }
      showToast(`"${item}" deleted from ${categoryLabels[category]}.`);
      setDeleteConfirm(null);
    } finally {
      setBusy(false);
    }
  };

  return (
    <DashboardLayout>
      <RoleGuard allow={ROUTE_ROLES['/admin/master-data']}>
        <ToastView />

        {/* Delete Confirm Modal */}
        {deleteConfirm !== null && (
          <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
            <div className="bg-white rounded-xl shadow-xl w-full max-w-sm p-6 text-center">
              <div className="w-12 h-12 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <Trash2 className="w-6 h-6 text-red-600" />
              </div>
              <h3 className="text-lg font-bold text-gray-900 mb-2">Delete Item?</h3>
              <p className="text-gray-500 text-sm mb-6">Remove <strong>&quot;{items[deleteConfirm]}&quot;</strong> from {categoryLabels[category]}?</p>
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
              <h1 className="text-2xl font-bold text-gray-900">Master Data Management</h1>
              <p className="text-gray-500">Manage the reference lists used by every portal form</p>
            </div>
            <button
              onClick={() => setShowAdd(true)}
              disabled={isReadOnly}
              className="btn-primary flex items-center gap-2 disabled:opacity-50"
              title={isReadOnly ? 'This list is managed by the database schema' : undefined}
            >
              <Plus className="w-4 h-4" /> Add Item
            </button>
          </div>

          <div className="grid lg:grid-cols-4 gap-6">
            {/* Categories */}
            <div className="lg:col-span-1">
              <div className="card">
                <div className="p-3 border-b">
                  <h3 className="font-medium text-sm text-gray-700 flex items-center gap-2">
                    <Database className="w-4 h-4" /> Data Categories
                  </h3>
                </div>
                <div className="divide-y">
                  {(Object.entries(categoryLabels) as [MasterCategory, string][]).map(([key, label]) => (
                    <button
                      key={key}
                      onClick={() => { setCategory(key); setEditingIndex(null); setShowAdd(false); setDeleteConfirm(null); }}
                      className={`w-full text-left p-3 text-sm hover:bg-gray-50 transition-colors ${category === key ? 'bg-gov-green-50 text-gov-green-700 font-medium border-l-4 border-gov-green-500' : 'text-gray-700'}`}
                    >
                      <p>{label}</p>
                      <p className="text-xs text-gray-400">{(masterItems[key] || []).length} items</p>
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* Items */}
            <div className="lg:col-span-3">
              <div className="card">
                <div className="p-4 border-b flex items-center justify-between">
                  <h3 className="font-semibold text-gray-900">{categoryLabels[category]}</h3>
                  <span className="badge bg-gray-100 text-gray-700">{items.length} items</span>
                </div>

                {isReadOnly && (
                  <div className="p-3 border-b bg-gray-50 flex items-center gap-2 text-sm text-gray-600">
                    <Lock className="w-4 h-4" />
                    This list mirrors database lookup tables and is read-only in the connected backend.
                  </div>
                )}

                {showAdd && !isReadOnly && (
                  <div className="p-4 border-b bg-yellow-50 flex flex-col sm:flex-row gap-3">
                    <input
                      value={newItem}
                      onChange={e => setNewItem(e.target.value)}
                      onKeyDown={e => { if (e.key === 'Enter') void handleAdd(); if (e.key === 'Escape') { setShowAdd(false); setNewItem(''); } }}
                      placeholder={`Add new ${category.replace(/_/g, ' ')}...`}
                      aria-label={`New ${categoryLabels[category]} item`}
                      className="input-field flex-1"
                      autoFocus
                    />
                    <div className="flex gap-2">
                      <button onClick={handleAdd} disabled={!newItem.trim() || busy} className="btn-primary disabled:opacity-50">Add</button>
                      <button onClick={() => { setShowAdd(false); setNewItem(''); }} className="btn-outline">Cancel</button>
                    </div>
                  </div>
                )}

                <div className="divide-y">
                  {items.map((item, i) => (
                    <div key={`${item}-${i}`} className="p-3 flex items-center justify-between hover:bg-gray-50">
                      {editingIndex === i ? (
                        <div className="flex items-center gap-2 flex-1">
                          <input
                            value={editValue}
                            onChange={e => setEditValue(e.target.value)}
                            onKeyDown={e => { if (e.key === 'Enter') void handleEditSave(); if (e.key === 'Escape') setEditingIndex(null); }}
                            className="input-field flex-1 text-sm"
                            aria-label={`Edit ${item}`}
                            autoFocus
                          />
                          <button onClick={handleEditSave} disabled={busy} className="p-1.5 rounded hover:bg-green-50 disabled:opacity-50" title="Save" aria-label="Save">
                            <Save className="w-4 h-4 text-green-600" />
                          </button>
                          <button onClick={() => setEditingIndex(null)} className="p-1.5 rounded hover:bg-gray-100" title="Cancel" aria-label="Cancel">
                            <X className="w-4 h-4 text-gray-400" />
                          </button>
                        </div>
                      ) : (
                        <>
                          <span className="text-sm text-gray-700">{item}</span>
                          {!isReadOnly && (
                            <div className="flex gap-2">
                              <button onClick={() => handleEditStart(i)} className="p-1.5 rounded hover:bg-blue-50" title="Edit" aria-label={`Edit ${item}`}>
                                <Edit className="w-4 h-4 text-blue-500" />
                              </button>
                              <button onClick={() => setDeleteConfirm(i)} className="p-1.5 rounded hover:bg-red-50" title="Delete" aria-label={`Delete ${item}`}>
                                <Trash2 className="w-4 h-4 text-red-400" />
                              </button>
                            </div>
                          )}
                        </>
                      )}
                    </div>
                  ))}
                </div>
                {items.length === 0 && (
                  <div className="p-8 text-center text-gray-400">
                    No items in this category.{!isReadOnly && ' Click "Add Item" to add one.'}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </RoleGuard>
    </DashboardLayout>
  );
}
