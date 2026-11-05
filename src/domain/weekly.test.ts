import { describe, expect, it } from 'vitest'
import { DEFAULT_RULES } from './rules'
import { weekDates } from './time'
import { computeWeekNumbers, reviewWindow, reviewXpTotal } from './weekly'
import type { Day, DayResult, Habit } from '../types'

const MONDAY = '2026-11-02'
const day = (date: string, extra: Partial<Day>): Day => ({
  id: `#day:${date}`,
  date,
  type: 'stase',
  sleepNight: null,
  nap: 0,
  workEnd: null,
  note: '',
  updatedAt: 0,
  ...extra,
})
const result = (xp: number, pass: boolean): DayResult => ({
  xp,
  pass,
  gross: xp,
  base: xp,
  capped: xp,
  mult: 1,
  multMissing: false,
  penalty: 0,
  total: 1,
  doneCount: pass ? 1 : 0,
  effType: 'stase',
  invalidPasca: false,
})

describe('jendela Muhasabah', () => {
  it('Sabtu sampai Selasa berikutnya', () => {
    expect(reviewWindow(MONDAY, '2026-11-06')).toBe('belum') // Jumat
    expect(reviewWindow(MONDAY, '2026-11-07')).toBe('buka') // Sabtu
    expect(reviewWindow(MONDAY, '2026-11-08')).toBe('buka') // Minggu
    expect(reviewWindow(MONDAY, '2026-11-10')).toBe('buka') // Selasa susulan
    expect(reviewWindow(MONDAY, '2026-11-11')).toBe('lewat')
  })

  it('XP hanya dari Muhasabah mingguan yang selesai, memakai XP beku', () => {
    expect(
      reviewXpTotal(
        [
          { period: 'minggu', completedAt: 1, xp: 50 },
          { period: 'minggu', completedAt: 2 },
          { period: 'minggu', completedAt: null },
          { period: 'bulan', completedAt: 3, xp: 50 },
        ],
        { reviewXP: 40 },
      ),
    ).toBe(90)
  })
})

describe('angka minggu', () => {
  it('menghitung tugas, habit berlaku, tidur tanpa pasca-jaga, lolos, jaga, uang', () => {
    const dates = weekDates(MONDAY)
    const habit: Habit = {
      id: 'h',
      name: 'Belajar',
      roleId: '#role:ukmppd',
      size: 'sedang',
      dayTypes: ['stase'],
      weekdays: [],
      minutes: null,
      kind: 'normal',
      active: true,
      order: 1,
      createdAt: 0,
      updatedAt: 0,
    }
    const n = computeWeekNumbers({
      dates,
      today: '2026-11-05',
      results: new Map([
        ['2026-11-02', result(40, true)],
        ['2026-11-03', result(20, false)],
        ['2026-11-04', result(30, true)],
      ]),
      days: [
        day('2026-11-02', { sleepNight: 5, nap: 1, workEnd: 'late' }),
        day('2026-11-03', { type: 'jaga', sleepNight: 7 }),
        day('2026-11-04', { type: 'pasca', sleepNight: 3 }),
      ],
      tasks: [
        { date: '2026-11-02', done: true },
        { date: '2026-11-03', done: false },
        { date: '2026-11-09', done: true },
      ],
      habits: [habit],
      habitLogs: [{ id: 'x', habitId: 'h', date: '2026-11-02', done: true, updatedAt: 0 }],
      tentir: [{ date: '2026-11-03', hours: 2 }],
      transactions: [
        { date: '2026-11-04', type: 'expense', amount: 50_000 },
        { date: '2026-11-05', type: 'income', amount: 200_000 },
        { date: '2026-10-30', type: 'expense', amount: 999 },
      ],
      rules: DEFAULT_RULES,
    })
    expect(n).toEqual({
      tasksDone: 1,
      tasksOpen: 1,
      habitDone: 1,
      habitApplicable: 1, // hanya Senin bertipe stase; Kamis belum dipilih tipenya
      avgSleep: 6.5, // (6 + 7) / 2, pasca-jaga tidak dihitung
      passDays: 2,
      recordedDays: 3,
      xp: 90,
      jaga: 1,
      overtime: 1,
      tentirHours: 2,
      expense: 50_000,
      income: 200_000,
    })
  })
})
