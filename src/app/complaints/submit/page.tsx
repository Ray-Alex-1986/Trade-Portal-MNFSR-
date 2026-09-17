'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { AlertCircle, CheckCircle, FileText, Upload, X } from 'lucide-react';
import GovtLogo from '@/components/GovtLogo';
import { useDataStore } from '@/lib/data-store';
import { useAuth } from '@/lib/auth';
import { generateId } from '@/lib/utils';
import DemoModeNotice from '@/components/DemoModeNotice';

const ACCEPTED_TYPES = ['application/pdf', 'image/jpeg', 'image/png'];
const MAX_FILE_SIZE = 10 * 1024 * 1024;

export default function SubmitComplaintPage() {
  const { addComplaint, masterItems } = useDataStore();
  const { user } = useAuth();
  const [submitted, setSubmitted] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [trackingNumber] = useState(generateId('CMP'));
  const [error, setError] = useState('');
  const [attachments, setAttachments] = useState<File[]>([]);
  const [form, setForm] = useState({
    complainant_type: 'Buyer', full_name: '', email: '', phone: '', company_name: '',
    country: '', exporter_company: '', export_reg: '', export_record: '', product: '',
    category: '', subject: '', description: '', incident_date: '', preferred_contact: 'Email',
  });
  const [consent, setConsent] = useState(false);
  const countries = masterItems.countries;
  const categories = masterItems.complaint_categories;

  // Signed-in users do not need to retype their own contact details.
  useEffect(() => {
    if (!user) return;
    setForm(previous => ({
      ...previous,
      full_name: previous.full_name || user.full_name,
      email: previous.email || user.email,
      complainant_type: user.role === 'exporter' ? 'Exporter' : user.role === 'tic' ? 'Trade and Investment Counsellor' : previous.complainant_type,
    }));
  }, [user]);

  const addAttachments = (files: FileList | null) => {
    if (!files?.length) return;
    const accepted: File[] = [];
    for (const file of Array.from(files)) {
      if (!ACCEPTED_TYPES.includes(file.type)) {
        setError(`Invalid file type for "${file.name}". Upload PDF, JPG, or PNG.`);
        return;
      }
      if (file.size > MAX_FILE_SIZE) {
        setError(`File "${file.name}" exceeds the 10MB limit.`);
        return;
      }
      accepted.push(file);
    }
    setError('');
    setAttachments(previous => [...previous, ...accepted].slice(0, 5));
  };

  const removeAttachment = (name: string) => {
    setAttachments(previous => previous.filter(file => file.name !== name));
  };

  const handleSubmit = async () => {
    if (!form.full_name.trim() || !form.email.trim() || !form.phone.trim() || !form.country || !form.category || !form.subject.trim() || !form.description.trim()) {
      setError('Please fill in all required fields (name, email, phone, country, category, subject, and description).');
      return;
    }
    if (!/^\S+@\S+\.\S+$/.test(form.email.trim())) {
      setError('Please enter a valid email address.');
      return;
    }
    if (form.description.trim().length < 20) {
      setError('Please describe the issue in at least 20 characters so it can be investigated.');
      return;
    }
    setError('');
    setSubmitting(true);
    try {
      const attachmentNote = attachments.length
        ? `\n\nAttachments provided by the complainant: ${attachments.map(file => file.name).join(', ')}`
        : '';
      const result = await addComplaint({
        tracking_number: trackingNumber,
        complainant_type: form.complainant_type,
        full_name: form.full_name.trim(),
        email: form.email.trim(),
        phone: form.phone.trim(),
        company_name: form.company_name.trim() || undefined,
        country: form.country,
        exporter_company: form.exporter_company.trim() || undefined,
        export_registration_number: form.export_reg.trim() || undefined,
        export_record_number: form.export_record.trim() || undefined,
        product: form.product.trim() || undefined,
        category: form.category,
        subject: form.subject.trim(),
        description: `${form.description.trim()}${attachmentNote}`,
        incident_date: form.incident_date || '',
        preferred_contact: form.preferred_contact,
      });
      if (result.error) {
        setError(result.error);
        return;
      }
      setSubmitted(true);
    } catch {
      setError('The complaint could not be submitted. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  if (submitted) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <div className="max-w-lg w-full text-center">
          <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-6">
            <CheckCircle className="w-10 h-10 text-green-600" />
          </div>
          <h2 className="text-2xl font-bold text-gray-900 mb-2">Complaint Submitted!</h2>
          <p className="text-gray-500 mb-4">Your complaint has been registered and will be reviewed.</p>
          <div className="card p-6 text-left space-y-3 mb-6">
            <div className="flex justify-between"><span className="text-gray-500">Tracking Number:</span><span className="font-mono font-bold">{trackingNumber}</span></div>
            <div className="flex justify-between"><span className="text-gray-500">Category:</span><span>{form.category}</span></div>
            <div className="flex justify-between"><span className="text-gray-500">Status:</span><span className="badge bg-blue-100 text-blue-800">Submitted</span></div>
          </div>
          <p className="text-sm text-gray-500 mb-4">Save your tracking number — it is the only way to check this complaint without an account.</p>
          <div className="flex gap-3 justify-center">
            <Link href={`/complaints/track?tracking=${encodeURIComponent(trackingNumber)}`} className="btn-outline">Track Complaint</Link>
            <Link href="/" className="btn-primary">Back to Portal</Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <DemoModeNotice />
      <header className="bg-gov-green-500 text-white py-4">
        <div className="max-w-4xl mx-auto px-4 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2">
            <GovtLogo size={36} ring />
            <div><p className="font-bold text-sm">Submit Complaint</p><p className="text-xs text-gov-green-200">Government of Pakistan</p></div>
          </Link>
          <Link href="/complaints/track" className="text-sm text-gov-green-100 hover:text-white">Track Complaint</Link>
        </div>
      </header>

      <div className="max-w-4xl mx-auto px-4 py-8">
        <h1 className="text-2xl font-bold text-gray-900 mb-2">Buyer/Importer Complaint Form</h1>
        <p className="text-gray-500 mb-6">Submit a complaint regarding an export transaction. No portal account required.</p>

        <div className="card p-6 md:p-8 space-y-6">
          {error && (
            <div className="flex items-start gap-2 p-3 bg-red-50 border border-red-200 text-red-700 rounded-lg text-sm">
              <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}
          <div className="grid md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Complainant Type *</label>
              <select value={form.complainant_type} onChange={e => setForm({ ...form, complainant_type: e.target.value })} className="input-field">
                <option>Buyer</option><option>Importer</option><option>Exporter</option><option>Trade and Investment Counsellor</option><option>Other</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Full Name *</label>
              <input value={form.full_name} onChange={e => setForm({ ...form, full_name: e.target.value })} className="input-field" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Email *</label>
              <input type="email" value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} className="input-field" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Phone *</label>
              <input value={form.phone} onChange={e => setForm({ ...form, phone: e.target.value })} className="input-field" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Company Name</label>
              <input value={form.company_name} onChange={e => setForm({ ...form, company_name: e.target.value })} className="input-field" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Country *</label>
              <select value={form.country} onChange={e => setForm({ ...form, country: e.target.value })} className="input-field">
                <option value="">Select</option>{countries.map(c => <option key={c}>{c}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Exporter Company Name</label>
              <input value={form.exporter_company} onChange={e => setForm({ ...form, exporter_company: e.target.value })} className="input-field" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Export Record # (if available)</label>
              <input value={form.export_record} onChange={e => setForm({ ...form, export_record: e.target.value })} className="input-field" placeholder="EXP-XXXXXXX" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Product/Item</label>
              <input value={form.product} onChange={e => setForm({ ...form, product: e.target.value })} className="input-field" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Complaint Category *</label>
              <select value={form.category} onChange={e => setForm({ ...form, category: e.target.value })} className="input-field">
                <option value="">Select</option>{categories.map(c => <option key={c}>{c}</option>)}
              </select>
            </div>
            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-1">Subject *</label>
              <input value={form.subject} onChange={e => setForm({ ...form, subject: e.target.value })} className="input-field" />
            </div>
            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-1">Detailed Description *</label>
              <textarea value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} className="input-field" rows={4} />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Date of Incident</label>
              <input type="date" value={form.incident_date} onChange={e => setForm({ ...form, incident_date: e.target.value })} className="input-field" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Preferred Contact Method</label>
              <select value={form.preferred_contact} onChange={e => setForm({ ...form, preferred_contact: e.target.value })} className="input-field">
                <option>Email</option><option>Phone</option><option>Both</option>
              </select>
            </div>
            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-1">Supporting Documents (optional, up to 5)</label>
              <label
                className="block border-2 border-dashed border-gray-300 rounded-lg p-6 text-center hover:border-gov-green-500 cursor-pointer"
                onDragOver={event => { event.preventDefault(); event.stopPropagation(); }}
                onDrop={event => { event.preventDefault(); event.stopPropagation(); addAttachments(event.dataTransfer.files); }}
              >
                <input type="file" multiple accept=".pdf,.jpg,.jpeg,.png" className="hidden" onChange={event => addAttachments(event.target.files)} />
                <Upload className="w-8 h-8 text-gray-400 mx-auto mb-2" />
                <p className="text-sm text-gray-500">Drag files here or click to upload (PDF, JPG, PNG — max 10MB each)</p>
              </label>
              {attachments.length > 0 && (
                <ul className="mt-3 space-y-2">
                  {attachments.map(file => (
                    <li key={file.name} className="flex items-center justify-between p-2 border border-green-300 bg-green-50 rounded-lg">
                      <span className="flex items-center gap-2 min-w-0 text-sm">
                        <FileText className="w-4 h-4 text-green-600 flex-shrink-0" />
                        <span className="truncate">{file.name}</span>
                        <span className="text-xs text-gray-400">({(file.size / 1024).toFixed(0)} KB)</span>
                      </span>
                      <button type="button" onClick={() => removeAttachment(file.name)} aria-label={`Remove ${file.name}`} className="p-1 text-gray-400 hover:text-red-500">
                        <X className="w-4 h-4" />
                      </button>
                    </li>
                  ))}
                </ul>
              )}
              <p className="mt-2 text-xs text-gray-400">File names are recorded with the complaint so reviewers can request the originals.</p>
            </div>
          </div>

          <label className="flex items-start gap-3 p-4 bg-gray-50 rounded-lg cursor-pointer">
            <input type="checkbox" checked={consent} onChange={e => setConsent(e.target.checked)} className="mt-1 rounded" />
            <span className="text-sm text-gray-700">I declare that the information provided is true and accurate to the best of my knowledge. I understand that filing a false complaint may result in legal consequences.</span>
          </label>

          <button onClick={handleSubmit} disabled={!consent || submitting} className="btn-primary w-full py-3 disabled:opacity-50">
            {submitting ? 'Submitting...' : 'Submit Complaint'}
          </button>
        </div>
      </div>
    </div>
  );
}
