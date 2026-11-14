import { useMemo } from 'react'
import { useClockMinutes } from '../../app/useToday'
import { daySchedule, type DaySchedule } from '../../domain/schedule'
import type { BerandaData } from './data'

/**
 * Jadwal terpadu hari ini. Dihitung ulang tiap jam dinding bergerak (qailulah yang terlewat memajukan
 * jam tidur), tanpa memuat ulang data.
 */
export function useSchedule(data: BerandaData): DaySchedule & { minutes: number } {
  const minutes = useClockMinutes()
  const input = data.scheduleInput
  return useMemo(
    () => ({ ...daySchedule({ ...input, sleep: input.sleep && { ...input.sleep, nowMinutes: minutes } }), minutes }),
    [input, minutes],
  )
}
