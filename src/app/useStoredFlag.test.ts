import { act, renderHook } from '@testing-library/react'
import { beforeEach, describe, expect, it } from 'vitest'
import { useStoredFlag } from './useStoredFlag'

describe('useStoredFlag', () => {
  beforeEach(() => localStorage.clear())

  it('memakai nilai awal, lalu mengingat pilihan di perangkat', () => {
    const first = renderHook(() => useStoredFlag('k', false))
    expect(first.result.current[0]).toBe(false)
    act(() => first.result.current[1](true))
    expect(first.result.current[0]).toBe(true)
    expect(localStorage.getItem('k')).toBe('1')
    // Dibuka lagi (mis. pindah halaman lalu kembali): pilihan tetap.
    expect(renderHook(() => useStoredFlag('k', false)).result.current[0]).toBe(true)
  })

  it('nilai awal true berlaku sampai pengguna menutup', () => {
    const { result } = renderHook(() => useStoredFlag('buka', true))
    expect(result.current[0]).toBe(true)
    act(() => result.current[1](false))
    expect(renderHook(() => useStoredFlag('buka', true)).result.current[0]).toBe(false)
  })

  it('dua komponen dengan kunci yang sama ikut berubah bersamaan', () => {
    const a = renderHook(() => useStoredFlag('bersama', false))
    const b = renderHook(() => useStoredFlag('bersama', false))
    act(() => a.result.current[1](true))
    expect(b.result.current[0]).toBe(true)
  })
})
