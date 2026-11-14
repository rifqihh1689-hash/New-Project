import { describe, expect, it } from 'vitest'
import { DEFAULT_RITME } from '../db/defaults'
import type { DayType, ISODate, PlannedWorkout } from '../types'
import { effectiveRitme } from './ritme'
import { weekDates } from './time'
import {
  busyOf,
  DEFAULT_TRAINING_SCHEDULE,
  findStart,
  planWeek,
  plannedIssue,
  resolveDayTypes,
  resolveTrainingSchedule,
  type PlanDay,
  type PlanInput,
} from './trainingSchedule'

// Senin 9 Nov 2026 … Minggu 15 Nov 2026.
const WEEK = weekDates('2026-11-09')
const settings = { ...DEFAULT_TRAINING_SCHEDULE }

function week(
  types: Partial<Record<ISODate, DayType>> = {},
  extra: Partial<Record<ISODate, Parameters<typeof busyOf>[1]>> = {},
): PlanDay[] {
  return resolveDayTypes(WEEK, (d) => types[d] ?? null, null).map(({ date, type, typed }) => {
    const ritme = effectiveRitme(type, DEFAULT_RITME, null)
    return { date, type, typed, ritme, busy: busyOf(ritme, extra[date] ?? [], []) }
  })
}

const base = (days: PlanDay[], over: Partial<PlanInput> = {}): PlanInput => ({
  today: WEEK[0],
  days,
  split: 'fullbody',
  nextProgramDay: 'Semua',
  settings,
  run: { targetKm: 12, easyRuns: 2, qualityRuns: 1, easyPace: null },
  done: [],
  fixed: [],
  limit: '21.00',
  ...over,
})

const on = (sessions: PlannedWorkout[], kind: 'beban' | 'lari') => sessions.filter((s) => s.kind === kind).map((s) => s.date.slice(8))

describe('tipe hari diperkirakan berantai', () => {
  it('setelah jaga = pasca, Minggu = libur, sisanya stase', () => {
    const t = resolveDayTypes(WEEK, (d) => (d === WEEK[2] ? 'jaga' : null), null)
    expect(t.map((x) => x.type)).toEqual(['stase', 'stase', 'jaga', 'pasca', 'stase', 'stase', 'libur'])
    expect(t[2].typed).toBe(true)
    expect(t[3].typed).toBe(false)
  })
})

describe('jam kosong', () => {
  it('hari stase: setelah qailulah, di jam yang disukai', () => {
    const d = week()[0]
    expect(findStart(d, 60, settings, '21.00')).toBe(16 * 60 + 30)
  })
  it('tentir di jam itu → digeser ke jam kosong terdekat; hari libur memakai slot Olahraga di ritme', () => {
    const d = week({}, { [WEEK[0]]: [{ start: '16.00', hours: 2 }] })[0]
    // Tentir 16.00–18.00 (±15 menit): kosong 15.45 sebelum itu terlalu sempit, jadi setelahnya 18.15.
    expect(findStart(d, 60, settings, '21.00')).toBe(18 * 60 + 15)
    expect(findStart(week()[6], 60, settings, '21.00')).toBe(9 * 60 + 30)
  })
  it('jaga & pasca tidak pernah mendapat jam', () => {
    const days = week({ [WEEK[1]]: 'jaga' })
    expect(findStart(days[1], 60, settings, '21.00')).toBeNull()
    expect(findStart(days[2], 60, settings, '21.00')).toBeNull()
  })
})

