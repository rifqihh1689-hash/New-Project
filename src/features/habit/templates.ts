import type { DayType, Habit } from '../../types'

export type HabitTemplate = Pick<Habit, 'name' | 'roleId' | 'size' | 'dayTypes' | 'weekdays' | 'minutes'>

const WORK: DayType[] = ['stase', 'libur']

/** Tambah cepat: habit inti dari MBAPPE OS, disesuaikan dengan peran Qawwam. */
export const HABIT_TEMPLATES: HabitTemplate[] = [
  { name: 'Blok belajar 45 mnt', roleId: '#role:ukmppd', size: 'sedang', dayTypes: WORK, weekdays: [], minutes: 45 },
  { name: 'Drill 10 soal UKMPPD', roleId: '#role:ukmppd', size: 'sedang', dayTypes: WORK, weekdays: [], minutes: null },
  { name: 'Latihan beban', roleId: '#role:pulih', size: 'besar', dayTypes: WORK, weekdays: [1, 3, 5], minutes: null },
  { name: 'Lari pagi 30 mnt', roleId: '#role:pulih', size: 'sedang', dayTypes: WORK, weekdays: [2, 4], minutes: 30 },
  { name: 'Blok riset / SR 30 mnt', roleId: '#role:orto', size: 'sedang', dayTypes: WORK, weekdays: [], minutes: 30 },
  { name: 'Bahasa Inggris 15 mnt', roleId: '#role:orto', size: 'kecil', dayTypes: [...WORK, 'jaga'], weekdays: [], minutes: 15 },
]
