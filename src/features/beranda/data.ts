import { useLiveQuery } from 'dexie-react-hooks'
import { suggestDayType } from '../../domain/dayType'
import { computeStreak, consistency, dayStatus, levelFromXp } from '../../domain/progress'
import { tokensLeft } from '../../domain/rewards'
import { napToNextTier, sleepTotal } from '../../domain/sleep'
import { addDays, monthOf, weekDates, weekStart } from '../../domain/time'
import { effectiveRitme, workEndTime } from '../../domain/ritme'
import { proteinTarget, resolveNutrition, slotsFor } from '../../domain/menu'
import { loadMenus } from '../../db/menu'
import { previousMonday, reviewXpTotal } from '../../domain/weekly'
import { privateId } from '../../lib/id'
import { db } from '../../db/db'
import { loadAllResults, loadDaySnapshot } from '../../db/daily'
import { currentPhase, loadMutabaah, loadPhases, loadProfile, loadRoles } from '../../db/structure'
import type { DayType, ISODate } from '../../types'

/** Semua data Beranda dalam satu kueri reaktif: berubah di perangkat mana pun → Beranda ikut. */
export async function loadBeranda(today: ISODate) {
  const week = weekDates(today)
  const month = monthOf(today)
  const [snap, roles, phases, profile, mutItems, mutLogs, all, weekDays, tentir, txs, budgets, debts, savings, mainQuests, chapters] =
    await Promise.all([
      loadDaySnapshot(today, today),
      loadRoles(),
      loadPhases(),
      loadProfile(),
      loadMutabaah(),
      db.mutabaahLogs.where('date').between(addDays(today, -29), today, true, true).toArray(),
      loadAllResults(today),
      db.days.where('date').between(week[0], week[6], true, true).toArray(),
      db.tentirSessions.where('date').between(week[0], week[6], true, true).toArray(),
      db.transactions.where('date').between(`${month}-01`, `${month}-31`, true, true).toArray(),
      db.budgets.where('month').equals(month).toArray(),
      db.debts.toArray(),
      db.savings.toArray(),
      db.mainQuests.where('status').equals('aktif').toArray(),
      db.chapters.where('end').aboveOrEqual(today).toArray(),
    ])
  const [reviews, lastReview, menus, todayMeals, claimCount] = await Promise.all([
    db.reviews.where('period').equals('minggu').toArray(),
    db.reviews.get(privateId.weeklyReview(previousMonday(weekStart(today)))),
    loadMenus(),
    db.mealPlans.where('date').equals(today).toArray(),
    db.claims.count(),
  ])
  const nutrition = resolveNutrition(profile.nutrition)
  const menuById = new Map(menus.map((m) => [m.id, m]))
  const meals = slotsFor(nutrition.mealsPerDay).map((slot) => {
    const id = todayMeals.find((e) => e.slot === slot)?.menuId
    return { slot, menu: id ? (menuById.get(id) ?? null) : null }
  })

  const { results, firstDate, rules } = all
  const totalXp = [...results.values()].reduce((sum, r) => sum + r.xp, 0) + reviewXpTotal(reviews, rules)
  const level = levelFromXp(totalXp, rules)
  const streak = computeStreak(today, firstDate, (d) => dayStatus(results.get(d)))
  const total = sleepTotal(snap.day?.sleepNight ?? null, snap.day?.nap ?? 0, rules)

  const mutDone = new Map<string, Set<string>>()
  for (const log of mutLogs) if (log.done) (mutDone.get(log.itemId) ?? mutDone.set(log.itemId, new Set()).get(log.itemId)!).add(log.date)
  const mutabaah = mutItems
    .filter((m) => !m.archived)
    .map((m) => {
      const dates = mutDone.get(m.id) ?? new Set<string>()
      return { item: m, done: dates.has(today), week: consistency(dates, today, 7).done, month: consistency(dates, today, 30).done }
    })

  const phase = currentPhase(phases, today)
  const suggested = suggestDayType(today, snap.prevType) as DayType
  const ritmeType = snap.day?.type ?? suggested
  const chapter = chapters.filter((c) => c.start <= today).sort((a, b) => b.start.localeCompare(a.start))[0] ?? null
  const weekTypes = new Map(weekDays.map((d) => [d.date, d.type]))
  const expense = txs.filter((t) => t.type === 'expense').reduce((s, t) => s + t.amount, 0)
  const budget = budgets.reduce((s, b) => s + b.amount, 0)
  const debtLeft = debts.reduce((s, d) => s + d.initial - d.payments.reduce((p, x) => p + x.amount, 0), 0)
  const debtInitial = debts.reduce((s, d) => s + d.initial, 0)
  const bridge = savings.filter((s) => s.kind === 'jembatan')
  const tentirIncome = txs.filter((t) => t.type === 'income' && t.tentirSessionId).reduce((s, t) => s + t.amount, 0)

  return {
    today,
    snap,
    rules,
    roles,
    phases: phases.filter((p) => !p.archived),
    phase,
    chapter,
    chapterWeek: chapter ? Math.floor((Date.parse(today) - Date.parse(weekStart(chapter.start))) / (7 * 86_400_000)) + 1 : null,
    profile,
    suggested,
    ritme: effectiveRitme(ritmeType, profile.ritme, chapter),
    pulang: workEndTime(effectiveRitme('stase', profile.ritme, chapter)),
    sleep: { total, next: napToNextTier(total, rules) },
    totalXp,
    level,
    tokens: tokensLeft(level.level, claimCount),
    streak,
    mutabaah,
    week: week.map((date) => ({ date, type: weekTypes.get(date) ?? null })),
    tentir: {
      sessions: tentir.sort((a, b) => a.date.localeCompare(b.date) || (a.start ?? '').localeCompare(b.start ?? '')),
      hours: tentir.reduce((s, t) => s + t.hours, 0),
      today: tentir.some((t) => t.date === today),
      capacity: profile.tentirCapacity,
    },
    money: { expense, budget, debtLeft, debtInitial, hasDebt: debts.length > 0, bridge, tentirIncome },
    mainQuests: mainQuests.slice(0, 3),
    priorities: (lastReview?.priorities ?? []).filter((p) => p.trim()),
    meals,
    proteinTarget: proteinTarget(nutrition),
  }
}

export type BerandaData = Awaited<ReturnType<typeof loadBeranda>>

export function useBeranda(today: ISODate): BerandaData | undefined {
  return useLiveQuery(() => loadBeranda(today), [today])
}
