import { parseImport, type ImportRow } from '../domain/importer'
import { createId } from '../lib/id'
import type { ISODate, Proposal, Role } from '../types'
import { db } from './db'
import { applyImport, summaryText } from './importer'
import { loadRoles } from './structure'

export async function loadProposals(): Promise<Proposal[]> {
  return (await db.proposals.toArray()).sort((a, b) => b.createdAt - a.createdAt)
}

/** Baris pratinjau sebuah usulan (sama dengan pratinjau Impor). */
export function previewProposal(p: Pick<Proposal, 'items'>, roles: Role[], today: ISODate): ImportRow[] {
  return parseImport(JSON.stringify(p.items ?? []), { roles, today })
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
  const rows = previewProposal(p, await loadRoles(), today)
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
