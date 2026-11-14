import type { DayType, ISODate, MonthKey, TentirPackage, TentirSession } from '../types'
import { monthDates } from './calendar'
import { sessionEnd } from './tentir'
import { DAY_SHORT, formatDateLong, formatMonth, parseClock, weekday, weekStart } from './time'

/** Pemakaian paket: sesi yang memakai paket itu (urut tanggal). */
export function packageUsage(pkg: Pick<TentirPackage, 'id' | 'sessions'>, sessions: Pick<TentirSession, 'packageId'>[]) {
  const used = sessions.filter((s) => s.packageId === pkg.id).length
  return { used, left: Math.max(0, pkg.sessions - used), done: used >= pkg.sessions }
}

/** Paket aktif murid (belum habis, tidak diarsipkan), yang paling lama dulu dipakai. */
export function activePackage<T extends TentirPackage>(student: string, pkgs: T[], sessions: Pick<TentirSession, 'packageId'>[]): T | null {
  const key = student.trim().toUpperCase()
  return (
    pkgs.filter((p) => p.student === key && !p.archived && !packageUsage(p, sessions).done).sort((a, b) => a.createdAt - b.createdAt)[0] ??
    null
  )
}

export interface SlotOptions {
  start: string
  end: string
  /** Tipe hari yang tidak dibuka (bawaan: jaga malam & pasca-jaga). */
  skip?: DayType[]
}

/**
 * Tanggal dengan slot tentir kosong di bulan itu: bukan jaga/pasca-jaga, tidak bentrok dengan sesi lain
 * di jam yang sama, dan belum lewat. Hari tanpa tipe dianggap bisa (diisi stase/libur).
 */
export function freeSlots(
  month: MonthKey,
  today: ISODate,
  types: (d: ISODate) => DayType | null,
  sessions: Pick<TentirSession, 'date' | 'start' | 'hours'>[],
  opts: SlotOptions,
  /** Hal lain yang sudah mengisi jam itu, mis. sesi latihan terjadwal (`start` `HH.MM`, lama dalam menit). */
  busy: { date: ISODate; start: string; minutes: number }[] = [],
): ISODate[] {
  const skip = opts.skip ?? ['jaga', 'pasca']
  const s0 = parseClock(opts.start) ?? 19 * 60
  const s1 = parseClock(opts.end) ?? 21 * 60
  return monthDates(month).filter((d) => {
    if (d < today) return false
    const t = types(d)
    if (t && skip.includes(t)) return false
    if (
      busy.some((b) => {
        const a = parseClock(b.start)
        return b.date === d && a != null && a < s1 && a + b.minutes > s0
      })
    )
      return false
    return !sessions.some((x) => {
      if (x.date !== d) return false
      const a = x.start ? parseClock(x.start) : null
      const b = sessionEnd(x)
      // Sesi tanpa jam mulai dianggap mengisi slot malam itu.
      return a == null || b == null || (a < s1 && b > s0)
    })
  })
}

/** Teks slot untuk dikirim ke murid, dikelompokkan per minggu supaya mudah dibaca di WA. */
export function slotsMessage(month: MonthKey, dates: ISODate[], opts: SlotOptions): string {
  if (!dates.length) return `Maaf, slot tentir ${formatMonth(month)} sudah penuh.`
  const weeks = new Map<ISODate, string[]>()
  for (const d of dates) {
    const monday = weekStart(d)
    weeks.set(monday, [...(weeks.get(monday) ?? []), `${DAY_SHORT[weekday(d)]} ${Number(d.slice(8))}`])
  }
  return [
    `Slot tentir ${formatMonth(month)} (${opts.start}–${opts.end}):`,
    ...[...weeks.values()].map((w) => `• ${w.join(', ')}`),
    'Balas tanggal yang kamu mau ya, nanti aku kunci.',
  ].join('\n')
}

export interface TemplateVars {
  inisial: string
  topik: string
  tanggal: string
  jam: string
  selesai: string
  jumlah: string
  total: string
  paket: string
  sisa: string
}

/** Template pesan WA; {nama} diganti nilai. Bisa diubah di app (disimpan per perangkat). */
export const MESSAGE_TEMPLATES: { key: string; label: string; text: string }[] = [
  {
    key: 'konfirmasi',
    label: 'Konfirmasi jadwal',
    text: 'Halo {inisial}, tentir {topik} {tanggal} pukul {jam}–{selesai} ya. Sampai ketemu!',
  },
  {
    key: 'pengingat',
    label: 'Pengingat H-1',
    text: 'Pengingat: besok {tanggal} {jam} tentir {topik}. Siapkan pertanyaan yang mau dibahas ya.',
  },
  { key: 'tagihan', label: 'Tagihan', text: 'Halo {inisial}, rekap tentir: {jumlah} sesi belum dibayar, total {total}. Terima kasih!' },
  { key: 'paket', label: 'Sisa paket', text: 'Halo {inisial}, paket {paket} tersisa {sisa} sesi. Mau dijadwalkan kapan?' },
]

export function fillTemplate(text: string, vars: Partial<TemplateVars>): string {
  return text.replace(/\{(\w+)\}/g, (m, k: string) => (vars as Record<string, string | undefined>)[k] ?? m)
}

export const longDate = (d: ISODate) => formatDateLong(d).replace(/ \d{4}$/, '')
