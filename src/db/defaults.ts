import { DEFAULT_RULES } from '../domain/rules'
import type { DayType, Exercise, Habit, MealSlot, Menu, MutabaahItem, Phase, Profile, Role, RitmeSlot } from '../types'

/**
 * Bawaan aplikasi hidup di kode, bukan "diisi" ke database. Yang disimpan hanya perubahan pengguna
 * dengan ID yang sama (mis. peran Koas diganti nama → baris `#role:koas` tersimpan).
 *
 * Kenapa: dengan sinkron, mengisi bawaan di tiap perangkat bisa menimpa perubahan dari perangkat lain
 * (HP baru tahun depan akan "mereset" nama peran). Dengan cara ini tidak ada yang tertimpa, dan fase
 * hidup yang berubah cukup diedit/diarsipkan, tidak pernah direset.
 */

const T0 = 0

const role = (key: string, name: string, color: string, order: number, recovery = false): Role => ({
  id: `#role:${key}`,
  name,
  color,
  order,
  recovery,
  archived: false,
  createdAt: T0,
  updatedAt: T0,
})

export const DEFAULT_ROLES: Role[] = [
  role('koas', 'Koas', '#5b8def', 1),
  role('ukmppd', 'UKMPPD', '#9b7bea', 2),
  role('orto', 'Ortopedi', '#e8925b', 3),
  role('tentir', 'Tentir', '#4cb782', 4),
  role('pulih', 'Tubuh & pulih', '#3bb5c4', 5, true),
  role('uang', 'Uang & rumah', '#d4ad45', 6),
]

export const DEFAULT_ROLE_ID = '#role:koas'
export const RECOVERY_ROLE_ID = '#role:pulih'

const phase = (key: string, name: string, note: string, start: string | null, end: string | null, order: number): Phase => ({
  id: `#phase:${key}`,
  name,
  note,
  start,
  end,
  order,
  archived: false,
  createdAt: T0,
  updatedAt: T0,
})

export const DEFAULT_PHASES: Phase[] = [
  phase('koas', 'Koas', 'FK UB / RSSA Malang', null, '2027-12-31', 1),
  phase('ukmppd', 'UKMPPD', 'Ujian kompetensi', '2028-01-01', '2028-02-29', 2),
  phase('ppds', 'Daftar PPDS Ortopedi', 'berkas, portofolio, wawancara', '2028-03-01', null, 3),
]

const mut = (key: string, name: string, order: number): MutabaahItem => ({
  id: `#mut:${key}`,
  name,
  order,
  archived: false,
  createdAt: T0,
  updatedAt: T0,
})

export const DEFAULT_MUTABAAH: MutabaahItem[] = [
  mut('qiyam', 'Qiyamul lail', 1),
  mut('subuh', 'Subuh berjamaah', 2),
  mut('dzikirpagi', 'Dzikir pagi', 3),
  mut('tilawah', 'Tilawah', 4),
  mut('dzikirpetang', 'Dzikir petang', 5),
  mut('witir', 'Witir', 6),
]

const habit = (
  key: string,
  name: string,
  roleId: string,
  size: Habit['size'],
  dayTypes: DayType[],
  order: number,
  extra: Partial<Habit> = {},
): Habit => ({
  id: `#habit:${key}`,
  name,
  roleId,
  size,
  dayTypes,
  weekdays: [],
  minutes: null,
  kind: 'normal',
  active: true,
  order,
  createdAt: T0,
  updatedAt: T0,
  ...extra,
})

/** Habit inti dari MBAPPE OS. Habit lain (belajar, latihan) ditambah lewat halaman Habit / impor levelup. */
export const DEFAULT_HABITS: Habit[] = [
  habit('sleep', 'Total tidur ≥ 6 jam', RECOVERY_ROLE_ID, 'sedang', ['stase', 'libur'], 1, { kind: 'sleep' }),
  habit('workend', 'Berhenti kerja ≤ 21.00', RECOVERY_ROLE_ID, 'sedang', ['stase', 'libur'], 2, { kind: 'workend' }),
  habit('jaga-nap', 'Tidur sore pra-jaga', RECOVERY_ROLE_ID, 'besar', ['jaga'], 3),
  habit('pasca-rest', 'Tidur pulih 2–3 jam', RECOVERY_ROLE_ID, 'besar', ['pasca'], 4),
  habit('pasca-eat', 'Makan yang benar', RECOVERY_ROLE_ID, 'sedang', ['pasca'], 5),
  habit('pasca-walk', 'Jalan 20 menit', RECOVERY_ROLE_ID, 'kecil', ['pasca'], 6),
]

