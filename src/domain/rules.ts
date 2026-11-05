import type { XpRules } from '../types'

/** Aturan bawaan, sama dengan MBAPPE OS (levelup) schemaVersion 2. */
export const DEFAULT_RULES: XpRules = {
  xpSize: { kecil: 5, sedang: 10, besar: 20 },
  dailyCap: 100,
  sleepTiers: [
    { min: 6.5, mult: 1.2 },
    { min: 6, mult: 1.0 },
    { min: 5, mult: 0.8 },
    { min: 0, mult: 0.6 },
  ],
  sleepQuestMin: 6,
  napCounts: true,
  worstCaseEmpty: true,
  passPct: 60,
  jagaMult: 1.0,
  pascaXP: 100,
  overtimePenalty: 15,
  levelBase: 150,
  levelStep: 50,
  backfillDays: 1,
  reviewXP: 50,
}

/** Gabungkan aturan tersimpan dengan bawaan. Nilai yang melanggar pagar pengaman diabaikan. */
export function resolveRules(stored: Partial<XpRules> | undefined): XpRules {
  const rules: XpRules = { ...DEFAULT_RULES, ...stored }
  if (!isValidSleepTiers(rules.sleepTiers)) rules.sleepTiers = DEFAULT_RULES.sleepTiers
  if (!(rules.pascaXP <= rules.dailyCap)) rules.pascaXP = Math.min(DEFAULT_RULES.pascaXP, rules.dailyCap)
  return rules
}

/**
 * Pagar pengaman dari MBAPPE OS: pengali wajib naik seiring jam tidur dan tier terpendek ≤ ×1,0,
 * supaya Setelan tidak bisa dijadikan jalan pintas "menang dengan tidur lebih sedikit".
 */
export function isValidSleepTiers(tiers: { min: number; mult: number }[]): boolean {
  if (!Array.isArray(tiers) || tiers.length === 0) return false
  const sorted = [...tiers].sort((a, b) => a.min - b.min)
  if (sorted[0].mult > 1) return false
  for (let i = 1; i < sorted.length; i++) {
    if (sorted[i].min === sorted[i - 1].min || sorted[i].mult < sorted[i - 1].mult) return false
  }
  return true
}
