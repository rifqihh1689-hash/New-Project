import { useLiveQuery } from 'dexie-react-hooks'
import { loadAllResults } from '../../db/daily'
import { db } from '../../db/db'
import { emptyReview } from '../../db/review'
import { loadHabits, loadProfile, loadRoles } from '../../db/structure'
import { weekDates } from '../../domain/time'
import { computeWeekNumbers, reviewWindow } from '../../domain/weekly'
import { privateId } from '../../lib/id'
import type { ISODate } from '../../types'

export async function loadMuhasabah(monday: ISODate, today: ISODate) {
  const dates = weekDates(monday)
  const range = [dates[0], dates[6], true, true] as const
  const [all, days, tasks, habits, habitLogs, tentir, transactions, review, roles, profile] = await Promise.all([
    loadAllResults(today),
    db.days
      .where('date')
      .between(...range)
      .toArray(),
    db.tasks
      .where('date')
      .between(...range)
      .toArray(),
    loadHabits(),
    db.habitLogs
      .where('date')
      .between(...range)
      .toArray(),
    db.tentirSessions
      .where('date')
      .between(...range)
      .toArray(),
    db.transactions
      .where('date')
      .between(...range)
      .toArray(),
    db.reviews.get(privateId.weeklyReview(monday)),
    loadRoles(),
    loadProfile(),
  ])
  const numbers = computeWeekNumbers({
    dates,
    today,
    results: all.results,
    days,
    tasks,
    habits,
    habitLogs,
    tentir,
    transactions,
    rules: all.rules,
  })
  const order = (a: { date: string; createdAt: number }, b: { date: string; createdAt: number }) =>
    a.date.localeCompare(b.date) || a.createdAt - b.createdAt
  return {
    monday,
    dates,
    numbers,
    review: review ?? emptyReview(monday),
    window: reviewWindow(monday, today),
    done: tasks.filter((t) => t.done).sort(order),
    open: tasks.filter((t) => !t.done).sort(order),
    roles,
    rules: all.rules,
    tentirCapacity: profile.tentirCapacity,
  }
}

export type MuhasabahData = Awaited<ReturnType<typeof loadMuhasabah>>

export const useMuhasabah = (monday: ISODate, today: ISODate) => useLiveQuery(() => loadMuhasabah(monday, today), [monday, today])
