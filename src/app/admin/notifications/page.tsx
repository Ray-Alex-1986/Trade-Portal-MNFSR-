'use client';

import DashboardLayout from '@/components/layout/DashboardLayout';
import { useDataStore } from '@/lib/data-store';
import { Bell, CheckCircle, Info, AlertTriangle, XCircle, Check } from 'lucide-react';

export default function NotificationsPage() {
  const { notifications, markAllNotificationsRead } = useDataStore();

  const markAllRead = () => markAllNotificationsRead();
  const unreadCount = notifications.filter(n => !n.is_read).length;

  const getIcon = (type: string) => {
    switch (type) {
      case 'success': return <CheckCircle className="w-5 h-5 text-green-500" />;
      case 'warning': return <AlertTriangle className="w-5 h-5 text-yellow-500" />;
      case 'error': return <XCircle className="w-5 h-5 text-red-500" />;
      default: return <Info className="w-5 h-5 text-blue-500" />;
    }
  };

  const allNotifications = [...notifications];

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
