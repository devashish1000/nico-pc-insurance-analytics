import React from 'react';

export const Card: React.FC<React.PropsWithChildren<{ className?: string }>> = ({ children, className = '' }) => (
  <div className={`data-surface ${className}`}>{children}</div>
);

export const SectionTitle: React.FC<{ title: string; subtitle?: string; icon?: React.ReactNode; action?: React.ReactNode }> = ({
  title, subtitle, icon, action,
}) => (
  <div className="section-title">
    <div>
      <div className="section-title-heading">
        {icon && <span>{icon}</span>}
        <h1>{title}</h1>
      </div>
      {subtitle && <p>{subtitle}</p>}
    </div>
    {action && <div className="section-title-action">{action}</div>}
  </div>
);

export const StatCard: React.FC<{
  label: string; value: string; sub?: string; accent?: string;
}> = ({ label, value, sub, accent = 'text-slate-900' }) => (
  <Card className="stat-card">
    <div className="stat-label">{label}</div>
    <div className={`stat-value ${accent}`}>{value}</div>
    {sub && <div className="stat-sub">{sub}</div>}
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
  <div className="loading-state" role="status"><span /><span /><span /><p>{label}</p></div>
);

export const ErrorNote: React.FC<{ msg: string }> = ({ msg }) => (
  <div className="error-note" role="alert">{msg}</div>
);
