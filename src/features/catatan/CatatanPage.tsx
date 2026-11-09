import { useLiveQuery } from 'dexie-react-hooks'
import { ListTodo, Pin, Plus, Search } from 'lucide-react'
import { useState } from 'react'
import { useToday } from '../../app/useToday'
import { Limited } from '../../components/Limited'
import { PageTop } from '../../components/PageTop'
import { RoleTag } from '../../components/RoleTag'
import { Sheet } from '../../components/Sheet'
import { useToast } from '../../components/toast-context'
import { deleteTask } from '../../db/daily'
import { db } from '../../db/db'
import { deleteNote, noteToTask, restoreNote, saveNote, setPinned, type NoteInput } from '../../db/notes'
import { roleLookup, useRoles } from '../../db/structure'
import { filterNotes, NOTE_COLORS } from '../../domain/notes'
import { detectPatientIdentity } from '../../domain/phi'
import { formatDateShort, relativeDayLabel } from '../../domain/time'
import type { Note, Role } from '../../types'

const dateOf = (ms: number) => new Date(ms + 7 * 3600_000).toISOString().slice(0, 10)

function Editor({ draft, roles, onClose }: { draft: Note | NoteInput | null; roles: Role[]; onClose: () => void }) {
  return (
    <Sheet open={!!draft} title={draft && 'id' in draft && draft.id ? 'Ubah catatan' : 'Catatan baru'} onClose={onClose}>
      {draft && <EditorBody key={('id' in draft && draft.id) || 'baru'} draft={draft} roles={roles} onClose={onClose} />}
    </Sheet>
  )
}

function EditorBody({ draft, roles, onClose }: { draft: Note | NoteInput; roles: Role[]; onClose: () => void }) {
  const toast = useToast()
  const today = useToday()
  const [n, setN] = useState<NoteInput>({ id: draft.id, text: draft.text, roleId: draft.roleId, color: draft.color, pinned: draft.pinned })
  const phi = n.text.trim() ? detectPatientIdentity(n.text) : null
  const existing = !!draft.id
  const save = async () => {
    try {
      await saveNote(n)
      onClose()
    } catch (e) {
      toast({ message: (e as Error).message, tone: 'error' })
    }
  }
  const remove = async () => {
    if (!n.id) return
    const removed = await deleteNote(n.id)
    onClose()
    if (removed) toast({ message: 'Catatan dihapus.', action: { label: 'Urungkan', onClick: () => void restoreNote(removed) } })
  }
  const toTask = async () => {
    try {
      const note = await saveNote(n)
      const task = await noteToTask(note, today)
      onClose()
      toast({ message: `Jadi tugas hari ini: ${task.title}`, action: { label: 'Urungkan', onClick: () => void deleteTask(task.id) } })
    } catch (e) {
      toast({ message: (e as Error).message, tone: 'error' })
    }
  }
  return (
    <div className="grid gap-4">
      <textarea
        className="field min-h-[180px] resize-y leading-relaxed"
        value={n.text}
        autoFocus={!existing}
        maxLength={4000}
        onChange={(e) => setN({ ...n, text: e.target.value })}
        placeholder={'Baris pertama jadi judul.\nTanpa identitas pasien.'}
        aria-label="Isi catatan"
      />
      {phi && <p className="-mt-2 text-xs text-danger">Mirip identitas pasien ({phi}). Tulis tanpa nama/No. RM.</p>}
      <div className="grid grid-cols-2 gap-2">
        <label className="text-xs text-muted">
          Peran
          <select className="field mt-1" value={n.roleId ?? ''} onChange={(e) => setN({ ...n, roleId: e.target.value || null })}>
            <option value="">Tanpa peran</option>
            {roles
              .filter((r) => !r.archived)
              .map((r) => (
                <option key={r.id} value={r.id}>
                  {r.name}
                </option>
              ))}
          </select>
        </label>
        <div className="text-xs text-muted">
          Warna
          <div className="mt-1.5 flex flex-wrap gap-1.5">
            {NOTE_COLORS.map((c) => (
              <button
                key={c.key}
                type="button"
                aria-label={`Warna ${c.label}`}
                aria-pressed={n.color === c.hex}
                onClick={() => setN({ ...n, color: n.color === c.hex ? null : c.hex })}
                className={`size-7 rounded-full transition ${n.color === c.hex ? 'scale-110 ring-2 ring-text ring-offset-2 ring-offset-surface' : ''}`}
                style={{ background: c.hex }}
              />
            ))}
          </div>
        </div>
      </div>
      <label className="flex items-center gap-2 text-[13.5px]">
        <input
          type="checkbox"
          className="size-4 accent-current"
          checked={n.pinned}
          onChange={(e) => setN({ ...n, pinned: e.target.checked })}
        />
        Sematkan di atas
      </label>
      <div className="flex flex-wrap gap-2">
        {existing && (
          <button type="button" className="btn-ghost border border-line" onClick={() => void remove()}>
            Hapus
          </button>
        )}
        <button type="button" className="btn-ghost border border-line" disabled={!n.text.trim() || !!phi} onClick={() => void toTask()}>
          <ListTodo size={15} aria-hidden="true" /> Jadikan tugas
        </button>
        <button type="button" className="btn-primary flex-1 py-3" disabled={!n.text.trim() || !!phi} onClick={() => void save()}>
          Simpan
        </button>
      </div>
    </div>
  )
}

