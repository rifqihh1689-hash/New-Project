import { CircleAlert, CircleCheck, Info, TriangleAlert } from 'lucide-react'
import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react'
import { ToastContext, type ToastOptions, type ToastTone } from './toast-context'

interface ToastItem extends ToastOptions {
  id: number
}

const ICONS: Record<ToastTone, typeof Info> = { success: CircleCheck, info: Info, warning: TriangleAlert, error: CircleAlert }

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([])
  const nextId = useRef(1)
  const dismiss = useCallback((id: number) => setToasts((list) => list.filter((t) => t.id !== id)), [])
  const show = useCallback((options: ToastOptions) => {
    const id = nextId.current++
    setToasts((list) => [...list.slice(-2), { ...options, id }])
  }, [])

  return (
    <ToastContext.Provider value={show}>
      {children}
      <div
        className="pointer-events-none fixed inset-x-0 top-0 z-[60] flex flex-col items-center gap-2 px-4 pt-[calc(0.75rem+env(safe-area-inset-top))]"
        aria-live="polite"
        role="status"
      >
        {toasts.map((toast) => (
          <ToastView key={toast.id} toast={toast} onDismiss={dismiss} />
        ))}
      </div>
    </ToastContext.Provider>
  )
}

function ToastView({ toast, onDismiss }: { toast: ToastItem; onDismiss: (id: number) => void }) {
  const tone = toast.tone ?? 'success'
  const Icon = ICONS[tone]
  useEffect(() => {
    const timer = window.setTimeout(() => onDismiss(toast.id), toast.duration ?? 3500)
    return () => window.clearTimeout(timer)
  }, [toast.id, toast.duration, onDismiss])

  return (
    <div
      className={`animate-toast-in pointer-events-auto flex w-full max-w-md items-center gap-3 rounded-2xl px-4 py-3 text-[13px] shadow-lg ${
        tone === 'error' || tone === 'warning' ? 'bg-danger text-white' : 'bg-btn text-btn-text'
      }`}
    >
      <Icon size={17} className="shrink-0" aria-hidden="true" />
      <p className="flex-1">{toast.message}</p>
      {toast.action && (
        <button
          type="button"
          className="shrink-0 rounded-lg px-2 py-1 font-semibold underline underline-offset-2"
          onClick={() => {
            toast.action?.onClick()
            onDismiss(toast.id)
          }}
        >
          {toast.action.label}
        </button>
      )}
    </div>
  )
}
