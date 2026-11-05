import { useCallback, useEffect, useState } from 'react'
import type { ThemePreference } from '../../types'

export const THEME_STORAGE_KEY = 'qawwam-theme'
const THEME_COLORS = { light: '#f5f4f0', dark: '#0d0e10' } as const

export function getThemePreference(): ThemePreference {
  try {
    const value = localStorage.getItem(THEME_STORAGE_KEY)
    return value === 'light' || value === 'dark' || value === 'system' ? value : 'system'
  } catch {
    return 'system'
  }
}

function systemPrefersDark(): boolean {
  return typeof window.matchMedia === 'function' && window.matchMedia('(prefers-color-scheme: dark)').matches
}

/** Tema yang benar-benar dipakai setelah preferensi "system" diterjemahkan. */
export function resolveTheme(preference: ThemePreference, prefersDark: boolean = systemPrefersDark()): 'light' | 'dark' {
  return preference === 'system' ? (prefersDark ? 'dark' : 'light') : preference
}

export function applyTheme(preference: ThemePreference): void {
  const resolved = resolveTheme(preference)
  document.documentElement.classList.toggle('dark', resolved === 'dark')
  document.querySelector('meta[name="theme-color"]')?.setAttribute('content', THEME_COLORS[resolved])
}

/** Preferensi tema + setter yang menyimpan ke localStorage dan mengikuti perubahan tema sistem. */
export function useTheme(): [ThemePreference, (preference: ThemePreference) => void] {
  const [preference, setPreference] = useState<ThemePreference>(getThemePreference)

  useEffect(() => {
    applyTheme(preference)
    if (preference !== 'system' || typeof window.matchMedia !== 'function') return
    const media = window.matchMedia('(prefers-color-scheme: dark)')
    const onChange = () => applyTheme('system')
    media.addEventListener('change', onChange)
    return () => media.removeEventListener('change', onChange)
  }, [preference])

  // Sinkron antar-tab.
  useEffect(() => {
    const onStorage = (event: StorageEvent) => {
      if (event.key === THEME_STORAGE_KEY) setPreference(getThemePreference())
    }
    window.addEventListener('storage', onStorage)
    return () => window.removeEventListener('storage', onStorage)
  }, [])

  const update = useCallback((next: ThemePreference) => {
    try {
      localStorage.setItem(THEME_STORAGE_KEY, next)
    } catch {
      // Penyimpanan tidak tersedia (mis. mode privat) — tema tetap berlaku untuk sesi ini.
    }
    setPreference(next)
  }, [])

  return [preference, update]
}
