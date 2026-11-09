import { diffDays } from './time'
import type { DocStatus, ISODate, MainQuest, PpdsDoc } from '../types'

export const MAX_ACTIVE_QUESTS = 3

export const DOC_GROUPS: Record<PpdsDoc['group'], string> = {
  berkas: 'Berkas',
  sertifikat: 'Sertifikat',
  portofolio: 'Portofolio',
  bahasa: 'Bahasa',
}

export const STATUS_LABELS: Record<DocStatus, string> = { belum: 'Belum', proses: 'Proses', siap: 'Siap' }
export const STATUS_ORDER: DocStatus[] = ['belum', 'proses', 'siap']

/** Contoh daftar umum. Persyaratan tiap FK berbeda: sesuaikan dengan pedoman penerimaan program yang dituju. */
export const DEFAULT_DOCS: Pick<PpdsDoc, 'name' | 'group'>[] = [
  { name: 'STR dokter', group: 'berkas' },
  { name: 'Ijazah & transkrip dokter', group: 'berkas' },
  { name: 'Surat keterangan sehat', group: 'berkas' },
  { name: 'SKCK', group: 'berkas' },
  { name: 'Surat rekomendasi (2–3)', group: 'berkas' },
  { name: 'Surat izin/rekomendasi tempat kerja', group: 'berkas' },
  { name: 'Sertifikat ATLS / BTCLS', group: 'sertifikat' },
  { name: 'Sertifikat pelatihan lain (ACLS, dll.)', group: 'sertifikat' },
  { name: 'Laporan kasus / publikasi', group: 'portofolio' },
  { name: 'Logbook kasus & tindakan (tanpa identitas pasien)', group: 'portofolio' },
  { name: 'Systematic review / penelitian', group: 'portofolio' },
  { name: 'Skor TOEFL / IELTS', group: 'bahasa' },
]

export interface DocStats {
  total: number
  ready: number
  /** 0–1. */
  ratio: number
  overdue: number
}

export function docStats(docs: Pick<PpdsDoc, 'status' | 'due'>[], today: ISODate): DocStats {
  const ready = docs.filter((d) => d.status === 'siap').length
  return {
    total: docs.length,
    ready,
    ratio: docs.length ? ready / docs.length : 0,
    overdue: docs.filter((d) => d.status !== 'siap' && d.due != null && d.due < today).length,
  }
}

/** Butir belum siap yang paling mendesak: tenggat terdekat (termasuk yang sudah lewat). */
export function nextDeadline<T extends Pick<PpdsDoc, 'status' | 'due'>>(docs: T[]): T | null {
  return docs.filter((d) => d.status !== 'siap' && d.due).sort((a, b) => a.due!.localeCompare(b.due!))[0] ?? null
}

/** "5 hari lagi" · "hari ini" · "lewat 3 hari". */
export function dueLabel(due: ISODate, today: ISODate): string {
  const d = diffDays(due, today)
  return d === 0 ? 'hari ini' : d > 0 ? `${d} hari lagi` : `lewat ${-d} hari`
}

export const activeQuests = <T extends Pick<MainQuest, 'status'>>(quests: T[]): T[] => quests.filter((q) => q.status === 'aktif')

/** Main Quest maksimal 3 aktif (prinsip WIP ≤ 3). */
export const canActivate = (quests: Pick<MainQuest, 'status'>[]) => activeQuests(quests).length < MAX_ACTIVE_QUESTS
