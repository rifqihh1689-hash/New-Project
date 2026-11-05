import type {
  Chapter,
  Day,
  DayResult,
  DayType,
  Debt,
  Habit,
  HabitLog,
  MainQuest,
  MutabaahItem,
  MutabaahLog,
  Review,
  Saving,
  XpRules,
  XpSize,
} from '../types'
import { detectPatientIdentity } from './phi'
import { guessRole, type RoleRef } from './quickCapture'
import { addDays, isValidISODate } from './time'

/**
 * Impor file export MBAPPE OS (levelup, schemaVersion 1–2) ke model Qawwam.
 * Fungsi murni: hanya menyusun rencana; penulisan (dengan aturan "Qawwam menang") ada di db/mbappe.ts.
 */

type Obj = Record<string, unknown>
const isObj = (v: unknown): v is Obj => typeof v === 'object' && v !== null && !Array.isArray(v)
const str = (v: unknown) => (typeof v === 'string' ? v : '')
const num = (v: unknown): number | null => (typeof v === 'number' && Number.isFinite(v) ? v : null)

const TYPE_MAP: Record<string, DayType> = { NORMAL: 'stase', JAGA: 'jaga', PASCA: 'pasca', LIBUR: 'libur' }

/** Quest MBAPPE yang sudah punya padanan habit bawaan Qawwam. */
const HABIT_EQUIV: Record<string, string> = {
  q_sleep: '#habit:sleep',
  q_workend: '#habit:workend',
  j_nap: '#habit:jaga-nap',
  p_rest: '#habit:pasca-rest',
  p_eat: '#habit:pasca-eat',
  p_walk: '#habit:pasca-walk',
}
/** Quest khusus yang tidak menjadi habit (dinilai otomatis, atau modulnya belum ada). */
const SKIP_TAGS = new Set(['tentir', 'sdwalk'])

const MUT_EQUIV: Record<string, string> = { m_qiyam: '#mut:qiyam', m_subuh: '#mut:subuh' }

const STAT_ROLE: Record<string, string> = {
  VIT: '#role:pulih',
  STR: '#role:pulih',
  INT: '#role:ukmppd',
  RSC: '#role:orto',
  GLD: '#role:uang',
  CHA: '#role:orto',
}

const RULE_KEYS = [
  'xpSize',
  'dailyCap',
  'sleepTiers',
  'sleepQuestMin',
  'napCounts',
  'worstCaseEmpty',
  'passPct',
  'jagaMult',
  'pascaXP',
  'overtimePenalty',
  'levelBase',
  'levelStep',
  'backfillDays',
] as const

export interface MbappePlan {
  days: Day[]
  habits: Habit[]
  habitLogs: HabitLog[]
  mutabaah: MutabaahItem[]
  mutabaahLogs: MutabaahLog[]
  chapters: Chapter[]
  mainQuests: MainQuest[]
  reviews: Review[]
  debts: Debt[]
  savings: Saving[]
  rules: Partial<XpRules>
  tentirCapacity: { min: number; max: number } | null
  /** Ringkasan untuk pratinjau. */
  stats: {
    frozenDays: number
    totalXp: number
    skippedSample: number
    notesDropped: number
    weeklyQuests: string[]
    notImported: string[]
  }
}

export function isMbappeExport(value: unknown): value is Obj {
  return (
    isObj(value) &&
    isObj(value.days) &&
    Array.isArray(value.quests) &&
    (value.schemaVersion === undefined || typeof value.schemaVersion === 'number')
  )
}

/** Coba baca teks/berkas sebagai export MBAPPE OS. */
export function parseMbappe(text: string): Obj | null {
  try {
    const data: unknown = JSON.parse(text)
    return isMbappeExport(data) ? data : null
  } catch {
    return null
  }
}

function mapResult(f: Obj): DayResult {
  const effType = TYPE_MAP[str(f.effType)] ?? null
  return {
    xp: num(f.xp) ?? 0,
    gross: num(f.gross) ?? 0,
    base: num(f.base) ?? 0,
    capped: num(f.capped) ?? 0,
    mult: num(f.mult) ?? 1,
    multMissing: f.multMissing === true,
    penalty: num(f.penalty) ?? 0,
    pass: f.pass === true,
    total: num(f.total) ?? 0,
    doneCount: num(f.doneCount) ?? 0,
    effType,
    invalidPasca: f.invalidPasca === true,
  }
}

const sizeOf = (v: unknown): XpSize => (v === 'kecil' || v === 'besar' ? v : 'sedang')

