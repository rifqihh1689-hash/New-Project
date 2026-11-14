import { nextDay } from '../domain/exerciseCatalog'
import { chapterOn, effectiveRitme, normalizeClock } from '../domain/ritme'
import { type DayScheduleInput } from '../domain/schedule'
import { sleepTotal } from '../domain/sleep'
import { addDays, isValidISODate, weekDates, weekStart, wibMinutes } from '../domain/time'
import { planRunWeek, readiness, runsOf } from '../domain/training'
import {
  busyOf,
  planWeek,
  plannedId,
  plannedIssue,
  resolveDayTypes,
  resolveTrainingSchedule,
  type PlanDay,
  type PlanResult,
} from '../domain/trainingSchedule'
import { suggestDayType } from '../domain/dayType'
import { privateId } from '../lib/id'
import type { DayType, ISODate, PlannedWorkout, RunType, TrainingScheduleSettings, TrainingSplit, Workout } from '../types'
import { db } from './db'
import { loadHabits, loadProfile, rulesOf, updateProfile } from './structure'
import { HABIT_MATCH, loadWorkouts } from './training'

export class ScheduleError extends Error {}

async function weekContext(today: ISODate) {
  const week = weekDates(today)
  const [profile, chapters, stored, sessions, events, planned, workouts, habits] = await Promise.all([
    loadProfile(),
    db.chapters.toArray(),
    db.days.where('date').between(addDays(week[0], -1), week[6], true, true).toArray(),
    db.tentirSessions.where('date').between(week[0], week[6], true, true).toArray(),
    db.events.where('date').between(week[0], week[6], true, true).toArray(),
    db.plannedWorkouts.where('date').between(week[0], week[6], true, true).toArray(),
    loadWorkouts(),
    loadHabits(),
  ])
  const rules = rulesOf(profile)
  const split: TrainingSplit = profile.trainingSplit ?? 'fullbody'
  const settings = resolveTrainingSchedule(profile.trainingSchedule, split)
  const typeOf = new Map(stored.map((d) => [d.date, d.type]))
  const days: PlanDay[] = resolveDayTypes(week, (d) => typeOf.get(d) ?? null, typeOf.get(addDays(week[0], -1)) ?? null).map(
    ({ date, type, typed }) => {
      const ritme = effectiveRitme(type, profile.ritme, chapterOn(chapters, date))
      return {
        date,
        type,
        typed,
        ritme,
        busy: busyOf(
          ritme,
          sessions.filter((s) => s.date === date),
          events.filter((e) => e.date === date),
        ),
      }
    },
  )
  const weekly = workouts.filter((w) => w.date >= week[0] && w.date <= week[6])
  const pref = (kind: Workout['kind']) => {
    const set = new Set<number>()
    for (const h of habits) if (h.active && h.kind === 'normal' && HABIT_MATCH[kind].test(h.name)) for (const w of h.weekdays) set.add(w)
    return [...set]
  }
  const jaga = days.filter((d) => d.type === 'jaga').length
  return {
    today,
    week,
    profile,
    rules,
    split,
    settings,
    days,
    planned,
    workouts,
    weekly,
    runPlan: planRunWeek(runsOf(workouts), today, jaga, null),
    preferred: { beban: pref('beban'), lari: pref('lari') },
  }
}

type Ctx = Awaited<ReturnType<typeof weekContext>>

const compute = (c: Ctx, now: number, nowMinutes: number | null): PlanResult =>
  planWeek({
    nowMinutes: nowMinutes ?? undefined,
    today: c.today,
    days: c.days,
    split: c.split,
    nextProgramDay: nextDay(c.split, c.workouts),
    settings: c.settings,
    run: c.runPlan,
    done: c.weekly,
    fixed: c.planned.filter((p) => p.source !== 'auto'),
    preferred: c.preferred,
    limit: c.rules.workEndLimit,
    now,
  })

export type PlannedState = 'selesai' | 'terlewat' | 'bentrok' | 'rencana'

