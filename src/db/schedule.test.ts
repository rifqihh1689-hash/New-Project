import { beforeEach, describe, expect, it } from 'vitest'
import { daySchedule } from '../domain/schedule'
import { resetDatabase } from '../test/db-utils'
import { setJaga } from './calendar'
import { setDayType } from './daily'
import { db } from './db'
import {
  applyWeekPlan,
  deletePlanned,
  ensureWeekPlan,
  loadDaySchedule,
  loadWeekPlan,
  plannedConflicts,
  restorePlanned,
  savePlanned,
  saveTrainingSchedule,
  ScheduleError,
  undoWeekPlan,
} from './schedule'
import { saveSession } from './tentir'
import { saveWorkout } from './training'

beforeEach(resetDatabase)

// Senin 9 Nov 2026.
const MON = '2026-11-09'
const date = (n: number) => `2026-11-${String(9 + n).padStart(2, '0')}`
const planned = async () => (await db.plannedWorkouts.toArray()).sort((a, b) => a.date.localeCompare(b.date))

describe('menyusun jadwal latihan minggu ini', () => {
  it('membuat sesi beban & lari dengan jam, satu per hari', async () => {
    const change = await applyWeekPlan(MON, null)
    const list = await planned()
    expect(list.filter((p) => p.kind === 'beban').map((p) => p.date)).toEqual([date(0), date(2), date(4)])
    expect(list.filter((p) => p.kind === 'lari').length).toBeGreaterThanOrEqual(2)
    expect(list.every((p) => /^\d\d\.\d\d$/.test(p.start) && p.source === 'auto')).toBe(true)
    expect(change.added).toHaveLength(list.length)
    await undoWeekPlan(change)
    expect(await planned()).toEqual([])
  })

  it('jaga ditandai → susun ulang memindahkan sesi dari hari jaga & pasca', async () => {
    await applyWeekPlan(MON, null)
    await setJaga(date(2), true)
    const conflicts = await plannedConflicts(MON)
    expect(conflicts.map((c) => c.issue)).toContain('hari jaga')
    await applyWeekPlan(MON, null)
    const list = await planned()
    expect(list.some((p) => p.date === date(2) || p.date === date(3))).toBe(false)
    expect(await plannedConflicts(MON)).toEqual([])
  })

  it('sesi tentir di jam latihan → latihan mendapat jam lain', async () => {
    await saveSession({ student: 'AB', topic: 'Anatomi', date: MON, start: '16.00', hours: 2, fee: 170_000, paid: false })
    await applyWeekPlan(MON, null)
    const mon = (await planned()).find((p) => p.date === MON && p.kind === 'beban')
    expect(mon?.start).toBe('18.15')
  })

  it('sesi buatan tangan tidak digeser; yang sudah dicatat dihitung', async () => {
    const manual = await savePlanned({ date: date(1), kind: 'beban', start: '5', minutes: 60 })
    expect(manual).toMatchObject({ start: '05.00', source: 'manual', id: `#plw:${date(1)}:beban` })
    await saveWorkout({ date: MON, kind: 'beban', entries: [], run: null, note: '' })
    await applyWeekPlan(MON, null)
    const strength = (await planned()).filter((p) => p.kind === 'beban')
    // 3 per minggu: 1 sudah dicatat + 1 manual → tinggal 1 yang disusun.
    expect(strength).toHaveLength(2)
    expect(strength.find((p) => p.date === date(1))).toMatchObject({ source: 'manual', start: '05.00' })
  })

  it('memindah sesi ke hari lain menghapus yang lama; hapus bisa diurungkan; isian salah ditolak', async () => {
    const a = await savePlanned({ date: MON, kind: 'lari', start: '16.30', minutes: 40, run: { type: 'easy', km: 4 } })
    const b = await savePlanned({ id: a.id, date: date(1), kind: 'lari', start: '17.00', minutes: 40, run: { type: 'easy', km: 4 } })
    expect((await planned()).map((p) => p.id)).toEqual([b.id])
    const removed = await deletePlanned(b.id)
    expect(await planned()).toEqual([])
    await restorePlanned(removed!)
    expect(await planned()).toHaveLength(1)
    await expect(savePlanned({ date: MON, kind: 'beban', start: 'sore', minutes: 60 })).rejects.toBeInstanceOf(ScheduleError)
    await expect(savePlanned({ date: MON, kind: 'beban', start: '16.30', minutes: 0 })).rejects.toBeInstanceOf(ScheduleError)
  })

  it('otomatis tiap minggu: sekali per minggu, hanya bila diaktifkan', async () => {
    expect(await ensureWeekPlan(MON, null)).toBe(false)
    await saveTrainingSchedule({ auto: true, strengthPerWeek: 2 })
    expect(await ensureWeekPlan(MON, null)).toBe(true)
    expect((await planned()).filter((p) => p.kind === 'beban')).toHaveLength(2)
    expect(await ensureWeekPlan(date(1), null)).toBe(false)
    expect(await ensureWeekPlan(date(7), null)).toBe(true)
  })

  it('hari ini: tidak pernah dijadwalkan ke jam yang sudah lewat', async () => {
    // Pukul 19.30: sisa hari ini tidak cukup (selesai paling lambat 1 jam sebelum batas kerja) → Senin kosong.
    await applyWeekPlan(MON, 19 * 60 + 30)
    expect((await planned()).some((p) => p.date === MON)).toBe(false)
    await db.plannedWorkouts.clear()
    // Pukul 15.10: sesi Senin tetap ada, tapi setelah jam itu.
    await applyWeekPlan(MON, 15 * 60 + 10)
    const mon = (await planned()).find((p) => p.date === MON)
    expect(mon && mon.start > '15.10').toBe(true)
  })

  it('ringkasan minggu: status tiap sesi', async () => {
    await applyWeekPlan(MON, null)
    await saveWorkout({ date: MON, kind: 'beban', entries: [], run: null, note: '' })
    const w = await loadWeekPlan(date(2), null)
    const states = w.days.flatMap((d) => d.sessions.map((s) => `${d.date.slice(8)}:${s.p.kind}:${s.state}`))
    expect(states).toContain('09:beban:selesai')
    expect(states.some((s) => s.endsWith('terlewat'))).toBe(true)
    expect(w.doneStrength).toBe(1)
    expect(w.hasPlan).toBe(true)
  })
})

describe('bahan jadwal terpadu', () => {
  it('menggabungkan tipe hari, tentir, latihan, dan jam bangun besok', async () => {
    await setDayType(MON, 'stase')
    await saveSession({ student: 'AB', topic: 'Anatomi', date: MON, start: '19.00', hours: 2, fee: 170_000, paid: false })
    await applyWeekPlan(MON, null)
    const { input, typed } = await loadDaySchedule(MON)
    expect(typed).toBe(true)
    expect(input).toMatchObject({ type: 'stase', planActive: true, sleep: { wake: '03.45', target: 6, napLogged: 0 } })
    const s = daySchedule(input)
    expect(s.items.map((i) => i.source)).toEqual(expect.arrayContaining(['ritme', 'tentir', 'latihan', 'tidur']))
    expect(s.conflicts).toEqual([])
  })

  it('tipe hari belum dipilih → perkiraan (setelah jaga = pasca)', async () => {
    await setDayType(MON, 'jaga')
    await db.days.delete(`#day:${date(1)}`)
    const { input, typed } = await loadDaySchedule(date(1))
    expect(typed).toBe(false)
    expect(input.type).toBe('pasca')
  })
})
