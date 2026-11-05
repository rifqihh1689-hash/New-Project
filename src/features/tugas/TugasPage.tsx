import { ChevronLeft, ChevronRight } from 'lucide-react'
import { useState } from 'react'
import { navigate } from '../../app/router'
import { useToday } from '../../app/useToday'
import { PageTop } from '../../components/PageTop'
import { RoleDot } from '../../components/RoleTag'
import { addDays, formatDateLong, MONTH_NAMES, relativeDayLabel, weekStart } from '../../domain/time'
import type { Role, Task } from '../../types'
import { DayTypePicker } from '../beranda/DayTypePicker'
import { useTugas, useTugasWeek } from './data'
import { DayView } from './DayView'
import { TaskEditor } from './TaskEditor'
import { WeekView } from './WeekView'

type View = 'hari' | 'minggu'
const VIEW_KEY = 'qawwam-tugas-view'

function readView(): View {
  try {
    return localStorage.getItem(VIEW_KEY) === 'hari' ? 'hari' : 'minggu'
  } catch {
    return 'minggu'
  }
}

/** "2–8 Nov" atau "30 Nov – 6 Des". */
function weekRangeLabel(monday: string): string {
  const sunday = addDays(monday, 6)
  const [m1, d1] = [Number(monday.slice(5, 7)), Number(monday.slice(8))]
  const [m2, d2] = [Number(sunday.slice(5, 7)), Number(sunday.slice(8))]
  const mon = (m: number) => MONTH_NAMES[m - 1].slice(0, 3)
  return m1 === m2 ? `${d1}–${d2} ${mon(m2)}` : `${d1} ${mon(m1)} – ${d2} ${mon(m2)}`
}

function RoleFilter({
  roles,
  tasks,
  filter,
  setFilter,
}: {
  roles: Role[]
  tasks: Task[]
  filter: string | null
  setFilter: (f: string | null) => void
}) {
  return (
    <div className="mt-4 flex gap-1.5 overflow-x-auto pb-1" role="tablist" aria-label="Saring peran">
      <button
        type="button"
        role="tab"
        aria-selected={!filter}
        onClick={() => setFilter(null)}
        className={`chip ${!filter ? 'border-transparent bg-btn font-semibold text-btn-text' : ''}`}
      >
        Semua <span className="opacity-60">{tasks.length}</span>
      </button>
      {roles
        .filter((r) => !r.archived)
        .map((r) => {
          const n = tasks.filter((t) => t.roleId === r.id).length
          return (
            <button
              key={r.id}
              type="button"
              role="tab"
              aria-selected={filter === r.id}
              onClick={() => setFilter(filter === r.id ? null : r.id)}
              className={`chip ${filter === r.id ? 'border-transparent bg-btn font-semibold text-btn-text' : ''}`}
            >
              <RoleDot color={r.color} />
              {r.name}
              {n > 0 && <span className="opacity-60">{n}</span>}
            </button>
          )
        })}
    </div>
  )
}

export function TugasPage({ date: routeDate }: { date: string | null }) {
  const today = useToday()
  const date = routeDate ?? today
  const [view, setViewState] = useState<View>(readView)
  const [filter, setFilter] = useState<string | null>(null)
  const [editing, setEditing] = useState<Task | null>(null)
  const day = useTugas(date)
  const week = useTugasWeek(date)
  const go = (d: string) => navigate('tugas', d === today ? null : d)
  const setView = (v: View) => {
    setViewState(v)
    try {
      localStorage.setItem(VIEW_KEY, v)
    } catch {
      // Tidak tersimpan (mode privat) — pilihan tetap berlaku untuk sesi ini.
    }
  }
  const monday = weekStart(date)
  const thisWeek = monday === weekStart(today)
  const roles = day?.roles ?? week?.roles ?? []

  return (
    <>
      <PageTop title="Tugas" />
      <h1 className="mt-4 text-[26px] font-semibold tracking-tight md:hidden">Tugas</h1>

      <section className="mt-3 flex flex-wrap items-center gap-3 md:mt-[26px]">
        <div role="tablist" aria-label="Tampilan" className="flex rounded-full bg-surface-2 p-[3px]">
          {(['hari', 'minggu'] as const).map((v) => (
            <button
              key={v}
              type="button"
              role="tab"
              aria-selected={view === v}
              onClick={() => setView(v)}
              className={`rounded-full px-3.5 py-1.5 text-[13px] ${view === v ? 'bg-surface text-text shadow-sm' : 'text-muted'}`}
            >
              {v === 'hari' ? 'Hari' : 'Minggu'}
            </button>
          ))}
        </div>
        <div className="flex items-center gap-1">
          <button
            type="button"
            className="btn-ghost p-2"
            onClick={() => go(addDays(date, view === 'hari' ? -1 : -7))}
            aria-label={view === 'hari' ? 'Hari sebelumnya' : 'Minggu sebelumnya'}
          >
            <ChevronLeft size={18} aria-hidden="true" />
          </button>
          <div className="min-w-[150px] text-center">
            {view === 'hari' ? (
              <>
                <div className="font-serif text-xl">{relativeDayLabel(date, today)}</div>
                <div className="text-xs text-muted">{formatDateLong(date)}</div>
              </>
            ) : (
              <>
                <div className="font-serif text-xl">{thisWeek ? 'Minggu ini' : weekRangeLabel(monday)}</div>
                <div className="text-xs text-muted">Senin–Minggu · {weekRangeLabel(monday)}</div>
              </>
            )}
          </div>
          <button
            type="button"
            className="btn-ghost p-2"
            onClick={() => go(addDays(date, view === 'hari' ? 1 : 7))}
            aria-label={view === 'hari' ? 'Hari berikutnya' : 'Minggu berikutnya'}
          >
            <ChevronRight size={18} aria-hidden="true" />
          </button>
          {(view === 'hari' ? date !== today : !thisWeek) && (
            <button type="button" className="chip ml-1 py-1" onClick={() => go(today)}>
              {view === 'hari' ? 'Hari ini' : 'Minggu ini'}
            </button>
          )}
        </div>
        {view === 'hari' && day && (
          <DayTypePicker date={date} value={day.type} suggested={day.suggested} phase={day.phase} className="w-full lg:ml-auto lg:w-auto" />
        )}
      </section>

      <RoleFilter roles={roles} tasks={(view === 'hari' ? day?.tasks : week?.all) ?? []} filter={filter} setFilter={setFilter} />

      {view === 'hari' && day && (
        <DayView date={date} today={today} tasks={day.tasks} roles={day.roles} filter={filter} onEdit={setEditing} />
      )}
      {view === 'minggu' && week && (
        <WeekView key={monday} week={week.week} today={today} roles={week.roles} filter={filter} focus={routeDate} onEdit={setEditing} />
      )}
      <TaskEditor task={editing} roles={roles} onClose={() => setEditing(null)} />
    </>
  )
}