/** Jadwal latihan minggu ini untuk halaman Latihan: tujuh hari, sesi terjadwal dengan statusnya, dan usulan susunan. */
export async function loadWeekPlan(today: ISODate, nowMinutes: number | null = wibMinutes()) {
  const c = await weekContext(today)
  const doneOn = new Set(c.weekly.map((w) => `${w.date}:${w.kind}`))
  const days = c.days.map((d) => ({
    date: d.date,
    type: d.type,
    typed: d.typed,
    sessions: c.planned
      .filter((p) => p.date === d.date)
      .sort((a, b) => a.start.localeCompare(b.start))
      .map((p) => {
        const done = doneOn.has(`${p.date}:${p.kind}`)
        const issue = done || p.date < today ? null : plannedIssue(p, d)
        const state: PlannedState = done ? 'selesai' : p.date < today ? 'terlewat' : issue ? 'bentrok' : 'rencana'
        return { p, state, issue }
      }),
    /** Sesi yang dicatat tanpa dijadwalkan. */
    extra: c.weekly.filter((w) => w.date === d.date && !c.planned.some((p) => p.date === d.date && p.kind === w.kind)),
  }))
  const all = days.flatMap((d) => d.sessions)
  return {
    today,
    monday: c.week[0],
    days,
    settings: c.settings,
    split: c.split,
    hasPlan: c.planned.length > 0,
    issues: all.filter((s) => s.state === 'bentrok').length,
    missed: all.filter((s) => s.state === 'terlewat').length,
    doneStrength: c.weekly.filter((w) => w.kind === 'beban').length,
    doneRuns: c.weekly.filter((w) => w.kind === 'lari').length,
    runPlan: c.runPlan,
    /** Susunan yang akan dipakai bila "Susun" ditekan. */
    preview: compute(c, 0, nowMinutes),
  }
}

export type WeekPlan = Awaited<ReturnType<typeof loadWeekPlan>>

export interface PlanChange {
  removed: PlannedWorkout[]
  added: PlannedWorkout[]
  skipped: string[]
}

/**
 * Menyusun (ulang) minggu ini: sesi otomatis yang belum dikerjakan mulai hari ini diganti susunan baru.
 * Sesi buatan tangan, usulan Claude, dan sesi yang sudah dicatat tidak disentuh.
 */
/** `nowMinutes` = jam dinding WIB untuk hari ini; `null` bila `today` bukan hari berjalan (mis. Senin minggu depan). */
export async function applyWeekPlan(today: ISODate, nowMinutes: number | null = wibMinutes()): Promise<PlanChange> {
  const c = await weekContext(today)
  const now = Date.now()
  const result = compute(c, now, nowMinutes)
  const doneOn = new Set(c.weekly.map((w) => `${w.date}:${w.kind}`))
  const removed = c.planned.filter((p) => p.source === 'auto' && p.date >= today && !doneOn.has(`${p.date}:${p.kind}`))
  await db.transaction('rw', db.plannedWorkouts, async () => {
    await db.plannedWorkouts.bulkDelete(removed.map((p) => p.id))
    await db.plannedWorkouts.bulkPut(result.sessions)
  })
  return { removed, added: result.sessions, skipped: result.skipped }
}

export async function undoWeekPlan(change: PlanChange): Promise<void> {
  await db.transaction('rw', db.plannedWorkouts, async () => {
    await db.plannedWorkouts.bulkDelete(change.added.map((p) => p.id))
    await db.plannedWorkouts.bulkPut(change.removed)
  })
}

/** Bila "otomatis tiap minggu" aktif: susun sekali per minggu saat app dibuka (ID deterministik, aman di banyak perangkat). */
export async function ensureWeekPlan(today: ISODate, nowMinutes?: number | null): Promise<boolean> {
  const profile = await loadProfile()
  const monday = weekStart(today)
  if (!profile.trainingSchedule?.auto || profile.trainingSchedule.lastAutoWeek === monday) return false
  await applyWeekPlan(today, nowMinutes)
  await updateProfile({ trainingSchedule: { ...profile.trainingSchedule, lastAutoWeek: monday } })
  return true
}

export async function saveTrainingSchedule(changes: Partial<TrainingScheduleSettings>): Promise<void> {
  const profile = await loadProfile()
  await updateProfile({ trainingSchedule: { ...profile.trainingSchedule, ...changes } })
}

export interface PlannedInput {
  /** ID sesi yang diubah (bila tanggal/jenis berubah, baris lama dihapus). */
  id?: string
  date: ISODate
  kind: Workout['kind']
  start: string
  minutes: number
  day?: string
  run?: { type: RunType; km: number }
  source?: PlannedWorkout['source']
}

