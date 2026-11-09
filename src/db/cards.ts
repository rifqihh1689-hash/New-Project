import { createId } from '../lib/id'
import { newCard, review, type Grade } from '../domain/srs'
import type { Flashcard, ISODate } from '../types'
import { assertNoPatientIdentity } from './daily'
import { db } from './db'

export interface CardInput {
  id?: string
  front: string
  back: string
  system?: string
  source?: Flashcard['source']
}

/** Simpan kartu baru, atau ubah isi kartu yang ada (jadwal ulasan tidak diubah). */
export async function saveCard(input: CardInput, today: ISODate): Promise<Flashcard> {
  const front = input.front.trim()
  const back = input.back.trim()
  if (!front || !back) throw new Error('Sisi depan dan belakang harus diisi.')
  assertNoPatientIdentity(front, back)
  const now = Date.now()
  const prev = input.id ? await db.flashcards.get(input.id) : undefined
  const card: Flashcard = prev
    ? { ...prev, front, back, system: input.system || undefined, updatedAt: now }
    : {
        ...newCard({ front, back, source: input.source ?? 'manual', system: input.system || undefined }, today),
        id: createId('crd'),
        createdAt: now,
        updatedAt: now,
      }
  await db.flashcards.put(card)
  return card
}

export async function deleteCard(id: string): Promise<Flashcard | undefined> {
  const row = await db.flashcards.get(id)
  await db.flashcards.delete(id)
  return row
}

export const restoreCard = (c: Flashcard) => db.flashcards.put(c)

/** Nilai satu kartu; mengembalikan keadaan sebelumnya untuk Urungkan. */
export async function gradeCard(id: string, grade: Grade, today: ISODate): Promise<Flashcard | undefined> {
  const card = await db.flashcards.get(id)
  if (!card) return undefined
  await db.flashcards.put({ ...review(card, grade, today), updatedAt: Date.now() })
  return card
}
