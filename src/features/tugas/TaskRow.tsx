import { ArrowRight, Pencil } from 'lucide-react'
import { Check } from '../../components/Check'
import { SwipeRow } from '../../components/SwipeRow'
import { RoleTag } from '../../components/RoleTag'
import { toggleSubtask, toggleTask } from '../../db/daily'
import type { Role, Task } from '../../types'

const XP = { kecil: 5, sedang: 10, besar: 20 } as const

interface Props {
  task: Task
  role: Role
  onEdit: (t: Task) => void
  onMove?: (t: Task) => void
  compact?: boolean
}

/** Satu tugas: centang, judul, label peran, XP, subtugas. Dipakai tampilan Hari dan Minggu. */
export function TaskRow({ task: t, role, onEdit, onMove, compact }: Props) {
  const subDone = t.subtasks.filter((s) => s.done).length
  return (
    <SwipeRow
      onRight={() => void toggleTask(t)}
      onLeft={onMove && !t.done ? () => onMove(t) : undefined}
      rightLabel={t.done ? 'Batal' : 'Selesai'}
      leftLabel="Hari berikutnya"
      className="border-t border-line first:border-t-0"
    >
      <div className={`px-1 ${compact ? 'py-2' : 'py-2.5'}`}>
        <div className="flex items-start gap-3">
          <Check checked={t.done} onChange={() => void toggleTask(t)} label={`Centang ${t.title}`} />
          <button
            type="button"
            onClick={() => onEdit(t)}
            className={`flex-1 text-left transition-colors duration-300 ${t.done ? 'text-faint line-through' : ''}`}
          >
            {t.title}
            {t.important && !t.done && (
              <span
                className="ml-1.5 rounded-md px-[7px] py-0.5 text-[11px] text-danger"
                style={{ background: 'color-mix(in srgb, var(--danger) 14%, transparent)' }}
              >
                Penting
              </span>
            )}
            {t.subtasks.length > 0 && (
              <span className="ml-1.5 text-[11px] text-faint tabular-nums no-underline">
                {subDone}/{t.subtasks.length}
              </span>
            )}
            {t.source === 'claude' && <span className="ml-1.5 text-[11px] text-faint">dari Claude</span>}
          </button>
          <span className="flex items-center gap-2 pt-0.5">
            <RoleTag role={role} compact />
            {!compact && <span className="text-[11.5px] text-faint tabular-nums">+{XP[t.size]}</span>}
            {onMove && !t.done && (
              <button
                type="button"
                onClick={() => onMove(t)}
                className="rounded-full p-1 text-faint hover:text-text"
                aria-label={`Pindahkan "${t.title}" ke hari berikutnya`}
                title="Pindah ke hari berikutnya"
              >
                <ArrowRight size={15} aria-hidden="true" />
              </button>
            )}
            {!compact && (
              <button
                type="button"
                onClick={() => onEdit(t)}
                className="rounded-full p-1 text-faint hover:text-text"
                aria-label={`Ubah "${t.title}"`}
              >
                <Pencil size={14} aria-hidden="true" />
              </button>
            )}
          </span>
        </div>
        {t.subtasks.length > 0 && (
          <ul className="mt-1.5 ml-8 grid gap-1">
            {t.subtasks.map((st) => (
              <li key={st.id} className="flex items-center gap-2 text-[13px]">
                <Check
                  checked={st.done}
                  onChange={() => void toggleSubtask(t, st.id)}
                  label={`Centang subtugas ${st.title}`}
                  size="sm"
                  tone="muted"
                />
                <span className={st.done ? 'text-faint line-through' : 'text-muted'}>{st.title}</span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </SwipeRow>
  )
}
