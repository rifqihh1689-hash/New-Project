import type { DayType, ISODate, PlannedWorkout, RitmeSlot, RunType, TrainingScheduleSettings, TrainingSplit, Workout } from '../types'
import { suggestDayType } from './dayType'
import { SPLITS } from './exerciseCatalog'
import { slotOrder } from './ritme'
import { isNapSlot, isNightSleepSlot, isTentirSlot, isTrainingSlot, napMinutes, softBlocks, type Block } from './schedule'
import { formatClock, sessionEnd } from './tentir'
import { diffDays, parseClock, weekday } from './time'

/**
 * Penjadwal latihan mingguan: menaruh sesi beban dan lari ke hari & jam kosong.
 *
 * Aturan:
 *  - Tidak ada latihan di hari jaga dan pasca-jaga (pemulihan lebih penting).
 *  - Tidak menabrak yang tidak bisa digeser: jam stase (+30 menit perjalanan), qailulah, sesi tentir
 *    (±15 menit), agenda berjam, tidur malam; selesai paling lambat 1 jam sebelum batas kerja malam.
 *  - Full body: sesi beban tidak di hari berurutan. Program lain boleh berurutan, tapi disebar.
 *  - Lari kualitas tidak di hari yang sama dengan beban, dan dihindari sehari setelah hari kaki.
 *  - Blok ritme lain (mis. blok belajar) dihindari bila ada jam kosong; dipotong hanya bila tidak ada.
 *  - Satu sesi per hari; dua sesi (beban + lari santai) hanya bila harinya tidak cukup.
 *  - Hari yang disukai: hari habit latihan bila ada, selain itu pola umum (3× = Sen, Rab, Jum).
 * Sesi buatan tangan atau usulan Claude tidak pernah digeser, hanya dihitung.
 */

export const DEFAULT_TRAINING_SCHEDULE: TrainingScheduleSettings = {
  strengthPerWeek: 3,
  strengthMinutes: 60,
  timeStase: '16.30',
  timeLibur: '09.30',
  auto: false,
}

const SPLIT_SESSIONS: Record<TrainingSplit, number> = { fullbody: 3, 'atas-bawah': 4, ppl: 3 }

export function resolveTrainingSchedule(
  stored: Partial<TrainingScheduleSettings> | undefined,
  split: TrainingSplit,
): TrainingScheduleSettings {
  const s = { ...DEFAULT_TRAINING_SCHEDULE, strengthPerWeek: SPLIT_SESSIONS[split], ...stored }
  return {
    ...s,
    strengthPerWeek: Math.min(6, Math.max(0, Math.round(s.strengthPerWeek))),
    strengthMinutes: Math.min(150, Math.max(20, Math.round(s.strengthMinutes))),
    timeStase: parseClock(s.timeStase) != null ? s.timeStase : DEFAULT_TRAINING_SCHEDULE.timeStase,
    timeLibur: parseClock(s.timeLibur) != null ? s.timeLibur : DEFAULT_TRAINING_SCHEDULE.timeLibur,
  }
}

/** Pola hari yang umum untuk n sesi beban per minggu (0 = Minggu). */
const IDEAL_DAYS: Record<number, number[]> = { 1: [3], 2: [1, 4], 3: [1, 3, 5], 4: [1, 2, 4, 5], 5: [1, 2, 3, 5, 6], 6: [1, 2, 3, 4, 5, 6] }

export type Busy = Block

export interface PlanDay {
  date: ISODate
  /** Tipe hari yang dipakai: yang tersimpan, atau perkiraan (setelah jaga = pasca, Minggu = libur). */
  type: DayType
  /** Tipe tersimpan (bukan perkiraan). */
  typed: boolean
  ritme: RitmeSlot[]
  /** Yang tidak bisa digeser: stase, qailulah, tentir, agenda, tidur. */
  busy: Busy[]
  /** Blok ritme lain (mis. blok belajar): dihindari bila ada jam kosong, dipotong bila tidak ada. */
  soft?: Busy[]
}

/** Tipe hari untuk rentang tanggal berurutan: yang tersimpan dipakai, sisanya diperkirakan berantai. */
export function resolveDayTypes(
  dates: ISODate[],
  stored: (d: ISODate) => DayType | null,
  before: DayType | null,
): { date: ISODate; type: DayType; typed: boolean }[] {
  let prev = before
  return dates.map((date) => {
    const s = stored(date)
    const type = s ?? suggestDayType(date, prev)
    prev = type
    return { date, type, typed: s != null }
  })
}

