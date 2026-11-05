import { Repeat } from 'lucide-react'
import { useState } from 'react'
import { Sheet } from '../../components/Sheet'
import { useToast } from '../../components/toast-context'
import { saveExercise, swapExercise, undoSwap } from '../../db/training'
import { groupOf, MUSCLE_LABELS, muscleOf, variationsFor, type CatalogItem } from '../../domain/exerciseCatalog'
import { detectPatientIdentity } from '../../domain/phi'
import type { Exercise, Muscle } from '../../types'

/** Ubah satu gerakan: rentang rep, jumlah set, kenaikan beban, arsip. */
export function ExerciseEditor({
  exercise,
  existing,
  onClose,
}: {
  exercise: Exercise | null
  /** Semua gerakan, untuk menyaring saran variasi. */
  existing: Exercise[]
  onClose: () => void
}) {
  return (
    <Sheet open={!!exercise} title={exercise?.name ? `Ubah ${exercise.name}` : 'Gerakan baru'} onClose={onClose}>
      {exercise && <Body key={exercise.id} initial={exercise} existing={existing} onClose={onClose} />}
    </Sheet>
  )
}

function Body({ initial, existing, onClose }: { initial: Exercise; existing: Exercise[]; onClose: () => void }) {
  const toast = useToast()
  const [ex, setEx] = useState(initial)
  const set = (change: Partial<Exercise>) => setEx((e) => ({ ...e, ...change }))
  const num = (v: string) => Number(v.replace(',', '.'))
  const phi = ex.name.trim() ? detectPatientIdentity(ex.name) : null
  const valid = !!ex.name.trim() && !phi && ex.repMin >= 1 && ex.repMax >= ex.repMin && ex.sets >= 1 && ex.increment > 0
  const variations = variationsFor(ex, existing)
  const swap = async (item: CatalogItem) => {
    const done = await swapExercise(initial, item)
    onClose()
    toast({
      message: `${initial.name} diganti ${item.name}.`,
      duration: 6000,
      action: { label: 'Urungkan', onClick: () => void undoSwap(done) },
    })
  }
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
      <div>
        <span className="label">Otot utama</span>
        <div role="radiogroup" aria-label="Otot utama" className="flex flex-wrap gap-1.5">
          {(Object.keys(MUSCLE_LABELS) as Muscle[]).map((m) => (
            <button
              key={m}
              type="button"
              role="radio"
              aria-checked={muscleOf(ex) === m}
              onClick={() => set({ muscle: m, group: groupOf(m), increment: m === 'kaki' && ex.increment === 2.5 ? 5 : ex.increment })}
              className={`chip py-1 ${muscleOf(ex) === m ? 'border-transparent bg-btn text-btn-text' : ''}`}
            >
              {MUSCLE_LABELS[m]}
            </button>
          ))}
        </div>
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
        2,5 kg untuk gerakan besar atas, 5 kg untuk kaki, 1,25 kg untuk lengan & bahu.
      </p>
      {initial.name && !initial.archived && variations.length > 0 && (
        <div>
          <span className="label">Bosan atau stagnan? Ganti variasi</span>
          <div className="flex flex-wrap gap-1.5">
            {variations.slice(0, 6).map((v) => (
              <button key={v.name} type="button" className="chip py-1" onClick={() => void swap(v)}>
                <Repeat size={13} aria-hidden="true" /> {v.name}
              </button>
            ))}
          </div>
          <p className="mt-1.5 text-xs text-faint">
            {initial.name} diarsipkan (riwayatnya tetap), variasi baru mulai dari beban yang kamu pilih. Ganti tiap 4–8 minggu atau saat
            stagnan berulang.
          </p>
        </div>
      )}
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
