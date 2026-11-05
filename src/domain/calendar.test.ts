import { describe, expect, it } from 'vitest'
import type { DayType } from '../types'
import { jagaChanges, jagaStats, monthGrid } from './calendar'

const typesOf = (m: Record<string, DayType>) => (d: string) => m[d] ?? null

describe('kalender', () => {
  it('grid 6 minggu mulai Senin', () => {
    const g = monthGrid('2026-11') // 1 Nov 2026 = Minggu
    expect(g).toHaveLength(42)
    expect(g[0]).toBe('2026-10-26')
    expect(g[6]).toBe('2026-11-01')
  })

  it('jaga → besoknya pasca bila kosong; tidak menimpa pilihan lain', () => {
    expect(jagaChanges('2026-11-10', true, typesOf({}))).toEqual([
      { date: '2026-11-10', type: 'jaga' },
      { date: '2026-11-11', type: 'pasca' },
    ])
    expect(jagaChanges('2026-11-10', true, typesOf({ '2026-11-11': 'jaga' }))).toEqual([{ date: '2026-11-10', type: 'jaga' }])
  })

  it('batal jaga ikut mengosongkan pasca besoknya', () => {
    expect(jagaChanges('2026-11-10', false, typesOf({ '2026-11-10': 'jaga', '2026-11-11': 'pasca' }))).toEqual([
      { date: '2026-11-10', type: null },
      { date: '2026-11-11', type: null },
    ])
  })

  it('statistik jaga: jumlah, berurutan, minggu berat', () => {
    const t = typesOf({ '2026-11-02': 'jaga', '2026-11-04': 'jaga', '2026-11-06': 'jaga', '2026-11-10': 'jaga', '2026-11-11': 'jaga' })
    expect(jagaStats('2026-11', t)).toEqual({ count: 5, backToBack: 1, heavyWeeks: ['2026-11-02'] })
  })
})
