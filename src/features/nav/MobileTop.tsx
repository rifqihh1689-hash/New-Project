import { Moon, Sun } from 'lucide-react'
import { resolveTheme } from '../settings/theme'
import { useThemeContext } from '../settings/theme-context'
import { Brand } from './Brand'
import { SyncBadge } from './SyncBadge'

export function MobileTop() {
  const [theme, setTheme] = useThemeContext()
  const dark = resolveTheme(theme) === 'dark'
  return (
    <div className="flex items-center gap-2.5 px-4 pt-[calc(14px+env(safe-area-inset-top))] md:hidden">
      <Brand className="mr-auto text-xl" />
      <SyncBadge compact />
      <button
        type="button"
        onClick={() => setTheme(dark ? 'light' : 'dark')}
        aria-label={dark ? 'Gunakan tema terang' : 'Gunakan tema gelap'}
        className="grid size-[38px] place-items-center rounded-full border border-line bg-surface"
      >
        {dark ? <Sun size={18} aria-hidden="true" /> : <Moon size={18} aria-hidden="true" />}
      </button>
    </div>
  )
}
