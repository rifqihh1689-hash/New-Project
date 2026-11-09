import { useCallback, useEffect, useState } from 'react'

const EVENT = 'qawwam:flag'

function read(key: string, initial: boolean): boolean {
  try {
    const raw = localStorage.getItem(key)
    return raw == null ? initial : raw === '1'
  } catch {
    return initial
  }
}

/**
 * Preferensi tampilan on/off yang diingat di perangkat ini (tidak ikut sinkron antar perangkat).
 * Beberapa komponen yang memakai kunci yang sama di halaman yang sama ikut berubah bersamaan.
 */
export function useStoredFlag(key: string, initial = false): [boolean, (v: boolean) => void] {
  const [value, setValue] = useState(() => read(key, initial))
  useEffect(() => {
    const onChange = (e: Event) => {
      if ((e as CustomEvent<string>).detail === key) setValue(read(key, initial))
    }
    window.addEventListener(EVENT, onChange)
    return () => window.removeEventListener(EVENT, onChange)
  }, [key, initial])
  const set = useCallback(
    (v: boolean) => {
      setValue(v)
      try {
        localStorage.setItem(key, v ? '1' : '0')
      } catch {
        // Penyimpanan penuh/diblokir: pilihan tetap berlaku sampai halaman ditutup.
      }
      window.dispatchEvent(new CustomEvent(EVENT, { detail: key }))
    },
    [key],
  )
  return [value, set]
}

/** Kunci preferensi: progres & nominal utang disembunyikan (dipakai di Uang dan Beranda). */
export const HIDE_DEBT_KEY = 'qawwam:utang-sembunyi'
