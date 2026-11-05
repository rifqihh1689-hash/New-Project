/**
 * Model data Qawwam (lihat DESIGN.md › Model data).
 *
 * Aturan kunci primer (siap Dexie Cloud):
 * - Semua kunci berupa string yang dibuat otomatis oleh aplikasi, tidak pernah diketik pengguna.
 * - Baris baru → ID acak berawalan (`tsk_…`, `nte_…`) dari `createId`.
 * - Baris "satu per kunci alami" (hari per tanggal, log per item per tanggal, profil) → ID privat
 *   deterministik berawalan `#` (`#day:2026-11-05`). Dexie Cloud menerjemahkan `#…` menjadi `#…:<userId>`,
 *   jadi HP dan laptop yang offline menulis ke baris yang sama, bukan membuat duplikat.
 * - Bawaan aplikasi (peran, fase, mutaba'ah, habit) juga ber-ID `#…` dan hidup di kode; yang tersimpan di
 *   database hanya perubahan pengguna (lihat `db/defaults.ts`). Tidak ada "isi awal" yang bisa saling timpa.
 *
 * Semua tanggal `YYYY-MM-DD` menurut WIB, hari berganti pukul 03.00 (lihat `domain/time.ts`).
 */

/** Tanggal WIB berformat `YYYY-MM-DD`. */
export type ISODate = string
/** Bulan berformat `YYYY-MM`. */
export type MonthKey = string

export type DayType = 'stase' | 'jaga' | 'pasca' | 'libur'
export type XpSize = 'kecil' | 'sedang' | 'besar'
export type WorkEnd = 'ok' | 'late'

/** Kolom yang ditambahkan Dexie Cloud saat sinkron. Ada di tipe agar export/impor tidak kaget. */
interface CloudFields {
  owner?: string
  realmId?: string
}

interface Stamped extends CloudFields {
  id: string
  createdAt: number
  updatedAt: number
}

// ---------- Profil & struktur hidup ----------

export interface Role extends Stamped {
  name: string
  /** Warna hex, mis. `#5b8def`. */
  color: string
  order: number
  /** Peran pemulihan: satu-satunya yang tampil saat pasca-jaga. */
  recovery: boolean
  /** Diarsipkan = disembunyikan dari pilihan, riwayat tetap utuh. Peran tidak pernah dihapus. */
  archived: boolean
}

/** Fase hidup: Koas → UKMPPD → PPDS. Berganti fase = menambah/menutup baris, bukan mereset data. */
export interface Phase extends Stamped {
  name: string
  /** Keterangan singkat, mis. "FK UB / RSSA Malang". */
  note: string
  start: ISODate | null
  /** Tanggal selesai atau tanggal penting (mis. hari ujian). */
  end: ISODate | null
  order: number
  archived: boolean
  /** Label tipe hari khusus fase ini, mis. `{ stase: 'Dinas' }` saat PPDS. */
  dayTypeLabels?: Partial<Record<DayType, string>>
}

export interface RitmeSlot {
  /** `HH.MM` WIB. */
  time: string
  title: string
  note?: string
  roleId?: string
}

export interface Profile extends CloudFields {
  /** Selalu `#profile`. */
  id: string
  name: string
  /** Aturan XP yang diubah pengguna; sisanya memakai bawaan. */
  rules: Partial<XpRules>
  /** Template "Ritme hari ini" per tipe hari. */
  ritme: Partial<Record<DayType, RitmeSlot[]>>
  tentirCapacity: { min: number; max: number }
  updatedAt: number
}

export interface XpRules {
  xpSize: Record<XpSize, number>
  dailyCap: number
  /** Diurutkan dari jam terbanyak. Pengali wajib naik seiring jam tidur. */
  sleepTiers: { min: number; mult: number }[]
  sleepQuestMin: number
  napCounts: boolean
  worstCaseEmpty: boolean
  passPct: number
  jagaMult: number
  pascaXP: number
  overtimePenalty: number
  levelBase: number
  levelStep: number
  backfillDays: number
  /** XP sekali seminggu untuk Muhasabah mingguan (Raid di MBAPPE OS). */
  reviewXP: number
}

/** Stase/chapter: rentang waktu dengan bobot. */
export interface Chapter extends Stamped {
  name: string
  start: ISODate
  end: ISODate
  weight: 'ringan' | 'sedang' | 'berat'
}

// ---------- Harian ----------

export interface DayResult {
  xp: number
  gross: number
  base: number
  capped: number
  mult: number
  multMissing: boolean
  penalty: number
  pass: boolean
  total: number
  doneCount: number
  /** Tipe yang dipakai menghitung (pasca tanpa jaga kemarin dihitung stase). */
  effType: DayType | null
  invalidPasca: boolean
}

export interface Day extends CloudFields {
  /** `#day:YYYY-MM-DD`. */
  id: string
  date: ISODate
  type: DayType | null
  /** Jam tidur malam sebelumnya. `null` = belum diisi. */
  sleepNight: number | null
  /** Jam qailulah/tidur siang hari ini. */
  nap: number
  workEnd: WorkEnd | null
  note: string
  /** Hasil final saat hari terkunci. Hari beku tidak berubah walau aturan/habit diedit. */
  frozen?: DayResult
  updatedAt: number
}

