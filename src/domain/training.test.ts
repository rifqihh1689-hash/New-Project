import { describe, expect, it } from 'vitest'
import type { Exercise, Feel, StrengthSet, Workout } from '../types'
import { addDays } from './time'
import {
  e1rm,
  estimate5k,
  exerciseHistory,
  formatDuration,
  parseDuration,
  typeDuration,
  planRunWeek,
  prescribe,
  projectTarget,
  readiness,
  riegel,
  runsOf,
  strengthPlateau,
} from './training'

const bench: Exercise = {
  id: '#ex:bench',
  name: 'Bench press',
  group: 'upper',
  repMin: 5,
  repMax: 8,
  sets: 3,
  increment: 2.5,
  archived: false,
  order: 1,
  createdAt: 0,
  updatedAt: 0,
}
const w = (date: string, sets: StrengthSet[], feel: Feel = 'pas'): Workout => ({
  id: date,
  date,
  kind: 'beban',
  entries: [{ exerciseId: bench.id, sets, feel }],
  run: null,
  note: '',
  createdAt: 0,
  updatedAt: 0,
})
const x3 = (kg: number, ...reps: number[]) => reps.map((r) => ({ kg, reps: r }))
const hist = (...ws: Workout[]) => exerciseHistory(bench.id, ws)

describe('e1RM & kesiapan', () => {
  it('Epley, 1 rep = beban aktual, dibatasi 12 rep', () => {
    expect(e1rm(60, 5)).toBe(70)
    expect(e1rm(100, 1)).toBe(100)
    expect(e1rm(50, 20)).toBe(e1rm(50, 12))
  })
  it('tipe hari & tidur', () => {
    expect(readiness('pasca', 7)).toBe('ringan-pasca')
    expect(readiness('jaga', 7)).toBe('jaga')
    expect(readiness('stase', 4.5)).toBe('ringan-tidur')
    expect(readiness('stase', 6)).toBe('normal')
  })
})

describe('double progression', () => {
  it('belum ada riwayat → mulai', () => {
    expect(prescribe(bench, []).action).toBe('mulai')
  })
  it('semua set 8 rep & terasa pas → naik 2,5 kg, mulai dari 5 rep', () => {
    const p = prescribe(bench, hist(w('2026-11-02', x3(60, 8, 8, 8))))
    expect(p).toMatchObject({ action: 'naik', kg: 62.5, repMin: 5, repMax: 8 })
  })
  it('batas atas tapi berat → ulangi beban', () => {
    expect(prescribe(bench, hist(w('2026-11-02', x3(60, 8, 8, 8), 'berat'))).action).toBe('ulang')
  })
  it('semua ≥ 5 rep tapi belum 8 → tambah rep', () => {
    expect(prescribe(bench, hist(w('2026-11-02', x3(60, 7, 6, 6))))).toMatchObject({ action: 'tambah-rep', kg: 60 })
  })
  it('2× gagal di beban yang sama → turun 10% (dibulatkan 1,25 kg)', () => {
    const p = prescribe(bench, hist(w('2026-10-30', x3(60, 5, 4, 4)), w('2026-11-02', x3(60, 5, 4, 3))))
    expect(p).toMatchObject({ action: 'turun', kg: 53.75 })
  })
  it('pasca-jaga / kurang tidur → ringan 80%, satu set lebih sedikit; jaga → lewati', () => {
    const h = hist(w('2026-11-02', x3(60, 8, 8, 8)))
    expect(prescribe(bench, h, 'ringan-pasca')).toMatchObject({ action: 'ringan', kg: 47.5, sets: 2 })
    expect(prescribe(bench, h, 'ringan-tidur').action).toBe('ringan')
    expect(prescribe(bench, h, 'jaga')).toMatchObject({ action: 'lewati', sets: 0 })
  })
})

describe('deteksi stagnan', () => {
  const start = '2026-09-01'
  const sessions = (e: number[]) => e.map((reps, i) => w(addDays(start, i * 5), x3(70, reps, reps, reps)))

  it('naik terus → tidak stagnan', () => {
    const h = hist(
      ...sessions([5, 5, 6, 6, 7, 7, 8, 8]).map((s, i) => ({ ...s, entries: [{ ...s.entries[0], sets: x3(60 + i * 2.5, 6, 6, 6) }] })),
    )
    expect(strengthPlateau(h).stalled).toBe(false)
  })

  it('4 sesi terakhir tidak melewati rekor ≥ 1% selama ≥ 14 hari → stagnan → deload 85%', () => {
    const h = hist(...sessions([6, 7, 7, 7, 6, 7, 6, 7]))
    expect(strengthPlateau(h).stalled).toBe(true)
    expect(prescribe(bench, h)).toMatchObject({ action: 'deload', kg: 60, sets: 2 })
  })
})

