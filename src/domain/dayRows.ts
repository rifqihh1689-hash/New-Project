import type { Day, DayResult, DayType, Habit, HabitLog, ISODate, Role, Task, TentirSession, XpRules, XpSize } from '../types'
import { dayTentir } from './tentir'
import { addDays, weekStart } from './time'
import { computeDay, habitsForDay, isLocked, type DayInput, type DayItem } from './xp'

/**
 * Baris harian & hasil XP sebagai fungsi murni. Dipakai app (lewat db/daily.ts) dan connector Claude,
 * supaya keduanya menghitung XP dengan cara yang sama persis.
 */

export function sortTasks(tasks: Task[]): Task[] {
  return [...tasks].sort(
    (a, b) => Number(a.done) - Number(b.done) || Number(b.important) - Number(a.important) || a.createdAt - b.createdAt,
  )
}

export interface DailyRow {
  kind: 'task' | 'habit'
  id: string
  title: string
  roleId: string
  size: XpSize
  done: boolean
  recovery: boolean
  /** `tentir` = quest bersyarat "Sesi tentir selesai ≤ batas", dinilai dari sesi hari itu. */
  habitKind?: Habit['kind'] | 'tentir'
  important?: boolean
  task?: Task
  /** Quest mingguan (1× per minggu, di luar syarat lolos). */
  weekly?: boolean
  /** Quest mingguan yang sudah selesai di hari lain minggu ini. */
  doneOn?: ISODate | null
}

/** Hari pertama quest mingguan selesai dalam minggu `date` (dari log yang diberikan). */
export function weeklyFirstDone(habitId: string, date: ISODate, logs: HabitLog[]): ISODate | null {
  const from = weekStart(date)
  const to = addDays(from, 6)
  let first: ISODate | null = null
  for (const l of logs) if (l.habitId === habitId && l.done && l.date >= from && l.date <= to && (!first || l.date < first)) first = l.date
  return first
}

/**
 * Baris harian (tugas + habit) sebelum disaring tipe hari.
 * `logs` boleh berisi log seminggu (dibutuhkan quest mingguan); log harian tetap diambil per tanggal.
 */
export function dailyRows(
  date: ISODate,
  type: DayType | null,
  tasks: Task[],
  habits: Habit[],
  logs: HabitLog[],
  roles: Role[],
  sessions: Pick<TentirSession, 'date' | 'start' | 'hours'>[] = [],
  workEndLimit: string | null = '21.00',
): DailyRow[] {
  const recovery = new Set(roles.filter((r) => r.recovery).map((r) => r.id))
  const logMap = new Map(logs.filter((l) => l.date === date).map((l) => [l.habitId, l.done]))
  const taskRows: DailyRow[] = sortTasks(tasks.filter((t) => t.date === date)).map((t) => ({
    kind: 'task',
    id: t.id,
    title: t.title,
    roleId: t.roleId,
    size: t.size,
    done: t.done,
    recovery: recovery.has(t.roleId),
    important: t.important,
    task: t,
  }))
  const habitRows: DailyRow[] = habitsForDay(withWorkEndRule(habits, workEndLimit), date, type).map((h) => {
    const row: DailyRow = {
      kind: 'habit',
      id: h.id,
      title: h.name,
      roleId: h.roleId,
      size: h.size,
      done: logMap.get(h.id) ?? false,
      recovery: recovery.has(h.roleId),
      habitKind: h.kind,
    }
    if (h.freq !== 'weekly' || h.kind !== 'normal') return row
    const first = weeklyFirstDone(h.id, date, logs)
    return { ...row, weekly: true, done: row.done && first === date, doneOn: first && first !== date ? first : null }
  })
  // Quest bersyarat ala MBAPPE OS: hanya muncul di hari non-jaga yang ada sesi tentirnya.
  const today = sessions.filter((x) => x.date === date)
  if (type && type !== 'jaga' && today.length && workEndLimit) {
    habitRows.push({
      kind: 'habit',
      id: `#tentir:${date}`,
      title: `Sesi tentir selesai ≤ ${workEndLimit}`,
      roleId: TENTIR_ROLE_ID,
      size: 'sedang',
      done: dayTentir(today, workEndLimit).ok === true,
      recovery: recovery.has(TENTIR_ROLE_ID),
      habitKind: 'tentir',
    })
  }
  return [...taskRows, ...habitRows]
}

const TENTIR_ROLE_ID = '#role:tentir'

export function toDayInput(day: Day | null, prevType: DayType | null, rows: DailyRow[]): DayInput {
  const items: DayItem[] = rows.map((r) => ({
    id: r.id,
    size: r.size,
    done: r.done,
    recovery: r.recovery,
    kind: r.habitKind,
    weekly: r.weekly,
  }))
  return {
    type: day?.type ?? null,
    prevType,
    sleepNight: day?.sleepNight ?? null,
    nap: day?.nap ?? 0,
    workEnd: day?.workEnd ?? null,
    items,
  }
}

/**
 * Habit "berhenti kerja" mengikuti aturan: hilang bila batas dimatikan, dan jam di namanya
 * (mis. "≤ 21.00") ikut batas yang dipilih.
 */
export function withWorkEndRule<T extends Pick<Habit, 'kind' | 'name'>>(habits: T[], limit: string | null): T[] {
  if (!limit) return habits.filter((h) => h.kind !== 'workend')
  return habits.map((h) => (h.kind === 'workend' ? { ...h, name: h.name.replace(/\d{1,2}[.:]\d{2}/, limit) } : h))
}

export interface DayData {
  days: Day[]
  tasks: Task[]
  /** Habit sudah digabung dengan bawaan. */
  habits: Habit[]
  logs: HabitLog[]
  /** Peran sudah digabung dengan bawaan. */
  roles: Role[]
  sessions: Pick<TentirSession, 'date' | 'start' | 'hours'>[]
}

/** Hasil XP semua hari bertipe sampai `today`. Hari beku memakai hasil bekunya. */
export function computeResults(
  { days, tasks, habits, logs, roles, sessions }: DayData,
  today: ISODate,
  rules: XpRules,
): Map<ISODate, DayResult> {
  const byDate = new Map(days.map((d) => [d.date, d]))
  const tasksByDate = groupBy(tasks, (t) => t.date)
  const logsByWeek = groupBy(logs, (l) => weekStart(l.date))
  const sessionsByDate = groupBy(sessions, (x) => x.date)
  const results = new Map<ISODate, DayResult>()
  for (const day of days) {
    if (day.date > today || !day.type) continue
    if (day.frozen) {
      results.set(day.date, day.frozen)
      continue
    }
    const prevType = byDate.get(addDays(day.date, -1))?.type ?? null
    const rows = dailyRows(
      day.date,
      day.type,
      tasksByDate.get(day.date) ?? [],
      habits,
      logsByWeek.get(weekStart(day.date)) ?? [],
      roles,
      sessionsByDate.get(day.date) ?? [],
      rules.workEndLimit,
    )
    results.set(day.date, computeDay(toDayInput(day, prevType, rows), rules, { final: isLocked(day.date, today, rules) }))
  }
  return results
}

function groupBy<T>(list: T[], key: (item: T) => string): Map<string, T[]> {
  const map = new Map<string, T[]>()
  for (const item of list) {
    const k = key(item)
    const arr = map.get(k)
    if (arr) arr.push(item)
    else map.set(k, [item])
  }
  return map
}
