import { addDays, diffDays, weekStart } from './time'
import type { ISODate, StudyLog } from '../types'

/** Sistem/bidang UKMPPD yang dicatat (bisa dipilih saat mencatat soal). */
export const STUDY_SYSTEMS = [
  'Kardiovaskular',
  'Respirasi',
  'Pencernaan & hepatobilier',
  'Ginjal & saluran kemih',
  'Endokrin & metabolik',
  'Hematologi & imunologi',
  'Saraf',
  'Jiwa',
  'Muskuloskeletal',
  'Kulit & kelamin',
  'Mata',
  'THT',
  'Obstetri & ginekologi',
  'Anak',
  'Emergensi & forensik',
  'Etika & komunikasi',
  'Lainnya',
] as const

export const DEFAULT_STUDY_WEEKLY = 150
/** Di bawah jumlah ini akurasi sistem belum dianggap cukup andal untuk menyebutnya "terlemah". */
export const MIN_FOR_RANKING = 20

export interface SystemStat {
  system: string
  total: number
  correct: number
  /** 0–1; `null` bila belum ada soal. */
  accuracy: number | null
  lastDate: ISODate | null
}

/** Statistik per sistem dari semua catatan; sistem tanpa catatan tetap muncul (total 0). */
export function systemStats(logs: Pick<StudyLog, 'system' | 'total' | 'correct' | 'date'>[]): SystemStat[] {
  const rows = new Map<string, SystemStat>(
    STUDY_SYSTEMS.map((s) => [s, { system: s, total: 0, correct: 0, accuracy: null, lastDate: null }]),
  )
  for (const l of logs) {
    const row = rows.get(l.system) ?? { system: l.system, total: 0, correct: 0, accuracy: null, lastDate: null }
    row.total += l.total
    row.correct += l.correct
    if (!row.lastDate || l.date > row.lastDate) row.lastDate = l.date
    rows.set(l.system, row)
  }
  return [...rows.values()].map((r) => ({ ...r, accuracy: r.total > 0 ? r.correct / r.total : null }))
}

/** Sistem terlemah: akurasi terendah di antara yang sudah cukup soal. */
export function weakestSystem(stats: SystemStat[], min = MIN_FOR_RANKING): SystemStat | null {
  return stats.filter((s) => s.total >= min && s.accuracy != null).sort((a, b) => a.accuracy! - b.accuracy!)[0] ?? null
}

/** Sistem yang paling lama tidak disentuh (atau belum pernah), sebagai ide topik berikutnya. */
export function stalestSystem(stats: SystemStat[]): SystemStat | null {
  const touched = stats.filter((s) => s.system !== 'Lainnya')
  return (
    [...touched].sort((a, b) => (a.lastDate ?? '0000').localeCompare(b.lastDate ?? '0000') || a.system.localeCompare(b.system))[0] ?? null
  )
}

export interface WeekProgress {
  done: number
  target: number
  /** 0–1+ dari target. */
  ratio: number
  /** Sudah lewat berapa bagian minggu (0–1), dihitung per hari. */
  elapsed: number
  /** Soal per hari yang masih perlu dikerjakan sisa minggu ini; 0 bila target tercapai. */
  perDayLeft: number
  behind: boolean
}

/** Soal minggu ini (Senin–Minggu) terhadap target. "Tertinggal" bila capaian < 85% dari jatah hari yang sudah lewat. */
export function weekProgress(logs: Pick<StudyLog, 'date' | 'total'>[], today: ISODate, target: number): WeekProgress {
  const monday = weekStart(today)
  const sunday = addDays(monday, 6)
  const done = logs.filter((l) => l.date >= monday && l.date <= sunday).reduce((a, l) => a + l.total, 0)
  const daysPassed = diffDays(today, monday) + 1 // termasuk hari ini
  const daysLeft = 7 - daysPassed + 1 // termasuk hari ini
  const elapsed = (daysPassed - 1) / 7
  const expected = target * (diffDays(today, monday) / 7)
  return {
    done,
    target,
    ratio: target > 0 ? done / target : 0,
    elapsed,
    perDayLeft: done >= target ? 0 : Math.ceil((target - done) / Math.max(1, daysLeft)),
    behind: target > 0 && daysPassed >= 3 && done < expected * 0.85,
  }
}

/** Rata-rata soal per minggu dalam `weeks` minggu penuh terakhir (tidak menghitung minggu berjalan). */
export function recentWeeklyAverage(logs: Pick<StudyLog, 'date' | 'total'>[], today: ISODate, weeks = 4): number {
  const end = addDays(weekStart(today), -1)
  const start = addDays(end, -7 * weeks + 1)
  return Math.round(logs.filter((l) => l.date >= start && l.date <= end).reduce((a, l) => a + l.total, 0) / weeks)
}

export interface Countdown {
  days: number
  weeks: number
  /** Soal per minggu yang dibutuhkan untuk mencapai `goalTotal` sebelum ujian; `null` bila tanpa target total. */
  weeklyNeeded: number | null
}

export function countdown(examDate: ISODate | null, today: ISODate, answered = 0, goalTotal: number | null = null): Countdown | null {
  if (!examDate) return null
  const days = diffDays(examDate, today)
  if (days < 0) return null
  const weeks = Math.max(1, Math.ceil(days / 7))
  return { days, weeks, weeklyNeeded: goalTotal != null ? Math.max(0, Math.ceil((goalTotal - answered) / weeks)) : null }
}
