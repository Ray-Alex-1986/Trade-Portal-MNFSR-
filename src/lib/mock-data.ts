import { User, Company, ExportRecord, Complaint, Notification, AuditLog, DashboardStats, ProvinceApiSource, ProvinceSyncLog, ProvinceDataRecord } from './types';

export const PRODUCTS = ['Basmati Rice', 'Mango (Chaunsa)', 'Mango (Sindhri)', 'Kinnow', 'Dates (Aseel)', 'Sesame Seeds', 'Maize', 'Potatoes', 'Onions', 'Beef Meat', 'Seafood (Shrimp)', 'Olive Oil', 'Citrus Fruits', 'Red Chili', 'Cotton'];
export const COUNTRIES = ['China', 'United Arab Emirates', 'Saudi Arabia', 'United Kingdom', 'Malaysia', 'Indonesia', 'Qatar', 'Oman', 'Germany', 'Kazakhstan', 'Afghanistan', 'Turkey', 'South Africa', 'United States', 'Japan'];
export const PROVINCES = ['Punjab', 'Sindh', 'Khyber Pakhtunkhwa', 'Balochistan', 'Gilgit-Baltistan', 'Islamabad Capital Territory'];
export const DISTRICTS: Record<string, string[]> = {
  'Punjab': ['Lahore', 'Faisalabad', 'Multan', 'Rawalpindi', 'Sialkot', 'Gujranwala', 'Sargodha'],
  'Sindh': ['Karachi', 'Hyderabad', 'Sukkur', 'Larkana', 'Mirpur Khas'],
  'Khyber Pakhtunkhwa': ['Peshawar', 'Abbottabad', 'Mardan', 'Swat', 'Nowshera'],
  'Balochistan': ['Quetta', 'Gwadar', 'Turbat', 'Khuzdar'],
  'Gilgit-Baltistan': ['Gilgit', 'Skardu', 'Hunza'],
  'Islamabad Capital Territory': ['Islamabad'],
};
export const PORTS = ['Karachi Port', 'Port Qasim', 'Gwadar Port', 'Lahore Dry Port', 'Sialkot Dry Port', 'Islamabad Dry Port'];
export const HS_CODES: Record<string, string> = {
  'Basmati Rice': '1006.30', 'Mango (Chaunsa)': '0804.50', 'Mango (Sindhri)': '0804.50', 'Kinnow': '0805.10',
  'Dates (Aseel)': '0804.10', 'Sesame Seeds': '1207.40', 'Maize': '1005.90', 'Potatoes': '0701.90',
  'Onions': '0703.10', 'Beef Meat': '0201.30', 'Seafood (Shrimp)': '0306.17', 'Olive Oil': '1509.10',
  'Citrus Fruits': '0805.90', 'Red Chili': '0904.11', 'Cotton': '5201.00',
};

const companyNames = [
  'Pak Rice Exports (Pvt) Ltd', 'Al-Noor Trading Corporation', 'Green Valley Agro Exports', 'Sindh Fruit Company',
  'Punjab Grain Traders', 'Karachi Seafood International', 'Ravi Agro Industries', 'Chenab Exports Pvt Ltd',
  'Indus Valley Foods', 'Khyber Trade Corporation', 'Balochistan Dates Company', 'Hunza Organic Exports',
  'National Agri-Trade Pakistan', 'Crescent Foods International', 'Pak-Oman Trading Company', 'Heritage Rice Mills',
  'Golden Harvest Agro', 'Al-Barakah Exports', 'Sialkot Foods & Trading', 'Multan Mango Exports',
  'Faisalabad Grain Company', 'Lahore Spice Traders', 'Gujranwala Agro Mills', 'Quetta Dry Fruits Co',
  'Swat Valley Organics', 'Thatta Seafood Exports', 'DG Khan Agro Industries', 'Peshawar Spice Company',
  'Mirpur Citrus Farms', 'Sukkur Dates Trading'
];

function randomDate(start: Date, end: Date): string {
  return new Date(start.getTime() + Math.random() * (end.getTime() - start.getTime())).toISOString();
}

function randomItem<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

