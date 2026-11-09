import { debtPlan } from './money'
import { addMonths, monthOf } from './time'
import type { Debt, ISODate, MonthKey, Saving, Transaction } from '../types'

export interface MonthFlow {
  month: MonthKey
  income: number
  expense: number
}

/** Pemasukan & pengeluaran per bulan, `count` bulan terakhir sampai `month` (urut lama → baru). */
export function monthlyFlow(txs: Pick<Transaction, 'date' | 'type' | 'amount'>[], month: MonthKey, count = 6): MonthFlow[] {
  const months = Array.from({ length: count }, (_, i) => addMonths(month, i - count + 1))
  const rows = new Map(months.map((m) => [m, { month: m, income: 0, expense: 0 }]))
  for (const t of txs) {
    const row = rows.get(monthOf(t.date))
    if (!row) continue
    if (t.type === 'income') row.income += t.amount
    else row.expense += t.amount
  }
  return months.map((m) => rows.get(m)!)
}

export interface Point {
  x: ISODate
  y: number
}

/** Total terkumpul (kumulatif) dari setoran semua tabungan, satu titik per tanggal setoran. */
export function savingSeries(savings: Pick<Saving, 'deposits'>[]): Point[] {
  const byDate = new Map<ISODate, number>()
  for (const s of savings) for (const d of s.deposits) byDate.set(d.date, (byDate.get(d.date) ?? 0) + d.amount)
  let total = 0
  return [...byDate.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([x, amount]) => ({ x, y: (total += amount) }))
}

export interface ScheduleMonth {
  month: MonthKey
  /** Perkiraan cicilan bulan itu (jumlah semua utang yang belum lunas). */
  payment: number
  /** Sisa utang setelah cicilan bulan itu. */
  remaining: number
}

/**
 * Proyeksi cicilan per bulan dari sisa utang dibagi rata sampai tanggal target (sama dengan saran per bulan di kartu Utang).
 * Utang tanpa tanggal target tidak diproyeksikan dan dilaporkan di `unscheduled`.
 */
export function debtSchedule(
  debts: Pick<Debt, 'initial' | 'targetDate' | 'payments'>[],
  today: ISODate,
): { months: ScheduleMonth[]; unscheduled: number; payoff: MonthKey | null } {
  const start = monthOf(today)
  const live = debts
    .map((d) => ({ plan: debtPlan(d, today), end: d.targetDate ? monthOf(d.targetDate) : null }))
    .filter((x) => x.plan.left > 0)
  const unscheduled = live.filter((x) => !x.end).reduce((a, x) => a + x.plan.left, 0)
  const sched = live.filter((x) => x.end).map((x) => ({ left: x.plan.left, per: x.plan.perMonth ?? x.plan.left, end: x.end! }))
  const months: ScheduleMonth[] = []
  for (let m = start; sched.some((x) => x.left > 0) && months.length < 120; m = addMonths(m, 1)) {
    let payment = 0
    for (const x of sched) {
      if (x.left <= 0) continue
      // Bulan target: lunasi sisanya.
      const pay = m >= x.end ? x.left : Math.min(x.left, x.per)
      x.left -= pay
      payment += pay
    }
    months.push({ month: m, payment, remaining: sched.reduce((a, x) => a + x.left, 0) + unscheduled })
  }
  return { months, unscheduled, payoff: months.length && !unscheduled ? months[months.length - 1].month : null }
}
