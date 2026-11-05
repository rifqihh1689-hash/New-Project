import type { DayType, Habit, HabitLog, ISODate, WorkEnd, XpRules } from '../types'
import { addDays, weekday } from './time'
import { habitsForDay, isItemDone, isLocked } from './xp'

export interface DayInfo {
  type: DayType | null
  sleepNight: number | null
  nap: number
  workEnd: WorkEnd | null
}

export interface HabitCell {
  date: ISODate
  /** `null` = tipe hari belum dipilih, jadi belum tahu berlaku atau tidak. */
  applies: boolean | null
  done: boolean
  minutes: number
  editable: boolean
  locked: boolean
  isToday: boolean
}

/** Tanggal 7 hari terakhir, dari yang terlama sampai hari ini. */
export function lastDays(today: ISODate, n = 7): ISODate[] {
  return Array.from({ length: n }, (_, i) => addDays(today, i - (n - 1)))
}

/** Inisial hari ala kalender Indonesia: M S S R K J S. */
export function dayInitial(date: ISODate): string {
  return 'MSSRKJS'[weekday(date)]
}

const EMPTY_DAY: DayInfo = { type: null, sleepNight: null, nap: 0, workEnd: null }

/**
 * Satu kotak di grid habit. Habit otomatis (tidur, jam berhenti kerja) dinilai dari isian hari itu
 * dan tidak bisa dicentang. Hari terkunci (lewat jendela isi mundur) hanya bisa dilihat.
 */
export function habitCell(
  habit: Pick<Habit, 'active' | 'dayTypes' | 'weekdays' | 'kind' | 'size'>,
  date: ISODate,
  day: DayInfo | undefined,
  log: Pick<HabitLog, 'done' | 'minutes'> | undefined,
  today: ISODate,
  rules: XpRules,
): HabitCell {
  const info = day ?? EMPTY_DAY
  const applies = info.type ? habitsForDay([{ ...habit, active: true }], date, info.type).length > 0 : null
  const auto = habit.kind === 'sleep' || habit.kind === 'workend'
  const done = auto ? isItemDone({ id: '', size: habit.size, done: false, recovery: true, kind: habit.kind }, info, rules) : !!log?.done
  const locked = isLocked(date, today, rules)
  return {
    date,
    applies,
    done,
    minutes: log?.minutes ?? 0,
    editable: !auto && !locked && applies !== false && date <= today,
    locked,
    isToday: date === today,
  }
}

/** Ringkasan baris: berapa hari selesai dari hari yang berlaku (hari tanpa tipe dihitung bila dicentang). */
export function habitRowSummary(cells: HabitCell[]): { done: number; applicable: number } {
  const relevant = cells.filter((c) => c.applies === true || (c.applies === null && c.done))
  return { done: relevant.filter((c) => c.done).length, applicable: relevant.length }
}

/** Status setelah menambah menit: selesai bila mencapai target. */
export function applyMinutes(current: number, delta: number, target: number | null): { minutes: number; done: boolean } {
  const minutes = Math.max(0, Math.round(current + delta))
  return { minutes, done: target ? minutes >= target : minutes > 0 }
}
