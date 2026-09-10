import { type ClassValue, clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatDate(date: string | Date): string {
  return new Intl.DateTimeFormat('en-PK', { year: 'numeric', month: 'short', day: 'numeric' }).format(new Date(date));
}

export function formatDateTime(date: string | Date): string {
  return new Intl.DateTimeFormat('en-PK', { year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }).format(new Date(date));
}

export function formatCurrency(amount: number, currency = 'PKR'): string {
  return new Intl.NumberFormat('en-PK', { style: 'currency', currency, maximumFractionDigits: 0 }).format(amount);
}

export function formatNumber(num: number): string {
  return new Intl.NumberFormat('en-PK').format(num);
}

export function generateId(prefix: string): string {
  const timestamp = Date.now().toString(36).toUpperCase();
  const random = Math.random().toString(36).substring(2, 6).toUpperCase();
  return `${prefix}-${timestamp}-${random}`;
}

export function maskCNIC(cnic: string): string {
  if (cnic.length !== 15) return cnic;
  return `${cnic.substring(0, 5)}-*****-${cnic.substring(12)}`;
}

export function getStatusColor(status: string): string {
  const colors: Record<string, string> = {
    'Draft': 'bg-gray-100 text-gray-800',
    'Submitted': 'bg-blue-100 text-blue-800',
    'Pending': 'bg-yellow-100 text-yellow-800',
    'Pending Verification': 'bg-yellow-100 text-yellow-800',
    'Under Review': 'bg-purple-100 text-purple-800',
    'Under TDAP Review': 'bg-purple-100 text-purple-800',
    'Under NAFSA Review': 'bg-purple-100 text-purple-800',
    'Verified': 'bg-green-100 text-green-800',
    'Approved': 'bg-green-100 text-green-800',
    'Rejected': 'bg-red-100 text-red-800',
    'Active': 'bg-green-100 text-green-800',
    'Inactive': 'bg-gray-100 text-gray-800',
    'Suspended': 'bg-orange-100 text-orange-800',
    'Shipped': 'bg-indigo-100 text-indigo-800',
    'Delivered': 'bg-green-100 text-green-800',
    'Closed': 'bg-gray-100 text-gray-800',
    'Resolved': 'bg-green-100 text-green-800',
    'Escalated': 'bg-red-100 text-red-800',
    'Critical': 'bg-red-100 text-red-800',
    'High': 'bg-orange-100 text-orange-800',
    'Medium': 'bg-yellow-100 text-yellow-800',
    'Low': 'bg-blue-100 text-blue-800',
  };
  return colors[status] || 'bg-gray-100 text-gray-800';
}
