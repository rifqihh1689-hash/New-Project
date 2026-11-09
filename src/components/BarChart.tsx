import { useId, useRef, useState } from 'react'

export interface BarSeries {
  label: string
  /** Token warna (var(--…)); identitas seri, bukan teks. */
  color: string
  values: number[]
}

interface Props {
  /** Label sumbu x per kelompok, mis. "Nov". */
  labels: string[]
  /** Judul tooltip per kelompok, mis. "November 2026". */
  titles?: string[]
  series: BarSeries[]
  format: (v: number) => string
  /** Format ringkas untuk sumbu y. */
  formatAxis?: (v: number) => string
  label: string
}

const W = 600
const H = 200
const PAD = { top: 12, right: 8, bottom: 24, left: 48 }

function niceMax(max: number): number[] {
  if (max <= 0) return [0, 1]
  const raw = max / 4
  const pow = 10 ** Math.floor(Math.log10(raw))
  const step = [1, 2, 2.5, 5, 10].map((m) => m * pow).find((s) => max / s <= 4) ?? 10 * pow
  return Array.from({ length: Math.ceil(max / step) + 1 }, (_, i) => i * step)
}

/**
 * Grafik batang berkelompok (1–2 seri): batang tipis berujung bulat 4px di atas, jarak 2px antar batang,
 * grid samar, legenda bila lebih dari satu seri, dan tooltip per kelompok saat disentuh/diarahkan.
 */
export function BarChart({ labels, titles, series, format, formatAxis = format, label }: Props) {
  const id = useId()
  const box = useRef<SVGSVGElement>(null)
  const [hover, setHover] = useState<number | null>(null)
  const n = labels.length
  if (!n) return null
  const ticks = niceMax(Math.max(0, ...series.flatMap((s) => s.values)))
  const top = ticks[ticks.length - 1]
  const plotW = W - PAD.left - PAD.right
  const plotH = H - PAD.top - PAD.bottom
  const band = plotW / n
  const groupW = Math.min(band * 0.7, 28 * series.length + 2 * (series.length - 1))
  const barW = (groupW - 2 * (series.length - 1)) / series.length
  const y = (v: number) => PAD.top + plotH - (v / top) * plotH
  const gx = (i: number) => PAD.left + band * i + (band - groupW) / 2
  const r = Math.min(4, barW / 2)
  // Batang dengan ujung atas membulat dan dasar rata di sumbu.
  const bar = (x: number, v: number) => {
    const h = Math.max(0, PAD.top + plotH - y(v))
    if (h <= 0) return ''
    const rr = Math.min(r, h)
    const y0 = PAD.top + plotH
    return `M${x},${y0} V${y0 - h + rr} Q${x},${y0 - h} ${x + rr},${y0 - h} H${x + barW - rr} Q${x + barW},${y0 - h} ${x + barW},${y0 - h + rr} V${y0} Z`
  }
  const onMove = (e: React.PointerEvent<SVGSVGElement>) => {
    const rect = box.current!.getBoundingClientRect()
    const px = ((e.clientX - rect.left) / rect.width) * W
    setHover(Math.max(0, Math.min(n - 1, Math.floor((px - PAD.left) / band))))
  }
  return (
    <figure className="relative m-0">
      {series.length > 1 && (
        <figcaption className="mb-1.5 flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted">
          {series.map((s) => (
            <span key={s.label} className="flex items-center gap-1.5">
              <span className="size-2.5 rounded-[3px]" style={{ background: s.color }} aria-hidden="true" />
              {s.label}
            </span>
          ))}
        </figcaption>
      )}
      <svg
        ref={box}
        viewBox={`0 0 ${W} ${H}`}
        className="block h-auto w-full touch-pan-y select-none"
        role="img"
        aria-labelledby={`${id}-t`}
        onPointerMove={onMove}
        onPointerDown={onMove}
        onPointerLeave={() => setHover(null)}
      >
        <title id={`${id}-t`}>{label}</title>
        {ticks.map((t) => (
          <g key={t}>
            <line x1={PAD.left} x2={W - PAD.right} y1={y(t)} y2={y(t)} stroke="var(--line)" strokeWidth="1" />
            <text x={PAD.left - 8} y={y(t)} dy="0.32em" textAnchor="end" fontSize="11" fill="var(--faint)">
              {formatAxis(t)}
            </text>
          </g>
        ))}
        {hover != null && <rect x={PAD.left + band * hover} y={PAD.top} width={band} height={plotH} fill="var(--surface-2)" />}
        {labels.map((l, i) => (
          <g key={`${l}-${i}`}>
            {series.map((s, k) => (
              <path key={s.label} d={bar(gx(i) + k * (barW + 2), s.values[i] ?? 0)} fill={s.color} />
            ))}
            <text x={PAD.left + band * i + band / 2} y={H - 6} textAnchor="middle" fontSize="11" fill="var(--faint)">
              {l}
            </text>
          </g>
        ))}
      </svg>
      {hover != null && (
        <div
          role="status"
          className="pointer-events-none absolute top-6 rounded-lg border border-line bg-surface px-2.5 py-1.5 text-xs shadow-md"
          style={{
            left: `${((PAD.left + band * (hover + 0.5)) / W) * 100}%`,
            transform: `translateX(${hover / n > 0.55 ? '-105%' : '5%'})`,
          }}
        >
          <div className="text-muted">{titles?.[hover] ?? labels[hover]}</div>
          {series.map((s) => (
            <div key={s.label} className="flex items-center gap-1.5 tabular-nums">
              {series.length > 1 && <span className="size-2 rounded-[2px]" style={{ background: s.color }} aria-hidden="true" />}
              {series.length > 1 && <span className="text-muted">{s.label}</span>}
              <b className="ml-auto pl-2 font-semibold">{format(s.values[hover] ?? 0)}</b>
            </div>
          ))}
        </div>
      )}
    </figure>
  )
}