export function CatatanPage() {
  const today = useToday()
  const roles = useRoles()
  const notes = useLiveQuery(() => db.notes.toArray(), [])
  const [query, setQuery] = useState('')
  const [roleId, setRoleId] = useState<string | null>(null)
  const [editing, setEditing] = useState<Note | NoteInput | null>(null)
  const role = roleLookup(roles)
  if (!notes || !roles) return <PageTop title="Catatan" />
  const shown = filterNotes(notes, query, roleId)
  const counts = new Map<string, number>()
  for (const n of notes) counts.set(n.roleId ?? 'tanpa', (counts.get(n.roleId ?? 'tanpa') ?? 0) + 1)
  const chip = (id: string | null, label: string, count: number) => (
    <button
      key={id ?? 'semua'}
      type="button"
      aria-pressed={roleId === id}
      onClick={() => setRoleId(id)}
      className={`chip py-1 ${roleId === id ? 'border-transparent bg-btn text-btn-text' : ''}`}
    >
      {label} <span className="opacity-60">{count}</span>
    </button>
  )
  return (
    <>
      <PageTop title="Catatan" />
      <h1 className="mt-4 text-[26px] font-semibold tracking-tight md:hidden">Catatan</h1>
      <section className="mt-3 flex flex-wrap items-center gap-2 md:mt-[26px]">
        <label className="relative min-w-[200px] flex-1">
          <Search size={15} className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-faint" aria-hidden="true" />
          <input
            className="field pl-9"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Cari catatan"
            aria-label="Cari catatan"
          />
        </label>
        <button
          type="button"
          className="btn-primary"
          onClick={() => setEditing({ text: '', roleId: roleId && roleId !== 'tanpa' ? roleId : null, color: null, pinned: false })}
        >
          <Plus size={15} aria-hidden="true" /> Catatan
        </button>
      </section>
      <div className="mt-3 flex gap-1.5 overflow-x-auto pb-1">
        {chip(null, 'Semua', notes.length)}
        {roles.filter((r) => counts.get(r.id)).map((r) => chip(r.id, r.name, counts.get(r.id)!))}
        {counts.get('tanpa') ? chip('tanpa', 'Tanpa peran', counts.get('tanpa')!) : null}
      </div>
      {!shown.length && (
        <p className="mt-6 text-center text-[13px] text-muted">
          {notes.length
            ? 'Tidak ada catatan yang cocok.'
            : 'Belum ada catatan. Tulis ide, link, atau ringkasan materi di sini (atau lewat Catat cepat).'}
        </p>
      )}
      <Limited items={shown} limit={9} className="btn-ghost mt-1 w-full border border-line">
        {(list) => (
          <div className="stagger mt-3 gap-3 sm:columns-2 lg:columns-3">
            {list.map((n) => {
              const [first, ...rest] = n.text.split('\n')
              return (
                <article
                  key={n.id}
                  className="card mb-3 break-inside-avoid border-t-4 p-0 md:p-0"
                  style={{ borderTopColor: n.color ?? 'var(--line)' }}
                >
                  <button
                    type="button"
                    onClick={() => setEditing(n)}
                    className="block w-full p-4 text-left"
                    aria-label={`Buka catatan ${first}`}
                  >
                    <div className="font-medium">{first}</div>
                    {rest.join('\n').trim() && (
                      <p className="mt-1 line-clamp-6 text-[13px] whitespace-pre-line text-muted">{rest.join('\n').trim()}</p>
                    )}
                  </button>
                  <div className="flex items-center gap-2 px-4 pb-3 text-[11.5px] text-faint">
                    {n.roleId && <RoleTag role={role(n.roleId)} compact />}
                    <span className="flex-1">
                      {dateOf(n.updatedAt) === today
                        ? 'hari ini'
                        : relativeDayLabel(dateOf(n.updatedAt), today) || formatDateShort(dateOf(n.updatedAt))}
                    </span>
                    <button
                      type="button"
                      className="rounded-full p-1 hover:text-text"
                      aria-label={n.pinned ? `Lepas sematan ${first}` : `Sematkan ${first}`}
                      aria-pressed={n.pinned}
                      onClick={() => void setPinned(n.id, !n.pinned)}
                    >
                      <Pin size={14} aria-hidden="true" className={n.pinned ? 'fill-current text-text' : ''} />
                    </button>
                  </div>
                </article>
              )
            })}
          </div>
        )}
      </Limited>
      <Editor draft={editing} roles={roles} onClose={() => setEditing(null)} />
    </>
  )
}
