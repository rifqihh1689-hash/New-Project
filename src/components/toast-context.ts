import { createContext, useContext } from 'react'

export type ToastTone = 'success' | 'info' | 'warning' | 'error'

export interface ToastOptions {
  message: string
  tone?: ToastTone
  /** Lama tampil dalam milidetik (bawaan 3500). */
  duration?: number
  action?: { label: string; onClick: () => void }
}

export const ToastContext = createContext<(options: ToastOptions) => void>(() => {})

/** Menampilkan notifikasi singkat. */
export function useToast(): (options: ToastOptions) => void {
  return useContext(ToastContext)
}
