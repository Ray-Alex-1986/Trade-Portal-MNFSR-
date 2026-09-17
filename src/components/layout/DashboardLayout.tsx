'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import DemoModeNotice from '@/components/DemoModeNotice';
import GovtLogo from '@/components/GovtLogo';
import { useAuth } from '@/lib/auth';
import { useDataStore } from '@/lib/data-store';
import { getNavForRole, getNotificationsPath, ROLE_LABELS } from '@/lib/permissions';
import { usePortalBackend } from '@/lib/portal-backend';
import { cn } from '@/lib/utils';
import {
  LogOut, Menu, Bell, Search, Moon, Sun, Database, X,
} from 'lucide-react';

const DARK_MODE_KEY = 'export_portal_dark_mode';

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const { user, logout } = useAuth();
  const { notifications } = useDataStore();
  const backend = usePortalBackend();
  const pathname = usePathname();
  const router = useRouter();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [darkMode, setDarkMode] = useState(false);
  const [search, setSearch] = useState('');

  const navItems = getNavForRole(user?.role);
  const notificationsPath = getNotificationsPath(user?.role);

  const unreadCount = useMemo(
    () => notifications.filter(item => !item.is_read && (!user || item.user_id === user.id)).length,
    [notifications, user],
  );

  // Remember the theme choice across page loads.
  useEffect(() => {
    try {
      setDarkMode(localStorage.getItem(DARK_MODE_KEY) === 'true');
    } catch { /* storage unavailable */ }
  }, []);

  const toggleDarkMode = () => {
    setDarkMode(previous => {
      const next = !previous;
      try { localStorage.setItem(DARK_MODE_KEY, String(next)); } catch { /* ignore */ }
      return next;
    });
  };

  const handleLogout = async () => {
    await logout();
    router.push('/');
  };

  const handleSearch = (event: React.FormEvent) => {
    event.preventDefault();
    const query = search.trim();
    if (!query) return;
    // Consignment numbers and products live on the export records screen;
    // complaint tracking numbers on the complaints screen.
    const target = /^cmp/i.test(query) ? '/dashboard/complaints' : '/dashboard/exports';
    router.push(`${target}?q=${encodeURIComponent(query)}`);
    setSidebarOpen(false);
  };

  return (
    <div className={cn('min-h-screen', darkMode && 'dark')}>
      <div className="flex h-screen bg-gray-50 dark:bg-gray-900">
        {/* Sidebar */}
        <aside className={cn(
          'fixed inset-y-0 left-0 z-50 w-64 bg-gov-green-500 text-white transform transition-transform lg:relative lg:translate-x-0',
          sidebarOpen ? 'translate-x-0' : '-translate-x-full'
        )}>
          <div className="flex flex-col h-full">
            {/* Logo */}
            <div className="flex items-center gap-3 px-4 py-5 border-b border-gov-green-600">
              <Link href="/" className="flex-shrink-0" aria-label="Export Portal home">
                <GovtLogo size={40} ring />
              </Link>
              <div className="min-w-0">
                <p className="font-bold text-sm leading-tight">Export Portal</p>
                <p className="text-xs text-gov-green-200">Government of Pakistan</p>
              </div>
              <button
                onClick={() => setSidebarOpen(false)}
                aria-label="Close navigation"
                className="ml-auto p-1 rounded hover:bg-white/10 lg:hidden"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Nav Items */}
            <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
              {navItems.map(item => (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={() => setSidebarOpen(false)}
                  className={cn(
                    'flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-colors',
                    pathname === item.href
                      ? 'bg-white/20 text-white font-medium'
                      : 'text-gov-green-100 hover:bg-white/10'
                  )}
                >
                  <item.icon className="w-5 h-5 flex-shrink-0" />
                  <span className="truncate">{item.label}</span>
                  {item.href === notificationsPath && unreadCount > 0 && (
                    <span className="ml-auto bg-gov-gold-400 text-gray-900 text-xs font-bold px-1.5 rounded-full">{unreadCount}</span>
                  )}
                </Link>
              ))}
            </nav>

            {/* User Info */}
            <div className="p-4 border-t border-gov-green-600">
              <div className="flex items-center gap-3 mb-3">
                <div className="w-8 h-8 bg-gov-gold-400 rounded-full flex items-center justify-center text-gray-900 font-bold text-sm flex-shrink-0">
                  {user?.full_name?.charAt(0)?.toUpperCase() ?? '?'}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">{user?.full_name ?? 'Signed out'}</p>
                  <p className="text-xs text-gov-green-200 truncate">{user ? ROLE_LABELS[user.role] : '—'}</p>
                </div>
              </div>
              <button
                onClick={handleLogout}
                className="flex items-center gap-2 w-full px-3 py-2 text-sm text-gov-green-100 hover:bg-white/10 rounded-lg transition-colors"
              >
                <LogOut className="w-4 h-4" />
                Sign Out
              </button>
            </div>
          </div>
        </aside>

        {/* Overlay */}
        {sidebarOpen && (
          <div className="fixed inset-0 bg-black/50 z-40 lg:hidden" onClick={() => setSidebarOpen(false)} />
        )}

        {/* Main Content */}
        <div className="flex-1 flex flex-col min-w-0">
          {/* Top Bar */}
          <header className="flex items-center justify-between px-4 py-3 bg-white dark:bg-gray-800 border-b dark:border-gray-700 shadow-sm">
            <div className="flex items-center gap-3">
              <button
                onClick={() => setSidebarOpen(true)}
                aria-label="Open navigation"
                className="lg:hidden p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700"
              >
                <Menu className="w-5 h-5" />
              </button>
              <form onSubmit={handleSearch} className="hidden md:flex items-center gap-2 bg-gray-100 dark:bg-gray-700 rounded-lg px-3 py-2 w-80">
                <Search className="w-4 h-4 text-gray-400" />
                <input
                  type="search"
                  value={search}
                  onChange={event => setSearch(event.target.value)}
                  placeholder="Search consignments or complaints..."
                  aria-label="Search consignments or complaints"
                  className="bg-transparent border-none outline-none text-sm flex-1 dark:text-white"
                />
              </form>
            </div>
            <div className="flex items-center gap-3">
              {backend === 'mock' && (
                <span className="flex items-center gap-1 px-2 py-1 bg-yellow-100 text-yellow-800 rounded-full text-xs font-medium" title="Local demo data — no database is connected">
                  <Database className="w-3 h-3" />
                  Demo Mode
                </span>
              )}
              <button
                onClick={toggleDarkMode}
                aria-label={darkMode ? 'Switch to light mode' : 'Switch to dark mode'}
                className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700"
              >
                {darkMode ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}
              </button>
              <Link
                href={notificationsPath}
                aria-label={`Notifications${unreadCount > 0 ? `, ${unreadCount} unread` : ''}`}
                className="relative p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700"
              >
                <Bell className="w-5 h-5" />
                {unreadCount > 0 && (
                  <span className="absolute -top-0.5 -right-0.5 min-w-[1.1rem] h-[1.1rem] px-1 bg-red-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center">
                    {unreadCount > 9 ? '9+' : unreadCount}
                  </span>
                )}
              </Link>
            </div>
          </header>

          {/* Page Content */}
          <DemoModeNotice />

          {/* pb-28 keeps the floating assistant from covering the last row of a list */}
          <main className="flex-1 overflow-y-auto p-4 md:p-6 pb-28 md:pb-28">
            {children}
          </main>
        </div>
      </div>
    </div>
  );
}
