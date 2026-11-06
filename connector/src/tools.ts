/**
 * Alat (tools) connector Qawwam untuk Claude. Semua perhitungan memakai kode domain app yang sama
 * (src/domain, src/db/defaults), jadi XP, level, resep latihan, dan pratinjau usulan identik dengan app.
 * Hanya `propose` yang menulis, dan itu pun ke tabel `proposals` (disetujui pengguna di app).
 */
import {
  DEFAULT_EXERCISES,
  DEFAULT_HABITS,
  DEFAULT_MUTABAAH,
  DEFAULT_PHASES,
  DEFAULT_PROFILE,
  DEFAULT_RITME,
  DEFAULT_ROLES,
  mergeWithDefaults,
} from '../../src/db/defaults'
import { computeResults, dailyRows } from '../../src/domain/dayRows'
import { inDay, muscleOf, nextDay, SPLITS } from '../../src/domain/exerciseCatalog'
import { IMPORT_ITEM_GUIDE } from '../../src/domain/importGuide'
import { describeItem, itemLabel, parseImport } from '../../src/domain/importer'
import { categoriesFor, categoryLookup, mergeCategories, summarize as summarizeMoney } from '../../src/domain/money'
import { currentPhase } from '../../src/domain/phase'
import { detectPatientIdentity } from '../../src/domain/phi'
import { computeStreak, dayStatus, levelFromXp } from '../../src/domain/progress'
import { bridgeStatus, tokensLeft } from '../../src/domain/rewards'
import { resolveRules } from '../../src/domain/rules'
import { sleepTotal } from '../../src/domain/sleep'
import { dayTentir, DEFAULT_TENTIR_RATE, summarize as summarizeTentir } from '../../src/domain/tentir'
import { addDays, dayKey, diffDays, isValidISODate, weekStart } from '../../src/domain/time'
import {
  DEFAULT_TARGETS,
  estimate5k,
  exerciseHistory,
  planRunWeek,
  prescribe,
  projectTarget,
  readiness,
  runsOf,
  weeklyKm,
} from '../../src/domain/training'
import { reviewXpTotal } from '../../src/domain/weekly'
import { createId } from '../../src/lib/id'
import type {
  Category,
  Chapter,
  Claim,
  Day,
  Debt,
  Exercise,
  Habit,
  HabitLog,
  MainQuest,
  MutabaahItem,
  MutabaahLog,
  Phase,
  Profile,
  Proposal,
  Review,
  Role,
  Saving,
  Task,
  TentirSession,
  Transaction,
  Workout,
} from '../../src/types'
import type { Store } from './dexie'

export class ToolError extends Error {}

export interface ToolDef {
  name: string
  title: string
  description: string
  inputSchema: Record<string, unknown>
  readOnly: boolean
  run(args: Record<string, unknown>, ctx: ToolContext): Promise<unknown>
}

export interface ToolContext {
  store: Store
  /** Waktu sekarang (ms); bisa diganti di tes. */
  now: number
}

// ---------- Muat data dengan bawaan ----------

async function loadBase(store: Store) {
  const [profiles, roles, habits, phases, mutabaah] = await Promise.all([
    store.all<Profile>('profile'),
    store.all<Role>('lifeRoles'),
    store.all<Habit>('habits'),
    store.all<Phase>('phases'),
    store.all<MutabaahItem>('mutabaah'),
  ])
  const stored = profiles.find((p) => p.id === DEFAULT_PROFILE.id)
  const profile: Profile = { ...DEFAULT_PROFILE, ...stored, ritme: { ...DEFAULT_RITME, ...stored?.ritme } }
  return {
    profile,
    rules: resolveRules(profile.rules),
    roles: mergeWithDefaults(DEFAULT_ROLES, roles),
    habits: mergeWithDefaults(DEFAULT_HABITS, habits),
    phases: mergeWithDefaults(DEFAULT_PHASES, phases),
    mutabaah: mergeWithDefaults(DEFAULT_MUTABAAH, mutabaah),
  }
}

async function loadDays(store: Store) {
  const [days, tasks, logs, sessions, reviews] = await Promise.all([
    store.all<Day>('days'),
    store.all<Task>('tasks'),
    store.all<HabitLog>('habitLogs'),
    store.all<TentirSession>('tentirSessions'),
    store.all<Review>('reviews'),
  ])
  return { days, tasks, logs, sessions, reviews }
}

