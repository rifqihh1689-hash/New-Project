import Dexie, { type EntityTable } from 'dexie'
import dexieCloud from 'dexie-cloud-addon'
import type {
  Budget,
  CalendarEvent,
  Claim,
  Exercise,
  Category,
  Chapter,
  Day,
  Debt,
  Habit,
  HabitLog,
  MainQuest,
  MealPlanEntry,
  Menu,
  MutabaahItem,
  MutabaahLog,
  Note,
  Phase,
  Profile,
  Proposal,
  RecurringRule,
  Review,
  Reward,
  Role,
  Saving,
  Task,
  TentirSession,
  Transaction,
  Workout,
} from '../types'

export type QawwamDB = Dexie & {
  profile: EntityTable<Profile, 'id'>
  lifeRoles: EntityTable<Role, 'id'>
  phases: EntityTable<Phase, 'id'>
  chapters: EntityTable<Chapter, 'id'>
  days: EntityTable<Day, 'id'>
  tasks: EntityTable<Task, 'id'>
  habits: EntityTable<Habit, 'id'>
  habitLogs: EntityTable<HabitLog, 'id'>
  mutabaah: EntityTable<MutabaahItem, 'id'>
  mutabaahLogs: EntityTable<MutabaahLog, 'id'>
  events: EntityTable<CalendarEvent, 'id'>
  mainQuests: EntityTable<MainQuest, 'id'>
  tentirSessions: EntityTable<TentirSession, 'id'>
  notes: EntityTable<Note, 'id'>
  transactions: EntityTable<Transaction, 'id'>
  categories: EntityTable<Category, 'id'>
  budgets: EntityTable<Budget, 'id'>
  recurring: EntityTable<RecurringRule, 'id'>
  savings: EntityTable<Saving, 'id'>
  debts: EntityTable<Debt, 'id'>
  reviews: EntityTable<Review, 'id'>
  proposals: EntityTable<Proposal, 'id'>
  menus: EntityTable<Menu, 'id'>
  mealPlans: EntityTable<MealPlanEntry, 'id'>
  exercises: EntityTable<Exercise, 'id'>
  workouts: EntityTable<Workout, 'id'>
  rewards: EntityTable<Reward, 'id'>
  claims: EntityTable<Claim, 'id'>
}

export const DB_NAME = 'qawwam'

/**
 * Skema v1. Kunci primer `id` selalu string (lihat `types.ts`). Semua tabel ikut sinkron Dexie Cloud;
 * preferensi perangkat (tema) tetap di localStorage.
 * Mengubah skema nanti = menambah `db.version(2)`, data lama tidak hilang.
 */
export const SCHEMA_V1 = {
  profile: 'id',
  // `roles` dipakai Dexie Cloud untuk hak akses realm, jadi peran hidup bernama lifeRoles.
  lifeRoles: 'id, order',
  phases: 'id, order',
  chapters: 'id, start, end',
  days: 'id, date, type',
  tasks: 'id, date, roleId, done, due, source',
  habits: 'id, order',
  habitLogs: 'id, date, habitId',
  mutabaah: 'id, order',
  mutabaahLogs: 'id, date, itemId',
  events: 'id, date, kind',
  mainQuests: 'id, status, roleId',
  tentirSessions: 'id, date',
  notes: 'id, roleId, pinned, updatedAt',
  transactions: 'id, date, type, categoryId, recurringId, tentirSessionId',
  categories: 'id, name',
  budgets: 'id, month, categoryId',
  recurring: 'id, active',
  savings: 'id, kind',
  debts: 'id',
  reviews: 'id, period, start',
  proposals: 'id, status, createdAt',
} as const

/** Tabel baru di skema v2 (modul Menu). */
export const SCHEMA_V2_ADDITIONS = {
  menus: 'id, source',
  mealPlans: 'id, date',
} as const

/** Tabel baru di skema v3 (latihan & hadiah). */
export const SCHEMA_V3_ADDITIONS = {
  exercises: 'id, order',
  workouts: 'id, date, kind',
  rewards: 'id',
  claims: 'id, date',
} as const

export function createDatabase(name: string = DB_NAME): QawwamDB {
  const db = new Dexie(name, { addons: [dexieCloud] }) as QawwamDB
  db.version(1).stores(SCHEMA_V1)
  // v2: modul Menu. Data lama tidak tersentuh.
  db.version(2).stores({ ...SCHEMA_V1, ...SCHEMA_V2_ADDITIONS })
  // v3: latihan & hadiah.
  db.version(3).stores({ ...SCHEMA_V1, ...SCHEMA_V2_ADDITIONS, ...SCHEMA_V3_ADDITIONS })
  return db
}

/** URL database Dexie Cloud dari `.env.local` / variabel repo saat build. Kosong = mode lokal saja. */
// Tes selalu tanpa sinkron, walau .env.local berisi URL, agar hasilnya tidak bergantung pada jaringan atau login.
export const CLOUD_URL = import.meta.env.MODE === 'test' ? '' : (import.meta.env.VITE_DEXIE_CLOUD_URL ?? '').trim()

/** Instans database utama aplikasi (IndexedDB di perangkat, sinkron bila CLOUD_URL diisi). */
export const db = createDatabase()

if (CLOUD_URL) {
  db.cloud.configure({
    databaseUrl: CLOUD_URL,
    // Wajib masuk (email + kode) sekali per perangkat sebelum menulis apa pun, supaya semua data
    // langsung milik akunmu dan perangkat baru tidak menimpa data lama. Setelah itu tetap jalan offline.
    requireAuth: true,
    socialAuth: false,
    // Layar masuk dibuat sendiri dalam bahasa Indonesia (features/auth/LoginDialog.tsx).
    customLoginGui: true,
  })
}
