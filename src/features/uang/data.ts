import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '../../db/db'
import { loadCategories } from '../../db/money'
import {
  budgetTotal,
  budgetUsage,
  categoryLookup,
  debtPlan,
  expenseByCategory,
  nextOccurrence,
  savingPlan,
  summarize,
} from '../../domain/money'
import { addMonths } from '../../domain/time'
import type { ISODate, MonthKey } from '../../types'

export async function loadUang(month: MonthKey, today: ISODate) {
  const [categories, txs, budgets, prevBudgets, recurring, savings, debts] = await Promise.all([
    loadCategories(),
    db.transactions.where('date').between(`${month}-01`, `${month}-31`, true, true).toArray(),
    db.budgets.where('month').equals(month).toArray(),
    db.budgets.where('month').equals(addMonths(month, -1)).count(),
    db.recurring.toArray(),
    db.savings.toArray(),
    db.debts.toArray(),
  ])
  const cat = categoryLookup(categories)
  const usage = budgetUsage(budgets, txs, cat)
  const sorted = [...txs].sort((a, b) => b.date.localeCompare(a.date) || b.createdAt - a.createdAt)
  return {
    month,
    today,
    categories,
    cat,
    txs: sorted,
    summary: summarize(txs),
    byCategory: expenseByCategory(txs, cat),
    budgets,
    usage,
    budgetTotal: budgetTotal(usage),
    prevBudgets,
    recurring: recurring
      .map((rule) => ({ rule, next: nextOccurrence(rule, today) }))
      .sort((a, b) => Number(b.rule.active) - Number(a.rule.active) || (a.next ?? '9').localeCompare(b.next ?? '9')),
    savings: savings
      .map((s) => ({ s, plan: savingPlan(s, today) }))
      .sort((a, b) => Number(b.s.kind === 'jembatan') - Number(a.s.kind === 'jembatan') || a.s.createdAt - b.s.createdAt),
    debts: debts.map((d) => ({ d, plan: debtPlan(d, today) })).sort((a, b) => b.plan.left - a.plan.left),
  }
}

export type UangData = Awaited<ReturnType<typeof loadUang>>

export const useUang = (month: MonthKey, today: ISODate) => useLiveQuery(() => loadUang(month, today), [month, today])
