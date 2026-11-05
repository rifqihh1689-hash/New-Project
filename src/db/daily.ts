import { isAllowedOnDayType } from '../domain/dayType'
import { applyMinutes } from '../domain/habitGrid'
import { detectPatientIdentity } from '../domain/phi'
import { addDays, weekStart } from '../domain/time'
import { computeDay, habitsForDay, isLocked, type DayInput, type DayItem } from '../domain/xp'
import { createId, privateId } from '../lib/id'
import type { Day, DayResult, DayType, Habit, HabitLog, ISODate, Role, Task, WorkEnd, XpRules, XpSize } from '../types'
import { db } from './db'
import { DEFAULT_ROLE_ID } from './defaults'
import { loadHabits, loadProfile, loadRoles, rulesOf } from './structure'

// ---------- Hari ----------

export function newDay(date: ISODate): Day {
  return { id: privateId.day(date), date, type: null, sleepNight: null, nap: 0, workEnd: null, note: '', updatedAt: Date.now() }
}

async function putDay(date: ISODate, change: (day: Day) => Partial<Day>): Promise<void> {
  await db.transaction('rw', db.days, async () => {
    const day = (await db.days.get(privateId.day(date))) ?? newDay(date)
    // Hari beku tetap bisa diberi catatan, tapi hasil XP-nya tidak dihitung ulang.
    await db.days.put({ ...day, ...change(day), id: day.id, date, updatedAt: Date.now() })
  })
}

/**
 * Memilih tipe hari. Saat pasca-jaga, tugas yang belum selesai dan bukan pemulihan pindah ke besok.
 * Mengembalikan ID tugas yang dipindah (untuk tombol Urungkan).
 */
export async function setDayType(date: ISODate, type: DayType | null): Promise<string[]> {
  let moved: string[] = []
  const roles = await loadRoles()
  const recovery = new Set(roles.filter((r) => r.recovery).map((r) => r.id))
  await db.transaction('rw', db.days, db.tasks, async () => {
    await putDay(date, () => ({ type }))
    if (type !== 'pasca') return
    const tasks = await db.tasks.where('date').equals(date).toArray()
    const toMove = tasks.filter((t) => !t.done && !isAllowedOnDayType('pasca', { recovery: recovery.has(t.roleId) }))
    const tomorrow = addDays(date, 1)
    const now = Date.now()
    await db.tasks.bulkPut(toMove.map((t) => ({ ...t, date: tomorrow, updatedAt: now })))
    moved = toMove.map((t) => t.id)
  })
  return moved
}

export const setSleep = (date: ISODate, sleepNight: number | null, nap: number) =>
  putDay(date, () => ({ sleepNight: sleepNight == null ? null : clampHours(sleepNight), nap: clampHours(nap) }))

export const setWorkEnd = (date: ISODate, workEnd: WorkEnd | null) => putDay(date, () => ({ workEnd }))

const clampHours = (h: number) => Math.round(Math.min(Math.max(h, 0), 16) * 4) / 4

// ---------- Tugas ----------

export interface TaskDraft {
  title: string
  roleId?: string | null
  date: ISODate
  important?: boolean
  size?: XpSize
  due?: ISODate | null
  source?: Task['source']
}

export class PatientIdentityError extends Error {
  constructor(reason: string) {
    super(`Terdeteksi pola mirip identitas pasien (${reason}). Hapus dulu sebelum menyimpan.`)
  }
}

/** Menolak teks yang mirip identitas pasien. Dipakai di semua kolom teks. */
export function assertNoPatientIdentity(...texts: string[]): void {
  for (const t of texts) {
    const reason = detectPatientIdentity(t)
    if (reason) throw new PatientIdentityError(reason)
  }
}

