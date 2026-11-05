import { habitsForDay } from '../domain/xp'
import { DEFAULT_TARGETS } from '../domain/training'
import { createId, privateId } from '../lib/id'
import type { Exercise, ISODate, TrainingTargets, Workout } from '../types'
import { assertNoPatientIdentity, setHabitDone } from './daily'
import { db } from './db'
import { DEFAULT_EXERCISES, DEFAULT_PROFILE, mergeWithDefaults } from './defaults'
import { loadHabits, loadProfile, updateProfile } from './structure'

export async function loadExercises(): Promise<Exercise[]> {
  return mergeWithDefaults(DEFAULT_EXERCISES, await db.exercises.toArray())
}

export async function saveExercise(exercise: Exercise): Promise<void> {
  assertNoPatientIdentity(exercise.name)
  await db.exercises.put({ ...exercise, updatedAt: Date.now() })
}

export function newExercise(order: number): Exercise {
  const now = Date.now()
  return {
    id: createId('exr'),
    name: '',
    group: 'upper',
    repMin: 6,
    repMax: 10,
    sets: 3,
    increment: 2.5,
    archived: false,
    order,
    createdAt: now,
    updatedAt: now,
  }
}

export async function loadTargets(): Promise<TrainingTargets> {
  const profile = await loadProfile()
  return { ...DEFAULT_TARGETS, ...profile.trainingTargets }
}

export async function saveTargets(changes: Partial<TrainingTargets>): Promise<void> {
  const current = (await db.profile.get(DEFAULT_PROFILE.id))?.trainingTargets
  await updateProfile({ trainingTargets: { ...current, ...changes } })
}

const HABIT_MATCH: Record<Workout['kind'], RegExp> = {
  beban: /beban|bench|gym|angkat|squat|deadlift|compound|upper|lower|fitness/i,
  lari: /lari|run|jog/i,
}

/**
 * Menyimpan sesi latihan. Habit latihan yang cocok di tanggal itu (mis. "Latihan beban") ikut tercentang.
 * Mengembalikan nama habit yang dicentang, bila ada.
 */
export async function saveWorkout(
  input: Omit<Workout, 'id' | 'createdAt' | 'updatedAt'> & { id?: string },
): Promise<{ id: string; habit: string | null }> {
  assertNoPatientIdentity(input.note)
  const now = Date.now()
  const id = input.id ?? createId('wko')
  const prev = input.id ? await db.workouts.get(input.id) : undefined
  await db.workouts.put({ ...input, id, createdAt: prev?.createdAt ?? now, updatedAt: now })
  const [habits, day] = await Promise.all([loadHabits(), db.days.get(privateId.day(input.date))])
  const candidates = day?.type ? habitsForDay(habits, input.date, day.type) : habits.filter((h) => h.active)
  const habit = candidates.find((h) => h.kind === 'normal' && HABIT_MATCH[input.kind].test(h.name))
  if (habit) await setHabitDone(habit.id, input.date, true)
  return { id, habit: habit?.name ?? null }
}

export async function deleteWorkout(id: string): Promise<Workout | undefined> {
  const w = await db.workouts.get(id)
  await db.workouts.delete(id)
  return w
}

export async function restoreWorkout(w: Workout): Promise<void> {
  await db.workouts.put(w)
}

export async function loadWorkouts(from?: ISODate): Promise<Workout[]> {
  const list = from ? await db.workouts.where('date').aboveOrEqual(from).toArray() : await db.workouts.toArray()
  return list.sort((a, b) => a.date.localeCompare(b.date) || a.createdAt - b.createdAt)
}
