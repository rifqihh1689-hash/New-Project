import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '../../db/db'
import { loadSessions } from '../../db/tentir'
import { loadProfile, rulesOf } from '../../db/structure'
import { capacityState, DEFAULT_TENTIR_RATE, hoursByDay, summarize } from '../../domain/tentir'
import { addDays, weekDates } from '../../domain/time'
import type { ISODate } from '../../types'

export async function loadTentirPage(monday: ISODate, today: ISODate) {
  const dates = weekDates(monday)
  const [week, all, profile, days, studentRows, packages, materials] = await Promise.all([
    loadSessions(dates[0], dates[6]),
    loadSessions(),
    loadProfile(),
    db.days.where('date').between(dates[0], dates[6], true, true).toArray(),
    db.students.toArray(),
    db.tentirPackages.toArray(),
    db.materials.toArray(),
  ])
  const cap = profile.tentirCapacity
  const limit = rulesOf(profile).workEndLimit
  const summary = summarize(week, limit)
  const last28 = summarize(
    all.filter((s) => s.date > addDays(today, -28) && s.date <= today),
    limit,
  )
  return {
    dates,
    sessions: week,
    summary,
    last28,
    capacity: cap,
    state: capacityState(summary.hours, cap),
    perDay: hoursByDay(week, dates[0]),
    dayTypes: new Map(dates.map((d) => [d, days.find((x) => x.date === d)?.type ?? null])),
    unpaid: all.filter((s) => !s.paid && s.date <= today),
    rate: profile.tentirRate ?? DEFAULT_TENTIR_RATE,
    /** Batas kerja malam dari aturan XP (`null` = dimatikan). */
    limit,
    students: [
      ...new Set([...studentRows.filter((x) => !x.archived).map((x) => x.initials), ...all.map((s) => s.student)].filter(Boolean)),
    ],
    allSessions: all,
    studentRows,
    packages,
    materials: materials.sort((a, b) => a.block.localeCompare(b.block) || a.title.localeCompare(b.title)),
  }
}

export type TentirPageData = Awaited<ReturnType<typeof loadTentirPage>>

export const useTentirPage = (monday: ISODate, today: ISODate) => useLiveQuery(() => loadTentirPage(monday, today), [monday, today])
