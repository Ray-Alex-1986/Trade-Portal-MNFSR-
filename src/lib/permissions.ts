import { UserRole } from './types';

// ---------------------------------------------------------------------------
// Permission flags — each is a boolean capability attached to roles
// ---------------------------------------------------------------------------
export interface RolePermissions {
  // System
  manageUsers: boolean;
  manageMasterData: boolean;
  manageProvinceIntegrations: boolean;
  viewAuditLogs: boolean;

  // Reviews
  canReviewTdap: boolean;
  canReviewNafsa: boolean;
  canOverrideReview: boolean;   // Super Admin can skip stages

  // Records
  canCreateExportRecord: boolean;
  canViewAllExportRecords: boolean;
  canViewOwnExportRecords: boolean;

  // Complaints
  canFileComplaint: boolean;
  canResolveComplaint: boolean;
  canEscalateComplaint: boolean;
  canAddComplaintNote: boolean;
  canViewAllComplaints: boolean;

  // Reports
  canViewReports: boolean;

  // General
  isReadOnly: boolean;
}

// ---------------------------------------------------------------------------
// Permission matrix — one entry per role
// ---------------------------------------------------------------------------
export const ROLE_PERMISSIONS: Record<UserRole, RolePermissions> = {
  super_admin: {
    manageUsers: true,
    manageMasterData: true,
    manageProvinceIntegrations: true,
    viewAuditLogs: true,
    canReviewTdap: true,
    canReviewNafsa: true,
    canOverrideReview: true,
    canCreateExportRecord: false,
    canViewAllExportRecords: true,
    canViewOwnExportRecords: false,
    canFileComplaint: false,
    canResolveComplaint: true,
    canEscalateComplaint: true,
    canAddComplaintNote: true,
    canViewAllComplaints: true,
    canViewReports: true,
    isReadOnly: false,
  },
  moc_admin: {
    manageUsers: false,
    manageMasterData: false,
    manageProvinceIntegrations: false,
    viewAuditLogs: true,
    canReviewTdap: false,
    canReviewNafsa: false,
    canOverrideReview: false,
    canCreateExportRecord: false,
    canViewAllExportRecords: true,
    canViewOwnExportRecords: false,
    canFileComplaint: false,
    canResolveComplaint: false,
    canEscalateComplaint: false,
    canAddComplaintNote: false,
    canViewAllComplaints: true,
    canViewReports: true,
    isReadOnly: true,
  },
  tdap_admin: {
    manageUsers: false,
    manageMasterData: false,
    manageProvinceIntegrations: false,
    viewAuditLogs: false,
    canReviewTdap: true,
    canReviewNafsa: false,
    canOverrideReview: false,
    canCreateExportRecord: false,
    canViewAllExportRecords: true,
    canViewOwnExportRecords: false,
    canFileComplaint: false,
    canResolveComplaint: true,
    canEscalateComplaint: true,
    canAddComplaintNote: true,
    canViewAllComplaints: true,
    canViewReports: true,
    isReadOnly: false,
  },
  tdap_officer: {
    manageUsers: false,
    manageMasterData: false,
    manageProvinceIntegrations: false,
    viewAuditLogs: false,
    canReviewTdap: true,
    canReviewNafsa: false,
    canOverrideReview: false,
    canCreateExportRecord: false,
    canViewAllExportRecords: true,
    canViewOwnExportRecords: false,
    canFileComplaint: false,
    canResolveComplaint: true,
    canEscalateComplaint: false,
    canAddComplaintNote: true,
    canViewAllComplaints: true,
    canViewReports: true,
    isReadOnly: false,
  },
  nafsa_admin: {
    manageUsers: false,
    manageMasterData: false,
    manageProvinceIntegrations: false,
    viewAuditLogs: false,
    canReviewTdap: false,
    canReviewNafsa: true,
    canOverrideReview: false,
    canCreateExportRecord: false,
    canViewAllExportRecords: true,
    canViewOwnExportRecords: false,
    canFileComplaint: false,
    canResolveComplaint: true,
    canEscalateComplaint: true,
    canAddComplaintNote: true,
    canViewAllComplaints: true,
    canViewReports: true,
    isReadOnly: false,
  },
  nafsa_officer: {
    manageUsers: false,
    manageMasterData: false,
    manageProvinceIntegrations: false,
    viewAuditLogs: false,
    canReviewTdap: false,
    canReviewNafsa: true,
    canOverrideReview: false,
    canCreateExportRecord: false,
    canViewAllExportRecords: true,
    canViewOwnExportRecords: false,
    canFileComplaint: false,
    canResolveComplaint: true,
    canEscalateComplaint: false,
    canAddComplaintNote: true,
    canViewAllComplaints: true,
    canViewReports: true,
    isReadOnly: false,
  },
  tic: {
    manageUsers: false,
    manageMasterData: false,
    manageProvinceIntegrations: false,
    viewAuditLogs: false,
    canReviewTdap: false,
    canReviewNafsa: false,
    canOverrideReview: false,
    canCreateExportRecord: false,
    canViewAllExportRecords: true,
    canViewOwnExportRecords: false,
    canFileComplaint: true,
    canResolveComplaint: false,
    canEscalateComplaint: false,
    canAddComplaintNote: true,
    canViewAllComplaints: true,
    canViewReports: true,
    isReadOnly: true,
  },
  exporter: {
    manageUsers: false,
    manageMasterData: false,
    manageProvinceIntegrations: false,
    viewAuditLogs: false,
    canReviewTdap: false,
    canReviewNafsa: false,
    canOverrideReview: false,
    canCreateExportRecord: true,
    canViewAllExportRecords: false,
    canViewOwnExportRecords: true,
    canFileComplaint: true,
    canResolveComplaint: false,
    canEscalateComplaint: false,
    canAddComplaintNote: false,
    canViewAllComplaints: false,
    canViewReports: false,
    isReadOnly: false,
  },
  buyer: {
    manageUsers: false,
    manageMasterData: false,
    manageProvinceIntegrations: false,
    viewAuditLogs: false,
    canReviewTdap: false,
    canReviewNafsa: false,
    canOverrideReview: false,
    canCreateExportRecord: false,
    canViewAllExportRecords: false,
    canViewOwnExportRecords: false,
    canFileComplaint: true,
    canResolveComplaint: false,
    canEscalateComplaint: false,
    canAddComplaintNote: false,
    canViewAllComplaints: false,
    canViewReports: false,
    isReadOnly: true,
  },
  auditor: {
    manageUsers: false,
    manageMasterData: false,
    manageProvinceIntegrations: false,
    viewAuditLogs: true,
    canReviewTdap: false,
    canReviewNafsa: false,
    canOverrideReview: false,
    canCreateExportRecord: false,
    canViewAllExportRecords: true,
    canViewOwnExportRecords: false,
    canFileComplaint: false,
    canResolveComplaint: false,
    canEscalateComplaint: false,
    canAddComplaintNote: false,
    canViewAllComplaints: true,
    canViewReports: true,
    isReadOnly: true,
  },
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
export function getPermissions(role: UserRole | null | undefined): RolePermissions {
  if (!role) return ROLE_PERMISSIONS.exporter;
  return ROLE_PERMISSIONS[role] ?? ROLE_PERMISSIONS.exporter;
}

export function hasPermission(role: UserRole | null | undefined, perm: keyof RolePermissions): boolean {
  return !!getPermissions(role)[perm];
}

/** Whether this role has access to the /admin section at all */
export function isAdminSection(role: UserRole | null | undefined): boolean {
  if (!role) return false;
  return [
    'super_admin', 'moc_admin', 'tdap_admin', 'tdap_officer',
    'nafsa_admin', 'nafsa_officer', 'auditor',
  ].includes(role);
}

/** Whether this role can review at a given stage */
export function canReviewStage(role: UserRole | null | undefined, stage: 'tdap' | 'nafsa'): boolean {
  if (!role) return false;
  if (stage === 'tdap') return hasPermission(role, 'canReviewTdap') || hasPermission(role, 'canOverrideReview');
  if (stage === 'nafsa') return hasPermission(role, 'canReviewNafsa') || hasPermission(role, 'canOverrideReview');
  return false;
}

/** Determine the review stage for a given role (null if the role doesn't review) */
export function getReviewStage(role: UserRole | null | undefined): 'tdap' | 'nafsa' | null {
  if (!role) return null;
  if (hasPermission(role, 'canOverrideReview')) return 'tdap'; // Super admin can review any stage
  if (hasPermission(role, 'canReviewTdap')) return 'tdap';
  if (hasPermission(role, 'canReviewNafsa')) return 'nafsa';
  return null;
}

// ---------------------------------------------------------------------------
// Navigation items per role
// ---------------------------------------------------------------------------
import {
  LayoutDashboard, FileText, Package, AlertTriangle, Users,
  ClipboardList, BarChart3, Bell, Shield, Database, Plug,
  Eye, Search, FileCheck,
} from 'lucide-react';

type LucideIcon = typeof LayoutDashboard;

export interface NavItem {
  href: string;
  label: string;
  icon: LucideIcon;
}

export function getNavForRole(role: UserRole | null | undefined): NavItem[] {
  switch (role) {
    case 'super_admin':
      return [
        { href: '/admin', label: 'Admin Dashboard', icon: LayoutDashboard },
        { href: '/admin/reviews', label: 'Review Workspace', icon: ClipboardList },
        { href: '/admin/province-integrations', label: 'Province Integrations', icon: Plug },
        { href: '/admin/users', label: 'User Management', icon: Users },
        { href: '/admin/reports', label: 'Reports Center', icon: BarChart3 },
        { href: '/admin/master-data', label: 'Master Data', icon: Database },
        { href: '/admin/audit-logs', label: 'Audit Logs', icon: Shield },
        { href: '/admin/notifications', label: 'Notifications', icon: Bell },
      ];

    case 'moc_admin':
    case 'auditor':
      return [
        { href: '/admin', label: 'Dashboard', icon: LayoutDashboard },
        { href: '/admin/reports', label: 'Reports', icon: BarChart3 },
        { href: '/admin/audit-logs', label: 'Audit Logs', icon: Shield },
        { href: '/admin/notifications', label: 'Notifications', icon: Bell },
      ];

    case 'tdap_admin':
    case 'tdap_officer':
      return [
        { href: '/admin', label: 'TDAP Dashboard', icon: LayoutDashboard },
        { href: '/admin/reviews', label: 'Review Workspace', icon: ClipboardList },
        { href: '/admin/notifications', label: 'Notifications', icon: Bell },
      ];

    case 'nafsa_admin':
    case 'nafsa_officer':
      return [
        { href: '/admin', label: 'NAFSA Dashboard', icon: LayoutDashboard },
        { href: '/admin/reviews', label: 'Review Workspace', icon: ClipboardList },
        { href: '/admin/notifications', label: 'Notifications', icon: Bell },
      ];

    case 'tic':
      return [
        { href: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
        { href: '/dashboard/exports', label: 'Export Records', icon: Package },
        { href: '/dashboard/complaints', label: 'Complaints', icon: AlertTriangle },
        { href: '/admin/notifications', label: 'Notifications', icon: Bell },
      ];

    case 'buyer':
      return [
        { href: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
        { href: '/dashboard/exporters', label: 'Verified Exporters', icon: Search },
        { href: '/complaints/submit', label: 'File Complaint', icon: AlertTriangle },
        { href: '/complaints/track', label: 'Track Complaint', icon: Eye },
      ];

    case 'exporter':
    default:
      return [
        { href: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
        { href: '/dashboard/exports', label: 'Export Records', icon: Package },
        { href: '/dashboard/exports/new', label: 'New Export Record', icon: FileText },
        { href: '/dashboard/complaints', label: 'My Complaints', icon: AlertTriangle },
      ];
  }
}

export const ROLE_LABELS: Record<UserRole, string> = {
  super_admin: 'MNFSR Super Admin',
  moc_admin: 'MoC Admin',
  tdap_admin: 'TDAP Admin',
  tdap_officer: 'TDAP Officer',
  nafsa_admin: 'NAFSA Admin',
  nafsa_officer: 'NAFSA Officer',
  tic: 'Trade & Investment Counsellor',
  exporter: 'Exporter / Trader',
  buyer: 'Buyer / Importer',
  auditor: 'Auditor / Viewer',
};

/** Roles allowed to access specific admin routes */
export const ROUTE_ROLES: Record<string, UserRole[]> = {
  '/admin': ['super_admin', 'moc_admin', 'tdap_admin', 'tdap_officer', 'nafsa_admin', 'nafsa_officer', 'auditor'],
  '/admin/reviews': ['super_admin', 'tdap_admin', 'tdap_officer', 'nafsa_admin', 'nafsa_officer'],
  '/admin/province-integrations': ['super_admin'],
  '/admin/province-integrations/data': ['super_admin'],
  '/admin/users': ['super_admin'],
  '/admin/master-data': ['super_admin'],
  '/admin/audit-logs': ['super_admin', 'moc_admin', 'auditor'],
  '/admin/reports': ['super_admin', 'moc_admin', 'tdap_admin', 'nafsa_admin', 'auditor'],
  '/admin/notifications': ['super_admin', 'moc_admin', 'tdap_admin', 'tdap_officer', 'nafsa_admin', 'nafsa_officer', 'tic', 'auditor'],
};
