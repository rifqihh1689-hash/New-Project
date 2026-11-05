import { useObservable } from 'dexie-react-hooks'
import { CLOUD_URL, db } from './db'

export type SyncMode = 'lokal' | 'belum-masuk' | 'menyinkron' | 'tersinkron' | 'offline' | 'galat'

export interface SyncInfo {
  mode: SyncMode
  label: string
  email: string | null
}

const LABELS: Record<SyncMode, string> = {
  lokal: 'Lokal saja · sinkron belum diatur',
  'belum-masuk': 'Belum masuk',
  menyinkron: 'Menyinkron…',
  tersinkron: 'Tersinkron',
  offline: 'Offline · tersimpan di perangkat',
  galat: 'Sinkron gagal',
}

/** Status sinkron untuk ditampilkan di sidebar / Setelan. */
export function useSyncInfo(): SyncInfo {
  const user = useObservable(db.cloud.currentUser)
  const state = useObservable(db.cloud.syncState)
  if (!CLOUD_URL) return { mode: 'lokal', label: LABELS.lokal, email: null }
  const email = user?.isLoggedIn ? (user.email ?? user.userId ?? null) : null
  let mode: SyncMode
  if (!user?.isLoggedIn) mode = 'belum-masuk'
  else if (!state || state.phase === 'offline' || state.status === 'offline') mode = 'offline'
  else if (state.phase === 'error' || state.status === 'error') mode = 'galat'
  else if (state.phase === 'in-sync') mode = 'tersinkron'
  else mode = 'menyinkron'
  return { mode, label: LABELS[mode], email }
}

export async function login(): Promise<void> {
  await db.cloud.login()
}

export async function logout(): Promise<void> {
  await db.cloud.logout()
}

export async function syncNow(): Promise<void> {
  if (CLOUD_URL) await db.cloud.sync({ wait: true, purpose: 'pull' })
}
