/**
 * Logika murni modul Uang (port Dompetku + tabungan, utang, dana jembatan, Catat cepat).
 */
import type { Budget, Category, Debt, ISODate, MonthKey, RecurringRule, Saving, Transaction, TransactionType } from '../types'
import { addDays, addMonths, dateInMonth, monthOf, monthsBetween, weekday } from './time'

// ---------- Kategori ----------

export const FALLBACK_CATEGORY_ID = '#cat:lainnya'
/** Kategori pemasukan tentir; sesi tentir lunas otomatis memakai kategori ini. */
export const TENTIR_CATEGORY_ID = '#cat:tentir'

const cat = (key: string, name: string, icon: string, color: string, kind: Category['kind'], order: number): Category => ({
  id: `#cat:${key}`,
  name,
  icon,
  color,
  kind,
  builtIn: true,
  createdAt: order,
  updatedAt: 0,
})

/** Kategori bawaan hidup di kode; database hanya menyimpan perubahan dan kategori buatan sendiri. */
export const DEFAULT_CATEGORIES: Category[] = [
  cat('makan', 'Makan', 'utensils', '#eb6834', 'expense', 1),
  cat('transport', 'Transportasi', 'car', '#2a78d6', 'expense', 2),
  cat('tagihan', 'Kos & tagihan', 'receipt', '#e34948', 'expense', 3),
  cat('belajar', 'Belajar & buku', 'book-open', '#9b7bea', 'expense', 4),
  cat('kesehatan', 'Kesehatan', 'heart-pulse', '#1baf7a', 'expense', 5),
  cat('sedekah', 'Sedekah & infak', 'hand-heart', '#3bb5c4', 'expense', 6),
  cat('belanja', 'Belanja', 'shopping-bag', '#e87ba4', 'expense', 7),
  cat('hiburan', 'Hiburan', 'clapperboard', '#6250d6', 'expense', 8),
  cat('tentir', 'Tentir', 'users', '#4cb782', 'income', 9),
  cat('kiriman', 'Kiriman & gaji', 'wallet', '#008300', 'income', 10),
  cat('lainnya', 'Lainnya', 'ellipsis', '#64748b', 'both', 11),
]

/** Kategori bawaan Dompetku → padanan di Qawwam (untuk impor backup). */
export const DOMPETKU_CATEGORY_MAP: Record<string, string> = {
  'cat-makan': '#cat:makan',
  'cat-transportasi': '#cat:transport',
  'cat-belanja': '#cat:belanja',
  'cat-tagihan': '#cat:tagihan',
  'cat-hiburan': '#cat:hiburan',
  'cat-kesehatan': '#cat:kesehatan',
  'cat-gaji': '#cat:kiriman',
  'cat-lainnya': '#cat:lainnya',
}

export const UNKNOWN_CATEGORY: Category = cat('__unknown__', 'Tanpa kategori', 'tag', '#94a3b8', 'both', 0)

/** Bawaan + perubahan tersimpan (ID sama menimpa) + kategori buatan sendiri. */
export function mergeCategories(stored: Category[]): Category[] {
  const byId = new Map(stored.map((c) => [c.id, c]))
  const merged = DEFAULT_CATEGORIES.map((d) => ({ ...d, ...byId.get(d.id), builtIn: true }))
  const extra = stored.filter((c) => !DEFAULT_CATEGORIES.some((d) => d.id === c.id)).sort((a, b) => a.createdAt - b.createdAt)
  return [...merged, ...extra]
}

export const categoriesFor = (type: TransactionType, cats: Category[]) => cats.filter((c) => c.kind === type || c.kind === 'both')

export function categoryLookup(cats: Category[]): (id: string) => Category {
  const map = new Map(cats.map((c) => [c.id, c]))
  return (id) => map.get(id) ?? UNKNOWN_CATEGORY
}

// ---------- Ringkasan ----------

export interface MoneySummary {
  income: number
  expense: number
  balance: number
  count: number
}

