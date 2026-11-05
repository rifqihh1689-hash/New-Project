import { useState } from 'react'
import { Sheet } from '../../components/Sheet'
import { useToast } from '../../components/toast-context'
import { PatientIdentityError } from '../../db/daily'
import { deleteSession, restoreSession, saveSession, type SessionInput } from '../../db/tentir'
import { detectPatientIdentity } from '../../domain/phi'
import { isLate, sessionRange } from '../../domain/tentir'
import { isValidISODate, parseClock } from '../../domain/time'
import { formatRupiah } from '../../lib/format'
import type { TentirSession } from '../../types'

export type SessionDraft = TentirSession | { date: string }

const HOURS = [1, 1.5, 2, 2.5, 3]

/** Tambah / ubah satu sesi tentir. Tarif = jam × tarif per jam, bisa diganti manual (mis. kelompok). */
export function SessionEditor({
  draft,
  rate,
  limit,
  students,
  onClose,
}: {
  draft: SessionDraft | null
  rate: number
  /** Batas kerja malam (`null` = tanpa batas). */
  limit: string | null
  students: string[]
  onClose: () => void
}) {
  const editing = draft && 'id' in draft
  return (
    <Sheet open={!!draft} title={editing ? 'Ubah sesi tentir' : 'Sesi tentir baru'} onClose={onClose}>
      {draft && (
        <Body key={'id' in draft ? draft.id : draft.date} draft={draft} rate={rate} limit={limit} students={students} onClose={onClose} />
      )}
    </Sheet>
  )
}

function Body({
  draft,
  rate,
  limit,
  students,
  onClose,
}: {
  draft: SessionDraft
  rate: number
  limit: string | null
  students: string[]
  onClose: () => void
}) {
  const toast = useToast()
  const existing = 'id' in draft ? draft : null
  const [s, setS] = useState<SessionInput>(
    () => existing ?? { student: '', topic: '', date: draft.date, start: '19.00', hours: 2, fee: rate * 2, paid: false },
  )
  // Tarif mengikuti durasi sampai diubah manual.
  const [feeTouched, setFeeTouched] = useState(!!existing)
  const set = (change: Partial<SessionInput>) =>
    setS((cur) => {
      const next = { ...cur, ...change }
      if (!feeTouched && change.hours != null) next.fee = Math.round(rate * change.hours)
      return next
    })
  const phi = detectPatientIdentity(`${s.student} ${s.topic}`)
  const validStart = !s.start || parseClock(s.start) != null
  const range = s.start && validStart ? sessionRange(s) : null
  const late = validStart ? isLate(s, limit) : null
  const valid = !!s.student.trim() && s.hours > 0 && isValidISODate(s.date) && validStart && !phi

  const save = async () => {
    try {
      await saveSession({ ...s, start: s.start ? s.start.replace(':', '.').padStart(5, '0') : null })
      toast({ message: `Sesi ${s.student.toUpperCase()} tersimpan${s.paid ? ' · masuk pemasukan' : ''}.` })
      onClose()
    } catch (e) {
      toast({ message: e instanceof PatientIdentityError ? e.message : (e as Error).message, tone: 'error' })
    }
  }
  const remove = async () => {
    if (!existing) return
    const removed = await deleteSession(existing.id)
    onClose()
    if (removed) toast({ message: 'Sesi dihapus.', action: { label: 'Urungkan', onClick: () => void restoreSession(removed) } })
  }

  return (
    <div className="grid gap-4">
      <div className="grid grid-cols-[1fr_2fr] gap-2">
        <label className="text-xs text-muted">
          Inisial murid
          <input
            className="field mt-1 uppercase"
            value={s.student}
            maxLength={6}
            onChange={(e) => set({ student: e.target.value.replace(/[^\p{L}\d]/gu, '') })}
            placeholder="AB"
            list="tentir-students"
          />
          <datalist id="tentir-students">
            {students.map((x) => (
              <option key={x} value={x} />
            ))}
          </datalist>
        </label>
        <label className="text-xs text-muted">
          Topik
          <input
            className="field mt-1"
            value={s.topic}
            maxLength={80}
            onChange={(e) => set({ topic: e.target.value })}
            placeholder="mis. Anatomi ekstremitas"
          />
        </label>
      </div>
      {phi && <p className="-mt-2 text-xs text-danger">Mirip identitas pasien ({phi}). Pakai inisial murid saja, tanpa data pasien.</p>}
      <div className="grid grid-cols-2 gap-2">
        <label className="text-xs text-muted">
          Tanggal
          <input className="field mt-1" type="date" value={s.date} onChange={(e) => set({ date: e.target.value })} />
        </label>
        <label className="text-xs text-muted">
          Mulai
          <input
            className="field mt-1"
            inputMode="numeric"
            value={s.start ?? ''}
            onChange={(e) => set({ start: e.target.value || null })}
            placeholder="19.00"
          />
        </label>
      </div>
      <div>
        <span className="label">Durasi</span>
        <div className="flex flex-wrap gap-1.5">
          {HOURS.map((h) => (
            <button
              key={h}
              type="button"
              aria-pressed={s.hours === h}
              onClick={() => set({ hours: h })}
              className={`chip px-3 py-1 ${s.hours === h ? 'border-transparent bg-btn text-btn-text' : ''}`}
            >
              {String(h).replace('.', ',')} j
            </button>
          ))}
        </div>
        <p className={`mt-1.5 text-xs ${late ? 'text-uang' : 'text-muted'}`}>
          {range
            ? `${range}${late ? ` · melewati batas ${limit} (quest tentir hari itu tidak dapat XP, tanpa penalti)` : limit ? ` · sebelum ${limit}` : ''}`
            : validStart
              ? 'Jam mulai opsional.'
              : 'Format jam: 19.00'}
        </p>
      </div>
      <div className="grid grid-cols-[1fr_auto] items-end gap-3">
        <label className="text-xs text-muted">
          Tarif sesi (Rp)
          <input
            className="field mt-1"
            inputMode="numeric"
            value={s.fee ? s.fee.toLocaleString('id-ID') : ''}
            onChange={(e) => {
              setFeeTouched(true)
              setS((cur) => ({ ...cur, fee: Number(e.target.value.replace(/[^\d]/g, '')) || 0 }))
            }}
          />
        </label>
        <label className="flex items-center gap-2 pb-2.5 text-[13.5px]">
          <input type="checkbox" className="size-4 accent-current" checked={s.paid} onChange={(e) => set({ paid: e.target.checked })} />
          Lunas
        </label>
      </div>
      <p className="-mt-2 text-xs text-faint">
        {formatRupiah(rate)}/jam × {String(s.hours).replace('.', ',')} j = {formatRupiah(rate * s.hours)}. Ubah manual untuk kelompok atau
        paket. Sesi lunas otomatis jadi pemasukan.
      </p>
      <div className="flex gap-2">
        {existing && (
          <button type="button" className="btn-ghost border border-line" onClick={() => void remove()}>
            Hapus
          </button>
        )}
        <button type="button" className="btn-primary flex-1 py-3" disabled={!valid} onClick={() => void save()}>
          Simpan sesi
        </button>
      </div>
    </div>
  )
}
