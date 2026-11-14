import type { CalendarEvent, DayType, ISODate, PlannedWorkout, RitmeSlot, RunType, TentirSession, Workout } from '../types'
import { slotOrder } from './ritme'
import { formatClock, sessionEnd } from './tentir'
import { parseClock } from './time'
import type { Readiness } from './training'

/**
 * Jadwal terpadu satu hari: ritme (template tipe hari) digabung dengan hal-hal yang benar-benar berjam
 * di tanggal itu, yaitu sesi tentir, agenda, sesi latihan terjadwal, dan jam tidur yang dihitung dari jam
 * bangun. Satu fungsi murni, dipakai Beranda, Kalender, dan connector, supaya semuanya melihat hari yang sama.
 */

export type ScheduleSource = 'ritme' | 'tentir' | 'agenda' | 'latihan' | 'tidur'

/** Kompatibel dengan `RitmeSlot`, jadi pita 24 jam dan "sekarang/berikutnya" memakainya apa adanya. */
export interface ScheduleItem extends RitmeSlot {
  source: ScheduleSource
  /** Kunci unik untuk daftar. */
  key: string
  /** Rute untuk menindaklanjuti (`#/…`). */
  href?: string
  /** Sesi latihan sudah dicatat. */
  done?: boolean
  /** Bentrok atau hal yang perlu diputuskan (ditampilkan mencolok). */
  warn?: string
  planned?: PlannedWorkout
}

export const RUN_LABELS: Record<RunType, string> = { easy: 'santai', long: 'panjang', kualitas: 'kualitas', tes: 'tes' }

export const TENTIR_ROLE_ID = '#role:tentir'
export const RECOVERY_ROLE_ID = '#role:pulih'

const DAY_END = 27 * 60
const order = (clock: string) => slotOrder(clock)
/** Menit urutan (180…1620) → `HH.MM`. */
export const orderClock = (m: number) => formatClock(((Math.round(m) % 1440) + 1440) % 1440)

export const isTentirSlot = (s: RitmeSlot) => !s.work && (s.roleId === TENTIR_ROLE_ID || /\btentir\b/i.test(s.title))
export const isTrainingSlot = (s: RitmeSlot) => !s.work && /olahraga|latihan|gym|workout|angkat beban/i.test(s.title)
export const isNapSlot = (s: RitmeSlot) => /qailulah|tidur siang|tidur sore|tidur pulih|\bnap\b/i.test(s.title)
/** Tidur malam: slot "Tidur…" mulai pukul 19.00 ke atas. */
export const isNightSleepSlot = (s: RitmeSlot) => /^tidur\b/i.test(s.title.trim()) && order(s.time) >= 19 * 60

/** Lama tidur siang dari teks slot ("60 mnt", "2 jam"); bawaan 60 menit, maksimal 3 jam. */
export function napMinutes(s: RitmeSlot): number {
  const text = `${s.title} ${s.note ?? ''}`
  const m = /(\d+)\s*(mnt|menit)/i.exec(text)
  if (m) return Math.min(180, Number(m[1]))
  const h = /(\d+)(?:[–-](\d+))?\s*(j\b|jam)/i.exec(text)
  if (h) return Math.min(180, Number(h[1]) * 60)
  return 60
}

export interface Block {
  /** Menit sejak 00.00. */
  start: number
  end: number
  label: string
}

/**
 * Blok ritme yang "lunak": kegiatan rutin selain kerja, tidur siang, dan tidur malam (mis. blok belajar).
 * Bisa dipotong bila terpaksa, tapi penjadwal menghindarinya dulu. Lamanya dari teks ("90 mnt"), kalau
 * tidak ada: sampai slot berikutnya, paling lama 2 jam (sama dengan pita 24 jam).
 */
