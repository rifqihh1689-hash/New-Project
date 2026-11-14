import { describe, expect, it } from 'vitest'
import { DEFAULT_RITME } from '../db/defaults'
import type { PlannedWorkout } from '../types'
import { dayRibbon, nowNext } from './headline'
import { effectiveRitme } from './ritme'
import { daySchedule, napMinutes, plannedTitle, sleepPlan, type DayScheduleInput } from './schedule'

const D = '2026-11-09'
const stase = effectiveRitme('stase', DEFAULT_RITME, null)
const plan = (over: Partial<PlannedWorkout> = {}): PlannedWorkout => ({
  id: `#plw:${D}:beban`,
  date: D,
  kind: 'beban',
  start: '16.30',
  minutes: 60,
  source: 'auto',
  updatedAt: 0,
  ...over,
})
const input = (over: Partial<DayScheduleInput> = {}): DayScheduleInput => ({
  date: D,
  type: 'stase',
  ritme: stase,
  sessions: [],
  events: [],
  planned: [],
  workouts: [],
  planActive: false,
  ...over,
})
const titles = (i: DayScheduleInput) => daySchedule(i).items.map((x) => `${x.time} ${x.title}`)

describe('jadwal terpadu', () => {
  it('tanpa sesi tentir, slot "Tentir (bila ada sesi)" tidak tampil', () => {
    expect(titles(input()).some((t) => /Tentir/.test(t))).toBe(false)
  })

  it('sesi tentir berjam menggantikan slot umum, dengan jam selesai & topik', () => {
    const s = daySchedule(input({ sessions: [{ id: 'a', date: D, start: '19.30', hours: 1.5, student: 'AB', topic: 'Anatomi' }] }))
    const t = s.items.filter((x) => x.source === 'tentir')
    expect(t).toHaveLength(1)
    expect(t[0]).toMatchObject({ time: '19.30', until: '21.00', title: 'Tentir AB', note: 'Anatomi', href: '#/tentir' })
  })

  it('sesi tanpa jam mulai memakai jam slot ritme', () => {
    const s = daySchedule(input({ sessions: [{ id: 'a', date: D, start: null, hours: 2, student: 'CD', topic: '' }] }))
    expect(s.items.find((x) => x.source === 'tentir')).toMatchObject({ time: '19.00', title: 'Tentir CD', note: 'jam mulai belum diisi' })
  })

  it('agenda berjam masuk linimasa; agenda sepanjang hari dipisah', () => {
    const s = daySchedule(
      input({
        events: [
          { id: 'e1', date: D, start: '10.00', end: '11.00', title: 'Ujian OSCE', roleId: null },
          { id: 'e2', date: D, start: null, end: null, title: 'Batas laporan', roleId: null },
        ],
      }),
    )
    expect(s.items.find((x) => x.source === 'agenda')).toMatchObject({ time: '10.00', until: '11.00', title: 'Ujian OSCE' })
    expect(s.allDay).toEqual([{ id: 'e2', title: 'Batas laporan' }])
    // Ujian di jam stase: bentrok dilaporkan.
    expect(s.conflicts.join(' ')).toMatch(/Ujian OSCE 10.00 bentrok dengan Stase/)
  })

  it('sesi latihan terjadwal tampil dengan jam selesai, urut waktu, dan selesai bila sudah dicatat', () => {
    const s = daySchedule(input({ planned: [plan({ day: 'Atas' })], planActive: true }))
    const i = s.items.find((x) => x.source === 'latihan')!
    expect(i).toMatchObject({ time: '16.30', until: '17.30', title: 'Latihan beban · Atas', done: false, href: '#/latihan' })
    expect(s.items.map((x) => x.time)).toEqual([...s.items.map((x) => x.time)].sort())
    const done = daySchedule(input({ planned: [plan()], workouts: [{ date: D, kind: 'beban' }] }))
    expect(done.items.find((x) => x.source === 'latihan')?.done).toBe(true)
  })

  it('slot "Olahraga" umum di ritme diganti sesi terjadwal; hari tanpa sesi = istirahat', () => {
    const libur = effectiveRitme('libur', DEFAULT_RITME, null)
    expect(titles(input({ type: 'libur', ritme: libur })).some((t) => /Olahraga/.test(t))).toBe(true)
    expect(titles(input({ type: 'libur', ritme: libur, planActive: true })).some((t) => /Olahraga/.test(t))).toBe(false)
    const withRun = titles(
      input({
        type: 'libur',
        ritme: libur,
        planActive: true,
        planned: [plan({ kind: 'lari', run: { type: 'easy', km: 4.5 }, start: '09.30', minutes: 40 })],
      }),
    )
    expect(withRun).toContain('09.30 Lari santai 4,5 km')
  })

  it('latihan menabrak tentir → latihan yang ditandai', () => {
    const s = daySchedule(
      input({ planned: [plan()], sessions: [{ id: 'a', date: D, start: '17.00', hours: 2, student: 'AB', topic: '' }] }),
    )
    expect(s.items.find((x) => x.source === 'latihan')?.warn).toBe('Bentrok dengan Tentir AB 17.00–19.00.')
    expect(s.items.find((x) => x.source === 'tentir')?.warn).toBeUndefined()
    expect(s.conflicts).toEqual(['Latihan beban 16.30 bentrok dengan Tentir AB 17.00.'])
  })

  it('hari jaga / pasca: sesi latihan ditandai untuk dipindah; kurang tidur & energi rendah jadi catatan', () => {
    const jaga = daySchedule(input({ type: 'jaga', ritme: effectiveRitme('jaga', DEFAULT_RITME, null), planned: [plan()] }))
    expect(jaga.items.find((x) => x.source === 'latihan')?.warn).toMatch(/Hari jaga/)
    expect(jaga.conflicts.join(' ')).toMatch(/Hari jaga/)
    const tired = daySchedule(input({ planned: [plan()], readiness: 'ringan-tidur' }))
    expect(tired.items.find((x) => x.source === 'latihan')?.note).toMatch(/ringan saja/)
    const low = daySchedule(input({ planned: [plan()], lowEnergy: true }))
    expect(low.items.find((x) => x.source === 'latihan')?.note).toMatch(/Energi rendah/)
  })

  it('pita 24 jam dan sekarang/berikutnya memakai jadwal terpadu', () => {
    const s = daySchedule(input({ planned: [plan()], planActive: true }))
    expect(nowNext(s.items, 16 * 60 + 45).now?.title).toBe('Latihan beban')
    expect(dayRibbon(s.items).find((b) => b.slot.title === 'Latihan beban')).toMatchObject({ start: 990, end: 1050 })
  })
})

