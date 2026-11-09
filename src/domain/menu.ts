import type { DayType, FoodPhase, Ingredient, IngredientPrice, ISODate, MealPlanEntry, MealSlot, Menu, NutritionSettings } from '../types'

export const SLOT_ORDER: MealSlot[] = ['sarapan', 'snack1', 'siang', 'snack2', 'malam']

export const SLOT_LABELS: Record<MealSlot, string> = {
  sarapan: 'Sarapan',
  snack1: 'Snack pagi',
  siang: 'Makan siang',
  snack2: 'Snack sore',
  malam: 'Makan malam',
}

export const PHASE_LABELS: Record<FoodPhase, string> = { bulk: 'Bulk', maintain: 'Maintain', cut: 'Cut' }

const MEALS_BY_PHASE: Record<FoodPhase, 3 | 4 | 5> = { bulk: 5, maintain: 4, cut: 3 }

/** Harga bawaan (perkiraan pasar Malang, Nov 2026). Rupiah per g / ml / butir / buah. */
export const DEFAULT_PRICES: IngredientPrice[] = [
  { name: 'Beras', unit: 'g', rpPerUnit: 14 },
  { name: 'Dada ayam', unit: 'g', rpPerUnit: 45 },
  { name: 'Paha ayam fillet', unit: 'g', rpPerUnit: 50 },
  { name: 'Telur', unit: 'butir', rpPerUnit: 2_000 },
  { name: 'Tempe', unit: 'g', rpPerUnit: 16 },
  { name: 'Tahu', unit: 'g', rpPerUnit: 12 },
  { name: 'Sayur', unit: 'g', rpPerUnit: 15 },
  { name: 'Sayur sup', unit: 'g', rpPerUnit: 15 },
  { name: 'Oat', unit: 'g', rpPerUnit: 40 },
  { name: 'Susu UHT', unit: 'ml', rpPerUnit: 18 },
  { name: 'Pisang', unit: 'buah', rpPerUnit: 1_500 },
]

export const DEFAULT_NUTRITION: NutritionSettings = {
  weightKg: null,
  phase: 'bulk',
  mealsPerDay: 5,
  proteinPerKg: 1.6,
  weeklyBudget: 350_000,
  prices: DEFAULT_PRICES,
  pricesUpdatedAt: null,
  overheadRp: 1_500,
}

const priceKey = (name: string, unit: string) => `${name.trim().toLowerCase()}|${unit.trim().toLowerCase()}`

/** Harga bawaan + harga tersimpan (tersimpan menang, per nama + satuan). */
export function resolvePrices(stored: IngredientPrice[] | undefined): IngredientPrice[] {
  const map = new Map(DEFAULT_PRICES.map((p) => [priceKey(p.name, p.unit), p]))
  for (const p of stored ?? []) map.set(priceKey(p.name, p.unit), p)
  return [...map.values()]
}

/** Gabungkan setelan tersimpan dengan bawaan; jumlah makan mengikuti fase bila belum diatur sendiri. */
export function resolveNutrition(stored: Partial<NutritionSettings> | undefined): NutritionSettings {
  const phase = stored?.phase ?? DEFAULT_NUTRITION.phase
  return { ...DEFAULT_NUTRITION, mealsPerDay: MEALS_BY_PHASE[phase], ...stored, phase, prices: resolvePrices(stored?.prices) }
}

/**
 * Biaya satu porsi menu masak dari harga bahan + bumbu/minyak/gas, dibulatkan ke Rp100.
 * Menu beli, atau menu masak yang bahannya ada yang belum berharga, memakai biaya yang diisi manual.
 */
export function menuCost(
  menu: Pick<Menu, 'source' | 'ingredients' | 'costRp'>,
  prices: IngredientPrice[],
  overheadRp: number,
): { cost: number; auto: boolean } {
  if (menu.source !== 'masak' || !menu.ingredients.length) return { cost: menu.costRp, auto: false }
  const map = new Map(prices.map((p) => [priceKey(p.name, p.unit), p.rpPerUnit]))
  let total = overheadRp
  for (const i of menu.ingredients) {
    const price = map.get(priceKey(i.name, i.unit))
    if (price === undefined) return { cost: menu.costRp, auto: false }
    total += i.qty * price
  }
  return { cost: Math.round(total / 100) * 100, auto: true }
}

/** Menu dengan biaya terbaru dari harga bahan (dipakai penyusun, ringkasan, dan tampilan). */
export function withComputedCosts(menus: Menu[], n: Pick<NutritionSettings, 'prices' | 'overheadRp'>): Menu[] {
  return menus.map((m) => {
    const { cost, auto } = menuCost(m, n.prices, n.overheadRp)
    return auto ? { ...m, costRp: cost, costAuto: true } : m
  })
}

