import { X } from 'lucide-react'
import { useEffect, useId, useRef, type ReactNode } from 'react'
import { useVisualViewport } from '../app/useVisualViewport'

interface SheetProps {
  open: boolean
  title: string
  onClose: () => void
  children: ReactNode
}

/** Lembar bawah di HP, dialog di tengah pada layar lebar. Esc / ketuk latar untuk menutup. */
export function Sheet({ open, title, onClose, children }: SheetProps) {
  const titleId = useId()
  const panel = useRef<HTMLDivElement>(null)
  const vv = useVisualViewport()
  // onClose biasanya fungsi baru tiap render. Disimpan di ref supaya efek fokus di bawah hanya jalan saat
  // lembar dibuka: dulu tiap data dimuat ulang (simpan, sinkron), kursor melompat ke kolom pertama.
  const close = useRef(onClose)
  useEffect(() => {
    close.current = onClose
  })
  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && close.current()
    document.addEventListener('keydown', onKey)
    const previous = document.activeElement as HTMLElement | null
    panel.current?.querySelector<HTMLElement>('input, textarea, select, button:not([data-close])')?.focus()
    return () => {
      document.removeEventListener('keydown', onKey)
      previous?.focus?.()
    }
  }, [open])
  if (!open) return null
  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center md:items-center"
      // Papan ketik terbuka: lembar duduk tepat di atasnya.
      style={vv?.keyboard ? { bottom: vv.keyboard } : undefined}
      role="presentation"
    >
      <button type="button" aria-label="Tutup" className="animate-fade-in absolute inset-0 bg-black/45" onClick={onClose} data-close />
      <div
        ref={panel}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        // Tinggi maksimum dari area yang terlihat (papan ketik terbuka = lebih pendek), selalu di bawah status bar.
        style={{ maxHeight: `min(88dvh, calc(${vv ? `${vv.height}px` : '100dvh'} - var(--safe-top) - 12px))` }}
        className="animate-slide-up relative w-full overflow-y-auto overscroll-contain rounded-t-[22px] border border-line bg-surface p-5 pb-[calc(1.25rem+var(--safe-bottom))] md:max-w-md md:rounded-[22px]"
      >
        <div className="mb-4 flex items-center gap-3">
          <h2 id={titleId} className="flex-1 text-base font-semibold">
            {title}
          </h2>
          <button type="button" onClick={onClose} className="btn-ghost -mr-2 p-2" aria-label="Tutup" data-close>
            <X size={18} aria-hidden="true" />
          </button>
        </div>
        {children}
      </div>
    </div>
  )
}
