import { dayKey } from '../domain/time'
import { db, SCHEMA_V1 } from './db'

export const BACKUP_APP = 'qawwam'
export const BACKUP_VERSION = 1

export type BackupFile = {
  app: typeof BACKUP_APP
  version: number
  exportedAt: string
  data: Record<string, unknown[]>
}

/** Semua tabel apa adanya. Data milikmu: tetap bisa dibawa keluar walau sudah sinkron. */
export async function createBackup(now: Date = new Date()): Promise<BackupFile> {
  const data: Record<string, unknown[]> = {}
  for (const name of Object.keys(SCHEMA_V1)) data[name] = await db.table(name).toArray()
  return { app: BACKUP_APP, version: BACKUP_VERSION, exportedAt: now.toISOString(), data }
}

export function backupFileName(nowMs: number = Date.now()): string {
  return `qawwam-${dayKey(nowMs)}.json`
}
