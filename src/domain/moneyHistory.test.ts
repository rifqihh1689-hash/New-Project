import { describe, expect, it } from 'vitest'
import { debtSchedule, monthlyFlow, savingSeries } from './moneyHistory'

describe('riwayat & proyeksi uang', () => {
  it('arus per bulan: 6 bulan terakhir, bulan kosong tetap ada', () => {
    const r = monthlyFlow(
      [
        { date: '2026-11-03', type: 'income', amount: 500_000 },
        { date: '2026-11-05', type: 'expense', amount: 200_000 },
        { date: '2026-09-10', type: 'expense', amount: 100_000 },
        { date: '2026-01-10', type: 'expense', amount: 999 }, // di luar rentang
      ],
      '2026-11',
    )
    expect(r.map((x) => x.month)).toEqual(['2026-06', '2026-07', '2026-08', '2026-09', '2026-10', '2026-11'])
    expect(r[5]).toEqual({ month: '2026-11', income: 500_000, expense: 200_000 })
    expect(r[3].expense).toBe(100_000)
  })

  it('tabungan kumulatif per tanggal setoran', () => {
    expect(
      savingSeries([
        {
          deposits: [
            { date: '2026-10-01', amount: 100 },
            { date: '2026-11-01', amount: 50 },
          ],
        },
        { deposits: [{ date: '2026-10-01', amount: 20 }] },
      ]),
    ).toEqual([
      { x: '2026-10-01', y: 120 },
      { x: '2026-11-01', y: 170 },
    ])
  })

  it('jadwal cicilan: turun saat satu utang lunas, habis di bulan target terakhir', () => {
    const s = debtSchedule(
      [
        { initial: 300_000, targetDate: '2027-01-25', payments: [] }, // 3 bulan × 100 rb
        { initial: 600_000, targetDate: '2027-04-25', payments: [{ date: '2026-10-25', amount: 0 }] }, // 6 bulan × 100 rb
        { initial: 100, targetDate: null, payments: [{ date: '2026-10-01', amount: 100 }] }, // sudah lunas
      ],
      '2026-11-09',
    )
    expect(s.months.map((m) => m.payment)).toEqual([200_000, 200_000, 200_000, 100_000, 100_000, 100_000])
    expect(s.months.at(-1)).toEqual({ month: '2027-04', payment: 100_000, remaining: 0 })
    expect(s.payoff).toBe('2027-04')
    expect(debtSchedule([{ initial: 500, targetDate: null, payments: [] }], '2026-11-09')).toEqual({
      months: [],
      unscheduled: 500,
      payoff: null,
    })
  })
})