describe('menyusun minggu', () => {
  it('minggu biasa: beban Sen-Rab-Jum, lari di hari lain, satu sesi per hari', () => {
    const { sessions, skipped } = planWeek(base(week()))
    expect(on(sessions, 'beban')).toEqual(['09', '11', '13'])
    const runs = sessions.filter((s) => s.kind === 'lari')
    expect(runs).toHaveLength(3)
    expect(new Set(sessions.map((s) => s.date)).size).toBe(6)
    expect(runs.filter((r) => r.run?.type === 'kualitas')).toHaveLength(1)
    expect(runs.reduce((a, r) => a + (r.run?.km ?? 0), 0)).toBe(12)
    expect(skipped).toEqual([])
    expect(sessions.every((s) => s.source === 'auto' && s.id === `#plw:${s.date}:${s.kind}`)).toBe(true)
  })

  it('jaga Rabu → tidak ada sesi di Rabu & Kamis, beban full body tidak berurutan', () => {
    const { sessions } = planWeek(base(week({ [WEEK[2]]: 'jaga' })))
    expect(sessions.some((s) => s.date === WEEK[2] || s.date === WEEK[3])).toBe(false)
    const strength = on(sessions, 'beban').map(Number)
    expect(strength).toHaveLength(3)
    for (let i = 1; i < strength.length; i++) expect(strength[i] - strength[i - 1]).toBeGreaterThan(1)
  })

  it('sesi yang sudah dicatat dihitung; yang lewat tidak dijadwalkan ke belakang', () => {
    const { sessions } = planWeek(
      base(week(), {
        today: WEEK[2],
        done: [{ date: WEEK[0], kind: 'beban', run: null }],
      }),
    )
    expect(on(sessions, 'beban')).toHaveLength(2)
    expect(sessions.every((s) => s.date >= WEEK[2])).toBe(true)
  })

  it('sesi buatan tangan dipertahankan dan dihitung; hari program bergiliran', () => {
    const fixed: PlannedWorkout = {
      id: 'x',
      date: WEEK[1],
      kind: 'beban',
      day: 'Atas',
      start: '05.00',
      minutes: 60,
      source: 'manual',
      updatedAt: 0,
    }
    const { sessions } = planWeek(
      base(week(), { split: 'atas-bawah', nextProgramDay: 'Bawah', settings: { ...settings, strengthPerWeek: 4 }, fixed: [fixed] }),
    )
    const strength = sessions.filter((s) => s.kind === 'beban')
    expect(strength).toHaveLength(3)
    expect(strength.some((s) => s.date === WEEK[1])).toBe(false)
    expect(strength.map((s) => s.day)).toEqual(['Bawah', 'Atas', 'Bawah'])
  })

  it('habit latihan menentukan hari yang disukai', () => {
    const { sessions } = planWeek(base(week(), { preferred: { beban: [2, 4, 6] } }))
    expect(on(sessions, 'beban')).toEqual(['10', '12', '14'])
  })

  it('lari kualitas tidak sehari dengan beban', () => {
    const { sessions } = planWeek(base(week()))
    const q = sessions.find((s) => s.run?.type === 'kualitas')!
    expect(sessions.some((s) => s.kind === 'beban' && s.date === q.date)).toBe(false)
  })

  it('minggu penuh jaga → dilaporkan, tanpa sesi', () => {
    const types = Object.fromEntries(WEEK.map((d, i) => [d, i % 2 === 0 ? 'jaga' : 'pasca'])) as Record<string, DayType>
    const r = planWeek(base(week(types)))
    expect(r.sessions).toEqual([])
    expect(r.skipped.join(' ')).toMatch(/jaga/)
  })
})

describe('setelan & tanda perlu disusun ulang', () => {
  it('jumlah sesi bawaan mengikuti program; nilai aneh dirapikan', () => {
    expect(resolveTrainingSchedule(undefined, 'atas-bawah').strengthPerWeek).toBe(4)
    expect(resolveTrainingSchedule({ strengthPerWeek: 99, timeStase: 'sore' }, 'ppl')).toMatchObject({
      strengthPerWeek: 6,
      timeStase: '16.30',
    })
  })
  it('sesi di hari jaga atau menabrak tentir ditandai', () => {
    const days = week({ [WEEK[1]]: 'jaga' }, { [WEEK[0]]: [{ start: '16.00', hours: 2, student: 'AB' }] })
    expect(plannedIssue({ start: '16.30', minutes: 60 }, days[1])).toBe('hari jaga')
    expect(plannedIssue({ start: '16.30', minutes: 60 }, days[2])).toBe('pasca-jaga')
    expect(plannedIssue({ start: '16.30', minutes: 60 }, days[0])).toBe('bentrok Tentir AB')
    expect(plannedIssue({ start: '18.15', minutes: 60 }, days[0])).toBeNull()
  })
})
