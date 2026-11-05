import type { DayResult, DayType, Habit, WorkEnd, XpRules, XpSize } from '../types'
import { effectiveDayType } from './dayType'
import { sleepMultiplier, sleepTotal } from './sleep'
import { weekday } from './time'

/** Satu baris di daftar harian: tugas atau habit. */
export interface DayItem {
  id: string
  size: XpSize
  done: boolean
  /** Milik peran pemulihan (Tubuh & pulih). */
  recovery: boolean
  /** `sleep` & `workend` dinilai otomatis, bukan dari centang. */
  kind?: Habit['kind'] | 'tentir'
  /**
   * Quest mingguan: `done` hanya benar di hari pertama selesai minggu itu. XP-nya ditambahkan (ikut batas harian),
   * tetapi tidak masuk syarat lolos. Di pasca-jaga tidak dihitung.
   */
  weekly?: boolean
}

export interface DayInput {
  type: DayType | null
  /** Tipe hari kemarin, untuk memeriksa pasca-jaga. */
  prevType: DayType | null
  sleepNight: number | null
  nap: number
  workEnd: WorkEnd | null
  items: DayItem[]
}

const EPS = 1e-9

export const EMPTY_RESULT: DayResult = {
  xp: 0,
  gross: 0,
  base: 0,
  capped: 0,
  mult: 1,
  multMissing: false,
  penalty: 0,
  pass: false,
  total: 0,
  doneCount: 0,
  effType: null,
  invalidPasca: false,
}

/** Status selesai sebuah item, termasuk habit otomatis (tidur & jam berhenti kerja). */
export function isItemDone(item: DayItem, input: Pick<DayInput, 'sleepNight' | 'nap' | 'workEnd'>, rules: XpRules): boolean {
  if (item.kind === 'sleep') {
    const total = sleepTotal(input.sleepNight, input.nap, rules)
    return total != null && total >= rules.sleepQuestMin - EPS
  }
  if (item.kind === 'workend') return input.workEnd === 'ok'
  return item.done
}

/** Item yang dihitung pada tipe hari tertentu: pasca-jaga hanya berisi pemulihan. */
export function itemsForDay<T extends { recovery: boolean }>(items: T[], effType: DayType | null): T[] {
  return effType === 'pasca' ? items.filter((i) => i.recovery) : items
}

/**
 * Rumus XP MBAPPE OS:
 * - STASE / LIBUR: `round(min(Σ XP selesai, 100) × pengali tidur) − 15·[lewat batas kerja malam, bawaan 21.00]`
 * - JAGA: `round(min(Σ, 100) × 1,0)`, tanpa penalti malam.
 * - PASCA-JAGA: `round(100 × selesai/total) − penalti`, hanya sah bila kemarin jaga.
 * - Lolos bila selesai/total ≥ 60%.
 * - Quest mingguan: XP di hari pertama selesai saja, di luar syarat lolos.
 * `final` = hari sudah terkunci: jam berhenti kerja yang kosong dianggap lewat batas.
 * Batas kerja malam bisa diubah atau dimatikan (`workEndLimit`).
 */
export function computeDay(input: DayInput, rules: XpRules, opts: { final?: boolean } = {}): DayResult {
  if (!input.type) return { ...EMPTY_RESULT }
  const { type: effType, invalidPasca } = effectiveDayType(input.type, input.prevType)
  const items = itemsForDay(
    input.items.filter((i) => !i.weekly),
    effType,
  )
  const weeklyDone = effType === 'pasca' ? [] : input.items.filter((i) => i.weekly && i.done)
  const done = items.filter((i) => isItemDone(i, input, rules))
  const total = items.length
  const doneCount = done.length
  const ratio = total ? doneCount / total : 0
  const pass = total > 0 && ratio >= rules.passPct / 100 - EPS

  // Batas kerja malam bisa dimatikan (workEndLimit = null): tanpa penalti dan tanpa "kosong = lewat".
  const nightNonJaga = input.type !== 'jaga' && rules.workEndLimit != null
  const autoLate = !!opts.final && rules.worstCaseEmpty && nightNonJaga && input.workEnd == null
  const overtime = nightNonJaga && (input.workEnd === 'late' || autoLate)
  const penalty = overtime ? rules.overtimePenalty : 0

  let base = 0
  let capped = 0
  let mult = 1
  let multMissing = false
  let gross = 0
  if (effType === 'pasca') {
    gross = total ? Math.round(rules.pascaXP * ratio) : 0
    base = gross
    capped = gross
  } else {
    base = [...done, ...weeklyDone].reduce((sum, i) => sum + (rules.xpSize[i.size] ?? 0), 0)
    capped = Math.min(base, rules.dailyCap)
    if (effType === 'jaga') mult = rules.jagaMult
    else {
      const sm = sleepMultiplier(sleepTotal(input.sleepNight, input.nap, rules), rules)
      mult = sm.mult
      multMissing = sm.missing
    }
    gross = Math.round(capped * mult)
  }
  return { xp: gross - penalty, gross, base, capped, mult, multMissing, penalty, pass, total, doneCount, effType, invalidPasca }
}

/** XP satu item untuk ditampilkan di samping judulnya. */
export function itemXp(size: XpSize, effType: DayType | null, totalItems: number, rules: XpRules): number {
  if (effType === 'pasca') return totalItems ? Math.round(rules.pascaXP / totalItems) : 0
  return rules.xpSize[size] ?? 0
}

/** Habit yang berlaku pada tanggal & tipe hari tertentu. */
export function habitsForDay<T extends Pick<Habit, 'active' | 'dayTypes' | 'weekdays'>>(
  habits: T[],
  date: string,
  type: DayType | null,
): T[] {
  if (!type) return []
  const wd = weekday(date)
  return habits.filter((h) => h.active && h.dayTypes.includes(type) && (h.weekdays.length === 0 || h.weekdays.includes(wd)))
}

/** Hari lewat jendela isi mundur dikunci dan dibekukan. */
export function isLocked(date: string, today: string, rules: Pick<XpRules, 'backfillDays'>): boolean {
  return Date.parse(`${today}T00:00:00Z`) - Date.parse(`${date}T00:00:00Z`) > rules.backfillDays * 86_400_000
}
