import { routeHref } from '../../app/router'
import type { BerandaData } from './data'

/** 3 prioritas minggu ini, hasil Muhasabah minggu lalu. Tidak tampil bila kosong. */
export function PrioritiesCard({ data }: { data: BerandaData }) {
  if (!data.priorities.length) return null
  return (
    <div className="card">
      <h3 className="card-title">
        Prioritas minggu ini
        <a href={routeHref('muhasabah')} className="ml-auto text-[13px] font-normal text-faint hover:text-text">
          Muhasabah →
        </a>
      </h3>
      <ol className="grid gap-2">
        {data.priorities.map((p, i) => (
          <li key={i} className="flex items-start gap-2.5 text-[13.5px]">
            <span className="grid size-5 shrink-0 place-items-center rounded-full bg-surface-2 text-[11px] font-semibold text-muted">
              {i + 1}
            </span>
            {p}
          </li>
        ))}
      </ol>
    </div>
  )
}
