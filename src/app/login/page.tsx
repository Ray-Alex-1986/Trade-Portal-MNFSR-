'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useAuth, isAdmin } from '@/lib/auth';
import { Eye, EyeOff, AlertCircle } from 'lucide-react';
import Image from 'next/image';

export default function LoginPage() {
  const { login } = useAuth();
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const result = await login(email, password);
      if (result.error) {
        setError(result.error);
      } else if (result.user) {
        if (isAdmin(result.user.role)) {
          router.push('/admin');
        } else {
          router.push('/dashboard');
        }
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-gov-green-500 via-gov-green-600 to-gov-green-700 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <Link href="/" className="inline-flex items-center gap-2 text-white/80 hover:text-white text-sm mb-4">
            &larr; Back to Portal
          </Link>
          <div className="w-20 h-20 bg-white rounded-full flex items-center justify-center mx-auto mb-4 p-1">
            <Image src="/govt-pakistan-logo.png" alt="Government of Pakistan" width={64} height={64} />
          </div>
          <h1 className="text-2xl font-bold text-white">Export Portal Login</h1>
          <p className="text-gov-green-100 text-sm mt-1">Government of Pakistan</p>
        </div>

        <div className="bg-white rounded-2xl shadow-xl p-8">
          <h2 className="text-xl font-bold text-gray-900 mb-6">Sign In</h2>

          {error && (
            <div className="flex items-center gap-2 p-3 bg-red-50 text-red-700 rounded-lg text-sm mb-4">
              <AlertCircle className="w-4 h-4" />
              {error}
            </div>
          )}

          <form onSubmit={handleLogin} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Email Address</label>
              <input
                type="email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                className="input-field"
                placeholder="Enter your email"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Password</label>
              <div className="relative">
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  className="input-field pr-10"
                  placeholder="Enter your password"
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400"
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>
            <div className="flex items-center justify-between text-sm">
              <label className="flex items-center gap-2">
                <input type="checkbox" className="rounded border-gray-300" />
                <span className="text-gray-600">Remember me</span>
              </label>
              <a href="#" className="text-gov-green-500 hover:underline">Forgot password?</a>
            </div>
            <button type="submit" disabled={loading} className="btn-primary w-full py-3 disabled:opacity-50">
              {loading ? 'Signing in...' : 'Sign In'}
            </button>
          </form>

          <div className="mt-6 pt-6 border-t">
            <p className="text-sm text-gray-500 text-center mb-3">Don't have an account?</p>
            <Link href="/register" className="btn-outline w-full block text-center py-3">
              Register as Exporter/Trader
            </Link>
          </div>

          {/* Demo Accounts */}
          <div className="mt-6 pt-6 border-t">
            <p className="text-xs font-medium text-gray-500 mb-3">DEMO ACCOUNTS (click to autofill):</p>
            <div className="grid grid-cols-2 gap-2">
              {[
                { email: 'superadmin@mnfsr.gov.pk', label: 'MNFSR Admin' },
                { email: 'tdap.admin@tdap.gov.pk', label: 'TDAP Admin' },
                { email: 'nafsa.admin@nafsa.gov.pk', label: 'NAFSA Admin' },
                { email: 'exporter1@pakrice.com', label: 'Exporter' },
                { email: 'buyer@chinagrain.cn', label: 'Buyer' },
                { email: 'tic.china@tdap.gov.pk', label: 'TIC' },
              ].map(acc => (
                <button
                  key={acc.email}
                  type="button"
                  onClick={() => { setEmail(acc.email); setPassword('demo123'); }}
                  className="text-xs p-2 bg-gray-50 hover:bg-gray-100 rounded-lg text-left border"
                >
                  <span className="font-medium text-gray-700">{acc.label}</span>
                  <span className="block text-gray-400 truncate">{acc.email}</span>
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