/** Perkiraan harga satu baris daftar belanja; `null` bila bahan belum berharga. */
export function ingredientCost(i: Ingredient, prices: IngredientPrice[]): number | null {
  const p = prices.find((x) => priceKey(x.name, x.unit) === priceKey(i.name, i.unit))
  return p ? Math.round((i.qty * p.rpPerUnit) / 100) * 100 : null
}

/** Berapa hari sejak harga diperbarui; harga bawaan dianggap perlu dicek. */
export function pricesAge(updatedAt: number | null, nowMs: number = Date.now()): number | null {
  return updatedAt == null ? null : Math.floor((nowMs - updatedAt) / 86_400_000)
}

/** Satuan tampilan yang lazim di pasar: g → kg, ml → liter. */
export function displayUnit(unit: string): { label: string; factor: number } {
  if (unit === 'g') return { label: 'kg', factor: 1000 }
  if (unit === 'ml') return { label: 'liter', factor: 1000 }
  return { label: unit, factor: 1 }
}

export function mealsForPhase(phase: FoodPhase): 3 | 4 | 5 {
  return MEALS_BY_PHASE[phase]
}

/** Waktu makan per hari: 3 = utama, 4 = + snack sore, 5 = + snack pagi & sore. */
export function slotsFor(mealsPerDay: number): MealSlot[] {
  if (mealsPerDay <= 3) return ['sarapan', 'siang', 'malam']
  if (mealsPerDay === 4) return ['sarapan', 'siang', 'snack2', 'malam']
  return [...SLOT_ORDER]
}

/** Target protein harian (gram) = berat badan × g/kg. `null` bila berat belum diisi. */
export function proteinTarget(n: Pick<NutritionSettings, 'weightKg' | 'proteinPerKg'>): number | null {
  return n.weightKg ? Math.round(n.weightKg * n.proteinPerKg) : null
}

export const mealKey = (date: ISODate, slot: MealSlot) => `${date}|${slot}`

/** Pembangkit acak sederhana yang bisa diulang (seed sama = hasil sama). */
function rng(seed: number) {
  let s = seed >>> 0 || 1
  return () => {
    s ^= s << 13
    s ^= s >>> 17
    s ^= s << 5
    return ((s >>> 0) % 10_000) / 10_000
  }
}

export interface PlanInput {
  dates: ISODate[]
  dayTypes: Map<ISODate, DayType | null>
  menus: Menu[]
  slots: MealSlot[]
  weeklyBudget: number
  /** Isi yang sudah ada dan tidak boleh diubah (mis. "isi yang kosong saja"). */
  keep?: Map<string, string>
  seed?: number
}

/**
 * Susun menu seminggu dari daftar menu.
 * Libur → masak (termasuk masak berat untuk bekal beberapa hari). Stase → siang beli dekat RS atau bekal.
 * Jaga → makan malam berupa bekal. Pasca-jaga → praktis/beli. Utamakan protein, jaga anggaran, hindari pengulangan.
 */
export function generateWeekPlan(input: PlanInput): Map<string, string> {
  const random = rng(input.seed ?? 1)
  const menus = input.menus.filter((m) => !m.archived)
  const plan = new Map<string, string>(input.keep ?? [])
  const used = new Map<string, number>()
  for (const id of plan.values()) used.set(id, (used.get(id) ?? 0) + 1)
  const perMeal = input.weeklyBudget / Math.max(1, input.dates.length * input.slots.length)

  input.dates.forEach((date, dayIdx) => {
    const type = input.dayTypes.get(date) ?? 'stase'
    const today = new Set<string>()
    for (const slot of input.slots) {
      const k = mealKey(date, slot)
      if (plan.has(k)) {
        today.add(plan.get(k)!)
        continue
      }
      let best: { id: string; score: number } | null = null
      for (const m of menus) {
        if (!m.slots.includes(slot)) continue
        let score = m.proteinG / 12
        // Konteks tipe hari.
        if (type === 'libur') score += m.source === 'masak' ? 3 : 0
        else if (m.heavyCook && !m.bekal) score -= 6 // masak lama hanya di hari libur
        if (type === 'stase' && slot === 'siang') score += m.source === 'beli' || m.bekal ? 2 : -2
        if (type === 'jaga' && slot === 'malam') score += m.bekal ? 4 : -6
        if (type === 'pasca') score += m.source === 'beli' || !m.heavyCook ? 2 : -4
        // Anggaran.
        score -= Math.max(0, m.costRp - perMeal) / 2500
        score -= m.costRp / 20_000
        // Variasi.
        if (today.has(m.id)) score -= 5
        score -= (used.get(m.id) ?? 0) * 1.2
        for (let back = 1; back <= 2; back++) {
          const prev = dayIdx - back >= 0 ? plan.get(mealKey(input.dates[dayIdx - back], slot)) : undefined
          if (prev === m.id) score -= 2.5
        }
        score += random() * 1.5
        if (!best || score > best.score) best = { id: m.id, score }
      }
      if (best) {
        plan.set(k, best.id)
        today.add(best.id)
        used.set(best.id, (used.get(best.id) ?? 0) + 1)
      }
    }
  })
  return plan
}

