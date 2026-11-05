import { beforeEach, describe, expect, it } from 'vitest'
import { resetDatabase } from '../test/db-utils'
import { CalendarError, deleteEvent, restoreEvent, saveEvent, setJaga } from './calendar'
import { addTask, PatientIdentityError, setDayType } from './daily'
import { db } from './db'
import { applyImport } from './importer'

beforeEach(resetDatabase)

const type = async (d: string) => (await db.days.get(`#day:${d}`))?.type ?? null

describe('jadwal jaga', () => {
  it('jaga → besoknya pasca (tugas non-pemulihan pindah); batal mengosongkan keduanya', async () => {
    await addTask({ title: 'Referat', roleId: '#role:koas', date: '2026-11-11' })
    const moved = await setJaga('2026-11-10', true)
    expect([await type('2026-11-10'), await type('2026-11-11')]).toEqual(['jaga', 'pasca'])
    expect(moved).toHaveLength(1)
    expect((await db.tasks.toArray())[0].date).toBe('2026-11-12')
    await setJaga('2026-11-10', false)
    expect([await type('2026-11-10'), await type('2026-11-11')]).toEqual([null, null])
  })

  it('tidak menimpa tipe hari besok yang sudah dipilih', async () => {
    await setDayType('2026-11-11', 'libur')
    await setJaga('2026-11-10', true)
    expect(await type('2026-11-11')).toBe('libur')
  })
})

describe('agenda', () => {
  it('validasi jam, identitas pasien, hapus + urungkan', async () => {
    const ev = await saveEvent({ title: 'Ujian OSCE', date: '2026-11-20', start: '7.30', end: '12' })
    expect(ev).toMatchObject({ start: '07.30', end: '12.00', kind: 'agenda' })
    await expect(saveEvent({ title: 'x', date: '2026-11-20', start: '25.00' })).rejects.toBeInstanceOf(CalendarError)
    await expect(saveEvent({ title: 'Visite Tn. Budi', date: '2026-11-20' })).rejects.toBeInstanceOf(PatientIdentityError)
    const removed = await deleteEvent(ev.id)
    expect(await db.events.count()).toBe(0)
    await restoreEvent(removed!)
    expect(await db.events.count()).toBe(1)
  })

  it('impor agenda (dari Claude/Usulan) tanpa dobel', async () => {
    const item = { kind: 'agenda' as const, title: 'Seminar ortopedi', date: '2026-11-21', start: '13.00', end: null, roleId: '#role:orto' }
    expect((await applyImport([item])).agenda).toBe(1)
    expect((await applyImport([item])).agenda).toBe(0)
  })
})
