import { useState } from 'react'
import { Limited } from '../../components/Limited'
import { useToast } from '../../components/toast-context'
import { addTask, moveTasks, moveUndoneToTomorrow, PatientIdentityError } from '../../db/daily'
import { DEFAULT_ROLE_ID } from '../../db/defaults'
import { roleLookup } from '../../db/structure'
import { detectPatientIdentity, PHI_HINT } from '../../domain/phi'
import { addDays, relativeDayLabel } from '../../domain/time'
import type { Role, Task } from '../../types'
import { TaskRow } from './TaskRow'

interface Props {
  date: string
  today: string
  tasks: Task[]
  roles: Role[]
  filter: string | null
  onEdit: (t: Task) => void
}

/** Tampilan satu hari: tambah tugas, daftar, pindahkan sisa. */
export function DayView({ date, today, tasks, roles, filter, onEdit }: Props) {
  const toast = useToast()
  const [title, setTitle] = useState('')
  const [roleId, setRoleId] = useState<string>(DEFAULT_ROLE_ID)
  const role = roleLookup(roles)
  const phi = title.trim() ? detectPatientIdentity(title) : null
  const activeRoles = roles.filter((r) => !r.archived)
  const shown = filter ? tasks.filter((t) => t.roleId === filter) : tasks
  const left = tasks.filter((t) => !t.done)
  const next = addDays(date, 1)
  const nextLabel = relativeDayLabel(next, today).toLowerCase()

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
    toast({ message: `Dipindah ke ${nextLabel}.`, action: { label: 'Urungkan', onClick: () => void moveTasks([t.id], date) } })
  }
  const moveLeft = async () => {
    const ids = await moveUndoneToTomorrow(date)
    toast({
      message: `${ids.length} tugas dipindah ke ${nextLabel}.`,
      action: { label: 'Urungkan', onClick: () => void moveTasks(ids, date) },
    })
  }

  return (
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
      <div className="mt-3">
        {shown.length === 0 && (
          <p className="py-3 text-[13px] text-muted">Belum ada tugas{filter ? ` ${role(filter).name}` : ''} di hari ini.</p>
        )}
        <Limited items={shown}>
          {(list) => (
            <ul>
              {list.map((t) => (
                <TaskRow key={t.id} task={t} role={role(t.roleId)} onEdit={onEdit} onMove={(x) => void moveOne(x)} />
              ))}
            </ul>
          )}
        </Limited>
      </div>
      {left.length > 0 && (
        <button type="button" onClick={() => void moveLeft()} className="btn-ghost mt-2 w-full justify-between border border-line">
          Pindahkan sisa ke {nextLabel} <span className="text-faint">{left.length}</span>
        </button>
      )}
    </section>
  )
}
