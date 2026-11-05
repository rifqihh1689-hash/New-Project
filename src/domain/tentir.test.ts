import { describe, expect, it } from 'vitest'
import { capacityState, dayTentir, hoursByDay, isLate, parseTentir, sessionRange, summarize } from './tentir'

const s = (start: string | null, hours: number, fee = 85_000 * hours, paid = false, date = '2026-11-05') => ({
  start,
  hours,
  fee,
  paid,
  date,
})

describe('tentir', () => {
  it('jam selesai dan lewat 21.00', () => {
    expect(sessionRange(s('19.00', 1.5))).toBe('19.00–20.30')
    expect(isLate(s('19.30', 1.5))).toBe(false) // pas 21.00
    expect(isLate(s('20.00', 1.5))).toBe(true)
    expect(isLate(s(null, 1))).toBeNull()
  })

  it('ringkasan harian: tepat waktu hanya bila semua sesi ≤ 21.00 dan jam mulai terisi', () => {
    expect(dayTentir([s('16.00', 2), s('19.00', 2)])).toEqual({ hours: 4, count: 2, ok: true, late: false })
    expect(dayTentir([s('16.00', 2), s('20.00', 2)])).toMatchObject({ ok: false, late: true })
    expect(dayTentir([s('16.00', 2), s(null, 1)])).toMatchObject({ ok: null, late: false })
    expect(dayTentir([])).toMatchObject({ ok: false, count: 0 })
  })

  it('Rp per jam, lunas, dan kuota 9–15 jam', () => {
    const sum = summarize([s('19.00', 2, 170_000, true), s('19.00', 1, 120_000), s('20.30', 1, 85_000)])
    expect(sum).toEqual({ hours: 4, count: 3, fee: 375_000, paid: 170_000, perHour: 93_750, late: 1 })
    const cap = { min: 9, max: 15 }
    expect([0, 4, 12, 16].map((h) => capacityState(h, cap))).toEqual(['kosong', 'kurang', 'pas', 'lewat'])
  })

  it('jam per hari Senin–Minggu', () => {
    expect(hoursByDay([s('19.00', 2, 0, false, '2026-11-03'), s('19.00', 1.5, 0, false, '2026-11-03')], '2026-11-02')).toEqual([
      0, 3.5, 0, 0, 0, 0, 0,
    ])
  })

  it('catat cepat: inisial, durasi, jam, tanggal, lunas', () => {
    expect(parseTentir('AB 2j anatomi muskuloskeletal 19.00 besok lunas', '2026-11-05')).toEqual({
      student: 'AB',
      topic: 'Anatomi muskuloskeletal',
      date: '2026-11-06',
      start: '19.00',
      hours: 2,
      paid: true,
    })
    expect(parseTentir('tentir RN 1,5 jam farmako jam 7:30', '2026-11-05')).toMatchObject({
      student: 'RN',
      hours: 1.5,
      start: '07.30',
      topic: 'Farmako',
      paid: false,
    })
    expect(parseTentir('90m blok 12 kardio', '2026-11-05')).toMatchObject({ student: '', hours: 1.5, topic: 'Blok 12 kardio' })
  })
})
