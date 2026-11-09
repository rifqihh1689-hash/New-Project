import { DAY_TYPE_LABELS } from './dayType'
import { addDays } from './time'
import type { Day, DayType, ISODate } from '../types'

export const ENERGY_LABELS = ['Habis', 'Rendah', 'Cukup', 'Baik', 'Prima'] as const
export const ENERGY_LEVELS = [1, 2, 3, 4, 5] as const

type DayEnergy = Pick<Day, 'date' | 'type' | 'energy'>

export interface EnergyPattern {
  low: { label: string; avg: number }
  high: { label: string; avg: number }
}

export interface EnergyReport {
  today: number | null
  /** 7 hari terakhir sampai hari ini, lama → baru; `null` = tidak dicatat. */
  recent: (number | null)[]
  avg7: number | null
  /** Hari berturut-turut (sampai hari ini, atau kemarin bila hari ini belum diisi) dengan energi ≤ 2. */
  lowRun: number
  /** Selisih rata-rata ≥ 1 antara dua tipe hari yang masing-masing punya ≥ 3 catatan dalam 28 hari. */
  pattern: EnergyPattern | null
}

const MIN_PER_TYPE = 3
const MIN_GAP = 1

export function energyReport(days: DayEnergy[], today: ISODate): EnergyReport {
  const byDate = new Map(days.map((d) => [d.date, d]))
  const at = (n: number): number | null => byDate.get(addDays(today, n))?.energy ?? null
  const recent = Array.from({ length: 7 }, (_, i) => at(i - 6))
  const logged = recent.filter((x): x is number => x != null)
  // Hari ini belum diisi tidak memutus rangkaian: hitung dari kemarin.
  let lowRun = 0
  for (let n = at(0) == null ? -1 : 0; ; n--) {
    const e = at(n)
    if (e == null || e > 2) break
    lowRun++
  }
  const groups = new Map<DayType, number[]>()
  for (const d of days) {
    if (d.energy == null || !d.type || d.date > today || d.date <= addDays(today, -28)) continue
    groups.set(d.type, [...(groups.get(d.type) ?? []), d.energy])
  }
  const avgs = [...groups.entries()]
    .filter(([, v]) => v.length >= MIN_PER_TYPE)
    .map(([type, v]) => ({ label: DAY_TYPE_LABELS[type].toLowerCase(), avg: v.reduce((a, b) => a + b, 0) / v.length }))
    .sort((a, b) => a.avg - b.avg)
  const pattern =
    avgs.length >= 2 && avgs[avgs.length - 1].avg - avgs[0].avg >= MIN_GAP ? { low: avgs[0], high: avgs[avgs.length - 1] } : null
  return {
    today: at(0),
    recent,
    avg7: logged.length ? logged.reduce((a, b) => a + b, 0) / logged.length : null,
    lowRun,
    pattern,
  }
}
