import { describe, expect, it } from 'vitest'
import { parseRoute, routeHref } from './router'

describe('router', () => {
  it('mengenali rute dan tanggal halaman tugas', () => {
    expect(parseRoute('')).toEqual({ name: 'beranda', date: null })
    expect(parseRoute('#/tugas')).toEqual({ name: 'tugas', date: null })
    expect(parseRoute('#/tugas/2026-11-06')).toEqual({ name: 'tugas', date: '2026-11-06' })
    expect(parseRoute('#/tugas/2026-13-40')).toEqual({ name: 'tugas', date: null })
    expect(parseRoute('#/tidak-ada')).toEqual({ name: 'beranda', date: null })
  })

  it('membuat href', () => {
    expect(routeHref('beranda')).toBe('#/')
    expect(routeHref('tugas', '2026-11-06')).toBe('#/tugas/2026-11-06')
  })
})
