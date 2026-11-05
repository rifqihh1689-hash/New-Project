import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '../../db/db'
import { sortTasks } from '../../db/daily'
import { currentPhase, loadPhases, loadRoles } from '../../db/structure'
import { suggestDayType } from '../../domain/dayType'
import { addDays, weekDates } from '../../domain/time'
import { privateId } from '../../lib/id'
import type { DayType, ISODate, Task } from '../../types'

export async function loadTugas(date: ISODate) {
  const [tasks, roles, phases, day, prev] = await Promise.all([
    db.tasks.where('date').equals(date).toArray(),
    loadRoles(),
    loadPhases(),
    db.days.get(privateId.day(date)),
    db.days.get(privateId.day(addDays(date, -1))),
  ])
  return {
    tasks: sortTasks(tasks),
    roles,
    phase: currentPhase(phases, date),
    type: day?.type ?? null,
    suggested: suggestDayType(date, prev?.type ?? null),
  }
}

export const useTugas = (date: ISODate) => useLiveQuery(() => loadTugas(date), [date])

export interface WeekDay {
  date: ISODate
  type: DayType | null
  tasks: Task[]
}

/** Satu minggu (Senin–Minggu) untuk papan Tugas. */
export async function loadTugasWeek(date: ISODate) {
  const dates = weekDates(date)
  const [tasks, roles, days] = await Promise.all([
    db.tasks.where('date').between(dates[0], dates[6], true, true).toArray(),
    loadRoles(),
    db.days.where('date').between(dates[0], dates[6], true, true).toArray(),
  ])
  const types = new Map(days.map((d) => [d.date, d.type]))
  const week: WeekDay[] = dates.map((d) => ({ date: d, type: types.get(d) ?? null, tasks: sortTasks(tasks.filter((t) => t.date === d)) }))
  return { week, roles, all: tasks }
}

export const useTugasWeek = (date: ISODate) => useLiveQuery(() => loadTugasWeek(date), [date])
