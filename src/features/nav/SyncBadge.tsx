import { useSyncInfo, type SyncMode } from '../../db/cloud'

const COLORS: Record<SyncMode, string> = {
  lokal: 'var(--faint)',
  'belum-masuk': 'var(--color-uang)',
  menyinkron: 'var(--color-koas)',
  tersinkron: 'var(--ok)',
  offline: 'var(--faint)',
  galat: 'var(--danger)',
}

export function SyncDot({ mode }: { mode: SyncMode }) {
  const c = COLORS[mode]
  return (
    <i
      className="inline-block size-2 shrink-0 rounded-full"
      style={{ background: c, boxShadow: `0 0 0 3px color-mix(in srgb, ${c} 25%, transparent)` }}
      aria-hidden="true"
    />
  )
}

export function SyncBadge({ compact }: { compact?: boolean }) {
  const info = useSyncInfo()
  return (
    <a
      href="#/setelan"
      className="flex items-center gap-2.5 rounded-[10px] px-2.5 py-2 text-[13px] text-muted hover:text-text"
      title={info.label}
    >
      <SyncDot mode={info.mode} />
      {!compact && <span className="truncate">{info.label}</span>}
      {compact && <span className="sr-only">{info.label}</span>}
    </a>
  )
}
