import { Plus, Trash2, X } from 'lucide-react'
import { useState } from 'react'
import { Sheet } from '../../components/Sheet'
import { useToast } from '../../components/toast-context'
import { deleteTask, PatientIdentityError, restoreTask, updateTask } from '../../db/daily'
import { detectPatientIdentity, PHI_HINT } from '../../domain/phi'
import { isValidISODate } from '../../domain/time'
import { createId } from '../../lib/id'
import type { Role, Subtask, Task, XpSize } from '../../types'

const SIZES: { size: XpSize; label: string }[] = [
  { size: 'kecil', label: 'Kecil · 5' },
  { size: 'sedang', label: 'Sedang · 10' },
  { size: 'besar', label: 'Besar · 20' },
]

export function TaskEditor({ task, roles, onClose }: { task: Task | null; roles: Role[]; onClose: () => void }) {
  return (
    <Sheet open={!!task} title="Ubah tugas" onClose={onClose}>
      {task && <TaskForm key={task.id} task={task} roles={roles} onClose={onClose} />}
    </Sheet>
  )
}

function TaskForm({ task, roles, onClose }: { task: Task; roles: Role[]; onClose: () => void }) {
  const toast = useToast()
  const [title, setTitle] = useState(task.title)
  const [roleId, setRoleId] = useState(task.roleId)
  const [date, setDate] = useState(task.date)
  const [size, setSize] = useState<XpSize>(task.size)
  const [important, setImportant] = useState(task.important)
  const [subtasks, setSubtasks] = useState<Subtask[]>(task.subtasks)
  const [newSub, setNewSub] = useState('')
  const phi = detectPatientIdentity([title, newSub, ...subtasks.map((st) => st.title)].join(' \n '))
  const addSub = () => {
    if (!newSub.trim()) return
    setSubtasks((list) => [...list, { id: createId('sub'), title: newSub.trim(), done: false }])
    setNewSub('')
  }
  const options = roles.filter((r) => !r.archived || r.id === task.roleId)

  const save = async () => {
    try {
      // Subtugas yang sudah diketik tapi belum ditekan + tetap ikut tersimpan.
      const pending = newSub.trim() ? [{ id: createId('sub'), title: newSub.trim(), done: false }] : []
      await updateTask(task.id, {
        title,
        roleId,
        date: isValidISODate(date) ? date : task.date,
        size,
        important,
        subtasks: [...subtasks, ...pending],
      })
      onClose()
    } catch (e) {
      toast({ message: e instanceof PatientIdentityError ? e.message : (e as Error).message, tone: 'error' })
    }
  }
  const remove = async () => {
    const removed = await deleteTask(task.id)
    onClose()
    if (removed) toast({ message: 'Tugas dihapus.', action: { label: 'Urungkan', onClick: () => void restoreTask(removed) } })
  }

  return (
    <form
      className="grid gap-4"
      onSubmit={(e) => {
        e.preventDefault()
        void save()
      }}
    >
      <label>
        <span className="label">Judul</span>
        <input className="field" value={title} onChange={(e) => setTitle(e.target.value)} maxLength={200} />
        {phi && (
          <span className="mt-1.5 block text-xs text-danger" role="alert">
            Mirip identitas pasien ({phi}). {PHI_HINT}
          </span>
        )}
      </label>
      <div className="grid grid-cols-2 gap-3">
        <label>
          <span className="label">Peran</span>
          <select className="field" value={roleId} onChange={(e) => setRoleId(e.target.value)}>
            {options.map((r) => (
              <option key={r.id} value={r.id}>
                {r.name}
                {r.archived ? ' (arsip)' : ''}
              </option>
            ))}
          </select>
        </label>
        <label>
          <span className="label">Tanggal</span>
          <input className="field" type="date" value={date} onChange={(e) => setDate(e.target.value)} />
        </label>
      </div>
      <div>
        <span className="label">Ukuran (XP)</span>
        <div className="flex rounded-full bg-surface-2 p-[3px]">
          {SIZES.map((s) => (
            <button
              key={s.size}
              type="button"
              onClick={() => setSize(s.size)}
              aria-pressed={size === s.size}
              className={`flex-1 rounded-full px-2 py-1.5 text-[13px] ${size === s.size ? 'bg-surface text-text shadow-sm' : 'text-muted'}`}
            >
              {s.label}
            </button>
          ))}
        </div>
      </div>
      <div>
        <span className="label">Subtugas</span>
        <ul className="grid gap-1.5">
          {subtasks.map((st) => (
            <li key={st.id} className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={st.done}
                onChange={() => setSubtasks((list) => list.map((x) => (x.id === st.id ? { ...x, done: !x.done } : x)))}
                className="size-4 accent-current"
                aria-label={`Selesai: ${st.title}`}
              />
              <input
                className="field py-1.5"
                value={st.title}
                onChange={(e) => setSubtasks((list) => list.map((x) => (x.id === st.id ? { ...x, title: e.target.value } : x)))}
                aria-label="Judul subtugas"
                maxLength={160}
              />
              <button
                type="button"
                className="btn-ghost p-1.5"
                onClick={() => setSubtasks((list) => list.filter((x) => x.id !== st.id))}
                aria-label={`Hapus subtugas ${st.title}`}
              >
                <X size={15} aria-hidden="true" />
              </button>
            </li>
          ))}
        </ul>
        <div className="mt-1.5 flex gap-2">
          <input
            className="field py-1.5"
            value={newSub}
            onChange={(e) => setNewSub(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault()
                addSub()
              }
            }}
            placeholder="Tambah subtugas…"
            aria-label="Subtugas baru"
            maxLength={160}
          />
          <button
            type="button"
            className="btn-ghost border border-line p-2"
            onClick={addSub}
            disabled={!newSub.trim()}
            aria-label="Tambah subtugas"
          >
            <Plus size={16} aria-hidden="true" />
          </button>
        </div>
      </div>
      <label className="flex items-center gap-2.5 text-[13px]">
        <input type="checkbox" checked={important} onChange={(e) => setImportant(e.target.checked)} className="size-4 accent-current" />
        Penting
      </label>
      <div className="flex items-center gap-2">
        <button type="button" onClick={() => void remove()} className="btn-ghost text-danger hover:text-danger">
          <Trash2 size={16} aria-hidden="true" /> Hapus
        </button>
        <button type="submit" className="btn-primary ml-auto px-6 py-2.5" disabled={!title.trim() || !!phi}>
          Simpan
        </button>
      </div>
    </form>
  )
}
