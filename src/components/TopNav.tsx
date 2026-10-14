'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

export function TopNav() {
  const pathname = usePathname();

  let title = 'Dashboard Overview';
  let breadcrumb = 'Overview';

  if (pathname.startsWith('/customers/')) {
    title = 'Customer Profile';
    breadcrumb = 'Customers / Profile';
  } else if (pathname === '/customers') {
    title = 'Customer Directory';
    breadcrumb = 'Customers';
  } else if (pathname.startsWith('/orders/')) {
    title = 'Order Details';
    breadcrumb = 'Orders / Details';
  } else if (pathname === '/orders') {
    title = 'Order Directory';
    breadcrumb = 'Orders';
  } else if (pathname === '/ai-assistant') {
    title = 'Agentic AI Retention Agent';
    breadcrumb = 'AI Agent / Customer Follow-ups';
  } else if (pathname === '/communication') {
    title = 'Email Communication & Workflows';
    breadcrumb = 'Email / Manual & Automated Hub';
  }

  return (
    <header className="h-16 shrink-0 border-b border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900 px-6 flex items-center justify-between">
      <div>
        <nav className="text-xs text-slate-400 flex items-center gap-1.5 mb-0.5">
          <Link href="/" className="hover:text-slate-600 dark:hover:text-slate-300">
            CommercePilot
          </Link>
          <span>/</span>
          <span className="text-slate-600 dark:text-slate-300 font-medium">{breadcrumb}</span>
        </nav>
        <h1 className="text-lg font-bold text-slate-900 dark:text-white leading-tight">
          {title}
        </h1>
      </div>

      <div className="flex items-center gap-3">
        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-emerald-50 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800">
          <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
          <span>Demo Store Active</span>
        </span>
      </div>
    </header>
  );
}
