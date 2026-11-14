import { Check } from 'lucide-react'
import { roleLookup } from '../db/structure'
import { slotNote } from '../domain/ritme'
import { currentIndex, type ScheduleItem, type ScheduleSource } from '../domain/schedule'
import type { Role } from '../types'

const SOURCE_LABEL: Record<Exclude<ScheduleSource, 'ritme'>, string> = {
  tentir: 'Tentir',
  agenda: 'Agenda',
  latihan: 'Latihan',
  tidur: 'Pulih',
}

/**
 * Linimasa jadwal terpadu: ritme, sesi tentir, agenda, latihan terjadwal, dan jam tidur dalam satu daftar.
 * `minutes` (jam dinding) hanya diisi untuk hari ini, supaya butir yang lewat diredupkan.
 */
export function ScheduleList({
  items,
  roles,
  minutes,
  from = 0,
}: {
  items: ScheduleItem[]
  roles: Role[] | undefined
  minutes?: number
  /** Mulai dari indeks ini (untuk "sisa hari ini"). */
  from?: number
}) {
  const role = roleLookup(roles)
  const nowIndex = minutes == null ? -1 : currentIndex(items, minutes)
  return (
    <ol className="grid gap-0.5">
      {items.map((s, i) => {
        if (i < from) return null
        const state = minutes == null ? '' : i === nowIndex ? 'now' : i < nowIndex ? 'past' : ''
        const r = s.roleId ? role(s.roleId) : null
        const sub =
          s.source === 'ritme' ? slotNote(s) : [s.until ? `sampai ${s.until}` : null, s.note].filter(Boolean).join(' · ') || undefined
        const tag = s.source === 'ritme' ? (r?.name ?? 'Ibadah') : SOURCE_LABEL[s.source]
        const body = (
          <>
            <span className={`text-[13px] tabular-nums ${state === 'now' ? 'font-semibold text-text' : 'text-muted'}`}>{s.time}</span>
            <span
              className="h-[22px] w-1 justify-self-center rounded"
              style={{ background: r?.color ?? 'var(--faint)' }}
              aria-hidden="true"
            />
            <span className={`min-w-0 font-medium ${state === 'past' || s.done ? 'text-muted' : ''}`}>
              <span className={s.done ? 'line-through decoration-faint' : ''}>{s.title}</span>
              {sub && <small className="block text-[12.5px] font-normal text-muted">{sub}</small>}
              {s.warn && <small className="block text-[12.5px] font-normal text-uang">{s.warn}</small>}
            </span>
            <span className="flex items-center gap-1.5 justify-self-end text-xs whitespace-nowrap text-muted">
              {s.done ? (
                <span className="flex items-center gap-1 text-ok">
                  <Check size={13} aria-hidden="true" /> selesai
                </span>
              ) : state === 'now' ? (
                <span className="rounded-md bg-text px-[7px] py-0.5 text-[11px] font-bold tracking-wide text-bg uppercase">Sekarang</span>
              ) : (
                <span className={s.source === 'ritme' ? 'hidden md:inline' : ''}>{tag}</span>
              )}
            </span>
          </>
        )
        const cls = `grid grid-cols-[46px_12px_1fr_auto] items-center gap-2.5 rounded-[10px] px-2 py-[7px] md:grid-cols-[52px_14px_1fr_auto] ${state === 'now' ? 'bg-surface-2' : ''}`
        return (
          <li key={s.key} aria-current={state === 'now' ? 'time' : undefined}>
            {s.href ? (
              <a href={s.href} className={`${cls} hover:bg-surface-2/60`}>
                {body}
              </a>
            ) : (
              <div className={cls}>{body}</div>
            )}
          </li>
        )
      })}
    </ol>
  )
}
