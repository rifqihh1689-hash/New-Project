import type { Reward, Saving } from '../types'

/** Token hadiah: 1 per naik level (level 1 = 0 token), dikurangi klaim. */
export const tokensLeft = (level: number, claims: number) => Math.max(0, level - 1 - claims)

export interface BridgeStatus {
  /** `null` = belum ada dana jembatan, jadi hadiah berbiaya tidak dikunci. */
  target: number | null
  saved: number
  reached: boolean
}

/** Status dana jembatan dari semua tabungan berjenis `jembatan`. */
export function bridgeStatus(savings: Pick<Saving, 'kind' | 'target' | 'deposits'>[]): BridgeStatus {
  const list = savings.filter((s) => s.kind === 'jembatan' && s.target > 0)
  if (!list.length) return { target: null, saved: 0, reached: true }
  const target = list.reduce((a, s) => a + s.target, 0)
  const saved = list.reduce((a, s) => a + s.deposits.reduce((x, d) => x + d.amount, 0), 0)
  return { target, saved, reached: saved >= target }
}

export type ClaimBlock = null | 'token' | 'jembatan'

/** Kenapa hadiah belum bisa diklaim (`null` = bisa). */
export function claimBlock(reward: Pick<Reward, 'cost'>, tokens: number, bridge: BridgeStatus): ClaimBlock {
  if (reward.cost > 0 && !bridge.reached) return 'jembatan'
  if (tokens <= 0) return 'token'
  return null
}

/** Ide hadiah untuk tambah cepat; biaya kecil supaya tidak menggerus dana jembatan. */
export const REWARD_IDEAS: { name: string; cost: number }[] = [
  { name: 'Sore bebas tanpa belajar', cost: 0 },
  { name: 'Main game / nonton 2 jam', cost: 0 },
  { name: 'Makan di tempat favorit', cost: 50_000 },
  { name: 'Kopi enak + jalan sore', cost: 35_000 },
  { name: 'Buku non-medis', cost: 100_000 },
]
