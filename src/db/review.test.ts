import { beforeEach, describe, expect, it } from 'vitest'
import { resetDatabase } from '../test/db-utils'
import { PatientIdentityError } from './daily'
import { db } from './db'
import { completeReview, saveReviewText } from './review'
import type { WeekNumbers } from '../domain/weekly'

const MONDAY = '2026-11-02'
const numbers = { tasksDone: 3, xp: 120 } as WeekNumbers

beforeEach(resetDatabase)

describe('Muhasabah', () => {
  it('menyimpan refleksi dengan ID privat per minggu', async () => {
    await saveReviewText(MONDAY, { wins: 'Qailulah rutin' })
    await saveReviewText(MONDAY, { priorities: ['200 soal kardio', '', ''] })
    expect(await db.reviews.get('#rev:minggu:2026-11-02')).toMatchObject({
      wins: 'Qailulah rutin',
      priorities: ['200 soal kardio', '', ''],
    })
  })

  it('menolak identitas pasien', async () => {
    await expect(saveReviewText(MONDAY, { stuck: 'FU Tn. Budi lama' })).rejects.toBeInstanceOf(PatientIdentityError)
  })

  it('selesai hanya di jendela, butuh prioritas, dan XP sekali', async () => {
    await expect(completeReview(MONDAY, '2026-11-05', numbers, 50)).rejects.toThrow(/mulai Sabtu/)
    await expect(completeReview(MONDAY, '2026-11-07', numbers, 50)).rejects.toThrow(/prioritas/)
    await saveReviewText(MONDAY, { priorities: ['200 soal kardio', '', ''] })
    await completeReview(MONDAY, '2026-11-08', numbers, 50)
    const first = await db.reviews.get('#rev:minggu:2026-11-02')
    expect(first).toMatchObject({ xp: 50, numbers: { tasksDone: 3, xp: 120 } })
    await completeReview(MONDAY, '2026-11-09', numbers, 999)
    expect((await db.reviews.get('#rev:minggu:2026-11-02'))?.xp).toBe(50)
  })
})
