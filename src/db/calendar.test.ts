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

describe('jaga pagi & malam', () => {
  const day = (d: string) => db.days.get(`#day:${d}`)

  it('jaga pagi tidak membuat pasca-jaga; jaga malam membuatnya', async () => {
    await setJaga('2026-11-14', true, 'pagi')
    expect(await day('2026-11-14')).toMatchObject({ type: 'jaga', jagaShift: 'pagi' })
    expect(await type('2026-11-15')).toBeNull()
    await setJaga('2026-11-21', true, 'malam')
    expect(await day('2026-11-21')).toMatchObject({ type: 'jaga', jagaShift: 'malam' })
    expect(await type('2026-11-22')).toBe('pasca')
  })

  it('ganti malam → pagi membersihkan pasca otomatis; pindah tipe hari menghapus shift', async () => {
    await setJaga('2026-11-14', true, 'malam')
    expect(await type('2026-11-15')).toBe('pasca')
    await setJaga('2026-11-14', true, 'pagi')
    expect((await day('2026-11-14'))?.jagaShift).toBe('pagi')
    expect(await type('2026-11-15')).toBeNull()
    await setDayType('2026-11-14', 'stase')
    expect((await day('2026-11-14'))?.jagaShift).toBeUndefined()
  })

  it('memilih Jaga di Beranda tidak menebak shift; shift yang sudah ada dipertahankan bila Jaga dipilih ulang', async () => {
    await setDayType('2026-11-14', 'jaga')
    expect((await day('2026-11-14'))?.jagaShift).toBeUndefined()
    await setJaga('2026-11-14', true, 'pagi')
    await setDayType('2026-11-14', 'jaga')
    expect((await day('2026-11-14'))?.jagaShift).toBe('pagi')
  })

  it('impor jaga dengan shift (kolom shift atau jenis jaga_pagi); tanpa shift = belum dipilih', async () => {
    await applyImport([
      { kind: 'jaga', date: '2026-11-14', shift: 'pagi' },
      { kind: 'jaga', date: '2026-11-21', shift: 'malam' },
      { kind: 'jaga', date: '2026-11-28' },
    ])
    expect((await day('2026-11-14'))?.jagaShift).toBe('pagi')
    expect((await day('2026-11-21'))?.jagaShift).toBe('malam')
    expect((await day('2026-11-28'))?.jagaShift).toBeUndefined()
    expect(await type('2026-11-22')).toBe('pasca')
    expect(await type('2026-11-15')).toBeNull()
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
