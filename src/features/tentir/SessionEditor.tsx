import { useState } from 'react'
import { Sheet } from '../../components/Sheet'
import { TimeField } from '../../components/TimeField'
import { useToast } from '../../components/toast-context'
import { PatientIdentityError } from '../../db/daily'
import { deleteSession, restoreSession, saveSession, type SessionInput } from '../../db/tentir'
import { detectPatientIdentity } from '../../domain/phi'
import { normalizeClock } from '../../domain/ritme'
import { isLate, sessionRange } from '../../domain/tentir'
import { isValidISODate } from '../../domain/time'
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
  studentRates = new Map(),
  packageFor = () => null,
  topics = [],
  onClose,
}: {
  draft: SessionDraft | null
  rate: number
  /** Batas kerja malam (`null` = tanpa batas). */
  limit: string | null
  students: string[]
  /** Tarif khusus per murid (inisial → Rp/jam). */
  studentRates?: Map<string, number>
  /** Paket aktif murid (masih ada sisa sesi). */
  packageFor?: (initials: string) => PackageInfo | null
  /** Saran topik (judul materi). */
  topics?: string[]
  onClose: () => void
}) {
  const editing = draft && 'id' in draft
  return (
    <Sheet open={!!draft} title={editing ? 'Ubah sesi tentir' : 'Sesi tentir baru'} onClose={onClose}>
      {draft && (
        <Body
          key={'id' in draft ? draft.id : draft.date}
          draft={draft}
          rate={rate}
          limit={limit}
          students={students}
          studentRates={studentRates}
          packageFor={packageFor}
          topics={topics}
          onClose={onClose}
        />
      )}
    </Sheet>
  )
}

export interface PackageInfo {
  id: string
  name: string
  left: number
}

function Body({
  draft,
  rate,
  limit,
  students,
  studentRates,
  packageFor,
  topics,
  onClose,
}: {
  draft: SessionDraft
  rate: number
  limit: string | null
  students: string[]
  studentRates: Map<string, number>
  packageFor: (initials: string) => PackageInfo | null
  topics: string[]
  onClose: () => void
}) {
  const toast = useToast()
  const existing = 'id' in draft ? draft : null
  const [s, setS] = useState<SessionInput>(
    () => existing ?? { student: '', topic: '', date: draft.date, start: '19.00', hours: 2, fee: rate * 2, paid: false },
  )
  // Tarif mengikuti durasi sampai diubah manual.
  const [feeTouched, setFeeTouched] = useState(!!existing)
  const rateOf = (initials: string) => studentRates.get(initials.trim().toUpperCase()) ?? rate
  const set = (change: Partial<SessionInput>) =>
    setS((cur) => {
      const next = { ...cur, ...change }
      // Tarif mengikuti durasi & tarif khusus murid sampai diubah manual.
      if (!feeTouched && (change.hours != null || change.student != null)) next.fee = Math.round(rateOf(next.student) * next.hours)
      return next
    })
  // Sesi baru untuk murid yang punya paket aktif: pakai paket (Rp0, tanpa transaksi sendiri).
  const pkg = existing ? null : packageFor(s.student)
  const [usePkg, setUsePkg] = useState(true)
  const inPackage = existing ? !!existing.packageId : !!pkg && usePkg
  const phi = detectPatientIdentity(`${s.student} ${s.topic}`)
  // "20" atau "9.3" sudah sah: dirapikan jadi HH.MM saat disimpan.
  const start = s.start ? normalizeClock(s.start) : null
  const validStart = !s.start || start != null
  const timed = { ...s, start }
  const range = start ? sessionRange(timed) : null
  const late = validStart ? isLate(timed, limit) : null
  const valid = !!s.student.trim() && s.hours > 0 && isValidISODate(s.date) && validStart && !phi

  const save = async () => {
    try {
      const { id } = await saveSession({
        ...s,
        start,
        ...(pkg && usePkg ? { packageId: pkg.id, fee: 0, paid: true } : {}),
      })
      toast({
        message: `Sesi ${s.student.toUpperCase()} tersimpan${s.paid && !inPackage ? ' · masuk pemasukan' : ''}.`,
        // Sesi baru dihapus lagi; sesi lama dikembalikan ke isi sebelumnya (transaksinya ikut).
        action: {
          label: 'Urungkan',
          onClick: () => void (existing ? saveSession(existing) : deleteSession(id)),
        },
      })
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
            list="tentir-topics"
          />
          <datalist id="tentir-topics">
            {topics.map((x) => (
              <option key={x} value={x} />
            ))}
          </datalist>
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
          <TimeField className="field mt-1" value={s.start ?? ''} onChange={(v) => set({ start: v || null })} />
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
              : 'Jam belum dikenali. Ketik mis. 1900 → 19.00.'}
        </p>
      </div>
      {pkg && (
        <label className="flex items-center gap-2 rounded-xl bg-surface-2 px-3 py-2 text-[13.5px]">
          <input type="checkbox" className="size-4 accent-current" checked={usePkg} onChange={(e) => setUsePkg(e.target.checked)} />
          Pakai paket {pkg.name} (sisa {pkg.left} sesi)
        </label>
      )}
      {inPackage ? (
        <p className="text-xs text-faint">
          Bagian dari paket: Rp0 di sesi ini, karena paketnya sudah dicatat sebagai pemasukan saat dibayar.
        </p>
      ) : (
        <>
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
            {formatRupiah(rateOf(s.student))}/jam
            {studentRates.has(s.student.trim().toUpperCase()) ? ` (tarif khusus ${s.student.toUpperCase()})` : ''} ×{' '}
            {String(s.hours).replace('.', ',')} j = {formatRupiah(rateOf(s.student) * s.hours)}. Ubah manual untuk kelompok. Sesi lunas
            otomatis jadi pemasukan.
          </p>
        </>
      )}
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
