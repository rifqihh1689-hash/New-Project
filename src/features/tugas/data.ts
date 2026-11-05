import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '../../db/db'
import { sortTasks } from '../../db/daily'
import { currentPhase, loadPhases, loadRoles } from '../../db/structure'
import { privateId } from '../../lib/id'
import { suggestDayType } from '../../domain/dayType'
import { addDays } from '../../domain/time'
import type { ISODate } from '../../types'

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
