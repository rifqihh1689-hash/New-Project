import { dueOccurrences, FALLBACK_CATEGORY_ID, mergeCategories, recurringTransaction } from '../domain/money'
import { isValidISODate, monthOf } from '../domain/time'
import { createId, privateId } from '../lib/id'
import type { Category, Debt, ISODate, MonthKey, RecurringRule, Saving, Transaction, TransactionType } from '../types'
import { assertNoPatientIdentity } from './daily'
import { db } from './db'

export class MoneyError extends Error {}

export async function loadCategories(): Promise<Category[]> {
  return mergeCategories(await db.categories.toArray())
}

export async function saveCategory(c: Category): Promise<void> {
  const name = c.name.trim()
  if (!name) throw new MoneyError('Nama kategori kosong.')
  assertNoPatientIdentity(name)
  await db.categories.put({ ...c, name, updatedAt: Date.now() })
}

export function newCategory(kind: Category['kind']): Category {
  const now = Date.now()
  return { id: createId('cat'), name: '', icon: 'tag', color: '#64748b', kind, builtIn: false, createdAt: now, updatedAt: now }
}

/** Hapus kategori buatan sendiri; transaksi, anggaran, dan aturan berulangnya pindah ke "Lainnya". */
export async function deleteCategory(id: string): Promise<void> {
  const c = await db.categories.get(id)
  if (!c || c.builtIn || id.startsWith('#cat:')) throw new MoneyError('Kategori bawaan tidak bisa dihapus, hanya diganti nama/warna.')
  await db.transaction('rw', [db.categories, db.transactions, db.recurring, db.budgets], async () => {
    await db.transactions.where('categoryId').equals(id).modify({ categoryId: FALLBACK_CATEGORY_ID })
    await db.recurring.filter((r) => r.categoryId === id).modify({ categoryId: FALLBACK_CATEGORY_ID })
    await db.budgets.where('categoryId').equals(id).delete()
    await db.categories.delete(id)
  })
}

// ---------- Transaksi ----------

export interface TransactionInput {
  id?: string
  amount: number
  type: TransactionType
  categoryId: string
  date: ISODate
  note: string
}

export async function saveTransaction(input: TransactionInput): Promise<Transaction> {
  if (!Number.isSafeInteger(input.amount) || input.amount <= 0) throw new MoneyError('Nominal harus lebih dari 0.')
  if (!isValidISODate(input.date)) throw new MoneyError('Tanggal tidak valid.')
  const note = input.note.trim()
  assertNoPatientIdentity(note)
  const prev = input.id ? await db.transactions.get(input.id) : undefined
  if (prev?.tentirSessionId) throw new MoneyError('Transaksi ini dari sesi tentir; ubah lewat halaman Tentir.')
  const now = Date.now()
  const tx: Transaction = {
    ...prev,
    id: input.id ?? createId('trx'),
    amount: input.amount,
    type: input.type,
    categoryId: input.categoryId,
    date: input.date,
    note,
    createdAt: prev?.createdAt ?? now,
    updatedAt: now,
  }
  await db.transactions.put(tx)
  return tx
}

export async function deleteTransaction(id: string): Promise<Transaction | undefined> {
  const tx = await db.transactions.get(id)
  if (tx?.tentirSessionId) throw new MoneyError('Transaksi ini dari sesi tentir; hapus atau ubah status lunasnya di halaman Tentir.')
  await db.transactions.delete(id)
  return tx
}

export const restoreTransaction = (tx: Transaction) => db.transactions.put(tx)

// ---------- Anggaran ----------

/** Satu anggaran per kategori per bulan (ID privat → tidak dobel antar perangkat). 0 = hapus. */
export async function setBudget(month: MonthKey, categoryId: string, amount: number): Promise<void> {
  const id = privateId.budget(month, categoryId)
  if (!(amount > 0)) await db.budgets.delete(id)
  else await db.budgets.put({ id, month, categoryId, amount: Math.round(amount) })
}

/** Salin anggaran bulan lalu ke bulan ini; kategori yang sudah diatur tidak ditimpa. Mengembalikan jumlah yang disalin. */
export async function copyBudgets(from: MonthKey, to: MonthKey): Promise<number> {
  const [src, dst] = await Promise.all([db.budgets.where('month').equals(from).toArray(), db.budgets.where('month').equals(to).toArray()])
  const have = new Set(dst.map((b) => b.categoryId))
  const add = src.filter((b) => !have.has(b.categoryId))
  await db.budgets.bulkPut(
    add.map((b) => ({ id: privateId.budget(to, b.categoryId), month: to, categoryId: b.categoryId, amount: b.amount })),
  )
  return add.length
}

