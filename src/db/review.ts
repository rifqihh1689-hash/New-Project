import { reviewWindow } from '../domain/weekly'
import type { WeekNumbers } from '../domain/weekly'
import { privateId } from '../lib/id'
import type { ISODate, Review } from '../types'
import { assertNoPatientIdentity } from './daily'
import { db } from './db'

export function emptyReview(monday: ISODate): Review {
  return {
    id: privateId.weeklyReview(monday),
    period: 'minggu',
    start: monday,
    priorities: ['', '', ''],
    wins: '',
    stuck: '',
    focus: '',
    numbers: {},
    completedAt: null,
    updatedAt: 0,
  }
}

type ReviewText = Partial<Pick<Review, 'priorities' | 'wins' | 'stuck' | 'focus'>>

/** Menyimpan refleksi (autosave). Semua kolom dicek identitas pasien. */
export async function saveReviewText(monday: ISODate, changes: ReviewText): Promise<void> {
  assertNoPatientIdentity(...(changes.priorities ?? []), changes.wins ?? '', changes.stuck ?? '', changes.focus ?? '')
  const id = privateId.weeklyReview(monday)
  await db.transaction('rw', db.reviews, async () => {
    const current = (await db.reviews.get(id)) ?? emptyReview(monday)
    await db.reviews.put({ ...current, ...changes, updatedAt: Date.now() })
  })
}

/**
 * Menyelesaikan Muhasabah: menyimpan angka minggu itu dan memberi XP sekali.
 * Hanya di jendela Sabtu–Selasa; minimal satu prioritas minggu depan terisi.
 */
export async function completeReview(monday: ISODate, today: ISODate, numbers: WeekNumbers, xp: number): Promise<void> {
  if (reviewWindow(monday, today) !== 'buka')
    throw new Error('Muhasabah minggu ini bisa diselesaikan mulai Sabtu sampai Selasa berikutnya.')
  const id = privateId.weeklyReview(monday)
  await db.transaction('rw', db.reviews, async () => {
    const current = (await db.reviews.get(id)) ?? emptyReview(monday)
    if (current.completedAt) return
    if (!current.priorities.some((p) => p.trim())) throw new Error('Isi minimal satu prioritas minggu depan dulu.')
    const nums: Record<string, number | null> = { ...numbers }
    await db.reviews.put({ ...current, numbers: nums, completedAt: Date.now(), xp, updatedAt: Date.now() })
  })
}