/** Menambah atau memindah sesi terjadwal. Satu sesi per jenis per hari: yang sudah ada di tanggal itu diganti. */
export async function savePlanned(input: PlannedInput): Promise<PlannedWorkout> {
  if (!isValidISODate(input.date)) throw new ScheduleError('Tanggal tidak valid.')
  const start = normalizeClock(input.start)
  if (!start) throw new ScheduleError('Jam mulai belum dikenali (contoh 16.30).')
  const minutes = Math.round(input.minutes)
  if (!(minutes >= 10 && minutes <= 240)) throw new ScheduleError('Lama sesi 10–240 menit.')
  if (input.kind === 'lari' && input.run && !(input.run.km > 0 && input.run.km < 100)) throw new ScheduleError('Jarak lari tidak valid.')
  const p: PlannedWorkout = {
    id: plannedId(input.date, input.kind),
    date: input.date,
    kind: input.kind,
    ...(input.kind === 'beban' && input.day ? { day: input.day } : {}),
    ...(input.kind === 'lari' && input.run ? { run: input.run } : {}),
    start,
    minutes,
    source: input.source ?? 'manual',
    updatedAt: Date.now(),
  }
  await db.transaction('rw', db.plannedWorkouts, async () => {
    if (input.id && input.id !== p.id) await db.plannedWorkouts.delete(input.id)
    await db.plannedWorkouts.put(p)
  })
  return p
}

export async function deletePlanned(id: string): Promise<PlannedWorkout | undefined> {
  const p = await db.plannedWorkouts.get(id)
  await db.plannedWorkouts.delete(id)
  return p
}

export async function restorePlanned(p: PlannedWorkout): Promise<void> {
  await db.plannedWorkouts.put(p)
}

/** Sesi terjadwal (belum dikerjakan, mulai `from`) yang jatuh di hari jaga/pasca atau menabrak tentir/agenda. */
export async function plannedConflicts(from: ISODate): Promise<{ p: PlannedWorkout; issue: string }[]> {
  const c = await weekContext(from)
  const doneOn = new Set(c.weekly.map((w) => `${w.date}:${w.kind}`))
  return c.planned
    .filter((p) => p.date >= from && !doneOn.has(`${p.date}:${p.kind}`))
    .map((p) => ({
      p,
      issue: plannedIssue(
        p,
        c.days.find((d) => d.date === p.date)!,
      ),
    }))
    .filter((x): x is { p: PlannedWorkout; issue: string } => !!x.issue)
}

export interface DayScheduleData {
  input: DayScheduleInput
  /** Tipe hari tersimpan (bukan perkiraan). */
  typed: boolean
}

/**
 * Bahan jadwal terpadu satu tanggal. Jam sekarang sengaja tidak ikut: komponen menambahkannya sendiri
 * supaya linimasa bergerak tanpa memuat ulang data.
 */
export async function loadDaySchedule(date: ISODate): Promise<DayScheduleData> {
  const week = weekDates(date)
  const [profile, chapters, stored, sessions, events, planned, workouts] = await Promise.all([
    loadProfile(),
    db.chapters.toArray(),
    db.days.bulkGet([privateId.day(addDays(date, -1)), privateId.day(date), privateId.day(addDays(date, 1))]),
    db.tentirSessions.where('date').equals(date).toArray(),
    db.events.where('date').equals(date).toArray(),
    db.plannedWorkouts.where('date').between(week[0], week[6], true, true).toArray(),
    db.workouts.where('date').equals(date).toArray(),
  ])
  const rules = rulesOf(profile)
  const [prev, day, next] = stored
  const type: DayType = day?.type ?? suggestDayType(date, prev?.type ?? null)
  const ritme = effectiveRitme(type, profile.ritme, chapterOn(chapters, date))
  const tomorrow = addDays(date, 1)
  const nextType: DayType = next?.type ?? suggestDayType(tomorrow, type)
  // Jam bangun besok = slot pertama ritme besok bila pagi; kalau tidak ada, slot pertama hari ini.
  const morning = (slots: { time: string }[]) => slots.map((s) => s.time).find((t) => t >= '03.00' && t < '10.00') ?? null
  const wake = morning(effectiveRitme(nextType, profile.ritme, chapterOn(chapters, tomorrow))) ?? morning(ritme)
  return {
    typed: day?.type != null,
    input: {
      date,
      type,
      ritme,
      sessions,
      events,
      planned: planned.filter((p) => p.date === date),
      workouts,
      planActive: planned.length > 0,
      sleep: { wake, target: rules.sleepQuestMin, napLogged: day?.nap ?? 0 },
      readiness: readiness(day?.type ?? null, sleepTotal(day?.sleepNight ?? null, day?.nap ?? 0, rules)),
      lowEnergy: day?.energy != null && day.energy <= 2,
    },
  }
}
