'use client';

import { useState } from 'react';
import DashboardLayout from '@/components/layout/DashboardLayout';
import { PRODUCTS, COUNTRIES, PROVINCES, PORTS, HS_CODES } from '@/lib/mock-data';
import { Plus, Edit, Trash2, Database } from 'lucide-react';

type DataCategory = 'products' | 'countries' | 'provinces' | 'ports' | 'complaint_categories' | 'document_types' | 'roles' | 'institutions';

const categoryData: Record<DataCategory, { label: string; items: string[] }> = {
  products: { label: 'Products & Commodities', items: PRODUCTS },
  countries: { label: 'Countries', items: COUNTRIES },
  provinces: { label: 'Provinces', items: PROVINCES },
  ports: { label: 'Ports', items: PORTS },
  complaint_categories: { label: 'Complaint Categories', items: ['Product quality issue', 'SPS compliance issue', 'Quantity discrepancy', 'Packaging issue', 'Documentation issue', 'Shipment delay', 'Payment dispute', 'Misrepresentation', 'Exporter conduct', 'Buyer/importer conduct', 'Inspection issue', 'Regulatory issue', 'Other'] },
  document_types: { label: 'Document Types', items: ["Buyer's Quality Requirement Sheet", "SPS Certificate", "PSI Report", "Purchase Order / Contract", "Commercial Invoice", "Packing List", "Certificate of Origin", "Phytosanitary Certificate", "Laboratory Test Report", "Bill of Lading / Airway Bill"] },
  roles: { label: 'User Roles', items: ['MNFSR Super Admin', 'MoC Admin', 'TDAP Admin', 'TDAP Officer', 'NAFSA Admin', 'NAFSA Officer', 'Trade & Investment Counsellor', 'Exporter/Trader', 'Buyer/Importer', 'Auditor/Viewer'] },
  institutions: { label: 'Institutions', items: ['MNFSR', 'Ministry of Commerce', 'TDAP', 'NAFSA', 'TIC Beijing', 'TIC Dubai', 'TIC Riyadh', 'TIC London', 'TIC Kuala Lumpur'] },
};

export default function MasterDataPage() {
  const [category, setCategory] = useState<DataCategory>('products');
  const [showAdd, setShowAdd] = useState(false);
  const [newItem, setNewItem] = useState('');

  return (
    <DashboardLayout>
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
                {(Object.entries(categoryData) as [DataCategory, { label: string; items: string[] }][]).map(([key, val]) => (
                  <button
                    key={key}
                    onClick={() => setCategory(key)}
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
                <h3 className="font-semibold text-gray-900">{categoryData[category].label}</h3>
                <span className="badge bg-gray-100 text-gray-700">{categoryData[category].items.length} items</span>
              </div>

              {showAdd && (
                <div className="p-4 border-b bg-yellow-50 flex gap-3">
                  <input value={newItem} onChange={e => setNewItem(e.target.value)} placeholder={`Add new ${category.replace(/_/g, ' ')}...`} className="input-field flex-1" />
                  <button onClick={() => { setShowAdd(false); setNewItem(''); }} className="btn-primary">Add</button>
                  <button onClick={() => { setShowAdd(false); setNewItem(''); }} className="btn-outline">Cancel</button>
                </div>
              )}

              <div className="divide-y">
                {categoryData[category].items.map((item, i) => (
                  <div key={i} className="p-3 flex items-center justify-between hover:bg-gray-50">
                    <span className="text-sm text-gray-700">{item}</span>
                    <div className="flex gap-2">
                      <button className="p-1.5 rounded hover:bg-gray-100"><Edit className="w-4 h-4 text-gray-400" /></button>
                      <button className="p-1.5 rounded hover:bg-red-50"><Trash2 className="w-4 h-4 text-red-400" /></button>
                    </div>
                  </div>
                ))}
              </div>
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
