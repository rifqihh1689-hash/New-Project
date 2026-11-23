import { describe, expect, it } from 'vitest'
import { DEFAULT_RITME } from '../db/defaults'
import { effectiveDayType, suggestDayType } from './dayType'
import { headline } from './headline'
import { jagaChanges } from './calendar'
import { carryType, isWeekend, jagaLabel, JAGA_PAGI_RITME, shiftOn } from './jaga'
import { effectiveRitme } from './ritme'

const chapter = { name: 'Stase DV', masuk: '07.00', pulang: '14.00' }
const ritme = (type: 'jaga' | 'stase', shift: 'pagi' | 'malam' | null, date: string) =>
  effectiveRitme(type, DEFAULT_RITME, chapter, { shift, date })

describe('jaga pagi & malam', () => {
  it('label dan akhir pekan', () => {
    expect(jagaLabel('pagi')).toBe('Jaga pagi')
    expect(jagaLabel(null)).toBe('Jaga')
    expect([isWeekend('2026-11-14'), isWeekend('2026-11-15'), isWeekend('2026-11-16')]).toEqual([true, true, false])
  })

  it('setelah jaga pagi tidak ada pasca-jaga; setelah jaga malam atau shift kosong ada', () => {
    expect(carryType({ date: '2026-11-14', type: 'jaga', jagaShift: 'pagi' })).toBeNull()
    expect(carryType({ date: '2026-11-14', type: 'jaga', jagaShift: 'malam' })).toBe('jaga')
    expect(carryType({ date: '2026-11-14', type: 'jaga' })).toBe('jaga')
    expect(carryType({ date: '2026-11-14', type: 'stase', jagaShift: 'pagi' })).toBe('stase')
    expect(suggestDayType('2026-11-15', carryType({ date: '2026-11-14', type: 'jaga', jagaShift: 'pagi' }))).toBe('libur') // Minggu biasa
    expect(suggestDayType('2026-11-16', carryType({ date: '2026-11-14', type: 'jaga', jagaShift: 'malam' }))).toBe('pasca')
    // Pasca yang dipilih sesudah jaga pagi tidak sah: dihitung stase.
    expect(effectiveDayType('pasca', carryType({ date: '2026-11-14', type: 'jaga', jagaShift: 'pagi' }))).toEqual({
      type: 'stase',
      invalidPasca: true,
    })
  })

  it('hari kerja tidak punya shift: selalu 15.00–07.00, besoknya pasca-jaga', () => {
    // Kamis 3 Des 2026: shift "pagi" yang terlanjur tersimpan diabaikan.
    expect(shiftOn('2026-12-03', 'pagi')).toBeNull()
    expect(shiftOn('2026-12-05', 'pagi')).toBe('pagi')
    expect(carryType({ date: '2026-12-03', type: 'jaga', jagaShift: 'pagi' })).toBe('jaga')
    const r = ritme('jaga', 'pagi', '2026-12-03')
    const jaga = r.find((s) => /^jaga/i.test(s.title))!
    expect([jaga.time, jaga.until]).toEqual(['15.00', '07.00'])
    expect(jagaChanges('2026-12-03', true, () => null, 'pagi')).toEqual([
      { date: '2026-12-03', type: 'jaga', shift: null },
      { date: '2026-12-04', type: 'pasca' },
    ])
    expect(
      headline({ type: 'jaga', suggested: 'jaga', invalidPasca: false, hasTentir: false, jagaShift: null, jagaFromStase: true }),
    ).toMatch(/^Jaga 15.00 sampai 07.00/)
  })

  it('ritme jaga pagi: 07.00–19.00 tetap, tidak diganti jam stase, tanpa tidur sore pra-jaga', () => {
    const r = ritme('jaga', 'pagi', '2026-11-14')
    expect(r).toBe(JAGA_PAGI_RITME)
    const jaga = r.find((s) => s.title === 'Jaga pagi')!
    expect([jaga.time, jaga.until]).toEqual(['07.00', '19.00'])
    expect(r.some((s) => /tidur sore/i.test(s.title))).toBe(false)
  })

  it('jaga malam di akhir pekan: tidak ada blok stase; di hari kerja tetap ada dan mengikuti jam stase', () => {
    const weekend = ritme('jaga', 'malam', '2026-11-14')
    expect(weekend.some((s) => s.work)).toBe(false)
    expect(weekend.find((s) => s.title === 'Jaga malam')?.time).toBe('19.00')
    const weekday = ritme('jaga', 'malam', '2026-11-12')
    expect(weekday.find((s) => s.work)).toMatchObject({ title: 'Stase DV', time: '07.00', until: '14.00' })
    // Hari stase biasa tidak terpengaruh.
    expect(ritme('stase', null, '2026-11-14').some((s) => s.work)).toBe(true)
  })

  it('kalimat pembuka: pagi, shift belum dipilih, dan malam', () => {
    const base = { type: 'jaga' as const, suggested: 'jaga' as const, invalidPasca: false, hasTentir: false, minutes: 12 * 60 }
    expect(headline({ ...base, jagaShift: 'pagi' })).toMatch(/Jaga pagi 07\.00–19\.00.*bukan pasca-jaga/)
    expect(headline({ ...base, jagaShift: null })).toMatch(/pagi atau malam/)
    expect(headline({ ...base, jagaShift: 'malam' })).toMatch(/jaga/i)
  })

  it('jaga hari kerja: mulai 15.00 sampai 07.00, tanpa tidur sore; Sabtu/Minggu tetap 19.00', () => {
    const weekday = ritme('jaga', 'malam', '2026-11-12') // Kamis
    expect(weekday.find((s) => s.work)).toMatchObject({ time: '07.00', until: '14.00' })
    expect(weekday.find((s) => s.title === 'Jaga malam')).toMatchObject({ time: '15.00', until: '07.00', fixed: true })
    expect(weekday.some((s) => /tidur sore|bekal/i.test(s.title))).toBe(false)
    // Tidak mengikuti jam pulang stase: tetap 15.00 walau stase pulang lebih awal atau lebih lambat.
    for (const pulang of ['13.00', '16.30']) {
      const r = effectiveRitme('jaga', DEFAULT_RITME, { ...chapter, pulang }, { shift: null, date: '2026-11-12' })
      expect(r.find((s) => s.title === 'Jaga malam')?.time).toBe('15.00')
    }
    // Akhir pekan tidak ada stase, jaga malam mulai 19.00 dengan tidur sore sebelumnya.
    const weekend = ritme('jaga', 'malam', '2026-11-14')
    expect(weekend.find((s) => s.title === 'Jaga malam')?.time).toBe('19.00')
    expect(weekend.some((s) => /tidur sore/i.test(s.title))).toBe(true)
    // Hari kerja tidak punya shift: "pagi" yang tersimpan tetap jadi jaga 15.00–07.00.
    expect(ritme('jaga', 'pagi', '2026-11-12')).toEqual(weekday)
    expect(ritme('jaga', 'pagi', '2026-11-14')).toBe(JAGA_PAGI_RITME)
  })

  it('kalimat pembuka jaga hari kerja', () => {
    const base = {
      type: 'jaga' as const,
      suggested: 'jaga' as const,
      invalidPasca: false,
      hasTentir: false,
      minutes: 10 * 60,
      jagaShift: 'malam' as const,
    }
    expect(headline({ ...base, jagaFromStase: true })).toMatch(/Jaga 15\.00 sampai 07\.00.*Tidak ada tidur sore/)
  })
})
