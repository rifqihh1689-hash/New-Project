import { useState } from 'react'
import { ScheduleList } from '../../components/ScheduleList'
import { currentIndex } from '../../domain/schedule'
import type { BerandaData } from './data'
import { useSchedule } from './useSchedule'

/**
 * Jadwal hari ini: ritme tipe hari digabung sesi tentir, agenda, latihan terjadwal, dan jam tidur.
 * `compact` (HP): hanya sisa hari ini, sisanya bisa dibuka.
 */
export function Ritme({ data, compact = false }: { data: BerandaData; compact?: boolean }) {
  const schedule = useSchedule(data)
  const [all, setAll] = useState(false)
  const now = currentIndex(schedule.items, schedule.minutes)
  const from = compact && !all ? Math.max(0, now) : 0
  const training = schedule.items.some((i) => i.source === 'latihan' && i.warn)
  return (
    <div className="card">
      <h3 className="card-title flex-wrap">
        {compact && !all ? 'Sisa hari ini' : 'Jadwal hari ini'}{' '}
        <span className="text-[13px] font-medium text-faint">
          {data.snap.day?.type ? 'ritme, tentir, agenda, latihan' : 'perkiraan, pilih tipe hari'}
        </span>
        {compact && now > 0 && (
          <button type="button" className="ml-auto text-[13px] font-normal text-faint hover:text-text" onClick={() => setAll(!all)}>
            {all ? 'Sisa saja' : 'Sehari penuh'}
          </button>
        )}
      </h3>
      {schedule.allDay.length > 0 && (
        <div className="mb-2 flex flex-wrap gap-1.5">
          {schedule.allDay.map((e) => (
            <a key={e.id} href="#/kalender" className="chip py-1 text-xs">
              {e.title}
            </a>
          ))}
        </div>
      )}
      <ScheduleList items={schedule.items} roles={data.roles} minutes={schedule.minutes} from={from} />
      {schedule.conflicts.length > 0 && (
        <p className="mt-2 text-xs text-uang">
          {schedule.conflicts.length} hal perlu diputuskan.{' '}
          {training && (
            <a href="#/latihan" className="underline underline-offset-2">
              Atur jadwal latihan →
            </a>
          )}
        </p>
      )}
    </div>
  )
}
