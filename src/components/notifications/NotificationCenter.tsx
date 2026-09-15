'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { useDataStore } from '@/lib/data-store';
import { useAuth } from '@/lib/auth';
import { useToast } from '@/components/ui/Toast';
import { formatDateTime } from '@/lib/utils';
import { Bell, CheckCircle, Info, AlertTriangle, XCircle, Check } from 'lucide-react';

type Filter = 'all' | 'unread';

function iconFor(type: string) {
  switch (type) {
    case 'success': return <CheckCircle className="w-5 h-5 text-green-500" />;
    case 'warning': return <AlertTriangle className="w-5 h-5 text-yellow-500" />;
    case 'error': return <XCircle className="w-5 h-5 text-red-500" />;
    default: return <Info className="w-5 h-5 text-blue-500" />;
  }
}

/**
 * Notification list shared by the admin and dashboard sections. Only the signed
 * in user's notifications are shown, which matters because the demo dataset
 * holds notifications addressed to several accounts.
 */
export default function NotificationCenter() {
  const { notifications, markAllNotificationsRead, isLoaded } = useDataStore();
  const { user } = useAuth();
  const { showToast, ToastView } = useToast();
  const [filter, setFilter] = useState<Filter>('all');
  const [busy, setBusy] = useState(false);

  const mine = useMemo(
    () => notifications
      .filter(item => !user || item.user_id === user.id)
      .slice()
      .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()),
    [notifications, user],
  );
  const unreadCount = mine.filter(item => !item.is_read).length;
  const visible = filter === 'unread' ? mine.filter(item => !item.is_read) : mine;

  const markAllRead = async () => {
    if (unreadCount === 0) {
      showToast('There are no unread notifications.', 'info');
      return;
    }
    setBusy(true);
    try {
      const result = await markAllNotificationsRead();
      if (result.error) {
        showToast(result.error, 'error');
        return;
      }
      showToast(`${unreadCount} notification${unreadCount === 1 ? '' : 's'} marked as read.`);
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <ToastView />
      <div className="space-y-6">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Notification Center</h1>
            <p className="text-gray-500">
              {unreadCount === 0 ? 'You are all caught up' : `${unreadCount} unread notification${unreadCount === 1 ? '' : 's'}`}
            </p>
          </div>
          <div className="flex gap-2">
            <div className="flex gap-1 bg-gray-100 rounded-lg p-1">
              {(['all', 'unread'] as Filter[]).map(value => (
                <button
                  key={value}
                  onClick={() => setFilter(value)}
                  className={`px-3 py-1.5 rounded-lg text-sm font-medium capitalize transition-colors ${filter === value ? 'bg-white shadow text-gov-green-600' : 'text-gray-600'}`}
                >
                  {value}
                </button>
              ))}
            </div>
            <button onClick={markAllRead} disabled={busy || unreadCount === 0} className="btn-outline flex items-center gap-2 disabled:opacity-50">
              <Check className="w-4 h-4" /> Mark All as Read
            </button>
          </div>
        </div>

        <div className="card">
          <div className="divide-y">
            {visible.map(item => (
              <div key={item.id} className={`p-4 flex items-start gap-4 hover:bg-gray-50 ${!item.is_read ? 'bg-blue-50/50' : ''}`}>
                {iconFor(item.type)}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <p className={`text-gray-900 ${!item.is_read ? 'font-bold' : 'font-medium'}`}>{item.title}</p>
                    {!item.is_read && <span className="w-2 h-2 bg-blue-500 rounded-full" aria-label="Unread" />}
                  </div>
                  <p className="text-sm text-gray-600">{item.message}</p>
                  <div className="flex items-center gap-3 mt-1">
                    <p className="text-xs text-gray-400">{formatDateTime(item.created_at)}</p>
                    {item.link && (
                      <Link href={item.link} className="text-xs text-gov-green-600 hover:underline">Open</Link>
                    )}
                  </div>
                </div>
              </div>
            ))}
            {visible.length === 0 && (
              <div className="p-12 text-center text-gray-400">
                <Bell className="w-10 h-10 mx-auto mb-3 text-gray-300" />
                <p className="text-sm">
                  {!isLoaded ? 'Loading notifications…'
                    : filter === 'unread' ? 'No unread notifications.'
                      : 'No notifications yet. Portal activity involving your account will appear here.'}
                </p>
              </div>
            )}
          </div>
        </div>
      </div>
    </>
  );
}