export interface DaySummary {
  date: ISODate
  protein: number
  cost: number
  filled: number
}

/** Perkiraan protein & biaya per hari dan seminggu. */
export function planSummary(entries: Pick<MealPlanEntry, 'date' | 'menuId'>[], menus: Menu[], dates: ISODate[]) {
  const byId = new Map(menus.map((m) => [m.id, m]))
  const days: DaySummary[] = dates.map((date) => {
    const list = entries
      .filter((e) => e.date === date && e.menuId)
      .map((e) => byId.get(e.menuId!))
      .filter((m): m is Menu => !!m)
    return { date, protein: list.reduce((a, m) => a + m.proteinG, 0), cost: list.reduce((a, m) => a + m.costRp, 0), filled: list.length }
  })
  const plannedDays = days.filter((d) => d.filled > 0)
  return {
    days,
    totalCost: days.reduce((a, d) => a + d.cost, 0),
    avgProtein: plannedDays.length ? Math.round(plannedDays.reduce((a, d) => a + d.protein, 0) / plannedDays.length) : null,
    filled: days.reduce((a, d) => a + d.filled, 0),
  }
}

/** Daftar belanja dari menu masak: bahan dijumlah per nama + satuan. */
export function shoppingList(entries: Pick<MealPlanEntry, 'menuId'>[], menus: Menu[]): Ingredient[] {
  const byId = new Map(menus.map((m) => [m.id, m]))
  const total = new Map<string, Ingredient>()
  for (const e of entries) {
    const m = e.menuId ? byId.get(e.menuId) : undefined
    if (!m || m.source !== 'masak') continue
    for (const ing of m.ingredients) {
      const key = `${ing.name.trim().toLowerCase()}|${ing.unit.trim().toLowerCase()}`
      const prev = total.get(key)
      total.set(key, { name: prev?.name ?? ing.name.trim(), unit: ing.unit.trim(), qty: (prev?.qty ?? 0) + ing.qty })
    }
  }
  return [...total.values()].sort((a, b) => a.name.localeCompare(b.name, 'id'))
}

/** "900 g" · "1,2 kg" · "14 butir". */
export function formatQty(i: Ingredient): string {
  const n = (x: number) => x.toLocaleString('id-ID', { maximumFractionDigits: 1 })
  if (i.unit === 'g' && i.qty >= 1000) return `${n(i.qty / 1000)} kg`
  if (i.unit === 'ml' && i.qty >= 1000) return `${n(i.qty / 1000)} l`
  return `${n(i.qty)} ${i.unit}`
}

/** "Telur 2 butir; Dada ayam 150 g" ↔ daftar bahan. */
export function parseIngredients(text: string): Ingredient[] | null {
  const out: Ingredient[] = []
  for (const part of text
    .split(/[;\n]/)
    .map((p) => p.trim())
    .filter(Boolean)) {
    const m = /^(.+?)\s+(\d+(?:[.,]\d+)?)\s*([a-zA-Z]+)?$/.exec(part)
    if (!m) return null
    out.push({ name: m[1].trim(), qty: Number(m[2].replace(',', '.')), unit: (m[3] ?? 'porsi').toLowerCase() })
  }
  return out
}

export function ingredientsText(list: Ingredient[]): string {
  return list.map((i) => `${i.name} ${i.qty} ${i.unit}`).join('; ')
}

/** Bahan sumber protein yang disarankan: protein per satuan, kelipatan beli, dan batas wajar per minggu. */
export const PROTEIN_STAPLES: { name: string; unit: string; proteinPer: number; step: number; max: number }[] = [
  { name: 'Telur', unit: 'butir', proteinPer: 6.3, step: 6, max: 21 },
  { name: 'Dada ayam', unit: 'g', proteinPer: 0.23, step: 250, max: 1500 },
  { name: 'Paha ayam fillet', unit: 'g', proteinPer: 0.19, step: 250, max: 1000 },
  { name: 'Tempe', unit: 'g', proteinPer: 0.19, step: 200, max: 1000 },
  { name: 'Tahu', unit: 'g', proteinPer: 0.08, step: 250, max: 1000 },
  { name: 'Susu UHT', unit: 'ml', proteinPer: 0.033, step: 1000, max: 4000 },
  { name: 'Oat', unit: 'g', proteinPer: 0.13, step: 250, max: 1000 },
]

