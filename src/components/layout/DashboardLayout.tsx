'use client';

import { useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useAuth, isAdmin } from '@/lib/auth';
import { cn } from '@/lib/utils';
import {
  LayoutDashboard, FileText, Package, AlertTriangle, Users, Settings,
  ClipboardList, BarChart3, Bell, Shield, BookOpen, LogOut, Menu, X,
  ChevronDown, Building2, FileCheck, Search, Moon, Sun, Database
} from 'lucide-react';

const exporterNav = [
  { href: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/dashboard/exports', label: 'Export Records', icon: Package },
  { href: '/dashboard/exports/new', label: 'New Export Record', icon: FileText },
  { href: '/dashboard/complaints', label: 'My Complaints', icon: AlertTriangle },
];

const adminNav = [
  { href: '/admin', label: 'Admin Dashboard', icon: LayoutDashboard },
  { href: '/admin/reviews', label: 'Review Workspace', icon: ClipboardList },
  { href: '/admin/users', label: 'User Management', icon: Users },
  { href: '/admin/reports', label: 'Reports Center', icon: BarChart3 },
  { href: '/admin/master-data', label: 'Master Data', icon: Database },
  { href: '/admin/audit-logs', label: 'Audit Logs', icon: Shield },
  { href: '/admin/notifications', label: 'Notifications', icon: Bell },
];

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const { user, logout } = useAuth();
  const pathname = usePathname();
  const router = useRouter();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [darkMode, setDarkMode] = useState(false);

  const userIsAdmin = isAdmin(user?.role ?? null);
  const navItems = userIsAdmin ? adminNav : exporterNav;

  const handleLogout = async () => {
    await logout();
    router.push('/');
  };

  const roleLabel: Record<string, string> = {
    super_admin: 'MNFSR Super Admin',
    moc_admin: 'MoC Admin',
    tdap_admin: 'TDAP Admin',
    tdap_officer: 'TDAP Officer',
    nafsa_admin: 'NAFSA Admin',
    nafsa_officer: 'NAFSA Officer',
    tic: 'Trade & Investment Counsellor',
    exporter: 'Exporter/Trader',
    buyer: 'Buyer/Importer',
    auditor: 'Auditor/Viewer',
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
              <div className="w-10 h-10 bg-white rounded-full flex items-center justify-center">
                <Building2 className="w-6 h-6 text-gov-green-500" />
              </div>
              <div>
                <p className="font-bold text-sm leading-tight">Export Portal</p>
                <p className="text-xs text-gov-green-200">MNFSR | MoC</p>
              </div>
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
                  <item.icon className="w-5 h-5" />
                  {item.label}
                </Link>
              ))}
            </nav>

            {/* User Info */}
            <div className="p-4 border-t border-gov-green-600">
              <div className="flex items-center gap-3 mb-3">
                <div className="w-8 h-8 bg-gov-gold-400 rounded-full flex items-center justify-center text-gray-900 font-bold text-sm">
                  {user?.full_name?.charAt(0)}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">{user?.full_name}</p>
                  <p className="text-xs text-gov-green-200 truncate">{roleLabel[user?.role || 'exporter']}</p>
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
              <button onClick={() => setSidebarOpen(true)} className="lg:hidden p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700">
                <Menu className="w-5 h-5" />
              </button>
              <div className="hidden md:flex items-center gap-2 bg-gray-100 dark:bg-gray-700 rounded-lg px-3 py-2 w-80">
                <Search className="w-4 h-4 text-gray-400" />
                <input
                  type="text"
                  placeholder="Search records, complaints, companies..."
                  className="bg-transparent border-none outline-none text-sm flex-1 dark:text-white"
                />
              </div>
            </div>
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-1 px-2 py-1 bg-yellow-100 text-yellow-800 rounded-full text-xs font-medium">
                <Database className="w-3 h-3" />
                Demo Mode
              </div>
              <button
                onClick={() => setDarkMode(!darkMode)}
                className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700"
              >
                {darkMode ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}
              </button>
              <Link href="/admin/notifications" className="relative p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700">
                <Bell className="w-5 h-5" />
                <span className="absolute top-1 right-1 w-2 h-2 bg-red-500 rounded-full" />
              </Link>
            </div>
          </header>

          {/* Page Content */}
          <main className="flex-1 overflow-y-auto p-4 md:p-6">
            {children}
          </main>
        </div>
      </div>
    </div>
  );
}
