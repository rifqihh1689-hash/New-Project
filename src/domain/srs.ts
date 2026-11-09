import { addDays } from './time'
import type { Flashcard, ISODate } from '../types'

export type Grade = 'lagi' | 'sulit' | 'baik' | 'mudah'

export const GRADES: { grade: Grade; label: string }[] = [
  { grade: 'lagi', label: 'Lagi' },
  { grade: 'sulit', label: 'Sulit' },
  { grade: 'baik', label: 'Baik' },
  { grade: 'mudah', label: 'Mudah' },
]

export const START_EASE = 2.5
const MIN_EASE = 1.3
const MAX_INTERVAL = 365

type Sched = Pick<Flashcard, 'interval' | 'ease' | 'reps' | 'lapses'>

/**
 * Jadwal berikutnya (gaya SM-2). Kartu baru: Baik → 1 hari lalu 3 hari, Mudah langsung 4 hari. Setelah itu jarak dikali `ease`.
 * "Lagi" mengembalikan ke 1 hari dan menurunkan `ease` (min. 1,3) supaya kartu sulit lebih sering muncul.
 */
export function schedule(card: Sched, grade: Grade): Sched {
  const ease = card.ease || START_EASE
  if (grade === 'lagi') return { interval: 1, ease: Math.max(MIN_EASE, ease - 0.2), reps: 0, lapses: card.lapses + 1 }
  let interval: number
  let nextEase = ease
  if (card.reps === 0) interval = grade === 'mudah' ? 4 : 1
  else if (card.reps === 1) interval = grade === 'sulit' ? 2 : grade === 'baik' ? 3 : 5
  else if (grade === 'sulit') interval = card.interval * 1.2
  else if (grade === 'baik') interval = card.interval * ease
  else interval = card.interval * ease * 1.3
  if (grade === 'sulit') nextEase = Math.max(MIN_EASE, ease - 0.15)
  if (grade === 'mudah') nextEase = ease + 0.15
  return { interval: Math.min(MAX_INTERVAL, Math.max(1, Math.round(interval))), ease: nextEase, reps: card.reps + 1, lapses: card.lapses }
}

/** Kartu setelah dinilai pada `today`. */
export function review(card: Flashcard, grade: Grade, today: ISODate): Flashcard {
  const next = schedule(card, grade)
  return { ...card, ...next, due: addDays(today, next.interval), lastReviewed: today }
}

/** "1 hr", "3 hr", "2 bln", "1 th": untuk tombol penilaian. */
export function intervalLabel(days: number): string {
  if (days < 30) return `${days} hr`
  if (days < 365) return `${Math.round(days / 30)} bln`
  return '1 th'
}

export const newCard = (
  c: Pick<Flashcard, 'front' | 'back' | 'source'> & { system?: string },
  today: ISODate,
): Omit<Flashcard, 'id' | 'createdAt' | 'updatedAt'> => ({
  ...c,
  due: today,
  interval: 0,
  ease: START_EASE,
  reps: 0,
  lapses: 0,
})

export const isDue = (c: Pick<Flashcard, 'due'>, today: ISODate) => c.due <= today

export interface CardStats {
  total: number
  due: number
  /** Kartu yang belum pernah diulas. */
  fresh: number
  /** Kartu dewasa: jarak ≥ 21 hari. */
  mature: number
}

export function cardStats(cards: Pick<Flashcard, 'due' | 'interval' | 'reps' | 'lastReviewed'>[], today: ISODate): CardStats {
  return {
    total: cards.length,
    due: cards.filter((c) => isDue(c, today)).length,
    fresh: cards.filter((c) => !c.lastReviewed).length,
    mature: cards.filter((c) => c.interval >= 21).length,
  }
}

/** Antrean ulasan: yang paling lama lewat tempo dulu, lalu yang paling sering salah; kartu baru terakhir. */
export function dueQueue<T extends Flashcard>(cards: T[], today: ISODate, limit = 20): T[] {
  return cards
    .filter((c) => isDue(c, today))
    .sort(
      (a, b) =>
        Number(!!a.lastReviewed === false) - Number(!!b.lastReviewed === false) || a.due.localeCompare(b.due) || b.lapses - a.lapses,
    )
    .slice(0, limit)
}
