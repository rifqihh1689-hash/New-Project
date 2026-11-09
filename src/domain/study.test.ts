import { describe, expect, it } from 'vitest'
import { countdown, recentWeeklyAverage, stalestSystem, systemStats, weakestSystem, weekProgress } from './study'

const log = (date: string, system: string, total: number, correct: number) => ({ date, system, total, correct })

describe('belajar UKMPPD', () => {
  const logs = [
    log('2026-11-02', 'Kardiovaskular', 40, 30),
    log('2026-11-03', 'Kardiovaskular', 20, 10),
    log('2026-11-04', 'Saraf', 30, 15),
    log('2026-11-05', 'THT', 10, 2), // belum cukup untuk peringkat
  ]

  it('statistik per sistem dan sistem terlemah (minimal 20 soal)', () => {
    const stats = systemStats(logs)
    const cardio = stats.find((s) => s.system === 'Kardiovaskular')!
    expect(cardio).toMatchObject({ total: 60, correct: 40, lastDate: '2026-11-03' })
    expect(cardio.accuracy).toBeCloseTo(0.667, 2)
    expect(stats.find((s) => s.system === 'Mata')).toMatchObject({ total: 0, accuracy: null })
    expect(weakestSystem(stats)?.system).toBe('Saraf') // THT 20% diabaikan: baru 10 soal
  })

  it('sistem yang paling lama tidak disentuh', () => {
    const stats = systemStats(logs)
    // Semua yang belum pernah disentuh didahulukan, urut abjad.
    expect(stalestSystem(stats)?.system).toBe('Anak')
  })

  it('progres minggu ini: jatah per hari dan status tertinggal', () => {
    // Rabu 4 Nov: 20 soal dari target 150; seharusnya sudah ±43 → tertinggal. Sisa 130 soal / 5 hari (Rab–Min).
    const w = weekProgress([log('2026-11-02', 'Saraf', 20, 10)], '2026-11-04', 150)
    expect(w).toMatchObject({ done: 20, target: 150, behind: true, perDayLeft: 26 })
    // Sesuai jalur: tidak tertinggal; target tercapai: jatah 0.
    expect(weekProgress([log('2026-11-02', 'Saraf', 60, 30)], '2026-11-04', 150).behind).toBe(false)
    expect(weekProgress([log('2026-11-02', 'Saraf', 150, 30)], '2026-11-04', 150).perDayLeft).toBe(0)
    // Awal minggu tidak pernah dianggap tertinggal.
    expect(weekProgress([], '2026-11-02', 150).behind).toBe(false)
  })

  it('rata-rata 4 minggu penuh terakhir tidak menghitung minggu berjalan', () => {
    const l = [
      log('2026-11-02', 'Saraf', 999, 0),
      log('2026-10-27', 'Saraf', 100, 0),
      log('2026-10-06', 'Saraf', 60, 0),
      log('2026-10-05', 'Saraf', 40, 0),
    ]
    expect(recentWeeklyAverage(l, '2026-11-04')).toBe(50) // 999 (minggu berjalan) tidak ikut; (100+60+40)/4
  })

  it('hitung mundur ke ujian', () => {
    expect(countdown(null, '2026-11-09')).toBeNull()
    expect(countdown('2026-11-08', '2026-11-09')).toBeNull()
    expect(countdown('2028-02-01', '2026-11-09', 1000, 6000)).toMatchObject({ days: 449, weeks: 65, weeklyNeeded: 77 })
  })
})
