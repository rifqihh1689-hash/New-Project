import { parseImport, type ImportRow } from '../domain/importer'
import { createId } from '../lib/id'
import type { ISODate, Proposal, Role } from '../types'
import { db } from './db'
import { applyImport, summaryText } from './importer'
import { loadMoneyRefs, type MoneyRefs } from './money'
import { loadRoles } from './structure'

export async function loadProposals(): Promise<Proposal[]> {
  return (await db.proposals.toArray()).sort((a, b) => b.createdAt - a.createdAt)
}

/** Baris pratinjau sebuah usulan (sama dengan pratinjau Impor). */
export function previewProposal(p: Pick<Proposal, 'items'>, roles: Role[], today: ISODate, money?: MoneyRefs): ImportRow[] {
  return parseImport(JSON.stringify(p.items ?? []), { roles, today, ...money })
}

/** Usulan yang dibuat di app (mis. tes); connector menulis langsung lewat REST dengan bentuk yang sama. */
export async function addProposal(summary: string, items: Record<string, unknown>[]): Promise<Proposal> {
  const now = Date.now()
  const p: Proposal = {
    id: createId('prp'),
    summary,
    items,
    status: 'menunggu',
    source: 'claude',
    decidedAt: null,
    createdAt: now,
    updatedAt: now,
  }
  await db.proposals.add(p)
  return p
}

/**
 * Menyetujui usulan: item yang dipilih (indeks baris pratinjau) ditulis lewat jalur Impor.
 * Baris galat atau mirip identitas pasien tidak pernah ditulis.
 */
export async function approveProposal(id: string, today: ISODate, selected?: Set<number>): Promise<string> {
  const p = await db.proposals.get(id)
  if (!p || p.status !== 'menunggu') throw new Error('Usulan sudah diputuskan.')
  const rows = previewProposal(p, await loadRoles(), today, await loadMoneyRefs())
  const items = rows.filter((r, i) => r.item && !r.phi && (!selected || selected.has(i))).map((r) => r.item!)
  const result = items.length ? summaryText(await applyImport(items)) : 'Tidak ada item yang diterapkan.'
  await db.proposals.update(id, { status: 'disetujui', decidedAt: Date.now(), result, updatedAt: Date.now() })
  return result
}

export async function rejectProposal(id: string): Promise<void> {
  await db.proposals.update(id, { status: 'ditolak', decidedAt: Date.now(), updatedAt: Date.now() })
}

/** Mengembalikan usulan yang ditolak ke "menunggu" (Urungkan). */
export async function reopenProposal(id: string): Promise<void> {
  await db.proposals.update(id, { status: 'menunggu', decidedAt: null, updatedAt: Date.now() })
}

/** Usulan yang sudah diputuskan diringkas (daftar item dibuang) setelah ini; baris riwayatnya tetap. */
export const COMPACT_AFTER_DAYS = 30

/**
 * Meringkas usulan lama: yang sudah disetujui/ditolak lebih dari `COMPACT_AFTER_DAYS` hari dibuang daftar itemnya
 * (hasilnya sudah ada di data aslinya: tugas, menu, jadwal). Judul, status, tanggal, dan hasil tetap.
 * Yang masih menunggu tidak pernah disentuh. Aman diulang di banyak perangkat. Mengembalikan jumlah yang diringkas.
 */
export async function compactProposals(now: number = Date.now()): Promise<number> {
  const cutoff = now - COMPACT_AFTER_DAYS * 86_400_000
  const old = (await db.proposals.where('status').anyOf('disetujui', 'ditolak').toArray()).filter(
    (p) => p.decidedAt != null && p.decidedAt < cutoff && p.items.length > 0,
  )
  if (!old.length) return 0
  await db.proposals.bulkPut(old.map((p) => ({ ...p, items: [], updatedAt: now })))
  return old.length
}

/** Menghapus satu usulan yang sudah diputuskan dari riwayat; mengembalikan barisnya untuk Urungkan. */
export async function deleteProposal(id: string): Promise<Proposal | undefined> {
  const p = await db.proposals.get(id)
  if (!p || p.status === 'menunggu') return undefined
  await db.proposals.delete(id)
  return p
}

/** Menghapus semua usulan yang ditolak; mengembalikan barisnya untuk Urungkan. */
export async function deleteRejectedProposals(): Promise<Proposal[]> {
  const rows = await db.proposals.where('status').equals('ditolak').toArray()
  await db.proposals.bulkDelete(rows.map((p) => p.id))
  return rows
}

export const restoreProposals = (rows: Proposal[]) => db.proposals.bulkPut(rows)
