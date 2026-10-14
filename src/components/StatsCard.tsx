interface StatsCardProps {
  title: string;
  value: number | string | null;
  subtitle?: string;
  icon?: React.ReactNode;
  isLoading?: boolean;
}

export function StatsCard({ title, value, subtitle, icon, isLoading }: StatsCardProps) {
  return (
    <div className="relative overflow-hidden rounded-xl border border-slate-200/80 bg-white p-6 shadow-sm transition-all hover:shadow-md dark:border-slate-800 dark:bg-slate-900/60">
      <div className="flex items-center justify-between">
        <p className="text-sm font-medium text-slate-500 dark:text-slate-400">{title}</p>
        {icon && (
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300">
            {icon}
          </div>
        )}
      </div>

      <div className="mt-4">
        {isLoading ? (
          <div className="h-8 w-24 animate-pulse rounded bg-slate-200 dark:bg-slate-800" />
        ) : (
          <p className="text-3xl font-bold tracking-tight text-slate-900 dark:text-white">
            {value !== null ? value : '—'}
          </p>
        )}
        {subtitle && (
          <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">{subtitle}</p>
        )}
      </div>
    </div>
  );
}
