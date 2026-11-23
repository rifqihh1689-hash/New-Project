import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '../../db/db'
import { jagaStats, monthGrid, sortEvents } from '../../domain/calendar'
import { shiftOn, type JagaShift } from '../../domain/jaga'
import type { DayType, ISODate, MonthKey } from '../../types'

export async function loadKalender(month: MonthKey) {
  const grid = monthGrid(month)
  const from = grid[0]
  const to = grid[grid.length - 1]
  const [days, events, chapters, sessions, tasks] = await Promise.all([
    db.days.where('date').between(from, to, true, true).toArray(),
    db.events.where('date').between(from, to, true, true).toArray(),
    db.chapters.where('end').aboveOrEqual(from).toArray(),
    db.tentirSessions.where('date').between(from, to, true, true).toArray(),
    db.tasks.where('date').between(from, to, true, true).toArray(),
  ])
  const typeMap = new Map(days.map((d) => [d.date, d.type]))
  const types = (d: ISODate): DayType | null => typeMap.get(d) ?? null
  const shiftMap = new Map(days.map((d) => [d.date, d.jagaShift ?? null]))
  // Shift hanya untuk Sabtu/Minggu; jaga hari kerja selalu 15.00–07.00.
  const shifts = (d: ISODate): JagaShift | null => (types(d) === 'jaga' ? shiftOn(d, shiftMap.get(d)) : null)
  const count = <T extends { date: ISODate }>(list: T[]) => {
    const m = new Map<ISODate, number>()
    for (const x of list) m.set(x.date, (m.get(x.date) ?? 0) + 1)
    return m
  }
  return {
    month,
    grid,
    types,
    shifts,
    events: sortEvents(events),
    eventCount: count(events),
    tentirCount: count(sessions),
    openTasks: count(tasks.filter((t) => !t.done)),
    chapters: chapters.filter((c) => c.start <= to).sort((a, b) => a.start.localeCompare(b.start)),
    stats: jagaStats(month, types),
  }
}

export type KalenderData = Awaited<ReturnType<typeof loadKalender>>

export const useKalender = (month: MonthKey) => useLiveQuery(() => loadKalender(month), [month])
