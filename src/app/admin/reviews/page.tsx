'use client';

import { useState } from 'react';
import DashboardLayout from '@/components/layout/DashboardLayout';
import { mockCompanies, mockExportRecords, mockComplaints } from '@/lib/mock-data';
import { getStatusColor } from '@/lib/utils';
import { CheckCircle, XCircle, MessageSquare, Eye, Clock, FileText, AlertTriangle } from 'lucide-react';

type Tab = 'registrations' | 'exports' | 'complaints';

export default function ReviewWorkspacePage() {
  const [tab, setTab] = useState<Tab>('registrations');
  const [selectedItem, setSelectedItem] = useState<string | null>(null);
  const [showApproved, setShowApproved] = useState(false);

  const pendingRegistrations = mockCompanies.filter(c => ['submitted', 'under_tdap_review', 'under_nafsa_review'].includes(c.status));
  const pendingExports = mockExportRecords.filter(r => ['submitted', 'under_tdap_review', 'under_nafsa_review'].includes(r.status));
  const pendingComplaints = mockComplaints.filter(c => ['submitted', 'acknowledged', 'under_review', 'assigned', 'investigation'].includes(c.status));

  const tabs = [
    { key: 'registrations' as Tab, label: 'Registrations', count: pendingRegistrations.length, icon: FileText },
    { key: 'exports' as Tab, label: 'Export Records', count: pendingExports.length, icon: Package },
    { key: 'complaints' as Tab, label: 'Complaints', count: pendingComplaints.length, icon: AlertTriangle },
  ];

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <h1 className="text-2xl font-bold text-gray-900">Review & Approval Workspace</h1>

        {/* Tabs */}
        <div className="flex gap-1 bg-gray-100 rounded-lg p-1 w-fit">
          {tabs.map(t => (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
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
                  <div key={item.id} onClick={() => setSelectedItem(item.id)} className={`p-3 cursor-pointer hover:bg-gray-50 ${selectedItem === item.id ? 'bg-gov-green-50 border-l-4 border-gov-green-500' : ''}`}>
                    <p className="font-medium text-sm text-gray-900">{item.legal_name}</p>
                    <p className="text-xs text-gray-500">{item.registration_number} | {item.province}</p>
                    <div className="flex items-center gap-2 mt-1">
                      <span className={`badge text-xs ${getStatusColor(item.status)}`}>{item.status.replace(/_/g, ' ')}</span>
                      <span className="text-xs text-gray-400">{new Date(item.created_at).toLocaleDateString()}</span>
                    </div>
                  </div>
                ))}
                {tab === 'exports' && pendingExports.map(item => (
                  <div key={item.id} onClick={() => setSelectedItem(item.id)} className={`p-3 cursor-pointer hover:bg-gray-50 ${selectedItem === item.id ? 'bg-gov-green-50 border-l-4 border-gov-green-500' : ''}`}>
                    <p className="font-medium text-sm text-gray-900">{item.consignment_number}</p>
                    <p className="text-xs text-gray-500">{item.product} to {item.destination_country}</p>
                    <div className="flex items-center gap-2 mt-1">
                      <span className={`badge text-xs ${getStatusColor(item.status)}`}>{item.status.replace(/_/g, ' ')}</span>
                      <span className="text-xs text-gray-400">{new Date(item.created_at).toLocaleDateString()}</span>
                    </div>
                  </div>
                ))}
                {tab === 'complaints' && pendingComplaints.map(item => (
                  <div key={item.id} onClick={() => setSelectedItem(item.id)} className={`p-3 cursor-pointer hover:bg-gray-50 ${selectedItem === item.id ? 'bg-gov-green-50 border-l-4 border-gov-green-500' : ''}`}>
                    <p className="font-medium text-sm text-gray-900">{item.tracking_number}</p>
                    <p className="text-xs text-gray-500">{item.category} - {item.full_name}</p>
                    <div className="flex items-center gap-2 mt-1">
                      <span className={`badge text-xs ${getStatusColor(item.priority)}`}>{item.priority}</span>
                      <span className={`badge text-xs ${getStatusColor(item.status)}`}>{item.status.replace(/_/g, ' ')}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Detail Panel */}
          <div className="lg:col-span-2">
            {selectedItem ? (
              <div className="card p-6 space-y-6">
                {tab === 'registrations' && (() => {
                  const item = pendingRegistrations.find(r => r.id === selectedItem);
                  if (!item) return null;
                  return (
                    <>
                      <div className="flex items-center justify-between">
                        <div>
                          <h2 className="text-xl font-bold text-gray-900">{item.legal_name}</h2>
                          <p className="text-sm text-gray-500">{item.registration_number} | {item.company_type}</p>
                        </div>
                        <span className={`badge ${getStatusColor(item.status)}`}>{item.status.replace(/_/g, ' ')}</span>
                      </div>
                      <div className="grid md:grid-cols-2 gap-4 text-sm">
                        <div><span className="text-gray-500">NTN:</span> <span className="font-medium">{item.ntn}</span></div>
                        <div><span className="text-gray-500">SECP:</span> <span className="font-medium">{item.secp_number}</span></div>
                        <div><span className="text-gray-500">Province:</span> <span className="font-medium">{item.province}</span></div>
                        <div><span className="text-gray-500">Email:</span> <span className="font-medium">{item.email}</span></div>
                        <div><span className="text-gray-500">Phone:</span> <span className="font-medium">{item.phone}</span></div>
                        <div><span className="text-gray-500">Business Type:</span> <span className="font-medium">{item.nature_of_business}</span></div>
                      </div>
                      <div>
                        <h4 className="font-medium text-gray-700 mb-2">Verification Checklist</h4>
                        <div className="space-y-2">
                          {[
                            { label: 'NADRA Verification', status: item.nadra_status },
                            { label: 'SECP Verification', status: item.secp_status },
                            { label: 'NTN/FBR Verification', status: item.ntn_status },
                          ].map(v => (
                            <div key={v.label} className="flex items-center justify-between p-2 bg-gray-50 rounded-lg text-sm">
                              <span>{v.label}</span>
                              <span className={`badge ${v.status === 'verified' ? 'bg-green-100 text-green-800' : 'bg-yellow-100 text-yellow-800'}`}>{v.status}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                      <div>
                        <h4 className="font-medium text-gray-700 mb-2">Officer Comments</h4>
                        <textarea className="input-field" rows={3} placeholder="Add review comments..." />
                      </div>
                      <div className="flex gap-3 pt-4 border-t">
                        <button onClick={() => setShowApproved(true)} className="btn-primary flex items-center gap-2"><CheckCircle className="w-4 h-4" /> Approve</button>
                        <button className="bg-red-500 hover:bg-red-600 text-white font-medium py-2 px-4 rounded-lg flex items-center gap-2"><XCircle className="w-4 h-4" /> Reject</button>
                        <button className="btn-outline flex items-center gap-2"><MessageSquare className="w-4 h-4" /> Request Info</button>
                      </div>
                      {showApproved && (
                        <div className="p-3 bg-green-50 text-green-700 rounded-lg text-sm flex items-center gap-2">
                          <CheckCircle className="w-4 h-4" /> Registration approved successfully. Exporter will be notified.
                        </div>
                      )}
                    </>
                  );
                })()}
                {tab === 'exports' && (() => {
                  const item = pendingExports.find(r => r.id === selectedItem);
                  if (!item) return null;
                  return (
                    <>
                      <div className="flex items-center justify-between">
                        <div>
                          <h2 className="text-xl font-bold text-gray-900">{item.consignment_number}</h2>
                          <p className="text-sm text-gray-500">{item.product} | {item.quantity} {item.unit}</p>
                        </div>
                        <span className={`badge ${getStatusColor(item.status)}`}>{item.status.replace(/_/g, ' ')}</span>
                      </div>
                      <div className="grid md:grid-cols-2 gap-4 text-sm">
                        <div><span className="text-gray-500">Destination:</span> <span className="font-medium">{item.destination_country}</span></div>
                        <div><span className="text-gray-500">Value:</span> <span className="font-medium">{item.currency} {item.estimated_value.toLocaleString()}</span></div>
                        <div><span className="text-gray-500">HS Code:</span> <span className="font-medium">{item.hs_code}</span></div>
                        <div><span className="text-gray-500">Buyer:</span> <span className="font-medium">{item.buyer_company}</span></div>
                        <div><span className="text-gray-500">Transport:</span> <span className="font-medium">{item.transport_mode} via {item.shipping_company}</span></div>
                        <div><span className="text-gray-500">Departure:</span> <span className="font-medium">{new Date(item.expected_departure).toLocaleDateString()}</span></div>
                      </div>
                      <div className="flex gap-3 pt-4 border-t">
                        <button className="btn-primary flex items-center gap-2"><CheckCircle className="w-4 h-4" /> Approve</button>
                        <button className="bg-red-500 hover:bg-red-600 text-white font-medium py-2 px-4 rounded-lg flex items-center gap-2"><XCircle className="w-4 h-4" /> Reject</button>
                        <button className="btn-outline flex items-center gap-2"><MessageSquare className="w-4 h-4" /> Request Info</button>
                      </div>
                    </>
                  );
                })()}
                {tab === 'complaints' && (() => {
                  const item = pendingComplaints.find(c => c.id === selectedItem);
                  if (!item) return null;
                  return (
                    <>
                      <div className="flex items-center justify-between">
                        <div>
                          <h2 className="text-xl font-bold text-gray-900">{item.tracking_number}</h2>
                          <p className="text-sm text-gray-500">{item.category} | {item.full_name}</p>
                        </div>
                        <div className="flex gap-2">
                          <span className={`badge ${getStatusColor(item.priority)}`}>{item.priority}</span>
                          <span className={`badge ${getStatusColor(item.status)}`}>{item.status.replace(/_/g, ' ')}</span>
                        </div>
                      </div>
                      <p className="text-sm text-gray-700">{item.description}</p>
                      <div className="grid md:grid-cols-2 gap-4 text-sm">
                        <div><span className="text-gray-500">Country:</span> <span className="font-medium">{item.country}</span></div>
                        <div><span className="text-gray-500">Product:</span> <span className="font-medium">{item.product}</span></div>
                        <div><span className="text-gray-500">SLA Deadline:</span> <span className="font-medium">{new Date(item.sla_deadline).toLocaleDateString()}</span></div>
                        <div><span className="text-gray-500">Days Pending:</span> <span className="font-medium">{item.days_pending}</span></div>
                      </div>
                      <div className="flex gap-3 pt-4 border-t">
                        <button className="btn-primary flex items-center gap-2"><CheckCircle className="w-4 h-4" /> Resolve</button>
                        <button className="bg-orange-500 hover:bg-orange-600 text-white font-medium py-2 px-4 rounded-lg flex items-center gap-2"><AlertTriangle className="w-4 h-4" /> Escalate</button>
                        <button className="btn-outline flex items-center gap-2"><MessageSquare className="w-4 h-4" /> Add Note</button>
                      </div>
                    </>
                  );
                })()}
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
    </DashboardLayout>
  );
}

// Need to import Package at the top
const Package = ({ className }: { className?: string }) => (
  <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}><path d="m7.5 4.27 9 5.15"/><path d="M21 8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16Z"/><path d="m3.3 7 8.7 5 8.7-5"/><path d="M12 22V12"/></svg>
);
