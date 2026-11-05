import type { ImportItem } from '../domain/importer'
import { slotOrder } from '../domain/ritme'
import { createId } from '../lib/id'
import type { DayType, RitmeSlot } from '../types'
import { addTask, setDayType } from './daily'
import { db } from './db'
import { loadHabits, saveChapter, saveHabit, saveRitme } from './structure'

export interface ImportSummary {
  ritme: number
  habitNew: number
  habitUpdated: number
  tugas: number
  tugasSkipped: number
  jaga: number
  staseNew: number
  staseUpdated: number
}

/**
 * Menulis item pratinjau yang disetujui. Aman diulang:
 * ritme menggantikan template tipe hari itu, habit/stase dengan nama sama diperbarui,
 * tugas dengan judul + tanggal sama dilewati.
 */
export async function applyImport(items: ImportItem[]): Promise<ImportSummary> {
  const sum: ImportSummary = { ritme: 0, habitNew: 0, habitUpdated: 0, tugas: 0, tugasSkipped: 0, jaga: 0, staseNew: 0, staseUpdated: 0 }
  const now = Date.now()

  // Ritme: satu template utuh per tipe hari.
  const ritme = new Map<DayType, RitmeSlot[]>()
  for (const it of items) if (it.kind === 'ritme') ritme.set(it.dayType, [...(ritme.get(it.dayType) ?? []), it.slot])
  for (const [type, slots] of ritme) {
    await saveRitme(
      type,
      [...slots].sort((a, b) => slotOrder(a.time) - slotOrder(b.time)),
    )
    sum.ritme += slots.length
  }

  // Habit: nama sama (tanpa beda huruf besar) = diperbarui & diaktifkan.
  const habits = await loadHabits()
  let order = Math.max(0, ...habits.map((h) => h.order))
  for (const it of items) {
    if (it.kind !== 'habit') continue
    const existing = habits.find((h) => h.name.trim().toLowerCase() === it.name.toLowerCase())
    const { kind: _kind, ...fields } = it
    void _kind
    if (existing) {
      await saveHabit({ ...existing, ...fields, active: true })
      sum.habitUpdated++
    } else {
      const habit = {
        ...fields,
        id: createId('hab'),
        kind: 'normal' as const,
        active: true,
        order: ++order,
        createdAt: now,
        updatedAt: now,
      }
      await saveHabit(habit)
      habits.push(habit)
      sum.habitNew++
    }
  }

  // Tugas: lewati yang sudah ada.
  for (const it of items) {
    if (it.kind !== 'tugas') continue
    const dup = await db.tasks
      .where('date')
      .equals(it.date)
      .filter((t) => t.title.trim().toLowerCase() === it.title.toLowerCase())
      .count()
    if (dup) {
      sum.tugasSkipped++
      continue
    }
    await addTask({ title: it.title, date: it.date, roleId: it.roleId, important: it.important })
    sum.tugas++
  }

  // Jaga: tanggal itu bertipe Jaga (besoknya otomatis disarankan pasca-jaga).
  for (const it of items) {
    if (it.kind !== 'jaga') continue
    await setDayType(it.date, 'jaga')
    sum.jaga++
  }

  // Stase: nama + tanggal mulai sama = diperbarui.
  const chapters = await db.chapters.toArray()
  for (const it of items) {
    if (it.kind !== 'stase') continue
    const existing = chapters.find((c) => c.name.toLowerCase() === it.name.toLowerCase() && c.start === it.start)
    const fields = { name: it.name, start: it.start, end: it.end, weight: it.weight, masuk: it.masuk, pulang: it.pulang }
    if (existing) {
      await saveChapter({ ...existing, ...fields })
      sum.staseUpdated++
    } else {
      await saveChapter({ ...fields, id: createId('chp'), createdAt: now, updatedAt: now })
      sum.staseNew++
    }
  }
  return sum
}

export function summaryText(s: ImportSummary): string {
  const parts = [
    s.ritme && `${s.ritme} slot ritme`,
    s.habitNew && `${s.habitNew} habit baru`,
    s.habitUpdated && `${s.habitUpdated} habit diperbarui`,
    s.tugas && `${s.tugas} tugas`,
    s.tugasSkipped && `${s.tugasSkipped} tugas sudah ada`,
    s.jaga && `${s.jaga} jadwal jaga`,
    s.staseNew && `${s.staseNew} stase baru`,
    s.staseUpdated && `${s.staseUpdated} stase diperbarui`,
  ].filter(Boolean)
  return parts.length ? `Diimpor: ${parts.join(', ')}.` : 'Tidak ada yang diimpor.'
}
