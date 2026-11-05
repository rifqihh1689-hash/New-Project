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

/** Jam pulang dari slot kerja pertama, untuk kalimat pembuka. */
export function workEndTime(slots: RitmeSlot[]): string | null {
  return slots.find((s) => s.work && s.until)?.until ?? null
}

/** Keterangan kecil di bawah judul slot. */
export function slotNote(s: RitmeSlot): string | undefined {
  return s.note || (s.until ? `sampai ±${s.until}` : undefined)
}
