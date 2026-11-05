import { describe, expect, it } from 'vitest'
import type { Budget, RecurringRule, Transaction } from '../types'
import {
  budgetLevel,
  budgetTotal,
  budgetUsage,
  categoryLookup,
  DEFAULT_CATEGORIES,
  debtPlan,
  dueOccurrences,
  expenseByCategory,
  mergeCategories,
  nextOccurrence,
  parseAmount,
  parseQuickMoney,
  recurringTransaction,
  savingPlan,
  summarize,
} from './money'

const tx = (amount: number, type: Transaction['type'], categoryId: string, date = '2026-11-05'): Transaction => ({
  id: `t${amount}${date}`,
  amount,
  type,
  categoryId,
  date,
  note: '',
  createdAt: 0,
  updatedAt: 0,
})

const rule = (over: Partial<RecurringRule> = {}): RecurringRule => ({
  id: 'rec_kos',
  amount: 900_000,
  type: 'expense',
  categoryId: '#cat:tagihan',
  note: 'Kos',
  dayOfMonth: 31,
  startMonth: '2026-09',
  active: true,
  createdAt: 0,
  updatedAt: 0,
  ...over,
})

describe('kategori', () => {
  it('bawaan + perubahan + buatan sendiri', () => {
    const cats = mergeCategories([
      { ...DEFAULT_CATEGORIES[0], name: 'Makan & minum' },
      { id: 'cat_x', name: 'Kado', icon: 'gift', color: '#000', kind: 'expense', builtIn: false, createdAt: 5, updatedAt: 5 },
    ])
    expect(cats).toHaveLength(DEFAULT_CATEGORIES.length + 1)
    expect(categoryLookup(cats)('#cat:makan').name).toBe('Makan & minum')
    expect(categoryLookup(cats)('hilang').name).toBe('Tanpa kategori')
  })
})

describe('ringkasan & anggaran', () => {
  const txs = [
    tx(300_000, 'expense', '#cat:makan'),
    tx(50_000, 'expense', '#cat:makan', '2026-11-06'),
    tx(500_000, 'income', '#cat:tentir'),
  ]
  it('pemasukan, pengeluaran, porsi kategori', () => {
    expect(summarize(txs)).toEqual({ income: 500_000, expense: 350_000, balance: 150_000, count: 3 })
    const slices = expenseByCategory(txs, categoryLookup(DEFAULT_CATEGORIES))
    expect(slices[0]).toMatchObject({ total: 350_000, ratio: 1 })
  })
  it('status anggaran aman/hampir/lewat', () => {
    expect([budgetLevel(100, 1000), budgetLevel(850, 1000), budgetLevel(1001, 1000), budgetLevel(5, 0)]).toEqual([
      'aman',
      'hampir',
      'lewat',
      'lewat',
    ])
    const budgets: Budget[] = [
      { id: '#bud:2026-11:#cat:makan', month: '2026-11', categoryId: '#cat:makan', amount: 400_000 },
      { id: '#bud:2026-11:#cat:transport', month: '2026-11', categoryId: '#cat:transport', amount: 100_000 },
    ]
    const usage = budgetUsage(budgets, [...txs, tx(99_000, 'expense', '#cat:makan', '2026-10-30')], categoryLookup(DEFAULT_CATEGORIES))
    expect(usage[0]).toMatchObject({ spent: 350_000, remaining: 50_000, level: 'hampir' })
    expect(budgetTotal(usage)).toMatchObject({ limit: 500_000, spent: 350_000, level: 'aman' })
  })
})

describe('transaksi berulang', () => {
  it('mengejar bulan terlewat; tanggal 31 menyesuaikan akhir bulan', () => {
    const due = dueOccurrences(rule(), '2026-11-05')
    expect(due.map((d) => d.date)).toEqual(['2026-09-30', '2026-10-31'])
    expect(nextOccurrence(rule({ lastGeneratedMonth: '2026-10' }), '2026-11-05')).toBe('2026-11-30')
    expect(dueOccurrences(rule({ lastGeneratedMonth: '2026-10' }), '2026-11-05')).toEqual([])
    expect(dueOccurrences(rule({ active: false }), '2026-11-05')).toEqual([])
    expect(dueOccurrences(rule({ endMonth: '2026-09' }), '2026-11-05')).toHaveLength(1)
  })
  it('ID transaksi deterministik supaya tidak pernah dobel', () => {
    const t = recurringTransaction(rule(), { month: '2026-10', date: '2026-10-31' }, 1)
    expect(t).toMatchObject({ id: '#rtx:rec_kos:2026-10', amount: 900_000, recurringId: 'rec_kos', date: '2026-10-31' })
  })
})

describe('tabungan & utang', () => {
  it('setoran per bulan agar tepat waktu', () => {
    const p = savingPlan(
      { target: 15_000_000, targetDate: '2027-11-05', deposits: [{ date: '2026-11-01', amount: 3_000_000 }] },
      '2026-11-05',
    )
    expect(p).toMatchObject({ done: 3_000_000, left: 12_000_000, monthsLeft: 12, perMonth: 1_000_000, pct: 0.2 })
    const d = debtPlan({ initial: 2_000_000, targetDate: null, payments: [{ date: '2026-11-01', amount: 2_500_000 }] }, '2026-11-05')
    expect(d).toMatchObject({ left: 0, pct: 1, perMonth: null })
  })
})

describe('catat cepat uang', () => {
  it('membaca nominal ala Indonesia', () => {
    expect(['25rb', '25 ribu', '25k', '1,5jt', '1.5 juta', 'Rp15.000', '15000', '25', '2.500.000'].map(parseAmount)).toEqual([
      25_000, 25_000, 25_000, 1_500_000, 1_500_000, 15_000, 15_000, 25_000, 2_500_000,
    ])
    expect(parseAmount('makan siang')).toBeNull()
  })

  it('jenis, kategori, tanggal, catatan', () => {
    const cats = DEFAULT_CATEGORIES
    expect(parseQuickMoney('25rb makan siang', '2026-11-05', cats)).toEqual({
      amount: 25_000,
      type: 'expense',
      categoryId: '#cat:makan',
      note: 'Makan siang',
      date: '2026-11-05',
    })
    expect(parseQuickMoney('+500rb kiriman ortu', '2026-11-05', cats)).toMatchObject({
      type: 'income',
      categoryId: '#cat:kiriman',
      amount: 500_000,
    })
    expect(parseQuickMoney('kemarin 15k parkir', '2026-11-05', cats)).toMatchObject({ date: '2026-11-04', categoryId: '#cat:transport' })
    expect(parseQuickMoney('senin 1,2jt kos #tagihan', '2026-11-05', cats)).toMatchObject({
      date: '2026-11-02',
      categoryId: '#cat:tagihan',
    })
    expect(parseQuickMoney('40rb hadiah teman', '2026-11-05', cats)).toMatchObject({ categoryId: '#cat:lainnya' })
  })
})
