import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '../../db/db'
import { loadMenus } from '../../db/menu'
import { loadProfile } from '../../db/structure'
import { adviseShopping, mergeIngredients, planSummary, proteinTarget, resolveNutrition, shoppingList, slotsFor } from '../../domain/menu'
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
  const summary = planSummary(active, menus, dates)
  const planned = shoppingList(active, menus)
  // Bahan tambahan hanya berlaku di minggu ia ditambahkan; minggu berikutnya mulai bersih.
  const extras = nutrition.shoppingExtras?.week === dates[0] ? nutrition.shoppingExtras.items : []
  const target = proteinTarget(nutrition)
  return {
    dates,
    menus,
    nutrition,
    slots,
    target,
    entries: active,
    plan: new Map(active.map((e) => [`${e.date}|${e.slot}`, e.menuId])),
    dayTypes: new Map(dates.map((d) => [d, days.find((x) => x.date === d)?.type ?? null])),
    summary,
    planned,
    extras,
    shopping: mergeIngredients(planned, extras),
    advice: adviseShopping({
      weeklyProtein: target == null ? null : target * 7,
      plannedProtein: summary.days.reduce((a, d) => a + d.protein, 0),
      shopping: mergeIngredients(planned, extras),
      extras,
      prices: nutrition.prices,
      weeklyBudget: nutrition.weeklyBudget,
    }),
  }
}

export type MenuPageData = Awaited<ReturnType<typeof loadMenuPage>>

export const useMenuPage = (date: ISODate) => useLiveQuery(() => loadMenuPage(date), [date])
