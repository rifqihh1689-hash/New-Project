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

describe('Muhasabah bulanan', () => {
  it('prioritas & refleksi tersimpan per bulan; selesai mulai tanggal 25, tanpa XP', async () => {
    const { completeMonthReview, saveMonthReviewText } = await import('./review')
    const numbers = {
      tasksDone: 3,
      tasksOpen: 1,
      habitDone: 4,
      habitApplicable: 8,
      avgSleep: 6,
      passDays: 2,
      recordedDays: 3,
      xp: 120,
      jaga: 4,
      overtime: 0,
      tentirHours: 6,
      expense: 0,
      income: 0,
    }
    await expect(completeMonthReview('2026-11', '2026-11-26', numbers)).rejects.toThrow('prioritas')
    await saveMonthReviewText('2026-11', { priorities: ['Bank soal 600', '', ''], focus: 'tidur dulu' })
    await expect(completeMonthReview('2026-11', '2026-11-05', numbers)).rejects.toThrow('tanggal 25')
    await completeMonthReview('2026-11', '2026-11-26', numbers)
    const r = await db.reviews.get('#rev:bulan:2026-11')
    expect(r).toMatchObject({ period: 'bulan', start: '2026-11-01', xp: 0, focus: 'tidur dulu' })
    expect(r?.numbers.xp).toBe(120)
    await expect(saveMonthReviewText('2026-11', { wins: 'visite Tn. Budi lancar' })).rejects.toThrow()
  })
})
