import { ArrowRight, Check } from 'lucide-react'
import { useRef, useState, type ReactNode } from 'react'

interface SwipeRowProps {
  children: ReactNode
  /** Geser ke kanan, mis. tandai selesai. */
  onRight?: () => void
  /** Geser ke kiri, mis. pindah ke besok. */
  onLeft?: () => void
  rightLabel?: string
  leftLabel?: string
  className?: string
}

const THRESHOLD = 0.3
const MAX_RATIO = 0.6

/**
 * Baris yang bisa digeser dengan jari (bukan mouse): kanan = aksi hijau, kiri = aksi biru.
 * Gulir vertikal tetap jalan (touch-action: pan-y). Tombol di dalam baris tetap bisa diketuk.
 */
export function SwipeRow({ children, onRight, onLeft, rightLabel = 'Selesai', leftLabel = 'Besok', className = '' }: SwipeRowProps) {
  const [dx, setDx] = useState(0)
  const [dragging, setDragging] = useState(false)
  const start = useRef<{ x: number; y: number; id: number; locked: boolean | null } | null>(null)
  const moved = useRef(false)
  const width = useRef(1)
  // Lebar baris juga disimpan sebagai state supaya tampilan (opasitas latar) tidak membaca ref saat render.
  const [w, setW] = useState(1)

  const reset = () => {
    setDragging(false)
    setDx(0)
    start.current = null
  }

  const onPointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if (e.pointerType === 'mouse' || (!onRight && !onLeft)) return
    start.current = { x: e.clientX, y: e.clientY, id: e.pointerId, locked: null }
    width.current = e.currentTarget.offsetWidth || 1
    setW(width.current)
    moved.current = false
  }
  const onPointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    const s = start.current
    if (!s || s.id !== e.pointerId) return
    const x = e.clientX - s.x
    const y = e.clientY - s.y
    if (s.locked === null) {
      if (Math.abs(x) < 8 && Math.abs(y) < 8) return
      // Arah dikunci sekali: horizontal = geser baris, vertikal = gulir halaman.
      s.locked = Math.abs(x) > Math.abs(y)
      if (!s.locked) return reset()
      try {
        e.currentTarget.setPointerCapture(e.pointerId)
      } catch {
        // Sebagian browser menolak capture untuk pointer yang sudah tidak aktif; geser tetap jalan tanpanya.
      }
      setDragging(true)
    }
    if (!s.locked) return
    moved.current = true
    const allowed = (x > 0 && onRight) || (x < 0 && onLeft) ? x : x / 6
    const max = width.current * MAX_RATIO
    setDx(Math.max(-max, Math.min(max, allowed)))
  }
  const onPointerUp = () => {
    const s = start.current
    if (!s) return
    const ratio = dx / width.current
    if (ratio > THRESHOLD && onRight) {
      setDragging(false)
      setDx(width.current)
      window.setTimeout(() => {
        onRight()
        reset()
      }, 180)
    } else if (ratio < -THRESHOLD && onLeft) {
      setDragging(false)
      setDx(-width.current)
      window.setTimeout(() => {
        onLeft()
        reset()
      }, 180)
    } else reset()
  }

  const progress = Math.min(1, Math.abs(dx) / (w * THRESHOLD))
  return (
    <li className={`relative overflow-hidden ${className}`}>
      {dx !== 0 && (
        <div
          aria-hidden="true"
          className={`absolute inset-0 flex items-center px-4 text-[13px] font-semibold text-white ${dx > 0 ? 'justify-start bg-ok' : 'justify-end bg-koas'}`}
          style={{ opacity: 0.35 + 0.65 * progress }}
        >
          {dx > 0 ? (
            <span className="flex items-center gap-1.5" style={{ transform: `scale(${0.85 + 0.15 * progress})` }}>
              <Check size={16} aria-hidden="true" /> {rightLabel}
            </span>
          ) : (
            <span className="flex items-center gap-1.5" style={{ transform: `scale(${0.85 + 0.15 * progress})` }}>
              {leftLabel} <ArrowRight size={16} aria-hidden="true" />
            </span>
          )}
        </div>
      )}
      <div
        className={`relative bg-surface ${dragging ? '' : 'transition-transform duration-200 ease-out'}`}
        style={{ transform: dx ? `translateX(${dx}px)` : undefined, touchAction: 'pan-y' }}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={reset}
        onClickCapture={(e) => {
          // Ketukan setelah menggeser tidak dihitung sebagai klik.
          if (moved.current) {
            e.stopPropagation()
            e.preventDefault()
            moved.current = false
          }
        }}
      >
        {children}
      </div>
    </li>
  )
}
