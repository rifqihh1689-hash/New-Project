import { CircleUser, Moon, Sun } from 'lucide-react'
import { routeHref, type RouteName } from '../../app/router'
import { resolveTheme } from '../settings/theme'
import { useThemeContext } from '../settings/theme-context'
import { Brand } from './Brand'
import { NAV_ITEMS } from './items'
import { SyncBadge } from './SyncBadge'

const linkClass = (on: boolean) =>
  `flex items-center gap-3 rounded-[10px] px-2.5 py-[9px] font-[450] transition ${
    on ? 'bg-surface-2 text-text' : 'text-muted hover:text-text'
  }`

export function Sidebar({ active, counts }: { active: RouteName; counts: Partial<Record<RouteName, string>> }) {
  const [theme, setTheme] = useThemeContext()
  const dark = resolveTheme(theme) === 'dark'
  return (
    <aside className="sticky top-0 hidden h-dvh flex-col gap-1 overflow-y-auto border-r border-line bg-side px-3.5 py-[22px] md:flex">
      <Brand className="px-2.5 pb-[18px] text-[22px]" />
      <nav aria-label="Navigasi utama" className="grid gap-0.5">
        {NAV_ITEMS.map(({ route, label, Icon, soon }) => (
          <a
            key={route}
            href={routeHref(route)}
            className={linkClass(route === active)}
            aria-current={route === active ? 'page' : undefined}
          >
            <Icon size={18} strokeWidth={1.8} aria-hidden="true" />
            {label}
            {counts[route] && <span className="ml-auto text-xs text-faint">{counts[route]}</span>}
            {soon && <span className="sr-only">(segera, Fase {soon.phase})</span>}
          </a>
        ))}
      </nav>
      <div className="mt-auto grid gap-0.5 border-t border-line pt-3">
        <SyncBadge />
        <button type="button" onClick={() => setTheme(dark ? 'light' : 'dark')} className={linkClass(false)}>
          {dark ? <Sun size={18} strokeWidth={1.8} aria-hidden="true" /> : <Moon size={18} strokeWidth={1.8} aria-hidden="true" />}
          {dark ? 'Tema terang' : 'Tema gelap'}
        </button>
        <a href={routeHref('setelan')} className={linkClass(active === 'setelan')}>
          <CircleUser size={18} strokeWidth={1.8} aria-hidden="true" />
          Setelan &amp; akun
        </a>
      </div>
    </aside>
  )
}
