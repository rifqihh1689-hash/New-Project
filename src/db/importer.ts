import type { ImportItem } from '../domain/importer'
import { slotOrder } from '../domain/ritme'
import { createId } from '../lib/id'
import type { DayType, RitmeSlot } from '../types'
import { setJaga, saveEvent } from './calendar'
import { addTask } from './daily'
import { db } from './db'
import { loadMenus, newMenu, saveMenu } from './menu'
import { addDeposit, addPayment, newDebt, saveDebt, saveTransaction } from './money'
import { loadHabits, saveChapter, saveHabit, saveRitme } from './structure'

export interface ImportSummary {
  ritme: number
  habitNew: number
  habitUpdated: number
  tugas: number
  tugasSkipped: number
  jaga: number
  agenda: number
  staseNew: number
  staseUpdated: number
  menu: number
  transaksi: number
  utangNew: number
  utangUpdated: number
  cicilan: number
  setoran: number
  /** Transaksi/cicilan/setoran yang sudah tercatat, atau utang/tabungan yang tidak ditemukan. */
  uangSkipped: number
}

/**
 * Menulis item pratinjau yang disetujui. Aman diulang:
 * ritme menggantikan template tipe hari itu, habit/stase dengan nama sama diperbarui,
 * tugas dengan judul + tanggal sama dilewati.
 */
export async function applyImport(items: ImportItem[]): Promise<ImportSummary> {
  const sum: ImportSummary = {
    ritme: 0,
    habitNew: 0,
    habitUpdated: 0,
    tugas: 0,
    tugasSkipped: 0,
    jaga: 0,
    agenda: 0,
    staseNew: 0,
    staseUpdated: 0,
    menu: 0,
    transaksi: 0,
    utangNew: 0,
    utangUpdated: 0,
    cicilan: 0,
    setoran: 0,
    uangSkipped: 0,
  }
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

  // Jaga: tanggal itu bertipe Jaga; besoknya otomatis pasca-jaga bila belum diisi.
  for (const it of items) {
    if (it.kind !== 'jaga') continue
    await setJaga(it.date, true)
    sum.jaga++
  }

  // Agenda: judul + tanggal sama = sudah ada, dilewati.
  for (const it of items) {
    if (it.kind !== 'agenda') continue
    const dup = await db.events
      .where('date')
      .equals(it.date)
      .filter((e) => e.title.trim().toLowerCase() === it.title.toLowerCase())
      .count()
    if (dup) continue
    await saveEvent({ title: it.title, date: it.date, start: it.start, end: it.end, roleId: it.roleId })
    sum.agenda++
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
  // Menu: nama sama = diperbarui (termasuk menu bawaan).
  const menus = await loadMenus()
  for (const it of items) {
    if (it.kind !== 'menu') continue
    const { kind: _k, ...fields } = it
    void _k
    const existing = menus.find((m) => m.name.toLowerCase() === it.name.toLowerCase())
    await saveMenu(existing ? { ...existing, ...fields, archived: false } : { ...newMenu(), ...fields })
    sum.menu++
  }

  // Uang. Transaksi yang sama persis (tanggal, jenis, jumlah, kategori, catatan) dilewati supaya aman diulang.
  const same = (a: string, b: string) => a.trim().toLowerCase() === b.trim().toLowerCase()
  for (const it of items) {
    if (it.kind !== 'transaksi') continue
    const dup = await db.transactions
      .where('date')
      .equals(it.date)
      .filter((t) => t.type === it.type && t.amount === it.amount && t.categoryId === it.categoryId && same(t.note, it.note))
      .count()
    if (dup) {
      sum.uangSkipped++
      continue
    }
    await saveTransaction({ amount: it.amount, type: it.type, categoryId: it.categoryId, date: it.date, note: it.note })
    sum.transaksi++
  }
  // Utang baru; nama sama = jumlah awal & target diperbarui, pembayaran tetap.
  const debts = await db.debts.toArray()
  for (const it of items) {
    if (it.kind !== 'utang') continue
    const existing = debts.find((d) => same(d.name, it.name))
    if (existing) {
      await saveDebt({ ...existing, initial: it.amount, targetDate: it.targetDate ?? existing.targetDate })
      sum.utangUpdated++
    } else {
      const d = { ...newDebt(), name: it.name, initial: it.amount, targetDate: it.targetDate }
      await saveDebt(d)
      debts.push(d)
      sum.utangNew++
    }
  }
  // Cicilan & setoran ke utang/tabungan yang ada (nama tanpa beda huruf besar); yang sama persis dilewati.
  for (const it of items) {
    if (it.kind !== 'cicilan') continue
    const d = (await db.debts.toArray()).find((x) => same(x.name, it.name))
    if (!d || d.payments.some((p) => p.date === it.date && p.amount === it.amount)) {
      sum.uangSkipped++
      continue
    }
    await addPayment(d.id, it.amount, it.date)
    sum.cicilan++
  }
  for (const it of items) {
    if (it.kind !== 'setoran') continue
    const s = (await db.savings.toArray()).find((x) => same(x.name, it.name))
    if (!s || s.deposits.some((p) => p.date === it.date && p.amount === it.amount)) {
      sum.uangSkipped++
      continue
    }
    await addDeposit(s.id, it.amount, it.date)
    sum.setoran++
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
    s.agenda && `${s.agenda} agenda`,
    s.staseNew && `${s.staseNew} stase baru`,
    s.staseUpdated && `${s.staseUpdated} stase diperbarui`,
    s.menu && `${s.menu} menu`,
    s.transaksi && `${s.transaksi} transaksi`,
    s.utangNew && `${s.utangNew} utang baru`,
    s.utangUpdated && `${s.utangUpdated} utang diperbarui`,
    s.cicilan && `${s.cicilan} cicilan`,
    s.setoran && `${s.setoran} setoran/penarikan`,
    s.uangSkipped && `${s.uangSkipped} catatan uang dilewati (sudah ada / utang-tabungan tidak ditemukan)`,
  ].filter(Boolean)
  return parts.length ? `Diimpor: ${parts.join(', ')}.` : 'Tidak ada yang diimpor.'
}
