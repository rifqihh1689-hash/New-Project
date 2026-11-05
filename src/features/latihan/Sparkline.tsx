/** Grafik garis kecil tanpa sumbu, untuk tren e1RM. */
export function Sparkline({ values, color = 'var(--color-tentir)', label }: { values: number[]; color?: string; label: string }) {
  if (values.length < 2) return null
  const w = 120
  const h = 32
  const min = Math.min(...values)
  const max = Math.max(...values)
  const span = max - min || 1
  const pts = values
    .map((v, i) => `${((i / (values.length - 1)) * w).toFixed(1)},${(h - 3 - ((v - min) / span) * (h - 6)).toFixed(1)}`)
    .join(' ')
  return (
    <svg viewBox={`0 0 ${w} ${h}`} width={w} height={h} role="img" aria-label={label} className="shrink-0">
      <polyline points={pts} fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}
