'use client';

import { useState } from 'react';
import DashboardLayout from '@/components/layout/DashboardLayout';
import { PRODUCTS, COUNTRIES, PROVINCES, PORTS, HS_CODES } from '@/lib/mock-data';
import { Plus, Edit, Trash2, Database, X, Save, CheckCircle } from 'lucide-react';

type DataCategory = 'products' | 'countries' | 'provinces' | 'ports' | 'complaint_categories' | 'document_types' | 'roles' | 'institutions';

const initialCategoryData: Record<DataCategory, { label: string; items: string[] }> = {
  products: { label: 'Products & Commodities', items: [...PRODUCTS] },
  countries: { label: 'Countries', items: [...COUNTRIES] },
  provinces: { label: 'Provinces', items: [...PROVINCES] },
  ports: { label: 'Ports', items: [...PORTS] },
  complaint_categories: { label: 'Complaint Categories', items: ['Product quality issue', 'SPS compliance issue', 'Quantity discrepancy', 'Packaging issue', 'Documentation issue', 'Shipment delay', 'Payment dispute', 'Misrepresentation', 'Exporter conduct', 'Buyer/importer conduct', 'Inspection issue', 'Regulatory issue', 'Other'] },
  document_types: { label: 'Document Types', items: ["Buyer's Quality Requirement Sheet", "DDP SPS Certificate", "Pre-Shipment Inspection (PSI) Report", "Purchase Order / Export Contract", "Commercial Invoice", "Packing List", "Certificate of Origin", "Phytosanitary Certificate", "Laboratory Test Report", "Bill of Lading / Airway Bill", "Additional Supporting Documents"] },
  roles: { label: 'User Roles', items: ['MNFSR Super Admin', 'MoC Admin', 'TDAP Admin', 'TDAP Officer', 'NAFSA Admin', 'NAFSA Officer', 'Trade & Investment Counsellor', 'Exporter/Trader', 'Buyer/Importer', 'Auditor/Viewer'] },
  institutions: { label: 'Institutions', items: ['MNFSR', 'Ministry of Commerce', 'TDAP', 'NAFSA', 'TIC Beijing', 'TIC Dubai', 'TIC Riyadh', 'TIC London', 'TIC Kuala Lumpur'] },
};

