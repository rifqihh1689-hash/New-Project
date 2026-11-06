import type { DayType, RitmeSlot } from '../types'
import { DAY_TYPE_LABELS } from './dayType'
import { parseClock } from './time'
import { slotOrder } from './ritme'

export interface HeadlineContext {
  type: DayType | null
  suggested: DayType
  invalidPasca: boolean
  hasTentir: boolean
  /** Label tipe "stase" pada fase ini (mis. "Dinas" saat PPDS). */
  workLabel?: string
  /** Jam pulang dari ritme/stase yang berlaku. */
  pulang?: string | null
  /** Jam dinding WIB (menit). Bila diisi, kalimat menyesuaikan pagi/siang/malam. */
  minutes?: number
  /** Batas kerja malam (null = aturan mati). */
  workEndLimit?: string | null
  /** Qailulah hari ini sudah dicatat. */
  napDone?: boolean
}

/** Kalimat pembuka Beranda. Pendek, tenang, satu arahan. */
export function headline(ctx: HeadlineContext): string {
  const work = (ctx.workLabel ?? DAY_TYPE_LABELS.stase).toLowerCase()
  switch (ctx.type) {
    case null:
      return ctx.suggested === 'pasca'
        ? 'Kemarin jaga. Pilih tipe hari dulu, mungkin hari ini pasca-jaga.'
        : `Hari ini tipe apa? Pilih dulu, isinya menyesuaikan.`
    case 'stase': {
      const t = ctx.minutes
      const home = ctx.pulang ? parseClock(ctx.pulang) : null
      const limit = ctx.workEndLimit ? parseClock(ctx.workEndLimit) : null
      // Malam: batas kerja yang bicara.
      if (t != null && limit != null && (t >= limit || t < 180)) return `Sudah lewat ${ctx.workEndLimit}. Tutup hari, lalu tidur.`
      if (t != null && limit != null && t >= 18 * 60)
        return `Batas kerja ${ctx.workEndLimit}, ${formatIn(limit - t)} lagi. Setelah itu tutup hari.`
      // Siang/sore setelah pulang.
      if (t != null && home != null && t >= home)
        return ctx.napDone
          ? `Qailulah sudah. Sore ini ${ctx.hasTentir ? 'blok belajar, lalu tentir' : 'satu blok belajar'}.`
          : `Sudah lewat ±${ctx.pulang}. Qailulah dulu${ctx.hasTentir ? ' sebelum tentir' : ''}, naikkan pengali tidur.`
      return `Hari ${work}. ${ctx.pulang ? `Pulang ±${ctx.pulang}, q` : 'Setelah pulang, q'}ailulah dulu${ctx.hasTentir ? ' sebelum tentir' : ''}.`
    }
    case 'jaga':
      if (ctx.minutes != null && ctx.minutes >= 18 * 60) return 'Jaga malam ini. Makan teratur, minum cukup, tidur saat sepi.'
      return 'Malam ini jaga. Simpan tenaga, tidur sore dulu 2 jam.'
    case 'pasca':
      return ctx.invalidPasca ? `Kemarin bukan jaga, jadi hari ini dihitung hari ${work}.` : 'Pasca-jaga. Hari ini cuma satu tugas: pulih.'
    case 'libur':
      return 'Libur. Satu blok belajar panjang, sisanya istirahat.'
  }
}

/** Sapaan menurut jam dinding WIB, dengan nama panggilan bila ada. */
export function greeting(minutes: number, name = ''): string {
  const h = Math.floor(minutes / 60)
  const part = h >= 3 && h < 11 ? 'pagi' : h >= 11 && h < 15 ? 'siang' : h >= 15 && h < 18 ? 'sore' : 'malam'
  const n = name.trim()
  return `Selamat ${part}${n ? `, ${n}` : ''}.`
}

/** "45 mnt", "2 j", "2 j 10 mnt". */
export function formatIn(minutes: number): string {
  const m = Math.max(0, Math.round(minutes))
  const h = Math.floor(m / 60)
  const r = m % 60
  if (!h) return `${r} mnt`
  return r ? `${h} j ${r} mnt` : `${h} j`
}

/** Akhir hari Qawwam: 03.00 besok, dalam menit urutan (`slotOrder`). */
export const DAY_END = 27 * 60

const sortSlots = (slots: RitmeSlot[]) => [...slots].sort((a, b) => slotOrder(a.time) - slotOrder(b.time))

/** Menit urutan jam selesai slot; slot yang melewati tengah malam (mis. jaga 18.00–07.00) dibatasi akhir hari. */
function untilOrder(s: RitmeSlot): number | null {
  if (!s.until) return null
  const start = slotOrder(s.time)
  const end = slotOrder(s.until)
  return end > start ? end : DAY_END
}

export interface NowNext {
  /** Slot yang sedang berjalan; `null` = jeda (slot sebelumnya sudah selesai) atau belum mulai. */
  now: RitmeSlot | null
  next: RitmeSlot | null
  /** Menit sampai slot berikutnya. */
  inMinutes: number | null
}

/** Slot ritme yang sedang berjalan dan yang berikutnya, dari jam dinding WIB. */
export function nowNext(slots: RitmeSlot[], minutes: number): NowNext {
  const t = minutes < 180 ? minutes + 1440 : minutes
  const sorted = sortSlots(slots)
  let i = -1
  sorted.forEach((s, k) => {
    if (slotOrder(s.time) <= t) i = k
  })
  let now = i >= 0 ? sorted[i] : null
  const end = now ? untilOrder(now) : null
  if (end != null && end <= t) now = null
  const next = sorted[i + 1] ?? null
  return { now, next, inMinutes: next ? slotOrder(next.time) - t : null }
}

export interface RibbonBlock {
  slot: RitmeSlot
  /** Menit urutan 180 (03.00) … 1620 (03.00 besok). */
  start: number
  end: number
}

/**
 * Blok untuk pita 24 jam. Slot berjam selesai memakai jam itu; tidur & jaga berlangsung sampai slot
 * berikutnya; slot lain (tanpa jam selesai) dianggap paling lama 2 jam supaya pita tidak menyesatkan.
 */
export function dayRibbon(slots: RitmeSlot[]): RibbonBlock[] {
  const sorted = sortSlots(slots)
  return sorted.map((slot, k) => {
    const start = slotOrder(slot.time)
    const nextStart = k + 1 < sorted.length ? slotOrder(sorted[k + 1].time) : DAY_END
    const long = /tidur|jaga/i.test(slot.title)
    const end = untilOrder(slot) ?? (long ? nextStart : Math.min(nextStart, start + 120))
    return { slot, start, end: Math.min(Math.max(end, start), DAY_END) }
  })
}
