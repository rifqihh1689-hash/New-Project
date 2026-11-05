import type { Exercise, Muscle, TrainingSplit, Workout } from '../types'

export const MUSCLE_LABELS: Record<Muscle, string> = {
  dada: 'Dada',
  bahu: 'Bahu',
  punggung: 'Punggung',
  kaki: 'Kaki & glute',
  bisep: 'Bisep',
  trisep: 'Trisep',
  inti: 'Inti (core)',
}

export interface CatalogItem {
  name: string
  muscle: Muscle
  repMin: number
  repMax: number
  sets: number
  increment: number
}

const c = (name: string, muscle: Muscle, repMin: number, repMax: number, sets = 3, increment?: number): CatalogItem => ({
  name,
  muscle,
  repMin,
  repMax,
  sets,
  increment: increment ?? (muscle === 'kaki' ? 5 : muscle === 'bisep' || muscle === 'trisep' || muscle === 'bahu' ? 1.25 : 2.5),
})

/**
 * Pustaka gerakan berbeban (barbel, dumbel, kabel, mesin) supaya program tidak monoton.
 * Gerakan inti (compound) memakai rentang rep rendah, aksesori lebih tinggi.
 */
export const EXERCISE_CATALOG: CatalogItem[] = [
  c('Incline bench press', 'dada', 6, 10),
  c('Dumbbell bench press', 'dada', 8, 12),
  c('Incline dumbbell press', 'dada', 8, 12),
  c('Weighted dips', 'dada', 6, 10),
  c('Cable / dumbbell fly', 'dada', 10, 15, 3, 1.25),
  c('Close-grip bench press', 'trisep', 6, 10, 3, 2.5),
  c('Dumbbell shoulder press', 'bahu', 8, 12),
  c('Lateral raise', 'bahu', 12, 20),
  c('Face pull', 'bahu', 12, 20),
  c('Rear delt fly', 'bahu', 12, 20),
  c('Seated cable row', 'punggung', 8, 12),
  c('One-arm dumbbell row', 'punggung', 8, 12),
  c('Chin-up (beban tambahan)', 'punggung', 5, 8),
  c('Chest-supported row', 'punggung', 8, 12),
  c('Front squat', 'kaki', 5, 8),
  c('Romanian deadlift', 'kaki', 6, 10),
  c('Leg press', 'kaki', 8, 15),
  c('Bulgarian split squat', 'kaki', 8, 12, 3, 2.5),
  c('Hip thrust', 'kaki', 8, 12),
  c('Walking lunge', 'kaki', 10, 16, 3, 2.5),
  c('Leg curl', 'kaki', 10, 15, 3, 2.5),
  c('Leg extension', 'kaki', 10, 15, 3, 2.5),
  c('Calf raise', 'kaki', 10, 20, 3, 2.5),
  c('Barbell curl', 'bisep', 8, 12),
  c('Hammer curl', 'bisep', 10, 15),
  c('Triceps pushdown', 'trisep', 10, 15),
  c('Overhead triceps extension', 'trisep', 10, 15),
  c('Cable crunch', 'inti', 10, 15, 3, 2.5),
  c('Hanging leg raise (beban)', 'inti', 8, 15, 3, 1.25),
]

/** Otot gerakan; data lama tanpa `muscle` dianggap dada (atas) atau kaki (bawah). */
export const muscleOf = (ex: Pick<Exercise, 'muscle' | 'group'>): Muscle => ex.muscle ?? (ex.group === 'lower' ? 'kaki' : 'dada')
export const groupOf = (m: Muscle): Exercise['group'] => (m === 'kaki' ? 'lower' : 'upper')

export const SPLITS: Record<TrainingSplit, { label: string; days: string[]; hint: string }> = {
  fullbody: { label: 'Full body', days: ['Semua'], hint: 'Semua gerakan tiap sesi. Cocok 2–3× seminggu.' },
  'atas-bawah': { label: 'Atas / Bawah', days: ['Atas', 'Bawah'], hint: 'Bergantian badan atas & kaki. Cocok 3–4× seminggu.' },
  ppl: { label: 'Push / Pull / Kaki', days: ['Push', 'Pull', 'Kaki'], hint: 'Dorong, tarik, kaki bergiliran. Cocok 3–6× seminggu.' },
}

/** Apakah gerakan masuk hari program tertentu. Inti (core) ikut di semua hari. */
export function inDay(ex: Pick<Exercise, 'muscle' | 'group'>, split: TrainingSplit, day: string): boolean {
  const m = muscleOf(ex)
  if (split === 'fullbody' || m === 'inti') return true
  if (split === 'atas-bawah') return day === 'Bawah' ? m === 'kaki' : m !== 'kaki'
  if (day === 'Push') return m === 'dada' || m === 'bahu' || m === 'trisep'
  if (day === 'Pull') return m === 'punggung' || m === 'bisep'
  return m === 'kaki'
}

/** Hari berikutnya: setelah hari sesi beban terakhir (urut tanggal), atau hari pertama. */
export function nextDay(split: TrainingSplit, workouts: Pick<Workout, 'kind' | 'day' | 'date' | 'createdAt'>[]): string {
  const days = SPLITS[split].days
  const last = [...workouts]
    .filter((w) => w.kind === 'beban' && w.day && days.includes(w.day))
    .sort((a, b) => a.date.localeCompare(b.date) || a.createdAt - b.createdAt)
    .pop()
  return last ? days[(days.indexOf(last.day!) + 1) % days.length] : days[0]
}

/** Variasi dari katalog untuk otot yang sama (yang belum ada di daftar), untuk mengganti gerakan yang stagnan/bosan. */
export function variationsFor(ex: Pick<Exercise, 'muscle' | 'group' | 'name'>, existing: Pick<Exercise, 'name'>[]): CatalogItem[] {
  const have = new Set(existing.map((e) => e.name.toLowerCase()))
  return EXERCISE_CATALOG.filter((c) => c.muscle === muscleOf(ex) && !have.has(c.name.toLowerCase()))
}
