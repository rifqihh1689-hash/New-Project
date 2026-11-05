import { useEffect } from 'react'
import { useRegisterSW } from 'virtual:pwa-register/react'
import { useToast } from '../../components/toast-context'

/** Mendaftarkan service worker & memberi tahu saat aplikasi siap offline atau ada versi baru. */
export function PwaUpdater() {
  const toast = useToast()
  const {
    offlineReady: [offlineReady, setOfflineReady],
    needRefresh: [needRefresh, setNeedRefresh],
    updateServiceWorker,
  } = useRegisterSW()

  useEffect(() => {
    if (!offlineReady) return
    toast({ message: 'Qawwam siap dipakai tanpa internet.', tone: 'info' })
    setOfflineReady(false)
  }, [offlineReady, setOfflineReady, toast])

  useEffect(() => {
    if (!needRefresh) return
    toast({
      message: 'Versi baru Qawwam tersedia.',
      tone: 'info',
      duration: 15000,
      action: { label: 'Perbarui', onClick: () => void updateServiceWorker(true) },
    })
    setNeedRefresh(false)
  }, [needRefresh, setNeedRefresh, toast, updateServiceWorker])

  return null
}
