interface CheckProps {
  checked: boolean
  onChange: () => void
  label: string
  disabled?: boolean
  /** `ok` = hijau (tugas), `muted` = abu-abu netral (mutaba'ah, tanpa skor). */
  tone?: 'ok' | 'muted'
  size?: 'md' | 'sm'
}

/** Lingkaran centang besar ala prototipe. */
export function Check({ checked, onChange, label, disabled, tone = 'ok', size = 'md' }: CheckProps) {
  const dim = size === 'md' ? 'size-5' : 'size-[18px]'
  const fill = tone === 'ok' ? 'border-ok bg-ok' : 'border-muted bg-muted'
  return (
    <button
      type="button"
      role="checkbox"
      aria-checked={checked}
      aria-label={label}
      disabled={disabled}
      onClick={onChange}
      className={`${dim} relative grid shrink-0 place-items-center rounded-full border-[1.5px] transition disabled:cursor-default ${
        checked ? fill : 'border-faint hover:border-muted'
      }`}
    >
      {checked && (
        <svg viewBox="0 0 12 12" className="size-[11px] text-white dark:text-surface" aria-hidden="true">
          <path d="M2.5 6.2 5 8.5l4.5-5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      )}
    </button>
  )
}
