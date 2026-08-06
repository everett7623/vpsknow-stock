import { useId } from 'react';

export function BrandMark({ className = 'h-8 w-8' }: { className?: string }): React.JSX.Element {
  const rawId = useId().replace(/:/g, '');
  const top = `${rawId}-top`;
  const mid = `${rawId}-mid`;
  const bot = `${rawId}-bot`;

  return (
    <svg viewBox="0 0 64 64" className={className} aria-hidden>
      <defs>
        <linearGradient id={top} x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#34d399" />
          <stop offset="100%" stopColor="#22d3ee" />
        </linearGradient>
        <linearGradient id={mid} x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#3b82f6" />
          <stop offset="100%" stopColor="#6366f1" />
        </linearGradient>
        <linearGradient id={bot} x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#7c3aed" />
          <stop offset="100%" stopColor="#8b5cf6" />
        </linearGradient>
      </defs>
      <path d="M14 44 L32 52 L50 44 L32 36 Z" fill={`url(#${bot})`} />
      <path d="M14 44 L14 50 L32 58 L32 52 Z" fill="#5b21b6" />
      <path d="M50 44 L50 50 L32 58 L32 52 Z" fill="#6d28d9" />
      <path d="M14 32 L32 40 L50 32 L32 24 Z" fill={`url(#${mid})`} />
      <path d="M14 32 L14 38 L32 46 L32 40 Z" fill="#1d4ed8" />
      <path d="M50 32 L50 38 L32 46 L32 40 Z" fill="#4338ca" />
      <path d="M14 20 L32 28 L50 20 L32 12 Z" fill={`url(#${top})`} />
      <path d="M14 20 L14 26 L32 34 L32 28 Z" fill="#059669" />
      <path d="M50 20 L50 26 L32 34 L32 28 Z" fill="#0e7490" />
      <circle cx="20" cy="22" r="1.4" fill="#ecfeff" />
      <circle cx="20" cy="34" r="1.4" fill="#dbeafe" />
      <circle cx="20" cy="46" r="1.4" fill="#ede9fe" />
      <path d="M28 8 L30 14" stroke="#34d399" strokeWidth="1.6" strokeLinecap="round" />
      <path d="M32 6 L32 12" stroke="#22d3ee" strokeWidth="1.6" strokeLinecap="round" />
      <path d="M36 8 L34 14" stroke="#a78bfa" strokeWidth="1.6" strokeLinecap="round" />
    </svg>
  );
}

export function BrandLogo({ size = 'md' }: { size?: 'sm' | 'md' | 'lg' }): React.JSX.Element {
  const markClass = size === 'lg' ? 'h-12 w-12' : size === 'sm' ? 'h-7 w-7' : 'h-8 w-8';
  const textClass = size === 'lg' ? 'text-3xl' : 'text-sm';

  return (
    <span className="inline-flex items-center gap-2.5">
      <BrandMark className={markClass} />
      <span className={`leading-none tracking-wide ${textClass}`}>
        <span className="font-semibold text-foreground">
          VPS
          <span className="bg-gradient-to-r from-brand-cyan to-brand-purple bg-clip-text text-transparent">
            Know
          </span>
        </span>
        <span className="ml-1.5 font-semibold text-stock">Stock</span>
      </span>
    </span>
  );
}