export interface Subtask {
  id: string
  title: string
  done: boolean
}

export interface Task extends Stamped {
  title: string
  roleId: string
  /** Hari tugas dikerjakan. */
  date: ISODate
  /** Tenggat (opsional). */
  due: ISODate | null
  important: boolean
  size: XpSize
  subtasks: Subtask[]
  done: boolean
  doneAt: number | null
  source: 'manual' | 'claude'
}

export interface Habit extends Stamped {
  name: string
  roleId: string
  size: XpSize
  /** Tipe hari yang memuat habit ini. */
  dayTypes: DayType[]
  /** Hari dalam minggu (0 = Minggu). Kosong = setiap hari. */
  weekdays: number[]
  /** Target menit per hari. Habit selesai otomatis bila menit tercatat ≥ target. `null` = tanpa menit. */
  minutes: number | null
  /** `sleep` & `workend` dinilai otomatis dari isian tidur / jam berhenti kerja. */
  kind: 'normal' | 'sleep' | 'workend'
  active: boolean
  order: number
}

export interface HabitLog extends CloudFields {
  /** `#hl:<habitId>:<date>`. */
  id: string
  habitId: string
  date: ISODate
  done: boolean
  /** Menit yang dicatat hari itu (untuk habit bertarget menit). */
  minutes?: number
  updatedAt: number
}

export interface MutabaahItem extends Stamped {
  name: string
  order: number
  archived: boolean
}

export interface MutabaahLog extends CloudFields {
  /** `#ml:<itemId>:<date>`. */
  id: string
  itemId: string
  date: ISODate
  done: boolean
  updatedAt: number
}

export interface CalendarEvent extends Stamped {
  title: string
  date: ISODate
  start: string | null
  end: string | null
  kind: 'agenda' | 'jaga' | 'stase'
  roleId: string | null
}

export interface MainQuest extends Stamped {
  name: string
  roleId: string
  status: 'aktif' | 'beku' | 'selesai'
  next: string
  /** 0–1. */
  progress: number
  doneAt: number | null
}

export interface TentirSession extends Stamped {
  /** Inisial murid saja. */
  student: string
  topic: string
  date: ISODate
  start: string | null
  hours: number
  /** Tarif total sesi (Rupiah). */
  fee: number
  paid: boolean
  transactionId: string | null
}

export interface Note extends Stamped {
  text: string
  roleId: string | null
  color: string | null
  pinned: boolean
}

// ---------- Uang (dari Dompetku, dipakai penuh di Fase 2) ----------

export type TransactionType = 'income' | 'expense'

export interface Transaction extends Stamped {
  amount: number
  type: TransactionType
  categoryId: string
  date: ISODate
  note: string
  recurringId?: string
  tentirSessionId?: string
}

export interface Category extends Stamped {
  name: string
  icon: string
  color: string
  kind: TransactionType | 'both'
  builtIn: boolean
}

export interface Budget extends CloudFields {
  /** `#bud:<month>:<categoryId>`. */
  id: string
  month: MonthKey
  categoryId: string
  amount: number
}

export interface RecurringRule extends Stamped {
  amount: number
  type: TransactionType
  categoryId: string
  note: string
  dayOfMonth: number
  startMonth: MonthKey
  endMonth?: MonthKey
  lastGeneratedMonth?: MonthKey
  active: boolean
}

export interface Saving extends Stamped {
  name: string
  kind: 'jembatan' | 'wishlist' | 'lainnya'
  target: number
  targetDate: ISODate | null
  deposits: { date: ISODate; amount: number }[]
}

export interface Debt extends Stamped {
  name: string
  initial: number
  targetDate: ISODate | null
  payments: { date: ISODate; amount: number }[]
}

// ---------- Refleksi & Claude ----------

export interface Review extends CloudFields {
  /** `#rev:minggu:<Senin>` atau `#rev:bulan:<YYYY-MM>`. */
  id: string
  period: 'minggu' | 'bulan'
  start: ISODate
  priorities: string[]
  wins: string
  stuck: string
  focus: string
  numbers: Record<string, number | null>
  /** Kapan Muhasabah diselesaikan (memberi XP sekali). `null`/kosong = belum. */
  completedAt?: number | null
  /** XP yang diberikan saat selesai (dibekukan, tidak berubah walau aturan diubah). */
  xp?: number
  updatedAt: number
}

export interface ProposalOp {
  table: 'tasks' | 'events' | 'habits' | 'notes' | 'mainQuests' | 'days'
  action: 'add' | 'update'
  values: Record<string, unknown>
  targetId?: string
}

export interface Proposal extends Stamped {
  summary: string
  ops: ProposalOp[]
  status: 'menunggu' | 'disetujui' | 'ditolak'
  source: 'claude'
  decidedAt: number | null
}

export type ThemePreference = 'light' | 'dark' | 'system'
