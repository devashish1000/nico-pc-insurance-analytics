export default function BrandMark({ className = '' }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 48 54" role="img" aria-label="P&C analytics project mark">
      <path d="M24 2 43 9v15c0 13-7.8 22.1-19 28C12.8 46.1 5 37 5 24V9L24 2Z" fill="none" stroke="currentColor" strokeWidth="2.4" />
      <path d="M15 36V25M24 36V18M33 36V29" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="square" />
    </svg>
  );
}

