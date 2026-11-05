import { useEffect, useRef, useState } from 'react'
import { Check } from '../../components/Check'
import { SwipeRow } from '../../components/SwipeRow'
import { RoleTag } from '../../components/RoleTag'
import { useToast } from '../../components/toast-context'
import { moveTasks, setHabitDone, toggleTask, type DailyRow } from '../../db/daily'
import { roleLookup } from '../../db/structure'
import { addDays, formatDateShort } from '../../domain/time'
import { isItemDone, itemsForDay, itemXp } from '../../domain/xp'
import type { Role } from '../../types'
import type { BerandaData } from './data'

/** Tugas + rutin hari ini. Pasca-jaga: hanya pemulihan. */
export function TodayList({ data }: { data: BerandaData }) {
  const toast = useToast()
  const { snap, rules } = data
  const role = roleLookup(data.roles)
  const effType = snap.result.effType
  const all = itemsForDay(snap.rows, effType)
  // Quest mingguan dihitung terpisah: tidak masuk syarat lolos, tidak muncul di pasca-jaga.
  const rows = all.filter((r) => !r.weekly)
  const weekly = effType === 'pasca' ? [] : all.filter((r) => r.weekly)
  const tasks = rows.filter((r) => r.kind === 'task')
  const habits = rows.filter((r) => r.kind === 'habit')
  const input = { sleepNight: snap.day?.sleepNight ?? null, nap: snap.day?.nap ?? 0, workEnd: snap.day?.workEnd ?? null }
  const doneOf = (r: DailyRow) => isItemDone({ ...r, kind: r.habitKind }, input, rules)

  const toggle = async (r: DailyRow) => {
    if (r.habitKind === 'sleep') return toast({ message: 'Habit tidur terisi otomatis dari jam tidur.', tone: 'info' })
    if (r.habitKind === 'workend')
      return toast({ message: `Isi lewat "Tutup hari": berhenti kerja ≤ ${rules.workEndLimit}.`, tone: 'info' })
    if (r.habitKind === 'tentir')
      return toast({ message: `Terisi otomatis dari sesi tentir hari ini (semua selesai ≤ ${rules.workEndLimit}).`, tone: 'info' })
    if (r.task) await toggleTask(r.task)
    else await setHabitDone(r.id, data.today, !r.done)
  }

  const moveTomorrow = async (r: DailyRow) => {
    if (!r.task) return
    const tomorrow = addDays(data.today, 1)
    await moveTasks([r.id], tomorrow)
    toast({ message: `"${r.title}" dipindah ke besok.`, action: { label: 'Urungkan', onClick: () => void moveTasks([r.id], data.today) } })
  }

  const row = (r: DailyRow) => {
    const other = !!(r.weekly && r.doneOn)
    const done = doneOf(r) || other
    const xp = data.snap.day?.type && !other ? itemXp(r.size, effType, rows.length, rules) : 0
    const auto = !!r.habitKind && r.habitKind !== 'normal'
    return (
      <TodayRow
        key={r.id}
        row={r}
        done={done}
        other={other}
        xp={xp}
        role={role(r.roleId)}
        onToggle={() => void toggle(r)}
        onRight={auto || other ? undefined : () => void toggle(r)}
        onLeft={r.task && !done ? () => void moveTomorrow(r) : undefined}
      />
    )
  }

  return (
    <div className="card">
      <h3 className="card-title">
        Tugas hari ini <span className="text-[13px] font-medium text-faint">{rows.length}</span>
        <a href="#/tugas" className="ml-auto text-[13px] font-normal text-faint hover:text-text">
          Buka papan →
        </a>
      </h3>
      {data.agenda.length > 0 && (
        <ul className="mb-2 grid gap-1 rounded-xl bg-surface-2 px-3 py-2 text-[13px]">
          {data.agenda.map((ev) => (
            <li key={ev.id} className="flex gap-2">
              <span className="w-[86px] shrink-0 text-muted tabular-nums">
                {ev.start ? `${ev.start}${ev.end ? `–${ev.end}` : ''}` : 'hari ini'}
              </span>
              <span className="flex-1">{ev.title}</span>
            </li>
          ))}
        </ul>
      )}
      {tasks.length === 0 && (
        <p className="pb-2 text-[13px] text-muted">
          {effType === 'pasca' ? 'Tidak ada tugas pemulihan tambahan.' : 'Belum ada tugas. Catat cepat dari kolom di atas atau tombol +.'}
        </p>
      )}
      <ul>{tasks.map(row)}</ul>
      {habits.length > 0 && (
        <>
          <div className="mt-3 mb-1 flex items-center text-xs font-medium tracking-wide text-faint uppercase">
            Rutin
            <a href="#/habit" className="ml-auto font-normal tracking-normal normal-case hover:text-text">
              Atur habit →
            </a>
          </div>
          <ul>{habits.map(row)}</ul>
        </>
      )}
      {weekly.length > 0 && (
        <>
          <div className="mt-3 mb-1 flex items-center text-xs font-medium tracking-wide text-faint uppercase">
            Mingguan · 1× per minggu
            <span className="ml-auto font-normal tracking-normal normal-case">tidak masuk syarat lolos</span>
          </div>
          <ul>{weekly.map(row)}</ul>
        </>
      )}
      {!snap.day?.type && <p className="mt-2 text-xs text-faint">Rutin muncul setelah tipe hari dipilih.</p>}
      {effType === 'pasca' && (
        <p className="mt-2.5 text-xs text-faint">Pasca-jaga hanya berisi tugas pemulihan. Tugas lain sudah dipindah ke besok.</p>
      )}
    </div>
  )
}

