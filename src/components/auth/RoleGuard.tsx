'use client';

import { useEffect } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth';
import { UserRole } from '@/lib/types';
import { getHomeForRole, isAdminSection } from '@/lib/permissions';
import { Shield, LayoutDashboard } from 'lucide-react';
import Link from 'next/link';

interface RoleGuardProps {
  /** Roles allowed to access this page */
  allow: UserRole[];
  children: React.ReactNode;
}

/**
 * Client-side route guard that checks the current user's role against
 * an allow-list. Redirects unauthorized users to their default landing page.
 */
export default function RoleGuard({ allow, children }: RoleGuardProps) {
  const { user, isLoading } = useAuth();
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    if (isLoading) return; // still hydrating
    if (!user) {
      // Sign in, then come back to the page that was requested.
      router.replace(`/login?next=${encodeURIComponent(pathname ?? '/dashboard')}`);
      return;
    }
    if (!allow.includes(user.role)) {
      router.replace(getHomeForRole(user.role));
    }
  }, [user, isLoading, allow, router, pathname]);

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="animate-pulse text-gray-400">Loading...</div>
      </div>
    );
  }

  if (!user) return null; // will redirect

  if (!allow.includes(user.role)) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 p-4">
        <div className="max-w-md w-full text-center">
          <div className="w-16 h-16 bg-red-50 rounded-full flex items-center justify-center mx-auto mb-4">
            <Shield className="w-8 h-8 text-red-400" />
          </div>
          <h2 className="text-xl font-bold text-gray-900 mb-2">Access Denied</h2>
          <p className="text-gray-500 mb-6">Your role does not have permission to access this page.</p>
          <div className="flex gap-3 justify-center">
            {isAdminSection(user.role) ? (
              <Link href="/admin" className="btn-primary flex items-center gap-2">
                <LayoutDashboard className="w-4 h-4" /> Go to Dashboard
              </Link>
            ) : (
              <Link href="/dashboard" className="btn-primary flex items-center gap-2">
                <LayoutDashboard className="w-4 h-4" /> Go to Dashboard
              </Link>
            )}
          </div>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}
