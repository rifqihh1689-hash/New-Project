import { generateWeekPlan, mealKey, resolveNutrition, slotsFor, withComputedCosts } from '../domain/menu'
import { createId, privateId } from '../lib/id'
import type { DayType, Ingredient, IngredientPrice, ISODate, MealPlanEntry, MealSlot, Menu, NutritionSettings } from '../types'
import { addTask, assertNoPatientIdentity, updateTask } from './daily'
import { db } from './db'
import { DEFAULT_MENUS, DEFAULT_PROFILE } from './defaults'

/** Menu bawaan + menu tersimpan (tersimpan menang), diurutkan masak dulu lalu nama. */
export async function loadMenus(): Promise<Menu[]> {
  const [stored, profile] = await Promise.all([db.menus.toArray(), db.profile.get(DEFAULT_PROFILE.id)])
  const map = new Map(DEFAULT_MENUS.map((m) => [m.id, m]))
  for (const m of stored) map.set(m.id, m)
  const menus = [...map.values()].sort((a, b) => a.source.localeCompare(b.source) || a.name.localeCompare(b.name, 'id'))
  return withComputedCosts(menus, resolveNutrition(profile?.nutrition))
}

export async function saveMenu(menu: Menu): Promise<void> {
  assertNoPatientIdentity(menu.name, menu.note ?? '', menu.place ?? '')
  const { costAuto: _auto, ...rest } = menu
  void _auto
  await db.menus.put({ ...rest, updatedAt: Date.now() })
}

export function newMenu(): Menu {
  const now = Date.now()
  return {
    id: createId('mnu'),
    name: '',
    source: 'masak',
    slots: ['siang', 'malam'],
    proteinG: 25,
    costRp: 10_000,
    ingredients: [],
    bekal: false,
    heavyCook: false,
    archived: false,
    createdAt: now,
    updatedAt: now,
  }
}

export async function updateNutrition(changes: Partial<NutritionSettings>): Promise<void> {
  await db.transaction('rw', db.profile, async () => {
    const current = (await db.profile.get(DEFAULT_PROFILE.id)) ?? DEFAULT_PROFILE
    await db.profile.put({ ...current, nutrition: { ...current.nutrition, ...changes }, id: DEFAULT_PROFILE.id, updatedAt: Date.now() })
  })
}

/** Menyimpan daftar harga bahan; tanggal pembaruan dicatat untuk pengingat bulanan. */
export async function savePrices(prices: IngredientPrice[], overheadRp?: number): Promise<void> {
  await updateNutrition({ prices, pricesUpdatedAt: Date.now(), ...(overheadRp !== undefined ? { overheadRp } : {}) })
}

export async function setMeal(date: ISODate, slot: MealSlot, menuId: string | null): Promise<void> {
  await db.mealPlans.put({ id: privateId.meal(date, slot), date, slot, menuId, updatedAt: Date.now() })
}

/**
 * Susun otomatis. `onlyEmpty` = isi yang kosong saja (yang sudah dipilih tidak diubah).
 * Mengembalikan isi sebelumnya untuk tombol Urungkan.
 */
export async function autoPlan(
  dates: ISODate[],
  dayTypes: Map<ISODate, DayType | null>,
  opts: { onlyEmpty: boolean; seed?: number },
): Promise<MealPlanEntry[]> {
  const [menus, profile, before] = await Promise.all([
    loadMenus(),
    db.profile.get(DEFAULT_PROFILE.id),
    db.mealPlans
      .where('date')
      .between(dates[0], dates[dates.length - 1], true, true)
      .toArray(),
  ])
  const n = resolveNutrition(profile?.nutrition)
  const slots = slotsFor(n.mealsPerDay)
  const keep = new Map<string, string>()
  if (opts.onlyEmpty) for (const e of before) if (e.menuId) keep.set(mealKey(e.date, e.slot), e.menuId)
  const plan = generateWeekPlan({ dates, dayTypes, menus, slots, weeklyBudget: n.weeklyBudget, keep, seed: opts.seed ?? Date.now() })
  const now = Date.now()
  await db.mealPlans.bulkPut(
    [...plan].map(([k, menuId]) => {
      const [date, slot] = k.split('|') as [ISODate, MealSlot]
      return { id: privateId.meal(date, slot), date, slot, menuId, updatedAt: now }
    }),
  )
  return before
}

/** Kembalikan rencana ke isi sebelum disusun ulang. */
export async function restorePlan(dates: ISODate[], before: MealPlanEntry[]): Promise<void> {
  await db.transaction('rw', db.mealPlans, async () => {
    await db.mealPlans
      .where('date')
      .between(dates[0], dates[dates.length - 1], true, true)
      .delete()
    await db.mealPlans.bulkPut(before)
  })
}

/** Daftar belanja → satu tugas "Belanja mingguan" dengan subtugas per bahan. */
export async function shoppingTask(list: Ingredient[], date: ISODate, format: (i: Ingredient) => string): Promise<string> {
  const task = await addTask({ title: 'Belanja mingguan', roleId: '#role:uang', date })
  await updateTask(task.id, { subtasks: list.map((i, n) => ({ id: `sub_${n}`, title: `${i.name} ${format(i)}`, done: false })) })
  return task.id
}
