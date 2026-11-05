import { describe, expect, it } from 'vitest'
import type { Day, DayResult } from '../types'
import { monthSummaryText, monthWeekRows, sleepVsJaga } from './monthly'
import { DEFAULT_RULES } from './rules'

const day = (date: string, type: Day['type'], sleepNight: number | null): Day => ({
  id: `#day:${date}`,
  date,
  type,
  sleepNight,
  nap: 0,
  workEnd: 'ok',
  note: '',
  updatedAt: 0,
})
const res = (xp: number, pass: boolean) => ({ xp, pass }) as DayResult

describe('muhasabah bulanan', () => {
  const days = [
    day('2026-11-02', 'jaga', 4),
    day('2026-11-04', 'jaga', 5),
    day('2026-11-06', 'stase', 5),
    day('2026-11-10', 'stase', 7),
    day('2026-11-30', 'stase', 6),
  ]
  const input = {
    today: '2026-11-30',
    results: new Map([
      ['2026-11-02', res(40, true)],
      ['2026-11-10', res(80, true)],
      ['2026-11-30', res(30, false)],
    ]),
    days,
    tasks: [],
    habits: [],
    habitLogs: [],
    tentir: [],
    transactions: [],
    rules: DEFAULT_RULES,
  }

  it('minggu yang menyentuh bulan (Senin), terpotong ke bulan itu', () => {
    const rows = monthWeekRows('2026-11', input)
    expect(rows.map((r) => r.monday)).toEqual(['2026-10-26', '2026-11-02', '2026-11-09', '2026-11-16', '2026-11-23', '2026-11-30'])
    expect(rows[1].n).toMatchObject({ jaga: 2, xp: 40, avgSleep: 4.67 })
    expect(rows[5].n).toMatchObject({ xp: 30, passDays: 0, recordedDays: 1 })
  })

  it('tidur di minggu berat jaga vs minggu lain', () => {
    expect(sleepVsJaga(monthWeekRows('2026-11', input))).toEqual({ heavy: 4.7, light: 6.5 })
  })

  it('teks ringkasan untuk Claude', () => {
    const rows = monthWeekRows('2026-11', input)
    const text = monthSummaryText('2026-11', rows[1].n, null, rows, {
      tasksByRole: [{ name: 'UKMPPD', done: 3, total: 5 }],
      mutabaah: [{ name: 'Tilawah', days: 20, of: 30 }],
      tentir: { hours: 12.5, income: 1_062_500, perHour: 85_000 },
      money: { income: 3_000_000, expense: 2_100_000, budget: 2_500_000, bridge: { saved: 4_500_000, target: 15_000_000 }, debtLeft: 0 },
      training: { strength: 8, runKm: 32.5, benchStart: 70, benchEnd: 74 },
    })
    expect(text).toMatch(/November 2026/)
    expect(text).toMatch(/Minggu dengan ≥ 2 jaga: tidur 4\.7 j vs minggu lain 6\.5 j/)
    expect(text).toMatch(/UKMPPD 3\/5/)
    expect(text).toMatch(/bench e1RM 70 → 74 kg/)
    expect(text).not.toMatch(/\n\n\n/)
  })
})
