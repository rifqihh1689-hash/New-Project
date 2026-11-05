import { beforeEach, describe, expect, it } from 'vitest'
import { resetDatabase } from '../test/db-utils'
import { db } from './db'
import {
  addHabitMinutes,
  addTask,
  loadAllResults,
  loadDaySnapshot,
  freezeLockedDays,
  moveUndoneToTomorrow,
  PatientIdentityError,
  setDayType,
  setHabitDone,
  setSleep,
  toggleTask,
} from './daily'
import { DEFAULT_ROLES } from './defaults'
import { loadRoles, saveRole } from './structure'

const TODAY = '2026-11-05'

beforeEach(resetDatabase)

describe('hari & tugas', () => {
  it('satu baris per tanggal dengan ID privat deterministik', async () => {
    await setDayType(TODAY, 'stase')
    await setSleep(TODAY, 5.5, 0.5)
    const days = await db.days.toArray()
    expect(days).toHaveLength(1)
    expect(days[0]).toMatchObject({ id: '#day:2026-11-05', type: 'stase', sleepNight: 5.5, nap: 0.5 })
  })

  it('pasca-jaga memindahkan tugas non-pemulihan yang belum selesai ke besok', async () => {
    const study = await addTask({ title: '40 soal muskuloskeletal', roleId: '#role:ukmppd', date: TODAY })
    const walk = await addTask({ title: 'Jalan 20 menit', roleId: '#role:pulih', date: TODAY })
    const done = await addTask({ title: 'Laporan pagi', roleId: '#role:koas', date: TODAY })
    await toggleTask(done)
    const moved = await setDayType(TODAY, 'pasca')
    expect(moved).toEqual([study.id])
    expect((await db.tasks.get(study.id))?.date).toBe('2026-11-06')
    expect((await db.tasks.get(walk.id))?.date).toBe(TODAY)
    expect((await db.tasks.get(done.id))?.date).toBe(TODAY)
  })

  it('menolak teks yang mirip identitas pasien', async () => {
    await expect(addTask({ title: 'FU Tn. Budi bed 3', date: TODAY })).rejects.toBeInstanceOf(PatientIdentityError)
    await expect(addTask({ title: 'Cek lab RM 1234567', date: TODAY })).rejects.toBeInstanceOf(PatientIdentityError)
    expect(await db.tasks.count()).toBe(0)
  })

  it('tutup hari memindahkan sisa tugas ke besok', async () => {
    await addTask({ title: 'A', date: TODAY })
    const b = await addTask({ title: 'B', date: TODAY })
    await toggleTask(b)
    const ids = await moveUndoneToTomorrow(TODAY)
    expect(ids).toHaveLength(1)
    expect(await db.tasks.where('date').equals('2026-11-06').count()).toBe(1)
  })
})

describe('XP dari database', () => {
  it('menghitung tugas + habit otomatis dengan pengali tidur', async () => {
    await setDayType(TODAY, 'stase')
    await setSleep(TODAY, 5.5, 1) // total 6,5 j → ×1,2 dan habit tidur ≥6 j selesai
    const t = await addTask({ title: '40 soal', roleId: '#role:ukmppd', date: TODAY, size: 'besar' })
    await toggleTask(t)
    const snap = await loadDaySnapshot(TODAY, TODAY)
    // 20 (tugas besar) + 10 (habit tidur) = 30 × 1,2 = 36
    expect(snap.result.xp).toBe(36)
    expect(snap.result.total).toBe(3) // tugas + habit tidur + habit berhenti kerja
    expect(snap.result.pass).toBe(true)
  })

  it('pasca-jaga hanya sah setelah jaga', async () => {
    await setDayType('2026-11-04', 'jaga')
    await setDayType(TODAY, 'pasca')
    await setHabitDone('#habit:pasca-rest', TODAY, true)
    const snap = await loadDaySnapshot(TODAY, TODAY)
    expect(snap.result.effType).toBe('pasca')
    expect(snap.result.xp).toBe(33) // 100 × 1/3
  })

  it('hari lama dibekukan dan tidak berubah walau datanya diedit', async () => {
    const old = '2026-11-01'
    await setDayType(old, 'libur')
    await setSleep(old, 7, 0)
    await setHabitDone('#habit:workend', old, true)
    const frozen = await freezeLockedDays(TODAY)
    expect(frozen).toBe(1)
    const before = (await db.days.get('#day:2026-11-01'))!.frozen!
    await setSleep(old, 3, 0)
    const { results } = await loadAllResults(TODAY)
    expect(results.get(old)).toEqual(before)
  })
})

describe('bawaan tanpa isi awal', () => {
  it('peran bawaan muncul tanpa ditulis ke database, perubahan disimpan dengan ID yang sama', async () => {
    expect(await db.lifeRoles.count()).toBe(0)
    expect((await loadRoles()).map((r) => r.name)).toEqual(DEFAULT_ROLES.map((r) => r.name))
    await saveRole({ ...DEFAULT_ROLES[0], name: 'Internsip', archived: false })
    const roles = await loadRoles()
    expect(roles).toHaveLength(DEFAULT_ROLES.length)
    expect(roles[0]).toMatchObject({ id: '#role:koas', name: 'Internsip' })
  })
})

describe('habit bermenit', () => {
  it('menit menumpuk dan centang menyimpan menit', async () => {
    const habit = { id: 'hab_x', minutes: 45 }
    await addHabitMinutes(habit, TODAY, 30)
    expect(await db.habitLogs.get('#hl:hab_x:2026-11-05')).toMatchObject({ minutes: 30, done: false })
    await addHabitMinutes(habit, TODAY, 15)
    expect(await db.habitLogs.get('#hl:hab_x:2026-11-05')).toMatchObject({ minutes: 45, done: true })
    await setHabitDone('hab_x', TODAY, false)
    expect(await db.habitLogs.get('#hl:hab_x:2026-11-05')).toMatchObject({ minutes: 45, done: false })
  })
})
