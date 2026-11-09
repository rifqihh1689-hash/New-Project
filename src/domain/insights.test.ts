import { describe, expect, it } from 'vitest'
import { pickInsights, type InsightInput } from './insights'

const base: InsightInput = {
  today: '2026-11-10', // Selasa
  dayType: 'stase',
  ritmeLine: 'Hari stase. Pulang ±14.00, qailulah dulu.',
  sleep: [6.2, 6.1, null],
  level: { level: 1, into: 100, need: 200 },
  streak: { current: 1, best: 1 },
  tentir: { hours: 5, min: 9, max: 15 },
  money: { expense: 500_000, budget: 2_000_000 },
  savings: [
    { name: 'Dana jembatan', kind: 'jembatan', saved: 3_000_000, target: 15_000_000, perMonth: 1_000_000, depositedThisMonth: true },
  ],
  mutabaah: [{ name: 'Tilawah', week: 3 }],
  daysSinceStrength: 2,
  nextChapter: null,
  milestone: null,
  study: null,
  reviewOpen: false,
}

const ids = (x: Partial<InsightInput>) => pickInsights({ ...base, ...x }).map((i) => i.id)
const text = (x: Partial<InsightInput>) =>
  pickInsights({ ...base, ...x })
    .map((i) => `${i.title} ${i.detail ?? ''}`)
    .join(' ')

describe('pickInsights', () => {
  it('tidur kurang paling depan', () => {
    expect(ids({ sleep: [5, 5.5, 5], streak: { current: 4, best: 4 } })[0]).toBe('tidur-kurang')
  })

  it('pasca/jaga: hanya pemulihan dan ritme, tanpa uang/tentir', () => {
    expect(ids({ dayType: 'pasca', money: { expense: 3_000_000, budget: 1_000_000 } })).toEqual(['ritme'])
    expect(ids({ dayType: null })[0]).toBe('ritme')
  })

  it('stase baru dalam seminggu, level hampir naik, muhasabah terbuka', () => {
    const r = ids({
      nextChapter: { name: 'THT', start: '2026-11-16', weight: 'ringan' },
      level: { level: 1, into: 180, need: 200 },
      reviewOpen: true,
    })
    expect(r.slice(0, 3)).toEqual(['stase-baru', 'level', 'muhasabah'])
    expect(text({ nextChapter: { name: 'THT', start: '2026-11-16', weight: 'ringan' } })).toContain('Stase ringan')
  })

  it('belanja terlalu cepat dibanding hari berjalan', () => {
    expect(ids({ money: { expense: 1_600_000, budget: 2_000_000 } })).toContain('anggaran-cepat')
    expect(ids({ money: { expense: 2_100_000, budget: 2_000_000 } })).toContain('anggaran-lewat')
    expect(ids({})).not.toContain('anggaran-cepat')
  })

  it('tentir: kurang hanya diingatkan menjelang akhir minggu; lewat batas selalu', () => {
    expect(ids({})).not.toContain('tentir-kurang') // Selasa: masih 6 hari
    expect(ids({ today: '2026-11-13' })).toContain('tentir-kurang') // Jumat
    expect(ids({ tentir: { hours: 16, min: 9, max: 15 } })).toContain('tentir-lewat')
  })

  it('tabungan: belum ada dana jembatan, atau belum setor menjelang akhir bulan', () => {
    expect(ids({ savings: [] })).toContain('jembatan-belum')
    const s = [{ ...base.savings[0], depositedThisMonth: false }]
    expect(ids({ savings: s, today: '2026-11-21' })).toContain('jembatan-setor')
  })

  it('tidak pernah membahas utang', () => {
    const all = text({ savings: [], money: { expense: 3_000_000, budget: 1_000_000 }, today: '2026-11-21' })
    expect(all.toLowerCase()).not.toMatch(/utang|cicil/)
  })

  it('tanggal penting dari fase hidup', () => {
    const r = pickInsights({ ...base, milestone: { name: 'UKMPPD', date: '2028-02-01' } }).find((i) => i.id === 'milestone')
    expect(r?.title).toBe('UKMPPD 64 minggu lagi.')
    expect(r?.detail).toBe('1 Februari 2028')
  })

  it('belajar: tertinggal, terlemah, dan tanggal ujian belum diisi', () => {
    const study = {
      weekDone: 20,
      weekTarget: 150,
      behind: true,
      perDayLeft: 26,
      weakest: { system: 'Saraf', accuracy: 0.5 },
      examDateSet: false,
      cardsDue: 12,
    }
    const r = pickInsights({ ...base, study })
    expect(r.map((x) => x.id)).toEqual(
      expect.arrayContaining(['kartu-jatuh-tempo', 'belajar-tertinggal', 'belajar-lemah', 'belajar-tanggal']),
    )
    expect(r.find((x) => x.id === 'belajar-lemah')?.title).toBe('Saraf sistem terlemahmu (50%).')
    expect(ids({ study: { ...study, behind: false, weekDone: 150 } })).toContain('belajar-tercapai')
  })
})