const slot = (time: string, title: string, note?: string, roleKey?: string, extra: Partial<RitmeSlot> = {}): RitmeSlot => ({
  time,
  title,
  ...(note ? { note } : {}),
  ...(roleKey ? { roleId: `#role:${roleKey}` } : {}),
  ...extra,
})

/** Slot kerja: jam masuk & pulang bisa diganti per stase di Setelan. */
const work = (time: string, until: string) => slot(time, 'Stase', undefined, 'koas', { until, work: true })

/** Template "Ritme hari ini" per tipe hari. Bisa diubah tiap kali fase hidup berganti. */
export const DEFAULT_RITME: Record<DayType, RitmeSlot[]> = {
  stase: [
    slot('03.45', 'Qiyamul lail'),
    work('06.00', '14.00'),
    slot('14.30', 'Qailulah', '60 mnt, naikkan pengali', 'pulih'),
    slot('16.00', 'Blok belajar', 'bank soal UKMPPD', 'ukmppd'),
    slot('19.00', 'Tentir', 'bila ada sesi', 'tentir'),
    slot('21.00', 'Berhenti kerja', 'batas aman', 'pulih'),
    slot('21.30', 'Tidur', 'target ≥ 5,5 j', 'pulih'),
  ],
  jaga: [
    slot('03.45', 'Qiyamul lail'),
    work('06.00', '14.00'),
    slot('14.30', 'Tidur sore', '2 jam sebelum jaga', 'pulih'),
    slot('17.00', 'Makan & siapkan bekal', undefined, 'pulih'),
    slot('18.00', 'Jaga malam', 'sampai pagi', 'koas'),
  ],
  pasca: [
    slot('07.00', 'Selesai jaga', 'serah terima', 'koas'),
    slot('08.00', 'Tidur pulih', '2–3 jam', 'pulih'),
    slot('11.30', 'Makan, mandi, matahari', undefined, 'pulih'),
    slot('15.30', 'Jalan santai 20 mnt', undefined, 'pulih'),
    slot('20.30', 'Tidur lebih awal', undefined, 'pulih'),
  ],
  libur: [
    slot('03.45', 'Qiyamul lail'),
    slot('07.00', 'Blok belajar panjang', '90 mnt', 'ukmppd'),
    slot('09.30', 'Olahraga', undefined, 'pulih'),
    slot('16.00', 'Muhasabah', '30 mnt bila hari Minggu', 'orto'),
    slot('21.00', 'Tidur', undefined, 'pulih'),
  ],
}

export const DEFAULT_PROFILE: Profile = {
  id: '#profile',
  name: '',
  rules: {},
  ritme: {},
  tentirCapacity: { min: 9, max: 15 },
  updatedAt: T0,
}

export { DEFAULT_RULES }

/** Gabungkan bawaan dengan baris tersimpan (baris tersimpan menang), diurutkan. */
export function mergeWithDefaults<T extends { id: string; order: number }>(defaults: T[], stored: T[]): T[] {
  const map = new Map(defaults.map((d) => [d.id, d]))
  for (const row of stored) map.set(row.id, row)
  return [...map.values()].sort((a, b) => a.order - b.order)
}

// ---------- Menu bawaan ----------
// Perkiraan protein & biaya per porsi (harga Malang, bisa diubah). Dominan ayam & telur,
// sesuai kebiasaan; menu ikan/sapi/udang tidak dimasukkan karena jarang dimasak.

const ing = (name: string, qty: number, unit: string) => ({ name, qty, unit })
const menu = (
  key: string,
  name: string,
  source: Menu['source'],
  slots: MealSlot[],
  proteinG: number,
  costRp: number,
  extra: Partial<Menu> = {},
): Menu => ({
  id: `#menu:${key}`,
  name,
  source,
  slots,
  proteinG,
  costRp,
  ingredients: [],
  bekal: false,
  heavyCook: false,
  archived: false,
  createdAt: T0,
  updatedAt: T0,
  ...extra,
})