const round1 = (n: number) => Math.round(n * 10) / 10

function dateArg(args: Record<string, unknown>, key: string, fallback: string): string {
  const v = args[key]
  if (v == null || v === '') return fallback
  if (!isValidISODate(v)) throw new ToolError(`${key} harus tanggal YYYY-MM-DD.`)
  return v
}

function range(args: Record<string, unknown>, today: string, defaultDays: number, maxDays: number) {
  const to = dateArg(args, 'to', today)
  const from = dateArg(args, 'from', addDays(to, -(defaultDays - 1)))
  if (from > to) throw new ToolError('from harus ≤ to.')
  if (diffDays(to, from) >= maxDays) throw new ToolError(`Rentang maksimal ${maxDays} hari.`)
  return { from, to }
}

// ---------- Alat ----------

const getOverview: ToolDef = {
  name: 'get_overview',
  title: 'Ringkasan Qawwam',
  description:
    "Konteks pengguna saat ini: tanggal hari Qawwam (WIB, berganti 03.00), tipe hari ini, fase hidup, stase berjalan & berikutnya, level/XP/streak, peran, habit aktif, mutaba'ah, Main Quest aktif, aturan XP, kuota & tarif tentir, setelan makan, target latihan, dana jembatan, uang (kategori, utang & sisanya, tabungan), jumlah usulan menunggu. Panggil ini dulu sebelum alat lain.",
  inputSchema: { type: 'object', properties: {}, additionalProperties: false },
  readOnly: true,
  async run(_args, { store, now }) {
    const today = dayKey(now)
    const [base, d, chapters, quests, savings, debts, claims, proposals, storedCats] = await Promise.all([
      loadBase(store),
      loadDays(store),
      store.all<Chapter>('chapters'),
      store.all<MainQuest>('mainQuests'),
      store.all<Saving>('savings'),
      store.all<Debt>('debts'),
      store.all<Claim>('claims'),
      store.all<Proposal>('proposals'),
      store.all<Category>('categories'),
    ])
    const categories = mergeCategories(storedCats)
    const results = computeResults({ ...d, habits: base.habits, roles: base.roles }, today, base.rules)
    const totalXp = [...results.values()].reduce((a, r) => a + r.xp, 0) + reviewXpTotal(d.reviews, base.rules)
    const level = levelFromXp(totalXp, base.rules)
    const firstDate = [...results.keys()].sort()[0] ?? null
    const streak = computeStreak(today, firstDate, (x) => dayStatus(results.get(x)))
    const day = d.days.find((x) => x.date === today)
    const phase = currentPhase(base.phases, today)
    const bridge = bridgeStatus(savings)
    return {
      today,
      dayType: day?.type ?? null,
      phase: phase && { name: phase.name, start: phase.start, end: phase.end },
      stase: chapters
        .filter((c) => c.end >= today)
        .sort((a, b) => a.start.localeCompare(b.start))
        .slice(0, 3)
        .map(({ name, start, end, weight, masuk, pulang }) => ({ name, start, end, weight, masuk, pulang })),
      level: {
        level: level.level,
        totalXp,
        xpIntoLevel: level.into,
        xpForNext: level.need,
        rewardTokens: tokensLeft(level.level, claims.length),
      },
      streak,
      roles: base.roles.filter((r) => !r.archived).map((r) => ({ id: r.id, name: r.name, recovery: r.recovery })),
      habits: base.habits
        .filter((h) => h.active)
        .map((h) => ({
          id: h.id,
          name: h.name,
          dayTypes: h.dayTypes,
          weekdays: h.weekdays,
          minutes: h.minutes,
          size: h.size,
          freq: h.freq ?? 'daily',
          roleId: h.roleId,
          note: h.note,
        })),
      mutabaah: base.mutabaah.filter((m) => !m.archived).map((m) => m.name),
      mainQuests: quests.filter((q) => q.status === 'aktif').map(({ name, roleId, next, progress }) => ({ name, roleId, next, progress })),
      xpRules: base.rules,
      ritme: base.profile.ritme,
      tentir: { capacityHoursPerWeek: base.profile.tentirCapacity, ratePerHour: base.profile.tentirRate ?? DEFAULT_TENTIR_RATE },
      nutrition: base.profile.nutrition ?? null,
      trainingTargets: { ...DEFAULT_TARGETS, ...base.profile.trainingTargets },
      bridgeFund: bridge.target == null ? null : { target: bridge.target, saved: bridge.saved },
      debtLeft: debts.reduce((a, x) => a + x.initial - x.payments.reduce((p, y) => p + y.amount, 0), 0),
      // Nama yang dipakai item keuangan di propose (kategori, utang untuk cicilan, tabungan untuk setoran).
      uang: {
        kategoriPengeluaran: categoriesFor('expense', categories).map((c) => c.name),
        kategoriPemasukan: categoriesFor('income', categories).map((c) => c.name),
        utang: debts.map((x) => ({ nama: x.name, sisa: x.initial - x.payments.reduce((p, y) => p + y.amount, 0), target: x.targetDate })),
        tabungan: savings.map((x) => ({
          nama: x.name,
          jenis: x.kind,
          terkumpul: x.deposits.reduce((p, y) => p + y.amount, 0),
          target: x.target,
        })),
      },
      pendingProposals: proposals.filter((p) => p.status === 'menunggu').length,
    }
  },
}