describe('proyeksi target', () => {
  it('tren naik 2,5 kg/minggu → perkiraan tanggal mencapai 100 kg', () => {
    const ws = Array.from({ length: 6 }, (_, i) => w(addDays('2026-10-01', i * 7), [{ kg: 60 + i * 2.5, reps: 5 }]))
    const p = projectTarget(hist(...ws), 100, '2026-11-05')
    expect(p.best).toBeCloseTo(84.58, 1)
    expect(p.weeks).toBe(Math.ceil((100 - p.best) / (2.5 * (1 + 5 / 30))))
    expect(p.date).not.toBeNull()
  })
  it('datar → tidak ada perkiraan tanggal', () => {
    const ws = Array.from({ length: 6 }, (_, i) => w(addDays('2026-10-01', i * 7), [{ kg: 60, reps: 5 }]))
    expect(projectTarget(hist(...ws), 100, '2026-11-05')).toMatchObject({ weeks: null, date: null })
  })
})

describe('lari', () => {
  const run = (date: string, km: number, sec: number, type: 'easy' | 'long' | 'kualitas' | 'tes' = 'easy'): Workout => ({
    id: date + km,
    date,
    kind: 'lari',
    entries: [],
    run: { km, sec, type },
    note: '',
    createdAt: 0,
    updatedAt: 0,
  })

  it('Riegel & format waktu', () => {
    expect(Math.round(riegel(1860, 5, 10))).toBe(3878)
    expect(formatDuration(1860)).toBe('31:00')
    expect(formatDuration(3878)).toBe('1:04:38')
    expect(parseDuration('31:05')).toBe(1865)
    expect(parseDuration('1:02:30')).toBe(3750)
    expect(parseDuration('abc')).toBeNull()
  })

  it('waktu lari diketik di papan angka tanpa titik dua', () => {
    const typed = (keys: string) => [...keys].reduce((text, k) => typeDuration(text + k), '')
    expect(typed('3120')).toBe('31:20')
    expect(typed('312')).toBe('3:12')
    expect(typed('13045')).toBe('1:30:45')
    expect(typed('31')).toBe('31')
    expect(typeDuration('31.05')).toBe('31:05')
    expect(parseDuration(typed('3105'))).toBe(1865)
    expect(parseDuration(typed('31'))).toBe(1860)
  })

  it('perkiraan 5K hanya dari lari keras 3–21 km', () => {
    const runs = runsOf([run('2026-11-01', 5, 1860, 'tes'), run('2026-11-02', 8, 3600, 'easy')])
    expect(estimate5k(runs, '2026-11-05')).toBe(1860)
    expect(estimate5k(runsOf([run('2026-11-02', 8, 3600, 'easy')]), '2026-11-05')).toBeNull()
  })

  it('naik ≤ 10%, pace santai & tempo dari 5K', () => {
    const runs = runsOf([run('2026-10-27', 5, 1860, 'tes'), run('2026-10-29', 5, 2200), run('2026-10-31', 5, 2200)])
    const p = planRunWeek(runs, '2026-11-05', 0)
    expect(p.targetKm).toBe(16.5) // 15 km × 1,1
    expect(p.easyPace).toEqual([432, 462]) // 6:12/km + 60–90 detik
    expect(p.tempoPace).toEqual([387, 402])
    expect(p.qualityRuns).toBe(1)
  })

  it('3 minggu naik → minggu pemulihan −25%; 2 jaga → ditahan', () => {
    const runs = runsOf([run('2026-10-13', 10, 4200), run('2026-10-20', 11, 4600), run('2026-10-27', 12, 5000)])
    expect(planRunWeek(runs, '2026-11-05', 0)).toMatchObject({ recovery: true, targetKm: 9, qualityRuns: 0 })
    const flat = runsOf([run('2026-10-27', 12, 5000)])
    expect(planRunWeek(flat, '2026-11-05', 2)).toMatchObject({ targetKm: 12, qualityRuns: 0 })
  })

  it('terlalu banyak lari keras → catatan 80/20', () => {
    const runs = runsOf([run('2026-11-01', 5, 1800, 'kualitas'), run('2026-11-03', 5, 1800, 'tes'), run('2026-11-04', 3, 1300)])
    expect(planRunWeek(runs, '2026-11-05', 0).notes.join(' ')).toMatch(/80\/20/)
  })
})