export function softBlocks(ritme: RitmeSlot[]): Block[] {
  const sorted = [...ritme].sort((a, b) => order(a.time) - order(b.time))
  const out: Block[] = []
  sorted.forEach((s, i) => {
    if (s.work || isNapSlot(s) || isNightSleepSlot(s) || isTentirSlot(s) || isTrainingSlot(s) || /^jaga\b/i.test(s.title)) return
    const start = parseClock(s.time)
    if (start == null) return
    const until = s.until ? parseClock(s.until) : null
    const stated = /(\d+)\s*(mnt|menit)/i.exec(`${s.title} ${s.note ?? ''}`)
    const next = i + 1 < sorted.length ? order(sorted[i + 1].time) - order(s.time) : 120
    // Slot ibadah (tanpa peran) pendek; kegiatan lain dianggap sampai slot berikutnya, paling lama 2 jam.
    const fallback = Math.min(s.roleId ? 120 : 45, Math.max(15, next))
    const minutes = until != null && until > start ? until - start : stated ? Math.min(240, Number(stated[1])) : fallback
    out.push({ start, end: start + minutes, label: s.title })
  })
  return out
}

export function plannedTitle(p: Pick<PlannedWorkout, 'kind' | 'day' | 'run'>): string {
  if (p.kind === 'lari') return `Lari ${p.run ? `${RUN_LABELS[p.run.type]} ${String(p.run.km).replace('.', ',')} km` : 'santai'}`
  return `Latihan beban${p.day && p.day !== 'Semua' ? ` · ${p.day}` : ''}`
}

/** Indeks butir yang sedang berjalan (butir terakhir yang sudah mulai) menurut jam dinding, atau -1. */
export function currentIndex(items: Pick<RitmeSlot, 'time'>[], minutes: number): number {
  const now = minutes < 180 ? minutes + 1440 : minutes
  return items.reduce((idx, s, i) => (order(s.time) <= now ? i : idx), -1)
}

export interface SleepPlan {
  /** Jam tidur paling lambat (`HH.MM`) supaya total tidur 24 jam mencapai target. */
  bedtime: string
  wake: string
  /** Jam tidur malam yang dibutuhkan & qailulah yang dihitung (jam). */
  night: number
  nap: number
  /** Qailulah dihitung dari rencana (belum dicatat). */
  napPlanned: boolean
}

export interface SleepInput {
  /** Jam bangun besok (`HH.MM`), biasanya slot pertama ritme besok. */
  wake: string | null
  /** Target total tidur 24 jam (jam). */
  target: number
  /** Qailulah yang sudah dicatat hari ini (jam). */
  napLogged: number
  /** Jam dinding sekarang (menit); bila kosong, qailulah di ritme dianggap masih akan dijalani. */
  nowMinutes?: number
}

/**
 * Jam tidur paling lambat = jam bangun − (target − qailulah). Qailulah yang belum dicatat tetap dihitung
 * selama slotnya belum lewat 2 jam; setelah itu dianggap terlewat, dan jam tidur maju.
 */
export function sleepPlan(ritme: RitmeSlot[], input: SleepInput): SleepPlan | null {
  if (!input.wake || parseClock(input.wake) == null) return null
  const napSlot = ritme.find(isNapSlot)
  const now = input.nowMinutes == null ? null : input.nowMinutes < 180 ? input.nowMinutes + 1440 : input.nowMinutes
  const stillAhead = napSlot && (now == null || now < order(napSlot.time) + 120)
  const napPlanned = input.napLogged <= 0 && !!stillAhead
  const nap = input.napLogged > 0 ? input.napLogged : napPlanned ? napMinutes(napSlot!) / 60 : 0
  const night = Math.min(9, Math.max(4.5, input.target - nap))
  const wakeOrder = order(input.wake) + 1440
  return { bedtime: orderClock(wakeOrder - night * 60), wake: input.wake, night, nap, napPlanned }
}

