import { useState } from 'react'
import { Sheet } from '../../components/Sheet'
import { useToast } from '../../components/toast-context'
import { saveExercise } from '../../db/training'
import { detectPatientIdentity } from '../../domain/phi'
import type { Exercise } from '../../types'

/** Ubah satu gerakan: rentang rep, jumlah set, kenaikan beban, arsip. */
export function ExerciseEditor({ exercise, onClose }: { exercise: Exercise | null; onClose: () => void }) {
  return (
    <Sheet open={!!exercise} title={exercise?.name ? `Ubah ${exercise.name}` : 'Gerakan baru'} onClose={onClose}>
      {exercise && <Body key={exercise.id} initial={exercise} onClose={onClose} />}
    </Sheet>
  )
}

function Body({ initial, onClose }: { initial: Exercise; onClose: () => void }) {
  const toast = useToast()
  const [ex, setEx] = useState(initial)
  const set = (change: Partial<Exercise>) => setEx((e) => ({ ...e, ...change }))
  const num = (v: string) => Number(v.replace(',', '.'))
  const phi = ex.name.trim() ? detectPatientIdentity(ex.name) : null
  const valid = !!ex.name.trim() && !phi && ex.repMin >= 1 && ex.repMax >= ex.repMin && ex.sets >= 1 && ex.increment > 0
  const save = async (archived = ex.archived) => {
    await saveExercise({ ...ex, name: ex.name.trim(), archived })
    toast({ message: archived ? `${ex.name} diarsipkan.` : `${ex.name.trim()} disimpan.` })
    onClose()
  }
  return (
    <div className="grid gap-4">
      <label>
        <span className="label">Nama</span>
        <input
          className="field"
          value={ex.name}
          onChange={(e) => set({ name: e.target.value })}
          placeholder="mis. Incline dumbbell press"
        />
        {phi && <span className="mt-1 block text-xs text-danger">Mirip identitas pasien ({phi}).</span>}
      </label>
      <div role="radiogroup" aria-label="Kelompok" className="flex rounded-full bg-surface-2 p-[3px]">
        {(['upper', 'lower'] as const).map((g) => (
          <button
            key={g}
            type="button"
            role="radio"
            aria-checked={ex.group === g}
            onClick={() => set({ group: g, increment: g === 'lower' && ex.increment === 2.5 ? 5 : ex.increment })}
            className={`flex-1 rounded-full px-3 py-1.5 text-[13px] ${ex.group === g ? 'bg-surface text-text shadow-sm' : 'text-muted'}`}
          >
            {g === 'upper' ? 'Atas' : 'Bawah'}
          </button>
        ))}
      </div>
      <div className="grid grid-cols-4 gap-2">
        <label className="text-xs text-muted">
          Rep min
          <input
            className="field mt-1"
            inputMode="numeric"
            value={ex.repMin || ''}
            onChange={(e) => set({ repMin: Math.round(num(e.target.value)) })}
          />
        </label>
        <label className="text-xs text-muted">
          Rep maks
          <input
            className="field mt-1"
            inputMode="numeric"
            value={ex.repMax || ''}
            onChange={(e) => set({ repMax: Math.round(num(e.target.value)) })}
          />
        </label>
        <label className="text-xs text-muted">
          Set
          <input
            className="field mt-1"
            inputMode="numeric"
            value={ex.sets || ''}
            onChange={(e) => set({ sets: Math.round(num(e.target.value)) })}
          />
        </label>
        <label className="text-xs text-muted">
          Naik (kg)
          <input
            className="field mt-1"
            inputMode="decimal"
            defaultValue={ex.increment}
            onChange={(e) => set({ increment: num(e.target.value) })}
          />
        </label>
      </div>
      <p className="text-xs text-faint">
        Double progression: beban tetap sampai semua set mencapai rep maks, lalu naik sebesar kenaikan dan mulai lagi dari rep min. Umumnya
        2,5 kg untuk gerakan atas, 5 kg untuk bawah.
      </p>
      <div className="flex gap-2">
        {initial.name && (
          <button type="button" className="btn-ghost border border-line" onClick={() => void save(!initial.archived)}>
            {initial.archived ? 'Aktifkan lagi' : 'Arsipkan'}
          </button>
        )}
        <button type="button" className="btn-primary flex-1 py-3" disabled={!valid} onClick={() => void save()}>
          Simpan
        </button>
      </div>
    </div>
  )
}
