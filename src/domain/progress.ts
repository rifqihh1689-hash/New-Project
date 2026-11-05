import type { DayResult, ISODate, XpRules } from '../types'
import { isNeutralDayType } from './dayType'
import { addDays } from './time'

export type DayStatus = 'pass' | 'neutral' | 'fail'

/** Lolos → menambah streak. Jaga/pasca-jaga → netral (tidak memutus, tidak menambah). Selain itu memutus. */
export function dayStatus(result: Pick<DayResult, 'pass' | 'effType'> | null | undefined): DayStatus {
  if (!result) return 'fail'
  if (result.pass) return 'pass'
  if (isNeutralDayType(result.effType)) return 'neutral'
  return 'fail'
}

/**
 * Streak = hari lolos berturut-turut sampai hari ini.
 * Hari ini yang belum lolos tidak memutus (hari belum selesai). Hari tanpa catatan memutus.
 * `firstDate` = hari pertama yang tercatat; sebelum itu tidak dihitung.
 */
export function computeStreak(
  today: ISODate,
  firstDate: ISODate | null,
  statusOf: (date: ISODate) => DayStatus,
): { current: number; best: number } {
  if (!firstDate || firstDate > today) return { current: 0, best: 0 }
  let current = 0
  let d = statusOf(today) === 'fail' ? addDays(today, -1) : today
  while (d >= firstDate) {
    const st = statusOf(d)
    if (st === 'pass') current++
    else if (st === 'fail') break
    d = addDays(d, -1)
  }
  let best = 0
  let run = 0
  for (let k = firstDate; k <= today; k = addDays(k, 1)) {
    const st = statusOf(k)
    if (st === 'pass') {
      run++
      best = Math.max(best, run)
    } else if (st === 'fail' && k !== today) run = 0
  }
  return { current, best: Math.max(best, current) }
}

/** Level L → L+1 butuh `150 + 50·L` XP. */
export function levelFromXp(
  totalXp: number,
  rules: Pick<XpRules, 'levelBase' | 'levelStep'>,
): { level: number; into: number; need: number } {
  let level = 1
  let rem = Math.max(0, totalXp)
  for (;;) {
    const need = rules.levelBase + rules.levelStep * level
    if (rem < need || level >= 999) return { level, into: rem, need }
    rem -= need
    level++
  }
}

/** Persentase hari "selesai" dalam rentang (untuk konsistensi mutaba'ah 7 & 30 hari). */
export function consistency(doneDates: Iterable<ISODate>, today: ISODate, days: number): { done: number; total: number } {
  const from = addDays(today, -(days - 1))
  let done = 0
  for (const d of new Set(doneDates)) if (d >= from && d <= today) done++
  return { done, total: days }
}
