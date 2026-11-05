import { routeHref } from '../../app/router'
import { DAY_SHORT, formatMonth, monthOf } from '../../domain/time'
import { useKalender } from '../kalender/data'
import { DAY_TYPE_COLORS } from './dayTypeColors'

/** Kalender kecil bulan ini di Beranda layar lebar: jaga berwarna, titik agenda. */
export function MiniCalendar({ today }: { today: string }) {
  const data = useKalender(monthOf(today))
  if (!data) return null
  return (
    <a href={routeHref('kalender')} className="card block transition hover:bg-surface-2">
      <h3 className="card-title">
        Kalender <span className="text-[13px] font-medium text-faint">{formatMonth(data.month)}</span>
        <span className="ml-auto text-[13px] font-normal text-faint">{data.stats.count} jaga →</span>
      </h3>
      <div className="grid grid-cols-7 gap-1 text-center text-[11px]">
        {[1, 2, 3, 4, 5, 6, 0].map((w) => (
          <span key={w} className="text-faint">
            {DAY_SHORT[w].slice(0, 1)}
          </span>
        ))}
        {data.grid.slice(0, data.grid.findLastIndex((d) => monthOf(d) === data.month) + 1).map((d) => {
          const type = data.types(d)
          const inMonth = monthOf(d) === data.month
          return (
            <span
              key={d}
              className={`relative grid h-7 place-items-center rounded-md tabular-nums ${inMonth ? '' : 'opacity-30'} ${d === today ? 'ring-1 ring-text' : ''} ${type === 'jaga' ? 'font-semibold text-white' : ''}`}
              style={type === 'jaga' ? { background: DAY_TYPE_COLORS.jaga } : undefined}
            >
              {Number(d.slice(8))}
              {(data.eventCount.get(d) ?? 0) > 0 && <i className="absolute bottom-0.5 size-1 rounded-full bg-current" aria-hidden="true" />}
            </span>
          )
        })}
      </div>
    </a>
  )
}
