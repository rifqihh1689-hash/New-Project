import { describe, expect, it } from 'vitest'
import { DEFAULT_RULES } from './rules'
import { computeDay, habitsForDay, isLocked, type DayInput, type DayItem } from './xp'

const R = DEFAULT_RULES
const item = (id: string, size: DayItem['size'], done: boolean, recovery = false, kind?: DayItem['kind']): DayItem => ({
  id,
  size,
  done,
  recovery,
  kind,
})
const day = (over: Partial<DayInput>): DayInput => ({
  type: 'stase',
  prevType: null,
  sleepNight: 6,
  nap: 0,
  workEnd: 'ok',
  items: [],
  ...over,
})

describe('rumus XP (MBAPPE OS)', () => {
  it('stase: Σ XP selesai × pengali tidur', () => {
    const r = computeDay(
      day({ sleepNight: 5.5, items: [item('a', 'besar', true), item('b', 'sedang', true), item('c', 'kecil', false)] }),
      R,
    )
    expect(r).toMatchObject({ base: 30, capped: 30, mult: 0.8, xp: 24, total: 3, doneCount: 2, pass: true })
  })

  it('quest mingguan: XP ditambah, tetapi tidak masuk syarat lolos', () => {
    const weekly = (done: boolean): DayItem => ({ ...item('w', 'besar', done), weekly: true })
    const r = computeDay(day({ items: [item('a', 'sedang', true), item('b', 'sedang', false), weekly(true)] }), R)
    expect(r).toMatchObject({ base: 30, xp: 30, total: 2, doneCount: 1, pass: false })
    const open = computeDay(day({ items: [item('a', 'sedang', true), weekly(false)] }), R)
    expect(open).toMatchObject({ base: 10, total: 1, pass: true })
    const pasca = computeDay(day({ type: 'pasca', prevType: 'jaga', items: [item('r', 'kecil', true, true), weekly(true)] }), R)
    expect(pasca).toMatchObject({ xp: 100, total: 1 })
  })

  it('batas 100 sebelum pengali: begadang menambah tugas tidak menolong', () => {
    const items = Array.from({ length: 8 }, (_, i) => item(String(i), 'besar', true)) // 160
    expect(computeDay(day({ sleepNight: 4, items }), R).xp).toBe(60) // 100 × 0,6
    expect(computeDay(day({ sleepNight: 7, items }), R).xp).toBe(120) // 100 × 1,2
  })

  it('qailulah menaikkan pengali', () => {
    const items = [item('a', 'besar', true)]
    expect(computeDay(day({ sleepNight: 5, nap: 0, items }), R).mult).toBe(0.8)
    expect(computeDay(day({ sleepNight: 5, nap: 1.5, items }), R).mult).toBe(1.2)
  })

  it('tidur kosong = ×0,6', () => {
    const r = computeDay(day({ sleepNight: null, items: [item('a', 'besar', true)] }), R)
    expect(r).toMatchObject({ mult: 0.6, multMissing: true, xp: 12 })
  })

  it('jaga: pengali tetap ×1,0, tanpa penalti malam', () => {
    const r = computeDay(day({ type: 'jaga', sleepNight: 3, workEnd: 'late', items: [item('a', 'besar', true)] }), R)
    expect(r).toMatchObject({ mult: 1, penalty: 0, xp: 20 })
  })

  it('pasca-jaga: 100 × selesai/total, hanya pemulihan', () => {
    const items = [item('rest', 'besar', true, true), item('eat', 'sedang', false, true), item('soal', 'besar', true, false)]
    const r = computeDay(day({ type: 'pasca', prevType: 'jaga', items }), R)
    expect(r).toMatchObject({ effType: 'pasca', total: 2, doneCount: 1, xp: 50, pass: false })
  })

  it('pasca-jaga palsu dihitung stase', () => {
    const items = [item('rest', 'besar', true, true)]
    const r = computeDay(day({ type: 'pasca', prevType: 'libur', sleepNight: 6, items }), R)
    expect(r).toMatchObject({ effType: 'stase', invalidPasca: true, xp: 20 })
  })

  it('lewat 21.00 = −15; hari terkunci tanpa isian dianggap lewat', () => {
    const items = [item('a', 'besar', true)]
    expect(computeDay(day({ workEnd: 'late', items }), R)).toMatchObject({ penalty: 15, xp: 5 })
    expect(computeDay(day({ workEnd: null, items }), R).penalty).toBe(0)
    expect(computeDay(day({ workEnd: null, items }), R, { final: true }).penalty).toBe(15)
  })

  it('habit otomatis dinilai dari tidur & jam berhenti kerja', () => {
    const items = [item('sleep', 'sedang', false, true, 'sleep'), item('workend', 'sedang', false, true, 'workend')]
    expect(computeDay(day({ sleepNight: 5, nap: 1, workEnd: 'ok', items }), R)).toMatchObject({ doneCount: 2, base: 20 })
    expect(computeDay(day({ sleepNight: 5, nap: 0.5, workEnd: 'late', items }), R)).toMatchObject({ doneCount: 0 })
  })

  it('lolos bila ≥ 60% selesai', () => {
    const items = (n: number) => Array.from({ length: 5 }, (_, i) => item(String(i), 'kecil', i < n))
    expect(computeDay(day({ items: items(3) }), R).pass).toBe(true)
    expect(computeDay(day({ items: items(2) }), R).pass).toBe(false)
    expect(computeDay(day({ items: [] }), R).pass).toBe(false)
  })

  it('tanpa tipe hari = 0 XP', () => {
    expect(computeDay(day({ type: null, items: [item('a', 'besar', true)] }), R)).toMatchObject({ xp: 0, pass: false, effType: null })
  })
})

describe('habit per hari & penguncian', () => {
  const habits = [
    { id: 'tidur', active: true, dayTypes: ['stase', 'libur'] as const, weekdays: [] },
    { id: 'beban', active: true, dayTypes: ['stase'] as const, weekdays: [1, 3, 5] },
    { id: 'mati', active: false, dayTypes: ['stase'] as const, weekdays: [] },
    { id: 'pulih', active: true, dayTypes: ['pasca'] as const, weekdays: [] },
  ].map((h) => ({ ...h, dayTypes: [...h.dayTypes] }))

  it('berdasarkan tipe hari, hari dalam minggu, dan status aktif', () => {
    expect(habitsForDay(habits, '2026-11-05', 'stase').map((h) => h.id)).toEqual(['tidur']) // Kamis
    expect(habitsForDay(habits, '2026-11-06', 'stase').map((h) => h.id)).toEqual(['tidur', 'beban']) // Jumat
    expect(habitsForDay(habits, '2026-11-06', 'pasca').map((h) => h.id)).toEqual(['pulih'])
    expect(habitsForDay(habits, '2026-11-06', null)).toEqual([])
  })

  it('isi mundur 1 hari, setelah itu terkunci', () => {
    expect(isLocked('2026-11-05', '2026-11-05', R)).toBe(false)
    expect(isLocked('2026-11-04', '2026-11-05', R)).toBe(false)
    expect(isLocked('2026-11-03', '2026-11-05', R)).toBe(true)
  })
})
