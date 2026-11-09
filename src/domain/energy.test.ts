import { describe, expect, it } from 'vitest'
import { energyReport } from './energy'
import type { DayType } from '../types'

const d = (date: string, energy: 1 | 2 | 3 | 4 | 5 | undefined, type: DayType | null = 'stase') => ({ date, type, energy })

describe('laporan energi', () => {
  it('7 hari terakhir, rata-rata, dan hari ini', () => {
    const r = energyReport([d('2026-11-09', 4), d('2026-11-08', 2), d('2026-11-02', 5)], '2026-11-09')
    expect(r.today).toBe(4)
    expect(r.recent).toEqual([null, null, null, null, null, 2, 4])
    expect(r.avg7).toBe(3)
  })

  it('rangkaian rendah: hari ini yang belum diisi tidak memutus; energi normal memutus', () => {
    const low = [d('2026-11-08', 1), d('2026-11-07', 2), d('2026-11-06', 2)]
    expect(energyReport(low, '2026-11-09').lowRun).toBe(3) // hari ini kosong → hitung dari kemarin
    expect(energyReport([d('2026-11-09', 2), ...low], '2026-11-09').lowRun).toBe(4)
    expect(energyReport([d('2026-11-09', 4), ...low], '2026-11-09').lowRun).toBe(0)
    expect(energyReport([d('2026-11-08', 2), d('2026-11-07', 4), d('2026-11-06', 1)], '2026-11-09').lowRun).toBe(1)
  })

  it('pola antar tipe hari: butuh ≥ 3 catatan per tipe dan selisih ≥ 1', () => {
    const days = [
      d('2026-11-01', 4, 'stase'),
      d('2026-11-02', 4, 'stase'),
      d('2026-11-03', 5, 'stase'),
      d('2026-11-04', 2, 'pasca'),
      d('2026-11-05', 2, 'pasca'),
      d('2026-11-06', 3, 'pasca'),
    ]
    const r = energyReport(days, '2026-11-09')
    expect(r.pattern?.low.label).toBe('pasca-jaga')
    expect(r.pattern?.high.label).toBe('stase')
    expect(energyReport(days.slice(0, 5), '2026-11-09').pattern).toBeNull() // pasca baru 2 catatan
    expect(
      energyReport(
        days.map((x) => ({ ...x, energy: 3 as const })),
        '2026-11-09',
      ).pattern,
    ).toBeNull()
  })
})
