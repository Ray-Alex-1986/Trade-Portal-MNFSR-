'use client';

import { useState } from 'react';
import Link from 'next/link';
import DashboardLayout from '@/components/layout/DashboardLayout';
import RoleGuard from '@/components/auth/RoleGuard';
import { useRouter } from 'next/navigation';
import { useDataStore } from '@/lib/data-store';
import { ROUTE_ROLES } from '@/lib/permissions';
import { ChevronRight, ChevronLeft, CheckCircle, Upload, AlertCircle, X } from 'lucide-react';
import { useAuth } from '@/lib/auth';

const steps = ['Exporter Info', 'Export Item', 'Buyer Info', 'Shipment', 'Documents'];

const DOC_TYPES = [
  "Buyer's Quality Requirement Sheet", "DDP SPS Certificate", "Pre-Shipment Inspection (PSI) Report",
  "Purchase Order / Export Contract", "Commercial Invoice", "Packing List",
  "Certificate of Origin", "Phytosanitary Certificate", "Laboratory Test Report",
  "Bill of Lading / Airway Bill", "Additional Supporting Documents"
];

// Mandatory documents that must be uploaded before submission
const MANDATORY_DOCS = ["DDP SPS Certificate", "Pre-Shipment Inspection (PSI) Report"];

export default function NewExportRecordPage() {
  const router = useRouter();
  const { user } = useAuth();
  const { companies, masterItems, addExportRecord } = useDataStore();
  const [step, setStep] = useState(0);
  const [submitted, setSubmitted] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [createdNumber, setCreatedNumber] = useState('');

  const products = masterItems.products || [];
  const countries = masterItems.countries || [];
  const provinces = masterItems.provinces || [];
  const ports = masterItems.ports || [];

  // Export records attach to the signed-in exporter's approved registration.
  const myCompanies = companies.filter(company => company.owner_id === user?.id);
  const myCompany = myCompanies.find(company => company.status === 'approved') ?? myCompanies[0];
  const isApproved = myCompany?.status === 'approved';

  const [item, setItem] = useState({
    product: '', category: '', hs_code: '', description: '', quantity: 0, unit: 'Metric Tons',
    value: 0, currency: 'USD', origin: 'Pakistan', province: '', district: '',
    crop_year: 2026, batch: '', packaging: 'Carton Boxes', packages: 0, shipment_date: '',
  });

  const [buyer, setBuyer] = useState({
    name: '', company: '', country: '', address: '', contact: '', email: '', phone: '', po_number: '',
  });

  const [shipment, setShipment] = useState({
    dest_country: '', dest_port: '', departure_port: '', transport_mode: 'Sea',
    shipping_company: '', container: '', bol_number: '', departure_date: '', arrival_date: '',
  });

  const [uploadedDocs, setUploadedDocs] = useState<Record<string, string>>({});
  const [docError, setDocError] = useState('');

  const ACCEPTED_TYPES = ['application/pdf', 'image/jpeg', 'image/png',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'];
  const MAX_FILE_SIZE = 10 * 1024 * 1024;

  const handleDocUpload = (docName: string, file: File | undefined) => {
    if (!file) return;
    if (file.type && !ACCEPTED_TYPES.includes(file.type)) {
      setDocError(`Invalid file type for "${file.name}". Upload PDF, JPG, PNG, DOCX, or XLSX.`);
      return;
    }
    if (file.size > MAX_FILE_SIZE) {
      setDocError(`File "${file.name}" exceeds the 10MB limit.`);
      return;
    }
    setUploadedDocs(prev => ({ ...prev, [docName]: file.name }));
    setDocError('');
  };

  const removeDoc = (docName: string) => {
    setUploadedDocs(prev => {
      const next = { ...prev };
      delete next[docName];
      return next;
    });
  };

  const mandatoryDocsMissing = MANDATORY_DOCS.filter(d => !uploadedDocs[d]);

  const handleSubmit = async () => {
    if (!user || !myCompany) {
      setDocError('Your exporter profile and approved company must be available before an export record can be submitted.');
      return;
    }
    if (!isApproved) {
      setDocError('Your company registration must be approved by TDAP and NAFSA before you can submit export records.');
      return;
    }
    if (!item.product || !item.description || !item.quantity || !item.value) {
      setStep(1);
      setDocError('Please complete the required item information (product, description, quantity, value) before submitting.');
      return;
    }
    if (!buyer.name || !buyer.company || !buyer.country) {
      setStep(2);
      setDocError('Please complete the required buyer information before submitting.');
      return;
    }
    if (!shipment.dest_country) {
      setStep(3);
      setDocError('Please select a destination country before submitting.');
      return;
    }
    if (mandatoryDocsMissing.length > 0) {
      setStep(4);
      setDocError(`Please upload the following mandatory documents: ${mandatoryDocsMissing.join(', ')}`);
      return;
    }

    const productCategory = item.product.includes('Rice') ? 'Cereals'
      : (item.product.includes('Mango') || item.product.includes('Citrus') || item.product.includes('Kinnow')) ? 'Fruits'
      : (item.product.includes('Potato') || item.product.includes('Onion')) ? 'Vegetables'
      : (item.product.includes('Meat') || item.product.includes('Seafood')) ? 'Meat & Seafood'
      : 'Other Agricultural';

    setSubmitting(true);
    setDocError('');
    try {
      const result = await addExportRecord({
        exporter_id: user.id,
        company_id: myCompany.id,
        product: item.product,
        product_category: productCategory,
        hs_code: item.hs_code,
        description: item.description,
        quantity: item.quantity,
        unit: item.unit,
        estimated_value: item.value,
        currency: item.currency,
        country_of_origin: 'Pakistan',
        province_of_production: item.province,
        district_of_production: item.district,
        crop_year: item.crop_year,
        batch_number: item.batch,
        packaging_type: item.packaging,
        num_packages: item.packages,
        intended_shipment_date: item.shipment_date,
        buyer_name: buyer.name,
        buyer_company: buyer.company,
        buyer_country: buyer.country,
        buyer_address: buyer.address,
        buyer_contact: buyer.contact,
        buyer_email: buyer.email,
        buyer_phone: buyer.phone,
        purchase_order: buyer.po_number,
        destination_country: shipment.dest_country,
        destination_port: shipment.dest_port,
        port_of_departure: shipment.departure_port,
        transport_mode: shipment.transport_mode,
        shipping_company: shipment.shipping_company,
        container_number: shipment.container,
        bill_of_lading: shipment.bol_number,
        expected_departure: shipment.departure_date,
        expected_arrival: shipment.arrival_date,
        status: 'submitted',
        documents: Object.entries(uploadedDocs).map(([docType, fileName]) => ({
          id: `doc-${Date.now()}-${docType.replace(/\W/g, '')}`,
          record_id: 'pending',
          document_type: docType,
          file_name: fileName,
          file_size: 0,
          upload_date: new Date().toISOString(),
          uploaded_by: user.id,
          version: 1,
          verification_status: 'pending',
          file_url: `local://${fileName}`,
        })),
      });
      if (result.error || !result.data) {
        setDocError(result.error ?? 'The export record could not be submitted.');
        return;
      }
      setCreatedNumber(result.data.consignment_number);
      setSubmitted(true);
    } finally {
      setSubmitting(false);
    }
  };

  const resetForm = () => {
    setSubmitted(false);
    setStep(0);
    setCreatedNumber('');
    setItem({
      product: '', category: '', hs_code: '', description: '', quantity: 0, unit: 'Metric Tons',
      value: 0, currency: 'USD', origin: 'Pakistan', province: '', district: '',
      crop_year: 2026, batch: '', packaging: 'Carton Boxes', packages: 0, shipment_date: '',
    });
    setBuyer({ name: '', company: '', country: '', address: '', contact: '', email: '', phone: '', po_number: '' });
    setShipment({
      dest_country: '', dest_port: '', departure_port: '', transport_mode: 'Sea',
      shipping_company: '', container: '', bol_number: '', departure_date: '', arrival_date: '',
    });
    setUploadedDocs({});
    setDocError('');
  };

  if (submitted) {
    return (
      <DashboardLayout>
        <RoleGuard allow={ROUTE_ROLES['/dashboard/exports/new']}>
        <div className="max-w-lg mx-auto text-center py-12">
          <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-6">
            <CheckCircle className="w-10 h-10 text-green-600" />
          </div>
          <h2 className="text-2xl font-bold text-gray-900 mb-2">Export Record Submitted!</h2>
          <p className="text-gray-500 mb-4">Consignment <span className="font-mono font-bold text-gov-green-600">{createdNumber}</span> has been submitted for review.</p>
          <div className="flex gap-3 justify-center">
            <button className="btn-outline" onClick={() => router.push('/dashboard/exports')}>View Records</button>
            <button className="btn-primary" onClick={resetForm}>Create Another</button>
          </div>
        </div>
        </RoleGuard>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <RoleGuard allow={ROUTE_ROLES['/dashboard/exports/new']}>
      <div className="max-w-4xl mx-auto space-y-6">
        <h1 className="text-2xl font-bold text-gray-900">New Export Record</h1>

        {!isApproved && (
          <div className="flex items-start gap-2 p-4 bg-amber-50 border border-amber-200 text-amber-800 rounded-lg text-sm">
            <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
            <div>
              <p className="font-medium">
                {myCompany
                  ? `Your registration ${myCompany.registration_number} is ${myCompany.status.replace(/_/g, ' ')}.`
                  : 'No company registration is linked to your account.'}
              </p>
              <p className="mt-0.5">
                Export records can be submitted once TDAP and NAFSA approve your registration.{' '}
                <Link href="/dashboard" className="underline">Check your registration status</Link>.
              </p>
            </div>
          </div>
        )}

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
                <div><label className="block text-sm font-medium text-gray-500 mb-1">Registration Number</label><p className="input-field bg-gray-50">{myCompany?.registration_number ?? '—'}</p></div>
                <div><label className="block text-sm font-medium text-gray-500 mb-1">Company Name</label><p className="input-field bg-gray-50">{myCompany?.legal_name ?? '—'}</p></div>
                <div><label className="block text-sm font-medium text-gray-500 mb-1">NTN</label><p className="input-field bg-gray-50">{myCompany?.ntn ?? '—'}</p></div>
                <div><label className="block text-sm font-medium text-gray-500 mb-1">Authorized Representative</label><p className="input-field bg-gray-50">{user?.full_name ?? '—'}</p></div>
              </div>
            </div>
          )}

          {step === 1 && (
            <div className="space-y-4">
              <h2 className="text-lg font-bold text-gray-900">Export Item Information</h2>
              <div className="grid md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Product *</label>
                  <select value={item.product} onChange={e => setItem({ ...item, product: e.target.value })} className="input-field">
                    <option value="">Select Product</option>
                    {products.map(p => <option key={p}>{p}</option>)}
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
                    {provinces.map(p => <option key={p}>{p}</option>)}
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
                <div><label className="block text-sm font-medium text-gray-700 mb-1">Country *</label><select value={buyer.country} onChange={e => setBuyer({ ...buyer, country: e.target.value })} className="input-field"><option value="">Select</option>{countries.map(c => <option key={c}>{c}</option>)}</select></div>
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
                <div><label className="block text-sm font-medium text-gray-700 mb-1">Destination Country *</label><select value={shipment.dest_country} onChange={e => setShipment({ ...shipment, dest_country: e.target.value })} className="input-field"><option value="">Select</option>{countries.map(c => <option key={c}>{c}</option>)}</select></div>
                <div><label className="block text-sm font-medium text-gray-700 mb-1">Destination Port *</label><input value={shipment.dest_port} onChange={e => setShipment({ ...shipment, dest_port: e.target.value })} className="input-field" /></div>
                <div><label className="block text-sm font-medium text-gray-700 mb-1">Port of Departure</label><select value={shipment.departure_port} onChange={e => setShipment({ ...shipment, departure_port: e.target.value })} className="input-field">{ports.map(p => <option key={p}>{p}</option>)}</select></div>
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

              {docError && (
                <div className="flex items-center gap-2 p-3 bg-red-50 border border-red-200 text-red-700 rounded-lg text-sm">
                  <AlertCircle className="w-4 h-4" />
                  {docError}
                </div>
              )}

              <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg text-sm text-amber-800">
                <AlertCircle className="w-4 h-4 inline mr-1" />
                <strong>Mandatory:</strong> DDP SPS Certificate and Pre-Shipment Inspection (PSI) Report must be uploaded before submission.
              </div>

              <div className="space-y-3">
                {DOC_TYPES.map(doc => {
                  const isMandatory = MANDATORY_DOCS.includes(doc);
                  const isUploaded = uploadedDocs[doc];
                  return (
                    <div key={doc} className={`flex items-center justify-between p-3 border rounded-lg ${isUploaded ? 'border-green-300 bg-green-50' : isMandatory ? 'border-amber-300 bg-amber-50' : ''}`}>
                      <div className="flex items-center gap-2">
                        {isUploaded ? (
                          <CheckCircle className="w-5 h-5 text-green-600 flex-shrink-0" />
                        ) : isMandatory ? (
                          <AlertCircle className="w-5 h-5 text-amber-500 flex-shrink-0" />
                        ) : null}
                        <div>
                          <span className="text-sm font-medium text-gray-700">{doc}</span>
                          {isMandatory && <span className="ml-2 text-xs font-bold text-red-600 uppercase">* Required</span>}
                        </div>
                      </div>
                      {isUploaded ? (
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-medium text-green-600 truncate max-w-[10rem]">{uploadedDocs[doc]}</span>
                          <button type="button" onClick={() => removeDoc(doc)} aria-label={`Remove ${doc}`} className="p-1 text-gray-400 hover:text-red-500">
                            <X className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      ) : (
                        <label className="btn-outline text-xs cursor-pointer py-1 px-3">
                          <Upload className="w-3 h-3 inline mr-1" /> Upload
                          <input type="file" className="hidden" accept=".pdf,.jpg,.jpeg,.png,.docx,.xlsx" onChange={e => handleDocUpload(doc, e.target.files?.[0])} />
                        </label>
                      )}
                    </div>
                  );
                })}
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
              <button onClick={handleSubmit} disabled={submitting || !isApproved} className="btn-primary disabled:opacity-50">
                {submitting ? 'Submitting...' : 'Submit Export Record'}
              </button>
            )}
          </div>
        </div>
      </div>
      </RoleGuard>
    </DashboardLayout>
  );
}
