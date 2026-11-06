import { useId } from 'react'

/**
 * Tanda Qawwam: cincin = siklus satu hari (berganti 03.00), titik emas = "sekarang" sekaligus ekor huruf Q.
 * Sama dengan ikon app (public/favicon.svg).
 */
export function BrandMark({ size = 26, className = '' }: { size?: number; className?: string }) {
  // ID unik per tanda: gradien yang dirujuk dari elemen tersembunyi (sidebar di HP) tidak ikut tergambar.
  const gid = `qg${useId().replace(/[^\w-]/g, '')}`
  return (
    <svg viewBox="0 0 64 64" width={size} height={size} className={`shrink-0 ${className}`} aria-hidden="true">
      <defs>
        <linearGradient id={gid} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#16624a" />
          <stop offset="1" stopColor="#0b3428" />
        </linearGradient>
      </defs>
      <rect width="64" height="64" rx="16" fill={`url(#${gid})`} />
      <path d="M37.30 44.16 A15.5 15.5 0 1 1 45.16 36.30" fill="none" stroke="#f1ead9" strokeWidth="6.6" strokeLinecap="round" />
      <circle cx="45.2" cy="44.2" r="5" fill="#e4b546" />
    </svg>
  )
}

export function Brand({ className = '' }: { className?: string }) {
  return (
    <div className={`flex items-center gap-2.5 font-serif tracking-[-0.01em] ${className}`}>
      <BrandMark />
      Qawwam
    </div>
  )
}
