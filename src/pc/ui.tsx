import React from 'react';

export const Card: React.FC<React.PropsWithChildren<{ className?: string }>> = ({ children, className = '' }) => (
  <div className={`rounded-xl border border-slate-200 bg-white shadow-sm ${className}`}>{children}</div>
);

export const SectionTitle: React.FC<{ title: string; subtitle?: string; icon?: React.ReactNode }> = ({
  title, subtitle, icon,
}) => (
  <div className="mb-5">
    <div className="flex items-center gap-2">
      {icon && <span className="text-slate-500">{icon}</span>}
      <h1 className="text-xl font-bold tracking-tight text-slate-900">{title}</h1>
    </div>
    {subtitle && <p className="mt-1 text-sm text-slate-500">{subtitle}</p>}
  </div>
);

export const StatCard: React.FC<{
  label: string; value: string; sub?: string; accent?: string;
}> = ({ label, value, sub, accent = 'text-slate-900' }) => (
  <Card className="p-4">
    <div className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">{label}</div>
    <div className={`mt-1 text-2xl font-bold tabular-nums ${accent}`}>{value}</div>
    {sub && <div className="mt-0.5 text-xs text-slate-500">{sub}</div>}
  </Card>
);

export const Badge: React.FC<React.PropsWithChildren<{ tone?: 'green' | 'amber' | 'red' | 'slate' | 'blue' }>> = ({
  children, tone = 'slate',
}) => {
  const tones: Record<string, string> = {
    green: 'bg-emerald-50 text-emerald-700 ring-emerald-600/20',
    amber: 'bg-amber-50 text-amber-700 ring-amber-600/20',
    red: 'bg-red-50 text-red-700 ring-red-600/20',
    slate: 'bg-slate-100 text-slate-600 ring-slate-500/20',
    blue: 'bg-blue-50 text-blue-700 ring-blue-600/20',
  };
  return (
    <span className={`inline-flex items-center rounded-md px-2 py-0.5 text-xs font-medium ring-1 ring-inset ${tones[tone]}`}>
      {children}
    </span>
  );
};

export const Loading: React.FC<{ label?: string }> = ({ label = 'Loading warehouse data…' }) => (
  <div className="flex h-40 items-center justify-center text-sm text-slate-400">{label}</div>
);

export const ErrorNote: React.FC<{ msg: string }> = ({ msg }) => (
  <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700">{msg}</div>
);
