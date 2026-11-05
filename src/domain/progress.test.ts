import { describe, expect, it } from 'vitest'
import { computeStreak, consistency, dayStatus, levelFromXp, type DayStatus } from './progress'
import { DEFAULT_RULES } from './rules'

const statuses = (map: Record<string, DayStatus>) => (d: string) => map[d] ?? 'fail'

describe('status hari', () => {
  it('lolos / netral / putus', () => {
    expect(dayStatus({ pass: true, effType: 'stase' })).toBe('pass')
    expect(dayStatus({ pass: false, effType: 'jaga' })).toBe('neutral')
    expect(dayStatus({ pass: false, effType: 'pasca' })).toBe('neutral')
    expect(dayStatus({ pass: false, effType: 'stase' })).toBe('fail')
    expect(dayStatus(undefined)).toBe('fail')
  })
})

describe('streak', () => {
  it('jaga & pasca-jaga tidak memutus dan tidak menambah', () => {
    const s = statuses({
      '2026-11-01': 'pass',
      '2026-11-02': 'pass',
      '2026-11-03': 'neutral',
      '2026-11-04': 'neutral',
      '2026-11-05': 'pass',
    })
    expect(computeStreak('2026-11-05', '2026-11-01', s)).toEqual({ current: 3, best: 3 })
  })

  it('hari ini yang belum lolos tidak memutus', () => {
    const s = statuses({ '2026-11-03': 'pass', '2026-11-04': 'pass', '2026-11-05': 'fail' })
    expect(computeStreak('2026-11-05', '2026-11-03', s).current).toBe(2)
  })

  it('hari gagal atau kosong memutus', () => {
    const s = statuses({ '2026-11-01': 'pass', '2026-11-02': 'pass', '2026-11-03': 'pass', '2026-11-05': 'pass' })
    expect(computeStreak('2026-11-05', '2026-11-01', s)).toEqual({ current: 1, best: 3 })
  })

  it('belum ada catatan', () => {
    expect(computeStreak('2026-11-05', null, statuses({}))).toEqual({ current: 0, best: 0 })
  })
})

describe('level', () => {
  it('L → L+1 butuh 150 + 50·L', () => {
    expect(levelFromXp(0, DEFAULT_RULES)).toEqual({ level: 1, into: 0, need: 200 })
    expect(levelFromXp(199, DEFAULT_RULES).level).toBe(1)
    expect(levelFromXp(200, DEFAULT_RULES)).toEqual({ level: 2, into: 0, need: 250 })
    expect(levelFromXp(450, DEFAULT_RULES)).toEqual({ level: 3, into: 0, need: 300 })
    expect(levelFromXp(-50, DEFAULT_RULES).level).toBe(1)
  })
})

describe("konsistensi mutaba'ah", () => {
  it('menghitung hari unik dalam jendela', () => {
    const dates = ['2026-11-05', '2026-11-04', '2026-11-04', '2026-10-30', '2026-10-01']
    expect(consistency(dates, '2026-11-05', 7)).toEqual({ done: 3, total: 7 })
    expect(consistency(dates, '2026-11-05', 30)).toEqual({ done: 3, total: 30 })
  })
})
