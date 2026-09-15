'use client';

import { useState, useRef } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ChevronRight, ChevronLeft, CheckCircle, AlertCircle, Upload, X, FileText } from 'lucide-react';
import Image from 'next/image';
import { PROVINCES, DISTRICTS, PRODUCTS, mockVerificationAPI } from '@/lib/mock-data';
import { generateId } from '@/lib/utils';
import { useDataStore } from '@/lib/data-store';

const steps = ['Company Information', 'Authorized Representative', 'Verification'];

export default function RegisterPage() {
  const router = useRouter();
  const { submitRegistration } = useDataStore();
  const [step, setStep] = useState(0);
  const [loading, setLoading] = useState(false);
  const [verifying, setVerifying] = useState(false);
  const [verificationResults, setVerificationResults] = useState<Record<string, { status: string; message: string }>>({});
  const [submitted, setSubmitted] = useState(false);
  const [regNumber] = useState(generateId('REG'));

  const [company, setCompany] = useState({
    legal_name: '', trading_name: '', company_type: 'Private Limited', ntn: '', secp_number: '',
    registration_date: '', address: '', province: 'Punjab', district: '', city: '',
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

  const ACCEPTED_TYPES = ['application/pdf', 'image/jpeg', 'image/png'];
  const ACCEPTED_EXTENSIONS = '.pdf,.jpg,.jpeg,.png';
  const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB

  const handleFileSelect = (fieldKey: string, file: File | undefined) => {
    if (!file) return;
    if (!ACCEPTED_TYPES.includes(file.type)) {
      setFileError(`Invalid file type for "${file.name}". Please upload PDF, JPG, or PNG.`);
      return;
    }
    if (file.size > MAX_FILE_SIZE) {
      setFileError(`File "${file.name}" exceeds 10MB limit.`);
      return;
    }
    setFileError('');
    setUploadedFiles(prev => ({ ...prev, [fieldKey]: file }));
  };

  const handleDrop = (e: React.DragEvent, fieldKey: string) => {
    e.preventDefault();
    e.stopPropagation();
    const file = e.dataTransfer.files?.[0];
    handleFileSelect(fieldKey, file);
  };

  const removeFile = (fieldKey: string) => {
    setUploadedFiles(prev => {
      const next = { ...prev };
      delete next[fieldKey];
      return next;
    });
    // Reset the file input so the same file can be re-selected
    if (fileInputRefs.current[fieldKey]) {
      fileInputRefs.current[fieldKey]!.value = '';
    }
  };

  const runVerification = async () => {
    setVerifying(true);
    try {
      const nadra = await mockVerificationAPI.verifyNADRA(representative.cnic);
      setVerificationResults(prev => ({ ...prev, nadra }));
      const secp = await mockVerificationAPI.verifySECP(company.secp_number);
      setVerificationResults(prev => ({ ...prev, secp }));
      const ntn = await mockVerificationAPI.verifyNTN(company.ntn);
      setVerificationResults(prev => ({ ...prev, ntn }));
    } finally {
      setVerifying(false);
    }
  };

  const handleSubmit = () => {
    if (!consent) return;
    setLoading(true);
    try {
      submitRegistration({
        company,
        representative,
        registration_number: regNumber,
      });
      setSubmitted(true);
    } catch {
      // ignore — demo mode
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
          <h2 className="text-2xl font-bold text-gray-900 mb-2">Registration Submitted Successfully!</h2>
          <p className="text-gray-500 mb-6">Your application has been submitted for review by TDAP/NAFSA officers.</p>
          <div className="card p-6 text-left space-y-3 mb-6">
            <div className="flex justify-between"><span className="text-gray-500">Registration Number:</span><span className="font-mono font-bold">{regNumber}</span></div>
            <div className="flex justify-between"><span className="text-gray-500">Company:</span><span className="font-medium">{company.legal_name}</span></div>
            <div className="flex justify-between"><span className="text-gray-500">Status:</span><span className="badge bg-yellow-100 text-yellow-800">Pending Verification</span></div>
            <div className="flex justify-between"><span className="text-gray-500">Submitted:</span><span>{new Date().toLocaleString()}</span></div>
          </div>
          <div className="card p-4 mb-6 bg-blue-50 border-blue-200">
            <p className="text-sm font-medium text-blue-800 mb-1">Your account has been created!</p>
            <p className="text-sm text-blue-600">Login with: <span className="font-mono font-bold">{representative.email}</span> (any password)</p>
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
          {step === 0 && (
            <div className="space-y-6">
              <h2 className="text-xl font-bold text-gray-900">Step 1: Company Information</h2>
              {fileError && (
                <div className="flex items-center gap-2 p-3 bg-red-50 border border-red-200 text-red-700 rounded-lg text-sm">
                  <AlertCircle className="w-4 h-4" />
                  {fileError}
                </div>
              )}
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
                    <option>Private Limited</option><option>Public Limited</option><option>Sole Proprietor</option><option>Partnership</option>
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
                  <input type="date" value={company.registration_date} onChange={e => setCompany({ ...company, registration_date: e.target.value })} className="input-field" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Province *</label>
                  <select value={company.province} onChange={e => setCompany({ ...company, province: e.target.value, district: '' })} className="input-field">
                    {PROVINCES.map(p => <option key={p}>{p}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">District *</label>
                  <select value={company.district} onChange={e => setCompany({ ...company, district: e.target.value })} className="input-field">
                    <option value="">Select District</option>
                    {(DISTRICTS[company.province] || []).map(d => <option key={d}>{d}</option>)}
                  </select>
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
                  <input value={company.website} onChange={e => setCompany({ ...company, website: e.target.value })} className="input-field" />
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
                    <option>Agricultural Export</option><option>Food Processing & Export</option><option>Trading & Export</option><option>Agro-Industrial Export</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Main Export Categories *</label>
                  <select multiple value={company.main_export_categories} onChange={e => setCompany({ ...company, main_export_categories: Array.from(e.target.selectedOptions, o => o.value) })} className="input-field h-24">
                    {PRODUCTS.map(p => <option key={p}>{p}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Company Registration Certificate *</label>
                  {uploadedFiles['reg_cert'] ? (
                    <div className="flex items-center justify-between p-3 border border-green-300 bg-green-50 rounded-lg">
                      <div className="flex items-center gap-2 min-w-0">
                        <FileText className="w-5 h-5 text-green-600 flex-shrink-0" />
                        <span className="text-sm text-gray-800 truncate">{uploadedFiles['reg_cert'].name}</span>
                        <span className="text-xs text-gray-400">({(uploadedFiles['reg_cert'].size / 1024).toFixed(0)} KB)</span>
                      </div>
                      <button type="button" onClick={() => removeFile('reg_cert')} className="p-1 text-gray-400 hover:text-red-500 flex-shrink-0"><X className="w-4 h-4" /></button>
                    </div>
                  ) : (
                    <div
                      className="border-2 border-dashed border-gray-300 rounded-lg p-4 text-center hover:border-gov-green-500 cursor-pointer transition-colors"
                      onClick={() => fileInputRefs.current['reg_cert']?.click()}
                      onDragOver={e => { e.preventDefault(); e.stopPropagation(); }}
                      onDrop={e => handleDrop(e, 'reg_cert')}
                    >
                      <input ref={el => { fileInputRefs.current['reg_cert'] = el; }} type="file" accept={ACCEPTED_EXTENSIONS} className="hidden" onChange={e => handleFileSelect('reg_cert', e.target.files?.[0])} />
                      <Upload className="w-6 h-6 text-gray-400 mx-auto mb-1" />
                      <p className="text-sm text-gray-500">Click or drag to upload (PDF, JPG, PNG)</p>
                    </div>
                  )}
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">NTN Certificate *</label>
                  {uploadedFiles['ntn_cert'] ? (
                    <div className="flex items-center justify-between p-3 border border-green-300 bg-green-50 rounded-lg">
                      <div className="flex items-center gap-2 min-w-0">
                        <FileText className="w-5 h-5 text-green-600 flex-shrink-0" />
                        <span className="text-sm text-gray-800 truncate">{uploadedFiles['ntn_cert'].name}</span>
                        <span className="text-xs text-gray-400">({(uploadedFiles['ntn_cert'].size / 1024).toFixed(0)} KB)</span>
                      </div>
                      <button type="button" onClick={() => removeFile('ntn_cert')} className="p-1 text-gray-400 hover:text-red-500 flex-shrink-0"><X className="w-4 h-4" /></button>
                    </div>
                  ) : (
                    <div
                      className="border-2 border-dashed border-gray-300 rounded-lg p-4 text-center hover:border-gov-green-500 cursor-pointer transition-colors"
                      onClick={() => fileInputRefs.current['ntn_cert']?.click()}
                      onDragOver={e => { e.preventDefault(); e.stopPropagation(); }}
                      onDrop={e => handleDrop(e, 'ntn_cert')}
                    >
                      <input ref={el => { fileInputRefs.current['ntn_cert'] = el; }} type="file" accept={ACCEPTED_EXTENSIONS} className="hidden" onChange={e => handleFileSelect('ntn_cert', e.target.files?.[0])} />
                      <Upload className="w-6 h-6 text-gray-400 mx-auto mb-1" />
                      <p className="text-sm text-gray-500">Click or drag to upload (PDF, JPG, PNG)</p>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {step === 1 && (
            <div className="space-y-6">
              <h2 className="text-xl font-bold text-gray-900">Step 2: Authorized Representative</h2>
              {fileError && (
                <div className="flex items-center gap-2 p-3 bg-red-50 border border-red-200 text-red-700 rounded-lg text-sm">
                  <AlertCircle className="w-4 h-4" />
                  {fileError}
                </div>
              )}
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
                  <input type="email" value={representative.email} onChange={e => setRepresentative({ ...representative, email: e.target.value })} className="input-field" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Username *</label>
                  <input value={representative.username} onChange={e => setRepresentative({ ...representative, username: e.target.value })} className="input-field" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Password *</label>
                  <input type="password" value={representative.password} onChange={e => setRepresentative({ ...representative, password: e.target.value })} className="input-field" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Confirm Password *</label>
                  <input type="password" value={representative.confirm_password} onChange={e => setRepresentative({ ...representative, confirm_password: e.target.value })} className="input-field" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Authority Letter *</label>
                  {uploadedFiles['auth_letter'] ? (
                    <div className="flex items-center justify-between p-3 border border-green-300 bg-green-50 rounded-lg">
                      <div className="flex items-center gap-2 min-w-0">
                        <FileText className="w-5 h-5 text-green-600 flex-shrink-0" />
                        <span className="text-sm text-gray-800 truncate">{uploadedFiles['auth_letter'].name}</span>
                        <span className="text-xs text-gray-400">({(uploadedFiles['auth_letter'].size / 1024).toFixed(0)} KB)</span>
                      </div>
                      <button type="button" onClick={() => removeFile('auth_letter')} className="p-1 text-gray-400 hover:text-red-500 flex-shrink-0"><X className="w-4 h-4" /></button>
                    </div>
                  ) : (
                    <div
                      className="border-2 border-dashed border-gray-300 rounded-lg p-4 text-center hover:border-gov-green-500 cursor-pointer transition-colors"
                      onClick={() => fileInputRefs.current['auth_letter']?.click()}
                      onDragOver={e => { e.preventDefault(); e.stopPropagation(); }}
                      onDrop={e => handleDrop(e, 'auth_letter')}
                    >
                      <input ref={el => { fileInputRefs.current['auth_letter'] = el; }} type="file" accept={ACCEPTED_EXTENSIONS} className="hidden" onChange={e => handleFileSelect('auth_letter', e.target.files?.[0])} />
                      <Upload className="w-6 h-6 text-gray-400 mx-auto mb-1" />
                      <p className="text-sm text-gray-500">Upload authority letter</p>
                    </div>
                  )}
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">CNIC Copy *</label>
                  {uploadedFiles['cnic_copy'] ? (
                    <div className="flex items-center justify-between p-3 border border-green-300 bg-green-50 rounded-lg">
                      <div className="flex items-center gap-2 min-w-0">
                        <FileText className="w-5 h-5 text-green-600 flex-shrink-0" />
                        <span className="text-sm text-gray-800 truncate">{uploadedFiles['cnic_copy'].name}</span>
                        <span className="text-xs text-gray-400">({(uploadedFiles['cnic_copy'].size / 1024).toFixed(0)} KB)</span>
                      </div>
                      <button type="button" onClick={() => removeFile('cnic_copy')} className="p-1 text-gray-400 hover:text-red-500 flex-shrink-0"><X className="w-4 h-4" /></button>
                    </div>
                  ) : (
                    <div
                      className="border-2 border-dashed border-gray-300 rounded-lg p-4 text-center hover:border-gov-green-500 cursor-pointer transition-colors"
                      onClick={() => fileInputRefs.current['cnic_copy']?.click()}
                      onDragOver={e => { e.preventDefault(); e.stopPropagation(); }}
                      onDrop={e => handleDrop(e, 'cnic_copy')}
                    >
                      <input ref={el => { fileInputRefs.current['cnic_copy'] = el; }} type="file" accept={ACCEPTED_EXTENSIONS} className="hidden" onChange={e => handleFileSelect('cnic_copy', e.target.files?.[0])} />
                      <Upload className="w-6 h-6 text-gray-400 mx-auto mb-1" />
                      <p className="text-sm text-gray-500">Upload CNIC copy</p>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {step === 2 && (
            <div className="space-y-6">
              <h2 className="text-xl font-bold text-gray-900">Step 3: Verification</h2>
              <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3 text-sm text-yellow-800">
                <AlertCircle className="w-4 h-4 inline mr-1" />
                <strong>MVP Verification Simulation:</strong> The following verifications are simulated for demonstration purposes.
              </div>

              <button onClick={runVerification} disabled={verifying} className="btn-primary w-full py-3 disabled:opacity-50">
                {verifying ? 'Running Verifications...' : 'Run Verification Checks'}
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
                    {verificationResults[v.key] ? (
                      <span className={`badge ${verificationResults[v.key].status === 'verified' ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>
                        {verificationResults[v.key].status === 'verified' ? 'Verified' : 'Failed'}
                      </span>
                    ) : (
                      <span className="badge bg-gray-100 text-gray-500">Not Initiated</span>
                    )}
                  </div>
                ))}
                <div className="flex items-center justify-between p-4 border rounded-lg">
                  <div>
                    <p className="font-medium text-gray-900">Mobile OTP Verification</p>
                    <p className="text-sm text-gray-500">{representative.mobile || 'Not provided'}</p>
                  </div>
                  <span className="badge bg-green-100 text-green-800">Simulated: Passed</span>
                </div>
                <div className="flex items-center justify-between p-4 border rounded-lg">
                  <div>
                    <p className="font-medium text-gray-900">Email Verification</p>
                    <p className="text-sm text-gray-500">{representative.email || 'Not provided'}</p>
                  </div>
                  <span className="badge bg-green-100 text-green-800">Simulated: Passed</span>
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

          {/* Navigation */}
          <div className="flex justify-between mt-8 pt-6 border-t">
            {step > 0 ? (
              <button onClick={() => setStep(step - 1)} className="btn-outline flex items-center gap-2">
                <ChevronLeft className="w-4 h-4" /> Previous
              </button>
            ) : (
              <Link href="/" className="btn-outline">Cancel</Link>
            )}
            {step < 2 ? (
              <button onClick={() => setStep(step + 1)} className="btn-primary flex items-center gap-2">
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
