import { bridgeStatus, claimBlock, tokensLeft } from '../domain/rewards'
import { createId } from '../lib/id'
import type { Claim, ISODate, Reward } from '../types'
import { assertNoPatientIdentity } from './daily'
import { db } from './db'
import { loadLevel } from './progress'

export async function loadRewards(): Promise<Reward[]> {
  return (await db.rewards.toArray()).sort((a, b) => a.cost - b.cost || a.createdAt - b.createdAt)
}

export function newReward(name = '', cost = 0): Reward {
  const now = Date.now()
  return { id: createId('rwd'), name, cost, archived: false, createdAt: now, updatedAt: now }
}

export async function saveReward(reward: Reward): Promise<void> {
  const name = reward.name.trim()
  if (!name) throw new Error('Nama hadiah kosong.')
  assertNoPatientIdentity(name)
  await db.rewards.put({ ...reward, name, cost: Math.max(0, Math.round(reward.cost)), updatedAt: Date.now() })
}

export class ClaimError extends Error {}

/** Klaim hadiah: perlu 1 token; hadiah berbiaya perlu dana jembatan tercapai. Diperiksa ulang di sini. */
export async function claimReward(rewardId: string, today: ISODate): Promise<Claim> {
  const [reward, level, claims, savings] = await Promise.all([
    db.rewards.get(rewardId),
    loadLevel(today),
    db.claims.count(),
    db.savings.toArray(),
  ])
  if (!reward) throw new ClaimError('Hadiah tidak ditemukan.')
  const block = claimBlock(reward, tokensLeft(level.level, claims), bridgeStatus(savings))
  if (block === 'token') throw new ClaimError('Belum ada token. Naik level dulu.')
  if (block === 'jembatan') throw new ClaimError('Hadiah berbiaya terkunci sampai dana jembatan tercapai.')
  const now = Date.now()
  const claim: Claim = {
    id: createId('clm'),
    rewardId,
    name: reward.name,
    cost: reward.cost,
    date: today,
    level: level.level,
    createdAt: now,
    updatedAt: now,
  }
  await db.claims.add(claim)
  return claim
}

export const undoClaim = (id: string) => db.claims.delete(id)

export async function loadClaims(): Promise<Claim[]> {
  return (await db.claims.toArray()).sort((a, b) => b.date.localeCompare(a.date) || b.createdAt - a.createdAt)
}
