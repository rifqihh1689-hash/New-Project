import type { XpRules } from '../types'

/**
 * Total tidur 24 jam = tidur malam sebelumnya + qailulah hari ini (bila diaktifkan).
 * Bangun ±03.45 untuk qiyamul lail membuat tidur malam pendek; qailulah setelah stase menutupnya,
 * jadi ibadah tidak pernah diadu dengan poin. `null` bila tidur malam belum diisi.
 */
export function sleepTotal(sleepNight: number | null, nap: number, rules: Pick<XpRules, 'napCounts'>): number | null {
  if (sleepNight == null || Number.isNaN(sleepNight)) return null
  return sleepNight + (rules.napCounts ? nap || 0 : 0)
}

const EPS = 1e-9

function tiersDesc(rules: Pick<XpRules, 'sleepTiers'>) {
  return [...rules.sleepTiers].sort((a, b) => b.min - a.min)
}

/** Pengali XP dari total tidur. Data kosong = skenario terburuk (tier terendah). */
export function sleepMultiplier(
  total: number | null,
  rules: Pick<XpRules, 'sleepTiers' | 'worstCaseEmpty'>,
): { mult: number; missing: boolean } {
  const tiers = tiersDesc(rules)
  const lowest = tiers[tiers.length - 1].mult
  if (total == null || Number.isNaN(total)) return { mult: rules.worstCaseEmpty ? lowest : 1, missing: true }
  for (const t of tiers) if (total >= t.min - EPS) return { mult: t.mult, missing: false }
  return { mult: lowest, missing: false }
}

/**
 * Berapa menit qailulah lagi untuk naik ke tier berikutnya. `null` bila sudah di tier tertinggi
 * atau tidur malam belum diisi. Ditampilkan sebagai ajakan pulih, bukan tuntutan.
 */
export function napToNextTier(
  total: number | null,
  rules: Pick<XpRules, 'sleepTiers' | 'worstCaseEmpty'>,
): { minutes: number; mult: number } | null {
  if (total == null) return null
  const next = [...rules.sleepTiers].sort((a, b) => a.min - b.min).find((t) => t.min > total + EPS)
  if (!next) return null
  return { minutes: Math.ceil((next.min - total) * 60 - EPS), mult: next.mult }
}

/** `0.8` → "×0,8". */
export function formatMultiplier(mult: number): string {
  return '×' + mult.toLocaleString('id-ID', { minimumFractionDigits: 1, maximumFractionDigits: 2 })
}
