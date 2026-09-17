'use client';

import { Suspense, useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '@/lib/auth';
import { getHomeForRole } from '@/lib/permissions';
import { useMockData } from '@/lib/portal-backend';
import { DEMO_PASSWORD } from '@/lib/mock-passwords';
import DemoModeNotice from '@/components/DemoModeNotice';
import GovtLogo from '@/components/GovtLogo';
import { Eye, EyeOff, AlertCircle, Info } from 'lucide-react';

const DEMO_ACCOUNTS = [
  { label: 'MNFSR Super Admin', email: 'superadmin@mnfsr.gov.pk' },
  { label: 'MoC Admin', email: 'admin@moc.gov.pk' },
  { label: 'TDAP Admin', email: 'tdap.admin@tdap.gov.pk' },
  { label: 'TDAP Officer', email: 'officer1@tdap.gov.pk' },
  { label: 'NAFSA Admin', email: 'nafsa.admin@nafsa.gov.pk' },
  { label: 'NAFSA Officer', email: 'officer1@nafsa.gov.pk' },
  { label: 'TIC Beijing', email: 'tic.china@tdap.gov.pk' },
  { label: 'Exporter', email: 'exporter1@pakrice.com' },
  { label: 'Buyer', email: 'buyer@chinagrain.cn' },
  { label: 'Auditor', email: 'auditor@mnfsr.gov.pk' },
];

/** Local/dev convenience: click a role to prefill email + Demo@12345. */
const showQuickLogins = process.env.NEXT_PUBLIC_SHOW_DEMO_LOGINS === 'true';

function LoginPage() {
  const { login, user, isLoading: authLoading } = useAuth();
  const router = useRouter();
  const searchParams = useSearchParams();
  const isMockMode = useMockData();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const redirectTo = searchParams.get('next');
  const showAccountPicker = isMockMode || showQuickLogins;

  // Already signed in: skip the form entirely.
  useEffect(() => {
    if (!authLoading && user) {
      router.replace(redirectTo || getHomeForRole(user.role));
    }
  }, [authLoading, user, router, redirectTo]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const result = await login(email, password);
      if (result.error) {
        setError(result.error);
      } else if (result.user) {
        router.push(redirectTo || getHomeForRole(result.user.role));
      } else {
        setError('Sign-in did not complete. Please try again.');
      }
    } catch {
      setError('The authentication service is unavailable. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const useDemoAccount = (demoEmail: string) => {
    setEmail(demoEmail);
    setPassword(DEMO_PASSWORD);
    setError('');
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-gov-green-500 via-gov-green-600 to-gov-green-700 flex flex-col">
      <DemoModeNotice />
      <div className="flex-1 flex items-center justify-center p-4 py-8">
      <div className="w-full max-w-2xl">
        <div className="text-center mb-8">
          <Link href="/" className="inline-flex items-center gap-2 text-white/80 hover:text-white text-sm mb-4">
            &larr; Back to Portal
          </Link>
          <div className="mx-auto mb-4 flex justify-center">
            <GovtLogo size={80} ring />
          </div>
          <h1 className="text-2xl font-bold text-white">Export Portal Login</h1>
          <p className="text-gov-green-100 text-sm mt-1">Government of Pakistan</p>
        </div>

        <div className="bg-white rounded-2xl shadow-xl p-8 md:p-10">
          <h2 className="text-xl font-bold text-gray-900 mb-6">Sign In</h2>

          {error && (
            <div className="flex items-start gap-2 p-3 bg-red-50 text-red-700 rounded-lg text-sm mb-4">
              <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          <form onSubmit={handleLogin} className="space-y-4">
            <div>
              <label htmlFor="login-email" className="block text-sm font-medium text-gray-700 mb-1">Email Address</label>
              <input
                id="login-email"
                type="email"
                autoComplete="email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                className="input-field"
                placeholder="Enter your email"
                required
              />
            </div>
            <div>
              <label htmlFor="login-password" className="block text-sm font-medium text-gray-700 mb-1">Password</label>
              <div className="relative">
                <input
                  id="login-password"
                  type={showPassword ? 'text' : 'password'}
                  autoComplete="current-password"
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  className="input-field pr-10"
                  placeholder="Enter your password"
                  required
                />
                <button
                  type="button"
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400"
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>
            <button type="submit" disabled={loading || !email || !password} className="btn-primary w-full py-3 disabled:opacity-50">
              {loading ? 'Signing in...' : 'Sign In'}
            </button>
          </form>

          <div className="mt-6 pt-6 border-t">
            <p className="text-sm text-gray-500 text-center mb-3">Don&apos;t have an account?</p>
            <Link href="/register" className="btn-outline w-full block text-center py-3">
              Register as Exporter/Trader
            </Link>
          </div>

          {showAccountPicker ? (
            <div className="mt-6 pt-6 border-t">
              <p className="flex items-center gap-2 text-xs font-medium text-gray-600 mb-3">
                <Info className="w-3.5 h-3.5" />
                {isMockMode ? 'Demo mode — select an account to prefill' : 'Quick login — select an account to prefill'}
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {DEMO_ACCOUNTS.map(account => (
                  <button
                    key={account.email}
                    type="button"
                    onClick={() => useDemoAccount(account.email)}
                    className="flex flex-col items-start text-left text-xs px-3 py-2.5 rounded-lg border hover:border-gov-green-500 hover:bg-gov-green-50 transition-colors"
                  >
                    <span className="font-medium text-gray-800">{account.label}</span>
                    <span className="text-gray-400 truncate w-full mt-0.5">{account.email}</span>
                  </button>
                ))}
              </div>
              <p className="mt-3 text-xs text-gray-400">
                Password: <span className="font-mono">{DEMO_PASSWORD}</span>
                {isMockMode ? '. Accounts you register use your own password.' : '. Local MySQL seed accounts only.'}
              </p>
            </div>
          ) : (
            <p className="mt-6 text-xs text-center text-gray-400">
              Use the credentials issued for your Export Portal account.
            </p>
          )}
        </div>
        </div>
      </div>
    </div>
  );
}

/**
 * useSearchParams() requires a Suspense boundary so this route can still be
 * prerendered as static HTML.
 */
export default function LoginRoute() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-gov-green-600 flex items-center justify-center text-white text-sm">Loading sign-in…</div>}>
      <LoginPage />
    </Suspense>
  );
}
