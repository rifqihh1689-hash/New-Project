import { describe, expect, it } from 'vitest'
import { DEFAULT_RITME } from '../db/defaults'
import { dayRibbon, DAY_END, formatIn, greeting, headline, nowNext } from './headline'
import { slotOrder } from './ritme'

const at = (hhmm: string) => {
  const [h, m] = hhmm.split('.').map(Number)
  return h * 60 + m
}

describe('sapaan', () => {
  it('mengikuti jam WIB dan nama panggilan', () => {
    expect(greeting(at('05.10'), 'Rifqi')).toBe('Selamat pagi, Rifqi.')
    expect(greeting(at('12.00'))).toBe('Selamat siang.')
    expect(greeting(at('16.30'), '  ')).toBe('Selamat sore.')
    expect(greeting(at('21.00'))).toBe('Selamat malam.')
    expect(greeting(at('01.30'))).toBe('Selamat malam.')
  })
  it('format sisa waktu', () => {
    expect(formatIn(45)).toBe('45 mnt')
    expect(formatIn(120)).toBe('2 j')
    expect(formatIn(130)).toBe('2 j 10 mnt')
  })
})

describe('sekarang & berikutnya', () => {
  const stase = DEFAULT_RITME.stase
  it('di tengah slot kerja: stase sekarang, qailulah berikutnya', () => {
    const r = nowNext(stase, at('09.00'))
    expect(r.now?.title).toBe('Stase')
    expect(r.next?.title).toBe('Qailulah')
    expect(r.inMinutes).toBe(at('14.30') - at('09.00'))
  })
  it('lewat jam pulang tapi sebelum slot berikutnya: jeda', () => {
    const r = nowNext(stase, at('14.10'))
    expect(r.now).toBeNull()
    expect(r.next?.title).toBe('Qailulah')
    expect(r.inMinutes).toBe(20)
  })
  it('sebelum slot pertama dan lewat tengah malam', () => {
    expect(nowNext(stase, at('03.10'))).toMatchObject({ now: null, next: { title: 'Qiyamul lail' }, inMinutes: 35 })
    expect(nowNext(stase, at('01.00'))).toMatchObject({ now: { title: 'Tidur' }, next: null, inMinutes: null })
  })
})

describe('pita 24 jam', () => {
  it('jam selesai dipakai; tidur & jaga sampai slot berikutnya; lainnya ≤ 2 jam', () => {
    const blocks = dayRibbon(DEFAULT_RITME.stase)
    const by = (title: string) => blocks.find((b) => b.slot.title === title)!
    expect(by('Stase')).toMatchObject({ start: slotOrder('06.00'), end: slotOrder('14.00') })
    expect(by('Qiyamul lail').end - by('Qiyamul lail').start).toBe(120)
    expect(by('Tidur').end).toBe(DAY_END)
    const jaga = dayRibbon(DEFAULT_RITME.jaga).find((b) => b.slot.title === 'Jaga malam')!
    expect(jaga.end).toBe(DAY_END)
    for (const b of blocks) expect(b.end).toBeGreaterThanOrEqual(b.start)
  })
})

describe('kalimat menurut jam', () => {
  const base = {
    type: 'stase' as const,
    suggested: 'stase' as const,
    invalidPasca: false,
    hasTentir: true,
    pulang: '14.00',
    workEndLimit: '21.00',
  }
  it('pagi: arahan hari stase', () => {
    expect(headline({ ...base, minutes: at('07.00') })).toBe('Hari stase. Pulang ±14.00, qailulah dulu sebelum tentir.')
  })
  it('siang setelah pulang: qailulah, atau lanjut bila sudah', () => {
    expect(headline({ ...base, minutes: at('14.20') })).toMatch(/^Sudah lewat ±14\.00\. Qailulah dulu sebelum tentir/)
    expect(headline({ ...base, minutes: at('15.30'), napDone: true })).toBe('Qailulah sudah. Sore ini blok belajar, lalu tentir.')
  })
  it('malam: hitung mundur batas kerja, lalu tutup hari', () => {
    expect(headline({ ...base, minutes: at('19.30') })).toBe('Batas kerja 21.00, 1 j 30 mnt lagi. Setelah itu tutup hari.')
    expect(headline({ ...base, minutes: at('21.40') })).toBe('Sudah lewat 21.00. Tutup hari, lalu tidur.')
    expect(headline({ ...base, minutes: at('19.30'), workEndLimit: null })).toMatch(/^Sudah lewat ±14\.00/)
  })
})
