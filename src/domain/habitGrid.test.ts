import { describe, expect, it } from 'vitest'
import { applyMinutes, dayInitial, habitCell, habitRowSummary, lastDays } from './habitGrid'
import { DEFAULT_RULES } from './rules'

const R = DEFAULT_RULES
const TODAY = '2026-11-05' // Kamis
const study = {
  active: true,
  dayTypes: ['stase' as const, 'libur' as const],
  weekdays: [],
  kind: 'normal' as const,
  size: 'sedang' as const,
}
const day = (type: 'stase' | 'jaga' | 'pasca' | 'libur' | null, extra = {}) => ({ type, sleepNight: null, nap: 0, workEnd: null, ...extra })

describe('grid habit 7 hari', () => {
  it('tanggal & inisial hari', () => {
    expect(lastDays(TODAY)).toEqual(['2026-10-30', '2026-10-31', '2026-11-01', '2026-11-02', '2026-11-03', '2026-11-04', '2026-11-05'])
    expect(lastDays(TODAY).map(dayInitial).join('')).toBe('JSMSSRK')
  })

  it('berlaku menurut tipe hari; tipe belum dipilih = belum tahu', () => {
    expect(habitCell(study, TODAY, day('stase'), undefined, TODAY, R).applies).toBe(true)
    expect(habitCell(study, TODAY, day('jaga'), undefined, TODAY, R)).toMatchObject({ applies: false, editable: false })
    expect(habitCell(study, TODAY, undefined, undefined, TODAY, R)).toMatchObject({ applies: null, editable: true })
  })

  it('lewat jendela isi mundur: terkunci (XP beku) tapi tetap bisa dicentang', () => {
    expect(habitCell(study, '2026-11-04', day('stase'), undefined, TODAY, R)).toMatchObject({ editable: true, locked: false })
    expect(habitCell(study, '2026-11-03', day('stase'), { done: true }, TODAY, R)).toMatchObject({
      editable: true,
      locked: true,
      done: true,
    })
  })

  it('habit otomatis dinilai dari isian hari & tidak bisa dicentang', () => {
    const sleep = { ...study, kind: 'sleep' as const }
    expect(habitCell(sleep, TODAY, day('stase', { sleepNight: 5, nap: 1 }), undefined, TODAY, R)).toMatchObject({
      done: true,
      editable: false,
    })
    expect(habitCell(sleep, TODAY, day('stase', { sleepNight: 5 }), { done: true }, TODAY, R).done).toBe(false)
  })

  it('ringkasan menghitung hari yang berlaku saja', () => {
    const cells = [
      habitCell(study, '2026-11-03', day('stase'), { done: true }, TODAY, R),
      habitCell(study, '2026-11-04', day('jaga'), { done: true }, TODAY, R),
      habitCell(study, TODAY, undefined, { done: true }, TODAY, R),
      habitCell(study, '2026-11-02', undefined, undefined, TODAY, R),
    ]
    expect(habitRowSummary(cells)).toEqual({ done: 2, applicable: 2 })
  })

  it('menit: selesai saat mencapai target, tidak pernah negatif', () => {
    expect(applyMinutes(30, 15, 45)).toEqual({ minutes: 45, done: true })
    expect(applyMinutes(30, 10, 45)).toEqual({ minutes: 40, done: false })
    expect(applyMinutes(10, -15, 45)).toEqual({ minutes: 0, done: false })
    expect(applyMinutes(0, 5, null)).toEqual({ minutes: 5, done: true })
  })
})