export default function MasterDataPage() {
  const [category, setCategory] = useState<DataCategory>('products');
  const [catData, setCatData] = useState(initialCategoryData);
  const [editingIndex, setEditingIndex] = useState<number | null>(null);
  const [editValue, setEditValue] = useState('');
  const [showAdd, setShowAdd] = useState(false);
  const [newItem, setNewItem] = useState('');
  const [deleteConfirm, setDeleteConfirm] = useState<number | null>(null);
  const [toast, setToast] = useState('');

  const showToast = (msg: string) => { setToast(msg); setTimeout(() => setToast(''), 3000); };

  const handleAdd = () => {
    if (!newItem.trim()) return;
    setCatData(prev => ({
      ...prev,
      [category]: { ...prev[category], items: [...prev[category].items, newItem.trim()] }
    }));
    showToast(`"${newItem.trim()}" added to ${catData[category].label}`);
    setNewItem('');
    setShowAdd(false);
  };

  const handleEditStart = (index: number) => {
    setEditingIndex(index);
    setEditValue(catData[category].items[index]);
  };

  const handleEditSave = () => {
    if (editingIndex === null || !editValue.trim()) return;
    setCatData(prev => ({
      ...prev,
      [category]: {
        ...prev[category],
        items: prev[category].items.map((item, i) => i === editingIndex ? editValue.trim() : item)
      }
    }));
    showToast(`Item updated to "${editValue.trim()}"`);
    setEditingIndex(null);
    setEditValue('');
  };

  const handleDelete = (index: number) => {
    const item = catData[category].items[index];
    setCatData(prev => ({
      ...prev,
      [category]: {
        ...prev[category],
        items: prev[category].items.filter((_, i) => i !== index)
      }
    }));
    showToast(`"${item}" deleted from ${catData[category].label}`);
    setDeleteConfirm(null);
  };

  return (
    <DashboardLayout>
      {toast && (
        <div className="fixed top-4 right-4 z-50 flex items-center gap-2 px-4 py-3 bg-green-600 text-white rounded-lg shadow-lg animate-pulse">
          <CheckCircle className="w-4 h-4" /> {toast}
        </div>
      )}

      {/* Delete Confirm Modal */}
      {deleteConfirm !== null && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-sm p-6 text-center">
            <div className="w-12 h-12 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <Trash2 className="w-6 h-6 text-red-600" />
            </div>
            <h3 className="text-lg font-bold text-gray-900 mb-2">Delete Item?</h3>
            <p className="text-gray-500 text-sm mb-6">Remove <strong>&quot;{catData[category].items[deleteConfirm]}&quot;</strong> from {catData[category].label}?</p>
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
            <h1 className="text-2xl font-bold text-gray-900">Master Data Management</h1>
            <p className="text-gray-500">Manage system reference data and configurations</p>
          </div>
          <button onClick={() => setShowAdd(true)} className="btn-primary flex items-center gap-2">
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
                {(Object.entries(catData) as [DataCategory, { label: string; items: string[] }][]).map(([key, val]) => (
                  <button
                    key={key}
                    onClick={() => { setCategory(key); setEditingIndex(null); setShowAdd(false); }}
                    className={`w-full text-left p-3 text-sm hover:bg-gray-50 transition-colors ${category === key ? 'bg-gov-green-50 text-gov-green-700 font-medium border-l-4 border-gov-green-500' : 'text-gray-700'}`}
                  >
                    <p>{val.label}</p>
                    <p className="text-xs text-gray-400">{val.items.length} items</p>
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Items */}
          <div className="lg:col-span-3">
            <div className="card">
              <div className="p-4 border-b flex items-center justify-between">
                <h3 className="font-semibold text-gray-900">{catData[category].label}</h3>
                <span className="badge bg-gray-100 text-gray-700">{catData[category].items.length} items</span>
              </div>

              {showAdd && (
                <div className="p-4 border-b bg-yellow-50 flex gap-3">
                  <input value={newItem} onChange={e => setNewItem(e.target.value)} onKeyDown={e => e.key === 'Enter' && handleAdd()} placeholder={`Add new ${category.replace(/_/g, ' ')}...`} className="input-field flex-1" autoFocus />
                  <button onClick={handleAdd} disabled={!newItem.trim()} className="btn-primary disabled:opacity-50">Add</button>
                  <button onClick={() => { setShowAdd(false); setNewItem(''); }} className="btn-outline">Cancel</button>
                </div>
              )}

              <div className="divide-y">
                {catData[category].items.map((item, i) => (
                  <div key={i} className="p-3 flex items-center justify-between hover:bg-gray-50">
                    {editingIndex === i ? (
                      <div className="flex items-center gap-2 flex-1">
                        <input value={editValue} onChange={e => setEditValue(e.target.value)} onKeyDown={e => { if (e.key === 'Enter') handleEditSave(); if (e.key === 'Escape') setEditingIndex(null); }} className="input-field flex-1 text-sm" autoFocus />
                        <button onClick={handleEditSave} className="p-1.5 rounded hover:bg-green-50" title="Save"><Save className="w-4 h-4 text-green-600" /></button>
                        <button onClick={() => setEditingIndex(null)} className="p-1.5 rounded hover:bg-gray-100" title="Cancel"><X className="w-4 h-4 text-gray-400" /></button>
                      </div>
                    ) : (
                      <>
                        <span className="text-sm text-gray-700">{item}</span>
                        <div className="flex gap-2">
                          <button onClick={() => handleEditStart(i)} className="p-1.5 rounded hover:bg-blue-50" title="Edit"><Edit className="w-4 h-4 text-blue-500" /></button>
                          <button onClick={() => setDeleteConfirm(i)} className="p-1.5 rounded hover:bg-red-50" title="Delete"><Trash2 className="w-4 h-4 text-red-400" /></button>
                        </div>
                      </>
                    )}
                  </div>
                ))}
              </div>
              {catData[category].items.length === 0 && (
                <div className="p-8 text-center text-gray-400">No items in this category. Click &quot;Add Item&quot; to add one.</div>
              )}
            </div>

            {/* HS Codes Reference */}
            {category === 'products' && (
              <div className="card mt-6">
                <div className="p-4 border-b">
                  <h3 className="font-semibold text-gray-900">HS Code Reference</h3>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="text-left p-3 font-medium text-gray-500">Product</th>
                        <th className="text-left p-3 font-medium text-gray-500">HS Code</th>
                      </tr>
                    </thead>
                    <tbody>
                      {Object.entries(HS_CODES).map(([product, code]) => (
                        <tr key={product} className="border-t">
                          <td className="p-3">{product}</td>
                          <td className="p-3 font-mono">{code}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
}
