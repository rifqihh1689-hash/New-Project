import { routeHref } from '../../app/router'
import { SLOT_LABELS } from '../../domain/menu'
import { formatRupiah } from '../../lib/format'
import type { BerandaData } from './data'

/** Makan hari ini dari rencana menu mingguan: tidak perlu memikirkan menu lagi. */
export function MealsCard({ data }: { data: BerandaData }) {
  const planned = data.meals.filter((m) => m.menu)
  const protein = planned.reduce((a, m) => a + m.menu!.proteinG, 0)
  const cost = planned.reduce((a, m) => a + m.menu!.costRp, 0)
  return (
    <div className="card">
      <h3 className="card-title">
        Makan hari ini
        {planned.length > 0 && (
          <span className="text-[13px] font-medium text-faint">
            {protein}
            {data.proteinTarget ? `/${data.proteinTarget}` : ''} g protein
          </span>
        )}
        <a href={routeHref('menu')} className="ml-auto text-[13px] font-normal text-faint hover:text-text">
          Menu →
        </a>
      </h3>
      {planned.length === 0 ? (
        <p className="text-[13px] text-muted">
          Belum ada menu hari ini.{' '}
          <a href={routeHref('menu')} className="text-text underline-offset-2 hover:underline">
            Susun menu minggu ini
          </a>{' '}
          sekali ketuk.
        </p>
      ) : (
        <>
          <ul>
            {data.meals.map(({ slot, menu }) => (
              <li key={slot} className="flex items-center gap-2 border-t border-line py-2 text-[13.5px] first:border-t-0">
                <span className="w-[86px] shrink-0 text-xs text-muted">{SLOT_LABELS[slot]}</span>
                <span className={`flex-1 ${menu ? '' : 'text-faint'}`}>{menu?.name ?? '—'}</span>
                {menu && (
                  <span className={`text-[10.5px] font-medium ${menu.source === 'masak' ? 'text-ok' : 'text-uang'}`}>{menu.source}</span>
                )}
              </li>
            ))}
          </ul>
          <p className="mt-2 text-xs text-faint">Perkiraan {formatRupiah(cost)} hari ini.</p>
        </>
      )}
    </div>
  )
}