const getSummary: ToolDef = {
  name: 'get_summary',
  title: 'Ringkasan periode',
  description:
    "Ringkasan per hari dan total untuk rentang tanggal (maks. 120 hari; bawaan 7 hari terakhir): tipe hari, total tidur 24 jam, XP, lolos, tugas & habit selesai, mutaba'ah, jam tentir, latihan, lembur; plus total per peran, rata-rata tidur di luar jaga, jam & pemasukan tentir, km lari, pemasukan/pengeluaran per kategori. Cocok untuk Muhasabah mingguan/bulanan.",
  inputSchema: {
    type: 'object',
    properties: {
      from: { type: 'string', description: 'YYYY-MM-DD (bawaan: 6 hari sebelum to)' },
      to: { type: 'string', description: 'YYYY-MM-DD (bawaan: hari ini)' },
    },
    additionalProperties: false,
  },
  readOnly: true,
  async run(args, { store, now }) {
    const today = dayKey(now)
    const { from, to } = range(args, today, 7, 120)
    const [base, d, mutLogs, workouts, txs, storedCats] = await Promise.all([
      loadBase(store),
      loadDays(store),
      store.all<MutabaahLog>('mutabaahLogs'),
      store.all<Workout>('workouts'),
      store.all<Transaction>('transactions'),
      store.all<Category>('categories'),
    ])
    const results = computeResults({ ...d, habits: base.habits, roles: base.roles }, today, base.rules)
    const roleName = new Map(base.roles.map((r) => [r.id, r.name]))
    const byRole: Record<string, { done: number; total: number }> = {}
    const rows = []
    const sleeps: number[] = []
    for (let date = from; date <= to; date = addDays(date, 1)) {
      const day = d.days.find((x) => x.date === date)
      const tasks = d.tasks.filter((t) => t.date === date)
      for (const t of tasks) {
        const k = roleName.get(t.roleId) ?? t.roleId
        byRole[k] ??= { done: 0, total: 0 }
        byRole[k].total++
        if (t.done) byRole[k].done++
      }
      const habitRows = dailyRows(
        date,
        day?.type ?? null,
        [],
        base.habits,
        d.logs.filter((l) => weekStart(l.date) === weekStart(date)),
        base.roles,
        d.sessions,
        base.rules.workEndLimit,
      )
      const sleep = day ? sleepTotal(day.sleepNight, day.nap, base.rules) : null
      if (sleep != null && day?.type !== 'jaga') sleeps.push(sleep)
      const sessions = d.sessions.filter((s) => s.date === date)
      const w = workouts.filter((x) => x.date === date)
      const r = results.get(date)
      if (!day && !tasks.length && !sessions.length && !w.length) continue
      rows.push({
        date,
        type: day?.type ?? null,
        sleepTotal: sleep,
        xp: r?.xp ?? null,
        pass: r?.pass ?? null,
        tasks: `${tasks.filter((t) => t.done).length}/${tasks.length}`,
        habits: `${habitRows.filter((h) => h.done).length}/${habitRows.filter((h) => !h.weekly).length}`,
        mutabaah: mutLogs.filter((m) => m.date === date && m.done).length,
        tentirHours: sessions.length ? dayTentir(sessions, base.rules.workEndLimit).hours : 0,
        workouts: w.map((x) => (x.kind === 'lari' && x.run ? `lari ${x.run.km} km (${x.run.type})` : `beban ${x.entries.length} gerakan`)),
        overtime: day?.workEnd === 'late',
        note: day?.note || undefined,
      })
    }
    const inRange = <T extends { date: string }>(list: T[]) => list.filter((x) => x.date >= from && x.date <= to)
    const tentir = summarizeTentir(inRange(d.sessions), base.rules.workEndLimit)
    const runs = runsOf(inRange(workouts))
    const typed = rows.filter((x) => x.type)
    return {
      from,
      to,
      days: rows,
      totals: {
        xp: typed.reduce((a, x) => a + (x.xp ?? 0), 0),
        daysPassed: typed.filter((x) => x.pass).length,
        daysTyped: typed.length,
        jaga: typed.filter((x) => x.type === 'jaga').length,
        avgSleepNonJaga: sleeps.length ? round1(sleeps.reduce((a, b) => a + b, 0) / sleeps.length) : null,
        tasksByRole: byRole,
        tentir: {
          hours: tentir.hours,
          sessions: tentir.count,
          income: tentir.fee,
          paid: tentir.paid,
          perHour: tentir.perHour,
          lateSessions: tentir.late,
        },
        strengthSessions: inRange(workouts).filter((x) => x.kind === 'beban').length,
        runKm: round1(runs.reduce((a, x) => a + x.run.km, 0)),
        overtimeDays: rows.filter((x) => x.overtime).length,
        money: (() => {
          const list = inRange(txs)
          const cats = categoryLookup(mergeCategories(storedCats))
          const sum = summarizeMoney(list)
          const byCategory: Record<string, number> = {}
          for (const t of list)
            if (t.type === 'expense') byCategory[cats(t.categoryId).name] = (byCategory[cats(t.categoryId).name] ?? 0) + t.amount
          return { income: sum.income, expense: sum.expense, balance: sum.balance, expenseByCategory: byCategory }
        })(),
      },
    }
  },
}