export const DEFAULT_MENUS: Menu[] = [
  // Masak cepat (bisa di hari stase).
  menu('telur-dadar', 'Nasi + telur dadar 2 butir', 'masak', ['sarapan', 'malam'], 17, 6_000, {
    ingredients: [ing('Telur', 2, 'butir'), ing('Beras', 80, 'g')],
  }),
  menu('oat-telur', 'Oat susu + 2 telur rebus', 'masak', ['sarapan'], 27, 8_500, {
    ingredients: [ing('Oat', 50, 'g'), ing('Susu UHT', 250, 'ml'), ing('Telur', 2, 'butir')],
  }),
  menu('telur-rebus', 'Telur rebus 3 butir', 'masak', ['snack1', 'snack2'], 19, 6_000, {
    ingredients: [ing('Telur', 3, 'butir')],
    bekal: true,
  }),
  menu('susu-pisang', 'Susu 250 ml + pisang', 'masak', ['snack1', 'snack2'], 9, 6_500, {
    ingredients: [ing('Susu UHT', 250, 'ml'), ing('Pisang', 1, 'buah')],
    bekal: true,
  }),
  menu('omelet', 'Omelet 3 telur + sayur + nasi', 'masak', ['sarapan', 'malam'], 23, 9_000, {
    ingredients: [ing('Telur', 3, 'butir'), ing('Sayur', 50, 'g'), ing('Beras', 80, 'g')],
  }),
  menu('nasgor', 'Nasi goreng ayam + telur', 'masak', ['sarapan', 'malam'], 35, 9_000, {
    ingredients: [ing('Dada ayam', 80, 'g'), ing('Telur', 1, 'butir'), ing('Beras', 100, 'g')],
  }),
  // Masak di hari libur, disiapkan untuk beberapa hari / bekal.
  menu('ayam-panggang', 'Dada ayam panggang 150 g + nasi + sayur', 'masak', ['siang', 'malam'], 48, 12_000, {
    ingredients: [ing('Dada ayam', 150, 'g'), ing('Beras', 80, 'g'), ing('Sayur', 100, 'g')],
    bekal: true,
    heavyCook: true,
  }),
  menu('ayam-kecap', 'Tumis ayam kecap + nasi', 'masak', ['siang', 'malam'], 36, 10_500, {
    ingredients: [ing('Paha ayam fillet', 120, 'g'), ing('Beras', 80, 'g')],
    bekal: true,
    heavyCook: true,
  }),
  menu('ayam-suwir', 'Ayam suwir + telur balado + nasi', 'masak', ['siang', 'malam'], 40, 11_000, {
    ingredients: [ing('Dada ayam', 100, 'g'), ing('Telur', 1, 'butir'), ing('Beras', 80, 'g')],
    bekal: true,
    heavyCook: true,
  }),
  menu('sup-ayam', 'Sup ayam sayur + nasi', 'masak', ['malam'], 30, 10_000, {
    ingredients: [ing('Dada ayam', 120, 'g'), ing('Sayur sup', 150, 'g'), ing('Beras', 80, 'g')],
    heavyCook: true,
  }),
  menu('tempe-tahu-telur', 'Tempe tahu bacem + telur + nasi', 'masak', ['siang', 'malam'], 28, 8_000, {
    ingredients: [ing('Tempe', 100, 'g'), ing('Tahu', 100, 'g'), ing('Telur', 1, 'butir'), ing('Beras', 80, 'g')],
    bekal: true,
    heavyCook: true,
  }),
  // Beli.
  menu('geprek', 'Nasi ayam geprek', 'beli', ['siang', 'malam'], 25, 15_000, { place: 'warung dekat RS' }),
  menu('lalapan-dada', 'Nasi lalapan ayam (dada)', 'beli', ['siang', 'malam'], 30, 18_000),
  menu('pecel-telur', 'Nasi pecel + telur', 'beli', ['sarapan', 'siang'], 14, 12_000),
  menu('soto-ayam', 'Soto ayam + nasi', 'beli', ['siang', 'malam'], 18, 14_000),
  menu('nasi-campur', 'Nasi campur ayam + telur', 'beli', ['siang'], 28, 17_000),
  menu('roti-susu', 'Roti gandum + susu (minimarket)', 'beli', ['sarapan', 'snack1', 'snack2'], 14, 12_000, { bekal: true }),
]

// ---------- Gerakan latihan bawaan ----------

const ex = (
  key: string,
  name: string,
  group: Exercise['group'],
  repMin: number,
  repMax: number,
  sets: number,
  increment: number,
  order: number,
  muscle: Exercise['muscle'],
): Exercise => ({
  id: `#ex:${key}`,
  name,
  group,
  muscle,
  repMin,
  repMax,
  sets,
  increment,
  archived: false,
  order,
  createdAt: T0,
  updatedAt: T0,
})

export const DEFAULT_EXERCISES: Exercise[] = [
  ex('bench', 'Bench press', 'upper', 5, 8, 3, 2.5, 1, 'dada'),
  ex('squat', 'Squat', 'lower', 5, 8, 3, 5, 2, 'kaki'),
  ex('deadlift', 'Deadlift', 'lower', 3, 6, 2, 5, 3, 'kaki'),
  ex('ohp', 'Overhead press', 'upper', 6, 10, 3, 2.5, 4, 'bahu'),
  ex('row', 'Barbell row', 'upper', 6, 10, 3, 2.5, 5, 'punggung'),
  ex('pulldown', 'Pull-up / lat pulldown', 'upper', 6, 10, 3, 2.5, 6, 'punggung'),
]