// ---------- Berulang ----------

export function newRecurring(today: ISODate): RecurringRule {
  const now = Date.now()
  return {
    id: createId('rec'),
    amount: 0,
    type: 'expense',
    categoryId: '#cat:tagihan',
    note: '',
    dayOfMonth: Number(today.slice(8)),
    startMonth: monthOf(today),
    active: true,
    createdAt: now,
    updatedAt: now,
  }
}

export async function saveRecurring(rule: RecurringRule): Promise<void> {
  if (!Number.isSafeInteger(rule.amount) || rule.amount <= 0) throw new MoneyError('Nominal harus lebih dari 0.')
  if (rule.dayOfMonth < 1 || rule.dayOfMonth > 31) throw new MoneyError('Tanggal harus 1–31.')
  assertNoPatientIdentity(rule.note)
  await db.recurring.put({ ...rule, note: rule.note.trim(), updatedAt: Date.now() })
}

/** Menghapus aturan; transaksi yang sudah dibuat tetap ada. */
export const deleteRecurring = (id: string) => db.recurring.delete(id)

/**
 * Membuat transaksi berulang yang sudah jatuh tempo (dijalankan saat app dibuka & ganti hari).
 * ID deterministik, jadi aman walau dua perangkat menjalankannya bersamaan.
 */
export async function runRecurring(today: ISODate): Promise<number> {
  const rules = await db.recurring.toArray()
  let made = 0
  const now = Date.now()
  for (const rule of rules) {
    const due = dueOccurrences(rule, today)
    if (!due.length) continue
    await db.transaction('rw', db.transactions, db.recurring, async () => {
      await db.transactions.bulkPut(due.map((o) => recurringTransaction(rule, o, now)))
      await db.recurring.update(rule.id, { lastGeneratedMonth: due[due.length - 1].month, updatedAt: now })
    })
    made += due.length
  }
  return made
}

// ---------- Tabungan & utang ----------

export function newSaving(kind: Saving['kind'] = 'wishlist'): Saving {
  const now = Date.now()
  return {
    id: createId('sav'),
    name: kind === 'jembatan' ? 'Dana jembatan' : '',
    kind,
    target: 0,
    targetDate: null,
    deposits: [],
    createdAt: now,
    updatedAt: now,
  }
}

export async function saveSaving(s: Saving): Promise<void> {
  if (!s.name.trim()) throw new MoneyError('Nama tabungan kosong.')
  if (!(s.target > 0)) throw new MoneyError('Target harus lebih dari 0.')
  assertNoPatientIdentity(s.name)
  await db.savings.put({ ...s, name: s.name.trim(), updatedAt: Date.now() })
}

/** Setoran (positif) atau penarikan (negatif). */
export async function addDeposit(id: string, amount: number, date: ISODate): Promise<void> {
  const s = await db.savings.get(id)
  if (!s) throw new MoneyError('Tabungan tidak ditemukan.')
  if (!Number.isSafeInteger(amount) || amount === 0) throw new MoneyError('Nominal tidak valid.')
  await db.savings.update(id, { deposits: [...s.deposits, { date, amount }], updatedAt: Date.now() })
}

export function newDebt(): Debt {
  const now = Date.now()
  return { id: createId('dbt'), name: '', initial: 0, targetDate: null, payments: [], createdAt: now, updatedAt: now }
}

export async function saveDebt(d: Debt): Promise<void> {
  if (!d.name.trim()) throw new MoneyError('Nama utang kosong.')
  if (!(d.initial > 0)) throw new MoneyError('Jumlah utang harus lebih dari 0.')
  assertNoPatientIdentity(d.name)
  await db.debts.put({ ...d, name: d.name.trim(), updatedAt: Date.now() })
}

export async function addPayment(id: string, amount: number, date: ISODate): Promise<void> {
  const d = await db.debts.get(id)
  if (!d) throw new MoneyError('Utang tidak ditemukan.')
  if (!Number.isSafeInteger(amount) || amount <= 0) throw new MoneyError('Nominal tidak valid.')
  await db.debts.update(id, { payments: [...d.payments, { date, amount }], updatedAt: Date.now() })
}

export async function deleteGoal(table: 'savings' | 'debts', id: string): Promise<Saving | Debt | undefined> {
  const t = table === 'savings' ? db.savings : db.debts
  const row = await t.get(id)
  await t.delete(id)
  return row
}

export async function restoreGoal(table: 'savings' | 'debts', row: Saving | Debt): Promise<void> {
  if (table === 'savings') await db.savings.put(row as Saving)
  else await db.debts.put(row as Debt)
}
