'use client';

import { useState } from 'react';
import DashboardLayout from '@/components/layout/DashboardLayout';
import { mockNotifications } from '@/lib/mock-data';
import { Bell, CheckCircle, Info, AlertTriangle, XCircle, Check } from 'lucide-react';

export default function NotificationsPage() {
  const [notifications, setNotifications] = useState(mockNotifications);

  const markAllRead = () => setNotifications(notifications.map(n => ({ ...n, is_read: true })));
  const unreadCount = notifications.filter(n => !n.is_read).length;

  const getIcon = (type: string) => {
    switch (type) {
      case 'success': return <CheckCircle className="w-5 h-5 text-green-500" />;
      case 'warning': return <AlertTriangle className="w-5 h-5 text-yellow-500" />;
      case 'error': return <XCircle className="w-5 h-5 text-red-500" />;
      default: return <Info className="w-5 h-5 text-blue-500" />;
    }
  };

  const allNotifications = [
    ...notifications,
    { id: 'n6', user_id: 'u1', title: 'New Export Record', message: 'EXP-2025060 submitted by Pak Rice Exports.', type: 'info' as const, is_read: true, link: '/admin/reviews', created_at: '2026-09-07T10:00:00Z' },
    { id: 'n7', user_id: 'u1', title: 'SLA Warning', message: 'Complaint CMP-2025012 approaching SLA deadline.', type: 'warning' as const, is_read: true, link: '/admin/reviews', created_at: '2026-09-06T14:30:00Z' },
    { id: 'n8', user_id: 'u1', title: 'User Registered', message: 'New exporter registration: Heritage Rice Mills.', type: 'info' as const, is_read: true, link: '/admin/users', created_at: '2026-09-05T09:15:00Z' },
    { id: 'n9', user_id: 'u1', title: 'Report Generated', message: 'August 2026 monthly export summary ready.', type: 'success' as const, is_read: true, link: '/admin/reports', created_at: '2026-09-01T08:00:00Z' },
    { id: 'n10', user_id: 'u1', title: 'System Update', message: 'Portal maintenance scheduled for Sep 15.', type: 'info' as const, is_read: true, link: undefined, created_at: '2026-08-30T12:00:00Z' },
  ];

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Notification Center</h1>
            <p className="text-gray-500">{unreadCount} unread notifications</p>
          </div>
          <button onClick={markAllRead} className="btn-outline flex items-center gap-2">
            <Check className="w-4 h-4" /> Mark All as Read
          </button>
        </div>

        <div className="card">
          <div className="divide-y">
            {allNotifications.map(n => (
              <div key={n.id} className={`p-4 flex items-start gap-4 hover:bg-gray-50 ${!n.is_read ? 'bg-blue-50/50' : ''}`}>
                {getIcon(n.type)}
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <p className={`font-medium text-gray-900 ${!n.is_read ? 'font-bold' : ''}`}>{n.title}</p>
                    {!n.is_read && <span className="w-2 h-2 bg-blue-500 rounded-full" />}
                  </div>
                  <p className="text-sm text-gray-600">{n.message}</p>
                  <p className="text-xs text-gray-400 mt-1">{new Date(n.created_at).toLocaleString()}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
}
