import { useState, type InputHTMLAttributes } from 'react'
import { normalizeClock, typeClock } from '../domain/ritme'

type BaseProps = Omit<InputHTMLAttributes<HTMLInputElement>, 'value' | 'defaultValue' | 'onChange' | 'type' | 'inputMode'>

/**
 * Kolom jam `HH.MM` untuk papan angka HP, yang tidak punya titik: cukup ketik "2000" → "20.00",
 * "930" → "9.30". Saat keluar kolom dirapikan ("20" → "20.00", "9.3" → "09.30").
 * Pemanggil memvalidasi/menyimpan dengan `normalizeClock(value)`.
 */
export function TimeField({
  value,
  onChange,
  onBlur,
  className = 'field',
  placeholder = '19.00',
  ...rest
}: BaseProps & { value: string; onChange: (value: string) => void }) {
  return (
    <input
      {...rest}
      className={`${className} tabular-nums`}
      inputMode="numeric"
      autoComplete="off"
      enterKeyHint="done"
      placeholder={placeholder}
      value={value}
      onChange={(e) => onChange(typeClock(e.target.value))}
      onBlur={(e) => {
        const n = normalizeClock(value)
        if (n && n !== value) onChange(n)
        onBlur?.(e)
      }}
    />
  )
}

/**
 * Varian yang menyimpan saat keluar kolom (untuk Setelan): `onCommit` menerima `HH.MM`, atau `null`
 * bila dikosongkan. Isian yang tidak dikenali dikembalikan ke nilai semula.
 */
export function TimeCommitField({
  initial,
  onCommit,
  ...rest
}: Omit<BaseProps, 'onBlur'> & { initial?: string | null; onCommit: (value: string | null) => void }) {
  const [text, setText] = useState(initial ?? '')
  return (
    <TimeField
      {...rest}
      value={text}
      onChange={setText}
      onBlur={() => {
        if (!text.trim()) return onCommit(null)
        const n = normalizeClock(text)
        if (!n) return setText(initial ?? '')
        onCommit(n)
      }}
    />
  )
}
