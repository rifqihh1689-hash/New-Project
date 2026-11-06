import { useSyncExternalStore } from 'react'

export interface ViewportBox {
  /** Tinggi bagian layar yang terlihat (mengecil saat papan ketik terbuka). */
  height: number
  /** Jarak dari bawah area terlihat ke bawah layout viewport: bagian yang tertutup papan ketik iOS. */
  keyboard: number
}

/**
 * Hanya mendengar `resize` (papan ketik muncul/hilang, layar diputar), bukan `scroll`. Mengikuti setiap
 * geseran membuat lembar ikut bergerak tiap kali iOS menggeser layar, yang memicu geseran berikutnya:
 * terasa tersendat di formulir dengan banyak kolom (mis. Anggaran). Perubahan digabung per frame.
 */
function subscribe(onChange: () => void): () => void {
  const vv = typeof window !== 'undefined' ? window.visualViewport : null
  if (!vv) return () => {}
  let frame = 0
  const schedule = () => {
    cancelAnimationFrame(frame)
    frame = requestAnimationFrame(onChange)
  }
  vv.addEventListener('resize', schedule)
  return () => {
    cancelAnimationFrame(frame)
    vv.removeEventListener('resize', schedule)
  }
}

// String supaya snapshot stabil selama nilainya sama (syarat useSyncExternalStore).
const snapshot = () => {
  const vv = typeof window !== 'undefined' ? window.visualViewport : null
  if (!vv) return ''
  const keyboard = Math.max(0, window.innerHeight - vv.height - vv.offsetTop)
  return `${Math.round(vv.height)}|${Math.round(keyboard)}`
}

/**
 * Area layar yang terlihat dan tinggi papan ketik. Lembar bawah duduk tepat di atas papan ketik dan
 * tingginya dibatasi area terlihat, jadi tidak naik ke bawah jam/status bar.
 */
export function useVisualViewport(): ViewportBox | null {
  const s = useSyncExternalStore(subscribe, snapshot, () => '')
  if (!s) return null
  const [height, keyboard] = s.split('|').map(Number)
  return { height, keyboard }
}
