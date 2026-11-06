import type { DayType, Exercise, Feel, ISODate, RunLog, StrengthEntry, TrainingTargets, Workout } from '../types'
import { formatNumber } from '../lib/format'
import { addDays, diffDays, weekStart } from './time'

const kgText = (n: number) => `${formatNumber(n, 2)} kg`

/**
 * Algoritma latihan Qawwam.
 *
 * Beban — double progression dengan autoregulasi:
 *  - Tiap gerakan punya rentang repetisi (mis. 3 set × 5–8).
 *  - Semua set mencapai batas atas dan tidak terasa "berat" → beban naik satu langkah.
 *  - Semua set ≥ batas bawah → beban tetap, tambah repetisi.
 *  - Gagal (set < batas bawah) 2× berturut di beban yang sama → turun 10%, bangun lagi.
 *  - e1RM (Epley) tidak naik ≥ 1% dalam 4 sesi → stagnan: deload satu sesi lalu ganti strategi.
 *  - Pasca-jaga / tidur < 5 j → sesi ringan (aturan Sleep Debt MBAPPE OS); hari jaga → ringan atau lewati.
 *
 * Lari — volume naik ≤ 10%/minggu, minggu ke-4 pemulihan (−25%), ±80% santai / 20% keras.
 * Pace dari perkiraan 5K (Riegel, pangkat 1,06). Perkiraan 5K tidak membaik 6 minggu → stagnan.
 */

export const DEFAULT_TARGETS: TrainingTargets = { benchKg: 100, fiveKSec: 30 * 60, tenKSec: 60 * 60 }

// ---------- Kekuatan ----------

/** e1RM Epley; 1 rep = beban aktual; di atas 12 rep perkiraan dibatasi agar tidak melambung. */
export function e1rm(kg: number, reps: number): number {
  if (reps <= 1) return kg
  return kg * (1 + Math.min(reps, 12) / 30)
}

export function entryE1rm(entry: Pick<StrengthEntry, 'sets'>): number {
  return entry.sets.reduce((best, s) => Math.max(best, e1rm(s.kg, s.reps)), 0)
}

export interface ExerciseSession {
  date: ISODate
  entry: StrengthEntry
  /** Beban kerja = beban terberat sesi itu. */
  workKg: number
  e1rm: number
}

/** Riwayat satu gerakan, urut tanggal. */
export function exerciseHistory(exerciseId: string, workouts: Workout[]): ExerciseSession[] {
  return workouts
    .filter((w) => w.kind === 'beban')
    .flatMap((w) => w.entries.filter((e) => e.exerciseId === exerciseId && e.sets.length).map((entry) => ({ date: w.date, entry })))
    .sort((a, b) => a.date.localeCompare(b.date))
    .map(({ date, entry }) => ({ date, entry, workKg: Math.max(...entry.sets.map((s) => s.kg)), e1rm: entryE1rm(entry) }))
}

/** Bulatkan ke kelipatan 1,25 kg (pelat terkecil umum di gym). */
export const roundLoad = (kg: number) => Math.max(0, Math.round(kg / 1.25) * 1.25)

export type Readiness = 'normal' | 'ringan-tidur' | 'ringan-pasca' | 'jaga'

/** Kesiapan hari ini dari tipe hari & total tidur. */
export function readiness(type: DayType | null, sleepTotal: number | null): Readiness {
  if (type === 'pasca') return 'ringan-pasca'
  if (type === 'jaga') return 'jaga'
  if (sleepTotal != null && sleepTotal < 5) return 'ringan-tidur'
  return 'normal'
}

export interface Plateau {
  stalled: boolean
  /** Perubahan e1RM per minggu dari regresi linear (kg/minggu). */
  slopePerWeek: number | null
}

/** Regresi linear sederhana: kemiringan y terhadap x. */
export function slope(points: { x: number; y: number }[]): number | null {
  if (points.length < 2) return null
  const n = points.length
  const mx = points.reduce((a, p) => a + p.x, 0) / n
  const my = points.reduce((a, p) => a + p.y, 0) / n
  const den = points.reduce((a, p) => a + (p.x - mx) ** 2, 0)
  if (den === 0) return null
  return points.reduce((a, p) => a + (p.x - mx) * (p.y - my), 0) / den
}

