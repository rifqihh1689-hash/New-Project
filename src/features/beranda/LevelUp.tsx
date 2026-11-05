import { Gift } from 'lucide-react'
import { useEffect, useState } from 'react'
import { navigate } from '../../app/router'

const KEY = 'qawwam:level-terakhir'
const COLORS = [
  'var(--color-koas)',
  'var(--color-ukmppd)',
  'var(--color-orto)',
  'var(--color-tentir)',
  'var(--color-pulih)',
  'var(--color-uang)',
]

/**
 * Perayaan naik level, sekali per level per perangkat. Level pertama yang terlihat hanya dicatat
 * (tanpa perayaan), supaya membuka app di HP baru tidak memicu perayaan lama.
 */
export function LevelUp({ level, tokens }: { level: number; tokens: number }) {
  // Level terakhir yang sudah dirayakan di perangkat ini; pertama kali = level sekarang (tanpa perayaan).
  const [seen, setSeen] = useState(() => Number(localStorage.getItem(KEY)) || level)
  useEffect(() => {
    if (!localStorage.getItem(KEY)) localStorage.setItem(KEY, String(seen))
  }, [seen])
  if (level <= seen) return null
  const shown = level
  const close = () => {
    localStorage.setItem(KEY, String(level))
    setSeen(level)
  }
  return (
    <div className="fixed inset-0 z-[70] grid place-items-center p-6" role="dialog" aria-modal="true" aria-labelledby="levelup-title">
      <button type="button" aria-label="Tutup" className="animate-fade-in absolute inset-0 bg-black/55" onClick={close} />
      <div className="animate-pop-in relative w-full max-w-xs rounded-[22px] border border-line bg-surface p-6 text-center">
        <div className="relative mx-auto mb-3 grid size-20 place-items-center">
          {Array.from({ length: 16 }, (_, i) => (
            <span
              key={i}
              aria-hidden="true"
              className="animate-burst absolute top-1/2 left-1/2 -mt-1 -ml-1 size-2 rounded-full"
              style={
                {
                  background: COLORS[i % COLORS.length],
                  '--a': `${(360 / 16) * i}deg`,
                  '--d': `${70 + (i % 3) * 18}px`,
                  animationDelay: `${(i % 4) * 30}ms`,
                } as React.CSSProperties
              }
            />
          ))}
          <div className="animate-check-pop grid size-20 place-items-center rounded-full bg-tentir text-3xl font-bold text-white">
            {shown}
          </div>
        </div>
        <div className="text-xs font-medium tracking-wide text-muted uppercase">Naik level</div>
        <h2 id="levelup-title" className="mt-1 text-2xl font-semibold">
          Level {shown}
        </h2>
        <p className="mt-2 text-[13.5px] text-muted">
          +1 token hadiah{tokens > 1 ? ` (punya ${tokens})` : ''}. Hadiah untuk pemulihan, bukan volume: pilih yang benar-benar kamu tunggu.
        </p>
        <div className="mt-5 grid gap-2">
          <button
            type="button"
            className="btn-primary py-3"
            onClick={() => {
              close()
              navigate('hadiah')
            }}
          >
            <Gift size={16} aria-hidden="true" /> Lihat hadiah
          </button>
          <button type="button" className="btn-ghost" onClick={close}>
            Nanti
          </button>
        </div>
      </div>
    </div>
  )
}
