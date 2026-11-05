import { Check, Plus } from 'lucide-react'
import { Sheet } from '../../components/Sheet'
import { useToast } from '../../components/toast-context'
import { db } from '../../db/db'
import { addFromCatalog } from '../../db/training'
import { EXERCISE_CATALOG, MUSCLE_LABELS } from '../../domain/exerciseCatalog'
import type { Exercise, Muscle } from '../../types'

/** Katalog gerakan: ketuk untuk menambah ke program; atau buat gerakan sendiri. */
export function CatalogSheet({
  open,
  exercises,
  onClose,
  onCustom,
}: {
  open: boolean
  exercises: Exercise[]
  onClose: () => void
  onCustom: () => void
}) {
  const toast = useToast()
  const have = new Map(exercises.map((e) => [e.name.toLowerCase(), e]))
  const nextOrder = Math.max(0, ...exercises.map((e) => e.order)) + 1
  const add = async (i: (typeof EXERCISE_CATALOG)[number]) => {
    const ex = await addFromCatalog(i, nextOrder)
    toast({
      message: `${i.name} ditambahkan (${i.sets}×${i.repMin}–${i.repMax}).`,
      action: { label: 'Urungkan', onClick: () => void db.exercises.delete(ex.id) },
    })
  }
  return (
    <Sheet open={open} title="Tambah gerakan" onClose={onClose}>
      <div className="grid gap-4">
        {(Object.keys(MUSCLE_LABELS) as Muscle[]).map((m) => {
          const items = EXERCISE_CATALOG.filter((c) => c.muscle === m)
          if (!items.length) return null
          return (
            <div key={m}>
              <div className="mb-1.5 text-xs font-medium tracking-wide text-faint uppercase">{MUSCLE_LABELS[m]}</div>
              <div className="flex flex-wrap gap-1.5">
                {items.map((i) => {
                  const existing = have.get(i.name.toLowerCase())
                  const active = existing && !existing.archived
                  return (
                    <button
                      key={i.name}
                      type="button"
                      disabled={!!active}
                      onClick={() => void add(i)}
                      className={`chip py-1 ${active ? 'border-transparent bg-surface-2 text-faint' : ''}`}
                      aria-label={active ? `${i.name} sudah ada` : `Tambah ${i.name}`}
                    >
                      {active ? <Check size={13} aria-hidden="true" /> : <Plus size={13} aria-hidden="true" />}
                      {i.name}
                    </button>
                  )
                })}
              </div>
            </div>
          )
        })}
        <button
          type="button"
          className="btn-ghost border border-line"
          onClick={() => {
            onClose()
            onCustom()
          }}
        >
          <Plus size={15} aria-hidden="true" /> Buat gerakan sendiri
        </button>
        <p className="text-xs text-faint">
          Gerakan baru langsung ikut resep progres: mulai dari beban yang sanggup rep maks + 2 dengan sisa 2–3 rep. Dengan program
          Atas/Bawah atau Push/Pull/Kaki, gerakan masuk hari sesuai ototnya.
        </p>
      </div>
    </Sheet>
  )
}
