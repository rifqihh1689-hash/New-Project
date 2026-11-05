import { describe, expect, it } from 'vitest'
import { DEFAULT_MENUS } from '../db/defaults'
import type { DayType } from '../types'
import { weekDates } from './time'
import {
  formatQty,
  generateWeekPlan,
  ingredientCost,
  menuCost,
  pricesAge,
  resolvePrices,
  withComputedCosts,
  mealKey,
  parseIngredients,
  planSummary,
  proteinTarget,
  resolveNutrition,
  shoppingList,
  slotsFor,
} from './menu'

const dates = weekDates('2026-11-02')
const types = new Map<string, DayType | null>(
  dates.map((d, i) => [d, (['stase', 'jaga', 'pasca', 'stase', 'stase', 'libur', 'libur'] as DayType[])[i]]),
)
const byId = new Map(DEFAULT_MENUS.map((m) => [m.id, m]))

describe('setelan gizi', () => {
  it('jumlah makan mengikuti fase, bisa diatur sendiri', () => {
    expect(resolveNutrition({ phase: 'bulk' }).mealsPerDay).toBe(5)
    expect(resolveNutrition({ phase: 'cut' }).mealsPerDay).toBe(3)
    expect(resolveNutrition({ phase: 'cut', mealsPerDay: 4 }).mealsPerDay).toBe(4)
    expect(slotsFor(3)).toEqual(['sarapan', 'siang', 'malam'])
    expect(slotsFor(4)).toEqual(['sarapan', 'siang', 'snack2', 'malam'])
    expect(slotsFor(5)).toHaveLength(5)
  })

  it('target protein 1,6 g/kg', () => {
    expect(proteinTarget({ weightKg: 70, proteinPerKg: 1.6 })).toBe(112)
    expect(proteinTarget({ weightKg: null, proteinPerKg: 1.6 })).toBeNull()
  })
})

describe('penyusun menu mingguan', () => {
  const plan = generateWeekPlan({ dates, dayTypes: types, menus: DEFAULT_MENUS, slots: slotsFor(5), weeklyBudget: 350_000, seed: 7 })
  const menuAt = (i: number, slot: Parameters<typeof mealKey>[1]) => byId.get(plan.get(mealKey(dates[i], slot))!)!

  it('mengisi semua waktu makan dan cocok dengan slotnya', () => {
    expect(plan.size).toBe(35)
    for (const [k, id] of plan) expect(byId.get(id)!.slots).toContain(k.split('|')[1])
  })

  it('jaga → makan malam berupa bekal; masak berat tidak di hari kerja kecuali bekal', () => {
    expect(menuAt(1, 'malam').bekal).toBe(true)
    for (const [k, id] of plan) {
      const type = types.get(k.split('|')[0])
      const m = byId.get(id)!
      if (type !== 'libur' && m.heavyCook) expect(m.bekal).toBe(true)
    }
  })

  it('tidak mengulang menu yang sama di hari yang sama', () => {
    for (const d of dates) {
      const ids = slotsFor(5).map((s) => plan.get(mealKey(d, s)))
      expect(new Set(ids).size).toBe(ids.length)
    }
  })

  it('dalam anggaran dan protein harian tinggi', () => {
    const entries = [...plan].map(([k, menuId]) => ({ date: k.split('|')[0], menuId }))
    const sum = planSummary(entries, DEFAULT_MENUS, dates)
    expect(sum.totalCost).toBeLessThanOrEqual(400_000)
    expect(sum.avgProtein).toBeGreaterThanOrEqual(100)
  })

  it('isi yang sudah ada dipertahankan; seed sama = hasil sama', () => {
    const keep = new Map([[mealKey(dates[0], 'siang'), '#menu:soto-ayam']])
    const again = generateWeekPlan({
      dates,
      dayTypes: types,
      menus: DEFAULT_MENUS,
      slots: slotsFor(3),
      weeklyBudget: 350_000,
      keep,
      seed: 3,
    })
    expect(again.get(mealKey(dates[0], 'siang'))).toBe('#menu:soto-ayam')
    expect(
      generateWeekPlan({ dates, dayTypes: types, menus: DEFAULT_MENUS, slots: slotsFor(3), weeklyBudget: 350_000, keep, seed: 3 }),
    ).toEqual(again)
  })

  it('menu yang diarsipkan tidak dipakai', () => {
    const menus = DEFAULT_MENUS.map((m) => (m.source === 'beli' ? { ...m, archived: true } : m))
    const p = generateWeekPlan({ dates, dayTypes: types, menus, slots: slotsFor(3), weeklyBudget: 350_000 })
    for (const id of p.values()) expect(byId.get(id)!.source).toBe('masak')
  })
})