describe('jam tidur dari jam bangun', () => {
  const sleep = { wake: '03.45', target: 6, napLogged: 0 }
  it('qailulah di ritme dihitung: 03.45 − (6 − 1) j = 22.45', () => {
    expect(sleepPlan(stase, sleep)).toMatchObject({ bedtime: '22.45', night: 5, nap: 1, napPlanned: true })
  })
  it('qailulah terlewat (lewat 2 jam dari slotnya) → tidur maju ke 21.45', () => {
    expect(sleepPlan(stase, { ...sleep, nowMinutes: 17 * 60 })).toMatchObject({ bedtime: '21.45', nap: 0 })
    expect(sleepPlan(stase, { ...sleep, nowMinutes: 15 * 60 })).toMatchObject({ bedtime: '22.45' })
  })
  it('qailulah yang dicatat dipakai apa adanya', () => {
    expect(sleepPlan(stase, { ...sleep, napLogged: 1.5, nowMinutes: 20 * 60 })).toMatchObject({
      bedtime: '23.15',
      nap: 1.5,
      napPlanned: false,
    })
  })
  it('slot Tidur di ritme yang lebih awal dipertahankan, dengan batas paling lambat', () => {
    const s = daySchedule(input({ sleep }))
    const t = s.items.find((x) => x.source === 'tidur')!
    expect(t.time).toBe('21.30')
    expect(t.note).toBe('paling lambat 22.45 agar total ≥ 6 j')
  })
  it('slot Tidur yang terlalu malam dimajukan; tanpa slot, ditambahkan', () => {
    const late = stase.map((x) => (x.title === 'Tidur' ? { ...x, time: '23.30' } : x))
    expect(daySchedule(input({ ritme: late, sleep })).items.find((x) => x.source === 'tidur')?.time).toBe('22.45')
    const none = stase.filter((x) => x.title !== 'Tidur')
    const t = daySchedule(input({ ritme: none, sleep })).items.find((x) => x.source === 'tidur')!
    expect(t).toMatchObject({ time: '22.45', title: 'Tidur' })
    expect(t.note).toBe('paling lambat, bangun 03.45: malam 5 j + qailulah 1 j')
  })
  it('latihan yang selesai kurang dari 1 jam sebelum tidur ditandai', () => {
    const s = daySchedule(input({ planned: [plan({ start: '20.45', minutes: 60 })], sleep: { ...sleep, nowMinutes: 18 * 60 } }))
    expect(s.items.find((x) => x.source === 'latihan')?.warn).toMatch(/sebelum tidur \(21.45\)/)
  })
  it('hari jaga tidak diberi jam tidur malam', () => {
    expect(daySchedule(input({ type: 'jaga', ritme: effectiveRitme('jaga', DEFAULT_RITME, null), sleep })).sleep).toBeNull()
  })
})

describe('teks', () => {
  it('judul sesi & lama tidur siang', () => {
    expect(plannedTitle({ kind: 'beban', day: 'Semua' })).toBe('Latihan beban')
    expect(plannedTitle({ kind: 'lari', run: { type: 'kualitas', km: 5 } })).toBe('Lari kualitas 5 km')
    expect(napMinutes({ time: '14.30', title: 'Qailulah', note: '60 mnt, naikkan pengali' })).toBe(60)
    expect(napMinutes({ time: '14.30', title: 'Tidur sore', note: '2 jam sebelum jaga' })).toBe(120)
  })
})
