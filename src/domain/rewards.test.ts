import { describe, expect, it } from 'vitest'
import { bridgeStatus, claimBlock, tokensLeft } from './rewards'

const bridge = (target: number, deposits: number[]) => ({
  kind: 'jembatan' as const,
  target,
  deposits: deposits.map((amount) => ({ date: '2026-11-01', amount })),
})

describe('hadiah', () => {
  it('1 token per naik level, dikurangi klaim', () => {
    expect(tokensLeft(1, 0)).toBe(0)
    expect(tokensLeft(4, 1)).toBe(2)
    expect(tokensLeft(2, 5)).toBe(0)
  })

  it('dana jembatan: dijumlah dari semua tabungan jembatan; tanpa target = tidak mengunci', () => {
    expect(bridgeStatus([])).toEqual({ target: null, saved: 0, reached: true })
    expect(bridgeStatus([bridge(5_000_000, [1_000_000, 500_000]), { kind: 'wishlist', target: 1, deposits: [] }])).toEqual({
      target: 5_000_000,
      saved: 1_500_000,
      reached: false,
    })
  })

  it('hadiah berbiaya terkunci sampai dana jembatan tercapai; gratis cukup token', () => {
    const locked = bridgeStatus([bridge(1_000_000, [200_000])])
    expect(claimBlock({ cost: 50_000 }, 3, locked)).toBe('jembatan')
    expect(claimBlock({ cost: 0 }, 3, locked)).toBeNull()
    expect(claimBlock({ cost: 0 }, 0, locked)).toBe('token')
    expect(claimBlock({ cost: 50_000 }, 1, bridgeStatus([bridge(1_000_000, [1_000_000])]))).toBeNull()
  })
})
