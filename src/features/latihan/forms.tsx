import { Minus, Plus } from 'lucide-react'
import { useState } from 'react'
import { Sheet } from '../../components/Sheet'
import { useToast } from '../../components/toast-context'
import { saveWorkout } from '../../db/training'
import { detectPatientIdentity } from '../../domain/phi'
import { FEEL_LABELS, formatDuration, parseDuration, type Prescription } from '../../domain/training'
import { isValidISODate } from '../../domain/time'
import type { Exercise, Feel, RunType, StrengthEntry, StrengthSet } from '../../types'

const FEELS: Feel[] = ['ringan', 'pas', 'berat']

interface Row {
  ex: Exercise
  on: boolean
  sets: StrengthSet[]
  feel: Feel
}

function initialSets(ex: Exercise, plan: Prescription | undefined): StrengthSet[] {
  const kg = plan?.kg ?? 0
  const n = plan && plan.sets > 0 ? plan.sets : ex.sets
  return Array.from({ length: n }, () => ({ kg, reps: plan?.repMin ?? ex.repMin }))
}

/** Catat sesi beban; terisi dari resep sesi berikutnya. */
export function StrengthForm({
  open,
  onClose,
  today,
  exercises,
  plans,
  day,
}: {
  open: boolean
  onClose: () => void
  today: string
  exercises: Exercise[]
  plans: Prescription[]
  /** Hari program (mis. "Atas"); disimpan supaya hari berikutnya bergiliran. */
  day?: string
}) {
  return (
    <Sheet open={open} title={day ? `Catat sesi beban · ${day}` : 'Catat sesi beban'} onClose={onClose}>
      {open && <StrengthBody onClose={onClose} today={today} exercises={exercises} plans={plans} day={day} />}
    </Sheet>
  )
}

function StrengthBody({
  onClose,
  today,
  exercises,
  plans,
  day,
}: {
  onClose: () => void
  today: string
  exercises: Exercise[]
  plans: Prescription[]
  day?: string
}) {
  const toast = useToast()
  const [date, setDate] = useState(today)
  const [note, setNote] = useState('')
  const [rows, setRows] = useState<Row[]>(() =>
    exercises
      .filter((e) => !e.archived)
      .map((ex) => {
        const plan = plans.find((p) => p.exerciseId === ex.id)
        return {
          ex,
          on: !!plan && plan.action !== 'lewati' && (ex.id === '#ex:bench' || plan.action !== 'mulai'),
          sets: initialSets(ex, plan),
          feel: 'pas' as Feel,
        }
      }),
  )
  const update = (i: number, change: Partial<Row>) => setRows((list) => list.map((r, j) => (j === i ? { ...r, ...change } : r)))
  const setSet = (i: number, k: number, change: Partial<StrengthSet>) =>
    update(i, { sets: rows[i].sets.map((s, j) => (j === k ? { ...s, ...change } : s)) })
  const chosen = rows.filter((r) => r.on && r.sets.some((s) => s.kg > 0 && s.reps > 0))
  const phi = note.trim() ? detectPatientIdentity(note) : null
  const save = async () => {
    const entries: StrengthEntry[] = chosen.map((r) => ({
      exerciseId: r.ex.id,
      sets: r.sets.filter((s) => s.kg > 0 && s.reps > 0),
      feel: r.feel,
    }))
    const { habit } = await saveWorkout({
      date: isValidISODate(date) ? date : today,
      kind: 'beban',
      ...(day ? { day } : {}),
      entries,
      run: null,
      note: note.trim(),
    })
    toast({ message: `Sesi beban tersimpan${habit ? ` · habit "${habit}" dicentang` : ''}.` })
    onClose()
  }
  const num = (v: string) => Number(v.replace(',', '.')) || 0
  return (
    <div className="grid gap-4">
      <label className="text-xs text-muted">
        Tanggal
        <input className="field mt-1" type="date" value={date} onChange={(e) => setDate(e.target.value)} />
      </label>
      {rows.map((r, i) => (
        <div key={r.ex.id} className={`rounded-xl border border-line p-3 ${r.on ? '' : 'opacity-60'}`}>
          <label className="flex items-center gap-2 font-medium">
            <input type="checkbox" className="size-4 accent-current" checked={r.on} onChange={(e) => update(i, { on: e.target.checked })} />
            {r.ex.name}
            <span className="ml-auto text-xs font-normal text-faint">
              {r.ex.sets}×{r.ex.repMin}–{r.ex.repMax}
            </span>
          </label>
          {r.on && (
            <>
              <div className="mt-2 grid gap-1.5">
                {r.sets.map((s, k) => (
                  <div key={k} className="flex items-center gap-2 text-[13px]">
                    <span className="w-10 text-xs text-muted">Set {k + 1}</span>
                    <input
                      className="field w-20 py-1.5 text-right"
                      inputMode="decimal"
                      value={s.kg || ''}
                      onChange={(e) => setSet(i, k, { kg: num(e.target.value) })}
                      aria-label={`${r.ex.name} set ${k + 1} beban kg`}
                    />
                    <span className="text-xs text-muted">kg ×</span>
                    <input
                      className="field w-16 py-1.5 text-right"
                      inputMode="numeric"
                      value={s.reps || ''}
                      onChange={(e) => setSet(i, k, { reps: Math.round(num(e.target.value)) })}
                      aria-label={`${r.ex.name} set ${k + 1} repetisi`}
                    />
                    <span className="text-xs text-muted">rep</span>
                  </div>
                ))}
              </div>
              <div className="mt-2 flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  className="btn-ghost p-1.5"
                  onClick={() => update(i, { sets: [...r.sets, { ...r.sets[r.sets.length - 1] }] })}
                  aria-label="Tambah set"
                >
                  <Plus size={15} aria-hidden="true" />
                </button>
                <button
                  type="button"
                  className="btn-ghost p-1.5"
                  disabled={r.sets.length <= 1}
                  onClick={() => update(i, { sets: r.sets.slice(0, -1) })}
                  aria-label="Kurangi set"
                >
                  <Minus size={15} aria-hidden="true" />
                </button>
                <div
                  role="radiogroup"
                  aria-label={`Rasa set terakhir ${r.ex.name}`}
                  className="ml-auto flex rounded-full bg-surface-2 p-[3px]"
                >
                  {FEELS.map((f) => (
                    <button
                      key={f}
                      type="button"
                      role="radio"
                      aria-checked={r.feel === f}
                      title={FEEL_LABELS[f]}
                      onClick={() => update(i, { feel: f })}
                      className={`rounded-full px-2.5 py-1 text-xs ${r.feel === f ? 'bg-surface text-text shadow-sm' : 'text-muted'}`}
                    >
                      {f}
                    </button>
                  ))}
                </div>
              </div>
            </>
          )}
        </div>
      ))}
      <label>
        <span className="label">Catatan (opsional)</span>
        <input className="field" value={note} onChange={(e) => setNote(e.target.value)} placeholder="mis. bahu agak kaku" maxLength={200} />
        {phi && <span className="mt-1 block text-xs text-danger">Mirip identitas pasien ({phi}).</span>}
      </label>
      <p className="text-xs text-faint">
        Rasa = sisa repetisi di set terakhir: ringan (≥3), pas (±2), berat (0–1). Dipakai untuk menentukan kapan beban naik.
      </p>
      <button type="button" className="btn-primary w-full py-3" disabled={!chosen.length || !!phi} onClick={() => void save()}>
        Simpan sesi
      </button>
    </div>
  )
}