const min = (clock: string | null | undefined) => (clock ? parseClock(clock) : null)

/** Blok yang tidak bisa digeser pada satu hari, dari ritme, sesi tentir, dan agenda. */
export function busyOf(
  ritme: RitmeSlot[],
  sessions: { start: string | null; hours: number; student?: string }[],
  events: { start: string | null; end: string | null; title: string }[],
): Busy[] {
  const out: Busy[] = []
  for (const s of ritme) {
    const start = min(s.time)
    if (start == null) continue
    const until = min(s.until)
    // Kerja: 45 menit sebelum masuk (mandi, berangkat) dan 30 menit setelah pulang ikut terisi.
    if (s.work) out.push({ start: start - 45, end: (until != null && until > start ? until : start + 8 * 60) + 30, label: s.title })
    else if (isNapSlot(s)) out.push({ start, end: start + napMinutes(s) + 15, label: s.title })
    else if (isNightSleepSlot(s)) out.push({ start, end: 24 * 60, label: s.title })
    else if (/^jaga\b/i.test(s.title)) out.push({ start, end: 24 * 60, label: s.title })
  }
  const tentirSlot = ritme.find(isTentirSlot)
  for (const x of sessions) {
    const start = min(x.start) ?? min(tentirSlot?.time) ?? 19 * 60
    const end = sessionEnd({ start: formatClock(start), hours: x.hours }) ?? start + 120
    out.push({ start: start - 15, end: end + 15, label: `Tentir${x.student ? ` ${x.student}` : ''}` })
  }
  for (const e of events) {
    const start = min(e.start)
    if (start == null) continue
    const end = min(e.end)
    out.push({ start: start - 10, end: (end != null && end > start ? end : start + 60) + 10, label: e.title })
  }
  return out
}

const EARLIEST = 4 * 60 + 30
const STEP = 15

/** Jam mulai terdekat dengan jam yang disukai yang tidak menabrak apa pun; `null` bila hari itu penuh. */
export function findStart(
  day: PlanDay,
  minutes: number,
  settings: TrainingScheduleSettings,
  limit: string | null,
  extra: Busy[] = [],
  /** Jam paling awal (menit), dipakai untuk hari ini supaya tidak menjadwalkan ke jam yang sudah lewat. */
  notBefore = 0,
): number | null {
  if (day.type === 'jaga' || day.type === 'pasca') return null
  const slot = day.ritme.find(isTrainingSlot)
  const pref = min(slot?.time) ?? min(day.type === 'libur' ? settings.timeLibur : settings.timeStase) ?? 16 * 60 + 30
  const latestEnd = (min(limit) ?? 22 * 60) - 60
  const hard = [...day.busy, ...extra]
  const soft = day.soft ?? softBlocks(day.ritme)
  // Pertama cari jam yang tidak memotong apa pun; kalau tidak ada, boleh memotong blok ritme yang lunak.
  for (const busy of [[...hard, ...soft], hard]) {
    let best: number | null = null
    for (let t = EARLIEST; t + minutes <= latestEnd; t += STEP) {
      if (t < notBefore) continue
      if (busy.some((b) => t < b.end && b.start < t + minutes)) continue
      if (best == null || Math.abs(t - pref) < Math.abs(best - pref)) best = t
    }
    if (best != null) return best
  }
  return null
}

export interface PlanInput {
  today: ISODate
  /** Senin–Minggu minggu yang disusun. */
  days: PlanDay[]
  split: TrainingSplit
  /** Hari program berikutnya (dari sesi beban terakhir). */
  nextProgramDay: string
  settings: TrainingScheduleSettings
  run: { targetKm: number; easyRuns: number; qualityRuns: number; easyPace: [number, number] | null }
  /** Sesi yang sudah dicatat minggu ini. */
  done: Pick<Workout, 'date' | 'kind' | 'run' | 'day'>[]
  /** Sesi terjadwal buatan tangan / Claude di minggu ini: dipertahankan. */
  fixed: PlannedWorkout[]
  /** Hari yang disukai (0 = Minggu), biasanya dari habit latihan. */
  preferred?: { beban?: number[]; lari?: number[] }
  /** Batas kerja malam (`HH.MM`) atau `null`. */
  limit: string | null
  /** Jam dinding WIB (menit): sesi hari ini hanya ditaruh setelah jam ini. */
  nowMinutes?: number
  now?: number
}

export interface PlanResult {
  sessions: PlannedWorkout[]
  /** Sesi yang tidak mendapat tempat, dengan alasannya. */
  skipped: string[]
}