export function summarize(txs: readonly Pick<Transaction, 'type' | 'amount'>[]): MoneySummary {
  let income = 0
  let expense = 0
  for (const t of txs) {
    if (t.type === 'income') income += t.amount
    else expense += t.amount
  }
  return { income, expense, balance: income - expense, count: txs.length }
}

export const inMonth = <T extends { date: ISODate }>(list: readonly T[], month: MonthKey) => list.filter((t) => monthOf(t.date) === month)

export interface CategorySlice {
  category: Category
  total: number
  ratio: number
}

export function expenseByCategory(txs: readonly Transaction[], getCategory: (id: string) => Category): CategorySlice[] {
  const totals = new Map<string, number>()
  let grand = 0
  for (const t of txs) {
    if (t.type !== 'expense') continue
    totals.set(t.categoryId, (totals.get(t.categoryId) ?? 0) + t.amount)
    grand += t.amount
  }
  return [...totals.entries()]
    .map(([id, total]) => ({ category: getCategory(id), total, ratio: grand ? total / grand : 0 }))
    .sort((a, b) => b.total - a.total)
}

// ---------- Anggaran ----------

export const WARNING_RATIO = 0.8
export type BudgetLevel = 'aman' | 'hampir' | 'lewat'

export function budgetLevel(spent: number, limit: number): BudgetLevel {
  if (limit <= 0) return spent > 0 ? 'lewat' : 'aman'
  const r = spent / limit
  return r > 1 ? 'lewat' : r >= WARNING_RATIO ? 'hampir' : 'aman'
}

export interface BudgetUsage {
  budget: Budget
  category: Category
  spent: number
  remaining: number
  ratio: number
  level: BudgetLevel
}

/** Pemakaian tiap anggaran bulan itu, yang paling kritis di atas. */
export function budgetUsage(budgets: readonly Budget[], txs: readonly Transaction[], getCategory: (id: string) => Category): BudgetUsage[] {
  return budgets
    .map((budget) => {
      const spent = txs
        .filter((t) => t.type === 'expense' && t.categoryId === budget.categoryId && monthOf(t.date) === budget.month)
        .reduce((a, t) => a + t.amount, 0)
      return {
        budget,
        category: getCategory(budget.categoryId),
        spent,
        remaining: budget.amount - spent,
        ratio: budget.amount > 0 ? spent / budget.amount : spent > 0 ? Infinity : 0,
        level: budgetLevel(spent, budget.amount),
      }
    })
    .sort((a, b) => b.ratio - a.ratio || a.category.name.localeCompare(b.category.name))
}

export function budgetTotal(usages: readonly BudgetUsage[]) {
  const limit = usages.reduce((a, u) => a + u.budget.amount, 0)
  const spent = usages.reduce((a, u) => a + u.spent, 0)
  return { limit, spent, remaining: limit - spent, level: budgetLevel(spent, limit) }
}

// ---------- Transaksi berulang ----------

/** ID transaksi dari aturan berulang: deterministik dan privat, jadi dua perangkat tidak pernah membuat dobel. */
export const recurringTxId = (ruleId: string, month: MonthKey) => `#rtx:${ruleId}:${month}`

const MAX_MONTHS = 600

function firstPendingMonth(rule: RecurringRule): MonthKey {
  if (!rule.lastGeneratedMonth) return rule.startMonth
  const after = addMonths(rule.lastGeneratedMonth, 1)
  return after > rule.startMonth ? after : rule.startMonth
}

/** Kejadian yang sudah jatuh tempo (≤ hari ini) dan belum dibuat; mengejar bulan yang terlewat. */
export function dueOccurrences(rule: RecurringRule, today: ISODate): { month: MonthKey; date: ISODate }[] {
  if (!rule.active) return []
  const out: { month: MonthKey; date: ISODate }[] = []
  const last = rule.endMonth && rule.endMonth < monthOf(today) ? rule.endMonth : monthOf(today)
  let month = firstPendingMonth(rule)
  for (let i = 0; i < MAX_MONTHS && month <= last; i++) {
    const date = dateInMonth(month, rule.dayOfMonth)
    if (date > today) break
    out.push({ month, date })
    month = addMonths(month, 1)
  }
  return out
}

