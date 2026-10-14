import Link from 'next/link';

export default function NotFound() {
  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] text-center px-4 space-y-4">
      <div className="rounded-full bg-indigo-50 p-4 text-indigo-600 dark:bg-indigo-950/60 dark:text-indigo-400 text-3xl font-bold">
        404
      </div>
      <h2 className="text-xl font-bold text-slate-900 dark:text-white">
        Page Not Found
      </h2>
      <p className="text-xs text-slate-500 max-w-sm">
        The requested CRM page or resource could not be found. Please check the URL or return to the dashboard.
      </p>
      <Link
        href="/"
        className="inline-flex items-center gap-1.5 rounded-lg bg-indigo-600 px-4 py-2 text-xs font-semibold text-white shadow-sm hover:bg-indigo-700 transition-all"
      >
        &larr; Return to Dashboard
      </Link>
    </div>
  );
}