export interface DayScheduleInput {
  date: ISODate
  /** Tipe hari yang dipakai (yang dipilih, atau saran bila belum dipilih). */
  type: DayType
  /** Ritme yang berlaku untuk tipe itu (sudah mengikuti jam stase). */
  ritme: RitmeSlot[]
  sessions: Pick<TentirSession, 'id' | 'date' | 'start' | 'hours' | 'student' | 'topic'>[]
  events: Pick<CalendarEvent, 'id' | 'date' | 'start' | 'end' | 'title' | 'roleId'>[]
  planned: PlannedWorkout[]
  workouts: Pick<Workout, 'date' | 'kind'>[]
  /** Minggu ini punya jadwal latihan: slot "Olahraga" umum di ritme diganti sesi yang terjadwal. */
  planActive: boolean
  sleep?: SleepInput
  readiness?: Readiness
  /** Energi hari ini ≤ 2. */
  lowEnergy?: boolean
}

export interface DaySchedule {
  items: ScheduleItem[]
  /** Agenda tanpa jam. */
  allDay: { id: string; title: string }[]
  /** Bentrok dan hal yang perlu diputuskan, dalam kalimat. */
  conflicts: string[]
  sleep: SleepPlan | null
}

interface Span {
  start: number
  end: number
}

const spanOf = (i: RitmeSlot, fallbackMinutes: number): Span => {
  const start = order(i.time)
  const until = i.until ? order(i.until) : null
  return { start, end: until != null && until > start ? until : Math.min(DAY_END, start + fallbackMinutes) }
}
const overlaps = (a: Span, b: Span) => a.start < b.end && b.start < a.end

