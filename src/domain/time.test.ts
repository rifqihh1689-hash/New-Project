import { describe, expect, it } from 'vitest'
import { addDays, dayKey, formatDateLong, formatHours, monthsBetween, parseClock, weekDates, weekStart, wibMinutes } from './time'

const wib = (iso: string) => Date.parse(`${iso}+07:00`)

describe('waktu WIB & pergantian hari 03.00', () => {
  it('hari berganti pukul 03.00 WIB, tidak bergantung zona waktu perangkat', () => {
    expect(dayKey(wib('2026-11-05T02:59:00'))).toBe('2026-11-04')
    expect(dayKey(wib('2026-11-05T03:00:00'))).toBe('2026-11-05')
    expect(dayKey(wib('2026-11-05T03:45:00'))).toBe('2026-11-05') // qiyamul lail = awal hari
    expect(dayKey(wib('2026-11-05T23:59:00'))).toBe('2026-11-05')
  })

  it('jam dinding WIB', () => {
    expect(wibMinutes(wib('2026-11-05T14:30:00'))).toBe(14 * 60 + 30)
    expect(parseClock('03.45')).toBe(225)
    expect(parseClock('21:00')).toBe(1260)
    expect(parseClock('25.00')).toBeNull()
  })

  it('minggu dimulai Senin', () => {
    expect(weekStart('2026-11-05')).toBe('2026-11-02')
    expect(weekStart('2026-11-08')).toBe('2026-11-02') // Minggu
    expect(weekDates('2026-11-05')).toHaveLength(7)
    expect(addDays('2026-12-31', 1)).toBe('2027-01-01')
  })

  it('format Indonesia', () => {
    expect(formatDateLong('2026-11-05')).toBe('Kamis, 5 November 2026')
    expect(formatHours(5.5)).toBe('5 j 30 m')
    expect(formatHours(2)).toBe('2 j')
    expect(formatHours(0.5)).toBe('30 m')
    expect(monthsBetween('2026-11-05', '2027-12-31')).toBe(14)
  })
})
