import type { ISODate, MonthKey } from '../types'

/** WIB = UTC+7, tidak bergantung zona waktu perangkat. */
export const WIB_OFFSET_MS = 7 * 3600_000
/** Hari berganti pukul 03.00 WIB: begadang sampai 02.00 masih dihitung "hari ini". */
export const ROLLOVER_HOUR = 3

export const DAY_NAMES = ['Minggu', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu'] as const
export const DAY_SHORT = ['Min', 'Sen', 'Sel', 'Rab', 'Kam', 'Jum', 'Sab'] as const
export const MONTH_NAMES = [
  'Januari',
  'Februari',
  'Maret',
  'April',
  'Mei',
  'Juni',
  'Juli',
  'Agustus',
  'September',
  'Oktober',
  'November',
  'Desember',
] as const

const pad = (n: number) => String(n).padStart(2, '0')

/** Tanggal Qawwam untuk sebuah waktu: WIB, berganti pukul 03.00. */
export function dayKey(nowMs: number = Date.now()): ISODate {
  return new Date(nowMs + WIB_OFFSET_MS - ROLLOVER_HOUR * 3600_000).toISOString().slice(0, 10)
}

/** Jam dinding WIB dalam menit sejak 00.00 (tanpa pergeseran 03.00). */
export function wibMinutes(nowMs: number = Date.now()): number {
  const d = new Date(nowMs + WIB_OFFSET_MS)
  return d.getUTCHours() * 60 + d.getUTCMinutes()
}

/** `HH.MM` / `HH:MM` → menit sejak 00.00. `null` bila tidak valid. */
export function parseClock(value: string): number | null {
  const m = /^(\d{1,2})[.:](\d{2})$/.exec(value.trim())
  if (!m) return null
  const h = Number(m[1])
  const min = Number(m[2])
  if (h > 23 || min > 59) return null
  return h * 60 + min
}

export function addDays(date: ISODate, n: number): ISODate {
  return new Date(Date.parse(`${date}T00:00:00Z`) + n * 86_400_000).toISOString().slice(0, 10)
}

export function diffDays(a: ISODate, b: ISODate): number {
  return Math.round((Date.parse(`${a}T00:00:00Z`) - Date.parse(`${b}T00:00:00Z`)) / 86_400_000)
}

/** 0 = Minggu … 6 = Sabtu. */
export function weekday(date: ISODate): number {
  return new Date(`${date}T00:00:00Z`).getUTCDay()
}

/** Senin dari minggu tanggal tersebut. */
export function weekStart(date: ISODate): ISODate {
  return addDays(date, -((weekday(date) + 6) % 7))
}

export function weekDates(date: ISODate): ISODate[] {
  const start = weekStart(date)
  return Array.from({ length: 7 }, (_, i) => addDays(start, i))
}

export function monthOf(date: ISODate): MonthKey {
  return date.slice(0, 7)
}

export function isValidISODate(value: unknown): value is ISODate {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false
  const d = new Date(`${value}T00:00:00Z`)
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === value
}

/** "Kamis, 5 November 2026". */
export function formatDateLong(date: ISODate): string {
  const [y, m, d] = date.split('-').map(Number)
  return `${DAY_NAMES[weekday(date)]}, ${d} ${MONTH_NAMES[m - 1]} ${y}`
}

/** "Kam, 5 Nov". */
export function formatDateShort(date: ISODate): string {
  const [, m, d] = date.split('-').map(Number)
  return `${DAY_SHORT[weekday(date)]}, ${d} ${MONTH_NAMES[m - 1].slice(0, 3)}`
}

/** "Hari ini", "Besok", "Kemarin", atau tanggal pendek. */
export function relativeDayLabel(date: ISODate, today: ISODate): string {
  const d = diffDays(date, today)
  if (d === 0) return 'Hari ini'
  if (d === 1) return 'Besok'
  if (d === -1) return 'Kemarin'
  return formatDateShort(date)
}

/** "November 2026". */
export function formatMonth(month: MonthKey): string {
  const [y, m] = month.split('-').map(Number)
  return `${MONTH_NAMES[m - 1]} ${y}`
}

/** Selisih bulan kalender (dibulatkan) dari `from` ke `to`. */
export function monthsBetween(from: ISODate, to: ISODate): number {
  const [y1, m1, d1] = from.split('-').map(Number)
  const [y2, m2, d2] = to.split('-').map(Number)
  return Math.round((y2 - y1) * 12 + (m2 - m1) + (d2 - d1) / 30)
}

/** `5.5` → "5 j 30 m". */
export function formatHours(hours: number): string {
  const totalMin = Math.round(hours * 60)
  const h = Math.floor(totalMin / 60)
  const m = totalMin % 60
  if (h === 0) return `${m} m`
  return `${h} j ${pad(m)} m`
}

/** Menit → "1 j 30 m" / "45 mnt". */
export function formatMinutes(minutes: number): string {
  if (minutes < 60) return `${minutes} mnt`
  return formatHours(minutes / 60)
}
