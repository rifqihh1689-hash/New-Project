import type { Chapter, DayType, RitmeSlot } from '../types'
import { parseClock } from './time'

/** Menit untuk mengurutkan slot: sebelum 03.00 dianggap akhir hari (hari Qawwam berganti 03.00). */
export function slotOrder(time: string): number {
  const m = parseClock(time) ?? 0
  return m < 180 ? m + 1440 : m
}

/** "6", "6.0", "06:00", "0600", "6.5" → "06.00"; `null` bila tidak dikenali. */
export function normalizeClock(value: string): string | null {
  const v = value.trim().replace(/\s/g, '')
  let h: number
  let m: number
  let match: RegExpExecArray | null
  if ((match = /^(\d{1,2})[.:,](\d{1,2})$/.exec(v))) {
    h = Number(match[1])
    m = Number(match[2].length === 1 ? `${match[2]}0` : match[2])
  } else if ((match = /^(\d{3,4})$/.exec(v))) {
    h = Number(match[1].slice(0, -2))
    m = Number(match[1].slice(-2))
  } else if ((match = /^(\d{1,2})$/.exec(v))) {
    h = Number(match[1])
    m = 0
  } else return null
  if (h > 23 || m > 59) return null
  return `${String(h).padStart(2, '0')}.${String(m).padStart(2, '0')}`
}

/**
 * Format jam saat diketik di papan angka HP (yang tidak punya titik): titik disisipkan otomatis.
 * "2030" → "20.30", "930" → "9.30", "93" → "9.3"; titik/titik dua yang diketik sendiri dihormati.
 * Dirapikan jadi `HH.MM` lewat `normalizeClock` saat keluar kolom.
 */
export function typeClock(raw: string): string {
  const sep = raw.search(/[.:,]/)
  if (sep >= 0) {
    const h = raw.slice(0, sep).replace(/\D/g, '').slice(0, 2)
    const m = raw
      .slice(sep + 1)
      .replace(/\D/g, '')
      .slice(0, 2)
    return h || m ? `${h}.${m}` : ''
  }
  const d = raw.replace(/\D/g, '').slice(0, 4)
  if (d.length < 2) return d
  if (Number(d.slice(0, 2)) > 23) return `${d[0]}.${d.slice(1, 3)}`
  if (d.length === 2) return d
  return `${d.slice(0, 2)}.${d.slice(2)}`
}

/**
 * Ritme yang berlaku hari ini: template tipe hari, dengan jam masuk/pulang slot kerja diganti
 * oleh stase yang sedang berjalan (mis. Stase Bedah pulang 16.00). Diurutkan menurut jam.
 */
export function effectiveRitme(
  type: DayType,
  templates: Partial<Record<DayType, RitmeSlot[]>>,
  chapter?: Pick<Chapter, 'name' | 'masuk' | 'pulang'> | null,
): RitmeSlot[] {
  const slots = (templates[type] ?? []).map((s) =>
    s.work && chapter
      ? { ...s, time: chapter.masuk || s.time, until: chapter.pulang || s.until, title: s.title === 'Stase' ? chapter.name : s.title }
      : s,
  )
  return [...slots].sort((a, b) => slotOrder(a.time) - slotOrder(b.time))
}

/** Stase yang berjalan di tanggal itu (yang mulai paling akhir bila tumpang tindih). */
export function chapterOn<T extends Pick<Chapter, 'start' | 'end'>>(chapters: T[], date: string): T | null {
  return chapters.filter((c) => c.start <= date && c.end >= date).sort((a, b) => b.start.localeCompare(a.start))[0] ?? null
}

/** Jam pulang dari slot kerja pertama, untuk kalimat pembuka. */
export function workEndTime(slots: RitmeSlot[]): string | null {
  return slots.find((s) => s.work && s.until)?.until ?? null
}

/** Keterangan kecil di bawah judul slot. */
export function slotNote(s: RitmeSlot): string | undefined {
  return s.note || (s.until ? `sampai ±${s.until}` : undefined)
}
