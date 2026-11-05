/**
 * Backup Dompetku (`{"app":"dompetku","data":{...}}`) → data modul Uang Qawwam.
 * Kategori bawaan dipetakan ke padanannya; ID transaksi dipertahankan supaya impor aman diulang.
 */
import type { Budget, Category, RecurringRule, Transaction } from '../types'
import { DOMPETKU_CATEGORY_MAP, recurringTxId } from './money'
import { detectPatientIdentity } from './phi'
import { isValidISODate, isValidMonthKey } from './time'

type Obj = Record<string, unknown>
const isObj = (v: unknown): v is Obj => typeof v === 'object' && v !== null && !Array.isArray(v)
const str = (v: unknown) => (typeof v === 'string' ? v : '')
const posInt = (v: unknown) => (typeof v === 'number' && Number.isSafeInteger(v) && v > 0 ? v : null)
const isType = (v: unknown): v is 'income' | 'expense' => v === 'income' || v === 'expense'
const list = (v: unknown) => (Array.isArray(v) ? v.filter(isObj) : [])

export function isDompetkuBackup(v: unknown): v is { app: 'dompetku'; data: Obj } {
  return isObj(v) && v.app === 'dompetku' && isObj(v.data)
}

export function parseDompetku(text: string): Obj | null {
  try {
    const v = JSON.parse(text)
    return isDompetkuBackup(v) ? v.data : null
  } catch {
    return null
  }
}

export interface DompetkuPlan {
  categories: Category[]
  transactions: Transaction[]
  budgets: Budget[]
  recurring: RecurringRule[]
  stats: { skipped: number; notesDropped: number; months: string[] }
}

export function convertDompetku(data: Obj, now = Date.now()): DompetkuPlan {
  const stats = { skipped: 0, notesDropped: 0, months: [] as string[] }
  const mapCat = (id: string) => DOMPETKU_CATEGORY_MAP[id] ?? id
  const cleanNote = (v: unknown) => {
    const note = str(v).trim()
    if (note && detectPatientIdentity(note)) {
      stats.notesDropped++
      return ''
    }
    return note
  }

  const categories: Category[] = list(data.categories)
    .filter((c) => !DOMPETKU_CATEGORY_MAP[str(c.id)] && str(c.id) && str(c.name).trim())
    .map((c) => ({
      id: str(c.id),
      name: str(c.name).trim(),
      icon: str(c.icon) || 'tag',
      color: /^#[0-9a-f]{3,8}$/i.test(str(c.color)) ? str(c.color) : '#64748b',
      kind: c.kind === 'income' || c.kind === 'expense' ? c.kind : 'both',
      builtIn: false,
      createdAt: typeof c.createdAt === 'number' ? c.createdAt : now,
      updatedAt: now,
    }))

  const transactions: Transaction[] = []
  for (const t of list(data.transactions)) {
    const amount = posInt(t.amount)
    if (!str(t.id) || !amount || !isType(t.type) || !isValidISODate(t.date) || !str(t.categoryId)) {
      stats.skipped++
      continue
    }
    const rec = /^rec-(.+)-(\d{4}-\d{2})$/.exec(str(t.id))
    transactions.push({
      id: rec ? recurringTxId(rec[1], rec[2]) : str(t.id),
      amount,
      type: t.type,
      categoryId: mapCat(str(t.categoryId)),
      date: str(t.date),
      note: cleanNote(t.note),
      ...(str(t.recurringId) ? { recurringId: str(t.recurringId) } : {}),
      createdAt: typeof t.createdAt === 'number' ? t.createdAt : now,
      updatedAt: now,
    })
  }

  const budgets: Budget[] = list(data.budgets)
    .filter((b) => isValidMonthKey(b.month) && str(b.categoryId) && posInt(b.amount))
    .map((b) => {
      const categoryId = mapCat(str(b.categoryId))
      return { id: `#bud:${str(b.month)}:${categoryId}`, month: str(b.month), categoryId, amount: posInt(b.amount)! }
    })

  const recurring: RecurringRule[] = list(data.recurring)
    .filter((r) => str(r.id) && posInt(r.amount) && isType(r.type) && isValidMonthKey(r.startMonth))
    .map((r) => ({
      id: str(r.id),
      amount: posInt(r.amount)!,
      type: r.type as 'income' | 'expense',
      categoryId: mapCat(str(r.categoryId)),
      note: cleanNote(r.note),
      dayOfMonth: Math.min(31, Math.max(1, posInt(r.dayOfMonth) ?? 1)),
      startMonth: str(r.startMonth),
      ...(isValidMonthKey(r.endMonth) ? { endMonth: r.endMonth } : {}),
      ...(isValidMonthKey(r.lastGeneratedMonth) ? { lastGeneratedMonth: r.lastGeneratedMonth } : {}),
      active: r.active !== false,
      createdAt: typeof r.createdAt === 'number' ? r.createdAt : now,
      updatedAt: now,
    }))

  stats.months = [...new Set(transactions.map((t) => t.date.slice(0, 7)))].sort()
  return { categories, transactions, budgets, recurring, stats }
}
