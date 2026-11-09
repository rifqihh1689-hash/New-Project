import { ChevronDown, ChevronRight, Plus } from 'lucide-react'
import { useState } from 'react'
import { routeHref } from '../../app/router'
import { Limited } from '../../components/Limited'
import { useToast } from '../../components/toast-context'
import { addTask, moveTasks, PatientIdentityError } from '../../db/daily'
import { DEFAULT_ROLE_ID } from '../../db/defaults'
import { roleLookup } from '../../db/structure'
import { DAY_TYPE_LABELS } from '../../domain/dayType'
import { detectPatientIdentity, PHI_HINT } from '../../domain/phi'
import { addDays, DAY_NAMES, MONTH_NAMES, weekday } from '../../domain/time'
import type { Role, Task } from '../../types'
import { DAY_TYPE_COLORS } from '../beranda/dayTypeColors'
import type { WeekDay } from './data'
import { TaskRow } from './TaskRow'

interface Props {
  week: WeekDay[]
  today: string
  roles: Role[]
  filter: string | null
  focus: string | null
  onEdit: (t: Task) => void
}

/** Papan mingguan: satu kartu per hari, bisa diciutkan, tambah tugas langsung di harinya. */
export function WeekView({ week, today, roles, filter, focus, onEdit }: Props) {
  const toast = useToast()
  const role = roleLookup(roles)
  // Hari lalu yang sudah beres diciutkan; sisanya terbuka.
  const [collapsed, setCollapsed] = useState<Set<string>>(
    () => new Set(week.filter((d) => d.date < today && d.date !== focus && d.tasks.every((t) => t.done)).map((d) => d.date)),
  )
  const [adding, setAdding] = useState<string | null>(null)
  const [title, setTitle] = useState('')
  const phi = title.trim() ? detectPatientIdentity(title) : null

  const toggle = (date: string) =>
    setCollapsed((set) => {
      const next = new Set(set)
      if (next.has(date)) next.delete(date)
      else next.add(date)
      return next
    })
  const add = async (date: string) => {
    try {
      await addTask({ title, roleId: filter ?? DEFAULT_ROLE_ID, date })
      setTitle('')
    } catch (e) {
      toast({ message: e instanceof PatientIdentityError ? e.message : (e as Error).message, tone: 'error' })
    }
  }
  const moveOne = async (t: Task) => {
    const next = addDays(t.date, 1)
    await moveTasks([t.id], next)
    toast({
      message: `Dipindah ke ${DAY_NAMES[weekday(next)]}.`,
      action: { label: 'Urungkan', onClick: () => void moveTasks([t.id], t.date) },
    })
  }

  return (
    <div className="mt-3 gap-3 lg:columns-2">
      {week.map(({ date, type, tasks }) => {
        const shown = filter ? tasks.filter((t) => t.roleId === filter) : tasks
        const done = shown.filter((t) => t.done).length
        const isOpen = !collapsed.has(date)
        const isToday = date === today
        return (
          <section
            key={date}
            className={`card mb-3 break-inside-avoid p-3.5 md:p-4 ${focus === date && !isToday ? 'outline-[1.5px] outline-muted outline-solid' : ''}`}
            aria-label={`${DAY_NAMES[weekday(date)]} ${Number(date.slice(8))}`}
          >
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => toggle(date)}
                className="flex flex-1 items-center gap-2 text-left"
                aria-expanded={isOpen}
              >
                {isOpen ? (
                  <ChevronDown size={16} className="text-faint" aria-hidden="true" />
                ) : (
                  <ChevronRight size={16} className="text-faint" aria-hidden="true" />
                )}
                <span className="font-semibold">{DAY_NAMES[weekday(date)]}</span>
                <span className="text-[13px] text-muted">
                  {Number(date.slice(8))} {MONTH_NAMES[Number(date.slice(5, 7)) - 1].slice(0, 3)}
                </span>
                {isToday && (
                  <span className="rounded-md bg-text px-1.5 py-px text-[10.5px] font-bold tracking-wide text-bg uppercase">Hari ini</span>
                )}
                {type && (
                  <span className="hidden items-center gap-1.5 text-xs text-muted sm:flex">
                    <span className="dot" style={{ background: DAY_TYPE_COLORS[type] }} aria-hidden="true" />
                    {DAY_TYPE_LABELS[type]}
                  </span>
                )}
              </button>
              <span className="text-xs text-faint tabular-nums">
                {done}/{shown.length}
              </span>
              <button
                type="button"
                onClick={() => {
                  setAdding(adding === date ? null : date)
                  setTitle('')
                  setCollapsed((set) => {
                    const next = new Set(set)
                    next.delete(date)
                    return next
                  })
                }}
                className="grid size-7 place-items-center rounded-full text-muted hover:bg-surface-2 hover:text-text"
                aria-label={`Tambah tugas ${DAY_NAMES[weekday(date)]}`}
              >
                <Plus size={16} aria-hidden="true" />
              </button>
            </div>
            {isOpen && (
              <>
                {adding === date && (
                  <form
                    className="mt-2.5"
                    onSubmit={(e) => {
                      e.preventDefault()
                      if (title.trim() && !phi) void add(date)
                    }}
                  >
                    <input
                      autoFocus
                      className="field py-2"
                      value={title}
                      onChange={(e) => setTitle(e.target.value)}
                      onKeyDown={(e) => e.key === 'Escape' && setAdding(null)}
                      placeholder={`Tugas ${DAY_NAMES[weekday(date)]}… (Enter untuk simpan)`}
                      aria-label={`Tugas baru ${DAY_NAMES[weekday(date)]}`}
                      maxLength={200}
                    />
                    {phi && (
                      <p className="mt-1.5 text-xs text-danger" role="alert">
                        Mirip identitas pasien ({phi}). {PHI_HINT}
                      </p>
                    )}
                  </form>
                )}
                {shown.length > 0 ? (
                  <div className="mt-2">
                    <Limited items={shown} limit={5} className="btn-ghost mt-1 w-full text-xs">
                      {(list) => (
                        <ul>
                          {list.map((t) => (
                            <TaskRow key={t.id} task={t} role={role(t.roleId)} onEdit={onEdit} onMove={(x) => void moveOne(x)} compact />
                          ))}
                        </ul>
                      )}
                    </Limited>
                  </div>
                ) : (
                  adding !== date && <p className="mt-2 pl-6 text-[13px] text-faint">Kosong.</p>
                )}
              </>
            )}
          </section>
        )
      })}
      <p className="text-xs text-faint">
        Ketuk judul tugas untuk mengubah tanggal, subtugas, atau peran.{' '}
        <a href={routeHref('habit')} className="underline-offset-2 hover:underline">
          Rutin harian
        </a>{' '}
        ada di Habit.
      </p>
    </div>
  )
}
