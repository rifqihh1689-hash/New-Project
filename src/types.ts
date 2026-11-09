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
  /** Jam selesai (opsional), mis. pulang stase. */
  until?: string
  title: string
  note?: string
  roleId?: string
  /** Slot kerja utama (stase/dinas): jam masuk & pulangnya mengikuti stase yang sedang berjalan. */
  work?: boolean
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
  /** Pengaturan modul Menu (berat badan, fase, target protein, anggaran). */
  nutrition?: Partial<NutritionSettings>
  /** Tarif tentir per jam (Rupiah). */
  tentirRate?: number
  /** Target belajar UKMPPD: tanggal ujian & soal per minggu. */
  study?: StudyTarget
  /** Target latihan: e1RM bench (kg), 5K & 10K (detik). */
  trainingTargets?: Partial<TrainingTargets>
  /** Program latihan beban; bawaan full body (semua gerakan tiap sesi). */
  trainingSplit?: TrainingSplit
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
  /** Batas berhenti kerja malam (`HH.MM`). `null` = aturan dimatikan: tanpa penalti, habit, dan quest batas tentir. */
  workEndLimit: string | null
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
  /** Jam masuk & pulang khusus stase ini (`HH.MM`). Kosong = ikut ritme umum. */
  masuk?: string
  pulang?: string
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
  /** Energi subjektif hari ini, 1 (habis) – 5 (prima). Tidak masuk XP; hanya untuk melihat pola. */
  energy?: 1 | 2 | 3 | 4 | 5
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
  /** Detail, mis. program latihan "Bench 3×5, row 3×8". */
  note?: string
  /** `weekly` = cukup sekali seminggu (quest mingguan): XP sekali, tidak masuk penyebut lolos. */
  freq?: 'daily' | 'weekly'
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
  /** Sesi bagian dari paket (fee 0, tidak membuat transaksi sendiri). */
  packageId?: string | null
}

/** Murid tentir (inisial saja, tanpa data pribadi lain). */
export interface Student extends Stamped {
  initials: string
  /** Angkatan/semester, mis. "Sem 5" atau "2023". */
  cohort: string
  /** Blok yang sedang ditentir, mis. "Blok 12 Muskuloskeletal". */
  block: string
  /** Tarif khusus per jam; `null` = tarif umum. */
  rate: number | null
  note: string
  archived: boolean
}

/** Paket sesi dibayar di muka. Sesi yang memakai paket tidak membuat transaksi sendiri. */
export interface TentirPackage extends Stamped {
  /** Inisial murid (sama dengan `TentirSession.student`). */
  student: string
  name: string
  sessions: number
  price: number
  paid: boolean
  paidDate: ISODate | null
  transactionId: string | null
  archived: boolean
}

