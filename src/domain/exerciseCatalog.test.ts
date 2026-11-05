import { describe, expect, it } from 'vitest'
import { inDay, muscleOf, nextDay, variationsFor } from './exerciseCatalog'

const w = (date: string, day: string | undefined, kind: 'beban' | 'lari' = 'beban') => ({ date, day, kind, createdAt: 0 })

describe('katalog & program', () => {
  it('data lama tanpa otot: atas = dada, bawah = kaki', () => {
    expect(muscleOf({ group: 'upper' })).toBe('dada')
    expect(muscleOf({ group: 'lower' })).toBe('kaki')
  })

  it('pembagian hari Atas/Bawah dan Push/Pull/Kaki; inti di semua hari', () => {
    expect(inDay({ group: 'lower', muscle: 'kaki' }, 'atas-bawah', 'Atas')).toBe(false)
    expect(inDay({ group: 'upper', muscle: 'punggung' }, 'atas-bawah', 'Atas')).toBe(true)
    expect(inDay({ group: 'upper', muscle: 'trisep' }, 'ppl', 'Push')).toBe(true)
    expect(inDay({ group: 'upper', muscle: 'bisep' }, 'ppl', 'Push')).toBe(false)
    expect(inDay({ group: 'upper', muscle: 'inti' }, 'ppl', 'Kaki')).toBe(true)
    expect(inDay({ group: 'lower', muscle: 'kaki' }, 'fullbody', 'Semua')).toBe(true)
  })

  it('hari berikutnya mengikuti sesi beban terakhir; lari diabaikan', () => {
    expect(nextDay('ppl', [])).toBe('Push')
    expect(nextDay('ppl', [w('2026-11-02', 'Push'), w('2026-11-04', 'Pull'), w('2026-11-05', undefined, 'lari')])).toBe('Kaki')
    expect(nextDay('ppl', [w('2026-11-06', 'Kaki')])).toBe('Push')
    expect(nextDay('atas-bawah', [w('2026-11-06', 'Push')])).toBe('Atas')
  })

  it('variasi untuk otot yang sama, tanpa yang sudah ada', () => {
    const v = variationsFor({ name: 'Bench press', group: 'upper', muscle: 'dada' }, [{ name: 'Incline bench press' }])
    expect(v.length).toBeGreaterThan(2)
    expect(v.every((x) => x.muscle === 'dada')).toBe(true)
    expect(v.some((x) => x.name === 'Incline bench press')).toBe(false)
  })
})
