'use client';

import { useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { ChevronRight, ChevronLeft, CheckCircle, AlertCircle, Upload, X, FileText } from 'lucide-react';
import Image from 'next/image';
import { generateId } from '@/lib/utils';
import { useDataStore } from '@/lib/data-store';

const steps = ['Company Information', 'Authorized Representative', 'Verification'];

const ACCEPTED_TYPES = ['application/pdf', 'image/jpeg', 'image/png'];
const ACCEPTED_EXTENSIONS = '.pdf,.jpg,.jpeg,.png';
const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB

const REQUIRED_UPLOADS = [
  { key: 'reg_cert', label: 'Company Registration Certificate', step: 0 },
  { key: 'ntn_cert', label: 'NTN Certificate', step: 0 },
  { key: 'auth_letter', label: 'Authority Letter', step: 1 },
  { key: 'cnic_copy', label: 'CNIC Copy', step: 1 },
];

const COMPANY_TYPES = ['Private Limited', 'Public Limited', 'Sole Proprietor', 'Partnership'];
const BUSINESS_NATURES = ['Agricultural Export', 'Food Processing & Export', 'Trading & Export', 'Agro-Industrial Export'];

interface UploadFieldProps {
  fieldKey: string;
  label: string;
  hint?: string;
  file?: File;
  registerRef: (element: HTMLInputElement | null) => void;
  onSelect: (file: File | undefined) => void;
  onRemove: () => void;
  onOpen: () => void;
}

/**
 * Single document slot. Declared at module scope so React keeps the same
 * component type across renders — defining it inside the page would remount the
 * file input on every keystroke and drop the selected file.
 */
function UploadField({ fieldKey, label, hint, file, registerRef, onSelect, onRemove, onOpen }: UploadFieldProps) {
  return (
    <div>
      <label htmlFor={`upload-${fieldKey}`} className="block text-sm font-medium text-gray-700 mb-1">{label} *</label>
      {file ? (
        <div className="flex items-center justify-between p-3 border border-green-300 bg-green-50 rounded-lg">
          <div className="flex items-center gap-2 min-w-0">
            <FileText className="w-5 h-5 text-green-600 flex-shrink-0" />
            <span className="text-sm text-gray-800 truncate">{file.name}</span>
            <span className="text-xs text-gray-400">({(file.size / 1024).toFixed(0)} KB)</span>
          </div>
          <button type="button" aria-label={`Remove ${label}`} onClick={onRemove} className="p-1 text-gray-400 hover:text-red-500 flex-shrink-0">
            <X className="w-4 h-4" />
          </button>
        </div>
      ) : (
        <div
          role="button"
          tabIndex={0}
          className="border-2 border-dashed border-gray-300 rounded-lg p-4 text-center hover:border-gov-green-500 cursor-pointer transition-colors"
          onClick={onOpen}
          onKeyDown={event => { if (event.key === 'Enter' || event.key === ' ') onOpen(); }}
          onDragOver={event => { event.preventDefault(); event.stopPropagation(); }}
          onDrop={event => { event.preventDefault(); event.stopPropagation(); onSelect(event.dataTransfer.files?.[0]); }}
        >
          <Upload className="w-6 h-6 text-gray-400 mx-auto mb-1" />
          <p className="text-sm text-gray-500">{hint ?? 'Click or drag to upload (PDF, JPG, PNG)'}</p>
        </div>
      )}
      <input
        id={`upload-${fieldKey}`}
        ref={registerRef}
        type="file"
        accept={ACCEPTED_EXTENSIONS}
        className="hidden"
        onChange={event => onSelect(event.target.files?.[0])}
      />
    </div>
  );
}

export default function RegisterPage() {
  const { submitRegistration, masterItems } = useDataStore();
  const provinces = masterItems.provinces;
  const products = masterItems.products;
  const [step, setStep] = useState(0);
  const [loading, setLoading] = useState(false);
  const [verificationRequested, setVerificationRequested] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [submitError, setSubmitError] = useState('');
  const [stepError, setStepError] = useState('');
  const [regNumber] = useState(generateId('REG'));

  const [company, setCompany] = useState({
    legal_name: '', trading_name: '', company_type: 'Private Limited', ntn: '', secp_number: '',
    registration_date: '', address: '', province: '', district: '', city: '',
    website: '', email: '', phone: '', nature_of_business: 'Agricultural Export', main_export_categories: [] as string[],
  });

  const [representative, setRepresentative] = useState({
    cnic: '', full_name: '', designation: '', mobile: '', email: '',
    user_id: '', username: '', password: '', confirm_password: '',
  });

  const [consent, setConsent] = useState(false);
  const [uploadedFiles, setUploadedFiles] = useState<Record<string, File>>({});
  const [fileError, setFileError] = useState('');
  const fileInputRefs = useRef<Record<string, HTMLInputElement | null>>({});

  const handleFileSelect = (fieldKey: string, file: File | undefined) => {
    if (!file) return;
    if (!ACCEPTED_TYPES.includes(file.type)) {
      setFileError(`Invalid file type for "${file.name}". Please upload PDF, JPG, or PNG.`);
      return;
    }
    if (file.size > MAX_FILE_SIZE) {
      setFileError(`File "${file.name}" exceeds the 10MB limit.`);
      return;
    }
    setFileError('');
    setUploadedFiles(prev => ({ ...prev, [fieldKey]: file }));
  };

  const removeFile = (fieldKey: string) => {
    setUploadedFiles(prev => {
      const next = { ...prev };
      delete next[fieldKey];
      return next;
    });
    // Reset the file input so the same file can be re-selected
    const input = fileInputRefs.current[fieldKey];
    if (input) input.value = '';
  };

  /** Per-step validation. Returns the first problem, or null when the step is complete. */
  const validateStep = (index: number): string | null => {
    if (index === 0) {
      if (!company.legal_name.trim()) return 'Enter the legal name of the company.';
      if (!company.ntn.trim()) return 'Enter the company NTN.';
      if (!company.secp_number.trim()) return 'Enter the SECP registration number.';
      if (!company.registration_date) return 'Select the business registration date.';
      if (!company.province) return 'Select a province.';
      if (!company.district.trim()) return 'Enter a district.';
      if (!company.address.trim()) return 'Enter the registered business address.';
      if (!company.city.trim()) return 'Enter a city.';
      if (!company.email.trim()) return 'Enter the company email address.';
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(company.email.trim())) return 'Enter a valid company email address.';
      if (!company.phone.trim()) return 'Enter a company telephone number.';
      if (company.main_export_categories.length === 0) return 'Select at least one main export category.';
      const missing = REQUIRED_UPLOADS.filter(item => item.step === 0 && !uploadedFiles[item.key]);
      if (missing.length) return `Upload the following documents: ${missing.map(item => item.label).join(', ')}.`;
      return null;
    }
    if (index === 1) {
      if (!representative.cnic.trim()) return 'Enter the representative CNIC/NICOP number.';
      if (!representative.full_name.trim()) return 'Enter the representative full name.';
      if (!representative.designation.trim()) return 'Enter the representative designation.';
      if (!representative.mobile.trim()) return 'Enter the representative mobile number.';
      if (!representative.email.trim()) return 'Enter the representative email address.';
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(representative.email.trim())) return 'Enter a valid representative email address.';
      if (!representative.username.trim()) return 'Choose a username.';
      if (representative.password.length < 8) return 'Use a password with at least 8 characters.';
      if (representative.password !== representative.confirm_password) return 'Passwords do not match.';
      const missing = REQUIRED_UPLOADS.filter(item => item.step === 1 && !uploadedFiles[item.key]);
      if (missing.length) return `Upload the following documents: ${missing.map(item => item.label).join(', ')}.`;
      return null;
    }
    if (!consent) return 'Confirm the declaration before submitting.';
    return null;
  };

  const goNext = () => {
    const problem = validateStep(step);
    if (problem) {
      setStepError(problem);
      return;
    }
    setStepError('');
    setStep(step + 1);
  };

  const goPrevious = () => {
    setStepError('');
    setSubmitError('');
    setStep(step - 1);
  };

  const uploadedDocumentNames = useMemo(
    () => Object.entries(uploadedFiles).map(([key, file]) => {
      const label = REQUIRED_UPLOADS.find(item => item.key === key)?.label ?? key;
      return `${label}: ${file.name}`;
    }),
    [uploadedFiles],
  );

  const handleSubmit = async () => {
    // Re-validate every step so a skipped field can never reach the backend.
    for (let index = 0; index < steps.length; index += 1) {
      const problem = validateStep(index);
      if (problem) {
        setStep(index);
        setStepError(problem);
        return;
      }
    }
    setStepError('');
    setSubmitError('');
    setLoading(true);
    try {
      const result = await submitRegistration({
        company: {
          ...company,
          legal_name: company.legal_name.trim(),
          trading_name: company.trading_name.trim() || undefined,
          ntn: company.ntn.trim(),
          secp_number: company.secp_number.trim(),
          address: company.address.trim(),
          district: company.district.trim(),
          city: company.city.trim(),
          website: company.website.trim() || undefined,
          email: company.email.trim(),
          phone: company.phone.trim(),
        },
        representative: {
          full_name: representative.full_name.trim(),
          email: representative.email.trim(),
          username: representative.username.trim(),
          password: representative.password,
          cnic: representative.cnic.trim(),
          designation: representative.designation.trim(),
          mobile: representative.mobile.trim(),
        },
        registration_number: regNumber,
      });
      if (result.error) {
        setSubmitError(result.error);
        return;
      }
      setSubmitted(true);
    } catch {
      setSubmitError('Registration could not be submitted. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  if (submitted) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <div className="max-w-lg w-full text-center">
          <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-6">
            <CheckCircle className="w-10 h-10 text-green-600" />
          </div>
          <h2 className="text-2xl font-bold text-gray-900 mb-2">Registration Submitted Successfully</h2>
          <p className="text-gray-500 mb-6">Your application has been submitted for review by TDAP, then NAFSA.</p>
          <div className="card p-6 text-left space-y-3 mb-6">
            <div className="flex justify-between"><span className="text-gray-500">Registration Number:</span><span className="font-mono font-bold">{regNumber}</span></div>
            <div className="flex justify-between"><span className="text-gray-500">Company:</span><span className="font-medium">{company.legal_name}</span></div>
            <div className="flex justify-between"><span className="text-gray-500">Status:</span><span className="badge bg-yellow-100 text-yellow-800">Pending Verification</span></div>
            <div className="flex justify-between"><span className="text-gray-500">Submitted:</span><span>{new Date().toLocaleString()}</span></div>
            {uploadedDocumentNames.length > 0 && (
              <div className="pt-3 border-t">
                <p className="text-gray-500 mb-1">Documents attached:</p>
                <ul className="list-disc list-inside text-xs text-gray-600 space-y-0.5">
                  {uploadedDocumentNames.map(name => <li key={name}>{name}</li>)}
                </ul>
              </div>
            )}
          </div>
          <div className="card p-4 mb-6 bg-blue-50 border-blue-200">
            <p className="text-sm font-medium text-blue-800 mb-1">Your account has been created</p>
            <p className="text-sm text-blue-600">Sign in with <span className="font-medium">{representative.email.trim()}</span> and the password you chose during registration.</p>
          </div>
          <div className="flex gap-3 justify-center">
            <button className="btn-outline" onClick={() => window.print()}>Download Acknowledgment</button>
            <Link href="/login" className="btn-primary">Proceed to Login</Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-gov-green-500 text-white py-4">
        <div className="max-w-4xl mx-auto px-4 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2">
            <Image src="/govt-pakistan-logo.png" alt="Government of Pakistan" width={36} height={36} />
            <div>
              <p className="font-bold text-sm">Export Portal Registration</p>
              <p className="text-xs text-gov-green-200">Government of Pakistan</p>
            </div>
          </Link>
          <Link href="/login" className="text-sm text-gov-green-100 hover:text-white">Already registered? Login</Link>
        </div>
      </header>

      <div className="max-w-4xl mx-auto px-4 py-8">
        {/* Step Indicator */}
        <div className="flex items-center justify-center mb-8">
          {steps.map((s, i) => (
            <div key={s} className="flex items-center">
              <div className={`flex items-center gap-2 ${i <= step ? 'text-gov-green-500' : 'text-gray-400'}`}>
                <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold ${i < step ? 'bg-gov-green-500 text-white' : i === step ? 'border-2 border-gov-green-500 text-gov-green-500' : 'border-2 border-gray-300 text-gray-400'}`}>
                  {i < step ? <CheckCircle className="w-5 h-5" /> : i + 1}
                </div>
                <span className="text-sm font-medium hidden sm:block">{s}</span>
              </div>
              {i < steps.length - 1 && <div className={`w-16 h-0.5 mx-2 ${i < step ? 'bg-gov-green-500' : 'bg-gray-300'}`} />}
            </div>
          ))}
        </div>

        <div className="card p-6 md:p-8">
          {(fileError || stepError) && (
            <div className="flex items-start gap-2 p-3 mb-6 bg-red-50 border border-red-200 text-red-700 rounded-lg text-sm">
              <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
              <span>{fileError || stepError}</span>
            </div>
          )}

          {step === 0 && (
            <div className="space-y-6">
              <h2 className="text-xl font-bold text-gray-900">Step 1: Company Information</h2>
              <div className="grid md:grid-cols-2 gap-4">
                <div className="md:col-span-2">
                  <label className="block text-sm font-medium text-gray-700 mb-1">Legal Name of Company *</label>
                  <input value={company.legal_name} onChange={e => setCompany({ ...company, legal_name: e.target.value })} className="input-field" required />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Trading Name (if different)</label>
                  <input value={company.trading_name} onChange={e => setCompany({ ...company, trading_name: e.target.value })} className="input-field" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Company Type *</label>
                  <select value={company.company_type} onChange={e => setCompany({ ...company, company_type: e.target.value })} className="input-field">
                    {COMPANY_TYPES.map(type => <option key={type}>{type}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">NTN *</label>
                  <input value={company.ntn} onChange={e => setCompany({ ...company, ntn: e.target.value })} className="input-field" placeholder="1234567-1" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">SECP Registration Number *</label>
                  <input value={company.secp_number} onChange={e => setCompany({ ...company, secp_number: e.target.value })} className="input-field" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Business Registration Date *</label>
                  <input type="date" max={new Date().toISOString().slice(0, 10)} value={company.registration_date} onChange={e => setCompany({ ...company, registration_date: e.target.value })} className="input-field" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Province *</label>
                  <select value={company.province} onChange={e => setCompany({ ...company, province: e.target.value })} className="input-field">
                    <option value="">Select Province</option>
                    {provinces.map(province => <option key={province}>{province}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">District *</label>
                  <input value={company.district} onChange={e => setCompany({ ...company, district: e.target.value })} className="input-field" placeholder="Enter district" />
                </div>
                <div className="md:col-span-2">
                  <label className="block text-sm font-medium text-gray-700 mb-1">Registered Business Address *</label>
                  <input value={company.address} onChange={e => setCompany({ ...company, address: e.target.value })} className="input-field" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">City *</label>
                  <input value={company.city} onChange={e => setCompany({ ...company, city: e.target.value })} className="input-field" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Website (optional)</label>
                  <input value={company.website} onChange={e => setCompany({ ...company, website: e.target.value })} className="input-field" placeholder="https://" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Company Email *</label>
                  <input type="email" value={company.email} onChange={e => setCompany({ ...company, email: e.target.value })} className="input-field" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Telephone *</label>
                  <input value={company.phone} onChange={e => setCompany({ ...company, phone: e.target.value })} className="input-field" placeholder="+92-XXX-XXXXXXX" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Nature of Export Business *</label>
                  <select value={company.nature_of_business} onChange={e => setCompany({ ...company, nature_of_business: e.target.value })} className="input-field">
                    {BUSINESS_NATURES.map(nature => <option key={nature}>{nature}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Main Export Categories *</label>
                  <select
                    multiple
                    value={company.main_export_categories}
                    onChange={e => setCompany({ ...company, main_export_categories: Array.from(e.target.selectedOptions, o => o.value) })}
                    className="input-field h-24"
                  >
                    {products.map(product => <option key={product}>{product}</option>)}
                  </select>
                  <p className="mt-1 text-xs text-gray-400">Hold Ctrl (Cmd on Mac) to select more than one.</p>
                </div>
                <UploadField
                  fieldKey="reg_cert"
                  label="Company Registration Certificate"
                  file={uploadedFiles["reg_cert"]}
                  registerRef={element => { fileInputRefs.current["reg_cert"] = element; }}
                  onSelect={file => handleFileSelect("reg_cert", file)}
                  onRemove={() => removeFile("reg_cert")}
                  onOpen={() => fileInputRefs.current["reg_cert"]?.click()}
                />
                <UploadField
                  fieldKey="ntn_cert"
                  label="NTN Certificate"
                  file={uploadedFiles["ntn_cert"]}
                  registerRef={element => { fileInputRefs.current["ntn_cert"] = element; }}
                  onSelect={file => handleFileSelect("ntn_cert", file)}
                  onRemove={() => removeFile("ntn_cert")}
                  onOpen={() => fileInputRefs.current["ntn_cert"]?.click()}
                />
              </div>
            </div>
          )}

          {step === 1 && (
            <div className="space-y-6">
              <h2 className="text-xl font-bold text-gray-900">Step 2: Authorized Representative</h2>
              <div className="grid md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">CNIC/NICOP Number *</label>
                  <input value={representative.cnic} onChange={e => setRepresentative({ ...representative, cnic: e.target.value })} className="input-field" placeholder="XXXXX-XXXXXXX-X" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Full Name (as per CNIC) *</label>
                  <input value={representative.full_name} onChange={e => setRepresentative({ ...representative, full_name: e.target.value })} className="input-field" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Designation *</label>
                  <input value={representative.designation} onChange={e => setRepresentative({ ...representative, designation: e.target.value })} className="input-field" placeholder="e.g., CEO, Director" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Mobile Number *</label>
                  <input value={representative.mobile} onChange={e => setRepresentative({ ...representative, mobile: e.target.value })} className="input-field" placeholder="+92-3XX-XXXXXXX" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Email Address *</label>
                  <input type="email" autoComplete="email" value={representative.email} onChange={e => setRepresentative({ ...representative, email: e.target.value })} className="input-field" />
                  <p className="mt-1 text-xs text-gray-400">You will sign in with this email address.</p>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Username *</label>
                  <input value={representative.username} onChange={e => setRepresentative({ ...representative, username: e.target.value })} className="input-field" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Password *</label>
                  <input type="password" autoComplete="new-password" minLength={8} value={representative.password} onChange={e => setRepresentative({ ...representative, password: e.target.value })} className="input-field" />
                  <p className="mt-1 text-xs text-gray-400">At least 8 characters.</p>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Confirm Password *</label>
                  <input type="password" autoComplete="new-password" value={representative.confirm_password} onChange={e => setRepresentative({ ...representative, confirm_password: e.target.value })} className="input-field" />
                  {representative.confirm_password.length > 0 && representative.password !== representative.confirm_password && (
                    <p className="mt-1 text-xs text-red-500">Passwords do not match.</p>
                  )}
                </div>
                <UploadField
                  fieldKey="auth_letter"
                  label="Authority Letter"
                  hint="Upload authority letter"
                  file={uploadedFiles["auth_letter"]}
                  registerRef={element => { fileInputRefs.current["auth_letter"] = element; }}
                  onSelect={file => handleFileSelect("auth_letter", file)}
                  onRemove={() => removeFile("auth_letter")}
                  onOpen={() => fileInputRefs.current["auth_letter"]?.click()}
                />
                <UploadField
                  fieldKey="cnic_copy"
                  label="CNIC Copy"
                  hint="Upload CNIC copy"
                  file={uploadedFiles["cnic_copy"]}
                  registerRef={element => { fileInputRefs.current["cnic_copy"] = element; }}
                  onSelect={file => handleFileSelect("cnic_copy", file)}
                  onRemove={() => removeFile("cnic_copy")}
                  onOpen={() => fileInputRefs.current["cnic_copy"]?.click()}
                />
              </div>
            </div>
          )}

          {step === 2 && (
            <div className="space-y-6">
              <h2 className="text-xl font-bold text-gray-900">Step 3: Verification</h2>
              <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3 text-sm text-yellow-800">
                <AlertCircle className="w-4 h-4 inline mr-1" />
                <strong>Official verification:</strong> NADRA, SECP, and NTN/FBR checks are recorded as pending and are completed by authorized reviewers after submission.
              </div>

              <button
                onClick={() => setVerificationRequested(true)}
                disabled={verificationRequested}
                className="btn-primary w-full py-3 disabled:opacity-50"
              >
                {verificationRequested ? 'Details marked ready for official verification' : 'Mark Details Ready for Official Verification'}
              </button>

              <div className="space-y-3">
                {[
                  { key: 'nadra', label: 'NADRA Identity Verification', desc: `CNIC: ${representative.cnic || 'Not provided'}` },
                  { key: 'secp', label: 'SECP Company Verification', desc: `SECP #: ${company.secp_number || 'Not provided'}` },
                  { key: 'ntn', label: 'NTN/FBR Verification', desc: `NTN: ${company.ntn || 'Not provided'}` },
                ].map(v => (
                  <div key={v.key} className="flex items-center justify-between p-4 border rounded-lg">
                    <div>
                      <p className="font-medium text-gray-900">{v.label}</p>
                      <p className="text-sm text-gray-500">{v.desc}</p>
                    </div>
                    <span className={`badge ${verificationRequested ? 'bg-yellow-100 text-yellow-800' : 'bg-gray-100 text-gray-500'}`}>
                      {verificationRequested ? 'Pending Official Review' : 'Not Initiated'}
                    </span>
                  </div>
                ))}
                <div className="flex items-center justify-between p-4 border rounded-lg">
                  <div>
                    <p className="font-medium text-gray-900">Mobile Contact</p>
                    <p className="text-sm text-gray-500">{representative.mobile || 'Not provided'}</p>
                  </div>
                  <span className="badge bg-yellow-100 text-yellow-800">Pending reviewer contact</span>
                </div>
                <div className="flex items-center justify-between p-4 border rounded-lg">
                  <div>
                    <p className="font-medium text-gray-900">Documents Attached</p>
                    <p className="text-sm text-gray-500">{uploadedDocumentNames.length} of {REQUIRED_UPLOADS.length} required documents</p>
                  </div>
                  <span className={`badge ${uploadedDocumentNames.length >= REQUIRED_UPLOADS.length ? 'bg-green-100 text-green-800' : 'bg-yellow-100 text-yellow-800'}`}>
                    {uploadedDocumentNames.length >= REQUIRED_UPLOADS.length ? 'Complete' : 'Incomplete'}
                  </span>
                </div>
              </div>

              <label className="flex items-start gap-3 p-4 bg-gray-50 rounded-lg cursor-pointer">
                <input type="checkbox" checked={consent} onChange={e => setConsent(e.target.checked)} className="mt-1 rounded" />
                <span className="text-sm text-gray-700">
                  I hereby declare that all information provided is true and accurate. I consent to the verification of my details with relevant government authorities (NADRA, SECP, FBR). I understand that providing false information may result in rejection of my application and legal action.
                </span>
              </label>
            </div>
          )}

          {submitError && (
            <div className="mt-6 flex items-start gap-2 p-3 bg-red-50 border border-red-200 text-red-700 rounded-lg text-sm">
              <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
              <span>{submitError}</span>
            </div>
          )}

          {/* Navigation */}
          <div className="flex justify-between mt-8 pt-6 border-t">
            {step > 0 ? (
              <button onClick={goPrevious} className="btn-outline flex items-center gap-2">
                <ChevronLeft className="w-4 h-4" /> Previous
              </button>
            ) : (
              <Link href="/" className="btn-outline">Cancel</Link>
            )}
            {step < steps.length - 1 ? (
              <button onClick={goNext} className="btn-primary flex items-center gap-2">
                Next <ChevronRight className="w-4 h-4" />
              </button>
            ) : (
              <button onClick={handleSubmit} disabled={!consent || loading} className="btn-primary disabled:opacity-50">
                {loading ? 'Submitting...' : 'Submit Registration'}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
