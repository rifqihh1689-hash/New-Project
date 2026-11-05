import { beforeEach, describe, expect, it } from 'vitest'
import { resetDatabase } from '../test/db-utils'
import { privateId } from '../lib/id'
import type { Habit } from '../types'
import { setDayType } from './daily'
import { db } from './db'
import {
  deleteWorkout,
  loadExercises,
  loadTargets,
  loadWorkouts,
  restoreWorkout,
  saveExercise,
  saveTargets,
  saveWorkout,
  undoWorkout,
} from './training'
import { PatientIdentityError } from './daily'

beforeEach(resetDatabase)

const habit = (id: string, name: string): Habit => ({
  id,
  name,
  roleId: '#role:pulih',
  size: 'kecil',
  dayTypes: ['stase', 'libur'],
  weekdays: [],
  minutes: null,
  kind: 'normal',
  active: true,
  order: 50,
  createdAt: 0,
  updatedAt: 0,
})

describe('log latihan', () => {
  it('menyimpan sesi beban dan mencentang habit latihan yang cocok', async () => {
    await db.habits.bulkPut([habit('hb_beban', 'Latihan beban'), habit('hb_lari', 'Lari pagi')])
    await setDayType('2026-11-05', 'stase')
    const { habit: checked } = await saveWorkout({
      date: '2026-11-05',
      kind: 'beban',
      entries: [{ exerciseId: '#ex:bench', sets: [{ kg: 60, reps: 8 }], feel: 'pas' }],
      run: null,
      note: '',
    })
    expect(checked).toBe('Latihan beban')
    expect((await db.habitLogs.get(privateId.habitLog('hb_beban', '2026-11-05')))?.done).toBe(true)
    expect(await db.habitLogs.get(privateId.habitLog('hb_lari', '2026-11-05'))).toBeUndefined()

    const run = await saveWorkout({ date: '2026-11-05', kind: 'lari', entries: [], run: { km: 5, sec: 1900, type: 'easy' }, note: '' })
    expect(run.habit).toBe('Lari pagi')
    expect(await loadWorkouts()).toHaveLength(2)
  })

  it('tanpa habit yang cocok tetap tersimpan; hapus bisa diurungkan', async () => {
    const { id, habit: checked } = await saveWorkout({
      date: '2026-11-05',
      kind: 'lari',
      entries: [],
      run: { km: 3, sec: 1200, type: 'tes' },
      note: '',
    })
    expect(checked).toBeNull()
    const removed = await deleteWorkout(id)
    expect(await loadWorkouts()).toHaveLength(0)
    await restoreWorkout(removed!)
    expect(await loadWorkouts()).toHaveLength(1)
  })

  it('mencatat sesi bisa diurungkan: sesi hilang, centang habit yang ikut dibuat dicabut', async () => {
    await db.habits.bulkPut([habit('hb_beban', 'Latihan beban'), habit('hb_lari', 'Lari pagi')])
    await setDayType('2026-11-05', 'stase')
    const strength = { date: '2026-11-05', kind: 'beban' as const, entries: [], run: null, note: '' }
    const saved = await saveWorkout(strength)
    expect(saved.tickedHabitId).toBe('hb_beban')
    await undoWorkout(saved)
    expect(await loadWorkouts()).toHaveLength(0)
    expect((await db.habitLogs.get(privateId.habitLog('hb_beban', '2026-11-05')))?.done).toBe(false)

    // Habit yang sudah dicentang sebelumnya tidak ikut dicabut.
    const first = await saveWorkout(strength)
    const second = await saveWorkout(strength)
    expect(second.tickedHabitId).toBeNull()
    await undoWorkout(second)
    expect((await db.habitLogs.get(privateId.habitLog('hb_beban', '2026-11-05')))?.done).toBe(true)
    expect((await loadWorkouts()).map((w) => w.id)).toEqual([first.id])
  })

  it('catatan yang mirip identitas pasien ditolak', async () => {
    await expect(
      saveWorkout({ date: '2026-11-05', kind: 'beban', entries: [], run: null, note: 'habis visite Tn. Budi bed 4' }),
    ).rejects.toBeInstanceOf(PatientIdentityError)
  })

  it('gerakan bawaan bisa diubah, target tersimpan di profil', async () => {
    const bench = (await loadExercises()).find((e) => e.id === '#ex:bench')!
    await saveExercise({ ...bench, repMin: 4, repMax: 6 })
    const after = await loadExercises()
    expect(after.filter((e) => e.id === '#ex:bench')).toHaveLength(1)
    expect(after.find((e) => e.id === '#ex:bench')?.repMax).toBe(6)
    await saveTargets({ benchKg: 110 })
    await saveTargets({ fiveKSec: 1700 })
    expect(await loadTargets()).toEqual({ benchKg: 110, fiveKSec: 1700, tenKSec: 3600 })
  })
})
