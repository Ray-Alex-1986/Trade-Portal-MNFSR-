'use client';

import { useState } from 'react';
import DashboardLayout from '@/components/layout/DashboardLayout';
import RoleGuard from '@/components/auth/RoleGuard';
import { useDataStore, ReviewDecision } from '@/lib/data-store';
import { useAuth } from '@/lib/auth';
import { getReviewStage, ROUTE_ROLES } from '@/lib/permissions';
import { getStatusColor } from '@/lib/utils';
import { CheckCircle, XCircle, MessageSquare, Eye, FileText, AlertTriangle, Package, Info } from 'lucide-react';

type Tab = 'registrations' | 'exports' | 'complaints';

export default function ReviewWorkspacePage() {
  const {
    companies, exportRecords, complaints,
    reviewRegistration, reviewExportRecord,
    resolveComplaint, escalateComplaint, addComplaintNote,
  } = useDataStore();
  const { user } = useAuth();
  const myStage = getReviewStage(user?.role);

  const [tab, setTab] = useState<Tab>('registrations');
  const [selectedItem, setSelectedItem] = useState<string | null>(null);
  const [remarks, setRemarks] = useState('');
  const [resolution, setResolution] = useState('');
  const [note, setNote] = useState('');
  const [toast, setToast] = useState<{ msg: string; type: 'success' | 'error' | 'info' } | null>(null);

  const showToast = (msg: string, type: 'success' | 'error' | 'info' = 'success') => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3500);
  };

  // Filter by review stage: TDAP sees 'submitted', NAFSA sees 'under_nafsa_review', Super Admin sees all
  const pendingRegistrations = companies.filter(c => {
    if (user?.role === 'super_admin') return ['submitted', 'under_nafsa_review', 'additional_info_required'].includes(c.status);
    if (myStage === 'tdap') return c.status === 'submitted';
    if (myStage === 'nafsa') return c.status === 'under_nafsa_review';
    return false;
  });
  const pendingExports = exportRecords.filter(r => {
    if (user?.role === 'super_admin') return ['submitted', 'under_nafsa_review', 'additional_info_required'].includes(r.status);
    if (myStage === 'tdap') return r.status === 'submitted';
    if (myStage === 'nafsa') return r.status === 'under_nafsa_review';
    return false;
  });
  const pendingComplaints = complaints.filter(c => ['submitted', 'acknowledged', 'under_review', 'assigned', 'investigation', 'escalated'].includes(c.status));

  const stageLabel = myStage === 'tdap' ? 'TDAP' : myStage === 'nafsa' ? 'NAFSA' : 'All';

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

  const decisionLabel = (decision: ReviewDecision) =>
    decision === 'approve' ? 'approved' : decision === 'reject' ? 'rejected' : 'marked for additional information';

  const handleRegistrationDecision = (id: string, decision: ReviewDecision) => {
    const company = companies.find(c => c.id === id);
    if (!company) return;
    if ((decision === 'reject' || decision === 'request_info') && !remarks.trim()) {
      showToast('Please provide remarks explaining the decision before proceeding.', 'error');
      return;
    }
    reviewRegistration(id, decision, remarks.trim() || undefined);
    showToast(`Registration ${company.registration_number} (${company.legal_name}) ${decisionLabel(decision)}. The exporter has been notified.`);
    clearSelection();
  };

  const handleExportDecision = (id: string, decision: ReviewDecision) => {
    const record = exportRecords.find(r => r.id === id);
    if (!record) return;
    if ((decision === 'reject' || decision === 'request_info') && !remarks.trim()) {
      showToast('Please provide remarks explaining the decision before proceeding.', 'error');
      return;
    }
    reviewExportRecord(id, decision, remarks.trim() || undefined);
    showToast(`Export record ${record.consignment_number} ${decisionLabel(decision)}. The exporter has been notified.`);
    clearSelection();
  };

  const handleResolve = (id: string) => {
    const complaint = complaints.find(c => c.id === id);
    if (!complaint) return;
    if (!resolution.trim()) {
      showToast('Please enter a resolution summary before resolving the complaint.', 'error');
      return;
    }
    resolveComplaint(id, resolution.trim());
    showToast(`Complaint ${complaint.tracking_number} resolved and closed for further action.`);
    clearSelection();
  };

  const handleEscalate = (id: string) => {
    const complaint = complaints.find(c => c.id === id);
    if (!complaint) return;
    escalateComplaint(id);
    showToast(`Complaint ${complaint.tracking_number} escalated to level ${(complaint.escalation_level || 0) + 1}.`);
    clearSelection();
  };

  const handleAddNote = (id: string) => {
    const complaint = complaints.find(c => c.id === id);
    if (!complaint) return;
    if (!note.trim()) {
      showToast('Please enter a note before saving.', 'error');
      return;
    }
    addComplaintNote(id, note.trim());
    showToast('Internal note added to the complaint.');
    setNote('');
  };

  const selectedRegistration = pendingRegistrations.find(r => r.id === selectedItem);
  const selectedExport = pendingExports.find(r => r.id === selectedItem);
  const selectedComplaint = pendingComplaints.find(c => c.id === selectedItem);

  return (
    <DashboardLayout>
      <RoleGuard allow={ROUTE_ROLES['/admin/reviews']}>
      {toast && (
        <div className={`fixed top-4 right-4 z-50 flex items-center gap-2 px-4 py-3 rounded-lg shadow-lg max-w-md ${toast.type === 'error' ? 'bg-red-600' : toast.type === 'info' ? 'bg-blue-600' : 'bg-green-600'} text-white`}>
          {toast.type === 'error' ? <AlertTriangle className="w-4 h-4 flex-shrink-0" /> : <CheckCircle className="w-4 h-4 flex-shrink-0" />}
          <span className="text-sm">{toast.msg}</span>
        </div>
      )}

      <div className="space-y-6">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-2">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Review &amp; Approval Workspace</h1>
            <p className="text-sm text-gray-500">
              {user?.role === 'super_admin' ? 'Super Admin — viewing all stages.' : `${stageLabel} Stage`} — Approve, reject, or request information.
            </p>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex gap-1 bg-gray-100 rounded-lg p-1 w-fit">
          {tabs.map(t => (
            <button
              key={t.key}
              onClick={() => { setTab(t.key); clearSelection(); }}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${tab === t.key ? 'bg-white shadow text-gov-green-600' : 'text-gray-600 hover:text-gray-900'}`}
            >
              <t.icon className="w-4 h-4" />
              {t.label}
              <span className="bg-gov-green-500 text-white text-xs px-1.5 py-0.5 rounded-full">{t.count}</span>
            </button>
          ))}
        </div>

        <div className="grid lg:grid-cols-3 gap-6">
          {/* Queue */}
          <div className="lg:col-span-1">
            <div className="card">
              <div className="p-3 border-b">
                <h3 className="font-medium text-sm text-gray-700">Pending Queue ({tab === 'registrations' ? pendingRegistrations.length : tab === 'exports' ? pendingExports.length : pendingComplaints.length})</h3>
              </div>
              <div className="divide-y max-h-[600px] overflow-y-auto">
                {tab === 'registrations' && pendingRegistrations.map(item => (
                  <div key={item.id} onClick={() => { setSelectedItem(item.id); setRemarks(''); setResolution(''); setNote(''); }} className={`p-3 cursor-pointer hover:bg-gray-50 ${selectedItem === item.id ? 'bg-gov-green-50 border-l-4 border-gov-green-500' : ''}`}>
                    <p className="font-medium text-sm text-gray-900">{item.legal_name}</p>
                    <p className="text-xs text-gray-500">{item.registration_number} | {item.province}</p>
                    <div className="flex items-center gap-2 mt-1">
                      <span className={`badge text-xs ${getStatusColor(item.status)}`}>{item.status.replace(/_/g, ' ')}</span>
                      <span className="text-xs text-gray-400">{new Date(item.created_at).toLocaleDateString()}</span>
                    </div>
                  </div>
                ))}
                {tab === 'exports' && pendingExports.map(item => (
                  <div key={item.id} onClick={() => { setSelectedItem(item.id); setRemarks(''); setResolution(''); setNote(''); }} className={`p-3 cursor-pointer hover:bg-gray-50 ${selectedItem === item.id ? 'bg-gov-green-50 border-l-4 border-gov-green-500' : ''}`}>
                    <p className="font-medium text-sm text-gray-900">{item.consignment_number}</p>
                    <p className="text-xs text-gray-500">{item.product} to {item.destination_country}</p>
                    <div className="flex items-center gap-2 mt-1">
                      <span className={`badge text-xs ${getStatusColor(item.status)}`}>{item.status.replace(/_/g, ' ')}</span>
                      <span className="text-xs text-gray-400">{new Date(item.created_at).toLocaleDateString()}</span>
                    </div>
                  </div>
                ))}
                {tab === 'complaints' && pendingComplaints.map(item => (
                  <div key={item.id} onClick={() => { setSelectedItem(item.id); setRemarks(''); setResolution(''); setNote(''); }} className={`p-3 cursor-pointer hover:bg-gray-50 ${selectedItem === item.id ? 'bg-gov-green-50 border-l-4 border-gov-green-500' : ''}`}>
                    <p className="font-medium text-sm text-gray-900">{item.tracking_number}</p>
                    <p className="text-xs text-gray-500">{item.category} - {item.full_name}</p>
                    <div className="flex items-center gap-2 mt-1">
                      <span className={`badge text-xs ${getStatusColor(item.priority)}`}>{item.priority}</span>
                      <span className={`badge text-xs ${getStatusColor(item.status)}`}>{item.status.replace(/_/g, ' ')}</span>
                    </div>
                  </div>
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
                  <div><span className="text-gray-500">NTN:</span> <span className="font-medium">{selectedRegistration.ntn}</span></div>
                  <div><span className="text-gray-500">SECP:</span> <span className="font-medium">{selectedRegistration.secp_number}</span></div>
                  <div><span className="text-gray-500">Province:</span> <span className="font-medium">{selectedRegistration.province}</span></div>
                  <div><span className="text-gray-500">Email:</span> <span className="font-medium">{selectedRegistration.email}</span></div>
                  <div><span className="text-gray-500">Phone:</span> <span className="font-medium">{selectedRegistration.phone}</span></div>
                  <div><span className="text-gray-500">Business Type:</span> <span className="font-medium">{selectedRegistration.nature_of_business}</span></div>
                </div>
                <div>
                  <h4 className="font-medium text-gray-700 mb-2">Review Pipeline</h4>
                  <div className="flex gap-4">
                    <div className={`flex-1 p-3 rounded-lg text-sm border-2 ${selectedRegistration.tdap_review_status === 'reviewed' ? 'border-green-300 bg-green-50' : selectedRegistration.tdap_review_status === 'rejected' ? 'border-red-300 bg-red-50' : 'border-yellow-300 bg-yellow-50'}`}>
                      <span className="font-medium">TDAP Stage</span>
                      <span className={`badge ml-2 ${selectedRegistration.tdap_review_status === 'reviewed' ? 'bg-green-100 text-green-800' : selectedRegistration.tdap_review_status === 'rejected' ? 'bg-red-100 text-red-800' : 'bg-yellow-100 text-yellow-800'}`}>{selectedRegistration.tdap_review_status?.replace(/_/g, ' ') || 'pending'}</span>
                    </div>
                    <div className={`flex-1 p-3 rounded-lg text-sm border-2 ${selectedRegistration.nafsa_review_status === 'reviewed' ? 'border-green-300 bg-green-50' : selectedRegistration.nafsa_review_status === 'rejected' ? 'border-red-300 bg-red-50' : selectedRegistration.nafsa_review_status === 'not_initiated' ? 'border-gray-200 bg-gray-50' : 'border-yellow-300 bg-yellow-50'}`}>
                      <span className="font-medium">NAFSA Stage</span>
                      <span className={`badge ml-2 ${selectedRegistration.nafsa_review_status === 'reviewed' ? 'bg-green-100 text-green-800' : selectedRegistration.nafsa_review_status === 'rejected' ? 'bg-red-100 text-red-800' : selectedRegistration.nafsa_review_status === 'not_initiated' ? 'bg-gray-100 text-gray-600' : 'bg-yellow-100 text-yellow-800'}`}>{selectedRegistration.nafsa_review_status?.replace(/_/g, ' ') || 'not started'}</span>
                    </div>
                  </div>
                </div>
                <div>
                  <h4 className="font-medium text-gray-700 mb-2">Verification Checklist</h4>
                  <div className="space-y-2">
                    {[
                      { label: 'NADRA Verification', status: selectedRegistration.nadra_status },
                      { label: 'SECP Verification', status: selectedRegistration.secp_status },
                      { label: 'NTN/FBR Verification', status: selectedRegistration.ntn_status },
                    ].map(v => (
                      <div key={v.label} className="flex items-center justify-between p-2 bg-gray-50 rounded-lg text-sm">
                        <span>{v.label}</span>
                        <span className={`badge ${v.status === 'verified' ? 'bg-green-100 text-green-800' : 'bg-yellow-100 text-yellow-800'}`}>{v.status}</span>
                      </div>
                    ))}
                  </div>
                </div>
                <div>
                  <h4 className="font-medium text-gray-700 mb-2">Officer Remarks</h4>
                  <textarea value={remarks} onChange={e => setRemarks(e.target.value)} className="input-field" rows={3} placeholder="Add review remarks (required for rejection / info requests)..." />
                </div>
                <div className="flex gap-3 pt-4 border-t">
                  <button onClick={() => handleRegistrationDecision(selectedRegistration.id, 'approve')} className="btn-primary flex items-center gap-2"><CheckCircle className="w-4 h-4" /> Approve</button>
                  <button onClick={() => handleRegistrationDecision(selectedRegistration.id, 'reject')} className="bg-red-500 hover:bg-red-600 text-white font-medium py-2 px-4 rounded-lg flex items-center gap-2"><XCircle className="w-4 h-4" /> Reject</button>
                  <button onClick={() => handleRegistrationDecision(selectedRegistration.id, 'request_info')} className="btn-outline flex items-center gap-2"><MessageSquare className="w-4 h-4" /> Request Info</button>
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
                  <div><span className="text-gray-500">Destination:</span> <span className="font-medium">{selectedExport.destination_country}</span></div>
                  <div><span className="text-gray-500">Value:</span> <span className="font-medium">{selectedExport.currency} {selectedExport.estimated_value.toLocaleString()}</span></div>
                  <div><span className="text-gray-500">HS Code:</span> <span className="font-medium">{selectedExport.hs_code}</span></div>
                  <div><span className="text-gray-500">Buyer:</span> <span className="font-medium">{selectedExport.buyer_company}</span></div>
                  <div><span className="text-gray-500">Transport:</span> <span className="font-medium">{selectedExport.transport_mode} via {selectedExport.shipping_company}</span></div>
                  <div><span className="text-gray-500">Departure:</span> <span className="font-medium">{selectedExport.expected_departure ? new Date(selectedExport.expected_departure).toLocaleDateString() : 'Not specified'}</span></div>
                </div>
                {selectedExport.description && (
                  <div className="text-sm p-3 bg-gray-50 rounded-lg"><span className="text-gray-500">Description:</span> {selectedExport.description}</div>
                )}
                <div>
                  <h4 className="font-medium text-gray-700 mb-2">Review Pipeline</h4>
                  <div className="flex gap-4">
                    <div className={`flex-1 p-3 rounded-lg text-sm border-2 ${selectedExport.tdap_review_status === 'reviewed' ? 'border-green-300 bg-green-50' : selectedExport.tdap_review_status === 'rejected' ? 'border-red-300 bg-red-50' : 'border-yellow-300 bg-yellow-50'}`}>
                      <span className="font-medium">TDAP Stage</span>
                      <span className={`badge ml-2 ${selectedExport.tdap_review_status === 'reviewed' ? 'bg-green-100 text-green-800' : selectedExport.tdap_review_status === 'rejected' ? 'bg-red-100 text-red-800' : 'bg-yellow-100 text-yellow-800'}`}>{selectedExport.tdap_review_status?.replace(/_/g, ' ') || 'pending'}</span>
                    </div>
                    <div className={`flex-1 p-3 rounded-lg text-sm border-2 ${selectedExport.nafsa_review_status === 'reviewed' ? 'border-green-300 bg-green-50' : selectedExport.nafsa_review_status === 'rejected' ? 'border-red-300 bg-red-50' : selectedExport.nafsa_review_status === 'not_initiated' ? 'border-gray-200 bg-gray-50' : 'border-yellow-300 bg-yellow-50'}`}>
                      <span className="font-medium">NAFSA Stage</span>
                      <span className={`badge ml-2 ${selectedExport.nafsa_review_status === 'reviewed' ? 'bg-green-100 text-green-800' : selectedExport.nafsa_review_status === 'rejected' ? 'bg-red-100 text-red-800' : selectedExport.nafsa_review_status === 'not_initiated' ? 'bg-gray-100 text-gray-600' : 'bg-yellow-100 text-yellow-800'}`}>{selectedExport.nafsa_review_status?.replace(/_/g, ' ') || 'not started'}</span>
                    </div>
                  </div>
                </div>
                <div>
                  <h4 className="font-medium text-gray-700 mb-2">Officer Remarks</h4>
                  <textarea value={remarks} onChange={e => setRemarks(e.target.value)} className="input-field" rows={3} placeholder="Add review remarks (required for rejection / info requests)..." />
                </div>
                <div className="flex gap-3 pt-4 border-t">
                  <button onClick={() => handleExportDecision(selectedExport.id, 'approve')} className="btn-primary flex items-center gap-2"><CheckCircle className="w-4 h-4" /> Approve</button>
                  <button onClick={() => handleExportDecision(selectedExport.id, 'reject')} className="bg-red-500 hover:bg-red-600 text-white font-medium py-2 px-4 rounded-lg flex items-center gap-2"><XCircle className="w-4 h-4" /> Reject</button>
                  <button onClick={() => handleExportDecision(selectedExport.id, 'request_info')} className="btn-outline flex items-center gap-2"><MessageSquare className="w-4 h-4" /> Request Info</button>
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
                <p className="text-sm text-gray-700">{selectedComplaint.description}</p>
                <div className="grid md:grid-cols-2 gap-4 text-sm">
                  <div><span className="text-gray-500">Country:</span> <span className="font-medium">{selectedComplaint.country}</span></div>
                  <div><span className="text-gray-500">Product:</span> <span className="font-medium">{selectedComplaint.product || '-'}</span></div>
                  <div><span className="text-gray-500">SLA Deadline:</span> <span className="font-medium">{new Date(selectedComplaint.sla_deadline).toLocaleDateString()}</span></div>
                  <div><span className="text-gray-500">Days Pending:</span> <span className="font-medium">{selectedComplaint.days_pending}</span></div>
                </div>
                {selectedComplaint.internal_notes && (
                  <div className="p-3 bg-yellow-50 border border-yellow-200 rounded-lg text-sm">
                    <p className="font-medium text-yellow-800 mb-1 flex items-center gap-1"><Info className="w-4 h-4" /> Internal Notes</p>
                    <p className="text-yellow-800 whitespace-pre-line">{selectedComplaint.internal_notes}</p>
                  </div>
                )}
                <div>
                  <h4 className="font-medium text-gray-700 mb-2">Resolution Summary</h4>
                  <textarea value={resolution} onChange={e => setResolution(e.target.value)} className="input-field" rows={3} placeholder="Describe how the complaint was investigated and resolved..." />
                </div>
                <div>
                  <h4 className="font-medium text-gray-700 mb-2">Add Internal Note</h4>
                  <div className="flex gap-2">
                    <textarea value={note} onChange={e => setNote(e.target.value)} className="input-field flex-1" rows={2} placeholder="Internal note (visible to officers only)..." />
                    <button onClick={() => handleAddNote(selectedComplaint.id)} className="btn-outline flex items-center gap-2 self-start"><MessageSquare className="w-4 h-4" /> Add Note</button>
                  </div>
                </div>
                <div className="flex gap-3 pt-4 border-t">
                  <button onClick={() => handleResolve(selectedComplaint.id)} className="btn-primary flex items-center gap-2"><CheckCircle className="w-4 h-4" /> Resolve</button>
                  <button onClick={() => handleEscalate(selectedComplaint.id)} className="bg-orange-500 hover:bg-orange-600 text-white font-medium py-2 px-4 rounded-lg flex items-center gap-2"><AlertTriangle className="w-4 h-4" /> Escalate</button>
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
