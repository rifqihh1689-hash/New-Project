/**
 * Data contoh untuk screenshot & mencoba tampilan. Hanya dimuat di mode dev (lihat main.tsx),
 * tidak pernah ikut build produksi.
 */
import { db } from '../db/db'
import {
  addHabitMinutes,
  addTask,
  updateTask,
  setDayType,
  setHabitDone,
  setMutabaahDone,
  setSleep,
  setWorkEnd,
  toggleTask,
} from '../db/daily'
import { saveHabit } from '../db/structure'
import { HABIT_TEMPLATES } from '../features/habit/templates'
import { DEFAULT_MUTABAAH } from '../db/defaults'
import { addDays, dayKey, weekStart } from '../domain/time'
import { createId } from '../lib/id'
import type { DayType } from '../types'

export async function loadSample(): Promise<void> {
  const today = dayKey()
  const now = Date.now()
  const stamp = { createdAt: now, updatedAt: now }

  // 14 hari terakhir: pola stase–jaga–pasca, tidur & habit terisi.
  const pattern: DayType[] = ['stase', 'stase', 'jaga', 'pasca', 'stase', 'stase', 'libur']
  for (let i = 14; i >= 1; i--) {
    const d = addDays(today, -i)
    const type = pattern[i % 7]
    await setDayType(d, type)
    await setSleep(d, 5 + (i % 3) * 0.5, type === 'stase' ? 1 : 0)
    await setWorkEnd(d, i % 5 === 0 ? 'late' : 'ok')
    if (type === 'jaga') await setHabitDone('#habit:jaga-nap', d, true)
    if (type === 'pasca') for (const h of ['pasca-rest', 'pasca-eat']) await setHabitDone(`#habit:${h}`, d, true)
    const t = await addTask({ title: 'Blok belajar 40 soal', roleId: '#role:ukmppd', date: d, size: 'besar' })
    if (type !== 'pasca') await toggleTask(t)
    for (const [j, m] of DEFAULT_MUTABAAH.entries()) if ((i + j) % 4 !== 0) await setMutabaahDone(m.id, d, true)
  }

  // Dua habit tambahan dengan riwayat seminggu.
  const [study, lift] = [HABIT_TEMPLATES[0], HABIT_TEMPLATES[2]].map((t, i) => ({
    ...t,
    id: `hab_contoh${i}`,
    kind: 'normal' as const,
    active: true,
    order: 10 + i,
    ...stamp,
  }))
  await saveHabit(study)
  await saveHabit(lift)
  for (let i = 6; i >= 1; i--) {
    const d = addDays(today, -i)
    if (i % 3 !== 0) await addHabitMinutes(study, d, 45)
    if (i % 2 === 0) await setHabitDone(lift.id, d, true)
  }
  await addHabitMinutes(study, today, 30)

  // Hari ini.
  await setDayType(today, 'stase')
  await setSleep(today, 5.5, 0)
  for (const [title, roleId, size, done, important] of [
    ['Follow-up bangsal & laporan pagi', '#role:koas', 'sedang', true, false],
    ['Isi logbook kasus hari ini', '#role:koas', 'kecil', true, false],
    ['40 soal muskuloskeletal + review yang salah', '#role:ukmppd', 'besar', false, false],
    ['Siapkan materi tentir: fraktur & dislokasi', '#role:tentir', 'sedang', false, false],
    ['Systematic review: seleksi 30 abstrak', '#role:orto', 'besar', false, true],
    ['Bayar kos bulan Desember', '#role:uang', 'kecil', false, false],
  ] as const) {
    const t = await addTask({ title, roleId, date: today, size, important })
    if (done) await toggleTask(t)
  }
  for (const id of ['#mut:qiyam', '#mut:subuh', '#mut:dzikirpagi']) await setMutabaahDone(id, today, true)

  // Subtugas & tugas di hari lain minggu ini (untuk papan mingguan).
  const tentirPrep = (await db.tasks.toArray()).find((t) => t.title.startsWith('Siapkan materi tentir'))
  if (tentirPrep)
    await updateTask(tentirPrep.id, {
      subtasks: [
        { id: 'sub_1', title: 'Ringkasan fraktur terbuka', done: true },
        { id: 'sub_2', title: '10 soal latihan', done: false },
        { id: 'sub_3', title: 'Slide dislokasi bahu', done: false },
      ],
    })
  for (const [offset, title, roleId] of [
    [1, 'Presentasi lapsus bedah', '#role:koas'],
    [1, 'Tentir Murid B: neurologi', '#role:tentir'],
    [2, 'Tryout mini 100 soal', '#role:ukmppd'],
    [3, 'Muhasabah mingguan + 3 prioritas', '#role:orto'],
  ] as const)
    await addTask({ title, roleId, date: addDays(today, offset) })

  // Minggu ini direncanakan.
  const ws = weekStart(today)
  const plan: DayType[] = ['stase', 'jaga', 'pasca', 'stase', 'stase', 'jaga', 'pasca']
  for (let i = 0; i < 7; i++) {
    const d = addDays(ws, i)
    if (d > today)
      await db.days.put({ id: `#day:${d}`, date: d, type: plan[i], sleepNight: null, nap: 0, workEnd: null, note: '', updatedAt: now })
  }

  await db.chapters.add({
    id: createId('chp'),
    name: 'Stase Bedah',
    start: addDays(ws, -14),
    end: addDays(ws, 30),
    weight: 'berat',
    ...stamp,
  })
  const sessions = [
    { student: 'A', topic: 'Kardiologi', date: ws, start: '19.00', hours: 2, fee: 200_000 },
    { student: 'A', topic: 'Muskuloskeletal', date: today, start: '19.00', hours: 2, fee: 200_000 },
    { student: 'B', topic: 'Neurologi', date: addDays(today, 1), start: '16.00', hours: 3, fee: 300_000 },
  ]
  for (const s of sessions) {
    const id = createId('tnt')
    await db.tentirSessions.add({ id, ...s, paid: s.date <= today, transactionId: null, ...stamp })
    if (s.date < today)
      await db.transactions.add({
        id: createId('trx'),
        amount: s.fee,
        type: 'income',
        categoryId: 'tentir',
        date: s.date,
        note: 'Tentir',
        tentirSessionId: id,
        ...stamp,
      })
  }
  await db.transactions.add({
    id: createId('trx'),
    amount: 500_000,
    type: 'income',
    categoryId: 'tentir',
    date: addDays(today, -3),
    note: 'Tentir',
    tentirSessionId: 'old',
    ...stamp,
  })
  await db.transactions.add({
    id: createId('trx'),
    amount: 1_240_000,
    type: 'expense',
    categoryId: 'makan',
    date: today,
    note: '',
    ...stamp,
  })
  await db.budgets.put({ id: `#bud:${today.slice(0, 7)}:makan`, month: today.slice(0, 7), categoryId: 'makan', amount: 2_000_000 })
  await db.debts.add({
    id: createId('dbt'),
    name: 'Utang keluarga',
    initial: 10_000_000,
    targetDate: '2027-09-30',
    payments: [{ date: today, amount: 3_600_000 }],
    ...stamp,
  })
  await db.savings.add({
    id: createId('sav'),
    name: 'Dana jembatan',
    kind: 'jembatan',
    target: 15_000_000,
    targetDate: '2027-12-31',
    deposits: [{ date: today, amount: 4_500_000 }],
    ...stamp,
  })
  for (const [name, roleId, next, progress] of [
    ['Bank soal UKMPPD', '#role:ukmppd', '1.240 / 8.000 soal', 0.155],
    ['Systematic review', '#role:orto', 'seleksi abstrak', 0.35],
    ['IELTS', '#role:orto', 'target band diisi di Setelan', 0.1],
  ] as const)
    await db.mainQuests.add({ id: createId('mqs'), name, roleId, status: 'aktif', next, progress, doneAt: null, ...stamp })
}
