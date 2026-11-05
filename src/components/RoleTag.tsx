import type { Role } from '../types'

export function RoleDot({ color, className = '' }: { color: string; className?: string }) {
  return <span className={`dot ${className}`} style={{ background: color }} aria-hidden="true" />
}

/** Titik warna + nama peran. `compact` menyembunyikan nama di HP. */
export function RoleTag({ role, compact }: { role: Role; compact?: boolean }) {
  return (
    <span className="inline-flex items-center gap-1.5 text-xs whitespace-nowrap text-muted">
      <RoleDot color={role.color} />
      <span className={compact ? 'hidden md:inline' : undefined}>{role.name}</span>
    </span>
  )
}
