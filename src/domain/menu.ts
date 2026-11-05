import type { DayType, FoodPhase, Ingredient, ISODate, MealPlanEntry, MealSlot, Menu, NutritionSettings } from '../types'

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

export const DEFAULT_NUTRITION: NutritionSettings = {
  weightKg: null,
  phase: 'bulk',
  mealsPerDay: 5,
  proteinPerKg: 1.6,
  weeklyBudget: 350_000,
}

/** Gabungkan setelan tersimpan dengan bawaan; jumlah makan mengikuti fase bila belum diatur sendiri. */
export function resolveNutrition(stored: Partial<NutritionSettings> | undefined): NutritionSettings {
  const phase = stored?.phase ?? DEFAULT_NUTRITION.phase
  return { ...DEFAULT_NUTRITION, mealsPerDay: MEALS_BY_PHASE[phase], ...stored, phase }
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
