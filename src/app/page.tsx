'use client';

import Link from 'next/link';
import Image from 'next/image';
import { Building2, FileText, Shield, AlertTriangle, TrendingUp, Globe, Users, Package, BarChart3, Phone, Mail, ChevronRight, ExternalLink } from 'lucide-react';
import { publicStats, monthlyExportData, exportsByProduct, exportsByCountry } from '@/lib/mock-data';
import { formatNumber } from '@/lib/utils';
import { BarChart, Bar, LineChart, Line, PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, AreaChart, Area } from 'recharts';

const COLORS = ['#006B3F', '#D4AF37', '#0ea5e9', '#8b5cf6', '#ef4444', '#f97316', '#06b6d4', '#84cc16'];

const notices = [
  { date: 'Sep 5, 2026', title: 'Updated SPS Requirements for EU Exports', tag: 'SPS' },
  { date: 'Aug 28, 2026', title: 'New Phytosanitary Certificate Format Effective Oct 2026', tag: 'Regulation' },
  { date: 'Aug 20, 2026', title: 'Mango Export Season Extended Until October 31', tag: 'Trade Notice' },
  { date: 'Aug 15, 2026', title: 'Rice Export Quota Revision for Q4 2026', tag: 'Policy' },
];

export default function HomePage() {
  return (
    <div className="min-h-screen bg-white">
      {/* Top Banner */}
      <div className="bg-gov-green-500 text-white text-center py-1.5 text-xs">
        <span className="font-medium">Government of Pakistan</span> | Ministry of National Food Security & Research | Ministry of Commerce
      </div>

      {/* Header */}
      <header className="bg-white border-b shadow-sm sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Image src="/govt-pakistan-logo.png" alt="Government of Pakistan" width={48} height={48} />
            <div>
              <h1 className="text-lg font-bold text-gray-900 leading-tight">National Export Portal</h1>
              <p className="text-xs text-gray-500">Government of Pakistan | Registration, Certification & Complaint Management</p>
            </div>
          </div>
          <nav className="hidden md:flex items-center gap-6 text-sm">
            <a href="#about" className="text-gray-600 hover:text-gov-green-500">About</a>
            <a href="#stats" className="text-gray-600 hover:text-gov-green-500">Statistics</a>
            <a href="#notices" className="text-gray-600 hover:text-gov-green-500">Notices</a>
            <a href="#contact" className="text-gray-600 hover:text-gov-green-500">Contact</a>
            <Link href="/login" className="btn-primary text-sm">Exporter Login</Link>
            <Link href="/register" className="btn-secondary text-sm">Register</Link>
          </nav>
        </div>
      </header>

      {/* Hero */}
      <section className="relative bg-gradient-to-br from-gov-green-500 via-gov-green-600 to-gov-green-700 text-white overflow-hidden">
        <div className="absolute inset-0 opacity-10">
          <div className="absolute top-20 left-20 w-72 h-72 bg-white rounded-full blur-3xl" />
          <div className="absolute bottom-20 right-20 w-96 h-96 bg-gov-gold-400 rounded-full blur-3xl" />
        </div>
        <div className="relative max-w-7xl mx-auto px-4 py-20 md:py-28">
          <div className="max-w-3xl">
            <div className="inline-flex items-center gap-2 px-3 py-1 bg-white/10 rounded-full text-sm mb-6">
              <Shield className="w-4 h-4" />
              <span>TDAP & NAFSA Joint Operational Portal</span>
            </div>
            <h2 className="text-3xl md:text-5xl font-bold mb-4 leading-tight">
              National Export Registration,<br />Certification & Complaint<br />Management Portal
            </h2>
            <p className="text-lg text-gov-green-100 mb-8 max-w-2xl">
              Facilitating export registration, shipment record management, regulatory document submission, monitoring, reporting, and complaint resolution for Pakistan's agricultural exports.
            </p>
            <div className="flex flex-wrap gap-4">
              <Link href="/register" className="bg-gov-gold-400 hover:bg-gov-gold-500 text-gray-900 font-semibold py-3 px-6 rounded-lg transition-colors flex items-center gap-2">
                Register as Exporter/Trader <ChevronRight className="w-5 h-5" />
              </Link>
              <Link href="/login" className="bg-white/10 hover:bg-white/20 text-white font-medium py-3 px-6 rounded-lg border border-white/30 transition-colors">
                Exporter Login
              </Link>
              <Link href="/complaints/submit" className="bg-white/10 hover:bg-white/20 text-white font-medium py-3 px-6 rounded-lg border border-white/30 transition-colors">
                Buyer/Importer Complaint
              </Link>
              <Link href="/complaints/track" className="bg-white/10 hover:bg-white/20 text-white font-medium py-3 px-6 rounded-lg border border-white/30 transition-colors">
                Track Complaint
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* Institution Logos */}
      <section className="bg-gray-50 py-6 border-b">
        <div className="max-w-7xl mx-auto px-4">
          <div className="flex flex-wrap items-center justify-center gap-8 md:gap-16">
            {['MNFSR', 'Ministry of Commerce', 'TDAP', 'NAFSA'].map(org => (
              <div key={org} className="flex items-center gap-2 text-gray-400">
                <div className="w-10 h-10 bg-gray-200 rounded-full flex items-center justify-center">
                  <Building2 className="w-5 h-5" />
                </div>
                <span className="text-sm font-medium text-gray-500">{org}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Public Statistics */}
      <section id="stats" className="py-16 bg-white">
        <div className="max-w-7xl mx-auto px-4">
          <div className="text-center mb-12">
            <h3 className="text-2xl font-bold text-gray-900 mb-2">Public Export Statistics</h3>
            <p className="text-gray-500">Real-time overview of Pakistan's export registration system</p>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 md:gap-6 mb-12">
            {[
              { label: 'Registered Exporters', value: publicStats.registeredExporters, icon: Users, color: 'text-green-600 bg-green-50' },
              { label: 'Active Users', value: publicStats.activeUsers, icon: Users, color: 'text-blue-600 bg-blue-50' },
              { label: 'Total Consignments', value: publicStats.totalConsignments, icon: Package, color: 'text-purple-600 bg-purple-50' },
              { label: 'Total Quantity (MT)', value: publicStats.totalQuantity, icon: TrendingUp, color: 'text-orange-600 bg-orange-50' },
              { label: 'Countries Served', value: publicStats.countriesServed, icon: Globe, color: 'text-cyan-600 bg-cyan-50' },
              { label: 'Pending Verifications', value: publicStats.pendingVerifications, icon: FileText, color: 'text-yellow-600 bg-yellow-50' },
              { label: 'Complaints Received', value: publicStats.complaintsReceived, icon: AlertTriangle, color: 'text-red-600 bg-red-50' },
              { label: 'Complaints Resolved', value: publicStats.complaintsResolved, icon: Shield, color: 'text-green-600 bg-green-50' },
            ].map(stat => (
              <div key={stat.label} className="card p-4 md:p-6 text-center">
                <div className={`w-12 h-12 rounded-xl ${stat.color} flex items-center justify-center mx-auto mb-3`}>
                  <stat.icon className="w-6 h-6" />
                </div>
                <p className="text-2xl md:text-3xl font-bold text-gray-900">{formatNumber(stat.value)}</p>
                <p className="text-sm text-gray-500 mt-1">{stat.label}</p>
              </div>
            ))}
          </div>

          {/* Charts */}
          <div className="grid md:grid-cols-2 gap-6">
            <div className="card p-6">
              <h4 className="font-semibold text-gray-900 mb-4">Monthly Export Submissions</h4>
              <ResponsiveContainer width="100%" height={250}>
                <AreaChart data={monthlyExportData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="month" tick={{ fontSize: 11 }} />
                  <YAxis tick={{ fontSize: 11 }} />
                  <Tooltip />
                  <Area type="monotone" dataKey="submissions" stroke="#006B3F" fill="#006B3F" fillOpacity={0.1} strokeWidth={2} />
                </AreaChart>
              </ResponsiveContainer>
            </div>
            <div className="card p-6">
              <h4 className="font-semibold text-gray-900 mb-4">Export Value Trend (USD)</h4>
              <ResponsiveContainer width="100%" height={250}>
                <LineChart data={monthlyExportData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="month" tick={{ fontSize: 11 }} />
                  <YAxis tick={{ fontSize: 11 }} tickFormatter={v => `${(v/1000000).toFixed(1)}M`} />
                  <Tooltip formatter={(v: any) => `$${(Number(v)/1000000).toFixed(1)}M`} />
                  <Line type="monotone" dataKey="value" stroke="#D4AF37" strokeWidth={2} dot={{ fill: '#D4AF37' }} />
                </LineChart>
              </ResponsiveContainer>
            </div>
            <div className="card p-6">
              <h4 className="font-semibold text-gray-900 mb-4">Top Exported Products</h4>
              <ResponsiveContainer width="100%" height={250}>
                <BarChart data={exportsByProduct} layout="vertical">
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis type="number" tick={{ fontSize: 11 }} />
                  <YAxis dataKey="name" type="category" width={100} tick={{ fontSize: 10 }} />
                  <Tooltip />
                  <Bar dataKey="value" fill="#006B3F" radius={[0, 4, 4, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
            <div className="card p-6">
              <h4 className="font-semibold text-gray-900 mb-4">Exports by Destination Country</h4>
              <ResponsiveContainer width="100%" height={250}>
                <PieChart>
                  <Pie data={exportsByCountry} cx="50%" cy="50%" outerRadius={90} dataKey="value" label={({ name, percent }: any) => `${name || ''} ${((percent || 0) * 100).toFixed(0)}%`} labelLine={false}>
                    {exportsByCountry.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>
      </section>

      {/* Latest Notices */}
      <section id="notices" className="py-16 bg-gray-50">
        <div className="max-w-7xl mx-auto px-4">
          <div className="text-center mb-10">
            <h3 className="text-2xl font-bold text-gray-900 mb-2">Latest SPS & Export Notices</h3>
          </div>
          <div className="max-w-3xl mx-auto space-y-3">
            {notices.map((notice, i) => (
              <div key={i} className="card p-4 flex items-center gap-4 hover:shadow-md transition-shadow cursor-pointer">
                <div className="flex-shrink-0">
                  <span className="badge bg-gov-green-50 text-gov-green-700 border border-gov-green-200">{notice.tag}</span>
                </div>
                <div className="flex-1">
                  <p className="text-sm font-medium text-gray-900">{notice.title}</p>
                  <p className="text-xs text-gray-500 mt-0.5">{notice.date}</p>
                </div>
                <ExternalLink className="w-4 h-4 text-gray-400" />
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Contact */}
      <section id="contact" className="py-16 bg-white">
        <div className="max-w-7xl mx-auto px-4">
          <div className="text-center mb-10">
            <h3 className="text-2xl font-bold text-gray-900 mb-2">Helpdesk & Contact</h3>
          </div>
          <div className="grid md:grid-cols-3 gap-6 max-w-4xl mx-auto">
            <div className="card p-6 text-center">
              <Phone className="w-8 h-8 text-gov-green-500 mx-auto mb-3" />
              <h4 className="font-semibold text-gray-900 mb-1">Helpline</h4>
              <p className="text-sm text-gray-500">+92-51-9202461</p>
              <p className="text-sm text-gray-500">Mon-Fri, 9AM-5PM PKT</p>
            </div>
            <div className="card p-6 text-center">
              <Mail className="w-8 h-8 text-gov-green-500 mx-auto mb-3" />
              <h4 className="font-semibold text-gray-900 mb-1">Email</h4>
              <p className="text-sm text-gray-500">support@exportportal.gov.pk</p>
              <p className="text-sm text-gray-500">Response within 24 hours</p>
            </div>
            <div className="card p-6 text-center">
              <Building2 className="w-8 h-8 text-gov-green-500 mx-auto mb-3" />
              <h4 className="font-semibold text-gray-900 mb-1">Office</h4>
              <p className="text-sm text-gray-500">TDAP Head Office</p>
              <p className="text-sm text-gray-500">Islamabad, Pakistan</p>
            </div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-gray-900 text-gray-400 py-10">
        <div className="max-w-7xl mx-auto px-4">
          <div className="grid md:grid-cols-4 gap-8 mb-8">
            <div>
              <div className="flex items-center gap-2 mb-3">
                <Building2 className="w-6 h-6 text-gov-gold-400" />
                <span className="text-white font-semibold">Export Portal</span>
              </div>
              <p className="text-sm">National Export Registration, Certification & Complaint Management Portal of Pakistan.</p>
            </div>
            <div>
              <h5 className="text-white font-medium mb-3">Quick Links</h5>
              <ul className="space-y-2 text-sm">
                <li><Link href="/register" className="hover:text-white">Register</Link></li>
                <li><Link href="/login" className="hover:text-white">Login</Link></li>
                <li><Link href="/complaints/submit" className="hover:text-white">File Complaint</Link></li>
                <li><Link href="/complaints/track" className="hover:text-white">Track Complaint</Link></li>
              </ul>
            </div>
            <div>
              <h5 className="text-white font-medium mb-3">Legal</h5>
              <ul className="space-y-2 text-sm">
                <li><a href="#" className="hover:text-white">Privacy Policy</a></li>
                <li><a href="#" className="hover:text-white">Terms of Use</a></li>
                <li><a href="#" className="hover:text-white">Disclaimer</a></li>
                <li><a href="#" className="hover:text-white">Accessibility</a></li>
              </ul>
            </div>
            <div>
              <h5 className="text-white font-medium mb-3">Institutions</h5>
              <ul className="space-y-2 text-sm">
                <li><a href="#" className="hover:text-white">MNFSR</a></li>
                <li><a href="#" className="hover:text-white">Ministry of Commerce</a></li>
                <li><a href="#" className="hover:text-white">TDAP</a></li>
                <li><a href="#" className="hover:text-white">NAFSA</a></li>
              </ul>
            </div>
          </div>
          <div className="border-t border-gray-800 pt-6 text-center text-sm">
            <p>&copy; 2026 Government of Pakistan. All rights reserved. | MVP Demonstration Version</p>
          </div>
        </div>
      </footer>
    </div>
  );
}
