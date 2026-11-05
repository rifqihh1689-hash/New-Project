import { beforeEach, describe, expect, it } from 'vitest'
import { resetDatabase } from '../test/db-utils'
import { db } from './db'
import { loadLevel } from './progress'
import { claimReward, ClaimError, loadClaims, newReward, saveReward, undoClaim } from './rewards'

beforeEach(resetDatabase)

const TODAY = '2026-11-05'
const review = (monday: string, xp: number) => ({
  id: `#rev:minggu:${monday}`,
  period: 'minggu' as const,
  start: monday,
  priorities: [],
  wins: '',
  stuck: '',
  focus: '',
  numbers: {},
  completedAt: 1,
  xp,
  updatedAt: 1,
})

describe('hadiah & klaim', () => {
  it('token dari level; klaim memakai token dan bisa diurungkan', async () => {
    const free = newReward('Sore bebas', 0)
    await saveReward(free)
    await expect(claimReward(free.id, TODAY)).rejects.toBeInstanceOf(ClaimError) // level 1, 0 token

    await db.reviews.put(review('2026-10-26', 200)) // tepat level 2
    expect((await loadLevel(TODAY)).level).toBe(2)
    const claim = await claimReward(free.id, TODAY)
    expect(claim).toMatchObject({ name: 'Sore bebas', cost: 0, level: 2, date: TODAY })
    await expect(claimReward(free.id, TODAY)).rejects.toThrow('Belum ada token')
    await undoClaim(claim.id)
    expect(await loadClaims()).toHaveLength(0)
  })

  it('hadiah berbiaya terkunci selama dana jembatan belum tercapai', async () => {
    await db.reviews.put(review('2026-10-26', 1000))
    const paid = newReward('Makan di tempat favorit', 50_000)
    await saveReward(paid)
    const now = Date.now()
    await db.savings.put({
      id: 'sav_j',
      name: 'Dana jembatan',
      kind: 'jembatan',
      target: 3_000_000,
      targetDate: null,
      deposits: [{ date: TODAY, amount: 1_000_000 }],
      createdAt: now,
      updatedAt: now,
    })
    await expect(claimReward(paid.id, TODAY)).rejects.toThrow('dana jembatan')
    await db.savings.update('sav_j', { deposits: [{ date: TODAY, amount: 3_000_000 }] })
    expect((await claimReward(paid.id, TODAY)).cost).toBe(50_000)
  })

  it('nama hadiah dicek identitas pasien', async () => {
    await expect(saveReward(newReward('Traktir Tn. Budi', 0))).rejects.toThrow()
  })
})
