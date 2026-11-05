import { noteTitle } from '../domain/notes'
import { createId } from '../lib/id'
import type { ISODate, Note } from '../types'
import { addTask, assertNoPatientIdentity } from './daily'
import { db } from './db'

export interface NoteInput {
  id?: string
  text: string
  roleId: string | null
  color: string | null
  pinned: boolean
}

export async function saveNote(input: NoteInput): Promise<Note> {
  const text = input.text.trim()
  if (!text) throw new Error('Catatan kosong.')
  assertNoPatientIdentity(text)
  const prev = input.id ? await db.notes.get(input.id) : undefined
  const now = Date.now()
  const note: Note = { ...input, text, id: input.id ?? createId('nte'), createdAt: prev?.createdAt ?? now, updatedAt: now }
  await db.notes.put(note)
  return note
}

/** Sematkan tanpa mengubah urutan "terakhir diubah". */
export async function setPinned(id: string, pinned: boolean): Promise<void> {
  await db.notes.update(id, { pinned })
}

export async function deleteNote(id: string): Promise<Note | undefined> {
  const n = await db.notes.get(id)
  await db.notes.delete(id)
  return n
}

export const restoreNote = (n: Note) => db.notes.put(n)

/** Baris pertama catatan jadi tugas di tanggal itu (peran ikut catatan, bila ada). */
export async function noteToTask(note: Note, date: ISODate) {
  return addTask({ title: noteTitle(note.text), roleId: note.roleId ?? undefined, date })
}
