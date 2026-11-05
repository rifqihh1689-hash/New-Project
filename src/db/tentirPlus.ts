import { TENTIR_CATEGORY_ID } from '../domain/money'
import { createId } from '../lib/id'
import type { ISODate, Material, Student, TentirPackage, Transaction } from '../types'
import { assertNoPatientIdentity } from './daily'
import { db } from './db'

export class TentirError extends Error {}

// ---------- Murid ----------

export function newStudent(initials = ''): Student {
  const now = Date.now()
  return { id: createId('stu'), initials, cohort: '', block: '', rate: null, note: '', archived: false, createdAt: now, updatedAt: now }
}

/** Inisial unik (huruf besar). Catatan & blok dicek identitas pasien. */
export async function saveStudent(s: Student): Promise<Student> {
  const initials = s.initials
    .trim()
    .toUpperCase()
    .replace(/[^\p{L}\d]/gu, '')
  if (!initials) throw new TentirError('Inisial murid kosong.')
  assertNoPatientIdentity(s.cohort, s.block, s.note)
  const clash = await db.students
    .where('initials')
    .equals(initials)
    .filter((x) => x.id !== s.id)
    .count()
  if (clash) throw new TentirError(`Inisial ${initials} sudah dipakai murid lain.`)
  const row = { ...s, initials, updatedAt: Date.now() }
  await db.students.put(row)
  return row
}

// ---------- Paket ----------

export function newPackage(student: string, today: ISODate): TentirPackage {
  const now = Date.now()
  return {
    id: createId('pkt'),
    student,
    name: '',
    sessions: 4,
    price: 0,
    paid: true,
    paidDate: today,
    transactionId: null,
    archived: false,
    createdAt: now,
    updatedAt: now,
  }
}

/** Paket lunas = satu transaksi pemasukan (Tentir); sesinya sendiri bernilai Rp0. */
export async function savePackage(p: TentirPackage): Promise<TentirPackage> {
  const name = p.name.trim()
  const student = p.student.trim().toUpperCase()
  if (!name) throw new TentirError('Nama paket kosong.')
  if (!student) throw new TentirError('Pilih murid.')
  if (!(p.sessions >= 1)) throw new TentirError('Jumlah sesi minimal 1.')
  assertNoPatientIdentity(name)
  const now = Date.now()
  let transactionId = p.transactionId
  await db.transaction('rw', db.tentirPackages, db.transactions, async () => {
    if (p.paid && p.price > 0) {
      const old = transactionId ? await db.transactions.get(transactionId) : undefined
      const tx: Transaction = {
        id: transactionId ?? createId('trx'),
        amount: p.price,
        type: 'income',
        categoryId: TENTIR_CATEGORY_ID,
        date: p.paidDate ?? new Date(now + 7 * 3600_000).toISOString().slice(0, 10),
        note: `Paket tentir ${student} · ${name}`,
        createdAt: old?.createdAt ?? now,
        updatedAt: now,
      }
      await db.transactions.put(tx)
      transactionId = tx.id
    } else if (transactionId) {
      await db.transactions.delete(transactionId)
      transactionId = null
    }
    await db.tentirPackages.put({ ...p, name, student, transactionId, updatedAt: now })
  })
  return { ...p, name, student, transactionId }
}

// ---------- Materi ----------

export function newMaterial(block = ''): Material {
  const now = Date.now()
  return { id: createId('mat'), block, title: '', link: '', note: '', createdAt: now, updatedAt: now }
}

export async function saveMaterial(m: Material): Promise<void> {
  const title = m.title.trim()
  if (!title) throw new TentirError('Judul materi kosong.')
  if (m.link && !/^https?:\/\//i.test(m.link.trim())) throw new TentirError('Tautan harus diawali http(s)://')
  assertNoPatientIdentity(title, m.block, m.note)
  await db.materials.put({ ...m, title, block: m.block.trim() || 'Umum', link: m.link.trim(), updatedAt: Date.now() })
}

export async function deleteMaterial(id: string): Promise<Material | undefined> {
  const m = await db.materials.get(id)
  await db.materials.delete(id)
  return m
}

export const restoreMaterial = (m: Material) => db.materials.put(m)
