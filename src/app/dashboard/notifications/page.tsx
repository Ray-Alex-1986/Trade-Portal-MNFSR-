'use client';

import DashboardLayout from '@/components/layout/DashboardLayout';
import RoleGuard from '@/components/auth/RoleGuard';
import NotificationCenter from '@/components/notifications/NotificationCenter';
import { ROUTE_ROLES } from '@/lib/permissions';

export default function DashboardNotificationsPage() {
  return (
    <DashboardLayout>
      <RoleGuard allow={ROUTE_ROLES['/dashboard/notifications']}>
        <NotificationCenter />
      </RoleGuard>
    </DashboardLayout>
  );
}
