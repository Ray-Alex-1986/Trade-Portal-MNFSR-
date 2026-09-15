'use client';

import { useMemo, useState } from 'react';
import DashboardLayout from '@/components/layout/DashboardLayout';
import RoleGuard from '@/components/auth/RoleGuard';
import { useToast } from '@/components/ui/Toast';
import { useDataStore, ReviewDecision } from '@/lib/data-store';
import { useAuth } from '@/lib/auth';
import { isInReviewQueue, resolveReviewStage, ROUTE_ROLES } from '@/lib/permissions';
import { formatDate, formatDateTime, getStatusColor } from '@/lib/utils';
import { CheckCircle, XCircle, MessageSquare, Eye, FileText, AlertTriangle, Package, Info } from 'lucide-react';

type Tab = 'registrations' | 'exports' | 'complaints';

const OPEN_COMPLAINT_STATUSES = ['submitted', 'acknowledged', 'under_review', 'assigned', 'info_required', 'investigation', 'escalated', 'reopened'];

export default function ReviewWorkspacePage() {
  const {
    companies, exportRecords, complaints, users,
    reviewRegistration, reviewExportRecord,
    resolveComplaint, escalateComplaint, addComplaintNote,
  } = useDataStore();
  const { user } = useAuth();
  const { showToast, ToastView } = useToast();

  const [tab, setTab] = useState<Tab>('registrations');
  const [selectedItem, setSelectedItem] = useState<string | null>(null);
  const [remarks, setRemarks] = useState('');
  const [resolution, setResolution] = useState('');
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);

  // Each role only sees the queue for its own stage; super admins see all open items.
  const pendingRegistrations = useMemo(
    () => companies.filter(item => isInReviewQueue(user?.role, item.status)),
    [companies, user?.role],
  );
  const pendingExports = useMemo(
    () => exportRecords.filter(item => isInReviewQueue(user?.role, item.status)),
    [exportRecords, user?.role],
  );
  const pendingComplaints = useMemo(
    () => complaints.filter(item => OPEN_COMPLAINT_STATUSES.includes(item.status)),
    [complaints],
  );

  const selectedRegistration = pendingRegistrations.find(item => item.id === selectedItem);
  const selectedExport = pendingExports.find(item => item.id === selectedItem);
  const selectedComplaint = pendingComplaints.find(item => item.id === selectedItem);

  // The stage a decision will act on depends on the item's own progress.
  const registrationStage = resolveReviewStage(user?.role, selectedRegistration?.tdap_review_status);
  const exportStage = resolveReviewStage(user?.role, selectedExport?.tdap_review_status);
  const ownStage = resolveReviewStage(user?.role, undefined);
  const stageLabel = ownStage === 'tdap' ? 'TDAP' : ownStage === 'nafsa' ? 'NAFSA' : 'All';

  const tabs = [
    { key: 'registrations' as Tab, label: 'Registrations', count: pendingRegistrations.length, icon: FileText },
    { key: 'exports' as Tab, label: 'Export Records', count: pendingExports.length, icon: Package },
    { key: 'complaints' as Tab, label: 'Complaints', count: pendingComplaints.length, icon: AlertTriangle },
  ];

  const clearSelection = () => {
    setSelectedItem(null);
    setRemarks('');
    setResolution('');
    setNote('');
  };

  const selectItem = (id: string) => {
    setSelectedItem(id);
    setRemarks('');
    setResolution('');
    setNote('');
  };

  const decisionLabel = (decision: ReviewDecision) =>
    decision === 'approve' ? 'approved' : decision === 'reject' ? 'rejected' : 'marked for additional information';

  const handleRegistrationDecision = async (id: string, decision: ReviewDecision) => {
    const company = companies.find(item => item.id === id);
    if (!company) return;
    if ((decision === 'reject' || decision === 'request_info') && !remarks.trim()) {
      showToast('Please provide remarks explaining the decision before proceeding.', 'error');
      return;
    }
    setBusy(true);
    try {
      const result = await reviewRegistration(id, decision, remarks.trim() || undefined);
      if (result.error) {
        showToast(result.error, 'error');
        return;
      }
      showToast(`Registration ${company.registration_number} (${company.legal_name}) ${decisionLabel(decision)}. The exporter has been notified.`);
      clearSelection();
    } finally {
      setBusy(false);
    }
  };

  const handleExportDecision = async (id: string, decision: ReviewDecision) => {
    const record = exportRecords.find(item => item.id === id);
    if (!record) return;
    if ((decision === 'reject' || decision === 'request_info') && !remarks.trim()) {
      showToast('Please provide remarks explaining the decision before proceeding.', 'error');
      return;
    }
    setBusy(true);
    try {
      const result = await reviewExportRecord(id, decision, remarks.trim() || undefined);
      if (result.error) {
        showToast(result.error, 'error');
        return;
      }
      showToast(`Export record ${record.consignment_number} ${decisionLabel(decision)}. The exporter has been notified.`);
      clearSelection();
    } finally {
      setBusy(false);
    }
  };

  const handleResolve = async (id: string) => {
    const complaint = complaints.find(item => item.id === id);
    if (!complaint) return;
    if (!resolution.trim()) {
      showToast('Please enter a resolution summary before resolving the complaint.', 'error');
      return;
    }
    setBusy(true);
    try {
      const result = await resolveComplaint(id, resolution.trim());
      if (result.error) {
        showToast(result.error, 'error');
        return;
      }
      showToast(`Complaint ${complaint.tracking_number} resolved and closed for further action.`);
      clearSelection();
    } finally {
      setBusy(false);
    }
  };

  const handleEscalate = async (id: string) => {
    const complaint = complaints.find(item => item.id === id);
    if (!complaint) return;
    setBusy(true);
    try {
      const result = await escalateComplaint(id);
      if (result.error) {
        showToast(result.error, 'error');
        return;
      }
      showToast(`Complaint ${complaint.tracking_number} escalated to level ${(complaint.escalation_level || 0) + 1}.`);
      clearSelection();
    } finally {
      setBusy(false);
    }
  };

  const handleAddNote = async (id: string) => {
    if (!note.trim()) {
      showToast('Please enter a note before saving.', 'error');
      return;
    }
    setBusy(true);
    try {
      const result = await addComplaintNote(id, note.trim());
      if (result.error) {
        showToast(result.error, 'error');
        return;
      }
      showToast('Internal note added to the complaint.');
      setNote('');
    } finally {
      setBusy(false);
    }
  };

  const exporterFor = (ownerId: string) => users.find(item => item.id === ownerId);

  const stagePill = (label: string, status: string | undefined, active: boolean) => {
    const value = status?.replace(/_/g, ' ') || 'not started';
    const tone = status === 'reviewed' ? 'border-green-300 bg-green-50'
      : status === 'rejected' ? 'border-red-300 bg-red-50'
        : status === 'not_initiated' ? 'border-gray-200 bg-gray-50'
          : 'border-yellow-300 bg-yellow-50';
    const badge = status === 'reviewed' ? 'bg-green-100 text-green-800'
      : status === 'rejected' ? 'bg-red-100 text-red-800'
        : status === 'not_initiated' ? 'bg-gray-100 text-gray-600'
          : 'bg-yellow-100 text-yellow-800';
    return (
      <div className={`flex-1 p-3 rounded-lg text-sm border-2 ${tone}`}>
        <div className="flex items-center justify-between gap-2">
          <span className="font-medium">{label}</span>
          {active && <span className="text-xs font-semibold text-gov-green-700 uppercase">your stage</span>}
        </div>
        <span className={`badge mt-1 ${badge}`}>{value}</span>
      </div>
    );
  };

  return (
    <DashboardLayout>
      <RoleGuard allow={ROUTE_ROLES['/admin/reviews']}>
        <ToastView />

        <div className="space-y-6">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-2">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">Review &amp; Approval Workspace</h1>
              <p className="text-sm text-gray-500">
                {user?.role === 'super_admin'
                  ? 'Super Admin — you can act on whichever stage is still open.'
                  : `${stageLabel} stage`} — Approve, reject, or request information.
              </p>
            </div>
          </div>

          {/* Tabs */}
          <div className="flex gap-1 bg-gray-100 rounded-lg p-1 w-fit">
            {tabs.map(item => (
              <button
                key={item.key}
                onClick={() => { setTab(item.key); clearSelection(); }}
                className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${tab === item.key ? 'bg-white shadow text-gov-green-600' : 'text-gray-600 hover:text-gray-900'}`}
              >
                <item.icon className="w-4 h-4" />
                {item.label}
                <span className="bg-gov-green-500 text-white text-xs px-1.5 py-0.5 rounded-full">{item.count}</span>
              </button>
            ))}
          </div>

          <div className="grid lg:grid-cols-3 gap-6">
            {/* Queue */}
            <div className="lg:col-span-1">
              <div className="card">
                <div className="p-3 border-b">
                  <h3 className="font-medium text-sm text-gray-700">
                    Pending Queue ({tab === 'registrations' ? pendingRegistrations.length : tab === 'exports' ? pendingExports.length : pendingComplaints.length})
                  </h3>
                </div>
                <div className="divide-y max-h-[600px] overflow-y-auto">
                  {tab === 'registrations' && pendingRegistrations.map(item => (
                    <button
                      key={item.id}
                      onClick={() => selectItem(item.id)}
                      className={`w-full text-left p-3 hover:bg-gray-50 ${selectedItem === item.id ? 'bg-gov-green-50 border-l-4 border-gov-green-500' : ''}`}
                    >
                      <p className="font-medium text-sm text-gray-900">{item.legal_name}</p>
                      <p className="text-xs text-gray-500">{item.registration_number} | {item.province}</p>
                      <div className="flex items-center gap-2 mt-1">
                        <span className={`badge text-xs ${getStatusColor(item.status)}`}>{item.status.replace(/_/g, ' ')}</span>
                        <span className="text-xs text-gray-400">{formatDate(item.created_at)}</span>
                      </div>
                    </button>
                  ))}
                  {tab === 'exports' && pendingExports.map(item => (
                    <button
                      key={item.id}
                      onClick={() => selectItem(item.id)}
                      className={`w-full text-left p-3 hover:bg-gray-50 ${selectedItem === item.id ? 'bg-gov-green-50 border-l-4 border-gov-green-500' : ''}`}
                    >
                      <p className="font-medium text-sm text-gray-900">{item.consignment_number}</p>
                      <p className="text-xs text-gray-500">{item.product} to {item.destination_country}</p>
                      <div className="flex items-center gap-2 mt-1">
                        <span className={`badge text-xs ${getStatusColor(item.status)}`}>{item.status.replace(/_/g, ' ')}</span>
                        <span className="text-xs text-gray-400">{formatDate(item.created_at)}</span>
                      </div>
                    </button>
                  ))}
                  {tab === 'complaints' && pendingComplaints.map(item => (
                    <button
                      key={item.id}
                      onClick={() => selectItem(item.id)}
                      className={`w-full text-left p-3 hover:bg-gray-50 ${selectedItem === item.id ? 'bg-gov-green-50 border-l-4 border-gov-green-500' : ''}`}
                    >
                      <p className="font-medium text-sm text-gray-900">{item.tracking_number}</p>
                      <p className="text-xs text-gray-500">{item.category} - {item.full_name}</p>
                      <div className="flex items-center gap-2 mt-1">
                        <span className={`badge text-xs ${getStatusColor(item.priority)}`}>{item.priority}</span>
                        <span className={`badge text-xs ${getStatusColor(item.status)}`}>{item.status.replace(/_/g, ' ')}</span>
                      </div>
                    </button>
                  ))}
                  {((tab === 'registrations' && pendingRegistrations.length === 0) ||
                    (tab === 'exports' && pendingExports.length === 0) ||
                    (tab === 'complaints' && pendingComplaints.length === 0)) && (
                    <div className="p-8 text-center">
                      <CheckCircle className="w-10 h-10 mx-auto mb-2 text-green-500" />
                      <p className="text-sm font-medium text-gray-700">Queue clear</p>
                      <p className="text-xs text-gray-400 mt-1">All items in this category have been processed.</p>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Detail Panel */}
            <div className="lg:col-span-2">
              {tab === 'registrations' && selectedRegistration ? (
                <div className="card p-6 space-y-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <h2 className="text-xl font-bold text-gray-900">{selectedRegistration.legal_name}</h2>
                      <p className="text-sm text-gray-500">{selectedRegistration.registration_number} | {selectedRegistration.company_type}</p>
                    </div>
                    <span className={`badge ${getStatusColor(selectedRegistration.status)}`}>{selectedRegistration.status.replace(/_/g, ' ')}</span>
                  </div>
                  <div className="grid md:grid-cols-2 gap-4 text-sm">
                    <div><span className="text-gray-500">NTN:</span> <span className="font-medium">{selectedRegistration.ntn || '—'}</span></div>
                    <div><span className="text-gray-500">SECP:</span> <span className="font-medium">{selectedRegistration.secp_number || '—'}</span></div>
                    <div><span className="text-gray-500">Province:</span> <span className="font-medium">{selectedRegistration.province}</span></div>
                    <div><span className="text-gray-500">City / District:</span> <span className="font-medium">{[selectedRegistration.city, selectedRegistration.district].filter(Boolean).join(', ') || '—'}</span></div>
                    <div><span className="text-gray-500">Email:</span> <span className="font-medium">{selectedRegistration.email}</span></div>
                    <div><span className="text-gray-500">Phone:</span> <span className="font-medium">{selectedRegistration.phone}</span></div>
                    <div><span className="text-gray-500">Business Type:</span> <span className="font-medium">{selectedRegistration.nature_of_business}</span></div>
                    <div><span className="text-gray-500">Applicant:</span> <span className="font-medium">{exporterFor(selectedRegistration.owner_id)?.full_name ?? '—'}</span></div>
                    <div className="md:col-span-2"><span className="text-gray-500">Address:</span> <span className="font-medium">{selectedRegistration.address || '—'}</span></div>
                    <div className="md:col-span-2"><span className="text-gray-500">Export categories:</span> <span className="font-medium">{selectedRegistration.main_export_categories.join(', ') || '—'}</span></div>
                  </div>
                  <div>
                    <h4 className="font-medium text-gray-700 mb-2">Review Pipeline</h4>
                    <div className="flex gap-4">
                      {stagePill('TDAP Stage', selectedRegistration.tdap_review_status, registrationStage === 'tdap')}
                      {stagePill('NAFSA Stage', selectedRegistration.nafsa_review_status, registrationStage === 'nafsa')}
                    </div>
                  </div>
                  <div>
                    <h4 className="font-medium text-gray-700 mb-2">Verification Checklist</h4>
                    <div className="space-y-2">
                      {[
                        { label: 'NADRA Verification', status: selectedRegistration.nadra_status },
                        { label: 'SECP Verification', status: selectedRegistration.secp_status },
                        { label: 'NTN/FBR Verification', status: selectedRegistration.ntn_status },
                      ].map(item => (
                        <div key={item.label} className="flex items-center justify-between p-2 bg-gray-50 rounded-lg text-sm">
                          <span>{item.label}</span>
                          <span className={`badge ${item.status === 'verified' ? 'bg-green-100 text-green-800' : 'bg-yellow-100 text-yellow-800'}`}>{item.status}</span>
                        </div>
                      ))}
                    </div>
                    <p className="mt-2 text-xs text-gray-400">Approving at the NAFSA stage marks all three checks verified.</p>
                  </div>
                  <div>
                    <label htmlFor="registration-remarks" className="block font-medium text-gray-700 mb-2">Officer Remarks</label>
                    <textarea
                      id="registration-remarks"
                      value={remarks}
                      onChange={e => setRemarks(e.target.value)}
                      className="input-field"
                      rows={3}
                      placeholder="Add review remarks (required for rejection / info requests)..."
                    />
                  </div>
                  <div className="flex flex-wrap gap-3 pt-4 border-t">
                    <button onClick={() => handleRegistrationDecision(selectedRegistration.id, 'approve')} disabled={busy} className="btn-primary flex items-center gap-2 disabled:opacity-50">
                      <CheckCircle className="w-4 h-4" /> Approve{registrationStage ? ` (${registrationStage.toUpperCase()})` : ''}
                    </button>
                    <button onClick={() => handleRegistrationDecision(selectedRegistration.id, 'reject')} disabled={busy} className="bg-red-500 hover:bg-red-600 text-white font-medium py-2 px-4 rounded-lg flex items-center gap-2 disabled:opacity-50">
                      <XCircle className="w-4 h-4" /> Reject
                    </button>
                    <button onClick={() => handleRegistrationDecision(selectedRegistration.id, 'request_info')} disabled={busy} className="btn-outline flex items-center gap-2 disabled:opacity-50">
                      <MessageSquare className="w-4 h-4" /> Request Info
                    </button>
                  </div>
                </div>
              ) : tab === 'exports' && selectedExport ? (
                <div className="card p-6 space-y-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <h2 className="text-xl font-bold text-gray-900">{selectedExport.consignment_number}</h2>
                      <p className="text-sm text-gray-500">{selectedExport.product} | {selectedExport.quantity} {selectedExport.unit}</p>
                    </div>
                    <span className={`badge ${getStatusColor(selectedExport.status)}`}>{selectedExport.status.replace(/_/g, ' ')}</span>
                  </div>
                  <div className="grid md:grid-cols-2 gap-4 text-sm">
                    <div><span className="text-gray-500">Destination:</span> <span className="font-medium">{selectedExport.destination_country || '—'}</span></div>
                    <div><span className="text-gray-500">Value:</span> <span className="font-medium">{selectedExport.currency} {selectedExport.estimated_value.toLocaleString()}</span></div>
                    <div><span className="text-gray-500">HS Code:</span> <span className="font-medium">{selectedExport.hs_code}</span></div>
                    <div><span className="text-gray-500">Buyer:</span> <span className="font-medium">{selectedExport.buyer_company || '—'}</span></div>
                    <div><span className="text-gray-500">Transport:</span> <span className="font-medium">{[selectedExport.transport_mode, selectedExport.shipping_company].filter(Boolean).join(' via ') || '—'}</span></div>
                    <div><span className="text-gray-500">Departure:</span> <span className="font-medium">{selectedExport.expected_departure ? formatDate(selectedExport.expected_departure) : 'Not specified'}</span></div>
                    <div><span className="text-gray-500">Origin province:</span> <span className="font-medium">{selectedExport.province_of_production || '—'}</span></div>
                    <div><span className="text-gray-500">Exporter:</span> <span className="font-medium">{exporterFor(selectedExport.exporter_id)?.full_name ?? '—'}</span></div>
                  </div>
                  {selectedExport.description && (
                    <div className="text-sm p-3 bg-gray-50 rounded-lg"><span className="text-gray-500">Description:</span> {selectedExport.description}</div>
                  )}
                  <div>
                    <h4 className="font-medium text-gray-700 mb-2">Attached Documents ({selectedExport.documents.length})</h4>
                    {selectedExport.documents.length === 0 ? (
                      <p className="text-sm text-gray-400">No documents were attached to this consignment.</p>
                    ) : (
                      <div className="space-y-2">
                        {selectedExport.documents.map(document => (
                          <div key={document.id} className="flex items-center justify-between p-2 bg-gray-50 rounded-lg text-sm">
                            <span className="truncate">{document.document_type}</span>
                            <span className={`badge ${document.verification_status === 'verified' ? 'bg-green-100 text-green-800' : 'bg-yellow-100 text-yellow-800'}`}>
                              {document.verification_status}
                            </span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                  <div>
                    <h4 className="font-medium text-gray-700 mb-2">Review Pipeline</h4>
                    <div className="flex gap-4">
                      {stagePill('TDAP Stage', selectedExport.tdap_review_status, exportStage === 'tdap')}
                      {stagePill('NAFSA Stage', selectedExport.nafsa_review_status, exportStage === 'nafsa')}
                    </div>
                  </div>
                  <div>
                    <label htmlFor="export-remarks" className="block font-medium text-gray-700 mb-2">Officer Remarks</label>
                    <textarea
                      id="export-remarks"
                      value={remarks}
                      onChange={e => setRemarks(e.target.value)}
                      className="input-field"
                      rows={3}
                      placeholder="Add review remarks (required for rejection / info requests)..."
                    />
                  </div>
                  <div className="flex flex-wrap gap-3 pt-4 border-t">
                    <button onClick={() => handleExportDecision(selectedExport.id, 'approve')} disabled={busy} className="btn-primary flex items-center gap-2 disabled:opacity-50">
                      <CheckCircle className="w-4 h-4" /> Approve{exportStage ? ` (${exportStage.toUpperCase()})` : ''}
                    </button>
                    <button onClick={() => handleExportDecision(selectedExport.id, 'reject')} disabled={busy} className="bg-red-500 hover:bg-red-600 text-white font-medium py-2 px-4 rounded-lg flex items-center gap-2 disabled:opacity-50">
                      <XCircle className="w-4 h-4" /> Reject
                    </button>
                    <button onClick={() => handleExportDecision(selectedExport.id, 'request_info')} disabled={busy} className="btn-outline flex items-center gap-2 disabled:opacity-50">
                      <MessageSquare className="w-4 h-4" /> Request Info
                    </button>
                  </div>
                </div>
              ) : tab === 'complaints' && selectedComplaint ? (
                <div className="card p-6 space-y-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <h2 className="text-xl font-bold text-gray-900">{selectedComplaint.tracking_number}</h2>
                      <p className="text-sm text-gray-500">{selectedComplaint.category} | {selectedComplaint.full_name}</p>
                    </div>
                    <div className="flex gap-2">
                      <span className={`badge ${getStatusColor(selectedComplaint.priority)}`}>{selectedComplaint.priority}</span>
                      <span className={`badge ${getStatusColor(selectedComplaint.status)}`}>{selectedComplaint.status.replace(/_/g, ' ')}</span>
                    </div>
                  </div>
                  <p className="text-sm text-gray-700 whitespace-pre-line">{selectedComplaint.description}</p>
                  <div className="grid md:grid-cols-2 gap-4 text-sm">
                    <div><span className="text-gray-500">Country:</span> <span className="font-medium">{selectedComplaint.country}</span></div>
                    <div><span className="text-gray-500">Product:</span> <span className="font-medium">{selectedComplaint.product || '—'}</span></div>
                    <div><span className="text-gray-500">Exporter named:</span> <span className="font-medium">{selectedComplaint.exporter_company || '—'}</span></div>
                    <div><span className="text-gray-500">Export record:</span> <span className="font-medium">{selectedComplaint.export_record_number || '—'}</span></div>
                    <div><span className="text-gray-500">Contact:</span> <span className="font-medium">{selectedComplaint.email} | {selectedComplaint.phone}</span></div>
                    <div><span className="text-gray-500">Submitted:</span> <span className="font-medium">{formatDateTime(selectedComplaint.created_at)}</span></div>
                    <div><span className="text-gray-500">SLA Deadline:</span> <span className="font-medium">{formatDate(selectedComplaint.sla_deadline)}</span></div>
                    <div><span className="text-gray-500">Escalation level:</span> <span className="font-medium">{selectedComplaint.escalation_level}</span></div>
                  </div>
                  {selectedComplaint.internal_notes && (
                    <div className="p-3 bg-yellow-50 border border-yellow-200 rounded-lg text-sm">
                      <p className="font-medium text-yellow-800 mb-1 flex items-center gap-1"><Info className="w-4 h-4" /> Internal Notes</p>
                      <p className="text-yellow-800 whitespace-pre-line">{selectedComplaint.internal_notes}</p>
                    </div>
                  )}
                  <div>
                    <label htmlFor="complaint-resolution" className="block font-medium text-gray-700 mb-2">Resolution Summary</label>
                    <textarea
                      id="complaint-resolution"
                      value={resolution}
                      onChange={e => setResolution(e.target.value)}
                      className="input-field"
                      rows={3}
                      placeholder="Describe how the complaint was investigated and resolved..."
                    />
                  </div>
                  <div>
                    <label htmlFor="complaint-note" className="block font-medium text-gray-700 mb-2">Add Internal Note</label>
                    <div className="flex gap-2">
                      <textarea
                        id="complaint-note"
                        value={note}
                        onChange={e => setNote(e.target.value)}
                        className="input-field flex-1"
                        rows={2}
                        placeholder="Internal note (visible to officers only)..."
                      />
                      <button onClick={() => handleAddNote(selectedComplaint.id)} disabled={busy} className="btn-outline flex items-center gap-2 self-start disabled:opacity-50">
                        <MessageSquare className="w-4 h-4" /> Add Note
                      </button>
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-3 pt-4 border-t">
                    <button onClick={() => handleResolve(selectedComplaint.id)} disabled={busy} className="btn-primary flex items-center gap-2 disabled:opacity-50">
                      <CheckCircle className="w-4 h-4" /> Resolve
                    </button>
                    <button onClick={() => handleEscalate(selectedComplaint.id)} disabled={busy} className="bg-orange-500 hover:bg-orange-600 text-white font-medium py-2 px-4 rounded-lg flex items-center gap-2 disabled:opacity-50">
                      <AlertTriangle className="w-4 h-4" /> Escalate
                    </button>
                  </div>
                </div>
              ) : (
                <div className="card p-12 text-center text-gray-400">
                  <Eye className="w-12 h-12 mx-auto mb-3" />
                  <p>Select an item from the queue to review</p>
                </div>
              )}
            </div>
          </div>
        </div>
      </RoleGuard>
    </DashboardLayout>
  );
}
