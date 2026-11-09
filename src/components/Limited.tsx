import { useState, type ReactNode } from 'react'

export const DEFAULT_LIMIT = 10

/**
 * Daftar panjang: tampilkan `limit` item pertama, sisanya lewat "Tampilkan semua".
 * Tombol hanya muncul bila memang ada yang tersembunyi.
 */
export function Limited<T>({
  items,
  limit = DEFAULT_LIMIT,
  children,
  className = 'btn-ghost mt-2 w-full border border-line',
}: {
  items: readonly T[]
  limit?: number
  children: (shown: readonly T[]) => ReactNode
  className?: string
}) {
  const [all, setAll] = useState(false)
  const hidden = items.length > limit
  return (
    <>
      {children(all || !hidden ? items : items.slice(0, limit))}
      {hidden && (
        <button type="button" className={className} aria-expanded={all} onClick={() => setAll(!all)}>
          {all ? 'Tampilkan lebih sedikit' : `Tampilkan semua (${items.length})`}
        </button>
      )}
    </>
  )
}
