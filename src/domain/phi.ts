/**
 * Deteksi pola mirip identitas pasien (dari MBAPPE OS): No. RM, angka ≥ 6 digit,
 * sapaan klinis + nama (Tn./Ny./Nn./An./By./Sdr. …). Wajib di semua kolom teks karena data
 * tersinkron ke server dan dibaca Claude.
 */
const PHI_RULES: { re: RegExp; reason: string }[] = [
  { re: /\bno\.?\s*r\.?\s*m\b/i, reason: 'No. RM' },
  { re: /\brm\s*[:#.]?\s*\d{3,}/i, reason: 'nomor RM' },
  { re: /\b\d{6,}\b/, reason: 'angka ≥ 6 digit' },
  { re: /\b(tn|ny|nn|sdr|sdri|an|by)\.\s*[a-z]{2,}/i, reason: 'sapaan + nama pasien' },
]

export const PHI_HINT = 'Jangan tulis identitas pasien (nama, No. RM, alamat, tanggal lahir). Pakai inisial kasus saja.'

/** Alasan pertama yang cocok, atau `null` bila aman. */
export function detectPatientIdentity(text: string): string | null {
  for (const rule of PHI_RULES) if (rule.re.test(text)) return rule.reason
  return null
}