export function nextOccurrence(rule: RecurringRule, today: ISODate): ISODate | null {
  if (!rule.active) return null
  let month = firstPendingMonth(rule)
  for (let i = 0; i < MAX_MONTHS; i++) {
    if (rule.endMonth && month > rule.endMonth) return null
    const date = dateInMonth(month, rule.dayOfMonth)
    if (date > today) return date
    month = addMonths(month, 1)
  }
  return null
}

export function recurringTransaction(rule: RecurringRule, occ: { month: MonthKey; date: ISODate }, now: number): Transaction {
  return {
    id: recurringTxId(rule.id, occ.month),
    amount: rule.amount,
    type: rule.type,
    categoryId: rule.categoryId,
    date: occ.date,
    note: rule.note,
    recurringId: rule.id,
    createdAt: now,
    updatedAt: now,
  }
}

// ---------- Tabungan & utang ----------

export interface GoalPlan {
  done: number
  target: number
  left: number
  pct: number
  /** Bulan tersisa sampai tanggal target (min. 1); `null` tanpa tanggal target. */
  monthsLeft: number | null
  /** Setoran/cicilan per bulan agar tepat waktu. */
  perMonth: number | null
}

function plan(done: number, target: number, targetDate: ISODate | null, today: ISODate): GoalPlan {
  const left = Math.max(0, target - done)
  const monthsLeft = targetDate ? Math.max(1, monthsBetween(today, targetDate)) : null
  return {
    done,
    target,
    left,
    pct: target > 0 ? Math.min(1, done / target) : 0,
    monthsLeft,
    perMonth: monthsLeft && left > 0 ? Math.ceil(left / monthsLeft / 1000) * 1000 : null,
  }
}

export const savingPlan = (s: Pick<Saving, 'target' | 'targetDate' | 'deposits'>, today: ISODate) =>
  plan(
    s.deposits.reduce((a, d) => a + d.amount, 0),
    s.target,
    s.targetDate,
    today,
  )

export const debtPlan = (d: Pick<Debt, 'initial' | 'targetDate' | 'payments'>, today: ISODate) =>
  plan(
    d.payments.reduce((a, p) => a + p.amount, 0),
    d.initial,
    d.targetDate,
    today,
  )

// ---------- Catat cepat ----------

/** "25rb", "25 ribu", "25k", "1,5jt", "Rp15.000", "15000". Angka polos < 1000 dianggap ribuan ("25 makan" = Rp25.000). */
export function parseAmount(text: string): number | null {
  const m = /(?:rp\.?\s*)?(\d+(?:[.,]\d+)*)\s*(rb|ribu|k|jt|juta)?(?![\p{L}\d])/iu.exec(text)
  if (!m) return null
  const raw = m[1]
  const unit = m[2]?.toLowerCase()
  let n: number
  if (unit) {
    // "1,5jt" / "1.5 juta" = desimal; "1.500rb" = pemisah ribuan.
    const value = /^\d+[.,]\d{1,2}$/.test(raw) ? Number(raw.replace(',', '.')) : Number(raw.replace(/[.,]/g, ''))
    n = value * (unit === 'jt' || unit === 'juta' ? 1e6 : 1e3)
  } else if (/^\d{1,3}(\.\d{3})+$/.test(raw)) n = Number(raw.replace(/\./g, ''))
  else {
    n = Number(raw.replace(',', '.'))
    if (n < 1000) n *= 1000
  }
  n = Math.round(n)
  return Number.isFinite(n) && n > 0 ? n : null
}

