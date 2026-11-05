import { useEffect, useState } from 'react'
import { isValidISODate } from '../domain/time'

export type RouteName =
  | 'beranda'
  | 'tugas'
  | 'kalender'
  | 'belajar'
  | 'tentir'
  | 'uang'
  | 'habit'
  | 'target'
  | 'catatan'
  | 'muhasabah'
  | 'menu'
  | 'latihan'
  | 'hadiah'
  | 'usulan'
  | 'setelan'
  | 'impor'
  | 'lainnya'

export const ROUTES: readonly RouteName[] = [
  'beranda',
  'tugas',
  'kalender',
  'belajar',
  'tentir',
  'uang',
  'habit',
  'target',
  'catatan',
  'muhasabah',
  'menu',
  'latihan',
  'hadiah',
  'usulan',
  'setelan',
  'impor',
  'lainnya',
]

export interface Route {
  name: RouteName
  /** Tanggal untuk halaman Tugas (`#/tugas/2026-11-06`). */
  date: string | null
}

/** Hash → rute. Router berbasis hash agar aman di GitHub Pages (tanpa rewrite server). */
export function parseRoute(hash: string): Route {
  const [name, param] = hash.replace(/^#\/?/, '').split(/[/?]/)
  const route = (ROUTES as readonly string[]).includes(name) ? (name as RouteName) : 'beranda'
  return { name: route, date: route === 'tugas' && isValidISODate(param) ? param : null }
}

export function routeHref(name: RouteName, date?: string | null): string {
  if (name === 'beranda') return '#/'
  return date ? `#/${name}/${date}` : `#/${name}`
}

export function navigate(name: RouteName, date?: string | null): void {
  window.location.hash = routeHref(name, date)
}

export function useRoute(): Route {
  const [route, setRoute] = useState<Route>(() => parseRoute(window.location.hash))
  useEffect(() => {
    const onChange = () => {
      const next = parseRoute(window.location.hash)
      setRoute((prev) => {
        if (prev.name !== next.name) window.scrollTo({ top: 0 })
        return next
      })
    }
    window.addEventListener('hashchange', onChange)
    return () => window.removeEventListener('hashchange', onChange)
  }, [])
  return route
}
