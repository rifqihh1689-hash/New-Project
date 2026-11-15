import type { CalendarEvent, DayType, ISODate, MonthKey } from '../types'
import type { JagaShift } from './jaga'
import { addDays, daysInMonth, weekday } from './time'

/** 6 minggu × 7 hari (Senin–Minggu) yang memuat seluruh bulan. */
export function monthGrid(month: MonthKey): ISODate[] {
  const first = `${month}-01`
  const offset = (weekday(first) + 6) % 7 // Senin = 0
  const start = addDays(first, -offset)
  return Array.from({ length: 42 }, (_, i) => addDays(start, i))
}

export const monthDates = (month: MonthKey): ISODate[] =>
  Array.from({ length: daysInMonth(month) }, (_, i) => `${month}-${String(i + 1).padStart(2, '0')}`)

export interface DayChange {
  date: ISODate
  type: DayType | null
  /** Shift jaga (hanya untuk type = jaga). */
  shift?: JagaShift | null
}

/**
 * Perubahan tipe hari saat sebuah tanggal dijadikan jaga (on) atau dibatalkan (off).
 * - Jaga malam (atau shift belum dipilih): besoknya otomatis pasca-jaga bila masih kosong (tidak menimpa pilihan yang ada).
 * - Jaga pagi: pulang 19.00, tidak ada pasca-jaga; pasca-jaga besoknya (mis. sisa dari shift malam sebelumnya) dikosongkan.
 * - Batal: tanggal dikosongkan; pasca-jaga besoknya ikut dikosongkan karena pasca hanya sah setelah jaga.
 */
export function jagaChanges(
  date: ISODate,
  on: boolean,
  types: (d: ISODate) => DayType | null,
  shift: JagaShift | null = null,
): DayChange[] {
  const next = addDays(date, 1)
  if (on) {
    const out: DayChange[] = [{ date, type: 'jaga', shift }]
    if (shift === 'pagi') {
      if (types(next) === 'pasca') out.push({ date: next, type: null })
    } else if (!types(next)) out.push({ date: next, type: 'pasca' })
    return out
  }
  const out: DayChange[] = [{ date, type: null }]
  if (types(next) === 'pasca') out.push({ date: next, type: null })
  return out
}

export interface JagaStats {
  count: number
  /** Jaga berurutan tanpa jeda (mis. jaga hari ini dan besok). */
  backToBack: number
  /** Minggu (Senin) dengan ≥ 3 jaga. */
  heavyWeeks: ISODate[]
}

export function jagaStats(month: MonthKey, types: (d: ISODate) => DayType | null): JagaStats {
  const dates = monthDates(month).filter((d) => types(d) === 'jaga')
  const weeks = new Map<ISODate, number>()
  for (const d of dates) {
    const monday = addDays(d, -((weekday(d) + 6) % 7))
    weeks.set(monday, (weeks.get(monday) ?? 0) + 1)
  }
  return {
    count: dates.length,
    backToBack: dates.filter((d) => types(addDays(d, 1)) === 'jaga').length,
    heavyWeeks: [...weeks.entries()].filter(([, n]) => n >= 3).map(([w]) => w),
  }
}

/** Agenda urut jam (tanpa jam di akhir). */
export const sortEvents = (list: CalendarEvent[]) =>
  [...list].sort((a, b) => a.date.localeCompare(b.date) || (a.start ?? '99').localeCompare(b.start ?? '99') || a.createdAt - b.createdAt)