const KEYWORDS: [RegExp, string][] = [
  [/\b(makan|nasi|ayam|telur|kopi|warteg|gofood|grabfood|sarapan|jajan|minum|snack|bakso|soto|mie)\b/i, '#cat:makan'],
  [/\b(gojek|grab|ojek|ojol|bensin|parkir|bus|kereta|tiket|angkot|transport)\b/i, '#cat:transport'],
  [/\b(kos|kost|listrik|air|pulsa|kuota|wifi|internet|tagihan|token|laundry)\b/i, '#cat:tagihan'],
  [/\b(buku|bimbel|kursus|fotokopi|print|ukmppd|langganan|ielts|seminar|jurnal)\b/i, '#cat:belajar'],
  [/\b(obat|dokter|apotek|vitamin|klinik|gym)\b/i, '#cat:kesehatan'],
  [/\b(sedekah|infak|infaq|zakat|masjid|wakaf|donasi)\b/i, '#cat:sedekah'],
  [/\b(nonton|game|netflix|spotify|bioskop|jalan-jalan|liburan)\b/i, '#cat:hiburan'],
  [/\b(belanja|baju|sepatu|shopee|tokopedia|sabun|odol)\b/i, '#cat:belanja'],
  [/\b(tentir|les|murid)\b/i, '#cat:tentir'],
  [/\b(kiriman|ortu|orang tua|gaji|uang saku|transfer)\b/i, '#cat:kiriman'],
]

const INCOME_WORDS = /^\s*\+|\b(masuk|pemasukan|terima|dapat|kiriman|gaji|uang saku)\b/i
const DAY_WORDS = ['minggu', 'senin', 'selasa', 'rabu', 'kamis', 'jumat', 'sabtu']

export interface ParsedMoney {
  amount: number | null
  type: TransactionType
  categoryId: string
  note: string
  date: ISODate
}

/** "25rb makan siang", "+500rb kiriman ortu", "kemarin 15k parkir". Hari = hari ini/kemarin/nama hari terakhir. */
export function parseQuickMoney(input: string, today: ISODate, cats: Category[]): ParsedMoney {
  let text = ` ${input.trim()} `
  const type: TransactionType = INCOME_WORDS.test(input) ? 'income' : 'expense'
  const take = (re: RegExp) => {
    const m = re.exec(text)
    if (m) text = text.slice(0, m.index) + ' ' + text.slice(m.index + m[0].length)
    return m
  }
  let date = today
  if (take(/\s(kemarin|kmrn|kmarin)(?=\s)/i)) date = addDays(today, -1)
  else if (take(/\s(hari ini|tadi)(?=\s)/i)) date = today
  else {
    const m = take(new RegExp(`\\s(?:hari\\s+)?(${DAY_WORDS.join('|')})(?=\\s)`, 'i'))
    if (m) date = addDays(today, -((weekday(today) - DAY_WORDS.indexOf(m[1].toLowerCase()) + 7) % 7))
  }
  const amtMatch = /(?:rp\.?\s*)?\d+(?:[.,]\d+)*\s*(?:rb|ribu|k|jt|juta)?(?![\p{L}\d])/iu.exec(text)
  const amount = amtMatch ? parseAmount(amtMatch[0]) : null
  if (amtMatch) text = text.slice(0, amtMatch.index) + ' ' + text.slice(amtMatch.index + amtMatch[0].length)
  const tag = take(/\s#([\p{L}\p{N}&_-]+)(?=\s)/u)
  const note = text
    .replace(/^\s*\+/, ' ')
    .replace(/\s+/g, ' ')
    .trim()
  const allowed = categoriesFor(type, cats)
  let categoryId: string | undefined
  if (tag) {
    const key = tag[1].toLowerCase()
    categoryId = allowed.find((c) => c.name.toLowerCase().startsWith(key) || c.id === `#cat:${key}`)?.id
  }
  categoryId ??= KEYWORDS.find(([re, id]) => re.test(note) && allowed.some((c) => c.id === id))?.[1]
  categoryId ??= allowed.some((c) => c.id === FALLBACK_CATEGORY_ID) ? FALLBACK_CATEGORY_ID : allowed[0]?.id
  return { amount, type, categoryId: categoryId ?? FALLBACK_CATEGORY_ID, note: note.charAt(0).toUpperCase() + note.slice(1), date }
}
