import { beforeEach, describe, expect, it } from 'vitest'
import { resetDatabase } from '../test/db-utils'
import { parseImport } from '../domain/importer'
import { db } from './db'
import { DEFAULT_ROLES } from './defaults'
import { applyImport } from './importer'
import { loadHabits, loadProfile } from './structure'

beforeEach(resetDatabase)

const TSV = [
  'jenis\ttipe_hari\ttanggal\thari\tjam\tsampai\tjudul\tperan\tmenit\tcatatan\tmulai\tselesai\tpulang',
  'ritme\tlibur\t\t\t07.00\t\tBelajar\tukmppd\t\t\t\t\t',
  'ritme\tlibur\t\t\t03.45\t\tQiyamul lail\tibadah\t\t\t\t\t',
  'habit\t\t\tSen, Rab, Jum\t\t\tLatihan beban\tpulih\t45\tBench 3x5\t\t\t',
  'tugas\t\t12/11\t\t\t\tPresentasi lapsus\tkoas\t\t\t\t\t',
  'jaga\t\t14/11\t\t\t\t\t\t\t\t\t\t',
  'stase\t\t\t\t\t\tStase Bedah\t\t\t\t2/11\t13/12\t16.00',
].join('\n')

const items = () =>
  parseImport(TSV, { roles: DEFAULT_ROLES, today: '2026-11-05' })
    .map((r) => r.item!)
    .filter(Boolean)

describe('impor ke database', () => {
  it('menulis semua jenis', async () => {
    const sum = await applyImport(items())
    expect(sum).toMatchObject({ ritme: 2, habitNew: 1, tugas: 1, jaga: 1, staseNew: 1 })
    const profile = await loadProfile()
    expect(profile.ritme.libur?.map((s) => s.title)).toEqual(['Qiyamul lail', 'Belajar'])
    expect(profile.ritme.stase?.[0].title).toBe('Qiyamul lail') // tipe lain tetap bawaan
    expect((await loadHabits()).find((h) => h.name === 'Latihan beban')).toMatchObject({
      weekdays: [1, 3, 5],
      minutes: 45,
      note: 'Bench 3x5',
    })
    expect((await db.days.get('#day:2026-11-14'))?.type).toBe('jaga')
    expect(await db.chapters.toArray()).toMatchObject([{ name: 'Stase Bedah', start: '2026-11-02', end: '2026-12-13', pulang: '16.00' }])
  })

  it('aman diulang: tidak ada yang dobel', async () => {
    await applyImport(items())
    const sum = await applyImport(items())
    expect(sum).toMatchObject({ habitNew: 0, habitUpdated: 1, tugas: 0, tugasSkipped: 1, staseNew: 0, staseUpdated: 1 })
    expect(await db.tasks.count()).toBe(1)
    expect(await db.chapters.count()).toBe(1)
    expect((await loadHabits()).filter((h) => h.name === 'Latihan beban')).toHaveLength(1)
  })
})
