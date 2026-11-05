import { describe, expect, it } from 'vitest'
import { dayTypeLabel, effectiveDayType, isAllowedOnDayType, isNeutralDayType, suggestDayType } from './dayType'

describe('tipe hari', () => {
  it('pasca-jaga hanya sah bila kemarin jaga, selain itu dihitung stase', () => {
    expect(effectiveDayType('pasca', 'jaga')).toEqual({ type: 'pasca', invalidPasca: false })
    expect(effectiveDayType('pasca', 'stase')).toEqual({ type: 'stase', invalidPasca: true })
    expect(effectiveDayType('pasca', null)).toEqual({ type: 'stase', invalidPasca: true })
    expect(effectiveDayType('libur', null)).toEqual({ type: 'libur', invalidPasca: false })
  })

  it('saran: setelah jaga → pasca-jaga, Minggu → libur, selain itu stase', () => {
    expect(suggestDayType('2026-11-05', 'jaga')).toBe('pasca')
    expect(suggestDayType('2026-11-08', 'stase')).toBe('libur')
    expect(suggestDayType('2026-11-05', 'stase')).toBe('stase')
  })

  it('jaga & pasca-jaga netral untuk streak', () => {
    expect(isNeutralDayType('jaga')).toBe(true)
    expect(isNeutralDayType('pasca')).toBe(true)
    expect(isNeutralDayType('stase')).toBe(false)
    expect(isNeutralDayType(null)).toBe(false)
  })

  it('pasca-jaga hanya memuat isi pemulihan', () => {
    expect(isAllowedOnDayType('pasca', { recovery: false })).toBe(false)
    expect(isAllowedOnDayType('pasca', { recovery: true })).toBe(true)
    expect(isAllowedOnDayType('stase', { recovery: false })).toBe(true)
  })

  it('label mengikuti fase hidup', () => {
    expect(dayTypeLabel('stase')).toBe('Stase')
    expect(dayTypeLabel('stase', { dayTypeLabels: { stase: 'Dinas' } })).toBe('Dinas')
    expect(dayTypeLabel('jaga', { dayTypeLabels: { stase: 'Dinas' } })).toBe('Jaga malam')
  })
})
