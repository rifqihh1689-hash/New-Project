import type { Phase } from '../types'

/** Fase hidup yang sedang berjalan pada `today` (fase terakhir yang mencakup tanggal itu). */
export function currentPhase(phases: Phase[], today: string): Phase | null {
  const active = phases.filter((p) => !p.archived)
  const running = active.filter((p) => (!p.start || p.start <= today) && (!p.end || today <= p.end))
  return running[running.length - 1] ?? active.find((p) => !p.end || today <= p.end) ?? null
}
