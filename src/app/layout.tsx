import type { Metadata } from 'next';
import './globals.css';
import { Sidebar } from '@/components/Sidebar';
import { TopNav } from '@/components/TopNav';

export const metadata: Metadata = {
  title: 'CommercePilot AI — WooCommerce CRM',
  description: 'Lightweight CRM designed for WooCommerce stores. Phase 2 Core CRM.',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body
        suppressHydrationWarning
        className="min-h-screen bg-slate-50 text-slate-900 antialiased dark:bg-slate-950 dark:text-slate-100 flex"
      >
        <Sidebar />
        <div className="flex-1 flex flex-col min-w-0 min-h-screen">
          <TopNav />
          <main className="flex-1 p-6 lg:p-8 overflow-y-auto">
            {children}
          </main>
        </div>
      </body>
    </html>
  );
}
