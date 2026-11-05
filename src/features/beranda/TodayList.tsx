import { Check } from '../../components/Check'
import { RoleTag } from '../../components/RoleTag'
import { useToast } from '../../components/toast-context'
import { setHabitDone, toggleTask, type DailyRow } from '../../db/daily'
import { roleLookup } from '../../db/structure'
import { formatDateShort } from '../../domain/time'
import { isItemDone, itemsForDay, itemXp } from '../../domain/xp'
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
    if (r.habitKind === 'workend') return toast({ message: 'Isi lewat "Tutup hari": berhenti kerja ≤ 21.00.', tone: 'info' })
    if (r.habitKind === 'tentir')
      return toast({ message: 'Terisi otomatis dari sesi tentir hari ini (semua selesai ≤ 21.00).', tone: 'info' })
    if (r.task) await toggleTask(r.task)
    else await setHabitDone(r.id, data.today, !r.done)
  }

  const row = (r: DailyRow) => {
    const other = r.weekly && r.doneOn
    const done = doneOf(r) || !!other
    const xp = data.snap.day?.type && !other ? itemXp(r.size, effType, rows.length, rules) : 0
    return (
      <li key={r.id} className="flex items-start gap-3 border-t border-line px-1 py-[9px] first:border-t-0">
        <Check checked={done} disabled={!!other} onChange={() => void toggle(r)} label={`Centang ${r.title}`} />
        <div className={`flex-1 ${done ? 'text-faint line-through' : ''}`}>
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
        <span className="flex items-center gap-2 pt-0.5">
          <RoleTag role={role(r.roleId)} compact />
          {xp > 0 && <span className="text-[11.5px] text-faint tabular-nums">+{xp}</span>}
        </span>
      </li>
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
