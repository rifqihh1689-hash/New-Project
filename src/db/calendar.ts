import { jagaChanges } from '../domain/calendar'
import { normalizeClock } from '../domain/ritme'
import { addDays, isValidISODate } from '../domain/time'
import { createId, privateId } from '../lib/id'
import type { CalendarEvent, ISODate } from '../types'
import { assertNoPatientIdentity, setDayType } from './daily'
import { db } from './db'

export class CalendarError extends Error {}

/**
 * Menandai / membatalkan jaga. Besoknya otomatis pasca-jaga bila kosong (tugas non-pemulihan di hari itu
 * dipindah ke lusa, sama seperti memilih pasca-jaga di Beranda). Mengembalikan ID tugas yang dipindah.
 */
export async function setJaga(date: ISODate, on: boolean): Promise<string[]> {
  const days = await db.days.bulkGet([privateId.day(date), privateId.day(addDays(date, 1))])
  const types = new Map(days.filter(Boolean).map((d) => [d!.date, d!.type]))
  const moved: string[] = []
  for (const c of jagaChanges(date, on, (d) => types.get(d) ?? null)) moved.push(...(await setDayType(c.date, c.type)))
  return moved
}

export interface EventInput {
  id?: string
  title: string
  date: ISODate
  start?: string | null
  end?: string | null
  roleId?: string | null
}

export async function saveEvent(input: EventInput): Promise<CalendarEvent> {
  const title = input.title.trim()
  if (!title) throw new CalendarError('Judul agenda kosong.')
  if (!isValidISODate(input.date)) throw new CalendarError('Tanggal tidak valid.')
  const start = input.start ? normalizeClock(input.start) : null
  const end = input.end ? normalizeClock(input.end) : null
  if (input.start && !start) throw new CalendarError('Jam mulai tidak dikenali (contoh 08.00).')
  if (input.end && !end) throw new CalendarError('Jam selesai tidak dikenali (contoh 10.00).')
  assertNoPatientIdentity(title)
  const prev = input.id ? await db.events.get(input.id) : undefined
  const now = Date.now()
  const ev: CalendarEvent = {
    id: input.id ?? createId('evt'),
    title,
    date: input.date,
    start,
    end,
    kind: 'agenda',
    roleId: input.roleId ?? null,
    createdAt: prev?.createdAt ?? now,
    updatedAt: now,
  }
  await db.events.put(ev)
  return ev
}

export async function deleteEvent(id: string): Promise<CalendarEvent | undefined> {
  const ev = await db.events.get(id)
  await db.events.delete(id)
  return ev
}

export const restoreEvent = (ev: CalendarEvent) => db.events.put(ev)
