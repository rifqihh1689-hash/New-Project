import type { Day, DayResult, Habit, HabitLog, ISODate, Review, TentirSession, Transaction, XpRules } from '../types'
import { habitCell } from './habitGrid'
import { sleepTotal } from './sleep'
import { addDays, diffDays } from './time'

/** Angka ringkasan satu periode (minggu/bulan), disimpan di Muhasabah agar Claude bisa membacanya. */
export interface WeekNumbers {
  tasksDone: number
  tasksOpen: number
  habitDone: number
  habitApplicable: number
  /** Rata-rata total tidur (malam + qailulah) di hari selain pasca-jaga, jam. */
  avgSleep: number | null
  passDays: number
  recordedDays: number
  xp: number
  jaga: number
  overtime: number
  tentirHours: number
  expense: number
  income: number
}

export interface WeekInput {
  dates: ISODate[]
  today: ISODate
  results: Map<ISODate, DayResult>
  days: Day[]
  tasks: { done: boolean; date: ISODate }[]
  habits: Habit[]
  habitLogs: HabitLog[]
  tentir: Pick<TentirSession, 'hours' | 'date'>[]
  transactions: Pick<Transaction, 'type' | 'amount' | 'date'>[]
  rules: XpRules
}

export function computeWeekNumbers(w: WeekInput): WeekNumbers {
  // Rentang bebas (minggu atau bulan): dari tanggal pertama sampai terakhir di `dates`.
  const inWeek = (d: ISODate) => d >= w.dates[0] && d <= w.dates[w.dates.length - 1]
  const dayMap = new Map(w.days.map((d) => [d.date, d]))
  const logMap = new Map(w.habitLogs.map((l) => [`${l.habitId}|${l.date}`, l]))
  let habitDone = 0
  let habitApplicable = 0
  for (const h of w.habits.filter((x) => x.active)) {
    for (const d of w.dates.filter((x) => x <= w.today)) {
      const cell = habitCell(h, d, dayMap.get(d), logMap.get(`${h.id}|${d}`), w.today, w.rules)
      if (cell.applies === true) {
        habitApplicable++
        if (cell.done) habitDone++
      }
    }
  }
  const sleeps = w.dates
    .map((d) => dayMap.get(d))
    .filter((d): d is Day => !!d && d.type !== 'pasca' && d.sleepNight != null)
    .map((d) => sleepTotal(d.sleepNight, d.nap, w.rules) as number)
  const results = w.dates.map((d) => w.results.get(d)).filter((r): r is DayResult => !!r)
  const weekDays = w.dates.map((d) => dayMap.get(d)).filter((d): d is Day => !!d)
  return {
    tasksDone: w.tasks.filter((t) => inWeek(t.date) && t.done).length,
    tasksOpen: w.tasks.filter((t) => inWeek(t.date) && !t.done).length,
    habitDone,
    habitApplicable,
    avgSleep: sleeps.length ? Math.round((sleeps.reduce((a, b) => a + b, 0) / sleeps.length) * 100) / 100 : null,
    passDays: results.filter((r) => r.pass).length,
    recordedDays: results.length,
    xp: results.reduce((a, r) => a + r.xp, 0),
    jaga: weekDays.filter((d) => d.type === 'jaga').length,
    overtime: weekDays.filter((d) => d.workEnd === 'late').length,
    tentirHours: w.tentir.filter((t) => inWeek(t.date)).reduce((a, t) => a + t.hours, 0),
    expense: w.transactions.filter((t) => inWeek(t.date) && t.type === 'expense').reduce((a, t) => a + t.amount, 0),
    income: w.transactions.filter((t) => inWeek(t.date) && t.type === 'income').reduce((a, t) => a + t.amount, 0),
  }
}

/**
 * Jendela menyelesaikan Muhasabah (Raid di MBAPPE OS): mulai Sabtu minggu itu sampai Selasa berikutnya
 * (susulan setelah jaga akhir pekan). Di luar jendela tetap bisa menulis refleksi, tapi tanpa XP,
 * supaya minggu lama tidak bisa "ditambang".
 */
export function reviewWindow(monday: ISODate, today: ISODate): 'belum' | 'buka' | 'lewat' {
  const d = diffDays(today, monday)
  if (d < 5) return 'belum'
  if (d <= 8) return 'buka'
  return 'lewat'
}

/** XP dari Muhasabah yang sudah selesai. */
export function reviewXpTotal(reviews: Pick<Review, 'period' | 'completedAt' | 'xp'>[], rules: Pick<XpRules, 'reviewXP'>): number {
  return reviews.filter((r) => r.period === 'minggu' && r.completedAt).reduce((a, r) => a + (r.xp ?? rules.reviewXP), 0)
}

/** Senin minggu sebelumnya: prioritas yang tampil "minggu ini" ditulis di Muhasabah minggu lalu. */
export const previousMonday = (monday: ISODate) => addDays(monday, -7)