type Kind = 'beban' | 'lari'
interface Placed {
  date: ISODate
  kind: Kind
  /** Lari keras (kualitas/tes). */
  hard: boolean
  /** Beban yang melibatkan kaki. */
  legs: boolean
  start: number | null
  minutes: number
}

const legDay = (split: TrainingSplit, day: string | undefined) =>
  split === 'fullbody' || !day || day === 'Bawah' || day === 'Kaki' || day === 'Semua'
const isHard = (t: RunType | undefined) => t === 'kualitas' || t === 'tes'

export function planWeek(input: PlanInput): PlanResult {
  const { today, days, split, settings } = input
  const now = input.now ?? 0
  // Sebelum 03.00 masih "hari ini" bagi Qawwam: tidak ada lagi jam latihan tersisa.
  const clock = input.nowMinutes
  const notBefore = clock == null ? 0 : (clock < 180 ? clock + 1440 : clock) + 15
  const skipped: string[] = []
  const open = days.filter((d) => d.date >= today && d.type !== 'jaga' && d.type !== 'pasca')

  // Yang sudah ada: sesi tercatat, dan sesi tetap yang belum lewat.
  const placed: Placed[] = input.done.map((w) => ({
    date: w.date,
    kind: w.kind,
    hard: isHard(w.run?.type),
    legs: w.kind === 'beban' && legDay(split, w.day),
    start: null,
    minutes: 0,
  }))
  const doneKey = new Set(input.done.map((w) => `${w.date}:${w.kind}`))
  const fixed = input.fixed.filter((p) => p.date >= today && !doneKey.has(`${p.date}:${p.kind}`))
  for (const p of fixed)
    placed.push({
      date: p.date,
      kind: p.kind,
      hard: isHard(p.run?.type),
      legs: p.kind === 'beban' && legDay(split, p.day),
      start: min(p.start),
      minutes: p.minutes,
    })

  const count = (f: (p: Placed) => boolean) => placed.filter(f).length
  const on = (date: ISODate) => placed.filter((p) => p.date === date)
  const dist = (date: ISODate, f: (p: Placed) => boolean) => {
    const others = placed.filter(f).map((p) => Math.abs(diffDays(p.date, date)))
    return others.length ? Math.min(...others) : 9
  }
  const extraBusy = (date: ISODate): Busy[] =>
    on(date)
      .filter((p) => p.start != null)
      .map((p) => ({ start: p.start! - 30, end: p.start! + p.minutes + 30, label: 'Latihan' }))

  const sessions: PlannedWorkout[] = []
  const place = (kind: Kind, minutes: number, score: (d: PlanDay, strict: boolean) => number | null, label: string): Placed | null => {
    for (const strict of [true, false]) {
      let best: { d: PlanDay; s: number; start: number } | null = null
      for (const d of open) {
        if (on(d.date).some((p) => p.kind === kind)) continue
        const s = score(d, strict)
        if (s == null) continue
        const start = findStart(d, minutes, settings, input.limit, extraBusy(d.date), d.date === today ? notBefore : 0)
        if (start == null) continue
        if (!best || s > best.s) best = { d, s, start }
      }
      if (best) {
        const p: Placed = { date: best.d.date, kind, hard: false, legs: false, start: best.start, minutes }
        placed.push(p)
        return p
      }
    }
    skipped.push(`${label}: tidak ada hari & jam kosong minggu ini.`)
    return null
  }

  // ---- Beban ----
  const strengthLeft = Math.max(0, settings.strengthPerWeek - count((p) => p.kind === 'beban'))
  const ideal = input.preferred?.beban?.length ? input.preferred.beban : (IDEAL_DAYS[settings.strengthPerWeek] ?? [])
  const strengthDates: Placed[] = []
  for (let i = 0; i < strengthLeft; i++) {
    const p = place(
      'beban',
      settings.strengthMinutes,
      (d, strict) => {
        const gap = dist(d.date, (x) => x.kind === 'beban')
        if (split === 'fullbody' && gap <= 1 && strict) return null
        const load = on(d.date).length
        if (load && strict) return null
        return (ideal.includes(weekday(d.date)) ? 8 : 0) + Math.min(gap, 3) * 3 - load * 20 - (gap <= 1 ? 10 : 0)
      },
      'Sesi beban',
    )
    if (p) strengthDates.push(p)
  }
  // Hari program dibagikan menurut urutan tanggal, melanjutkan dari sesi terakhir.
  const labels = SPLITS[split].days
  let idx = Math.max(0, labels.indexOf(input.nextProgramDay))
  for (const p of [...strengthDates].sort((a, b) => a.date.localeCompare(b.date))) {
    const day = labels[idx % labels.length]
    idx++
    p.legs = legDay(split, day)
    sessions.push({
      id: plannedId(p.date, 'beban'),
      date: p.date,
      kind: 'beban',
      ...(split === 'fullbody' ? {} : { day }),
      start: formatClock(p.start!),
      minutes: p.minutes,
      source: 'auto',
      updatedAt: now,
    })
  }

  // ---- Lari ----
  const runs = input.done.filter((w) => w.kind === 'lari')
  const doneKm = runs.reduce((a, w) => a + (w.run?.km ?? 0), 0) + fixed.reduce((a, p) => a + (p.kind === 'lari' ? (p.run?.km ?? 0) : 0), 0)
  const qualityLeft = Math.max(0, input.run.qualityRuns - count((p) => p.kind === 'lari' && p.hard))
  const easyLeft = Math.max(0, input.run.easyRuns - count((p) => p.kind === 'lari' && !p.hard))
  const kmLeft = input.run.targetKm - doneKm
  const nRuns = qualityLeft + easyLeft
  if (nRuns > 0 && kmLeft >= 2) {
    const km = Math.min(12, Math.max(2, Math.round((kmLeft / nRuns) * 2) / 2))
    const paceMin = input.run.easyPace ? input.run.easyPace[0] / 60 : 7
    const runMinutes = (k: number, hard: boolean) =>
      Math.min(120, Math.max(20, Math.round((k * (hard ? paceMin - 0.5 : paceMin) + (hard ? 15 : 8)) / 5) * 5))
    const addRun = (hard: boolean) => {
      const minutes = runMinutes(km, hard)
      const p = place(
        'lari',
        minutes,
        (d, strict) => {
          const load = on(d.date)
          if (load.length && strict) return null
          if (hard && load.some((x) => x.kind === 'beban')) return null
          const prevLegs = placed.some((x) => x.kind === 'beban' && x.legs && diffDays(d.date, x.date) === 1)
          const nearHard = dist(d.date, (x) => x.kind === 'lari' && x.hard) <= 1
          const gap = dist(d.date, (x) => x.kind === 'lari')
          return (
            (input.preferred?.lari?.includes(weekday(d.date)) ? 8 : 0) +
            Math.min(gap, 3) * 2 +
            (hard && d.type === 'libur' ? 4 : 0) -
            (hard && prevLegs ? 12 : 0) -
            (nearHard ? 6 : 0) -
            load.length * 20
          )
        },
        hard ? 'Lari kualitas' : 'Lari santai',
      )
      if (!p) return
      p.hard = hard
      sessions.push({
        id: plannedId(p.date, 'lari'),
        date: p.date,
        kind: 'lari',
        run: { type: hard ? 'kualitas' : 'easy', km },
        start: formatClock(p.start!),
        minutes,
        source: 'auto',
        updatedAt: now,
      })
    }
    for (let i = 0; i < qualityLeft; i++) addRun(true)
    for (let i = 0; i < easyLeft; i++) addRun(false)
  }

  // Hari tanpa tempat karena jaga: sebutkan supaya jelas kenapa sesi berkurang.
  if (!open.length && days.some((d) => d.date >= today)) skipped.push('Sisa minggu ini hanya jaga dan pasca-jaga.')
  return { sessions: sessions.sort((a, b) => a.date.localeCompare(b.date) || slotOrder(a.start) - slotOrder(b.start)), skipped }
}

export const plannedId = (date: ISODate, kind: Kind) => `#plw:${date}:${kind}`

/** Kenapa sesi terjadwal ini perlu dipindah (`null` = aman). Dipakai untuk tanda "perlu disusun ulang". */
export function plannedIssue(p: Pick<PlannedWorkout, 'start' | 'minutes'>, day: Pick<PlanDay, 'type' | 'busy'>): string | null {
  if (day.type === 'jaga') return 'hari jaga'
  if (day.type === 'pasca') return 'pasca-jaga'
  const start = min(p.start)
  if (start == null) return null
  // Sangga 15 menit di sekitar tentir/agenda tidak dihitung bentrok; yang dihitung tabrakan sungguhan.
  const hit = day.busy.find((b) => start < b.end - 15 && b.start + 15 < start + p.minutes)
  return hit ? `bentrok ${hit.label}` : null
}
