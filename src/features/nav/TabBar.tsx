import { House, Menu, Plus, SquareCheck, Wallet } from 'lucide-react'
import { routeHref, type RouteName } from '../../app/router'

/** Navigasi bawah di HP: Beranda, Tugas, +, Uang, Lainnya. */
export function TabBar({ active, onCapture }: { active: RouteName; onCapture: () => void }) {
  const tab = (route: RouteName, label: string, Icon: typeof House, on: boolean) => (
    <a
      href={routeHref(route)}
      aria-current={on ? 'page' : undefined}
      className={`grid justify-items-center gap-[3px] text-[11px] ${on ? 'text-text' : 'text-muted'}`}
    >
      <Icon size={22} strokeWidth={on ? 2.1 : 1.8} aria-hidden="true" />
      {label}
    </a>
  )
  const inMore = !['beranda', 'tugas', 'uang'].includes(active)
  return (
    <nav
      aria-label="Navigasi utama"
      className="fixed inset-x-0 bottom-0 z-30 grid grid-cols-5 items-center border-t border-line bg-side/90 px-1.5 pt-2 pb-[calc(8px+env(safe-area-inset-bottom))] backdrop-blur-md md:hidden"
    >
      {tab('beranda', 'Beranda', House, active === 'beranda')}
      {tab('tugas', 'Tugas', SquareCheck, active === 'tugas')}
      <div className="grid justify-items-center">
        <button
          type="button"
          onClick={onCapture}
          aria-label="Catat cepat"
          className="-mt-1 grid size-[46px] place-items-center rounded-full bg-btn text-btn-text shadow-lg active:scale-95"
        >
          <Plus size={22} strokeWidth={2.2} aria-hidden="true" />
        </button>
      </div>
      {tab('uang', 'Uang', Wallet, active === 'uang')}
      {tab('lainnya', 'Lainnya', Menu, inMore)}
    </nav>
  )
}
