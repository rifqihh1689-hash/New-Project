import { habitsForDay } from '../domain/xp'
import { DEFAULT_TARGETS } from '../domain/training'
import { createId, privateId } from '../lib/id'
import { groupOf, type CatalogItem } from '../domain/exerciseCatalog'
import type { Exercise, ISODate, TrainingSplit, TrainingTargets, Workout } from '../types'
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
    muscle: 'dada',
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

/** Tambah gerakan dari katalog (rentang rep, set, dan kenaikan ikut katalog). */
export async function addFromCatalog(item: CatalogItem, order: number): Promise<Exercise> {
  const ex: Exercise = {
    ...newExercise(order),
    name: item.name,
    muscle: item.muscle,
    group: groupOf(item.muscle),
    repMin: item.repMin,
    repMax: item.repMax,
    sets: item.sets,
    increment: item.increment,
  }
  await saveExercise(ex)
  return ex
}

/**
 * Ganti variasi: gerakan lama diarsipkan (riwayatnya tetap), variasi baru ditambahkan di urutan yang sama.
 * Mengembalikan keduanya untuk Urungkan.
 */
export async function swapExercise(old: Exercise, item: CatalogItem): Promise<{ old: Exercise; added: Exercise }> {
  await saveExercise({ ...old, archived: true })
  const added = await addFromCatalog(item, old.order)
  return { old, added }
}

export async function undoSwap({ old, added }: { old: Exercise; added: Exercise }): Promise<void> {
  await db.exercises.delete(added.id)
  await saveExercise({ ...old, archived: false })
}

export async function saveSplit(split: TrainingSplit): Promise<void> {
  await updateProfile({ trainingSplit: split })
}

export async function loadTargets(): Promise<TrainingTargets> {
  const profile = await loadProfile()
  return { ...DEFAULT_TARGETS, ...profile.trainingTargets }
}

export async function saveTargets(changes: Partial<TrainingTargets>): Promise<void> {
  const current = (await db.profile.get(DEFAULT_PROFILE.id))?.trainingTargets
  await updateProfile({ trainingTargets: { ...current, ...changes } })
}

export const HABIT_MATCH: Record<Workout['kind'], RegExp> = {
  beban: /beban|bench|gym|angkat|squat|deadlift|compound|upper|lower|fitness/i,
  lari: /lari|run|jog/i,
}

/**
 * Menyimpan sesi latihan. Habit latihan yang cocok di tanggal itu (mis. "Latihan beban") ikut tercentang.
 * Mengembalikan nama habit yang dicentang, bila ada.
 */
export interface SavedWorkout {
  id: string
  date: ISODate
  /** Nama habit yang dicentang, bila ada. */
  habit: string | null
  /** Habit yang baru dicentang oleh sesi ini (dicabut lagi saat diurungkan). */
  tickedHabitId: string | null
}

export async function saveWorkout(input: Omit<Workout, 'id' | 'createdAt' | 'updatedAt'> & { id?: string }): Promise<SavedWorkout> {
  assertNoPatientIdentity(input.note)
  const now = Date.now()
  const id = input.id ?? createId('wko')
  const prev = input.id ? await db.workouts.get(input.id) : undefined
  await db.workouts.put({ ...input, id, createdAt: prev?.createdAt ?? now, updatedAt: now })
  const [habits, day] = await Promise.all([loadHabits(), db.days.get(privateId.day(input.date))])
  const candidates = day?.type ? habitsForDay(habits, input.date, day.type) : habits.filter((h) => h.active)
  const habit = candidates.find((h) => h.kind === 'normal' && HABIT_MATCH[input.kind].test(h.name))
  let tickedHabitId: string | null = null
  if (habit) {
    const wasDone = (await db.habitLogs.get(privateId.habitLog(habit.id, input.date)))?.done
    await setHabitDone(habit.id, input.date, true)
    if (!wasDone) tickedHabitId = habit.id
  }
  return { id, date: input.date, habit: habit?.name ?? null, tickedHabitId }
}

/** Membatalkan sesi yang baru dicatat: sesi dihapus, centang habit yang ikut dibuat dicabut. */
export async function undoWorkout(saved: SavedWorkout): Promise<void> {
  await db.workouts.delete(saved.id)
  if (saved.tickedHabitId) await setHabitDone(saved.tickedHabitId, saved.date, false)
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