const TABLES: Record<string, string | null> = {
  tasks: 'date',
  days: 'date',
  habits: null,
  habitLogs: 'date',
  mutabaah: null,
  mutabaahLogs: 'date',
  events: 'date',
  chapters: 'start',
  mainQuests: null,
  tentirSessions: 'date',
  notes: null,
  transactions: 'date',
  budgets: null,
  savings: null,
  debts: null,
  reviews: 'start',
  proposals: null,
  menus: null,
  mealPlans: 'date',
  exercises: null,
  workouts: 'date',
  rewards: null,
  claims: 'date',
  students: null,
  tentirPackages: null,
  materials: null,
  lifeRoles: null,
  phases: null,
  profile: null,
}

const listRecords: ToolDef = {
  name: 'list_records',
  title: 'Data mentah',
  description:
    'Baris mentah satu tabel Qawwam, bisa disaring tanggal (untuk tabel bertanggal). Tabel: ' +
    Object.keys(TABLES).join(', ') +
    ". Catatan: peran, habit, mutaba'ah, fase, gerakan, dan menu bawaan hidup di kode; di sini hanya yang pernah diubah/ditambah (pakai get_overview untuk daftar lengkap).",
  inputSchema: {
    type: 'object',
    properties: {
      table: { type: 'string', enum: Object.keys(TABLES) },
      from: { type: 'string', description: 'YYYY-MM-DD, untuk tabel bertanggal' },
      to: { type: 'string', description: 'YYYY-MM-DD, untuk tabel bertanggal' },
      limit: { type: 'number', description: 'Maks. baris (bawaan 200, maks. 1000)' },
    },
    required: ['table'],
    additionalProperties: false,
  },
  readOnly: true,
  async run(args, { store }) {
    const table = String(args.table ?? '')
    if (!(table in TABLES)) throw new ToolError(`Tabel tidak dikenal: ${table}.`)
    const field = TABLES[table]
    const from = args.from == null ? null : dateArg(args, 'from', '')
    const to = args.to == null ? null : dateArg(args, 'to', '')
    const limit = Math.min(1000, Math.max(1, Number(args.limit) || 200))
    let rows = await store.all<Record<string, unknown>>(table)
    if (field) {
      rows = rows
        .filter((r) => (!from || String(r[field]) >= from) && (!to || String(r[field]) <= to))
        .sort((a, b) => String(a[field]).localeCompare(String(b[field])))
    }
    return { table, count: rows.length, rows: rows.slice(-limit) }
  },
}