function randomNum(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

const statuses: Array<Company['status']> = ['approved', 'approved', 'approved', 'approved', 'submitted', 'under_tdap_review', 'under_nafsa_review', 'rejected', 'draft', 'approved'];

export const mockUsers: User[] = [
  { id: 'u1', email: 'superadmin@mnfsr.gov.pk', full_name: 'Dr. Ahmed Raza Khan', role: 'super_admin', institution: 'MNFSR', is_active: true, created_at: '2025-01-15T08:00:00Z', last_login: '2026-09-09T14:30:00Z' },
  { id: 'u2', email: 'admin@moc.gov.pk', full_name: 'Fatima Zahra Sheikh', role: 'moc_admin', institution: 'Ministry of Commerce', is_active: true, created_at: '2025-02-01T08:00:00Z', last_login: '2026-09-08T10:15:00Z' },
  { id: 'u3', email: 'tdap.admin@tdap.gov.pk', full_name: 'Muhammad Tariq Siddiqui', role: 'tdap_admin', institution: 'TDAP', is_active: true, created_at: '2025-02-10T08:00:00Z', last_login: '2026-09-09T11:45:00Z' },
  { id: 'u4', email: 'officer1@tdap.gov.pk', full_name: 'Ayesha Malik', role: 'tdap_officer', institution: 'TDAP', is_active: true, created_at: '2025-03-01T08:00:00Z', last_login: '2026-09-09T09:30:00Z' },
  { id: 'u5', email: 'nafsa.admin@nafsa.gov.pk', full_name: 'Dr. Khalid Mahmood', role: 'nafsa_admin', institution: 'NAFSA', is_active: true, created_at: '2025-02-15T08:00:00Z', last_login: '2026-09-08T16:20:00Z' },
  { id: 'u6', email: 'officer1@nafsa.gov.pk', full_name: 'Sana Bukhari', role: 'nafsa_officer', institution: 'NAFSA', is_active: true, created_at: '2025-03-15T08:00:00Z', last_login: '2026-09-09T13:10:00Z' },
  { id: 'u7', email: 'tic.china@tdap.gov.pk', full_name: 'Imran Hussain', role: 'tic', institution: 'TIC Beijing', is_active: true, created_at: '2025-04-01T08:00:00Z', last_login: '2026-09-07T08:45:00Z' },
  { id: 'u8', email: 'exporter1@pakrice.com', full_name: 'Hassan Ali Shah', role: 'exporter', is_active: true, created_at: '2025-05-01T08:00:00Z', last_login: '2026-09-09T15:00:00Z' },
  { id: 'u9', email: 'buyer@chinagrain.cn', full_name: 'Wei Zhang', role: 'buyer', is_active: true, created_at: '2025-06-15T08:00:00Z', last_login: '2026-09-05T12:30:00Z' },
  { id: 'u10', email: 'auditor@mnfsr.gov.pk', full_name: 'Nadia Parveen', role: 'auditor', institution: 'MNFSR', is_active: true, created_at: '2025-04-15T08:00:00Z', last_login: '2026-09-06T14:00:00Z' },
];

export const mockCompanies: Company[] = companyNames.map((name, i) => ({
  id: `c${i + 1}`,
  legal_name: name,
  trading_name: i % 3 === 0 ? name.replace(' (Pvt) Ltd', '').replace(' Pvt Ltd', '') : undefined,
  company_type: randomItem(['Private Limited', 'Sole Proprietor', 'Partnership', 'Public Limited']),
  ntn: `${randomNum(1000000, 9999999)}-${randomNum(1, 9)}`,
  secp_number: `${randomNum(100000, 999999)}`,
  registration_date: randomDate(new Date('2018-01-01'), new Date('2024-12-31')),
  address: `${randomNum(1, 500)}, ${randomItem(['Main Boulevard', 'Commercial Area', 'Industrial Zone', 'GT Road', 'University Road'])}, ${randomItem(Object.keys(DISTRICTS))}`,
  province: randomItem(PROVINCES),
  district: randomItem(Object.values(DISTRICTS).flat()),
  city: randomItem(Object.values(DISTRICTS).flat()),
  website: i % 2 === 0 ? `https://www.${name.toLowerCase().replace(/[^a-z]/g, '')}.pk` : undefined,
  email: `info@${name.toLowerCase().replace(/[^a-z]/g, '')}.pk`,
  phone: `+92-${randomNum(300, 349)}-${randomNum(1000000, 9999999)}`,
  nature_of_business: randomItem(['Agricultural Export', 'Food Processing & Export', 'Trading & Export', 'Agro-Industrial Export']),
  main_export_categories: [randomItem(PRODUCTS), randomItem(PRODUCTS)],
  registration_number: `REG-${(2024000 + i + 1).toString()}`,
  status: statuses[i % statuses.length],
  nadra_status: 'verified',
  secp_status: i % 5 === 0 ? 'pending' : 'verified',
  ntn_status: 'verified',
  created_at: randomDate(new Date('2025-01-01'), new Date('2026-06-30')),
  updated_at: randomDate(new Date('2026-07-01'), new Date('2026-09-09')),
  owner_id: `u${(i % 3) + 8}`,
}));

const exportStatuses: Array<ExportRecord['status']> = ['draft', 'submitted', 'under_tdap_review', 'under_nafsa_review', 'approved', 'approved', 'rejected', 'ready_for_shipment', 'shipped', 'delivered', 'closed'];

export const mockExportRecords: ExportRecord[] = Array.from({ length: 60 }, (_, i) => {
  const product = PRODUCTS[i % PRODUCTS.length];
  const country = COUNTRIES[i % COUNTRIES.length];
  const province = randomItem(PROVINCES);
  const status = exportStatuses[i % exportStatuses.length];
  return {
    id: `exp${i + 1}`,
    consignment_number: `EXP-${(2025000 + i + 1).toString()}`,
    exporter_id: `u${(i % 3) + 8}`,
    company_id: `c${(i % 30) + 1}`,
    product,
    product_category: product.includes('Rice') ? 'Cereals' : product.includes('Mango') || product.includes('Citrus') || product.includes('Kinnow') ? 'Fruits' : product.includes('Potato') || product.includes('Onion') ? 'Vegetables' : product.includes('Meat') || product.includes('Seafood') ? 'Meat & Seafood' : 'Other Agricultural',
    hs_code: HS_CODES[product] || '9999.99',
    description: `Premium quality ${product} for export to ${country}`,
    quantity: randomNum(10, 500),
    unit: randomItem(['Metric Tons', 'Kilograms', 'Containers']),
    estimated_value: randomNum(50000, 5000000),
    currency: randomItem(['USD', 'PKR', 'EUR', 'GBP']),
    country_of_origin: 'Pakistan',
    province_of_production: province,
    district_of_production: randomItem(DISTRICTS[province] || DISTRICTS['Punjab']),
    crop_year: randomNum(2024, 2026),
    batch_number: `B${randomNum(1000, 9999)}`,
    packaging_type: randomItem(['Jute Bags', 'Carton Boxes', 'Plastic Crates', 'Vacuum Packed', 'Bulk Container']),
    num_packages: randomNum(100, 5000),
    intended_shipment_date: randomDate(new Date('2026-01-01'), new Date('2026-12-31')),
    buyer_name: `${randomItem(['Mohammed', 'Ahmed', 'Ali', 'Chen', 'Wei', 'John', 'James'])} ${randomItem(['Al-Rashid', 'Trading Co', 'Imports Ltd', 'Global Foods', 'Agri Corp'])}`,
    buyer_company: `${country} ${randomItem(['Global Trading', 'Import Corp', 'Food Distributors', 'Agri Imports'])}`,
    buyer_country: country,
    buyer_address: `${randomNum(1, 200)}, ${randomItem(['Business District', 'Trade Center', 'Industrial Area'])}, ${country}`,
    buyer_contact: `+${randomNum(1, 99)}-${randomNum(100, 999)}-${randomNum(1000000, 9999999)}`,
    buyer_email: `buyer@${country.toLowerCase().replace(/\s/g, '')}import.com`,
    buyer_phone: `+${randomNum(1, 99)}-${randomNum(100, 999)}-${randomNum(1000000, 9999999)}`,
    purchase_order: `PO-${randomNum(10000, 99999)}`,
    destination_country: country,
    destination_port: randomItem([`${country} Main Port`, 'Jebel Ali', 'Shanghai Port', 'Southampton', 'Hamburg Port', 'Port Klang']),
    port_of_departure: randomItem(PORTS),
    transport_mode: randomItem(['Sea', 'Air', 'Road', 'Rail']),
    shipping_company: randomItem(['Maersk', 'MSC', 'CMA CGM', 'Hapag-Lloyd', 'PIA Cargo', 'Emirates SkyCargo']),
    container_number: `MSCU${randomNum(1000000, 9999999)}`,
    bill_of_lading: `BL-${randomNum(100000, 999999)}`,
    expected_departure: randomDate(new Date('2026-02-01'), new Date('2026-11-30')),
    expected_arrival: randomDate(new Date('2026-03-01'), new Date('2026-12-31')),
    status,
    tdap_review_status: ['submitted', 'under_tdap_review', 'approved', 'rejected'].includes(status) ? (status === 'rejected' ? 'rejected' : 'reviewed') : undefined,
    nafsa_review_status: ['under_nafsa_review', 'approved'].includes(status) ? 'reviewed' : undefined,
    documents: [],
    created_at: randomDate(new Date('2025-06-01'), new Date('2026-09-01')),
    updated_at: randomDate(new Date('2026-08-01'), new Date('2026-09-09')),
  };
});

const complaintCategories = ['Product quality issue', 'SPS compliance issue', 'Quantity discrepancy', 'Packaging issue', 'Documentation issue', 'Shipment delay', 'Payment dispute', 'Misrepresentation', 'Exporter conduct', 'Inspection issue', 'Regulatory issue', 'Other'];
const complaintStatuses: Array<Complaint['status']> = ['submitted', 'acknowledged', 'under_review', 'assigned', 'investigation', 'escalated', 'resolved', 'closed', 'resolved', 'resolved'];

export const mockComplaints: Complaint[] = Array.from({ length: 20 }, (_, i) => {
  const status = complaintStatuses[i % complaintStatuses.length];
  return {
    id: `comp${i + 1}`,
    tracking_number: `CMP-${(2025000 + i + 1).toString()}`,
    complainant_type: randomItem(['Buyer', 'Importer', 'TIC', 'Exporter']),
    full_name: `${randomItem(['Mohammed', 'Sarah', 'Ahmed', 'Chen', 'John', 'Fatima'])} ${randomItem(['Al-Saud', 'Khan', 'Zhang', 'Smith', 'Ali', 'Bukhari'])}`,
    email: `complainant${i + 1}@email.com`,
    phone: `+${randomNum(1, 99)}-${randomNum(100, 999)}-${randomNum(1000000, 9999999)}`,
    company_name: `${randomItem(COUNTRIES)} ${randomItem(['Trading Co', 'Imports Ltd', 'Global Foods'])}`,
    country: randomItem(COUNTRIES),
    exporter_company: randomItem(companyNames),
    export_registration_number: `REG-${randomNum(2024001, 2024030)}`,
    export_record_number: `EXP-${randomNum(2025001, 2025060)}`,
    product: randomItem(PRODUCTS),
    category: randomItem(complaintCategories),
    subject: `${randomItem(['Quality concern', 'Documentation delay', 'Quantity mismatch', 'SPS certificate issue', 'Late shipment'])} - Order #${randomNum(10000, 99999)}`,
    description: `Detailed complaint regarding ${randomItem(['product quality not matching specifications', 'delayed documentation processing', 'quantity discrepancy between order and delivery', 'SPS certificate not accepted at destination', 'shipment delayed beyond agreed timeline'])}.`,
    incident_date: randomDate(new Date('2026-01-01'), new Date('2026-08-31')),
    preferred_contact: randomItem(['Email', 'Phone', 'Both']),
    priority: randomItem(['low', 'medium', 'high', 'critical']),
    status,
    sla_deadline: randomDate(new Date('2026-09-15'), new Date('2026-12-31')),
    days_pending: randomNum(1, 120),
    escalation_level: status === 'escalated' ? randomNum(1, 3) : 0,
    assigned_officer: ['assigned', 'investigation', 'resolved', 'closed', 'escalated'].includes(status) ? randomItem(['u3', 'u4', 'u5', 'u6', 'u7']) : undefined,
    resolution_summary: ['resolved', 'closed'].includes(status) ? 'Issue investigated and resolved satisfactorily.' : undefined,
    satisfaction_rating: ['resolved', 'closed'].includes(status) ? randomNum(3, 5) : undefined,
    created_at: randomDate(new Date('2025-11-01'), new Date('2026-09-01')),
    updated_at: randomDate(new Date('2026-08-01'), new Date('2026-09-09')),
  };
});

export const mockNotifications: Notification[] = [
  { id: 'n1', user_id: 'u8', title: 'Export Record Approved', message: 'Your export record EXP-2025003 has been approved by TDAP.', type: 'success', is_read: false, link: '/dashboard/exports/exp3', created_at: '2026-09-09T10:30:00Z' },
  { id: 'n2', user_id: 'u8', title: 'Complaint Update', message: 'Complaint CMP-2025005 status changed to Under Review.', type: 'info', is_read: false, link: '/dashboard/complaints', created_at: '2026-09-09T08:15:00Z' },
  { id: 'n3', user_id: 'u8', title: 'Document Verified', message: 'SPS Certificate for EXP-2025010 has been verified.', type: 'success', is_read: true, link: '/dashboard/exports/exp10', created_at: '2026-09-08T14:00:00Z' },
  { id: 'n4', user_id: 'u3', title: 'New Registration Pending', message: '5 new exporter registrations await TDAP review.', type: 'warning', is_read: false, link: '/admin/reviews', created_at: '2026-09-09T09:00:00Z' },
  { id: 'n5', user_id: 'u1', title: 'Monthly Report Ready', message: 'August 2026 export summary report is available.', type: 'info', is_read: false, link: '/admin/reports', created_at: '2026-09-01T08:00:00Z' },
];

export const mockAuditLogs: AuditLog[] = Array.from({ length: 50 }, (_, i) => ({
  id: `al${i + 1}`,
  user_id: randomItem(mockUsers).id,
  user_name: randomItem(mockUsers).full_name,
  user_role: randomItem(mockUsers).role,
  action: randomItem(['Login', 'Logout', 'Create Record', 'Update Record', 'Approve', 'Reject', 'Upload Document', 'Change Status', 'Assign Complaint', 'Export Report']),
  module: randomItem(['Authentication', 'Registration', 'Export Records', 'Complaints', 'Reports', 'User Management', 'Master Data']),
  record_id: randomItem(['REG-2024001', 'EXP-2025001', 'CMP-2025001', 'USR-u1']),
  ip_address: `192.168.${randomNum(1, 254)}.${randomNum(1, 254)}`,
  created_at: randomDate(new Date('2026-08-01'), new Date('2026-09-09')),
})).sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

export const publicStats: DashboardStats = {
  registeredExporters: 2847,
  activeUsers: 2156,
  totalConsignments: 15234,
  totalQuantity: 2847560,
  countriesServed: 87,
  pendingVerifications: 143,
  complaintsReceived: 892,
  complaintsResolved: 756,
};

export const monthlyExportData = [
  { month: 'Sep 25', submissions: 45, quantity: 12500, value: 4500000 },
  { month: 'Oct 25', submissions: 52, quantity: 14200, value: 5100000 },
  { month: 'Nov 25', submissions: 38, quantity: 10800, value: 3900000 },
  { month: 'Dec 25', submissions: 61, quantity: 18500, value: 6700000 },
  { month: 'Jan 26', submissions: 55, quantity: 16200, value: 5800000 },
  { month: 'Feb 26', submissions: 48, quantity: 13900, value: 5000000 },
  { month: 'Mar 26', submissions: 67, quantity: 20100, value: 7200000 },
  { month: 'Apr 26', submissions: 72, quantity: 22400, value: 8100000 },
  { month: 'May 26', submissions: 58, quantity: 17600, value: 6300000 },
  { month: 'Jun 26', submissions: 63, quantity: 19300, value: 6900000 },
  { month: 'Jul 26', submissions: 71, quantity: 21800, value: 7800000 },
  { month: 'Aug 26', submissions: 68, quantity: 20500, value: 7400000 },
];

export const exportsByProduct = PRODUCTS.slice(0, 8).map(p => ({
  name: p.length > 15 ? p.substring(0, 15) + '...' : p,
  value: randomNum(500, 5000),
  quantity: randomNum(1000, 50000),
}));

export const exportsByCountry = COUNTRIES.slice(0, 10).map(c => ({
  name: c,
  value: randomNum(1000, 8000),
  quantity: randomNum(2000, 80000),
}));

export const COMPLAINT_CATEGORIES = complaintCategories;

export const mockVerificationAPI = {
  verifyNADRA: async (cnic: string) => {
    await new Promise(r => setTimeout(r, 1500));
    return { status: 'verified' as const, message: 'MVP Verification Simulation: NADRA identity verified successfully.', reference: `NADRA-${Date.now()}` };
  },
  verifySECP: async (number: string) => {
    await new Promise(r => setTimeout(r, 1200));
    return { status: 'verified' as const, message: 'MVP Verification Simulation: SECP registration verified successfully.', reference: `SECP-${Date.now()}` };
  },
  verifyNTN: async (ntn: string) => {
    await new Promise(r => setTimeout(r, 1000));
    return { status: 'verified' as const, message: 'MVP Verification Simulation: NTN/FBR verification completed successfully.', reference: `FBR-${Date.now()}` };
  },
};

// ---------- Province API Integration Mock Data ----------

export const mockProvinceApiSources: ProvinceApiSource[] = [
  {
    id: 'pas-1',
    name: 'Punjab Agriculture Export Portal',
    province: 'Punjab',
    system_name: 'Punjab Agri-Export System',
    api_url: 'https://api.punjab-agri.gov.pk/v1/exports',
    cron_interval: 'hourly',
    is_active: true,
    last_sync_at: '2026-09-15T08:30:00Z',
    last_sync_status: 'success',
    last_sync_records: 24,
    total_records_pulled: 1842,
    created_at: '2026-03-01T10:00:00Z',
    updated_at: '2026-09-15T08:30:00Z',
    created_by: 'u1',
  },
  {
    id: 'pas-2',
    name: 'Sindh Trade & Commerce Bureau',
    province: 'Sindh',
    system_name: 'Sindh Trade Portal',
    api_url: 'https://api.sindh-commerce.gov.pk/v2/trade-data',
    cron_interval: 'daily',
    is_active: true,
    last_sync_at: '2026-09-15T02:00:00Z',
    last_sync_status: 'success',
    last_sync_records: 18,
    total_records_pulled: 967,
    created_at: '2026-04-10T14:00:00Z',
    updated_at: '2026-09-15T02:00:00Z',
    created_by: 'u1',
  },
  {
    id: 'pas-3',
    name: 'KP Export Facilitation Center',
    province: 'Khyber Pakhtunkhwa',
    system_name: 'KP Trade Gateway',
    api_url: 'https://api.kp-trade.gov.pk/v1/export-records',
    cron_interval: 'every_6h',
    is_active: true,
    last_sync_at: '2026-09-15T06:00:00Z',
    last_sync_status: 'partial',
    last_sync_records: 7,
    last_sync_error: 'Timeout on batch 3 of 4 — 7 of 12 records synced',
    total_records_pulled: 534,
    created_at: '2026-05-20T09:00:00Z',
    updated_at: '2026-09-15T06:00:00Z',
    created_by: 'u3',
  },
  {
    id: 'pas-4',
    name: 'Balochistan Mineral & Agri Export Board',
    province: 'Balochistan',
    system_name: 'Balochistan Export Board',
    api_url: 'https://api.balochistan-export.gov.pk/v1/data',
    cron_interval: 'daily',
    is_active: false,
    last_sync_at: '2026-09-12T02:00:00Z',
    last_sync_status: 'failed',
    last_sync_records: 0,
    last_sync_error: 'Connection refused — endpoint unreachable',
    total_records_pulled: 215,
    created_at: '2026-06-15T11:00:00Z',
    updated_at: '2026-09-12T02:00:00Z',
    created_by: 'u1',
  },
  {
    id: 'pas-5',
    name: 'Gilgit-Baltistan Horticulture Board',
    province: 'Gilgit-Baltistan',
    system_name: 'GB Horticulture System',
    api_url: 'https://api.gb-horti.gov.pk/v1/produce',
    cron_interval: 'weekly',
    is_active: true,
    last_sync_at: '2026-09-14T00:00:00Z',
    last_sync_status: 'success',
    last_sync_records: 5,
    total_records_pulled: 128,
    created_at: '2026-07-01T08:00:00Z',
    updated_at: '2026-09-14T00:00:00Z',
    created_by: 'u3',
  },
];

export const mockProvinceSyncLogs: ProvinceSyncLog[] = [
  { id: 'psl-1', source_id: 'pas-1', source_name: 'Punjab Agriculture Export Portal', province: 'Punjab', status: 'success', records_pulled: 24, started_at: '2026-09-15T08:30:00Z', completed_at: '2026-09-15T08:30:12Z', duration_ms: 12043, triggered_by: 'cron' },
  { id: 'psl-2', source_id: 'pas-1', source_name: 'Punjab Agriculture Export Portal', province: 'Punjab', status: 'success', records_pulled: 19, started_at: '2026-09-15T07:30:00Z', completed_at: '2026-09-15T07:30:09Z', duration_ms: 9210, triggered_by: 'cron' },
  { id: 'psl-3', source_id: 'pas-2', source_name: 'Sindh Trade & Commerce Bureau', province: 'Sindh', status: 'success', records_pulled: 18, started_at: '2026-09-15T02:00:00Z', completed_at: '2026-09-15T02:00:45Z', duration_ms: 45320, triggered_by: 'cron' },
  { id: 'psl-4', source_id: 'pas-3', source_name: 'KP Export Facilitation Center', province: 'Khyber Pakhtunkhwa', status: 'partial', records_pulled: 7, started_at: '2026-09-15T06:00:00Z', completed_at: '2026-09-15T06:01:02Z', duration_ms: 62000, error_message: 'Timeout on batch 3 of 4', triggered_by: 'cron' },
  { id: 'psl-5', source_id: 'pas-4', source_name: 'Balochistan Mineral & Agri Export Board', province: 'Balochistan', status: 'failed', records_pulled: 0, started_at: '2026-09-12T02:00:00Z', completed_at: '2026-09-12T02:00:30Z', duration_ms: 30000, error_message: 'Connection refused — endpoint unreachable', triggered_by: 'cron' },
  { id: 'psl-6', source_id: 'pas-5', source_name: 'Gilgit-Baltistan Horticulture Board', province: 'Gilgit-Baltistan', status: 'success', records_pulled: 5, started_at: '2026-09-14T00:00:00Z', completed_at: '2026-09-14T00:00:08Z', duration_ms: 8100, triggered_by: 'cron' },
  { id: 'psl-7', source_id: 'pas-1', source_name: 'Punjab Agriculture Export Portal', province: 'Punjab', status: 'success', records_pulled: 31, started_at: '2026-09-14T08:30:00Z', completed_at: '2026-09-14T08:30:14Z', duration_ms: 14200, triggered_by: 'manual' },
  { id: 'psl-8', source_id: 'pas-2', source_name: 'Sindh Trade & Commerce Bureau', province: 'Sindh', status: 'success', records_pulled: 22, started_at: '2026-09-14T02:00:00Z', completed_at: '2026-09-14T02:00:38Z', duration_ms: 38400, triggered_by: 'cron' },
];

const recordTypes = ['export_permit', 'phyto_certificate', 'quality_inspection', 'trade_license', 'origin_certificate'];

export const mockProvinceDataRecords: ProvinceDataRecord[] = Array.from({ length: 40 }, (_, i) => {
  const source = mockProvinceApiSources[i % mockProvinceApiSources.length];
  const recordType = recordTypes[i % recordTypes.length];
  return {
    id: `pdr-${i + 1}`,
    source_id: source.id,
    source_name: source.name,
    province: source.province,
    record_type: recordType,
    data: {
      reference_number: `REF-${source.province.substring(0, 2).toUpperCase()}-${2026000 + i}`,
      product: PRODUCTS[i % PRODUCTS.length],
      quantity: randomNum(10, 500),
      unit: 'Metric Tons',
      exporter_name: companyNames[i % companyNames.length],
      destination: COUNTRIES[i % COUNTRIES.length],
      status: randomItem(['approved', 'pending', 'verified', 'in_transit']),
      issue_date: randomDate(new Date('2026-01-01'), new Date('2026-09-15')),
    },
    external_id: `EXT-${Date.now().toString(36)}-${i}`,
    synced_at: randomDate(new Date('2026-09-01'), new Date('2026-09-15')),
  };
});