/** Stagnan: 4 sesi terakhir tidak melewati e1RM terbaik sebelumnya ≥ 1%, rentang ≥ 14 hari. */
export function strengthPlateau(history: ExerciseSession[]): Plateau {
  const recent = history.slice(-8)
  const first = recent[0]
  const s = first ? slope(recent.map((h) => ({ x: diffDays(h.date, first.date) / 7, y: h.e1rm }))) : null
  if (history.length < 6) return { stalled: false, slopePerWeek: s }
  const last4 = history.slice(-4)
  const before = history.slice(0, -4)
  const bestBefore = Math.max(...before.map((h) => h.e1rm))
  const bestRecent = Math.max(...last4.map((h) => h.e1rm))
  const span = diffDays(last4[last4.length - 1].date, last4[0].date)
  return { stalled: span >= 14 && bestRecent < bestBefore * 1.01, slopePerWeek: s }
}

export type StrengthAction = 'mulai' | 'naik' | 'tambah-rep' | 'ulang' | 'turun' | 'deload' | 'ringan' | 'lewati'

export interface Prescription {
  exerciseId: string
  action: StrengthAction
  kg: number | null
  sets: number
  repMin: number
  repMax: number
  reason: string
}

const isMiss = (s: ExerciseSession, ex: Pick<Exercise, 'repMin'>) => s.entry.sets.some((x) => x.kg >= s.workKg && x.reps < ex.repMin)

/** Resep sesi berikutnya untuk satu gerakan. */
export function prescribe(ex: Exercise, history: ExerciseSession[], ready: Readiness = 'normal'): Prescription {
  const base = { exerciseId: ex.id, sets: ex.sets, repMin: ex.repMin, repMax: ex.repMax }
  const last = history[history.length - 1]
  if (!last)
    return { ...base, action: 'mulai', kg: null, reason: `Pilih beban yang sanggup ${ex.repMax}–${ex.repMax + 2} rep dengan sisa 2–3 rep.` }
  const work = last.workKg
  if (ready === 'jaga')
    return { ...base, action: 'lewati', kg: null, sets: 0, reason: 'Hari jaga: simpan tenaga. Kalau tetap latihan, cukup ringan.' }
  if (ready === 'ringan-pasca' || ready === 'ringan-tidur')
    return {
      ...base,
      action: 'ringan',
      kg: roundLoad(work * 0.8),
      sets: Math.max(1, ex.sets - 1),
      repMax: ex.repMin,
      reason:
        ready === 'ringan-pasca'
          ? 'Pasca-jaga: teknik saja, 80% beban.'
          : 'Tidur < 5 jam: ringan (Sleep Debt), 80% beban, satu set lebih sedikit.',
    }

  // Dua kali gagal berturut di beban kerja yang sama → turun 10%.
  const prev = history[history.length - 2]
  if (prev && prev.workKg === work && isMiss(last, ex) && isMiss(prev, ex))
    return {
      ...base,
      action: 'turun',
      kg: roundLoad(work * 0.9),
      reason: `2× gagal mencapai ${ex.repMin} rep di ${kgText(work)}: turun 10% lalu bangun lagi.`,
    }

  // Stagnan → satu sesi deload (85%, set berkurang), kecuali sesi terakhir sudah deload.
  const plateau = strengthPlateau(history)
  const lastWasDeload = prev ? last.workKg < prev.workKg * 0.95 : false
  if (plateau.stalled && !lastWasDeload)
    return {
      ...base,
      action: 'deload',
      kg: roundLoad(work * 0.85),
      sets: Math.max(1, ex.sets - 1),
      reason: 'e1RM tidak naik dalam 4 sesi: deload satu sesi (85%), lalu lanjut. Cek juga tidur & protein.',
    }

  const workSets = last.entry.sets.filter((s) => s.kg >= work)
  const enoughSets = workSets.length >= ex.sets
  const allTop = enoughSets && workSets.every((s) => s.reps >= ex.repMax)
  const allMin = workSets.every((s) => s.reps >= ex.repMin)
  if (allTop && last.entry.feel !== 'berat')
    return {
      ...base,
      action: 'naik',
      kg: roundLoad(work + ex.increment),
      reason: `Semua set ${ex.repMax} rep: naik ${kgText(ex.increment)}, mulai lagi dari ${ex.repMin} rep.`,
    }
  if (allTop)
    return { ...base, action: 'ulang', kg: work, reason: 'Sudah batas atas tapi terasa berat: ulangi beban ini sampai terasa pas.' }
  if (allMin && enoughSets)
    return { ...base, action: 'tambah-rep', kg: work, reason: `Tetap ${kgText(work)}, tambah 1 rep di set yang belum ${ex.repMax}.` }
  return { ...base, action: 'ulang', kg: work, reason: `Ulangi ${kgText(work)}; targetkan semua set minimal ${ex.repMin} rep.` }
}

