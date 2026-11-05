import { describe, expect, it } from 'vitest'
import { DEFAULT_RITME } from '../db/defaults'
import { headline } from './headline'
import { effectiveRitme, normalizeClock, slotNote, typeClock, workEndTime } from './ritme'

describe('jam', () => {
  it.each([
    ['6', '06.00'],
    ['6.5', '06.50'],
    ['06:30', '06.30'],
    ['1400', '14.00'],
    ['14.00', '14.00'],
    [' 7.05 ', '07.05'],
  ])('%s → %s', (input, out) => expect(normalizeClock(input)).toBe(out))

  it.each(['25.00', '12.75', 'jam 2', ''])('menolak %s', (input) => expect(normalizeClock(input)).toBeNull())
})

describe('jam diketik di papan angka (tanpa titik)', () => {
  it('menyisipkan titik otomatis', () => {
    const typed = (keys: string) => [...keys].reduce((text, k) => typeClock(text + k), '')
    expect(typed('2000')).toBe('20.00')
    expect(typed('2030')).toBe('20.30')
    expect(typed('930')).toBe('9.30')
    expect(typed('0930')).toBe('09.30')
    expect(typed('20')).toBe('20')
    expect(typed('2')).toBe('2')
  })
  it('menghormati titik/titik dua dan menghapus mundur dengan wajar', () => {
    expect(typeClock('20:00')).toBe('20.00')
    expect(typeClock('9.')).toBe('9.')
    expect(typeClock('20.3')).toBe('20.3')
    expect(typeClock('20.')).toBe('20.')
    expect(typeClock('.')).toBe('')
    expect(typeClock('20.305')).toBe('20.30')
  })
  it('dirapikan jadi HH.MM saat keluar kolom', () => {
    expect(normalizeClock(typeClock('20'))).toBe('20.00')
    expect(normalizeClock(typeClock('930'))).toBe('09.30')
    expect(normalizeClock(typeClock('20.3'))).toBe('20.30')
  })
})

describe('ritme per stase', () => {
  it('bawaan: stase 06.00–14.00, slot kerja', () => {
    const slots = effectiveRitme('stase', DEFAULT_RITME)
    expect(workEndTime(slots)).toBe('14.00')
    expect(slotNote(slots.find((s) => s.work)!)).toBe('sampai ±14.00')
  })

  it('stase yang berjalan mengganti jam masuk/pulang dan nama slot kerja', () => {
    const slots = effectiveRitme('stase', DEFAULT_RITME, { name: 'Stase Bedah', masuk: '05.30', pulang: '16.00' })
    const kerja = slots.find((s) => s.work)!
    expect(kerja).toMatchObject({ time: '05.30', until: '16.00', title: 'Stase Bedah' })
    expect(workEndTime(slots)).toBe('16.00')
    // Jaga juga diawali stase pagi.
    expect(workEndTime(effectiveRitme('jaga', DEFAULT_RITME, { name: 'Stase Bedah', pulang: '16.00' }))).toBe('16.00')
  })

  it('stase tanpa jam khusus ikut ritme umum; urutan menurut jam, sebelum 03.00 di akhir', () => {
    const slots = effectiveRitme(
      'libur',
      {
        libur: [
          { time: '01.00', title: 'Tidur' },
          { time: '03.45', title: 'Qiyam' },
          { time: '07.00', title: 'Belajar' },
        ],
      },
      { name: 'Anak' },
    )
    expect(slots.map((s) => s.title)).toEqual(['Qiyam', 'Belajar', 'Tidur'])
  })
})

describe('kalimat pembuka ikut jam pulang', () => {
  it('memakai jam pulang dari data, bukan angka di kode', () => {
    const base = { type: 'stase' as const, suggested: 'stase' as const, invalidPasca: false, hasTentir: true }
    expect(headline({ ...base, pulang: '16.00' })).toBe('Hari stase. Pulang ±16.00, qailulah dulu sebelum tentir.')
    expect(headline({ ...base, pulang: null })).toBe('Hari stase. Setelah pulang, qailulah dulu sebelum tentir.')
  })
})