const getTrainingPlan: ToolDef = {
  name: 'get_training_plan',
  title: 'Rencana latihan',
  description:
    'Program beban (full body / atas-bawah / push-pull-kaki) dan hari berikutnya; resep sesi beban berikutnya per gerakan (double progression, turun 10% setelah 2× gagal, deload saat e1RM stagnan, ringan saat pasca-jaga/kurang tidur), proyeksi bench ke target, rencana lari minggu ini (volume, pace santai/tempo dari perkiraan 5K, minggu pemulihan, 80/20), dan km minggu ini.',
  inputSchema: { type: 'object', properties: {}, additionalProperties: false },
  readOnly: true,
  async run(_args, { store, now }) {
    const today = dayKey(now)
    const [base, days, exercises, workouts] = await Promise.all([
      loadBase(store),
      store.all<Day>('days'),
      store.all<Exercise>('exercises'),
      store.all<Workout>('workouts'),
    ])
    const sorted = [...workouts].sort((a, b) => a.date.localeCompare(b.date))
    const day = days.find((x) => x.date === today)
    const ready = readiness(day?.type ?? null, day ? sleepTotal(day.sleepNight, day.nap, base.rules) : null)
    const targets = { ...DEFAULT_TARGETS, ...base.profile.trainingTargets }
    const active = mergeWithDefaults(DEFAULT_EXERCISES, exercises).filter((e) => !e.archived)
    const monday = weekStart(today)
    const jaga = days.filter((x) => x.type === 'jaga' && x.date >= monday && x.date <= addDays(monday, 6)).length
    const runs = runsOf(sorted)
    const bench = exerciseHistory('#ex:bench', sorted)
    const split = base.profile.trainingSplit ?? 'fullbody'
    const programDay = nextDay(split, sorted)
    return {
      today,
      readiness: ready,
      program: { split, nextDay: programDay, days: SPLITS[split].days },
      strength: active.map((ex) => {
        const history = exerciseHistory(ex.id, sorted)
        const last = history[history.length - 1]
        return {
          exercise: ex.name,
          muscle: muscleOf(ex),
          inNextSession: inDay(ex, split, programDay),
          last: last ? { date: last.date, sets: last.entry.sets, e1rm: round1(last.e1rm) } : null,
          next: prescribe(ex, history, ready),
        }
      }),
      benchProjection: { targetKg: targets.benchKg, ...projectTarget(bench, targets.benchKg, today) },
      run: {
        ...planRunWeek(runs, today, jaga, null),
        doneThisWeekKm: weeklyKm(runs, monday),
        est5kSec: estimate5k(runs, today),
        target5kSec: targets.fiveKSec,
      },
    }
  },
}

