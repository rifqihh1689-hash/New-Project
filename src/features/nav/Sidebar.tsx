import { CircleUser, Moon, PanelLeftClose, PanelLeftOpen, Sun } from 'lucide-react'
import { routeHref, type RouteName } from '../../app/router'
import { resolveTheme } from '../settings/theme'
import { useThemeContext } from '../settings/theme-context'
import { Brand, BrandMark } from './Brand'
import { NAV_ITEMS } from './items'
import { SIDEBAR_SHORTCUT } from './useSidebar'
import { SyncBadge } from './SyncBadge'

const linkClass = (on: boolean, rail: boolean) =>
  `relative flex items-center rounded-[10px] font-[450] transition ${
    rail ? 'size-10 justify-center' : 'gap-3 px-2.5 py-[9px]'
  } ${on ? 'bg-surface-2 text-text' : 'text-muted hover:text-text'}`

interface Props {
  active: RouteName
  counts: Partial<Record<RouteName, string>>
  /** Diciutkan jadi rel ikon (layar lebar & iPad). */
  collapsed: boolean
  onToggle: () => void
}

export function Sidebar({ active, counts, collapsed: rail, onToggle }: Props) {
  const [theme, setTheme] = useThemeContext()
  const dark = resolveTheme(theme) === 'dark'
  const themeLabel = dark ? 'Tema terang' : 'Tema gelap'
  const toggleLabel = `${rail ? 'Lebarkan' : 'Ciutkan'} sidebar (${SIDEBAR_SHORTCUT})`
  const ToggleIcon = rail ? PanelLeftOpen : PanelLeftClose
  // Saat ciut, label disembunyikan tapi tetap jadi nama aksesibel & tooltip.
  const railProps = (label: string) => (rail ? { 'aria-label': label, title: label } : {})
  const toggle = (
    <button
      type="button"
      onClick={onToggle}
      aria-label={toggleLabel}
      aria-expanded={!rail}
      title={toggleLabel}
      className="grid size-9 shrink-0 place-items-center rounded-[10px] text-muted transition hover:bg-surface-2 hover:text-text"
    >
      <ToggleIcon size={18} strokeWidth={1.8} aria-hidden="true" />
    </button>
  )
  return (
    <aside
      className={`sticky top-0 hidden h-dvh flex-col gap-1 overflow-x-hidden overflow-y-auto border-r border-line bg-side py-[18px] md:flex ${
        rail ? 'items-center px-2' : 'px-3.5'
      }`}
    >
      {rail ? (
        <div className="mb-3 grid justify-items-center gap-2">
          <a href={routeHref('beranda')} aria-label="Qawwam, ke Beranda" title="Qawwam">
            <BrandMark size={30} />
          </a>
          {toggle}
        </div>
      ) : (
        <div className="mb-3 flex items-center gap-2 pl-2.5">
          <Brand className="mr-auto text-[22px]" />
          {toggle}
        </div>
      )}
      <nav aria-label="Navigasi utama" className="grid gap-0.5">
        {NAV_ITEMS.map(({ route, label, Icon, soon }) => (
          <a
            key={route}
            href={routeHref(route)}
            className={linkClass(route === active, rail)}
            aria-current={route === active ? 'page' : undefined}
            {...railProps(label)}
          >
            <Icon size={18} strokeWidth={1.8} aria-hidden="true" />
            {!rail && label}
            {counts[route] &&
              (rail ? (
                <span className="absolute -top-0.5 -right-0.5 grid h-4 min-w-4 place-items-center rounded-full bg-text px-1 text-[10px] font-semibold text-bg">
                  {counts[route]}
                </span>
              ) : (
                <span className="ml-auto text-xs text-faint">{counts[route]}</span>
              ))}
            {soon && <span className="sr-only">(segera, Fase {soon.phase})</span>}
          </a>
        ))}
      </nav>
      <div className={`mt-auto grid gap-0.5 border-t border-line pt-3 ${rail ? 'w-full justify-items-center' : ''}`}>
        <SyncBadge compact={rail} />
        <button
          type="button"
          onClick={() => setTheme(dark ? 'light' : 'dark')}
          className={linkClass(false, rail)}
          {...railProps(themeLabel)}
        >
          {dark ? <Sun size={18} strokeWidth={1.8} aria-hidden="true" /> : <Moon size={18} strokeWidth={1.8} aria-hidden="true" />}
          {!rail && themeLabel}
        </button>
        <a href={routeHref('setelan')} className={linkClass(active === 'setelan', rail)} {...railProps('Setelan & akun')}>
          <CircleUser size={18} strokeWidth={1.8} aria-hidden="true" />
          {!rail && 'Setelan & akun'}
        </a>
      </div>
    </aside>
  )
}
