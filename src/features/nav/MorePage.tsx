import { ChevronRight, CircleUser } from 'lucide-react'
import { routeHref } from '../../app/router'
import { NAV_ITEMS } from './items'

/** Menu "Lainnya" di HP: semua bagian yang tidak muat di navigasi bawah. */
export function MorePage() {
  const items = NAV_ITEMS.filter((i) => !['beranda', 'tugas', 'uang'].includes(i.route))
  return (
    <div className="pt-4">
      <h1 className="mb-4 text-[26px] font-semibold tracking-tight">Lainnya</h1>
      <nav className="card grid gap-0.5 p-2">
        {[...items, { route: 'setelan' as const, label: 'Setelan & akun', Icon: CircleUser, soon: undefined }].map(
          ({ route, label, Icon, soon }) => (
            <a key={route} href={routeHref(route)} className="flex items-center gap-3 rounded-xl px-3 py-3 hover:bg-surface-2">
              <Icon size={19} strokeWidth={1.8} className="text-muted" aria-hidden="true" />
              <span className="flex-1">{label}</span>
              {soon && <span className="text-xs text-faint">Fase {soon.phase}</span>}
              <ChevronRight size={16} className="text-faint" aria-hidden="true" />
            </a>
          ),
        )}
      </nav>
    </div>
  )
}
