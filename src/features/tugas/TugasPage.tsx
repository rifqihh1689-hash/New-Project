import { ArrowRight, ChevronLeft, ChevronRight, Pencil } from 'lucide-react'
import { useState } from 'react'
import { navigate } from '../../app/router'
import { useToday } from '../../app/useToday'
import { Check } from '../../components/Check'
import { PageTop } from '../../components/PageTop'
import { RoleDot, RoleTag } from '../../components/RoleTag'
import { useToast } from '../../components/toast-context'
import { addTask, moveTasks, moveUndoneToTomorrow, PatientIdentityError, toggleTask } from '../../db/daily'
import { DEFAULT_ROLE_ID } from '../../db/defaults'
import { roleLookup } from '../../db/structure'
import { detectPatientIdentity, PHI_HINT } from '../../domain/phi'
import { addDays, formatDateLong, relativeDayLabel } from '../../domain/time'
import type { Task } from '../../types'
import { DayTypePicker } from '../beranda/DayTypePicker'
import { useTugas } from './data'
import { TaskEditor } from './TaskEditor'

const XP = { kecil: 5, sedang: 10, besar: 20 } as const

export function TugasPage({ date: routeDate }: { date: string | null }) {
  const today = useToday()
  const date = routeDate ?? today
  const data = useTugas(date)
  const toast = useToast()
  const [filter, setFilter] = useState<string | null>(null)
  const [title, setTitle] = useState('')
  const [roleId, setRoleId] = useState<string>(DEFAULT_ROLE_ID)
  const [editing, setEditing] = useState<Task | null>(null)
  const role = roleLookup(data?.roles)
  const phi = title.trim() ? detectPatientIdentity(title) : null
  const go = (d: string) => navigate('tugas', d === today ? null : d)

  if (!data) return <PageTop title="Tugas" />
  const activeRoles = data.roles.filter((r) => !r.archived)
  const shown = filter ? data.tasks.filter((t) => t.roleId === filter) : data.tasks
  const left = data.tasks.filter((t) => !t.done)
  const next = addDays(date, 1)

  const add = async () => {
    try {
      await addTask({ title, roleId: filter ?? roleId, date })
      setTitle('')
    } catch (e) {
      toast({ message: e instanceof PatientIdentityError ? e.message : (e as Error).message, tone: 'error' })
    }
  }
  const moveOne = async (t: Task) => {
    await moveTasks([t.id], next)
    toast({
      message: `Dipindah ke ${relativeDayLabel(next, today).toLowerCase()}.`,
      action: { label: 'Urungkan', onClick: () => void moveTasks([t.id], date) },
    })
  }
  const moveLeft = async () => {
    const ids = await moveUndoneToTomorrow(date)
    toast({
      message: `${ids.length} tugas dipindah ke ${relativeDayLabel(next, today).toLowerCase()}.`,
      action: { label: 'Urungkan', onClick: () => void moveTasks(ids, date) },
    })
  }

  return (
    <>
      <PageTop title="Tugas" />
      <h1 className="mt-4 text-[26px] font-semibold tracking-tight md:hidden">Tugas</h1>

      <section className="mt-3 flex flex-wrap items-center gap-3 md:mt-[26px]">
        <div className="flex items-center gap-1">
          <button type="button" className="btn-ghost p-2" onClick={() => go(addDays(date, -1))} aria-label="Hari sebelumnya">
            <ChevronLeft size={18} aria-hidden="true" />
          </button>
          <div className="min-w-[180px] text-center">
            <div className="font-serif text-xl">{relativeDayLabel(date, today)}</div>
            <div className="text-xs text-muted">{formatDateLong(date)}</div>
          </div>
          <button type="button" className="btn-ghost p-2" onClick={() => go(addDays(date, 1))} aria-label="Hari berikutnya">
            <ChevronRight size={18} aria-hidden="true" />
          </button>
          {date !== today && (
            <button type="button" className="chip ml-1 py-1" onClick={() => go(today)}>
              Hari ini
            </button>
          )}
        </div>
        <DayTypePicker
          date={date}
          value={data.type}
          suggested={data.suggested}
          phase={data.phase}
          className="w-full lg:ml-auto lg:w-auto"
        />
      </section>

      <div className="mt-4 flex gap-1.5 overflow-x-auto pb-1" role="tablist" aria-label="Saring peran">
        <button
          type="button"
          role="tab"
          aria-selected={!filter}
          onClick={() => setFilter(null)}
          className={`chip ${!filter ? 'border-transparent bg-btn font-semibold text-btn-text' : ''}`}
        >
          Semua <span className="opacity-60">{data.tasks.length}</span>
        </button>
        {activeRoles.map((r) => {
          const n = data.tasks.filter((t) => t.roleId === r.id).length
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

      <section className="card mt-3">
        <form
          className="flex flex-wrap items-center gap-2"
          onSubmit={(e) => {
            e.preventDefault()
            void add()
          }}
        >
          <input
            className="field min-w-0 flex-[1_1_220px]"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder={`Tugas baru untuk ${relativeDayLabel(date, today).toLowerCase()}…`}
            aria-label="Judul tugas baru"
            maxLength={200}
          />
          {!filter && (
            <select className="field w-auto flex-none" value={roleId} onChange={(e) => setRoleId(e.target.value)} aria-label="Peran">
              {activeRoles.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.name}
                </option>
              ))}
            </select>
          )}
          <button type="submit" className="btn-primary py-2.5" disabled={!title.trim() || !!phi}>
            Tambah
          </button>
        </form>
        {phi && (
          <p className="mt-2 text-xs text-danger" role="alert">
            Mirip identitas pasien ({phi}). {PHI_HINT}
          </p>
        )}

        <ul className="mt-3">
          {shown.length === 0 && (
            <li className="py-3 text-[13px] text-muted">Belum ada tugas{filter ? ` ${role(filter).name}` : ''} di hari ini.</li>
          )}
          {shown.map((t) => (
            <li key={t.id} className="group flex items-start gap-3 border-t border-line px-1 py-2.5 first:border-t-0">
              <Check checked={t.done} onChange={() => void toggleTask(t)} label={`Centang ${t.title}`} />
              <button type="button" onClick={() => setEditing(t)} className={`flex-1 text-left ${t.done ? 'text-faint line-through' : ''}`}>
                {t.title}
                {t.important && !t.done && (
                  <span
                    className="ml-1.5 rounded-md px-[7px] py-0.5 text-[11px] text-danger"
                    style={{ background: 'color-mix(in srgb, var(--danger) 14%, transparent)' }}
                  >
                    Penting
                  </span>
                )}
                {t.source === 'claude' && <span className="ml-1.5 text-[11px] text-faint">dari Claude</span>}
              </button>
              <span className="flex items-center gap-2 pt-0.5">
                <RoleTag role={role(t.roleId)} compact />
                <span className="text-[11.5px] text-faint tabular-nums">+{XP[t.size]}</span>
                {!t.done && (
                  <button
                    type="button"
                    onClick={() => void moveOne(t)}
                    className="rounded-full p-1 text-faint hover:text-text"
                    aria-label={`Pindahkan "${t.title}" ke hari berikutnya`}
                    title="Pindah ke hari berikutnya"
                  >
                    <ArrowRight size={15} aria-hidden="true" />
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => setEditing(t)}
                  className="rounded-full p-1 text-faint hover:text-text"
                  aria-label={`Ubah "${t.title}"`}
                >
                  <Pencil size={14} aria-hidden="true" />
                </button>
              </span>
            </li>
          ))}
        </ul>
        {left.length > 0 && (
          <button type="button" onClick={() => void moveLeft()} className="btn-ghost mt-2 w-full justify-between border border-line">
            Pindahkan sisa ke {relativeDayLabel(next, today).toLowerCase()} <span className="text-faint">{left.length}</span>
          </button>
        )}
      </section>
      <TaskEditor task={editing} roles={data.roles} onClose={() => setEditing(null)} />
    </>
  )
}