const propose: ToolDef = {
  name: 'propose',
  title: 'Kirim usulan',
  description: `Kirim usulan ke Qawwam: jadwal, tugas, habit, menu, dan juga keuangan (pemasukan, pengeluaran, utang baru, cicilan utang, setoran/penarikan tabungan). TIDAK langsung ditulis: masuk halaman Usulan dan pengguna memilih item mana yang disetujui. Tidak bisa menghapus apa pun. Satu usulan = satu topik (mis. "Pengeluaran minggu ini"). Tanggal YYYY-MM-DD, jam HH.MM. Dilarang menulis identitas pasien (nama, No. RM, tanggal lahir); item seperti itu ditolak. Untuk cicilan/setoran, nama utang/tabungan harus sama dengan yang ada (lihat "uang" di get_overview).

Format item:
${IMPORT_ITEM_GUIDE}

Pakai id peran tanpa "#role:" (mis. "ukmppd", "orto", "koas", "tentir", "pulih", "uang").`,
  inputSchema: {
    type: 'object',
    properties: {
      summary: { type: 'string', description: 'Judul singkat usulan, mis. "Jadwal jaga Desember"' },
      items: { type: 'array', items: { type: 'object' }, minItems: 1, maxItems: 100 },
    },
    required: ['summary', 'items'],
    additionalProperties: false,
  },
  readOnly: false,
  async run(args, { store, now }) {
    const summary = String(args.summary ?? '')
      .trim()
      .slice(0, 200)
    const items = args.items
    if (!summary) throw new ToolError('summary wajib diisi.')
    if (!Array.isArray(items) || !items.length || items.length > 100) throw new ToolError('items harus daftar berisi 1–100 item.')
    if (items.some((i) => !i || typeof i !== 'object' || Array.isArray(i))) throw new ToolError('Setiap item harus objek JSON.')
    const phiSummary = detectPatientIdentity(summary)
    if (phiSummary) throw new ToolError(`summary mirip identitas pasien (${phiSummary}).`)
    const today = dayKey(now)
    const [{ roles }, storedCats, debts, savings] = await Promise.all([
      loadBase(store),
      store.all<Category>('categories'),
      store.all<Debt>('debts'),
      store.all<Saving>('savings'),
    ])
    const categories = mergeCategories(storedCats)
    const rows = parseImport(JSON.stringify(items), {
      roles,
      today,
      categories,
      debts: debts.map((d) => d.name),
      savings: savings.map((s) => s.name),
    })
    const problems = rows
      .filter((r) => r.error || r.phi)
      .map((r) => `item ${r.line}: ${r.phi ? `mirip identitas pasien (${r.phi})` : r.error}`)
    if (problems.length) throw new ToolError(`Usulan tidak disimpan. Perbaiki lalu kirim ulang:\n${problems.join('\n')}`)
    const roleName = (id: string | undefined) => roles.find((r) => r.id === id)?.name ?? 'Koas'
    const categoryName = (id: string) => categoryLookup(categories)(id).name
    const proposal: Proposal = {
      id: createId('prp'),
      summary,
      items: items as Record<string, unknown>[],
      status: 'menunggu',
      source: 'claude',
      decidedAt: null,
      createdAt: now,
      updatedAt: now,
    }
    await store.put('proposals', [proposal as unknown as Record<string, unknown>])
    return `Usulan "${summary}" tersimpan (${rows.length} item). Minta pengguna membuka Qawwam → Usulan untuk menyetujui:\n${rows
      .map((r) => `- ${itemLabel(r.item!)}: ${describeItem(r.item!, roleName, categoryName)}`)
      .join('\n')}`
  },
}

export const TOOLS: ToolDef[] = [getOverview, getSummary, listRecords, getTrainingPlan, propose]

export const INSTRUCTIONS = `Qawwam adalah app pengatur hidup pribadi seorang koas FK (koas → UKMPPD → PPDS Ortopedi). Data milik pengguna; kamu hanya membaca, dan semua perubahan lewat alat "propose" yang masuk ke halaman Usulan untuk disetujui.
- Hari Qawwam memakai WIB dan berganti pukul 03.00. Tipe hari: stase, jaga, pasca (pasca-jaga: hanya pemulihan), libur.
- XP ala MBAPPE OS: Σ XP selesai (maks. 100) × pengali tidur 24 jam; lolos bila ≥ 60% isi hari selesai; jaga/pasca tidak memutus streak. Mutaba'ah tanpa skor.
- Prinsip: hadiah untuk pemulihan, bukan volume; maksimal 3 Main Quest aktif; kuota sampingan (tentir dll.) 9–15 jam/minggu.
- Catatan uang dari percakapan ("tadi beli buku 150rb", "dapat kiriman 1,5jt", "bayar utang kakak 500rb", "nabung 1jt ke dana jembatan") dikirim lewat propose sebagai pemasukan/pengeluaran/cicilan/setoran, juga utang baru. Nama utang & tabungan ada di get_overview → uang.
- JANGAN pernah menulis identitas pasien (nama, No. RM, tanggal lahir, "Tn./Ny. + nama").
Mulai dengan get_overview.`
