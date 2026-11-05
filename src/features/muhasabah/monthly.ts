import { useLiveQuery } from 'dexie-react-hooks'
import { loadAllResults } from '../../db/daily'
import { db } from '../../db/db'
import { emptyMonthReview } from '../../db/review'
import { loadHabits, loadMutabaah, loadProfile, loadRoles, rulesOf } from '../../db/structure'
import { monthDates } from '../../domain/calendar'
import { summarize as summarizeMoney } from '../../domain/money'
import { monthSummaryText, monthWeekRows, sleepVsJaga, type MonthExtras } from '../../domain/monthly'
import { bridgeStatus } from '../../domain/rewards'
import { summarize as summarizeTentir } from '../../domain/tentir'
import { addMonths } from '../../domain/time'
import { exerciseHistory, runsOf } from '../../domain/training'
import { computeWeekNumbers } from '../../domain/weekly'
import { privateId } from '../../lib/id'
import type { ISODate, MonthKey } from '../../types'

export async function loadMonthly(month: MonthKey, today: ISODate) {
  const dates = monthDates(month)
  const prevDates = monthDates(addMonths(month, -1))
  const from = prevDates[0]
  const to = dates[dates.length - 1]
  const range = [from, to, true, true] as const
  const [
    all,
    days,
    tasks,
    habits,
    habitLogs,
    tentir,
    transactions,
    budgets,
    mutItems,
    mutLogs,
    workouts,
    savings,
    debts,
    roles,
    profile,
    review,
  ] = await Promise.all([
    loadAllResults(today),
    db.days
      .where('date')
      .between(...range)
      .toArray(),
    db.tasks
      .where('date')
      .between(...range)
      .toArray(),
    loadHabits(),
    db.habitLogs
      .where('date')
      .between(...range)
      .toArray(),
    db.tentirSessions
      .where('date')
      .between(...range)
      .toArray(),
    db.transactions
      .where('date')
      .between(...range)
      .toArray(),
    db.budgets.where('month').equals(month).toArray(),
    loadMutabaah(),
    db.mutabaahLogs.where('date').between(dates[0], to, true, true).toArray(),
    db.workouts.where('date').between(dates[0], to, true, true).toArray(),
    db.savings.toArray(),
    db.debts.toArray(),
    loadRoles(),
    loadProfile(),
    db.reviews.get(privateId.monthlyReview(month)),
  ])
  const rules = rulesOf(profile)
  const input = { today, results: all.results, days, tasks, habits, habitLogs, tentir, transactions, rules }
  const numbers = computeWeekNumbers({ ...input, dates })
  const prev = computeWeekNumbers({ ...input, dates: prevDates })
  const weeks = monthWeekRows(month, input)
  const inMonth = <T extends { date: ISODate }>(l: T[]) => l.filter((x) => x.date >= dates[0] && x.date <= to)
  const elapsed = dates.filter((d) => d <= today).length || dates.length

  const tasksByRole = roles
    .map((r) => {
      const list = inMonth(tasks).filter((t) => t.roleId === r.id)
      return { name: r.name, done: list.filter((t) => t.done).length, total: list.length }
    })
    .filter((r) => r.total > 0)
  const mutabaah = mutItems
    .filter((m) => !m.archived)
    .map((m) => ({ name: m.name, days: new Set(mutLogs.filter((l) => l.itemId === m.id && l.done).map((l) => l.date)).size, of: elapsed }))
  const t = summarizeTentir(inMonth(tentir), rules.workEndLimit)
  const money = summarizeMoney(inMonth(transactions))
  const bridge = bridgeStatus(savings)
  const sorted = [...workouts].sort((a, b) => a.date.localeCompare(b.date))
  const bench = exerciseHistory('#ex:bench', sorted)
  const extras: MonthExtras = {
    tasksByRole,
    mutabaah,
    tentir: { hours: t.hours, income: t.fee, perHour: t.perHour },
    money: {
      income: money.income,
      expense: money.expense,
      budget: budgets.reduce((a, b) => a + b.amount, 0),
      bridge: bridge.target == null ? null : { saved: bridge.saved, target: bridge.target },
      debtLeft: debts.reduce((a, d) => a + d.initial - d.payments.reduce((p, x) => p + x.amount, 0), 0),
    },
    training: {
      strength: workouts.filter((w) => w.kind === 'beban').length,
      runKm: Math.round(runsOf(sorted).reduce((a, r) => a + r.run.km, 0) * 10) / 10,
      benchStart: bench.length ? Math.round(bench[0].e1rm * 10) / 10 : null,
      benchEnd: bench.length ? Math.round(bench[bench.length - 1].e1rm * 10) / 10 : null,
    },
  }
  return {
    month,
    numbers,
    prev,
    // Minggu yang belum dimulai tidak ditampilkan (bukan nol).
    weeks: weeks.filter((w) => w.monday <= today),
    sleepJaga: sleepVsJaga(weeks),
    elapsed: dates.filter((d) => d <= today).length,
    totalDays: dates.length,
    /** Bulan sudah lewat: XP boleh dibandingkan apa adanya dengan bulan lalu. */
    complete: today > to,
    extras,
    text: monthSummaryText(month, numbers, prev, weeks, extras),
    review: review ?? emptyMonthReview(month),
    canComplete: today >= `${month}-25`,
  }
}

export type MonthlyData = Awaited<ReturnType<typeof loadMonthly>>

export const useMonthly = (month: MonthKey, today: ISODate) => useLiveQuery(() => loadMonthly(month, today), [month, today])
