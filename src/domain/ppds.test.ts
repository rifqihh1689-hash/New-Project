import { describe, expect, it } from 'vitest'
import { canActivate, docStats, dueLabel, nextDeadline } from './ppds'

describe('persiapan PPDS', () => {
  const docs = [
    { status: 'siap' as const, due: '2026-12-01' },
    { status: 'proses' as const, due: '2026-11-05' }, // lewat
    { status: 'belum' as const, due: '2027-03-01' },
    { status: 'belum' as const, due: null },
  ]

  it('statistik: siap, rasio, dan yang lewat tenggat', () => {
    expect(docStats(docs, '2026-11-09')).toEqual({ total: 4, ready: 1, ratio: 0.25, overdue: 1 })
    expect(docStats([], '2026-11-09')).toEqual({ total: 0, ready: 0, ratio: 0, overdue: 0 })
  })

  it('tenggat terdekat mengabaikan yang siap dan tanpa tanggal', () => {
    expect(nextDeadline(docs)?.due).toBe('2026-11-05')
    expect(nextDeadline([{ status: 'siap', due: '2026-11-01' }])).toBeNull()
  })

  it('label tenggat', () => {
    expect(dueLabel('2026-11-12', '2026-11-09')).toBe('3 hari lagi')
    expect(dueLabel('2026-11-09', '2026-11-09')).toBe('hari ini')
    expect(dueLabel('2026-11-06', '2026-11-09')).toBe('lewat 3 hari')
  })

  it('Main Quest maksimal 3 aktif; beku dan selesai tidak dihitung', () => {
    const q = (status: 'aktif' | 'beku' | 'selesai') => ({ status })
    expect(canActivate([q('aktif'), q('aktif'), q('beku'), q('selesai')])).toBe(true)
    expect(canActivate([q('aktif'), q('aktif'), q('aktif')])).toBe(false)
  })
})
