import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '../../db/db'
import { loadHabits, loadMutabaah, loadProfile, loadRoles, rulesOf } from '../../db/structure'
import { habitCell, habitRowSummary, lastDays } from '../../domain/habitGrid'
import { consistency } from '../../domain/progress'
import { addDays } from '../../domain/time'
import { privateId } from '../../lib/id'
import type { ISODate } from '../../types'

export async function loadHabitPage(today: ISODate) {
  const dates = lastDays(today, 7)
  const [habits, roles, days, logs, mutItems, mutLogs, profile] = await Promise.all([
    loadHabits(),
    loadRoles(),
    db.days.where('date').between(dates[0], today, true, true).toArray(),
    db.habitLogs.where('date').between(dates[0], today, true, true).toArray(),
    loadMutabaah(),
    db.mutabaahLogs.where('date').between(addDays(today, -29), today, true, true).toArray(),
    loadProfile(),
  ])
  const rules = rulesOf(profile)
  const dayMap = new Map(days.map((d) => [d.date, d]))
  const logMap = new Map(logs.map((l) => [l.id, l]))
  const rows = habits
    .filter((h) => h.active)
    .map((habit) => {
      const cells = dates.map((d) => habitCell(habit, d, dayMap.get(d), logMap.get(privateId.habitLog(habit.id, d)), today, rules))
      return { habit, cells, summary: habitRowSummary(cells), todayMinutes: cells[cells.length - 1].minutes }
    })
  const mutDone = new Map<string, Set<string>>()
  for (const l of mutLogs) if (l.done) (mutDone.get(l.itemId) ?? mutDone.set(l.itemId, new Set()).get(l.itemId)!).add(l.date)
  const mutabaah = mutItems
    .filter((m) => !m.archived)
    .map((item) => {
      const set = mutDone.get(item.id) ?? new Set<string>()
      return {
        item,
        cells: dates.map((date) => ({ date, done: set.has(date), isToday: date === today })),
        week: consistency(set, today, 7).done,
        month: consistency(set, today, 30).done,
      }
    })
  return {
    today,
    dates,
    dayTypes: new Map(dates.map((d) => [d, dayMap.get(d)?.type ?? null])),
    rows,
    inactive: habits.filter((h) => !h.active),
    habits,
    roles,
    mutabaah,
    archivedMutabaah: mutItems.filter((m) => m.archived),
    allMutabaah: mutItems,
  }
}

export type HabitPageData = Awaited<ReturnType<typeof loadHabitPage>>

export const useHabitPage = (today: ISODate) => useLiveQuery(() => loadHabitPage(today), [today])
