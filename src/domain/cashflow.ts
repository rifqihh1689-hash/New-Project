import { debtSchedule, monthlyFlow } from './moneyHistory'
import { addMonths, daysInMonth, monthOf } from './time'
import type { Debt, ISODate, MonthKey, Saving, Transaction } from '../types'

export interface MonthPlan {
  month: MonthKey
  /** Perkiraan pemasukan & pengeluaran biasa (rata-rata bulan-bulan terakhir). */
  income: number
  expense: number
  /** Tagihan tetap (cicilan) bulan itu dari jadwal. */
  fixed: number
  /** income − expense − fixed. */
  net: number
}

export interface ThisMonth {
  month: MonthKey
  /** Pemasukan & pengeluaran sampai hari ini (nyata). */
  incomeSoFar: number
  expenseSoFar: number
  /** Perkiraan akhir bulan. */
  incomeEnd: number
  expenseEnd: number
  /** Tagihan tetap bulan ini: seluruhnya, yang sudah dibayar, dan yang masih menunggu. */
  fixed: number
  fixedPaid: number
  fixedLeft: number
  /** Perkiraan sisa akhir bulan = incomeEnd − expenseEnd − fixed. */
  net: number
}

export interface Snowball {
  /** Bulan ketika tagihan tetap turun dibanding bulan ini, dan berapa banyak (Rupiah per bulan). */
  drops: { month: MonthKey; freed: number }[]
  /** Dana yang terkumpul bila setiap penurunan dialihkan ke tabungan sampai `until`. */
  projected: number
  /** Total yang sudah ada di tabungan acuan sekarang. */
  current: number
  until: MonthKey
}

export interface CashPlan {
  thisMonth: ThisMonth
  months: MonthPlan[]
  snowball: Snowball | null
}

type Tx = Pick<Transaction, 'date' | 'type' | 'amount'>

/**
 * Rencana uang: sisa bulan ini, 6 bulan ke depan, dan "bola salju" (cicilan yang selesai dialihkan jadi setoran).
 * Pemasukan/pengeluaran bulan depan = rata-rata bulan-bulan penuh yang punya catatan (maks. 3 terakhir); tagihan tetap dari jadwal.
 */
export function cashPlan(input: {
  txs: Tx[]
  today: ISODate
  debts: Pick<Debt, 'initial' | 'targetDate' | 'payments'>[]
  /** Pengeluaran yang dianggarkan bulan ini (0 = tanpa anggaran). */
  budget: number
  /** Pemasukan yang diketahui akan datang bulan ini (mis. sesi tentir belum lunas). */
  incomeExpected: number
  /** Tabungan acuan untuk bola salju (biasanya dana jembatan). */
  saving: Pick<Saving, 'deposits'> | null
  /** Batas proyeksi bola salju (mis. bulan UKMPPD); bawaan 18 bulan. */
  until?: ISODate | null
  horizon?: number
}): CashPlan {
  const month = monthOf(input.today)
  const day = Number(input.today.slice(8))
  const total = daysInMonth(month)
  const flow = monthlyFlow(input.txs, month, 4)
  const current = flow[3]
  const past = flow.slice(0, 3).filter((m) => m.income || m.expense)
  const avg = (k: 'income' | 'expense') => (past.length ? Math.round(past.reduce((a, m) => a + m[k], 0) / past.length) : 0)

  const sched = debtSchedule(input.debts, input.today)
  const paymentOf = (m: MonthKey) => sched.months.find((x) => x.month === m)?.payment ?? 0
  const paidThisMonth = input.debts
    .flatMap((d) => d.payments)
    .filter((p) => monthOf(p.date) === month)
    .reduce((a, p) => a + p.amount, 0)
  const fixed = paymentOf(month)
  // Yang sudah dibayar bulan ini mengurangi sisa bulan ini; jadwal sudah dihitung dari sisa setelah pembayaran itu.
  const fixedAll = fixed + paidThisMonth
  const fixedLeft = fixed

  const incomeEnd = current.income + input.incomeExpected
  const expenseEnd = Math.round(
    input.budget > 0 ? Math.max(current.expense, input.budget) : current.expense > 0 ? (current.expense / day) * total : avg('expense'),
  )
  const thisMonth: ThisMonth = {
    month,
    incomeSoFar: current.income,
    expenseSoFar: current.expense,
    incomeEnd,
    expenseEnd,
    fixed: fixedAll,
    fixedPaid: paidThisMonth,
    fixedLeft,
    net: incomeEnd - expenseEnd - fixedAll,
  }

  const months: MonthPlan[] = Array.from({ length: 6 }, (_, i) => {
    const m = addMonths(month, i + 1)
    const income = avg('income')
    const expense = input.budget > 0 && !past.length ? input.budget : avg('expense')
    const f = paymentOf(m)
    return { month: m, income, expense, fixed: f, net: income - expense - f }
  })

  let snowball: Snowball | null = null
  if (sched.months.length && fixedAll > 0) {
    const until = input.until ? monthOf(input.until) : addMonths(month, input.horizon ?? 18)
    const drops: Snowball['drops'] = []
    let projected = 0
    let prev = fixedAll
    for (let m = addMonths(month, 1); m <= until; m = addMonths(m, 1)) {
      const p = paymentOf(m)
      if (p < prev) drops.push({ month: m, freed: prev - p })
      // Dana bulan itu = seluruh selisih terhadap tagihan sekarang (penurunan sebelumnya tetap dialihkan tiap bulan).
      projected += Math.max(0, fixedAll - p)
      prev = p
    }
    snowball = {
      drops,
      projected,
      current: input.saving ? input.saving.deposits.reduce((a, d) => a + d.amount, 0) : 0,
      until,
    }
  }
  return { thisMonth, months, snowball }
}
