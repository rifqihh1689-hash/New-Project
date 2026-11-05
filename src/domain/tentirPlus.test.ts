import { describe, expect, it } from 'vitest'
import type { DayType, TentirPackage } from '../types'
import { activePackage, fillTemplate, freeSlots, packageUsage, slotsMessage } from './tentirPlus'

const pkg = (id: string, student: string, sessions: number, createdAt = 0): TentirPackage => ({
  id,
  student,
  name: 'Blok 12',
  sessions,
  price: 300_000,
  paid: true,
  paidDate: '2026-11-01',
  transactionId: null,
  archived: false,
  createdAt,
  updatedAt: 0,
})

describe('Tentir+', () => {
  it('paket: sisa sesi dan paket aktif per murid', () => {
    const sessions = [{ packageId: 'p1' }, { packageId: 'p1' }, { packageId: null }]
    expect(packageUsage(pkg('p1', 'AB', 4), sessions)).toEqual({ used: 2, left: 2, done: false })
    const list = [pkg('p1', 'AB', 2, 1), pkg('p2', 'AB', 4, 2)]
    expect(activePackage('ab', list, sessions)?.id).toBe('p2') // p1 habis
    expect(activePackage('CD', list, sessions)).toBeNull()
  })

  it('slot kosong: tanpa jaga/pasca, tanpa bentrok, tidak di masa lalu', () => {
    const types: Record<string, DayType> = { '2026-12-02': 'jaga', '2026-12-03': 'pasca' }
    const slots = freeSlots(
      '2026-12',
      '2026-12-01',
      (d) => types[d] ?? null,
      [
        { date: '2026-12-04', start: '19.30', hours: 1 },
        { date: '2026-12-05', start: '16.00', hours: 2 },
      ],
      {
        start: '19.00',
        end: '21.00',
      },
    )
    expect(slots.slice(0, 4)).toEqual(['2026-12-01', '2026-12-05', '2026-12-06', '2026-12-07'])
    expect(slots).toHaveLength(31 - 3)
  })

  it('pesan slot & template', () => {
    const text = slotsMessage('2026-12', ['2026-12-01', '2026-12-05', '2026-12-08'], { start: '19.00', end: '21.00' })
    expect(text).toBe('Slot tentir Desember 2026 (19.00–21.00):\n• Sel 1, Sab 5\n• Sel 8\nBalas tanggal yang kamu mau ya, nanti aku kunci.')
    expect(fillTemplate('Halo {inisial}, {topik} {x}', { inisial: 'AB', topik: 'Anatomi' })).toBe('Halo AB, Anatomi {x}')
  })
})
