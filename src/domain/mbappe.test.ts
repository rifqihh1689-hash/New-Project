import { describe, expect, it } from 'vitest'
import fixture from '../test/fixtures/mbappe-os.json'
import { DEFAULT_ROLES } from '../db/defaults'
import { convertMbappe, parseMbappe } from './mbappe'

const data = parseMbappe(JSON.stringify(fixture))!

describe('konversi MBAPPE OS', () => {
  it('mengenali file export dan menolak file lain', () => {
    expect(data).not.toBeNull()
    expect(parseMbappe('{"app":"dompetku","data":{}}')).toBeNull()
    expect(parseMbappe('bukan json')).toBeNull()
  })

  const plan = convertMbappe(data, DEFAULT_ROLES, 1)

  it('hari: tipe, tidur, dan hasil beku ikut; XP lama terbawa', () => {
    expect(plan.days).toHaveLength(7)
    expect(plan.stats.frozenDays).toBe(6)
    expect(plan.stats.totalXp).toBe(432 + 50) // 6 hari beku + 1 Raid
    const jaga = plan.days.find((d) => d.type === 'jaga')!
    expect(jaga.frozen?.effType).toBe('jaga')
    const first = plan.days.find((d) => d.date === '2026-10-29')!
    expect(first).toMatchObject({ id: '#day:2026-10-29', type: 'stase', sleepNight: 5.5, nap: 1, workEnd: 'ok', note: '' })
    expect(first.frozen).toMatchObject({ xp: 114, pass: true, mult: 1.2, effType: 'stase' })
  })

  it('catatan berisi identitas pasien tidak diimpor', () => {
    expect(plan.stats.notesDropped).toBe(1)
  })

  it('quest jadi habit; padanan bawaan dipakai, quest khusus & mingguan dilewati', () => {
    const ids = plan.habits.map((h) => h.id)
    expect(ids).toContain('#mbp:habit:q_lift')
    expect(ids).not.toContain('#mbp:habit:q_sleep') // pakai #habit:sleep
    expect(ids).not.toContain('#mbp:habit:j_nap') // pakai #habit:jaga-nap
    expect(ids).not.toContain('#mbp:habit:q_tentir')
    expect(plan.stats.weeklyQuests).toEqual(['Setor Dana Jembatan', '1 post edukasi'])
    expect(plan.habits.find((h) => h.id === '#mbp:habit:q_lift')).toMatchObject({
      weekdays: [1, 3, 5],
      size: 'besar',
      roleId: '#role:pulih',
      dayTypes: ['stase', 'libur'],
    })
    expect(plan.habits.find((h) => h.id === '#mbp:habit:q_drill')?.roleId).toBe('#role:ukmppd')
    expect(plan.habits.find((h) => h.id === '#mbp:habit:q_referat')?.roleId).toBe('#role:koas')
  })

  it('log habit & mutabaah; Tahajjud disatukan dengan Qiyamul lail', () => {
    expect(plan.habitLogs.some((l) => l.habitId === '#habit:sleep')).toBe(false) // otomatis, tanpa log
    expect(plan.mutabaah.map((m) => m.name)).toEqual(['Tadabbur 10 ayat'])
    expect(plan.mutabaahLogs.filter((l) => l.itemId === '#mut:qiyam')).toHaveLength(7)
  })

  it('stase, Main Quest, Raid → Muhasabah, keuangan', () => {
    expect(plan.chapters.map((c) => c.name)).toEqual(['Contoh: Stase Neurologi', 'Contoh: Stase IPD'])
    expect(plan.mainQuests.map((q) => q.status)).toEqual(['aktif', 'aktif', 'beku'])
    const raid = plan.reviews.find((r) => r.completedAt)!
    expect(raid).toMatchObject({
      start: '2026-10-26',
      xp: 50,
      priorities: ['Kirim draf protokol SR', 'Tidur ≥6 jam di 5 malam non-jaga', '3 sesi tentir selesai ≤21.00'],
    })
    expect(raid.numbers.xp).toBe(276)
    expect(plan.debts[0]).toMatchObject({ initial: 25_000_000, payments: [{ amount: 1_200_000 }] })
    expect(plan.savings[0]).toMatchObject({ target: 10_000_000, deposits: [{ amount: 2_600_000 }] })
    expect(plan.stats.notImported).toEqual(expect.arrayContaining(['log latihan (bench/lari)', 'hadiah', 'jam tentir harian']))
  })

  it('data contoh MBAPPE dilewati', () => {
    const withSample = JSON.parse(JSON.stringify(fixture))
    for (const d of Object.values(withSample.days) as { sample?: boolean }[]) d.sample = true
    const p = convertMbappe(withSample, DEFAULT_ROLES, 1)
    expect(p.days).toHaveLength(0)
    expect(p.stats.skippedSample).toBe(7)
  })
})
