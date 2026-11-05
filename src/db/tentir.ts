import { TENTIR_CATEGORY_ID } from '../domain/money'
import { DEFAULT_TENTIR_RATE, isLate } from '../domain/tentir'
import { createId, privateId } from '../lib/id'
import type { ISODate, TentirSession, Transaction } from '../types'
import { assertNoPatientIdentity, setWorkEnd } from './daily'
import { db } from './db'
import { loadProfile, updateProfile } from './structure'

export { TENTIR_CATEGORY_ID }

export type SessionInput = Omit<TentirSession, 'id' | 'createdAt' | 'updatedAt' | 'transactionId'> & { id?: string }

export interface SaveResult {
  id: string
  /** Sesi lewat 21.00 di hari non-jaga → jam berhenti kerja hari itu dicatat lewat 21.00. */
  overtime: boolean
}

/**
 * Menyimpan sesi. Sesi lunas otomatis jadi transaksi pemasukan (diperbarui bila sesi diubah,
 * dihapus bila status lunas dicabut). Inisial & topik dicek identitas pasien.
 */
export async function saveSession(input: SessionInput): Promise<SaveResult> {
  const student = input.student.trim().toUpperCase()
  const topic = input.topic.trim()
  assertNoPatientIdentity(student, topic)
  if (!(input.hours > 0)) throw new Error('Durasi sesi belum diisi.')
  const now = Date.now()
  const id = input.id ?? createId('tnt')
  const prev = input.id ? await db.tentirSessions.get(input.id) : undefined
  let transactionId = prev?.transactionId ?? null
  await db.transaction('rw', db.tentirSessions, db.transactions, async () => {
    if (input.paid && input.fee > 0) {
      const tx: Transaction = {
        id: transactionId ?? createId('trx'),
        amount: input.fee,
        type: 'income',
        categoryId: TENTIR_CATEGORY_ID,
        date: input.date,
        note: `Tentir ${student}${topic ? ` · ${topic}` : ''}`,
        tentirSessionId: id,
        createdAt: now,
        updatedAt: now,
      }
      if (transactionId) {
        const old = await db.transactions.get(transactionId)
        if (old) tx.createdAt = old.createdAt
      }
      await db.transactions.put(tx)
      transactionId = tx.id
    } else if (transactionId) {
      await db.transactions.delete(transactionId)
      transactionId = null
    }
    await db.tentirSessions.put({
      ...input,
      id,
      student,
      topic,
      transactionId,
      createdAt: prev?.createdAt ?? now,
      updatedAt: now,
    })
  })
  let overtime = false
  if (isLate(input)) {
    const day = await db.days.get(privateId.day(input.date))
    if (day?.type !== 'jaga' && day?.workEnd !== 'late') {
      await setWorkEnd(input.date, 'late')
      overtime = true
    }
  }
  return { id, overtime }
}

export async function setPaid(session: TentirSession, paid: boolean): Promise<void> {
  await saveSession({ ...session, paid })
}

export interface Removed {
  session: TentirSession
  tx: Transaction | undefined
}

export async function deleteSession(id: string): Promise<Removed | null> {
  const session = await db.tentirSessions.get(id)
  if (!session) return null
  const tx = session.transactionId ? await db.transactions.get(session.transactionId) : undefined
  await db.transaction('rw', db.tentirSessions, db.transactions, async () => {
    if (session.transactionId) await db.transactions.delete(session.transactionId)
    await db.tentirSessions.delete(id)
  })
  return { session, tx }
}

export async function restoreSession({ session, tx }: Removed): Promise<void> {
  await db.transaction('rw', db.tentirSessions, db.transactions, async () => {
    if (tx) await db.transactions.put(tx)
    await db.tentirSessions.put(session)
  })
}

export async function loadSessions(from?: ISODate, to?: ISODate): Promise<TentirSession[]> {
  const list =
    from && to ? await db.tentirSessions.where('date').between(from, to, true, true).toArray() : await db.tentirSessions.toArray()
  return list.sort((a, b) => a.date.localeCompare(b.date) || (a.start ?? '').localeCompare(b.start ?? ''))
}

export async function loadTentirRate(): Promise<number> {
  return (await loadProfile()).tentirRate ?? DEFAULT_TENTIR_RATE
}

export async function saveTentirSettings(changes: { rate?: number; min?: number; max?: number }): Promise<void> {
  const profile = await loadProfile()
  const capacity = { ...profile.tentirCapacity }
  if (changes.min != null) capacity.min = changes.min
  if (changes.max != null) capacity.max = changes.max
  if (capacity.min > capacity.max) throw new Error('Kapasitas minimum harus ≤ maksimum.')
  await updateProfile({
    tentirCapacity: capacity,
    ...(changes.rate != null ? { tentirRate: changes.rate } : {}),
  })
}
