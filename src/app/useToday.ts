import { useEffect, useState } from 'react'
import { dayKey, wibMinutes } from '../domain/time'

/** Tanggal Qawwam hari ini (WIB, ganti pukul 03.00), diperbarui otomatis. */
export function useToday(): string {
  const [today, setToday] = useState(() => dayKey())
  useEffect(() => {
    const tick = () => setToday(dayKey())
    const timer = window.setInterval(tick, 30_000)
    document.addEventListener('visibilitychange', tick)
    return () => {
      window.clearInterval(timer)
      document.removeEventListener('visibilitychange', tick)
    }
  }, [])
  return today
}

/** Jam dinding WIB dalam menit sejak 00.00, diperbarui tiap menit. */
export function useClockMinutes(): number {
  const [minutes, setMinutes] = useState(() => wibMinutes())
  useEffect(() => {
    const timer = window.setInterval(() => setMinutes(wibMinutes()), 30_000)
    return () => window.clearInterval(timer)
  }, [])
  return minutes
}
