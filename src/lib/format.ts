/** `1240000` → "Rp1.240.000". */
export function formatRupiah(amount: number): string {
  const sign = amount < 0 ? '−' : ''
  return `${sign}Rp${Math.abs(Math.round(amount)).toLocaleString('id-ID')}`
}

/** `4500000` → "4,5 jt". */
export function formatRupiahShort(amount: number): string {
  const a = Math.abs(amount)
  if (a >= 1e6) return `${(amount / 1e6).toLocaleString('id-ID', { maximumFractionDigits: 1 })} jt`
  if (a >= 1e3) return `${Math.round(amount / 1e3).toLocaleString('id-ID')} rb`
  return amount.toLocaleString('id-ID')
}

export function formatNumber(n: number, digits = 0): string {
  return n.toLocaleString('id-ID', { maximumFractionDigits: digits })
}
