/** Input nominal Rupiah dengan pemisah ribuan saat diketik. */
export function AmountField({
  label,
  value,
  onChange,
  autoFocus,
  large,
}: {
  label: string
  value: number
  onChange: (n: number) => void
  autoFocus?: boolean
  large?: boolean
}) {
  return (
    <label className="block text-xs text-muted">
      {label}
      <span className="relative mt-1 block">
        <span
          aria-hidden="true"
          className={`pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 font-semibold text-faint ${large ? 'text-lg' : ''}`}
        >
          Rp
        </span>
        <input
          className={`field tabular-nums ${large ? 'py-3 pl-11 text-2xl font-semibold' : 'pl-9'}`}
          aria-label={label}
          inputMode="numeric"
          autoComplete="off"
          autoFocus={autoFocus}
          placeholder="0"
          value={value ? value.toLocaleString('id-ID') : ''}
          onChange={(e) => onChange(Number(e.target.value.replace(/[^\d]/g, '')) || 0)}
        />
      </span>
    </label>
  )
}
