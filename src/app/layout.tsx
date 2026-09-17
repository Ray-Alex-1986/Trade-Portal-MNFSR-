import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import './globals.css';
import { AuthProvider } from '@/lib/auth';
import { DataProvider } from '@/lib/data-store';
import { MockDataProvider } from '@/lib/portal-backend';
import ShipChatBot from '@/components/ShipChatBot';

const inter = Inter({ subsets: ['latin'] });

export const metadata: Metadata = {
  title: 'National Export Registration, Certification & Complaint Management Portal',
  description: 'Government of Pakistan - Ministry of National Food Security & Research (MNFSR) and Ministry of Commerce (MoC)',
  icons: {
    icon: [
      { url: '/icon.png', type: 'image/png', sizes: '32x32' },
      { url: '/mnfsr-logo.png', type: 'image/png', sizes: '512x512' },
    ],
    apple: [{ url: '/apple-icon.png', type: 'image/png', sizes: '180x180' }],
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className={inter.className}>
        <MockDataProvider>
          <AuthProvider>
            <DataProvider>
              {children}
              <ShipChatBot />
            </DataProvider>
          </AuthProvider>
        </MockDataProvider>
      </body>
    </html>
  );
}
