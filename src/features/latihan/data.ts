import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '../../db/db'
import { loadExercises, loadTargets, loadWorkouts } from '../../db/training'
import { loadProfile, rulesOf } from '../../db/structure'
import { sleepTotal } from '../../domain/sleep'
import { weekDates, weekStart } from '../../domain/time'
import { exerciseHistory, planRunWeek, prescribe, projectTarget, readiness, runsOf, strengthPlateau, weeklyKm } from '../../domain/training'
import { privateId } from '../../lib/id'
import { inDay, nextDay, SPLITS } from '../../domain/exerciseCatalog'
import type { ISODate, TrainingSplit } from '../../types'

export async function loadLatihan(today: ISODate, pickedDay: string | null = null) {
  const week = weekDates(today)
  const [exercises, workouts, targets, day, weekDays, profile] = await Promise.all([
    loadExercises(),
    loadWorkouts(),
    loadTargets(),
    db.days.get(privateId.day(today)),
    db.days.where('date').between(week[0], week[6], true, true).toArray(),
    loadProfile(),
  ])
  const rules = rulesOf(profile)
  const ready = readiness(day?.type ?? null, sleepTotal(day?.sleepNight ?? null, day?.nap ?? 0, rules))
  const active = exercises.filter((e) => !e.archived)
  const split: TrainingSplit = profile.trainingSplit ?? 'fullbody'
  const suggestedDay = nextDay(split, workouts)
  const programDay = pickedDay && SPLITS[split].days.includes(pickedDay) ? pickedDay : suggestedDay
  const strength = active.map((ex) => {
    const history = exerciseHistory(ex.id, workouts)
    return { ex, history, plan: prescribe(ex, history, ready), plateau: strengthPlateau(history) }
  })
  const bench = strength.find((s) => s.ex.id === '#ex:bench')
  const runs = runsOf(workouts)
  const jaga = weekDays.filter((d) => d.type === 'jaga').length
  return {
    today,
    split,
    programDay,
    suggestedDay,
    /** Gerakan untuk hari program yang dipilih (full body = semua). */
    dayStrength: strength.filter((x) => inDay(x.ex, split, programDay)),
    exercises,
    workouts,
    targets,
    ready,
    dayType: day?.type ?? null,
    strength,
    benchProjection: bench ? projectTarget(bench.history, targets.benchKg, today) : null,
    runs,
    runPlan: planRunWeek(runs, today, jaga, null),
    runDoneKm: weeklyKm(runs, weekStart(today)),
    jaga,
    recent: [...workouts].reverse().slice(0, 12),
  }
}

export type LatihanData = Awaited<ReturnType<typeof loadLatihan>>

export const useLatihan = (today: ISODate, day: string | null = null) => useLiveQuery(() => loadLatihan(today, day), [today, day])