/** Perkiraan tanggal mencapai target e1RM dari tren mingguan (null bila datar/turun). */
export function projectTarget(
  history: ExerciseSession[],
  targetKg: number,
  today: ISODate,
): { best: number; weeks: number | null; date: ISODate | null } {
  const best = history.reduce((a, h) => Math.max(a, h.e1rm), 0)
  if (best >= targetKg) return { best, weeks: 0, date: today }
  const recent = history.filter((h) => diffDays(today, h.date) <= 56)
  const first = recent[0]
  const s = first ? slope(recent.map((h) => ({ x: diffDays(h.date, first.date) / 7, y: h.e1rm }))) : null
  if (s == null || s < 0.1) return { best, weeks: null, date: null }
  const weeks = Math.ceil((targetKg - best) / s)
  return { best, weeks, date: addDays(today, weeks * 7) }
}

// ---------- Lari ----------

/** Riegel: T2 = T1 × (D2/D1)^1,06. */
export function riegel(sec: number, fromKm: number, toKm: number): number {
  return sec * Math.pow(toKm / fromKm, 1.06)
}

export const pace = (r: Pick<RunLog, 'km' | 'sec'>) => r.sec / r.km

/** "31:05" / "1:02:30" ↔ detik. */
export function formatDuration(sec: number): string {
  const s = Math.round(sec)
  const h = Math.floor(s / 3600)
  const m = Math.floor((s % 3600) / 60)
  const r = s % 60
  return h ? `${h}:${String(m).padStart(2, '0')}:${String(r).padStart(2, '0')}` : `${m}:${String(r).padStart(2, '0')}`
}

/**
 * Format durasi saat diketik di papan angka HP (tanpa titik dua), diisi dari kanan seperti
 * microwave: "3120" → "31:20", "312" → "3:12", "13045" → "1:30:45". Angka ≤ 2 digit = menit.
 */
export function typeDuration(raw: string): string {
  const d = raw
    .replace(/\D/g, '')
    .replace(/^0+(?=\d{3})/, '')
    .slice(0, 6)
  if (d.length <= 2) return d
  if (d.length <= 4) return `${d.slice(0, -2)}:${d.slice(-2)}`
  return `${d.slice(0, -4)}:${d.slice(-4, -2)}:${d.slice(-2)}`
}

export function parseDuration(text: string): number | null {
  const parts = text.trim().replace(/\./g, ':').split(':').filter(Boolean).map(Number)
  if (!parts.length || parts.length > 3 || parts.some((p) => Number.isNaN(p) || p < 0)) return null
  const sec =
    parts.length === 1 ? parts[0] * 60 : parts.length === 2 ? parts[0] * 60 + parts[1] : parts[0] * 3600 + parts[1] * 60 + parts[2]
  return sec > 0 ? sec : null
}

export interface RunEntry {
  date: ISODate
  run: RunLog
}

export const runsOf = (workouts: Workout[]): RunEntry[] =>
  workouts
    .filter((w) => w.kind === 'lari' && w.run && w.run.km > 0 && w.run.sec > 0)
    .map((w) => ({ date: w.date, run: w.run! }))
    .sort((a, b) => a.date.localeCompare(b.date))

/** Perkiraan 5K terbaik dari lari keras (tes/kualitas) 3–21 km dalam `days` hari terakhir. */
export function estimate5k(runs: RunEntry[], today: ISODate, days = 42): number | null {
  const pool = runs.filter(
    (r) =>
      (r.run.type === 'tes' || r.run.type === 'kualitas') &&
      r.run.km >= 3 &&
      r.run.km <= 21.1 &&
      diffDays(today, r.date) < days &&
      diffDays(today, r.date) >= 0,
  )
  if (!pool.length) return null
  return Math.min(...pool.map((r) => riegel(r.run.sec, r.run.km, 5)))
}

