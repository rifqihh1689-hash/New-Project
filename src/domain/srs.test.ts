import { describe, expect, it } from 'vitest'
import { cardStats, dueQueue, intervalLabel, newCard, review, schedule, START_EASE } from './srs'
import type { Flashcard } from '../types'

const card = (over: Partial<Flashcard> = {}): Flashcard => ({
  id: 'c',
  front: 'f',
  back: 'b',
  source: 'manual',
  due: '2026-11-09',
  interval: 0,
  ease: START_EASE,
  reps: 0,
  lapses: 0,
  createdAt: 0,
  updatedAt: 0,
  ...over,
})

describe('jadwal ulasan', () => {
  it('kartu baru: Baik 1 hari → 3 hari → dikali ease', () => {
    const a = schedule(card(), 'baik')
    expect(a).toMatchObject({ interval: 1, reps: 1 })
    const b = schedule({ ...card(), ...a }, 'baik')
    expect(b.interval).toBe(3)
    const c = schedule({ ...card(), ...b }, 'baik')
    expect(c.interval).toBe(8) // 3 × 2,5 = 7,5 → 8
  })

  it('Lagi kembali ke 1 hari, ease turun (min 1,3), lapse bertambah', () => {
    const lapsed = schedule(card({ interval: 30, reps: 5, ease: 1.4 }), 'lagi')
    expect(lapsed).toEqual({ interval: 1, ease: 1.3, reps: 0, lapses: 1 })
  })

  it('Sulit memperlambat dan menurunkan ease; Mudah mempercepat dan menaikkan ease; maksimum 1 tahun', () => {
    const base = card({ interval: 10, reps: 4 })
    expect(schedule(base, 'sulit')).toMatchObject({ interval: 12, ease: 2.35 })
    expect(schedule(base, 'mudah')).toMatchObject({ interval: 33, ease: 2.65 })
    expect(schedule(card({ interval: 300, reps: 9 }), 'mudah').interval).toBe(365)
  })

  it('review menetapkan tanggal berikutnya dan tanggal ulasan', () => {
    expect(review(card(), 'baik', '2026-11-09')).toMatchObject({ due: '2026-11-10', lastReviewed: '2026-11-09', reps: 1 })
  })

  it('label jarak', () => {
    expect([1, 3, 45, 400].map(intervalLabel)).toEqual(['1 hr', '3 hr', '2 bln', '1 th'])
  })

  it('statistik & antrean: jatuh tempo saja, terlama dulu, kartu baru terakhir, ada batas', () => {
    const cards = [
      card({ id: 'baru', due: '2026-11-01' }),
      card({ id: 'lama', due: '2026-11-03', lastReviewed: '2026-10-30', interval: 3, reps: 2 }),
      card({ id: 'kemarin', due: '2026-11-08', lastReviewed: '2026-11-07', interval: 1, reps: 1 }),
      card({ id: 'nanti', due: '2026-11-20', lastReviewed: '2026-11-09', interval: 11, reps: 3 }),
    ]
    expect(cardStats(cards, '2026-11-09')).toMatchObject({ total: 4, due: 3, fresh: 1 })
    expect(dueQueue(cards, '2026-11-09').map((c) => c.id)).toEqual(['lama', 'kemarin', 'baru'])
    expect(dueQueue(cards, '2026-11-09', 1)).toHaveLength(1)
    expect(newCard({ front: 'a', back: 'b', source: 'salah' }, '2026-11-09')).toMatchObject({ due: '2026-11-09', reps: 0, ease: 2.5 })
  })
})
