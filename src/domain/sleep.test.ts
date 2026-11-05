import { describe, expect, it } from 'vitest'
import { DEFAULT_RULES, isValidSleepTiers, resolveRules } from './rules'
import { formatMultiplier, napToNextTier, sleepMultiplier, sleepTotal } from './sleep'

const R = DEFAULT_RULES

describe('total tidur 24 jam', () => {
  it('tidur malam + qailulah', () => {
    expect(sleepTotal(5, 1, R)).toBe(6)
    expect(sleepTotal(5, 1, { napCounts: false })).toBe(5)
    expect(sleepTotal(null, 1, R)).toBeNull()
  })
})

describe('pengali tidur', () => {
  it.each([
    [7, 1.2],
    [6.5, 1.2],
    [6.25, 1.0],
    [6, 1.0],
    [5.5, 0.8],
    [5, 0.8],
    [4.75, 0.6],
    [0, 0.6],
  ])('%s jam → ×%s', (hours, mult) => {
    expect(sleepMultiplier(hours, R)).toEqual({ mult, missing: false })
  })

  it('kosong = skenario terburuk', () => {
    expect(sleepMultiplier(null, R)).toEqual({ mult: 0.6, missing: true })
    expect(sleepMultiplier(null, { ...R, worstCaseEmpty: false })).toEqual({ mult: 1, missing: true })
  })

  it('qailulah berapa menit lagi untuk naik tier', () => {
    expect(napToNextTier(5.5, R)).toEqual({ minutes: 30, mult: 1.0 })
    expect(napToNextTier(6, R)).toEqual({ minutes: 30, mult: 1.2 })
    expect(napToNextTier(4.75, R)).toEqual({ minutes: 15, mult: 0.8 })
    expect(napToNextTier(6.5, R)).toBeNull()
    expect(napToNextTier(null, R)).toBeNull()
  })

  it('format pengali', () => {
    expect(formatMultiplier(0.8)).toBe('×0,8')
    expect(formatMultiplier(1)).toBe('×1,0')
  })
})

describe('pagar pengaman aturan', () => {
  it('pengali wajib naik seiring jam tidur dan tier terpendek ≤ ×1,0', () => {
    expect(isValidSleepTiers(R.sleepTiers)).toBe(true)
    expect(isValidSleepTiers([{ min: 0, mult: 1.5 }])).toBe(false)
    expect(
      isValidSleepTiers([
        { min: 6, mult: 0.8 },
        { min: 0, mult: 1.0 },
      ]),
    ).toBe(false)
  })

  it('aturan tak sah diganti bawaan', () => {
    const rules = resolveRules({ sleepTiers: [{ min: 0, mult: 2 }], pascaXP: 500 })
    expect(rules.sleepTiers).toEqual(R.sleepTiers)
    expect(rules.pascaXP).toBe(100)
  })
})
