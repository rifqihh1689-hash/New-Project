import { DEFAULT_DOCS, canActivate } from '../domain/ppds'
import { createId } from '../lib/id'
import type { DocStatus, ISODate, MainQuest, PpdsDoc } from '../types'
import { assertNoPatientIdentity } from './daily'
import { db } from './db'

// ---------- Berkas ----------

export interface DocInput {
  id?: string
  name: string
  group: PpdsDoc['group']
  status: DocStatus
  due: ISODate | null
  note?: string
}

export async function saveDoc(input: DocInput): Promise<PpdsDoc> {
  const name = input.name.trim()
  if (!name) throw new Error('Nama butir harus diisi.')
  const note = input.note?.trim() || undefined
  assertNoPatientIdentity(name, note ?? '')
  const prev = input.id ? await db.ppdsDocs.get(input.id) : undefined
  const now = Date.now()
  const doc: PpdsDoc = { ...input, name, note, id: input.id ?? createId('doc'), createdAt: prev?.createdAt ?? now, updatedAt: now }
  await db.ppdsDocs.put(doc)
  return doc
}

export async function setDocStatus(id: string, status: DocStatus): Promise<PpdsDoc | undefined> {
  const prev = await db.ppdsDocs.get(id)
  if (prev) await db.ppdsDocs.put({ ...prev, status, updatedAt: Date.now() })
  return prev
}

export async function deleteDoc(id: string): Promise<PpdsDoc | undefined> {
  const row = await db.ppdsDocs.get(id)
  await db.ppdsDocs.delete(id)
  return row
}

export const restoreDoc = (d: PpdsDoc) => db.ppdsDocs.put(d)

/** Isi daftar contoh; butir dengan nama yang sama tidak diduplikasi. Mengembalikan jumlah yang ditambahkan. */
export async function seedDocs(): Promise<number> {
  const have = new Set((await db.ppdsDocs.toArray()).map((d) => d.name.toLowerCase()))
  const now = Date.now()
  const rows = DEFAULT_DOCS.filter((d) => !have.has(d.name.toLowerCase())).map((d): PpdsDoc => ({
    ...d,
    id: createId('doc'),
    status: 'belum',
    due: null,
    createdAt: now,
    updatedAt: now,
  }))
  await db.ppdsDocs.bulkPut(rows)
  return rows.length
}

// ---------- Main Quest ----------

export interface QuestInput {
  id?: string
  name: string
  roleId: string
  next: string
  progress: number
}

export async function saveQuest(input: QuestInput): Promise<MainQuest> {
  const name = input.name.trim()
  if (!name) throw new Error('Nama Main Quest harus diisi.')
  const next = input.next.trim()
  assertNoPatientIdentity(name, next)
  const prev = input.id ? await db.mainQuests.get(input.id) : undefined
  if (!prev && !canActivate(await db.mainQuests.toArray()))
    throw new Error('Sudah ada 3 Main Quest aktif. Bekukan atau selesaikan satu dulu.')
  const now = Date.now()
  const quest: MainQuest = {
    ...(prev ?? { status: 'aktif' as const, doneAt: null, createdAt: now }),
    id: input.id ?? createId('qst'),
    name,
    roleId: input.roleId,
    next,
    progress: Math.max(0, Math.min(1, input.progress)),
    updatedAt: now,
  }
  await db.mainQuests.put(quest)
  return quest
}

export async function setQuestStatus(id: string, status: MainQuest['status']): Promise<MainQuest | undefined> {
  const prev = await db.mainQuests.get(id)
  if (!prev) return undefined
  if (status === 'aktif' && prev.status !== 'aktif' && !canActivate(await db.mainQuests.toArray()))
    throw new Error('Sudah ada 3 Main Quest aktif. Bekukan atau selesaikan satu dulu.')
  await db.mainQuests.put({
    ...prev,
    status,
    progress: status === 'selesai' ? 1 : prev.progress,
    doneAt: status === 'selesai' ? Date.now() : null,
    updatedAt: Date.now(),
  })
  return prev
}

export async function deleteQuest(id: string): Promise<MainQuest | undefined> {
  const row = await db.mainQuests.get(id)
  await db.mainQuests.delete(id)
  return row
}

export const restoreQuest = (q: MainQuest) => db.mainQuests.put(q)