export async function addTask(draft: TaskDraft): Promise<Task> {
  const title = draft.title.trim()
  if (!title) throw new Error('Judul tugas kosong.')
  assertNoPatientIdentity(title)
  const now = Date.now()
  const task: Task = {
    id: createId('tsk'),
    title,
    roleId: draft.roleId || DEFAULT_ROLE_ID,
    date: draft.date,
    due: draft.due ?? null,
    important: !!draft.important,
    size: draft.size ?? 'sedang',
    subtasks: [],
    done: false,
    doneAt: null,
    source: draft.source ?? 'manual',
    createdAt: now,
    updatedAt: now,
  }
  await db.tasks.add(task)
  return task
}

export async function updateTask(id: string, changes: Partial<Omit<Task, 'id' | 'createdAt'>>): Promise<void> {
  if (changes.title !== undefined) {
    changes.title = changes.title.trim()
    if (!changes.title) throw new Error('Judul tugas kosong.')
    assertNoPatientIdentity(changes.title)
  }
  if (changes.subtasks) {
    changes.subtasks = changes.subtasks.map((st) => ({ ...st, title: st.title.trim() })).filter((st) => st.title)
    assertNoPatientIdentity(...changes.subtasks.map((st) => st.title))
  }
  await db.tasks.update(id, { ...changes, updatedAt: Date.now() })
}

/** Centang/batal satu subtugas tanpa membuka editor. */
export async function toggleSubtask(task: Task, subtaskId: string): Promise<void> {
  const subtasks = task.subtasks.map((st) => (st.id === subtaskId ? { ...st, done: !st.done } : st))
  await db.tasks.update(task.id, { subtasks, updatedAt: Date.now() })
}

export async function toggleTask(task: Task): Promise<void> {
  const done = !task.done
  await db.tasks.update(task.id, { done, doneAt: done ? Date.now() : null, updatedAt: Date.now() })
}

export async function deleteTask(id: string): Promise<Task | undefined> {
  const task = await db.tasks.get(id)
  await db.tasks.delete(id)
  return task
}

export async function restoreTask(task: Task): Promise<void> {
  await db.tasks.put(task)
}

export async function moveTasks(ids: string[], date: ISODate): Promise<void> {
  const now = Date.now()
  await db.transaction('rw', db.tasks, async () => {
    for (const id of ids) await db.tasks.update(id, { date, updatedAt: now })
  })
}

/** "Tutup hari": pindahkan tugas yang belum selesai ke besok. */
export async function moveUndoneToTomorrow(date: ISODate): Promise<string[]> {
  const ids = (await db.tasks.where('date').equals(date).toArray()).filter((t) => !t.done).map((t) => t.id)
  await moveTasks(ids, addDays(date, 1))
  return ids
}

export function sortTasks(tasks: Task[]): Task[] {
  return [...tasks].sort(
    (a, b) => Number(a.done) - Number(b.done) || Number(b.important) - Number(a.important) || a.createdAt - b.createdAt,
  )
}

// ---------- Habit & mutaba'ah ----------

export async function setHabitDone(habitId: string, date: ISODate, done: boolean): Promise<void> {
  const id = privateId.habitLog(habitId, date)
  await db.transaction('rw', db.habitLogs, async () => {
    const prev = await db.habitLogs.get(id)
    await db.habitLogs.put({ ...prev, id, habitId, date, done, updatedAt: Date.now() })
  })
}

/** Menambah (atau mengurangi) menit habit hari itu; selesai otomatis bila mencapai target. */
export async function addHabitMinutes(habit: Pick<Habit, 'id' | 'minutes'>, date: ISODate, delta: number): Promise<void> {
  const id = privateId.habitLog(habit.id, date)
  await db.transaction('rw', db.habitLogs, async () => {
    const prev = await db.habitLogs.get(id)
    const next = applyMinutes(prev?.minutes ?? 0, delta, habit.minutes)
    await db.habitLogs.put({ ...prev, id, habitId: habit.id, date, ...next, updatedAt: Date.now() })
  })
}

export async function setMutabaahDone(itemId: string, date: ISODate, done: boolean): Promise<void> {
  await db.mutabaahLogs.put({ id: privateId.mutabaahLog(itemId, date), itemId, date, done, updatedAt: Date.now() })
}

// ---------- Hitung hari ----------