const RUN_TYPES: { v: RunType; label: string }[] = [
  { v: 'easy', label: 'Santai' },
  { v: 'long', label: 'Panjang' },
  { v: 'kualitas', label: 'Kualitas' },
  { v: 'tes', label: 'Tes' },
]

/** Catat lari: jarak, waktu, jenis. */
export function RunForm({ open, onClose, today }: { open: boolean; onClose: () => void; today: string }) {
  return (
    <Sheet open={open} title="Catat lari" onClose={onClose}>
      {open && <RunBody onClose={onClose} today={today} />}
    </Sheet>
  )
}

function RunBody({ onClose, today }: { onClose: () => void; today: string }) {
  const toast = useToast()
  const [date, setDate] = useState(today)
  const [km, setKm] = useState('')
  const [time, setTime] = useState('')
  const [type, setType] = useState<RunType>('easy')
  const [feel, setFeel] = useState<Feel>('pas')
  const kmNum = Number(km.replace(',', '.'))
  const sec = parseDuration(time)
  const valid = kmNum > 0 && kmNum < 100 && !!sec
  const save = async () => {
    if (!valid) return
    const { habit } = await saveWorkout({
      date: isValidISODate(date) ? date : today,
      kind: 'lari',
      entries: [],
      run: { km: kmNum, sec: sec!, type, feel },
      note: '',
    })
    toast({ message: `Lari ${kmNum} km tersimpan${habit ? ` · habit "${habit}" dicentang` : ''}.` })
    onClose()
  }
  return (
    <div className="grid gap-4">
      <div className="grid grid-cols-3 gap-2">
        <label className="text-xs text-muted">
          Tanggal
          <input className="field mt-1" type="date" value={date} onChange={(e) => setDate(e.target.value)} />
        </label>
        <label className="text-xs text-muted">
          Jarak (km)
          <input className="field mt-1" inputMode="decimal" value={km} onChange={(e) => setKm(e.target.value)} placeholder="5" />
        </label>
        <label className="text-xs text-muted">
          Waktu
          <input className="field mt-1" inputMode="numeric" value={time} onChange={(e) => setTime(e.target.value)} placeholder="31:00" />
        </label>
      </div>
      {valid && <p className="text-[13px] text-muted">Pace {formatDuration(sec! / kmNum)}/km</p>}
      <div role="radiogroup" aria-label="Jenis lari" className="flex rounded-full bg-surface-2 p-[3px]">
        {RUN_TYPES.map((t) => (
          <button
            key={t.v}
            type="button"
            role="radio"
            aria-checked={type === t.v}
            onClick={() => setType(t.v)}
            className={`flex-1 rounded-full px-2 py-1.5 text-[13px] ${type === t.v ? 'bg-surface text-text shadow-sm' : 'text-muted'}`}
          >
            {t.label}
          </button>
        ))}
      </div>
      <div role="radiogroup" aria-label="Rasa" className="flex rounded-full bg-surface-2 p-[3px]">
        {FEELS.map((f) => (
          <button
            key={f}
            type="button"
            role="radio"
            aria-checked={feel === f}
            onClick={() => setFeel(f)}
            className={`flex-1 rounded-full px-2 py-1.5 text-[13px] ${feel === f ? 'bg-surface text-text shadow-sm' : 'text-muted'}`}
          >
            {f}
          </button>
        ))}
      </div>
      <p className="text-xs text-faint">
        Tes & kualitas dipakai untuk memperkirakan waktu 5K (Riegel). Santai & panjang menambah volume mingguan.
      </p>
      <button type="button" className="btn-primary w-full py-3" disabled={!valid} onClick={() => void save()}>
        Simpan lari
      </button>
    </div>
  )
}
