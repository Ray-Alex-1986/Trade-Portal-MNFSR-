import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import './globals.css';
import { AuthProvider } from '@/lib/auth';
import { MockDataProvider } from '@/lib/supabase/use-mock';

const inter = Inter({ subsets: ['latin'] });

export const metadata: Metadata = {
  title: 'National Export Registration, Certification & Complaint Management Portal',
  description: 'Government of Pakistan - Ministry of National Food Security & Research (MNFSR) and Ministry of Commerce (MoC)',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className={inter.className}>
        <MockDataProvider>
          <AuthProvider>
            {children}
          </AuthProvider>
        </MockDataProvider>
      </body>
    </html>
  );
}
