import { useEffect, useRef, useState } from 'react'

interface CheckProps {
  checked: boolean
  onChange: () => void
  label: string
  disabled?: boolean
  /** `ok` = hijau (tugas), `muted` = abu-abu netral (mutaba'ah, tanpa skor). */
  tone?: 'ok' | 'muted'
  size?: 'md' | 'sm'
}

/**
 * Lingkaran centang besar ala prototipe. Saat berubah jadi tercentang: isian lingkaran "pop", garis centang
 * tergambar, dan riak menyebar. Tombolnya sendiri tidak dipasang ulang, jadi fokus keyboard tetap.
 * Semua animasi mati otomatis bila "Kurangi Gerakan" aktif.
 */
export function Check({ checked, onChange, label, disabled, tone = 'ok', size = 'md' }: CheckProps) {
  const dim = size === 'md' ? 'size-5' : 'size-[18px]'
  const color = tone === 'ok' ? 'bg-ok' : 'bg-muted'
  const prev = useRef(checked)
  const [play, setPlay] = useState(0)
  useEffect(() => {
    // Animasi hanya untuk perubahan belum → selesai, bukan saat pertama tampil.
    if (checked && !prev.current) setPlay((n) => n + 1)
    prev.current = checked
  }, [checked])
  return (
    <button
      type="button"
      role="checkbox"
      aria-checked={checked}
      aria-label={label}
      disabled={disabled}
      onClick={onChange}
      className={`${dim} relative grid shrink-0 place-items-center rounded-full border-[1.5px] transition-[border-color,transform] duration-200 active:scale-90 disabled:cursor-default ${
        checked ? (tone === 'ok' ? 'border-ok' : 'border-muted') : 'border-faint hover:border-muted'
      }`}
    >
      {checked && (
        <span key={play} aria-hidden="true" className="pointer-events-none absolute -inset-[1.5px] grid place-items-center">
          {play > 0 && <span className={`animate-ring absolute inset-0 rounded-full ${color}`} />}
          <span className={`absolute inset-0 rounded-full ${color} ${play ? 'animate-check-pop' : ''}`} />
          <svg viewBox="0 0 12 12" className="relative size-[11px] text-white dark:text-surface">
            <path
              d="M2.5 6.2 5 8.5l4.5-5"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeDasharray={12}
              className={play ? 'animate-check-draw' : ''}
            />
          </svg>
        </span>
      )}
    </button>
  )
}