describe('daftar belanja', () => {
  it('menjumlah bahan menu masak, mengabaikan menu beli', () => {
    const entries = [
      { menuId: '#menu:telur-dadar' },
      { menuId: '#menu:telur-rebus' },
      { menuId: '#menu:geprek' },
      { menuId: '#menu:ayam-panggang' },
    ]
    const list = shoppingList(entries, DEFAULT_MENUS)
    expect(list.find((i) => i.name === 'Telur')).toEqual({ name: 'Telur', qty: 5, unit: 'butir' })
    expect(list.find((i) => i.name === 'Beras')?.qty).toBe(160)
    expect(list.some((i) => /geprek/i.test(i.name))).toBe(false)
  })

  it('format jumlah & bahan', () => {
    expect(formatQty({ name: 'Dada ayam', qty: 1350, unit: 'g' })).toBe('1,4 kg')
    expect(formatQty({ name: 'Telur', qty: 14, unit: 'butir' })).toBe('14 butir')
    expect(parseIngredients('Telur 2 butir; Dada ayam 150 g\nNasi 1')).toEqual([
      { name: 'Telur', qty: 2, unit: 'butir' },
      { name: 'Dada ayam', qty: 150, unit: 'g' },
      { name: 'Nasi', qty: 1, unit: 'porsi' },
    ])
    expect(parseIngredients('telur banyak')).toBeNull()
  })
})

describe('harga bahan', () => {
  const prices = resolvePrices(undefined)

  it('biaya menu masak = bahan × harga + bumbu, dibulatkan Rp100', () => {
    const egg = DEFAULT_MENUS.find((m) => m.id === '#menu:telur-dadar')!
    // 2 telur × 2.000 + 80 g beras × 14 + bumbu 1.500 = 6.620 → 6.600
    expect(menuCost(egg, prices, 1_500)).toEqual({ cost: 6_600, auto: true })
  })

  it('menu beli & bahan tanpa harga memakai biaya manual', () => {
    const geprek = DEFAULT_MENUS.find((m) => m.id === '#menu:geprek')!
    expect(menuCost(geprek, prices, 1_500)).toEqual({ cost: 15_000, auto: false })
    expect(menuCost({ source: 'masak', costRp: 9_000, ingredients: [{ name: 'Udang', qty: 100, unit: 'g' }] }, prices, 1_500)).toEqual({
      cost: 9_000,
      auto: false,
    })
  })

  it('harga tersimpan menggantikan bawaan dan mengubah biaya semua menu', () => {
    const naik = resolvePrices([{ name: 'telur', unit: 'butir', rpPerUnit: 2_500 }])
    expect(naik.find((p) => p.name.toLowerCase() === 'telur')?.rpPerUnit).toBe(2_500)
    const menus = withComputedCosts(DEFAULT_MENUS, { prices: naik, overheadRp: 1_500 })
    expect(menus.find((m) => m.id === '#menu:telur-rebus')).toMatchObject({ costRp: 9_000, costAuto: true }) // 3 × 2.500 + 1.500
  })

  it('harga per baris belanja & umur harga', () => {
    expect(ingredientCost({ name: 'Dada ayam', qty: 900, unit: 'g' }, prices)).toBe(40_500)
    expect(ingredientCost({ name: 'Udang', qty: 100, unit: 'g' }, prices)).toBeNull()
    expect(pricesAge(null)).toBeNull()
    expect(pricesAge(Date.parse('2026-10-01'), Date.parse('2026-11-05'))).toBe(35)
  })
})
