import type { ISODate, TentirSession } from '../types'
import { parseQuickTask } from './quickCapture'
import { addDays, parseClock } from './time'

/** Tarif 1:1 bawaan (Rp per jam), bisa diubah di halaman Tentir. */
export const DEFAULT_TENTIR_RATE = 85_000
/** Sesi tentir dianggap tepat waktu bila selesai paling lambat pukul 21.00. */
export const TENTIR_LATE_MIN = 21 * 60

type SessionTime = Pick<TentirSession, 'start' | 'hours'>

/** Menit sejak 00.00 saat sesi selesai; `null` bila jam mulai kosong. */
export function sessionEnd(s: SessionTime): number | null {
  const start = s.start ? parseClock(s.start) : null
  return start == null ? null : start + Math.round(s.hours * 60)
}

/** Menit → "21.30" (lewat tengah malam tetap dihitung dari 00.00 hari itu). */
export function formatClock(minutes: number): string {
  const m = Math.round(minutes)
  return `${String(Math.floor(m / 60) % 24).padStart(2, '0')}.${String(m % 60).padStart(2, '0')}`
}

export function sessionRange(s: SessionTime): string | null {
  const end = sessionEnd(s)
  return end == null ? null : `${s.start}–${formatClock(end)}`
}

/** `true` lewat 21.00, `false` tepat waktu, `null` jam mulai belum diisi. */
export function isLate(s: SessionTime): boolean | null {
  const end = sessionEnd(s)
  return end == null ? null : end > TENTIR_LATE_MIN
}

export interface DayTentir {
  hours: number
  count: number
  /** Semua sesi selesai ≤ 21.00. `null` bila ada sesi tanpa jam mulai. */
  ok: boolean | null
  late: boolean
}

export function dayTentir(sessions: SessionTime[]): DayTentir {
  const states = sessions.map(isLate)
  const late = states.some((x) => x === true)
  return {
    hours: round1(sessions.reduce((a, s) => a + s.hours, 0)),
    count: sessions.length,
    ok: late ? false : states.some((x) => x == null) ? null : sessions.length > 0,
    late,
  }
}

const round1 = (n: number) => Math.round(n * 10) / 10

export interface TentirSummary {
  hours: number
  count: number
  fee: number
  paid: number
  /** Rp per jam rata-rata; `null` bila belum ada jam. */
  perHour: number | null
  late: number
}

export function summarize(sessions: Pick<TentirSession, 'start' | 'hours' | 'fee' | 'paid'>[]): TentirSummary {
  const hours = round1(sessions.reduce((a, s) => a + s.hours, 0))
  const fee = sessions.reduce((a, s) => a + s.fee, 0)
  return {
    hours,
    count: sessions.length,
    fee,
    paid: sessions.filter((s) => s.paid).reduce((a, s) => a + s.fee, 0),
    perHour: hours > 0 ? Math.round(fee / hours) : null,
    late: sessions.filter((s) => isLate(s) === true).length,
  }
}

export type CapacityState = 'kosong' | 'kurang' | 'pas' | 'lewat'

/** Posisi jam seminggu terhadap kuota sampingan (bawaan 9–15 j). */
export function capacityState(hours: number, cap: { min: number; max: number }): CapacityState {
  if (hours <= 0) return 'kosong'
  if (hours < cap.min) return 'kurang'
  if (hours > cap.max) return 'lewat'
  return 'pas'
}

/** Jam tentir per hari Senin–Minggu. */
export function hoursByDay(sessions: Pick<TentirSession, 'date' | 'hours'>[], monday: ISODate): number[] {
  return Array.from({ length: 7 }, (_, i) => {
    const d = addDays(monday, i)
    return round1(sessions.filter((s) => s.date === d).reduce((a, s) => a + s.hours, 0))
  })
}

export interface ParsedTentir {
  student: string
  topic: string
  date: ISODate
  start: string | null
  hours: number
  paid: boolean
}

/**
 * Catat cepat tentir: "AB 2j anatomi 19.00 besok lunas".
 * Inisial = kata pertama berhuruf kapital 1–4; durasi "2j", "1,5 jam", "90m"; jam "19.00"; tanggal seperti tugas.
 */
export function parseTentir(input: string, today: ISODate): ParsedTentir {
  const p = parseQuickTask(input, today, [])
  let text = ` ${p.title} `
  const take = (re: RegExp) => {
    const m = re.exec(text)
    if (m) text = text.slice(0, m.index) + ' ' + text.slice(m.index + m[0].length)
    return m
  }
  let paid = false
  if (take(/\s(lunas|sudah bayar|dibayar)(?=\s)/i)) paid = true
  take(/\s(belum bayar|belum lunas)(?=\s)/i)
  let hours = 1
  const h = take(/\s(\d+(?:[.,]\d+)?)\s*(j|jam|h)(?=\s)/i)
  const m = h ? null : take(/\s(\d{2,3})\s*(m|mnt|menit)(?=\s)/i)
  if (h) hours = Number(h[1].replace(',', '.'))
  else if (m) hours = Number(m[1]) / 60
  hours = Math.max(0.5, Math.min(8, Math.round(hours * 2) / 2))
  const t = take(/\s(?:jam\s+|pukul\s+)?(\d{1,2}[.:]\d{2})(?=\s)/i)
  const start = t && parseClock(t[1]) != null ? t[1].replace(':', '.').padStart(5, '0') : null
  take(/\s(tentir|sesi)(?=\s)/i)
  const ini = take(/\s(murid\s+)?([A-Z]{1,4})(?=\s)/)
  const topic = text.replace(/\s+/g, ' ').trim()
  return {
    student: ini ? ini[2] : '',
    topic: topic.charAt(0).toUpperCase() + topic.slice(1),
    date: p.date,
    start,
    hours,
    paid,
  }
}
