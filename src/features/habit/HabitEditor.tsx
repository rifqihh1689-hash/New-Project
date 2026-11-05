import { useState } from 'react'
import { Sheet } from '../../components/Sheet'
import { useToast } from '../../components/toast-context'
import { assertNoPatientIdentity } from '../../db/daily'
import { DEFAULT_ROLE_ID } from '../../db/defaults'
import { saveHabit } from '../../db/structure'
import { DAY_TYPE_LABELS, DAY_TYPES } from '../../domain/dayType'
import { detectPatientIdentity, PHI_HINT } from '../../domain/phi'
import { DAY_SHORT } from '../../domain/time'
import { createId } from '../../lib/id'
import type { DayType, Habit, Role, XpSize } from '../../types'

export type HabitDraft = Habit | 'baru'

const SIZES: { size: XpSize; label: string }[] = [
  { size: 'kecil', label: 'Kecil · 5' },
  { size: 'sedang', label: 'Sedang · 10' },
  { size: 'besar', label: 'Besar · 20' },
]
// Senin dulu, Minggu terakhir.
const WEEK_ORDER = [1, 2, 3, 4, 5, 6, 0]

export function HabitEditor({
  draft,
  roles,
  nextOrder,
  onClose,
}: {
  draft: HabitDraft | null
  roles: Role[]
  nextOrder: number
  onClose: () => void
}) {
  return (
    <Sheet open={!!draft} title={draft === 'baru' ? 'Habit baru' : 'Ubah habit'} onClose={onClose}>
      {draft && (
        <HabitForm key={draft === 'baru' ? 'baru' : draft.id} draft={draft} roles={roles} nextOrder={nextOrder} onClose={onClose} />
      )}
    </Sheet>
  )
}

function HabitForm({ draft, roles, nextOrder, onClose }: { draft: HabitDraft; roles: Role[]; nextOrder: number; onClose: () => void }) {
  const toast = useToast()
  const [h, setH] = useState<Habit>(() =>
    draft === 'baru'
      ? {
          id: createId('hab'),
          name: '',
          roleId: DEFAULT_ROLE_ID,
          size: 'sedang',
          dayTypes: ['stase', 'libur'],
          weekdays: [],
          minutes: null,
          kind: 'normal',
          active: true,
          order: nextOrder,
          createdAt: Date.now(),
          updatedAt: Date.now(),
        }
      : draft,
  )
  const set = (changes: Partial<Habit>) => setH((prev) => ({ ...prev, ...changes }))
  const auto = h.kind !== 'normal'
  const phi = detectPatientIdentity(`${h.name} ${h.note ?? ''}`)
  const toggle = <T,>(list: T[], v: T) => (list.includes(v) ? list.filter((x) => x !== v) : [...list, v])

  const save = async (changes: Partial<Habit> = {}) => {
    try {
      const next = { ...h, ...changes, name: h.name.trim(), note: h.note?.trim() || undefined }
      if (!next.name) throw new Error('Nama habit kosong.')
      if (!next.dayTypes.length) throw new Error('Pilih minimal satu tipe hari.')
      assertNoPatientIdentity(next.name, next.note ?? '')
      await saveHabit(next)
      onClose()
    } catch (e) {
      toast({ message: (e as Error).message, tone: 'error' })
    }
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
        <span className="label">Nama</span>
        <input
          className="field"
          value={h.name}
          onChange={(e) => set({ name: e.target.value })}
          placeholder="mis. Blok belajar 45 mnt"
          maxLength={80}
        />
        {phi && (
          <span className="mt-1.5 block text-xs text-danger" role="alert">
            Mirip identitas pasien ({phi}). {PHI_HINT}
          </span>
        )}
        {auto && (
          <span className="mt-1.5 block text-xs text-faint">
            Habit otomatis: dinilai dari {h.kind === 'sleep' ? 'jam tidur' : 'jam berhenti kerja'}.
          </span>
        )}
      </label>
      <label>
        <span className="label">Catatan / detail program</span>
        <textarea
          className="field min-h-[64px]"
          value={h.note ?? ''}
          onChange={(e) => set({ note: e.target.value || undefined })}
          placeholder="mis. Bench 3×5, row 3×8, squat 3×5"
          maxLength={500}
        />
      </label>
      <div className="grid grid-cols-2 gap-3">
        <label>
          <span className="label">Peran</span>
          <select className="field" value={h.roleId} onChange={(e) => set({ roleId: e.target.value })}>
            {roles
              .filter((r) => !r.archived || r.id === h.roleId)
              .map((r) => (
                <option key={r.id} value={r.id}>
                  {r.name}
                </option>
              ))}
          </select>
        </label>
        <label>
          <span className="label">Target menit / hari</span>
          <input
            className="field"
            type="number"
            inputMode="numeric"
            min={0}
            max={600}
            disabled={auto}
            value={h.minutes ?? ''}
            placeholder="tanpa menit"
            onChange={(e) => set({ minutes: e.target.value ? Math.max(0, Math.min(600, Number(e.target.value))) || null : null })}
          />
        </label>
      </div>
      <div>
        <span className="label">Ukuran (XP)</span>
        <div className="flex rounded-full bg-surface-2 p-[3px]">
          {SIZES.map((s) => (
            <button
              key={s.size}
              type="button"
              aria-pressed={h.size === s.size}
              onClick={() => set({ size: s.size })}
              className={`flex-1 rounded-full px-2 py-1.5 text-[13px] ${h.size === s.size ? 'bg-surface text-text shadow-sm' : 'text-muted'}`}
            >
              {s.label}
            </button>
          ))}
        </div>
      </div>
      <div>
        <span className="label">Berlaku di tipe hari</span>
        <div className="flex flex-wrap gap-1.5">
          {DAY_TYPES.map((t: DayType) => (
            <button
              key={t}
              type="button"
              aria-pressed={h.dayTypes.includes(t)}
              onClick={() => set({ dayTypes: toggle(h.dayTypes, t) })}
              className={`chip py-1 ${h.dayTypes.includes(t) ? 'border-transparent bg-btn text-btn-text' : ''}`}
            >
              {DAY_TYPE_LABELS[t]}
            </button>
          ))}
        </div>
      </div>
      <div>
        <span className="label">
          Hari dalam minggu {h.weekdays.length === 0 && <span className="text-faint">(kosong = setiap hari)</span>}
        </span>
        <div className="flex flex-wrap gap-1.5">
          {WEEK_ORDER.map((d) => (
            <button
              key={d}
              type="button"
              aria-pressed={h.weekdays.includes(d)}
              onClick={() => set({ weekdays: toggle(h.weekdays, d) })}
              className={`chip px-3 py-1 ${h.weekdays.includes(d) ? 'border-transparent bg-btn text-btn-text' : ''}`}
            >
              {DAY_SHORT[d]}
            </button>
          ))}
        </div>
      </div>
      <div className="flex items-center gap-2">
        {draft !== 'baru' && (
          <button type="button" className="btn-ghost" onClick={() => void save({ active: !h.active })}>
            {h.active ? 'Nonaktifkan' : 'Aktifkan lagi'}
          </button>
        )}
        <button type="submit" className="btn-primary ml-auto px-6 py-2.5" disabled={!h.name.trim() || !!phi}>
          Simpan
        </button>
      </div>
      {draft !== 'baru' && (
        <p className="text-xs text-faint">Habit tidak dihapus, hanya dinonaktifkan, supaya riwayat dan XP lama tetap utuh.</p>
      )}
    </form>
  )
}