export interface DailyRow {
  kind: 'task' | 'habit'
  id: string
  title: string
  roleId: string
  size: XpSize
  done: boolean
  recovery: boolean
  habitKind?: Habit['kind']
  important?: boolean
  task?: Task
  /** Quest mingguan (1× per minggu, di luar syarat lolos). */
  weekly?: boolean
  /** Quest mingguan yang sudah selesai di hari lain minggu ini. */
  doneOn?: ISODate | null
}

export interface DaySnapshot {
  date: ISODate
  day: Day | null
  prevType: DayType | null
  rows: DailyRow[]
  result: DayResult
  frozen: boolean
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
  const habitRows: DailyRow[] = habitsForDay(habits, date, type).map((h) => {
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
  return [...taskRows, ...habitRows]
}

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

/** Data satu hari lengkap dengan hasil XP-nya (hasil beku bila hari sudah terkunci). */
export async function loadDaySnapshot(date: ISODate, today: ISODate): Promise<DaySnapshot & { rules: XpRules }> {
  const [day, prev, tasks, habits, logs, roles, profile] = await Promise.all([
    db.days.get(privateId.day(date)),
    db.days.get(privateId.day(addDays(date, -1))),
    db.tasks.where('date').equals(date).toArray(),
    loadHabits(),
    db.habitLogs
      .where('date')
      .between(weekStart(date), addDays(weekStart(date), 6), true, true)
      .toArray(),
    loadRoles(),
    loadProfile(),
  ])
  const rules = rulesOf(profile)
  const rows = dailyRows(date, day?.type ?? null, tasks, habits, logs, roles)
  const prevType = prev?.type ?? null
  const result = day?.frozen ?? computeDay(toDayInput(day ?? null, prevType, rows), rules, { final: isLocked(date, today, rules) })
  return { date, day: day ?? null, prevType, rows, result, frozen: !!day?.frozen, rules }
}

/**
 * Semua hasil harian untuk XP total & streak. Hari beku memakai hasil bekunya;
 * hari lain dihitung dari data saat ini.
 */
export async function loadAllResults(
  today: ISODate,
): Promise<{ results: Map<ISODate, DayResult>; firstDate: ISODate | null; rules: XpRules }> {
  const [days, tasks, habits, logs, roles, profile] = await Promise.all([
    db.days.toArray(),
    db.tasks.toArray(),
    loadHabits(),
    db.habitLogs.toArray(),
    loadRoles(),
    loadProfile(),
  ])
  const rules = rulesOf(profile)
  const byDate = new Map(days.map((d) => [d.date, d]))
  const tasksByDate = groupBy(tasks, (t) => t.date)
  const logsByWeek = groupBy(logs, (l) => weekStart(l.date))
  const results = new Map<ISODate, DayResult>()
  for (const day of days) {
    if (day.date > today || !day.type) continue
    if (day.frozen) {
      results.set(day.date, day.frozen)
      continue
    }
    const prevType = byDate.get(addDays(day.date, -1))?.type ?? null
    const rows = dailyRows(day.date, day.type, tasksByDate.get(day.date) ?? [], habits, logsByWeek.get(weekStart(day.date)) ?? [], roles)
    results.set(day.date, computeDay(toDayInput(day, prevType, rows), rules, { final: isLocked(day.date, today, rules) }))
  }
  const dates = [...results.keys()].sort()
  return { results, firstDate: dates[0] ?? null, rules }
}

/** Membekukan hari yang lewat jendela isi mundur (dijalankan saat app dibuka & ganti hari). */
export async function freezeLockedDays(today: ISODate): Promise<number> {
  const { results, rules } = await loadAllResults(today)
  const toFreeze = (await db.days.toArray()).filter((d) => d.type && !d.frozen && isLocked(d.date, today, rules) && results.has(d.date))
  if (!toFreeze.length) return 0
  await db.days.bulkPut(toFreeze.map((d) => ({ ...d, frozen: results.get(d.date)!, updatedAt: Date.now() })))
  return toFreeze.length
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
