import { useCallback, useState } from 'react'

/** Preferensi tampilan on/off yang diingat di perangkat ini (tidak ikut sinkron antar perangkat). */
export function useStoredFlag(key: string, initial = false): [boolean, (v: boolean) => void] {
  const [value, setValue] = useState(() => {
    try {
      const raw = localStorage.getItem(key)
      return raw == null ? initial : raw === '1'
    } catch {
      return initial
    }
  })
  const set = useCallback(
    (v: boolean) => {
      setValue(v)
      try {
        localStorage.setItem(key, v ? '1' : '0')
      } catch {
        // Penyimpanan penuh/diblokir: pilihan tetap berlaku sampai halaman ditutup.
      }
    },
    [key],
  )
  return [value, set]
}

/** Kunci preferensi: progres & nominal utang disembunyikan (dipakai di Uang dan Beranda). */
export const HIDE_DEBT_KEY = 'qawwam:utang-sembunyi'
