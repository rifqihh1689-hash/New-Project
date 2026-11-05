import { DAY_TYPES, dayTypeLabel } from '../../domain/dayType'
import { addDays, dayKey, relativeDayLabel } from '../../domain/time'
import { moveTasks, setDayType } from '../../db/daily'
import { useToast } from '../../components/toast-context'
import type { DayType, ISODate, Phase } from '../../types'
import { DAY_TYPE_COLORS } from './dayTypeColors'

interface Props {
  date: ISODate
  value: DayType | null
  suggested: DayType
  phase: Phase | null
  className?: string
}

/** Stase / Jaga / Pasca-jaga / Libur. Saran ditandai garis putus-putus bila belum dipilih. */
export function DayTypePicker({ date, value, suggested, phase, className = '' }: Props) {
  const toast = useToast()
  const choose = async (type: DayType) => {
    const next = value === type ? null : type
    const moved = await setDayType(date, next)
    if (moved.length) {
      toast({
        message: `Pasca-jaga: ${moved.length} tugas non-pemulihan dipindah ke ${relativeDayLabel(addDays(date, 1), dayKey()).toLowerCase()}.`,
        tone: 'info',
        duration: 6000,
        action: { label: 'Urungkan', onClick: () => void moveTasks(moved, date) },
      })
    }
  }
  return (
    <div role="radiogroup" aria-label="Tipe hari" className={`flex gap-1.5 overflow-x-auto pb-0.5 ${className}`}>
      {DAY_TYPES.map((t) => {
        const on = value === t
        const hint = !value && suggested === t
        return (
          <button
            key={t}
            type="button"
            role="radio"
            aria-checked={on}
            onClick={() => void choose(t)}
            title={hint ? 'Disarankan' : undefined}
            className={`chip ${on ? 'border-transparent bg-btn font-semibold text-btn-text' : hint ? 'border-dashed border-muted text-text' : 'hover:text-text'}`}
          >
            <span className="dot" style={{ background: DAY_TYPE_COLORS[t] }} aria-hidden="true" />
            {dayTypeLabel(t, phase)}
          </button>
        )
      })}
    </div>
  )
}
