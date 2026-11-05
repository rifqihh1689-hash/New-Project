import { useClockMinutes } from '../../app/useToday'
import { roleLookup } from '../../db/structure'
import { parseClock } from '../../domain/time'
import type { BerandaData } from './data'

/** Linimasa hari ini dari template ritme per tipe hari (bisa diubah per fase hidup). */
export function Ritme({ data }: { data: BerandaData }) {
  const minutes = useClockMinutes()
  const type = data.snap.day?.type ?? data.suggested
  const slots = data.profile.ritme[type] ?? []
  const role = roleLookup(data.roles)
  // Sebelum 03.00 jam dinding masih "kemarin" bagi Qawwam, jadi geser agar urutan tetap benar.
  const now = minutes < 180 ? minutes + 1440 : minutes
  const times = slots.map((s) => {
    const t = parseClock(s.time) ?? 0
    return t < 180 ? t + 1440 : t
  })
  const nowIndex = times.reduce((idx, t, i) => (t <= now ? i : idx), -1)
  return (
    <div className="card">
      <h3 className="card-title">
        Ritme hari ini{' '}
        <span className="text-[13px] font-medium text-faint">
          {data.snap.day?.type ? 'menyesuaikan tipe hari' : 'perkiraan, pilih tipe hari'}
        </span>
      </h3>
      <ol className="grid gap-0.5">
        {slots.map((s, i) => {
          const state = i === nowIndex ? 'now' : i < nowIndex ? 'past' : ''
          const r = s.roleId ? role(s.roleId) : null
          return (
            <li
              key={`${s.time}-${s.title}`}
              className={`grid grid-cols-[46px_12px_1fr] items-center gap-2.5 rounded-[10px] px-2 py-[7px] md:grid-cols-[52px_14px_1fr_auto] ${state === 'now' ? 'bg-surface-2' : ''}`}
              aria-current={state === 'now' ? 'time' : undefined}
            >
              <span className={`text-[13px] tabular-nums ${state === 'now' ? 'font-semibold text-text' : 'text-muted'}`}>{s.time}</span>
              <span
                className="h-[22px] w-1 justify-self-center rounded"
                style={{ background: r?.color ?? 'var(--faint)' }}
                aria-hidden="true"
              />
              <span className={`font-medium ${state === 'past' ? 'text-muted' : ''}`}>
                {s.title}
                {s.note && <small className="block text-[12.5px] font-normal text-muted">{s.note}</small>}
              </span>
              <span className="hidden items-center gap-1.5 text-xs text-muted md:flex">
                {state === 'now' ? (
                  <span className="rounded-md bg-text px-[7px] py-0.5 text-[11px] font-bold tracking-wide text-bg uppercase">Sekarang</span>
                ) : (
                  (r?.name ?? 'Ibadah')
                )}
              </span>
            </li>
          )
        })}
      </ol>
    </div>
  )
}
