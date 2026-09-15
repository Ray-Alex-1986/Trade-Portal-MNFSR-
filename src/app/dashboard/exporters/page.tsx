'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import DashboardLayout from '@/components/layout/DashboardLayout';
import RoleGuard from '@/components/auth/RoleGuard';
import { useDataStore } from '@/lib/data-store';
import { ROUTE_ROLES } from '@/lib/permissions';
import { formatDate } from '@/lib/utils';
import { Search, Building2, Globe, AlertTriangle, Users } from 'lucide-react';

/**
 * Directory of approved exporters. Buyers use it to confirm that a company is
 * verified before trading, and to file a complaint against a named company.
 */
export default function VerifiedExportersPage() {
  const { companies, exportRecords, masterItems, isLoaded } = useDataStore();
  const [search, setSearch] = useState('');
  const [province, setProvince] = useState('');
  const [product, setProduct] = useState('');

  const verified = useMemo(() => companies.filter(company => company.status === 'approved'), [companies]);

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    return verified.filter(company => {
      const matchSearch = !term
        || company.legal_name.toLowerCase().includes(term)
        || (company.trading_name ?? '').toLowerCase().includes(term)
        || company.registration_number.toLowerCase().includes(term)
        || company.city.toLowerCase().includes(term);
      const matchProvince = !province || company.province === province;
      const matchProduct = !product || company.main_export_categories.includes(product);
      return matchSearch && matchProvince && matchProduct;
    });
  }, [verified, search, province, product]);

  // Destination reach is a useful signal for buyers and is already visible data.
  const destinationsByCompany = useMemo(() => {
    const map = new Map<string, Set<string>>();
    for (const record of exportRecords) {
      if (!record.destination_country) continue;
      const set = map.get(record.company_id) ?? new Set<string>();
      set.add(record.destination_country);
      map.set(record.company_id, set);
    }
    return map;
  }, [exportRecords]);

  return (
    <DashboardLayout>
      <RoleGuard allow={ROUTE_ROLES['/dashboard/exporters']}>
        <div className="space-y-6">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">Verified Exporters</h1>
              <p className="text-gray-500">Companies whose registration has passed TDAP and NAFSA review</p>
            </div>
            <Link href="/complaints/submit" className="btn-outline flex items-center gap-2">
              <AlertTriangle className="w-4 h-4" /> File a Complaint
            </Link>
          </div>

          <div className="card">
            <div className="p-4 border-b flex flex-col md:flex-row gap-3">
              <div className="flex items-center gap-2 bg-gray-100 rounded-lg px-3 py-2 flex-1">
                <Search className="w-4 h-4 text-gray-400" />
                <input
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                  placeholder="Search by company, registration number, or city..."
                  aria-label="Search verified exporters"
                  className="bg-transparent border-none outline-none text-sm flex-1"
                />
              </div>
              <select value={province} onChange={e => setProvince(e.target.value)} aria-label="Filter by province" className="input-field md:w-48">
                <option value="">All Provinces</option>
                {masterItems.provinces.map(name => <option key={name}>{name}</option>)}
              </select>
              <select value={product} onChange={e => setProduct(e.target.value)} aria-label="Filter by product" className="input-field md:w-48">
                <option value="">All Products</option>
                {masterItems.products.map(name => <option key={name}>{name}</option>)}
              </select>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="text-left p-3 font-medium text-gray-500">Company</th>
                    <th className="text-left p-3 font-medium text-gray-500">Location</th>
                    <th className="text-left p-3 font-medium text-gray-500">Business Type</th>
                    <th className="text-left p-3 font-medium text-gray-500">Products</th>
                    <th className="text-left p-3 font-medium text-gray-500">Markets</th>
                    <th className="text-left p-3 font-medium text-gray-500">Contact</th>
                    <th className="text-left p-3 font-medium text-gray-500">Verified Since</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map(company => {
                    const destinations = destinationsByCompany.get(company.id);
                    return (
                      <tr key={company.id} className="border-t hover:bg-gray-50">
                        <td className="p-3">
                          <p className="font-medium text-gray-900">{company.legal_name}</p>
                          <p className="text-xs text-gray-500 font-mono">{company.registration_number}</p>
                        </td>
                        <td className="p-3 text-gray-500">{[company.city, company.province].filter(Boolean).join(', ') || '—'}</td>
                        <td className="p-3 text-gray-500">{company.nature_of_business}</td>
                        <td className="p-3 text-gray-500 max-w-xs">{company.main_export_categories.join(', ') || '—'}</td>
                        <td className="p-3 text-gray-500">
                          {destinations && destinations.size > 0 ? (
                            <span className="inline-flex items-center gap-1">
                              <Globe className="w-3.5 h-3.5 text-gray-400" />
                              {destinations.size} {destinations.size === 1 ? 'country' : 'countries'}
                            </span>
                          ) : '—'}
                        </td>
                        <td className="p-3 text-gray-500">
                          <p className="truncate max-w-[12rem]">{company.email}</p>
                          <p className="text-xs">{company.phone}</p>
                        </td>
                        <td className="p-3 text-gray-500">{formatDate(company.updated_at)}</td>
                      </tr>
                    );
                  })}
                  {filtered.length === 0 && (
                    <tr>
                      <td colSpan={7} className="p-12 text-center text-gray-400">
                        {!isLoaded ? 'Loading exporters…' : verified.length === 0 ? (
                          <>
                            <Building2 className="w-10 h-10 mx-auto mb-3 text-gray-300" />
                            <p className="text-sm">No exporters have completed verification yet.</p>
                          </>
                        ) : (
                          <>
                            <Users className="w-10 h-10 mx-auto mb-3 text-gray-300" />
                            <p className="text-sm">No verified exporters match the current filters.</p>
                          </>
                        )}
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
            <div className="p-3 border-t text-sm text-gray-500">
              Showing {filtered.length} of {verified.length} verified exporters
            </div>
          </div>
        </div>
      </RoleGuard>
    </DashboardLayout>
  );
}