export function daySchedule(input: DayScheduleInput): DaySchedule {
  const { date, type } = input
  const sessions = input.sessions.filter((s) => s.date === date)
  const events = input.events.filter((e) => e.date === date)
  const planned = input.planned.filter((p) => p.date === date)
  const timed = sessions.filter((s) => s.start && parseClock(s.start) != null)
  const untimed = sessions.filter((s) => !s.start || parseClock(s.start) == null)
  const conflicts: string[] = []
  const sleep = input.sleep && (type === 'stase' || type === 'libur') ? sleepPlan(input.ritme, input.sleep) : null

  const items: ScheduleItem[] = []
  let nightSlot = false
  input.ritme.forEach((s, i) => {
    const base: ScheduleItem = { ...s, source: 'ritme', key: `r${i}` }
    if (isTentirSlot(s)) {
      // Slot "Tentir (bila ada sesi)" hanya tampil bila memang ada sesi; sesi berjam menggantikannya.
      if (!sessions.length || (timed.length && !untimed.length)) return
      const names = untimed.map((x) => x.student).join(', ')
      items.push({ ...base, source: 'tentir', title: `Tentir ${names}`, note: 'jam mulai belum diisi', href: '#/tentir' })
      return
    }
    if (isTrainingSlot(s) && (planned.length || input.planActive)) return
    if (sleep && isNightSleepSlot(s)) {
      nightSlot = true
      const late = order(s.time) > order(sleep.bedtime)
      items.push({
        ...base,
        source: 'tidur',
        time: late ? sleep.bedtime : s.time,
        note: late ? sleepNote(sleep, input.sleep!.target) : `paling lambat ${sleep.bedtime} agar total ≥ ${hours(input.sleep!.target)}`,
      })
      return
    }
    items.push(base)
  })

  for (const s of timed)
    items.push({
      source: 'tentir',
      key: `t${s.id}`,
      time: s.start!,
      until: formatClock(sessionEnd(s)!),
      title: `Tentir ${s.student}`,
      note: s.topic || undefined,
      roleId: TENTIR_ROLE_ID,
      href: '#/tentir',
    })
  for (const e of events.filter((x) => x.start && parseClock(x.start) != null))
    items.push({
      source: 'agenda',
      key: `e${e.id}`,
      time: e.start!,
      until: e.end ?? undefined,
      title: e.title,
      roleId: e.roleId ?? undefined,
      href: '#/kalender',
    })
  for (const p of planned) {
    const done = input.workouts.some((w) => w.date === date && w.kind === p.kind)
    const start = parseClock(p.start) ?? 16 * 60 + 30
    const item: ScheduleItem = {
      source: 'latihan',
      key: `p${p.id}`,
      time: p.start,
      until: formatClock(start + p.minutes),
      title: plannedTitle(p),
      roleId: RECOVERY_ROLE_ID,
      href: '#/latihan',
      done,
      planned: p,
    }
    if (!done) {
      if (type === 'jaga') item.warn = 'Hari jaga: pindahkan atau lewati.'
      else if (type === 'pasca') item.warn = 'Pasca-jaga: ganti jalan santai, pindahkan sesinya.'
      else if (input.readiness === 'ringan-tidur') item.note = 'Tidur < 5 jam: ringan saja (80% beban, satu set lebih sedikit).'
      else if (input.lowEnergy) item.note = 'Energi rendah: ringan saja, atau pindahkan.'
      else {
        // Tidak ada jam yang benar-benar kosong: sesi memotong blok ritme lain. Diberi tahu, bukan disembunyikan.
        const cut = softBlocks(input.ritme).find((b) => start < b.end && b.start < start + p.minutes)
        if (cut) item.note = `memotong ${cut.label} ${formatClock(cut.start)}`
      }
    }
    items.push(item)
  }

  if (sleep && !nightSlot)
    items.push({
      source: 'tidur',
      key: 'sleep',
      time: sleep.bedtime,
      title: 'Tidur',
      note: sleepNote(sleep, input.sleep!.target),
      roleId: RECOVERY_ROLE_ID,
    })

  items.sort((a, b) => order(a.time) - order(b.time))

  // Bentrok antara hal yang tidak bisa digeser: kerja (stase), tentir, agenda berjam, latihan.
  const hard = items.filter((i) => i.source === 'tentir' || i.source === 'agenda' || i.source === 'latihan' || i.work)
  const rank: Record<ScheduleSource, number> = { ritme: 0, tentir: 1, agenda: 2, latihan: 3, tidur: 0 }
  for (let a = 0; a < hard.length; a++)
    for (let b = a + 1; b < hard.length; b++) {
      const x = hard[a]
      const y = hard[b]
      if (x.source === 'ritme' && y.source === 'ritme') continue
      if (x.done || y.done) continue
      if (!overlaps(spanOf(x, 60), spanOf(y, 60))) continue
      // Yang ditandai: yang paling mudah digeser (latihan, lalu agenda, lalu tentir).
      const [flag, other] = rank[x.source] >= rank[y.source] ? [x, y] : [y, x]
      const text = `Bentrok dengan ${other.title} ${other.time}${other.until ? `–${other.until}` : ''}.`
      if (!flag.warn) flag.warn = text
      conflicts.push(`${flag.title} ${flag.time} bentrok dengan ${other.title} ${other.time}.`)
    }
  for (const i of items)
    if (i.source === 'latihan' && i.warn && !i.warn.startsWith('Bentrok')) conflicts.push(`${i.title} ${i.time}: ${i.warn}`)

  // Latihan terlalu dekat jam tidur mengganggu tidur yang sudah pendek.
  if (sleep)
    for (const i of items) {
      if (i.source !== 'latihan' || i.done || i.warn) continue
      if (spanOf(i, 60).end > order(sleep.bedtime) - 60) {
        i.warn = `Selesai kurang dari 1 jam sebelum tidur (${sleep.bedtime}).`
        conflicts.push(`${i.title} ${i.time} selesai terlalu dekat jam tidur ${sleep.bedtime}.`)
      }
    }

  return {
    items,
    allDay: events.filter((x) => !x.start || parseClock(x.start) == null).map((e) => ({ id: e.id, title: e.title })),
    conflicts,
    sleep,
  }
}

const hours = (h: number) => `${String(Math.round(h * 100) / 100).replace('.', ',')} j`

function sleepNote(s: SleepPlan, target: number): string {
  const nap = s.nap > 0 ? ` + qailulah ${hours(s.nap)}${s.napPlanned ? '' : ' (tercatat)'}` : ''
  const total = s.night + s.nap
  return `paling lambat, bangun ${s.wake}: malam ${hours(s.night)}${nap}${total < target ? ` (di bawah target ${hours(target)})` : ''}`
}