const stapleOf = (i: Pick<Ingredient, 'name' | 'unit'>) =>
  PROTEIN_STAPLES.find((s) => priceKey(s.name, s.unit) === priceKey(i.name, i.unit))

/** Perkiraan gram protein dari sebuah bahan (0 bila bukan sumber protein yang dikenal). */
export function ingredientProtein(i: Ingredient): number {
  return Math.round(i.qty * (stapleOf(i)?.proteinPer ?? 0))
}

/** Jumlahkan bahan per nama + satuan. */
export function mergeIngredients(...lists: Ingredient[][]): Ingredient[] {
  const total = new Map<string, Ingredient>()
  for (const i of lists.flat()) {
    const key = priceKey(i.name, i.unit)
    const prev = total.get(key)
    total.set(key, { name: prev?.name ?? i.name.trim(), unit: i.unit.trim(), qty: (prev?.qty ?? 0) + i.qty })
  }
  return [...total.values()].sort((a, b) => a.name.localeCompare(b.name, 'id'))
}

export interface ShoppingRec {
  item: Ingredient
  cost: number
  proteinG: number
}

export interface ShoppingAdvice {
  /** Kekurangan protein seminggu (g) setelah menu terencana + bahan tambahan. */
  gapG: number
  recs: ShoppingRec[]
  /** Sisa anggaran makan minggu ini setelah daftar belanja sekarang (Rupiah). */
  budgetLeft: number
}

/**
 * Saran bahan untuk menutup kekurangan protein seminggu, dalam anggaran.
 * Dibagi merata ke beberapa bahan (urut dari yang paling murah per gram protein), kelipatan beli dan batas per minggu mengikuti
 * `PROTEIN_STAPLES`; bahan yang belum berharga tidak disarankan.
 */
export function adviseShopping(input: {
  /** Target protein seminggu (g); `null` = berat badan belum diisi. */
  weeklyProtein: number | null
  plannedProtein: number
  shopping: Ingredient[]
  extras: Ingredient[]
  prices: IngredientPrice[]
  weeklyBudget: number
}): ShoppingAdvice {
  const { prices, shopping, extras } = input
  const cost = (i: Ingredient) => ingredientCost(i, prices) ?? 0
  const budgetLeft = Math.max(0, input.weeklyBudget - shopping.reduce((a, i) => a + cost(i), 0))
  if (input.weeklyProtein == null) return { gapG: 0, recs: [], budgetLeft }
  let gap = input.weeklyProtein - input.plannedProtein - extras.reduce((a, i) => a + ingredientProtein(i), 0)
  const gapG = Math.max(0, Math.round(gap))
  const have = new Map(shopping.map((i) => [priceKey(i.name, i.unit), i.qty]))
  const priceOf = new Map(prices.map((p) => [priceKey(p.name, p.unit), p.rpPerUnit]))
  const ranked = PROTEIN_STAPLES.filter((s) => priceOf.has(priceKey(s.name, s.unit))).sort(
    (a, b) => priceOf.get(priceKey(a.name, a.unit))! / a.proteinPer - priceOf.get(priceKey(b.name, b.unit))! / b.proteinPer,
  )
  const added = new Map<string, number>()
  let left = budgetLeft
  let progress = gap > 0
  while (gap > 0 && progress) {
    progress = false
    for (const s of ranked) {
      if (gap <= 0) break
      const key = priceKey(s.name, s.unit)
      const qty = added.get(key) ?? 0
      const stepCost = Math.round((s.step * priceOf.get(key)!) / 100) * 100
      if ((have.get(key) ?? 0) + qty + s.step > s.max || stepCost > left) continue
      added.set(key, qty + s.step)
      left -= stepCost
      gap -= s.step * s.proteinPer
      progress = true
    }
  }
  const recs = ranked
    .filter((s) => added.has(priceKey(s.name, s.unit)))
    .map((s) => {
      const item = { name: s.name, unit: s.unit, qty: added.get(priceKey(s.name, s.unit))! }
      return { item, cost: cost(item), proteinG: ingredientProtein(item) }
    })
  return { gapG, recs, budgetLeft }
}
