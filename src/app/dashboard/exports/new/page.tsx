'use client';

import { useState } from 'react';
import DashboardLayout from '@/components/layout/DashboardLayout';
import { useRouter } from 'next/navigation';
import { PRODUCTS, COUNTRIES, PROVINCES, DISTRICTS, PORTS, HS_CODES } from '@/lib/mock-data';
import { ChevronRight, ChevronLeft, CheckCircle, Upload } from 'lucide-react';
import { useAuth } from '@/lib/auth';

const steps = ['Exporter Info', 'Export Item', 'Buyer Info', 'Shipment', 'Documents'];

const DOC_TYPES = [
  "Buyer's Quality Requirement Sheet", "SPS Certificate", "Pre-Shipment Inspection (PSI) Report",
  "Purchase Order / Export Contract", "Commercial Invoice", "Packing List",
  "Certificate of Origin", "Phytosanitary Certificate", "Laboratory Test Report",
  "Bill of Lading / Airway Bill", "Additional Supporting Documents"
];

export default function NewExportRecordPage() {
  const router = useRouter();
  const { user } = useAuth();
  const [step, setStep] = useState(0);
  const [submitted, setSubmitted] = useState(false);

  const [item, setItem] = useState({
    product: '', category: '', hs_code: '', description: '', quantity: 0, unit: 'Metric Tons',
    value: 0, currency: 'USD', origin: 'Pakistan', province: 'Punjab', district: '',
    crop_year: 2026, batch: '', packaging: 'Carton Boxes', packages: 0, shipment_date: '',
  });

  const [buyer, setBuyer] = useState({
    name: '', company: '', country: '', address: '', contact: '', email: '', phone: '', po_number: '',
  });

  const [shipment, setShipment] = useState({
    dest_country: '', dest_port: '', departure_port: 'Karachi Port', transport_mode: 'Sea',
    shipping_company: '', container: '', bol_number: '', departure_date: '', arrival_date: '',
  });

  if (submitted) {
    return (
      <DashboardLayout>
        <div className="max-w-lg mx-auto text-center py-12">
          <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-6">
            <CheckCircle className="w-10 h-10 text-green-600" />
          </div>
          <h2 className="text-2xl font-bold text-gray-900 mb-2">Export Record Submitted!</h2>
          <p className="text-gray-500 mb-4">Consignment #EXP-2025061 has been submitted for review.</p>
          <div className="flex gap-3 justify-center">
            <button className="btn-outline" onClick={() => router.push('/dashboard/exports')}>View Records</button>
            <button className="btn-primary" onClick={() => { setSubmitted(false); setStep(0); }}>Create Another</button>
          </div>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="max-w-4xl mx-auto space-y-6">
        <h1 className="text-2xl font-bold text-gray-900">New Export Record</h1>

        {/* Step Indicator */}
        <div className="flex items-center justify-between">
          {steps.map((s, i) => (
            <div key={s} className="flex items-center flex-1">
              <div className={`flex items-center gap-2 ${i <= step ? 'text-gov-green-500' : 'text-gray-400'}`}>
                <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold ${i < step ? 'bg-gov-green-500 text-white' : i === step ? 'border-2 border-gov-green-500' : 'border-2 border-gray-300'}`}>
                  {i < step ? <CheckCircle className="w-4 h-4" /> : i + 1}
                </div>
                <span className="text-xs font-medium hidden md:block">{s}</span>
              </div>
              {i < steps.length - 1 && <div className={`flex-1 h-0.5 mx-2 ${i < step ? 'bg-gov-green-500' : 'bg-gray-300'}`} />}
            </div>
          ))}
        </div>

        <div className="card p-6">
          {step === 0 && (
            <div className="space-y-4">
              <h2 className="text-lg font-bold text-gray-900">Exporter Information (Auto-populated)</h2>
              <div className="grid md:grid-cols-2 gap-4">
                <div><label className="block text-sm font-medium text-gray-500 mb-1">Registration Number</label><p className="input-field bg-gray-50">REG-2024008</p></div>
                <div><label className="block text-sm font-medium text-gray-500 mb-1">Company Name</label><p className="input-field bg-gray-50">Pak Rice Exports (Pvt) Ltd</p></div>
                <div><label className="block text-sm font-medium text-gray-500 mb-1">NTN</label><p className="input-field bg-gray-50">1234567-1</p></div>
                <div><label className="block text-sm font-medium text-gray-500 mb-1">Authorized Representative</label><p className="input-field bg-gray-50">{user?.full_name || 'Hassan Ali Shah'}</p></div>
              </div>
            </div>
          )}

          {step === 1 && (
            <div className="space-y-4">
              <h2 className="text-lg font-bold text-gray-900">Export Item Information</h2>
              <div className="grid md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Product *</label>
                  <select value={item.product} onChange={e => setItem({ ...item, product: e.target.value, hs_code: HS_CODES[e.target.value] || '' })} className="input-field">
                    <option value="">Select Product</option>
                    {PRODUCTS.map(p => <option key={p}>{p}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">HS Code</label>
                  <input value={item.hs_code} onChange={e => setItem({ ...item, hs_code: e.target.value })} className="input-field" />
                </div>
                <div className="md:col-span-2">
                  <label className="block text-sm font-medium text-gray-700 mb-1">Description *</label>
                  <textarea value={item.description} onChange={e => setItem({ ...item, description: e.target.value })} className="input-field" rows={2} />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Quantity *</label>
                  <input type="number" value={item.quantity || ''} onChange={e => setItem({ ...item, quantity: Number(e.target.value) })} className="input-field" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Unit</label>
                  <select value={item.unit} onChange={e => setItem({ ...item, unit: e.target.value })} className="input-field">
                    <option>Metric Tons</option><option>Kilograms</option><option>Containers</option><option>Pieces</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Estimated Value *</label>
                  <input type="number" value={item.value || ''} onChange={e => setItem({ ...item, value: Number(e.target.value) })} className="input-field" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Currency</label>
                  <select value={item.currency} onChange={e => setItem({ ...item, currency: e.target.value })} className="input-field">
                    <option>USD</option><option>PKR</option><option>EUR</option><option>GBP</option><option>AED</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Province of Production</label>
                  <select value={item.province} onChange={e => setItem({ ...item, province: e.target.value })} className="input-field">
                    {PROVINCES.map(p => <option key={p}>{p}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Batch/Lot Number</label>
                  <input value={item.batch} onChange={e => setItem({ ...item, batch: e.target.value })} className="input-field" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Packaging Type</label>
                  <select value={item.packaging} onChange={e => setItem({ ...item, packaging: e.target.value })} className="input-field">
                    <option>Jute Bags</option><option>Carton Boxes</option><option>Plastic Crates</option><option>Vacuum Packed</option><option>Bulk Container</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Number of Packages</label>
                  <input type="number" value={item.packages || ''} onChange={e => setItem({ ...item, packages: Number(e.target.value) })} className="input-field" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Intended Shipment Date</label>
                  <input type="date" value={item.shipment_date} onChange={e => setItem({ ...item, shipment_date: e.target.value })} className="input-field" />
                </div>
              </div>
            </div>
          )}

          {step === 2 && (
            <div className="space-y-4">
              <h2 className="text-lg font-bold text-gray-900">Buyer/Importer Information</h2>
              <div className="grid md:grid-cols-2 gap-4">
                <div><label className="block text-sm font-medium text-gray-700 mb-1">Buyer Name *</label><input value={buyer.name} onChange={e => setBuyer({ ...buyer, name: e.target.value })} className="input-field" /></div>
                <div><label className="block text-sm font-medium text-gray-700 mb-1">Company Name *</label><input value={buyer.company} onChange={e => setBuyer({ ...buyer, company: e.target.value })} className="input-field" /></div>
                <div><label className="block text-sm font-medium text-gray-700 mb-1">Country *</label><select value={buyer.country} onChange={e => setBuyer({ ...buyer, country: e.target.value })} className="input-field"><option value="">Select</option>{COUNTRIES.map(c => <option key={c}>{c}</option>)}</select></div>
                <div><label className="block text-sm font-medium text-gray-700 mb-1">Contact Person *</label><input value={buyer.contact} onChange={e => setBuyer({ ...buyer, contact: e.target.value })} className="input-field" /></div>
                <div className="md:col-span-2"><label className="block text-sm font-medium text-gray-700 mb-1">Address *</label><input value={buyer.address} onChange={e => setBuyer({ ...buyer, address: e.target.value })} className="input-field" /></div>
                <div><label className="block text-sm font-medium text-gray-700 mb-1">Email *</label><input type="email" value={buyer.email} onChange={e => setBuyer({ ...buyer, email: e.target.value })} className="input-field" /></div>
                <div><label className="block text-sm font-medium text-gray-700 mb-1">Phone *</label><input value={buyer.phone} onChange={e => setBuyer({ ...buyer, phone: e.target.value })} className="input-field" /></div>
                <div><label className="block text-sm font-medium text-gray-700 mb-1">Purchase Order #</label><input value={buyer.po_number} onChange={e => setBuyer({ ...buyer, po_number: e.target.value })} className="input-field" /></div>
              </div>
            </div>
          )}

          {step === 3 && (
            <div className="space-y-4">
              <h2 className="text-lg font-bold text-gray-900">Shipment Information</h2>
              <div className="grid md:grid-cols-2 gap-4">
                <div><label className="block text-sm font-medium text-gray-700 mb-1">Destination Country *</label><select value={shipment.dest_country} onChange={e => setShipment({ ...shipment, dest_country: e.target.value })} className="input-field"><option value="">Select</option>{COUNTRIES.map(c => <option key={c}>{c}</option>)}</select></div>
                <div><label className="block text-sm font-medium text-gray-700 mb-1">Destination Port *</label><input value={shipment.dest_port} onChange={e => setShipment({ ...shipment, dest_port: e.target.value })} className="input-field" /></div>
                <div><label className="block text-sm font-medium text-gray-700 mb-1">Port of Departure</label><select value={shipment.departure_port} onChange={e => setShipment({ ...shipment, departure_port: e.target.value })} className="input-field">{PORTS.map(p => <option key={p}>{p}</option>)}</select></div>
                <div><label className="block text-sm font-medium text-gray-700 mb-1">Mode of Transport</label><select value={shipment.transport_mode} onChange={e => setShipment({ ...shipment, transport_mode: e.target.value })} className="input-field"><option>Sea</option><option>Air</option><option>Road</option><option>Rail</option></select></div>
                <div><label className="block text-sm font-medium text-gray-700 mb-1">Shipping Company</label><input value={shipment.shipping_company} onChange={e => setShipment({ ...shipment, shipping_company: e.target.value })} className="input-field" /></div>
                <div><label className="block text-sm font-medium text-gray-700 mb-1">Container Number</label><input value={shipment.container} onChange={e => setShipment({ ...shipment, container: e.target.value })} className="input-field" /></div>
                <div><label className="block text-sm font-medium text-gray-700 mb-1">Bill of Lading #</label><input value={shipment.bol_number} onChange={e => setShipment({ ...shipment, bol_number: e.target.value })} className="input-field" /></div>
                <div><label className="block text-sm font-medium text-gray-700 mb-1">Expected Departure</label><input type="date" value={shipment.departure_date} onChange={e => setShipment({ ...shipment, departure_date: e.target.value })} className="input-field" /></div>
                <div><label className="block text-sm font-medium text-gray-700 mb-1">Expected Arrival</label><input type="date" value={shipment.arrival_date} onChange={e => setShipment({ ...shipment, arrival_date: e.target.value })} className="input-field" /></div>
              </div>
            </div>
          )}

          {step === 4 && (
            <div className="space-y-4">
              <h2 className="text-lg font-bold text-gray-900">Document Uploads</h2>
              <p className="text-sm text-gray-500">Upload required documents (PDF, JPG, PNG, DOCX, XLSX - max 10MB each)</p>
              <div className="space-y-3">
                {DOC_TYPES.map(doc => (
                  <div key={doc} className="flex items-center justify-between p-3 border rounded-lg">
                    <span className="text-sm font-medium text-gray-700">{doc}</span>
                    <label className="btn-outline text-xs cursor-pointer py-1 px-3">
                      <Upload className="w-3 h-3 inline mr-1" /> Upload
                      <input type="file" className="hidden" accept=".pdf,.jpg,.jpeg,.png,.docx,.xlsx" />
                    </label>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="flex justify-between mt-8 pt-6 border-t">
            {step > 0 ? (
              <button onClick={() => setStep(step - 1)} className="btn-outline flex items-center gap-2"><ChevronLeft className="w-4 h-4" /> Previous</button>
            ) : <div />}
            {step < steps.length - 1 ? (
              <button onClick={() => setStep(step + 1)} className="btn-primary flex items-center gap-2">Next <ChevronRight className="w-4 h-4" /></button>
            ) : (
              <button onClick={() => setSubmitted(true)} className="btn-primary">Submit Export Record</button>
            )}
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
}
