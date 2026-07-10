export const usd = (n: number | null | undefined, compact = true) =>
  n == null
    ? '—'
    : new Intl.NumberFormat('en-US', {
        style: 'currency',
        currency: 'USD',
        maximumFractionDigits: 0,
        notation: compact && Math.abs(n) >= 1000 ? 'compact' : 'standard',
      }).format(n);

export const pct = (n: number | null | undefined, d = 1) =>
  n == null ? '—' : `${n.toFixed(d)}%`;

export const num = (n: number | null | undefined) =>
  n == null ? '—' : new Intl.NumberFormat('en-US').format(n);

// Loss-ratio colour band (P&C convention): <60 healthy, 60–100 watch, >100 unprofitable
export const lossRatioColor = (lr: number) =>
  lr > 100 ? '#dc2626' : lr >= 60 ? '#d97706' : '#059669';
