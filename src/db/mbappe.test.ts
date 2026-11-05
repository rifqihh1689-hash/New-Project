import { beforeEach, describe, expect, it } from 'vitest'
import fixture from '../test/fixtures/mbappe-os.json'
import { convertMbappe, parseMbappe } from '../domain/mbappe'
import { resetDatabase } from '../test/db-utils'
import { loadAllResults, setDayType } from './daily'
import { db } from './db'
import { DEFAULT_ROLES } from './defaults'
import { applyMbappe } from './mbappe'
import { loadHabits, loadMutabaah } from './structure'

const plan = () => convertMbappe(parseMbappe(JSON.stringify(fixture))!, DEFAULT_ROLES, 1)

beforeEach(resetDatabase)

describe('impor MBAPPE OS ke database', () => {
  it('menulis semua bagian dan XP lama ikut terhitung', async () => {
    const sum = await applyMbappe(plan())
    expect(sum).toMatchObject({ days: 7, daysSkipped: 0, chapters: 2, mainQuests: 3, reviews: 1, money: 2 })
    expect((await loadHabits()).some((h) => h.name === 'Beban sore (bench + compound)')).toBe(true)
    expect((await loadMutabaah()).some((m) => m.name === 'Tadabbur 10 ayat')).toBe(true)
    const { results } = await loadAllResults('2026-11-05')
    const frozenXp = [...results.entries()].filter(([d]) => d <= '2026-11-03').reduce((a, [, r]) => a + r.xp, 0)
    expect(frozenXp).toBe(432)
  })

  it('data Qawwam menang dan impor aman diulang', async () => {
    await setDayType('2026-11-04', 'libur') // sudah diisi di Qawwam
    const first = await applyMbappe(plan())
    expect(first).toMatchObject({ days: 6, daysSkipped: 1 })
    expect((await db.days.get('#day:2026-11-04'))?.type).toBe('libur')
    const again = await applyMbappe(plan())
    expect(again).toMatchObject({ days: 0, daysSkipped: 7, habits: 0, habitLogs: 0, reviews: 0 })
  })
})
