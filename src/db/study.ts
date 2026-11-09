import { createId } from '../lib/id'
import type { ISODate, StudyLog, StudyTarget } from '../types'
import { DEFAULT_STUDY_WEEKLY } from '../domain/study'
import { saveCard } from './cards'
import { assertNoPatientIdentity } from './daily'
import { db } from './db'
import { loadProfile, updateProfile } from './structure'

export interface WrongCard {
  front: string
  back: string
}

export interface StudyInput {
  id?: string
  date: ISODate
  system: string
  kind: StudyLog['kind']
  total: number
  correct: number
  note?: string
  /** Soal yang salah: jadi kartu ulasan (opsional). */
  wrong?: WrongCard
}

export async function saveStudyLog(input: StudyInput, today: ISODate = input.date): Promise<StudyLog> {
  if (!Number.isInteger(input.total) || input.total < 1) throw new Error('Jumlah soal minimal 1.')
  if (!Number.isInteger(input.correct) || input.correct < 0 || input.correct > input.total)
    throw new Error('Jumlah benar harus 0 sampai jumlah soal.')
  const { wrong, ...rest } = input
  const makeCard = !!wrong && !!(wrong.front.trim() || wrong.back.trim())
  if (makeCard && !(wrong!.front.trim() && wrong!.back.trim()))
    throw new Error('Kartu dari soal salah: isi kedua sisi, atau kosongkan keduanya.')
  if (makeCard) assertNoPatientIdentity(wrong!.front, wrong!.back)
  const note = input.note?.trim() || undefined
  if (note) assertNoPatientIdentity(note)
  const prev = input.id ? await db.studyLogs.get(input.id) : undefined
  const now = Date.now()
  const log: StudyLog = { ...rest, note, id: input.id ?? createId('stl'), createdAt: prev?.createdAt ?? now, updatedAt: now }
  await db.studyLogs.put(log)
  if (makeCard) await saveCard({ ...wrong!, system: input.system, source: 'salah' }, today)
  return log
}

export async function deleteStudyLog(id: string): Promise<StudyLog | undefined> {
  const row = await db.studyLogs.get(id)
  await db.studyLogs.delete(id)
  return row
}

export const restoreStudyLog = (row: StudyLog) => db.studyLogs.put(row)

export async function loadStudyTarget(): Promise<StudyTarget> {
  const p = await loadProfile()
  return { examDate: p.study?.examDate ?? null, weeklyQuestions: p.study?.weeklyQuestions ?? DEFAULT_STUDY_WEEKLY }
}

export async function saveStudyTarget(changes: Partial<StudyTarget>): Promise<void> {
  const current = await loadStudyTarget()
  const next = { ...current, ...changes }
  if (!Number.isInteger(next.weeklyQuestions) || next.weeklyQuestions < 1) throw new Error('Target soal per minggu minimal 1.')
  await updateProfile({ study: next })
}
