'use client';

interface StatusIndicatorProps {
  status: 'connected' | 'connecting' | 'disconnected' | 'error';
  message?: string;
}

export function StatusIndicator({ status, message }: StatusIndicatorProps) {
  const configs = {
    connected: {
      dot: 'bg-emerald-500 animate-pulse',
      badge: 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border-emerald-500/20',
      label: 'Database Connected',
    },
    connecting: {
      dot: 'bg-amber-500 animate-spin',
      badge: 'bg-amber-500/10 text-amber-700 dark:text-amber-400 border-amber-500/20',
      label: 'Connecting...',
    },
    disconnected: {
      dot: 'bg-slate-400',
      badge: 'bg-slate-500/10 text-slate-600 dark:text-slate-400 border-slate-500/20',
      label: 'Disconnected',
    },
    error: {
      dot: 'bg-rose-500',
      badge: 'bg-rose-500/10 text-rose-700 dark:text-rose-400 border-rose-500/20',
      label: 'Connection Error',
    },
  };

  const current = configs[status];

  return (
    <div
      className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-medium border transition-colors ${current.badge}`}
      title={message || current.label}
    >
      <span className={`w-2 h-2 rounded-full ${current.dot}`} />
      <span>{current.label}</span>
      {message && <span className="opacity-75 text-[11px]">({message})</span>}
    </div>
  );
}
