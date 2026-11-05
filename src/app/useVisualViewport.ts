import { useSyncExternalStore } from 'react'

export interface ViewportBox {
  top: number
  height: number
}

function subscribe(onChange: () => void): () => void {
  const vv = typeof window !== 'undefined' ? window.visualViewport : null
  if (!vv) return () => {}
  vv.addEventListener('resize', onChange)
  vv.addEventListener('scroll', onChange)
  return () => {
    vv.removeEventListener('resize', onChange)
    vv.removeEventListener('scroll', onChange)
  }
}

// String supaya snapshot stabil selama nilainya sama (syarat useSyncExternalStore).
const snapshot = () => {
  const vv = typeof window !== 'undefined' ? window.visualViewport : null
  return vv ? `${Math.round(vv.offsetTop)}|${Math.round(vv.height)}` : ''
}

/**
 * Bagian layar yang benar-benar terlihat. Saat papan ketik iOS terbuka, layout viewport tidak
 * mengecil dan halaman digeser ke atas; lembar bawah yang mengikuti kotak ini tetap utuh di atas
 * papan ketik dan tidak naik ke bawah status bar.
 */
export function useVisualViewport(): ViewportBox | null {
  const s = useSyncExternalStore(subscribe, snapshot, () => '')
  if (!s) return null
  const [top, height] = s.split('|').map(Number)
  return { top, height }
}
