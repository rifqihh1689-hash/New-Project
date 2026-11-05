import { routeHref } from '../../app/router'
import type { BerandaData } from './data'

/** Prioritas minggu ini (Muhasabah minggu lalu) dan bulan ini (Muhasabah bulanan). Tidak tampil bila kosong. */
export function PrioritiesCard({ data }: { data: BerandaData }) {
  if (!data.priorities.length && !data.monthPriorities.length) return null
  return (
    <div className="card">
      <h3 className="card-title">
        {data.priorities.length ? 'Prioritas minggu ini' : 'Prioritas bulan ini'}
        <a href={routeHref('muhasabah')} className="ml-auto text-[13px] font-normal text-faint hover:text-text">
          Muhasabah →
        </a>
      </h3>
      <ol className="grid gap-2">
        {(data.priorities.length ? data.priorities : data.monthPriorities).map((p, i) => (
          <li key={i} className="flex items-start gap-2.5 text-[13.5px]">
            <span className="grid size-5 shrink-0 place-items-center rounded-full bg-surface-2 text-[11px] font-semibold text-muted">
              {i + 1}
            </span>
            {p}
          </li>
        ))}
      </ol>
      {data.priorities.length > 0 && data.monthPriorities.length > 0 && (
        <div className="mt-3 border-t border-line pt-2 text-xs text-muted">
          <span className="font-medium text-text">Bulan ini:</span> {data.monthPriorities.join(' · ')}
        </div>
      )}
    </div>
  )
}