export function convertMbappe(data: Obj, roles: RoleRef[], now: number = Date.now()): MbappePlan {
  const stats: MbappePlan['stats'] = { frozenDays: 0, totalXp: 0, skippedSample: 0, notesDropped: 0, weeklyQuests: [], notImported: [] }
  const isSample = (o: unknown) => isObj(o) && o.sample === true
  const habitIdFor = new Map<string, string>()
  const habits: Habit[] = []

  // Quest → habit.
  const quests = (data.quests as unknown[]).filter(isObj)
  quests.forEach((q, i) => {
    const qid = str(q.id)
    if (!qid) return
    if (HABIT_EQUIV[qid]) {
      habitIdFor.set(qid, HABIT_EQUIV[qid])
      return
    }
    if (SKIP_TAGS.has(str(q.tag))) return
    if (q.freq === 'weekly') {
      stats.weeklyQuests.push(str(q.name))
      return
    }
    const id = `#mbp:habit:${qid}`
    habitIdFor.set(qid, id)
    const name = str(q.name).trim() || qid
    const types = Array.isArray(q.types) ? (q.types as unknown[]).map((t) => TYPE_MAP[str(t)]).filter(Boolean) : []
    habits.push({
      id,
      name,
      roleId: guessRole(name, roles) ?? STAT_ROLE[str(q.stat)] ?? '#role:pulih',
      size: sizeOf(q.size),
      dayTypes: types.length ? types : ['stase', 'libur'],
      weekdays: Array.isArray(q.days) ? (q.days as unknown[]).filter((d): d is number => typeof d === 'number' && d >= 0 && d <= 6) : [],
      minutes: null,
      kind: 'normal',
      active: q.active !== false,
      order: 100 + i,
      createdAt: now,
      updatedAt: now,
    })
  })

  // Mutaba'ah.
  const mutIdFor = new Map<string, string>()
  const mutabaah: MutabaahItem[] = []
  const mutList = Array.isArray(data.mutabaah) ? (data.mutabaah as unknown[]).filter(isObj) : []
  mutList.forEach((m, i) => {
    const mid = str(m.id)
    if (!mid) return
    if (MUT_EQUIV[mid]) {
      mutIdFor.set(mid, MUT_EQUIV[mid])
      return
    }
    const id = `#mbp:mut:${mid}`
    mutIdFor.set(mid, id)
    mutabaah.push({ id, name: str(m.name).trim() || mid, order: 50 + i, archived: false, createdAt: now, updatedAt: now })
  })

  // Hari + log.
  const days: Day[] = []
  const habitLogs: HabitLog[] = []
  const mutabaahLogs: MutabaahLog[] = []
  for (const [date, raw] of Object.entries(data.days as Obj)) {
    if (!isValidISODate(date) || !isObj(raw)) continue
    if (isSample(raw)) {
      stats.skippedSample++
      continue
    }
    const type = TYPE_MAP[str(raw.type)] ?? null
    let note = str(raw.note)
    if (note && detectPatientIdentity(note)) {
      note = ''
      stats.notesDropped++
    }
    const day: Day = {
      id: `#day:${date}`,
      date,
      type,
      sleepNight: num(raw.sleep),
      nap: num(raw.nap) ?? 0,
      workEnd: raw.workEnd === 'ok' || raw.workEnd === 'late' ? raw.workEnd : null,
      note,
      updatedAt: now,
    }
    if (isObj(raw.frozen)) {
      day.frozen = mapResult(raw.frozen)
      stats.frozenDays++
      stats.totalXp += day.frozen.xp
    }
    if (type || day.frozen || note) days.push(day)
    if (isObj(raw.done))
      for (const [qid, done] of Object.entries(raw.done)) {
        const habitId = habitIdFor.get(qid)
        // Habit otomatis (tidur, jam kerja) tidak butuh log.
        if (done === true && habitId && habitId !== '#habit:sleep' && habitId !== '#habit:workend')
          habitLogs.push({ id: `#hl:${habitId}:${date}`, habitId, date, done: true, updatedAt: now })
      }
    if (isObj(raw.mut))
      for (const [mid, done] of Object.entries(raw.mut)) {
        const itemId = mutIdFor.get(mid)
        if (done === true && itemId) mutabaahLogs.push({ id: `#ml:${itemId}:${date}`, itemId, date, done: true, updatedAt: now })
      }
  }

  // Stase.
  const chapters: Chapter[] = []
  for (const c of Array.isArray(data.chapters) ? (data.chapters as unknown[]).filter(isObj) : []) {
    if (isSample(c)) {
      stats.skippedSample++
      continue
    }
    const start = str(c.start)
    const end = str(c.end)
    if (!isValidISODate(start) || !isValidISODate(end)) continue
    const weight = c.weight === 'ringan' || c.weight === 'berat' ? c.weight : 'sedang'
    chapters.push({
      id: `#mbp:chp:${str(c.id) || start}`,
      name: str(c.name) || 'Stase',
      start,
      end,
      weight,
      createdAt: now,
      updatedAt: now,
    })
  }

  // Main Quest.
  const mainQuests: MainQuest[] = []
  for (const q of Array.isArray(data.mainQuests) ? (data.mainQuests as unknown[]).filter(isObj) : []) {
    if (isSample(q)) {
      stats.skippedSample++
      continue
    }
    const status = q.status === 'beku' || q.status === 'selesai' ? q.status : 'aktif'
    mainQuests.push({
      id: `#mbp:mq:${str(q.id)}`,
      name: str(q.name) || 'Main Quest',
      roleId: STAT_ROLE[str(q.stat)] ?? '#role:orto',
      status,
      next: str(q.next),
      progress: status === 'selesai' ? 1 : 0,
      doneAt: isValidISODate(str(q.doneAt)) ? Date.parse(`${str(q.doneAt)}T12:00:00+07:00`) : null,
      createdAt: isValidISODate(str(q.createdAt)) ? Date.parse(`${str(q.createdAt)}T12:00:00+07:00`) : now,
      updatedAt: now,
    })
  }

  // Mingguan → Muhasabah (prioritas & Raid), plus angka utang/dana jembatan terakhir.
  const reviews: Review[] = []
  const settings = isObj(data.settings) ? data.settings : {}
  let lastDebt: { date: string; value: number } | null = null
  let lastBridge: { date: string; value: number } | null = null
  for (const [monday, raw] of Object.entries(isObj(data.weekly) ? data.weekly : {})) {
    if (!isValidISODate(monday) || !isObj(raw)) continue
    if (isSample(raw)) {
      stats.skippedSample++
      continue
    }
    const priorities = Array.isArray(raw.priorities) ? (raw.priorities as unknown[]).map(str).slice(0, 3) : []
    const done = raw.raidDone === true
    const debt = num(raw.debt)
    const bridge = num(raw.bridge)
    if (debt != null && (!lastDebt || monday > lastDebt.date)) lastDebt = { date: monday, value: debt }
    if (bridge != null && (!lastBridge || monday > lastBridge.date)) lastBridge = { date: monday, value: bridge }
    if (!done && !priorities.some((p) => p.trim())) continue
    const xp = done ? (num(raw.raidXP) ?? num(settings.raidXP) ?? 50) : undefined
    if (xp) stats.totalXp += xp
    const numbers: Record<string, number | null> = {}
    if (isObj(raw.snapshot)) for (const [k, v] of Object.entries(raw.snapshot)) if (typeof v === 'number' || v === null) numbers[k] = v
    const raidAt = str(raw.raidAt)
    reviews.push({
      id: `#rev:minggu:${monday}`,
      period: 'minggu',
      start: monday,
      priorities: [0, 1, 2].map((i) => (detectPatientIdentity(priorities[i] ?? '') ? '' : (priorities[i] ?? ''))),
      wins: '',
      stuck: '',
      focus: '',
      numbers,
      completedAt: done ? Date.parse(`${isValidISODate(raidAt) ? raidAt : addDays(monday, 6)}T20:00:00+07:00`) : null,
      ...(xp ? { xp } : {}),
      updatedAt: now,
    })
  }

  // Keuangan (dilewati bila data contoh).
  const debts: Debt[] = []
  const savings: Saving[] = []
  const finance = isObj(data.finance) && !isSample(data.finance) ? data.finance : null
  if (finance) {
    const initial = num(finance.debtInitial)
    if (initial) {
      const paid = lastDebt ? Math.max(0, initial - lastDebt.value) : 0
      debts.push({
        id: '#mbp:debt:utama',
        name: 'Utang (dari MBAPPE OS)',
        initial,
        targetDate: isValidISODate(str(finance.debtTargetDate)) ? str(finance.debtTargetDate) : null,
        payments: paid && lastDebt ? [{ date: addDays(lastDebt.date, 6), amount: paid }] : [],
        createdAt: now,
        updatedAt: now,
      })
    }
    const target = num(finance.bridgeTarget)
    if (target) {
      savings.push({
        id: '#mbp:saving:jembatan',
        name: 'Dana jembatan',
        kind: 'jembatan',
        target,
        targetDate: isValidISODate(str(finance.bridgeTargetDate)) ? str(finance.bridgeTargetDate) : null,
        deposits: lastBridge && lastBridge.value > 0 ? [{ date: addDays(lastBridge.date, 6), amount: lastBridge.value }] : [],
        createdAt: now,
        updatedAt: now,
      })
    }
  }

  // Aturan XP yang diubah di Setelan MBAPPE OS.
  const rules: Partial<XpRules> = {}
  for (const k of RULE_KEYS) if (settings[k] !== undefined) (rules as Record<string, unknown>)[k] = settings[k]
  if (num(settings.raidXP) != null) rules.reviewXP = num(settings.raidXP)!
  const tMin = num(settings.tentirMin)
  const tMax = num(settings.tentirMax)

  for (const [key, label] of [
    ['workouts', 'log latihan (bench/lari)'],
    ['rewards', 'hadiah'],
    ['claims', 'klaim hadiah'],
  ] as const)
    if (Array.isArray(data[key]) && (data[key] as unknown[]).some((x) => !isSample(x))) stats.notImported.push(label)
  if (Object.values(data.days as Obj).some((d) => isObj(d) && isObj(d.tentir) && (num(d.tentir.jam) ?? 0) > 0))
    stats.notImported.push('jam tentir harian')

  return {
    days,
    habits,
    habitLogs,
    mutabaah,
    mutabaahLogs,
    chapters,
    mainQuests,
    reviews,
    debts,
    savings,
    rules,
    tentirCapacity: tMin != null && tMax != null ? { min: tMin, max: tMax } : null,
    stats,
  }
}
