import { describe, expect, it } from 'vitest'
import { cashPlan } from './cashflow'

const tx = (date: string, type: 'income' | 'expense', amount: number) => ({ date, type, amount })

describe('rencana uang', () => {
  const txs = [
    tx('2026-08-05', 'income', 3_000_000),
    tx('2026-08-09', 'expense', 2_000_000),
    tx('2026-09-05', 'income', 3_000_000),
    tx('2026-09-09', 'expense', 2_000_000),
    tx('2026-10-05', 'income', 3_000_000),
    tx('2026-10-09', 'expense', 2_000_000),
    tx('2026-11-02', 'income', 1_000_000),
    tx('2026-11-05', 'expense', 600_000),
  ]
  // Dua utang: 300 rb sampai Jan 2027 (100 rb/bln × 3) dan 600 rb sampai Apr 2027 (100 rb/bln × 6).
  const debts = [
    { initial: 300_000, targetDate: '2027-01-25', payments: [] },
    { initial: 600_000, targetDate: '2027-04-25', payments: [] },
  ]
  const base = { txs, today: '2026-11-10', debts, budget: 0, incomeExpected: 0, saving: null }

  it('bulan ini: pemasukan nyata + yang akan datang, pengeluaran diproyeksikan per hari, tagihan tetap dikurangkan', () => {
    const p = cashPlan({ ...base, incomeExpected: 500_000 })
    expect(p.thisMonth).toMatchObject({
      incomeSoFar: 1_000_000,
      incomeEnd: 1_500_000,
      expenseSoFar: 600_000,
      fixed: 200_000,
      fixedPaid: 0,
      fixedLeft: 200_000,
    })
    expect(p.thisMonth.expenseEnd).toBe(1_800_000) // 600 rb / 10 hari × 30
    expect(p.thisMonth.net).toBe(1_500_000 - 1_800_000 - 200_000)
  })

  it('dengan anggaran: pengeluaran akhir bulan = yang lebih besar antara anggaran dan realisasi', () => {
    expect(cashPlan({ ...base, budget: 2_000_000 }).thisMonth.expenseEnd).toBe(2_000_000)
    expect(cashPlan({ ...base, budget: 500_000 }).thisMonth.expenseEnd).toBe(600_000)
  })

  it('pembayaran bulan ini mengurangi sisa tagihan, tetapi total bulan tetap sama', () => {
    const paid = debts.map((d, i) => (i === 0 ? { ...d, payments: [{ date: '2026-11-03', amount: 100_000 }] } : d))
    const p = cashPlan({ ...base, debts: paid })
    // Sisa 200 rb dibagi 3 bulan = 67 rb (dibulatkan ke atas) + 100 rb utang lain; yang sudah dibayar 100 rb.
    expect(p.thisMonth).toMatchObject({ fixedPaid: 100_000, fixedLeft: 167_000, fixed: 267_000 })
  })

  it('6 bulan ke depan: rata-rata 3 bulan penuh, tagihan turun saat utang lunas', () => {
    const { months } = cashPlan(base)
    expect(months).toHaveLength(6)
    expect(months[0]).toMatchObject({ month: '2026-12', income: 3_000_000, expense: 2_000_000, fixed: 200_000, net: 800_000 })
    expect(months.map((m) => m.fixed)).toEqual([200_000, 200_000, 100_000, 100_000, 100_000, 0])
  })

  it('bola salju: penurunan tagihan dialihkan ke tabungan sampai batas bulan', () => {
    const p = cashPlan({ ...base, saving: { deposits: [{ date: '2026-10-01', amount: 1_000_000 }] }, until: '2027-06-30' })
    expect(p.snowball?.drops).toEqual([
      { month: '2027-02', freed: 100_000 },
      { month: '2027-05', freed: 100_000 },
    ])
    // Des–Jan 0; Feb–Apr 100 rb × 3; Mei–Jun 200 rb × 2 → 700 rb. (Nov = bulan ini, tagihan acuan 200 rb.)
    expect(p.snowball).toMatchObject({ projected: 700_000, current: 1_000_000, until: '2027-06' })
  })

  it('tanpa utang: tidak ada bola salju dan tagihan 0', () => {
    const p = cashPlan({ ...base, debts: [] })
    expect(p.snowball).toBeNull()
    expect(p.thisMonth.fixed).toBe(0)
  })
})