/** Satu baris Hari ini: geser kanan = selesai/batal, geser kiri = besok; "+XP" melayang saat selesai. */
function TodayRow({
  row: r,
  done,
  other,
  xp,
  role,
  onToggle,
  onRight,
  onLeft,
}: {
  row: DailyRow
  done: boolean
  other: boolean
  xp: number
  role: Role
  onToggle: () => void
  onRight?: () => void
  onLeft?: () => void
}) {
  const [burst, setBurst] = useState(0)
  const prev = useRef(done)
  useEffect(() => {
    if (done && !prev.current && xp > 0) setBurst((n) => n + 1)
    prev.current = done
  }, [done, xp])
  return (
    <SwipeRow onRight={onRight} onLeft={onLeft} rightLabel={done ? 'Batal' : 'Selesai'} className="border-t border-line first:border-t-0">
      <div className="flex items-start gap-3 px-1 py-[9px]">
        <Check checked={done} disabled={other} onChange={onToggle} label={`Centang ${r.title}`} />
        <div className={`flex-1 transition-colors duration-300 ${done ? 'text-faint line-through' : ''}`}>
          {r.title}
          {other && <span className="ml-1.5 text-[11px] text-faint no-underline">selesai {formatDateShort(r.doneOn!)}</span>}
          {r.important && !done && (
            <span
              className="ml-1.5 rounded-md px-[7px] py-0.5 text-[11px] text-danger"
              style={{ background: 'color-mix(in srgb, var(--danger) 14%, transparent)' }}
            >
              Penting
            </span>
          )}
          {r.habitKind && r.habitKind !== 'normal' && <span className="ml-1.5 text-[11px] text-faint no-underline">otomatis</span>}
        </div>
        <span className="relative flex items-center gap-2 pt-0.5">
          <RoleTag role={role} compact />
          {xp > 0 && <span className="text-[11.5px] text-faint tabular-nums">+{xp}</span>}
          {burst > 0 && (
            <span
              key={burst}
              aria-hidden="true"
              className="animate-xp-float pointer-events-none absolute -top-3 right-0 text-xs font-bold text-ok"
            >
              +{xp} XP
            </span>
          )}
        </span>
      </div>
    </SwipeRow>
  )
}
