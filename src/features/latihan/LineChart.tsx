import { useId, useRef, useState } from 'react'
import { formatDateShort } from '../../domain/time'

export interface ChartPoint {
  x: string // ISODate
  y: number
  /** Teks tambahan di tooltip, mis. "60 kg × 8, 8, 7". */
  note?: string
}

interface Props {
  points: ChartPoint[]
  /** Garis acuan (mis. target bench 100 kg). */
  target?: { y: number; label: string }
  format: (y: number) => string
  /** Warna garis seri (token warna, bukan teks). */
  color?: string
  label: string
  /** Nilai lebih kecil = lebih baik (mis. waktu 5K): sumbu tetap biasa, hanya untuk keterangan. */
  lowerIsBetter?: boolean
}

const W = 600
const H = 200
const PAD = { top: 16, right: 64, bottom: 26, left: 44 }

/** Tick bersih (1, 2, 2,5, 5 × 10^n) yang mencakup rentang. */
function niceTicks(min: number, max: number, count = 4): number[] {
  const span = max - min || Math.abs(max) || 1
  const raw = span / count
  const pow = 10 ** Math.floor(Math.log10(raw))
  const step = [1, 2, 2.5, 5, 10].map((m) => m * pow).find((s) => span / s <= count) ?? 10 * pow
  const start = Math.floor(min / step) * step
  const out: number[] = []
  for (let v = start; v <= max + step * 0.001; v += step) out.push(Math.round(v * 1000) / 1000)
  if (out[out.length - 1] < max) out.push(Math.round((out[out.length - 1] + step) * 1000) / 1000)
  return out
}

/**
 * Grafik garis satu seri: garis 2px, isian tipis, label nilai di titik akhir, garis acuan opsional,
 * dan crosshair + tooltip yang mengikuti jari/pointer (snap ke tanggal terdekat).
 */
export function LineChart({ points, target, format, color = 'var(--color-tentir)', label, lowerIsBetter }: Props) {
  const id = useId()
  const box = useRef<SVGSVGElement>(null)
  const [hover, setHover] = useState<number | null>(null)
  if (points.length < 2) return null

  const t0 = Date.parse(points[0].x)
  const t1 = Date.parse(points[points.length - 1].x)
  const ys = points.map((p) => p.y).concat(target ? [target.y] : [])
  const ticks = niceTicks(Math.min(...ys), Math.max(...ys))
  const yMin = ticks[0]
  const yMax = ticks[ticks.length - 1]
  const x = (d: string) => PAD.left + ((Date.parse(d) - t0) / (t1 - t0 || 1)) * (W - PAD.left - PAD.right)
  const y = (v: number) => PAD.top + (1 - (v - yMin) / (yMax - yMin || 1)) * (H - PAD.top - PAD.bottom)
  const path = points.map((p, i) => `${i ? 'L' : 'M'}${x(p.x).toFixed(1)},${y(p.y).toFixed(1)}`).join(' ')
  const area = `${path} L${x(points[points.length - 1].x).toFixed(1)},${H - PAD.bottom} L${x(points[0].x).toFixed(1)},${H - PAD.bottom} Z`
  const last = points[points.length - 1]

  const onMove = (e: React.PointerEvent<SVGSVGElement>) => {
    const r = box.current!.getBoundingClientRect()
    const px = ((e.clientX - r.left) / r.width) * W
    let best = 0
    points.forEach((p, i) => {
      if (Math.abs(x(p.x) - px) < Math.abs(x(points[best].x) - px)) best = i
    })
    setHover(best)
  }
  const h = hover != null ? points[hover] : null

  return (
    <figure className="relative m-0">
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
              {format(t)}
            </text>
          </g>
        ))}
        {target && (
          <g>
            <line x1={PAD.left} x2={W - PAD.right} y1={y(target.y)} y2={y(target.y)} stroke="var(--muted)" strokeWidth="1" />
            <text x={W - PAD.right + 6} y={y(target.y)} dy="0.32em" fontSize="11" fill="var(--muted)">
              {target.label}
            </text>
          </g>
        )}
        <path d={area} fill={color} opacity="0.1" />
        <path d={path} fill="none" stroke={color} strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" />
        <circle cx={x(last.x)} cy={y(last.y)} r="4" fill={color} stroke="var(--surface)" strokeWidth="2" />
        {!target || Math.abs(y(target.y) - y(last.y)) > 14 ? (
          <text x={x(last.x) + 8} y={y(last.y)} dy="0.32em" fontSize="12" fontWeight="600" fill="var(--text)">
            {format(last.y)}
          </text>
        ) : null}
        <text x={PAD.left} y={H - 6} fontSize="11" fill="var(--faint)">
          {formatDateShort(points[0].x)}
        </text>
        <text x={W - PAD.right} y={H - 6} fontSize="11" fill="var(--faint)" textAnchor="end">
          {formatDateShort(last.x)}
        </text>
        {h && (
          <g pointerEvents="none">
            <line x1={x(h.x)} x2={x(h.x)} y1={PAD.top} y2={H - PAD.bottom} stroke="var(--muted)" strokeWidth="1" />
            <circle cx={x(h.x)} cy={y(h.y)} r="5" fill={color} stroke="var(--surface)" strokeWidth="2" />
          </g>
        )}
      </svg>
      {h && hover != null && (
        <div
          role="status"
          className="pointer-events-none absolute top-1 rounded-lg border border-line bg-surface px-2.5 py-1.5 text-xs shadow-md"
          style={{
            left: `${(x(h.x) / W) * 100}%`,
            transform: `translateX(${x(h.x) / W > 0.6 ? '-105%' : '5%'})`,
          }}
        >
          <div className="text-muted">{formatDateShort(h.x)}</div>
          <div className="font-semibold tabular-nums">{format(h.y)}</div>
          {h.note && <div className="text-muted tabular-nums">{h.note}</div>}
        </div>
      )}
      {lowerIsBetter && <figcaption className="mt-1 text-[11px] text-faint">Lebih rendah = lebih cepat.</figcaption>}
    </figure>
  )
}
