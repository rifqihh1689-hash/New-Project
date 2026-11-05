import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '../../db/db'
import { loadMenus } from '../../db/menu'
import { loadProfile } from '../../db/structure'
import { planSummary, proteinTarget, resolveNutrition, shoppingList, slotsFor } from '../../domain/menu'
import { weekDates } from '../../domain/time'
import type { ISODate } from '../../types'

export async function loadMenuPage(date: ISODate) {
  const dates = weekDates(date)
  const [menus, profile, entries, days] = await Promise.all([
    loadMenus(),
    loadProfile(),
    db.mealPlans.where('date').between(dates[0], dates[6], true, true).toArray(),
    db.days.where('date').between(dates[0], dates[6], true, true).toArray(),
  ])
  const nutrition = resolveNutrition(profile.nutrition)
  const slots = slotsFor(nutrition.mealsPerDay)
  // Hanya waktu makan yang sedang dipakai yang dihitung (mis. setelah pindah dari bulk ke cut).
  const active = entries.filter((e) => slots.includes(e.slot))
  return {
    dates,
    menus,
    nutrition,
    slots,
    target: proteinTarget(nutrition),
    entries: active,
    plan: new Map(active.map((e) => [`${e.date}|${e.slot}`, e.menuId])),
    dayTypes: new Map(dates.map((d) => [d, days.find((x) => x.date === d)?.type ?? null])),
    summary: planSummary(active, menus, dates),
    shopping: shoppingList(active, menus),
  }
}

export type MenuPageData = Awaited<ReturnType<typeof loadMenuPage>>

export const useMenuPage = (date: ISODate) => useLiveQuery(() => loadMenuPage(date), [date])