export function weeklyKm(runs: RunEntry[], monday: ISODate): number {
  const end = addDays(monday, 6)
  return Math.round(runs.filter((r) => r.date >= monday && r.date <= end).reduce((a, r) => a + r.run.km, 0) * 10) / 10
}

export interface RunPlan {
  targetKm: number
  recovery: boolean
  easyRuns: number
  qualityRuns: number
  /** Pace santai & tempo (detik/km) dari perkiraan 5K. */
  easyPace: [number, number] | null
  tempoPace: [number, number] | null
  est5k: number | null
  hardShare: number | null
  stalled: boolean
  notes: string[]
}

/**
 * Rencana lari minggu ini: naik ≤ 10% (maks +5 km), tiap minggu ke-4 setelah 3 minggu naik → pemulihan −25%.
 * Minggu dengan ≥ 2 jaga → volume ditahan. Cek 80/20 dan stagnasi 5K.
 */
export function planRunWeek(runs: RunEntry[], today: ISODate, jagaThisWeek: number, fallback5k: number | null = null): RunPlan {
  const monday = weekStart(today)
  const prev = [1, 2, 3, 4].map((i) => weeklyKm(runs, addDays(monday, -7 * i))) // [w-1, w-2, w-3, w-4]
  const last = prev[0]
  const built3 = prev[0] > prev[1] && prev[1] > prev[2] && prev[2] > 0
  const notes: string[] = []
  let targetKm: number
  let recovery = false
  if (last === 0) {
    targetKm = Math.max(8, Math.round(prev.find((k) => k > 0) ?? 8))
    notes.push('Mulai pelan: 2–3 lari santai.')
  } else if (built3) {
    targetKm = Math.round(last * 0.75 * 10) / 10
    recovery = true
    notes.push('Minggu pemulihan: 3 minggu naik berturut, volume −25%.')
  } else if (jagaThisWeek >= 2) {
    targetKm = last
    notes.push(`${jagaThisWeek} jaga minggu ini: volume ditahan, tidak naik.`)
  } else {
    targetKm = Math.round(Math.min(last * 1.1, last + 5) * 10) / 10
  }

  const recent = runs.filter((r) => diffDays(today, r.date) < 14 && diffDays(today, r.date) >= 0)
  const total = recent.reduce((a, r) => a + r.run.km, 0)
  const hard = recent.filter((r) => r.run.type === 'kualitas' || r.run.type === 'tes').reduce((a, r) => a + r.run.km, 0)
  const hardShare = total > 0 ? hard / total : null
  // Baru dinilai setelah ≥ 3 lari, agar satu tes saja tidak memicu peringatan.
  if (recent.length >= 3 && hardShare != null && hardShare > 0.3)
    notes.push('Lari keras > 30% dua minggu terakhir: tambah porsi santai (pola 80/20).')

  const est = estimate5k(runs, today) ?? fallback5k
  const per = est ? est / 5 : null
  // Stagnan: perkiraan 5K 3 minggu terakhir tidak lebih baik ≥ 1% dari minggu 4–8.
  const recentEst = estimate5k(runs, today, 21)
  const olderEst = estimate5k(
    runs.filter((r) => diffDays(today, r.date) >= 21),
    today,
    56,
  )
  const stalled = recentEst != null && olderEst != null && recentEst > olderEst * 0.99
  if (stalled) notes.push('Perkiraan 5K tidak membaik: tambah 1 sesi tempo 20 menit, atau naikkan volume santai 10%.')

  const quality = recovery || jagaThisWeek >= 2 ? 0 : 1
  return {
    targetKm,
    recovery,
    easyRuns: targetKm >= 15 ? 3 : 2,
    qualityRuns: quality,
    easyPace: per ? [per + 60, per + 90] : null,
    tempoPace: per ? [per + 15, per + 30] : null,
    est5k: est,
    hardShare,
    stalled,
    notes,
  }
}

/** Menit:detik per km, mis. "6:12". */
export const formatPace = (secPerKm: number) => formatDuration(secPerKm)

/** Rasa set terakhir dalam kata. */
export const FEEL_LABELS: Record<Feel, string> = { ringan: 'Ringan (sisa ≥3)', pas: 'Pas (sisa ±2)', berat: 'Berat (sisa 0–1)' }
