import type { Day, DayType, ISODate, RitmeSlot } from '../types'
import { weekday } from './time'

export type JagaShift = 'pagi' | 'malam'

export const JAGA_SHIFTS: Record<JagaShift, { label: string; range: string; start: string; end: string }> = {
  pagi: { label: 'Jaga pagi', range: '07.00–19.00', start: '07.00', end: '19.00' },
  malam: { label: 'Jaga malam', range: '19.00–07.00', start: '19.00', end: '07.00' },
}

export const isJagaShift = (v: unknown): v is JagaShift => v === 'pagi' || v === 'malam'

/** Sabtu atau Minggu: tidak ada jam stase, jaga bisa pagi atau malam. */
export const isWeekend = (date: ISODate) => weekday(date) === 0 || weekday(date) === 6

/**
 * Shift yang berlaku di tanggal itu. Hanya Sabtu/Minggu yang dibagi jaga pagi & malam; hari kerja selalu jaga
 * sepulang stase (15.00–07.00, besoknya pasca-jaga), jadi shift yang tersimpan diabaikan.
 */
export function shiftOn(date: ISODate, shift: JagaShift | null | undefined): JagaShift | null {
  return isWeekend(date) ? (shift ?? null) : null
}

/** Rentang jaga hari kerja untuk teks. */
export const JAGA_HARI_KERJA_RANGE = '15.00–07.00'

/** Label jaga menurut shift ("Jaga pagi", "Jaga malam"); "Jaga" bila belum dipilih. */
export const jagaLabel = (shift: JagaShift | null | undefined) => (shift ? JAGA_SHIFTS[shift].label : 'Jaga')

/**
 * Tipe hari yang diwariskan ke besok untuk menentukan pasca-jaga. Setelah jaga pagi (pulang 19.00) tidak ada
 * pasca-jaga: besoknya hari biasa. Jaga malam (atau shift yang belum dipilih) → besoknya pasca-jaga.
 */
export function carryType(day: Pick<Day, 'type' | 'jagaShift' | 'date'> | null | undefined): DayType | null {
  if (!day) return null
  return day.type === 'jaga' && shiftOn(day.date, day.jagaShift) === 'pagi' ? null : day.type
}

/** Jaga malam di hari kerja (Senin–Jumat) mulai pukul ini sampai 07.00, apa pun jam pulang stase. */
export const JAGA_HARI_KERJA_START = '15.00'

/** Ritme jaga pagi: serah terima 07.00 dan 19.00, lalu malam seperti biasa (bukan pasca-jaga). */
export const JAGA_PAGI_RITME: RitmeSlot[] = [
  { time: '03.45', title: 'Qiyamul lail' },
  { time: '07.00', until: '19.00', title: 'Jaga pagi', note: 'serah terima 07.00 & 19.00', roleId: '#role:koas', work: true, fixed: true },
  { time: '19.30', title: 'Makan & mandi', roleId: '#role:pulih' },
  { time: '21.00', title: 'Tidur', note: 'bukan pasca-jaga: target ≥ 6 j', roleId: '#role:pulih' },
]
