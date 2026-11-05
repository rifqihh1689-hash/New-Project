import type { DayType, Phase } from '../types'
import { weekday } from './time'

export const DAY_TYPES: readonly DayType[] = ['stase', 'jaga', 'pasca', 'libur']

export const DAY_TYPE_LABELS: Record<DayType, string> = {
  stase: 'Stase',
  jaga: 'Jaga malam',
  pasca: 'Pasca-jaga',
  libur: 'Libur',
}

/** Label tipe hari, mengikuti fase hidup yang sedang berjalan (mis. "Dinas" saat PPDS). */
export function dayTypeLabel(type: DayType, phase?: Pick<Phase, 'dayTypeLabels'> | null): string {
  return phase?.dayTypeLabels?.[type]?.trim() || DAY_TYPE_LABELS[type]
}

/**
 * Tipe yang dipakai menghitung XP. Pasca-jaga hanya sah bila kemarin jaga; selain itu dihitung stase
 * (menutup celah "100 XP mudah" dari MBAPPE OS).
 */
export function effectiveDayType(type: DayType | null, prevType: DayType | null): { type: DayType | null; invalidPasca: boolean } {
  if (type === 'pasca' && prevType !== 'jaga') return { type: 'stase', invalidPasca: true }
  return { type, invalidPasca: false }
}

/** Saran tipe hari bila belum dipilih: setelah jaga → pasca-jaga, Minggu → libur, selain itu stase. */
export function suggestDayType(date: string, prevType: DayType | null): DayType {
  if (prevType === 'jaga') return 'pasca'
  if (weekday(date) === 0) return 'libur'
  return 'stase'
}

/** Jaga dan pasca-jaga tidak pernah memutus streak. */
export function isNeutralDayType(type: DayType | null): boolean {
  return type === 'jaga' || type === 'pasca'
}

/** Pada pasca-jaga hanya isi pemulihan yang tampil; tugas lain pindah ke besok. */
export function isAllowedOnDayType(type: DayType | null, item: { recovery: boolean }): boolean {
  return type !== 'pasca' || item.recovery
}
