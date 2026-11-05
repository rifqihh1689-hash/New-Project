import { useEffect, useState } from 'react'

/** Event `beforeinstallprompt` (Chrome/Edge/Android) — belum ada di tipe DOM standar. */
export interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>
}

let deferredPrompt: BeforeInstallPromptEvent | null = null
const listeners = new Set<() => void>()
const notify = () => listeners.forEach((fn) => fn())

/** Dipanggil sedini mungkin (di main.tsx) agar event tidak terlewat. */
export function captureInstallPrompt(): void {
  window.addEventListener('beforeinstallprompt', (event) => {
    event.preventDefault()
    deferredPrompt = event as BeforeInstallPromptEvent
    notify()
  })
  window.addEventListener('appinstalled', () => {
    deferredPrompt = null
    notify()
  })
}

export function isStandalone(): boolean {
  const nav = navigator as Navigator & { standalone?: boolean }
  return nav.standalone === true || (typeof window.matchMedia === 'function' && window.matchMedia('(display-mode: standalone)').matches)
}

export function isIOS(): boolean {
  return /iphone|ipad|ipod/i.test(navigator.userAgent) || (navigator.userAgent.includes('Macintosh') && navigator.maxTouchPoints > 1)
}

/** Status pemasangan PWA & fungsi untuk memunculkan dialog pasang bawaan browser. */
export function useInstallPrompt(): { canInstall: boolean; installed: boolean; install: () => Promise<boolean> } {
  const [, force] = useState(0)
  useEffect(() => {
    const listener = () => force((n) => n + 1)
    listeners.add(listener)
    return () => {
      listeners.delete(listener)
    }
  }, [])

  return {
    canInstall: deferredPrompt !== null,
    installed: isStandalone(),
    install: async () => {
      if (!deferredPrompt) return false
      await deferredPrompt.prompt()
      const { outcome } = await deferredPrompt.userChoice
      deferredPrompt = null
      notify()
      return outcome === 'accepted'
    },
  }
}
