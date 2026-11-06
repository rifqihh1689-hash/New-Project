import { useCallback, useEffect, useState } from 'react'

const KEY = 'qawwam:sidebar-ciut'

/** Pintasan seperti app Claude/Notion: Ctrl+\ (⌘\ di Mac & iPad). */
export const SIDEBAR_SHORTCUT = typeof navigator !== 'undefined' && /Mac|iPad|iPhone/.test(navigator.platform) ? '⌘\\' : 'Ctrl+\\'

/** Sidebar layar lebar bisa diciutkan jadi rel ikon; pilihan diingat per perangkat. */
export function useSidebar(): [collapsed: boolean, toggle: () => void] {
  const [collapsed, setCollapsed] = useState(() => localStorage.getItem(KEY) === '1')
  const toggle = useCallback(
    () =>
      setCollapsed((c) => {
        localStorage.setItem(KEY, c ? '0' : '1')
        return !c
      }),
    [],
  )
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && !e.altKey && !e.shiftKey && e.key === '\\') {
        e.preventDefault()
        toggle()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [toggle])
  return [collapsed, toggle]
}
