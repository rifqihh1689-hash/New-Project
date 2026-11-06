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
  /** `segmented`: empat pilihan dalam satu baris yang selalu muat (Beranda); `chips`: deret chip (Kalender). */
  variant?: 'chips' | 'segmented'
}

/** Stase / Jaga / Pasca-jaga / Libur. Saran ditandai garis putus-putus bila belum dipilih. */
export function DayTypePicker({ date, value, suggested, phase, className = '', variant = 'chips' }: Props) {
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
  if (variant === 'segmented')
    return (
      <div role="radiogroup" aria-label="Tipe hari" className={`grid grid-cols-4 gap-1 rounded-full bg-surface-2 p-1 ${className}`}>
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
              className={`flex min-w-0 items-center justify-center gap-1.5 rounded-full px-1 py-[7px] text-[12.5px] whitespace-nowrap transition sm:text-[13px] ${
                on
                  ? 'bg-surface font-semibold text-text shadow-sm'
                  : hint
                    ? 'text-text outline-1 -outline-offset-1 outline-muted outline-dashed'
                    : 'text-muted hover:text-text'
              }`}
            >
              <span
                className={`size-2 shrink-0 rounded-full ${on ? 'inline-block' : 'hidden sm:inline-block'}`}
                style={{ background: DAY_TYPE_COLORS[t] }}
                aria-hidden="true"
              />
              {/* HP sempit: kata pertama saja ("Jaga malam" → "Jaga") supaya keempatnya muat utuh. */}
              <span className="truncate sm:hidden">{dayTypeLabel(t, phase).split(' ')[0]}</span>
              <span className="hidden truncate sm:inline">{dayTypeLabel(t, phase)}</span>
            </button>
          )
        })}
      </div>
    )
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