/** Materi tentir per blok, untuk dipakai ulang. */
export interface Material extends Stamped {
  block: string
  title: string
  /** Tautan (Drive/Notion) atau kosong. */
  link: string
  note: string
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

/**
 * Usulan dari Claude (lewat connector). Item memakai format JSON impor yang sama dengan halaman Impor
 * (`jenis: tugas | jaga | habit | stase | ritme | menu`), jadi dicek identitas pasien dan bisa dipratinjau
 * sebelum disetujui. Tidak ada usulan yang menghapus data.
 */
export interface Proposal extends Stamped {
  summary: string
  items: Record<string, unknown>[]
  status: 'menunggu' | 'disetujui' | 'ditolak'
  source: 'claude'
  decidedAt: number | null
  /** Ringkasan hasil saat disetujui, mis. "3 tugas, 1 jadwal jaga". */
  result?: string
}

// ---------- Menu & makan ----------

export type MealSlot = 'sarapan' | 'snack1' | 'siang' | 'snack2' | 'malam'
export type FoodPhase = 'bulk' | 'maintain' | 'cut'

export interface NutritionSettings {
  /** Berat badan (kg) untuk menghitung target protein. `null` = belum diisi. */
  weightKg: number | null
  phase: FoodPhase
  /** Jumlah makan per hari (3–5). Bawaan mengikuti fase: bulk 5, maintain 4, cut 3. */
  mealsPerDay: 3 | 4 | 5
  proteinPerKg: number
  /** Anggaran makan per minggu (Rupiah). */
  weeklyBudget: number
  /** Harga bahan per satuan; biaya menu masak dihitung dari sini. Diperbarui ±sebulan sekali. */
  prices: IngredientPrice[]
  /** Kapan harga terakhir diperbarui. `null` = masih harga bawaan. */
  pricesUpdatedAt: number | null
  /** Bumbu, minyak & gas per porsi menu masak (Rupiah). */
  overheadRp: number
  /** Bahan tambahan di daftar belanja (dari saran belanja), berlaku untuk satu minggu (`week` = Senin). */
  shoppingExtras?: { week: ISODate; items: Ingredient[] }
}

export interface IngredientPrice {
  name: string
  /** Satuan dasar yang sama dengan bahan di menu: g, ml, butir, buah. */
  unit: string
  rpPerUnit: number
}

export interface Ingredient {
  name: string
  qty: number
  unit: string
}

/** Satu menu di daftar: beli atau masak, dengan perkiraan protein & biaya per porsi. */
export interface Menu extends Stamped {
  name: string
  source: 'masak' | 'beli'
  /** Waktu makan yang cocok. */
  slots: MealSlot[]
  proteinG: number
  costRp: number
  /** Bahan per porsi (menu masak), untuk daftar belanja. */
  ingredients: Ingredient[]
  /** Cocok dibawa saat jaga / disiapkan sekaligus. */
  bekal: boolean
  /** Butuh masak sungguhan (bukan sekadar rebus/seduh): hanya disusun di hari libur atau dari stok. */
  heavyCook: boolean
  place?: string
  note?: string
  archived: boolean
  /** Tidak disimpan: biaya dihitung dari harga bahan saat dimuat. */
  costAuto?: boolean
}

export interface MealPlanEntry extends CloudFields {
  /** `#meal:<date>:<slot>`. */
  id: string
  date: ISODate
  slot: MealSlot
  menuId: string | null
  updatedAt: number
}

// ---------- Latihan ----------

export interface TrainingTargets {
  benchKg: number
  fiveKSec: number
  tenKSec: number
}

/** Gerakan beban di daftar latihan. */
/** Kelompok otot utama; menentukan hari di program Atas/Bawah dan Push/Pull/Kaki. */
export type Muscle = 'dada' | 'bahu' | 'punggung' | 'kaki' | 'bisep' | 'trisep' | 'inti'

/** Program pembagian hari latihan beban. */
export type TrainingSplit = 'fullbody' | 'atas-bawah' | 'ppl'

export interface Exercise extends Stamped {
  name: string
  group: 'upper' | 'lower'
  /** Kosong untuk data lama: dianggap dada (atas) / kaki (bawah). */
  muscle?: Muscle
  repMin: number
  repMax: number
  sets: number
  /** Kenaikan beban saat progres (kg). */
  increment: number
  archived: boolean
  order: number
}

export interface StrengthSet {
  kg: number
  reps: number
}

export type Feel = 'ringan' | 'pas' | 'berat'

export interface StrengthEntry {
  exerciseId: string
  sets: StrengthSet[]
  /** Rasa set terakhir: ringan (sisa ≥ 3 rep), pas (sisa ±2), berat (sisa 0–1). */
  feel?: Feel
}

export type RunType = 'easy' | 'long' | 'kualitas' | 'tes'

export interface RunLog {
  km: number
  sec: number
  type: RunType
  feel?: Feel
}

export interface Workout extends Stamped {
  date: ISODate
  kind: 'beban' | 'lari'
  /** Hari program saat sesi dicatat (mis. "Atas", "Push"); untuk menentukan hari berikutnya. */
  day?: string
  entries: StrengthEntry[]
  run: RunLog | null
  note: string
}

// ---------- Hadiah ----------

export interface Reward extends Stamped {
  name: string
  /** Biaya (Rupiah); 0 = gratis. Hadiah berbiaya terkunci sampai dana jembatan tercapai. */
  cost: number
  archived: boolean
}

export interface Claim extends Stamped {
  rewardId: string
  name: string
  cost: number
  date: ISODate
  level: number
}

export type ThemePreference = 'light' | 'dark' | 'system'

// ---------- Belajar UKMPPD ----------

export interface StudyTarget {
  /** Tanggal UKMPPD; `null` = belum diisi. */
  examDate: ISODate | null
  /** Target soal per minggu. */
  weeklyQuestions: number
}

/** Satu sesi latihan soal atau tryout untuk satu sistem. */
export interface StudyLog extends Stamped {
  date: ISODate
  /** Sistem/bidang, mis. "Kardiovaskular" (daftar di `domain/study.ts`). */
  system: string
  kind: 'soal' | 'tryout'
  total: number
  correct: number
  note?: string
}

/** Kartu ulasan dengan pengulangan berjarak (gaya SM-2 sederhana). */
export interface Flashcard extends Stamped {
  front: string
  back: string
  /** Sistem/bidang UKMPPD (opsional). */
  system?: string
  /** Dari mana kartu berasal: ditulis sendiri, dari soal yang salah, atau dari usulan Claude. */
  source: 'manual' | 'salah' | 'claude'
  /** Tanggal ulasan berikutnya. */
  due: ISODate
  /** Jarak ulasan sekarang (hari); 0 = kartu baru. */
  interval: number
  ease: number
  reps: number
  lapses: number
  lastReviewed?: ISODate
}

// ---------- Berkas PPDS ----------

export type DocStatus = 'belum' | 'proses' | 'siap'

/** Satu butir daftar persiapan PPDS (berkas, sertifikat, portofolio, bahasa). */
export interface PpdsDoc extends Stamped {
  name: string
  group: 'berkas' | 'sertifikat' | 'portofolio' | 'bahasa'
  status: DocStatus
  /** Tenggat internal; `null` = belum ditentukan. */
  due: ISODate | null
  note?: string
}
