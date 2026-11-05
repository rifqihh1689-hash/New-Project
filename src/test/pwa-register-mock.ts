import { useState } from 'react'

/** Tiruan `virtual:pwa-register/react` untuk lingkungan tes. */
export function useRegisterSW() {
  const offlineReady = useState(false)
  const needRefresh = useState(false)
  return { offlineReady, needRefresh, updateServiceWorker: async () => {} }
}
