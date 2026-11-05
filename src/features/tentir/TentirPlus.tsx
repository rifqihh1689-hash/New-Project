import { useLiveQuery } from 'dexie-react-hooks'
import { ChevronLeft, ChevronRight, ClipboardCopy, ExternalLink, MessageCircle, Plus, Trash2 } from 'lucide-react'
import { useState } from 'react'
import { Sheet } from '../../components/Sheet'
import { useToast } from '../../components/toast-context'
import { db } from '../../db/db'
import {
  deleteMaterial,
  newMaterial,
  newPackage,
  newStudent,
  restoreMaterial,
  saveMaterial,
  savePackage,
  saveStudent,
} from '../../db/tentirPlus'
import { detectPatientIdentity } from '../../domain/phi'
import { sessionEnd, summarize } from '../../domain/tentir'
import { fillTemplate, freeSlots, longDate, MESSAGE_TEMPLATES, packageUsage, slotsMessage } from '../../domain/tentirPlus'
import { addMonths, formatMonth, monthOf } from '../../domain/time'
import { formatRupiah } from '../../lib/format'
import type { Material, Student, TentirPackage } from '../../types'
import type { TentirPageData } from './data'

const wa = (text: string) => `https://wa.me/?text=${encodeURIComponent(text)}`
const clock = (m: number) => `${String(Math.floor(m / 60) % 24).padStart(2, '0')}.${String(m % 60).padStart(2, '0')}`

function useCopy() {
  const toast = useToast()
  return async (text: string) => {
    try {
      await navigator.clipboard.writeText(text)
      toast({ message: 'Pesan disalin.' })
    } catch {
      toast({ message: 'Tidak bisa menyalin otomatis; pilih teksnya lalu salin.', tone: 'error' })
    }
  }
}

// ---------- Murid & paket ----------

export function StudentsTab({ data, today }: { data: TentirPageData; today: string }) {
  const [student, setStudent] = useState<Student | null>(null)
  const [pkg, setPkg] = useState<TentirPackage | null>(null)
  const [message, setMessage] = useState<string | null>(null)
  const known = new Set(data.studentRows.map((s) => s.initials))
  const orphan = [...new Set(data.allSessions.map((s) => s.student))].filter((i) => i && !known.has(i))
  const rows = data.studentRows.filter((s) => !s.archived).sort((a, b) => a.initials.localeCompare(b.initials))
  return (
    <div className="stagger mt-3 grid items-start gap-3 lg:grid-cols-2">
      <section className="card lg:col-span-2">
        <h2 className="card-title">
          Murid <span className="text-[13px] font-medium text-faint">{rows.length}</span>
          <button type="button" className="btn-primary -my-1 ml-auto py-1.5" onClick={() => setStudent(newStudent())}>
            <Plus size={15} aria-hidden="true" /> Murid
          </button>
        </h2>
        {!rows.length && !orphan.length && (
          <p className="text-[13px] text-muted">Belum ada murid. Cukup inisial, tanpa data pribadi lain.</p>
        )}
        <ul>
          {rows.map((s) => {
            const mine = data.packages.filter((p) => p.student === s.initials && !p.archived)
            const sessions = data.allSessions.filter((x) => x.student === s.initials)
            const unpaid = sessions.filter((x) => !x.paid && x.date <= today)
            return (
              <li key={s.id} className="border-t border-line py-2.5 first:border-t-0">
                <div className="flex items-start gap-2.5">
                  <span className="grid size-9 shrink-0 place-items-center rounded-full bg-surface-2 text-xs font-semibold">
                    {s.initials}
                  </span>
                  <button type="button" className="flex-1 text-left text-[13.5px]" onClick={() => setStudent(s)}>
                    {[s.cohort, s.block].filter(Boolean).join(' · ') || 'Tanpa keterangan'}
                    <span className="block text-xs text-muted tabular-nums">
                      {sessions.length} sesi · {formatRupiah(summarize(sessions).fee)}
                      {s.rate ? ` · tarif ${formatRupiah(s.rate)}/j` : ''}
                      {unpaid.length ? <span className="text-uang"> · {unpaid.length} belum dibayar</span> : ''}
                    </span>
                  </button>
                  <button
                    type="button"
                    className="btn-ghost p-2"
                    aria-label={`Pesan untuk ${s.initials}`}
                    onClick={() => setMessage(s.initials)}
                  >
                    <MessageCircle size={16} aria-hidden="true" />
                  </button>
                </div>
                <div className="mt-1.5 ml-11 flex flex-wrap gap-1.5">
                  {mine.map((p) => {
                    const u = packageUsage(p, data.allSessions)
                    return (
                      <button
                        key={p.id}
                        type="button"
                        className={`chip py-1 text-xs ${u.done ? 'opacity-60' : ''}`}
                        onClick={() => setPkg(p)}
                      >
                        {p.name} · sisa {u.left}/{p.sessions}
                        {!p.paid && <span className="text-uang">belum lunas</span>}
                      </button>
                    )
                  })}
                  <button type="button" className="chip py-1 text-xs" onClick={() => setPkg(newPackage(s.initials, today))}>
                    <Plus size={12} aria-hidden="true" /> Paket
                  </button>
                </div>
              </li>
            )
          })}
        </ul>
        {orphan.length > 0 && (
          <p className="mt-2 text-xs text-muted">
            Dari sesi:{' '}
            {orphan.map((i) => (
              <button key={i} type="button" className="chip mr-1 py-0.5 text-xs" onClick={() => setStudent(newStudent(i))}>
                <Plus size={12} aria-hidden="true" /> {i}
              </button>
            ))}
          </p>
        )}
      </section>
      <StudentSheet student={student} onClose={() => setStudent(null)} />
      <PackageSheet pkg={pkg} sessions={data.allSessions} onClose={() => setPkg(null)} />
      <MessageSheet initials={message} data={data} today={today} onClose={() => setMessage(null)} />
    </div>
  )
}

function StudentSheet({ student, onClose }: { student: Student | null; onClose: () => void }) {
  return (
    <Sheet open={!!student} title={student?.initials ? `Murid ${student.initials}` : 'Murid baru'} onClose={onClose}>
      {student && <StudentBody key={student.id} initial={student} onClose={onClose} />}
    </Sheet>
  )
}

function StudentBody({ initial, onClose }: { initial: Student; onClose: () => void }) {
  const toast = useToast()
  const [s, setS] = useState(initial)
  const phi = detectPatientIdentity(`${s.cohort} ${s.block} ${s.note}`)
  const save = async (archived = s.archived) => {
    try {
      await saveStudent({ ...s, archived })
      onClose()
    } catch (e) {
      toast({ message: (e as Error).message, tone: 'error' })
    }
  }
  return (
    <div className="grid gap-3">
      <div className="grid grid-cols-[6rem_1fr] gap-2">
        <label className="text-xs text-muted">
          Inisial
          <input
            className="field mt-1 uppercase"
            value={s.initials}
            maxLength={6}
            onChange={(e) => setS({ ...s, initials: e.target.value })}
          />
        </label>
        <label className="text-xs text-muted">
          Angkatan / semester
          <input
            className="field mt-1"
            value={s.cohort}
            maxLength={30}
            onChange={(e) => setS({ ...s, cohort: e.target.value })}
            placeholder="mis. Sem 5"
          />
        </label>
      </div>
      <label className="text-xs text-muted">
        Blok yang ditentir
        <input
          className="field mt-1"
          value={s.block}
          maxLength={60}
          onChange={(e) => setS({ ...s, block: e.target.value })}
          placeholder="mis. Blok 12 Muskuloskeletal"
        />
      </label>
      <label className="text-xs text-muted">
        Tarif khusus / jam (kosong = tarif umum)
        <input
          className="field mt-1"
          inputMode="numeric"
          value={s.rate ? s.rate.toLocaleString('id-ID') : ''}
          onChange={(e) => setS({ ...s, rate: Number(e.target.value.replace(/[^\d]/g, '')) || null })}
          placeholder="mis. 60.000 untuk kelompok"
        />
      </label>
      <label className="text-xs text-muted">
        Catatan
        <input
          className="field mt-1"
          value={s.note}
          maxLength={120}
          onChange={(e) => setS({ ...s, note: e.target.value })}
          placeholder="mis. lemah di anatomi"
        />
      </label>
      {phi && <p className="text-xs text-danger">Mirip identitas pasien ({phi}).</p>}
      <div className="flex gap-2">
        {initial.initials && (
          <button type="button" className="btn-ghost border border-line" onClick={() => void save(!initial.archived)}>
            {initial.archived ? 'Aktifkan' : 'Arsipkan'}
          </button>
        )}
        <button type="button" className="btn-primary flex-1 py-3" disabled={!s.initials.trim() || !!phi} onClick={() => void save()}>
          Simpan
        </button>
      </div>
    </div>
  )
}

function PackageSheet({
  pkg,
  sessions,
  onClose,
}: {
  pkg: TentirPackage | null
  sessions: TentirPageData['allSessions']
  onClose: () => void
}) {
  return (
    <Sheet open={!!pkg} title={pkg?.name ? `Paket ${pkg.name}` : `Paket baru · ${pkg?.student ?? ''}`} onClose={onClose}>
      {pkg && <PackageBody key={pkg.id} initial={pkg} sessions={sessions} onClose={onClose} />}
    </Sheet>
  )
}

function PackageBody({
  initial,
  sessions,
  onClose,
}: {
  initial: TentirPackage
  sessions: TentirPageData['allSessions']
  onClose: () => void
}) {
  const toast = useToast()
  const [p, setP] = useState(initial)
  const u = packageUsage(p, sessions)
  const save = async (archived = p.archived) => {
    try {
      await savePackage({ ...p, archived })
      toast({ message: p.paid && p.price ? `Paket tersimpan · ${formatRupiah(p.price)} masuk pemasukan.` : 'Paket tersimpan.' })
      onClose()
    } catch (e) {
      toast({ message: (e as Error).message, tone: 'error' })
    }
  }
  return (
    <div className="grid gap-3">
      <label className="text-xs text-muted">
        Nama paket
        <input
          className="field mt-1"
          value={p.name}
          maxLength={60}
          onChange={(e) => setP({ ...p, name: e.target.value })}
          placeholder="mis. Blok 12 (4 sesi)"
        />
      </label>
      <div className="grid grid-cols-2 gap-2">
        <label className="text-xs text-muted">
          Jumlah sesi
          <input
            className="field mt-1"
            inputMode="numeric"
            value={p.sessions || ''}
            onChange={(e) => setP({ ...p, sessions: Number(e.target.value.replace(/\D/g, '')) || 0 })}
          />
        </label>
        <label className="text-xs text-muted">
          Harga paket (Rp)
          <input
            className="field mt-1"
            inputMode="numeric"
            value={p.price ? p.price.toLocaleString('id-ID') : ''}
            onChange={(e) => setP({ ...p, price: Number(e.target.value.replace(/[^\d]/g, '')) || 0 })}
          />
        </label>
      </div>
      <div className="grid grid-cols-[auto_1fr] items-end gap-3">
        <label className="flex items-center gap-2 pb-2.5 text-[13.5px]">
          <input
            type="checkbox"
            className="size-4 accent-current"
            checked={p.paid}
            onChange={(e) => setP({ ...p, paid: e.target.checked })}
          />
          Lunas
        </label>
        <label className="text-xs text-muted">
          Tanggal bayar
          <input
            className="field mt-1"
            type="date"
            value={p.paidDate ?? ''}
            onChange={(e) => setP({ ...p, paidDate: e.target.value || null })}
          />
        </label>
      </div>
      <p className="text-xs text-faint">
        Terpakai {u.used} dari {p.sessions || 0} sesi. Paket lunas dicatat sekali sebagai pemasukan; sesi yang memakai paket bernilai Rp0
        supaya tidak terhitung dua kali.
        {p.sessions > 0 && p.price > 0 ? ` Setara ${formatRupiah(Math.round(p.price / p.sessions))}/sesi.` : ''}
      </p>
      <div className="flex gap-2">
        {initial.name && (
          <button type="button" className="btn-ghost border border-line" onClick={() => void save(!initial.archived)}>
            {initial.archived ? 'Aktifkan' : 'Arsipkan'}
          </button>
        )}
        <button
          type="button"
          className="btn-primary flex-1 py-3"
          disabled={!p.name.trim() || !(p.sessions >= 1)}
          onClick={() => void save()}
        >
          Simpan paket
        </button>
      </div>
    </div>
  )
}

function MessageSheet({
  initials,
  data,
  today,
  onClose,
}: {
  initials: string | null
  data: TentirPageData
  today: string
  onClose: () => void
}) {
  return (
    <Sheet open={!!initials} title={initials ? `Pesan untuk ${initials}` : ''} onClose={onClose}>
      {initials && <MessageBody initials={initials} data={data} today={today} />}
    </Sheet>
  )
}

function MessageBody({ initials, data, today }: { initials: string; data: TentirPageData; today: string }) {
  const copy = useCopy()
  const sessions = data.allSessions.filter((s) => s.student === initials)
  const next = sessions.filter((s) => s.date >= today).sort((a, b) => a.date.localeCompare(b.date))[0]
  const unpaid = sessions.filter((s) => !s.paid && s.date <= today)
  const pkg = data.packages.find((p) => p.student === initials && !p.archived && !packageUsage(p, data.allSessions).done)
  const end = next ? sessionEnd(next) : null
  const vars = {
    inisial: initials,
    topik: next?.topic || 'berikutnya',
    tanggal: next ? longDate(next.date) : '(tanggal)',
    jam: next?.start ?? '(jam)',
    selesai: end != null ? clock(end) : '(selesai)',
    jumlah: String(unpaid.length),
    total: formatRupiah(unpaid.reduce((a, s) => a + s.fee, 0)),
    paket: pkg?.name ?? '(paket)',
    sisa: pkg ? String(packageUsage(pkg, data.allSessions).left) : '0',
  }
  return (
    <div className="grid gap-3">
      {MESSAGE_TEMPLATES.map((t) => {
        const text = fillTemplate(t.text, vars)
        return (
          <div key={t.key} className="rounded-xl border border-line p-3">
            <div className="mb-1 text-xs font-medium text-muted">{t.label}</div>
            <p className="text-[13.5px] whitespace-pre-line">{text}</p>
            <div className="mt-2 flex gap-2">
              <button type="button" className="btn-ghost border border-line py-1.5" onClick={() => void copy(text)}>
                <ClipboardCopy size={14} aria-hidden="true" /> Salin
              </button>
              <a className="btn-ghost border border-line py-1.5" href={wa(text)} target="_blank" rel="noreferrer">
                <MessageCircle size={14} aria-hidden="true" /> WhatsApp
              </a>
            </div>
          </div>
        )
      })}
      <p className="text-xs text-faint">Nomor murid tidak disimpan di Qawwam; tombol WhatsApp membuka pilihan kontak.</p>
    </div>
  )
}

// ---------- Slot kosong ----------

export function SlotsTab({ data, today }: { data: TentirPageData; today: string }) {
  const copy = useCopy()
  const [month, setMonth] = useState(() => monthOf(today))
  const [start, setStart] = useState('19.00')
  const [end, setEnd] = useState(data.limit ?? '21.00')
  const days = useLiveQuery(() => db.days.where('date').between(`${month}-01`, `${month}-31`, true, true).toArray(), [month])
  if (!days) return null
  const types = new Map(days.map((d) => [d.date, d.type]))
  const opts = { start, end }
  const slots = freeSlots(month, today, (d) => types.get(d) ?? null, data.allSessions, opts)
  const text = slotsMessage(month, slots, opts)
  const jaga = days.filter((d) => d.type === 'jaga').length
  return (
    <div className="stagger mt-3 grid items-start gap-3 lg:grid-cols-2">
      <section className="card">
        <h2 className="card-title">Slot kosong</h2>
        <div className="flex items-center gap-1">
          <button type="button" className="btn-ghost p-2" onClick={() => setMonth(addMonths(month, -1))} aria-label="Bulan sebelumnya">
            <ChevronLeft size={18} aria-hidden="true" />
          </button>
          <div className="min-w-[150px] text-center font-serif text-lg">{formatMonth(month)}</div>
          <button type="button" className="btn-ghost p-2" onClick={() => setMonth(addMonths(month, 1))} aria-label="Bulan berikutnya">
            <ChevronRight size={18} aria-hidden="true" />
          </button>
        </div>
        <div className="mt-2 grid grid-cols-2 gap-2">
          <label className="text-xs text-muted">
            Mulai
            <input
              className="field mt-1"
              inputMode="numeric"
              value={start}
              onChange={(e) => setStart(e.target.value)}
              aria-label="Jam mulai slot"
            />
          </label>
          <label className="text-xs text-muted">
            Selesai
            <input
              className="field mt-1"
              inputMode="numeric"
              value={end}
              onChange={(e) => setEnd(e.target.value)}
              aria-label="Jam selesai slot"
            />
          </label>
        </div>
        <p className="mt-3 text-[13px] text-muted">
          <b className="font-semibold text-text">{slots.length} slot</b> · tanpa {jaga} malam jaga & pasca-jaga, tanpa bentrok sesi lain.
          {!jaga && ' Jadwal jaga bulan ini belum diisi di Kalender.'}
        </p>
        <div className="mt-2 flex flex-wrap gap-1">
          {slots.map((d) => (
            <span key={d} className="rounded-md bg-surface-2 px-1.5 py-0.5 text-xs tabular-nums">
              {Number(d.slice(8))}
            </span>
          ))}
        </div>
      </section>
      <section className="card">
        <h2 className="card-title">Pesan untuk murid</h2>
        <p className="rounded-xl bg-surface-2 p-3 text-[13.5px] whitespace-pre-line">{text}</p>
        <div className="mt-3 flex gap-2">
          <button type="button" className="btn-primary" onClick={() => void copy(text)}>
            <ClipboardCopy size={15} aria-hidden="true" /> Salin
          </button>
          <a className="btn-ghost border border-line" href={wa(text)} target="_blank" rel="noreferrer">
            <MessageCircle size={15} aria-hidden="true" /> WhatsApp
          </a>
        </div>
        <p className="mt-2 text-xs text-faint">
          Kirim sekali di awal bulan supaya murid memilih sendiri, dan jadwal jarang diubah karena jaga.
        </p>
      </section>
    </div>
  )
}

// ---------- Materi ----------

export function MaterialsTab({ data }: { data: TentirPageData }) {
  const toast = useToast()
  const [m, setM] = useState<Material>(() => newMaterial())
  const phi = detectPatientIdentity(`${m.title} ${m.block} ${m.note}`)
  const blocks = [...new Set([...data.materials.map((x) => x.block), ...data.studentRows.map((s) => s.block).filter(Boolean)])]
  const add = async () => {
    try {
      await saveMaterial(m)
      setM(newMaterial(m.block))
    } catch (e) {
      toast({ message: (e as Error).message, tone: 'error' })
    }
  }
  const remove = async (id: string) => {
    const removed = await deleteMaterial(id)
    if (removed) toast({ message: 'Materi dihapus.', action: { label: 'Urungkan', onClick: () => void restoreMaterial(removed) } })
  }
  const groups = [...new Set(data.materials.map((x) => x.block))]
  return (
    <div className="stagger mt-3 grid items-start gap-3 lg:grid-cols-2">
      <section className="card">
        <h2 className="card-title">Tambah materi</h2>
        <form
          className="grid gap-2"
          onSubmit={(e) => {
            e.preventDefault()
            void add()
          }}
        >
          <input
            className="field"
            list="tentir-blocks"
            value={m.block}
            onChange={(e) => setM({ ...m, block: e.target.value })}
            placeholder="Blok, mis. Blok 12 Muskuloskeletal"
            aria-label="Blok"
          />
          <datalist id="tentir-blocks">
            {blocks.map((b) => (
              <option key={b} value={b} />
            ))}
          </datalist>
          <input
            className="field"
            value={m.title}
            onChange={(e) => setM({ ...m, title: e.target.value })}
            placeholder="Judul, mis. Fraktur & dislokasi"
            aria-label="Judul materi"
            maxLength={80}
          />
          <input
            className="field"
            value={m.link}
            onChange={(e) => setM({ ...m, link: e.target.value })}
            placeholder="Tautan (opsional), https://…"
            aria-label="Tautan materi"
            inputMode="url"
          />
          <input
            className="field"
            value={m.note}
            onChange={(e) => setM({ ...m, note: e.target.value })}
            placeholder="Catatan (opsional)"
            aria-label="Catatan materi"
            maxLength={120}
          />
          {phi && <p className="text-xs text-danger">Mirip identitas pasien ({phi}).</p>}
          <button type="submit" className="btn-primary" disabled={!m.title.trim() || !!phi}>
            <Plus size={15} aria-hidden="true" /> Simpan materi
          </button>
        </form>
        <p className="mt-2 text-xs text-faint">
          Judul materi muncul sebagai saran topik saat mencatat sesi, dan bisa dipakai lagi tahun berikutnya.
        </p>
      </section>
      <section className="card">
        <h2 className="card-title">
          Perpustakaan <span className="text-[13px] font-medium text-faint">{data.materials.length}</span>
        </h2>
        {!groups.length && <p className="text-[13px] text-muted">Belum ada materi.</p>}
        {groups.map((g) => (
          <div key={g} className="mb-3">
            <div className="mb-1 text-xs font-medium tracking-wide text-faint uppercase">{g}</div>
            <ul>
              {data.materials
                .filter((x) => x.block === g)
                .map((x) => (
                  <li key={x.id} className="flex items-center gap-2 border-t border-line py-1.5 text-[13.5px] first:border-t-0">
                    <span className="flex-1">
                      {x.title}
                      {x.note && <span className="block text-xs text-muted">{x.note}</span>}
                    </span>
                    {x.link && (
                      <a href={x.link} target="_blank" rel="noreferrer" className="btn-ghost p-1.5" aria-label={`Buka ${x.title}`}>
                        <ExternalLink size={14} aria-hidden="true" />
                      </a>
                    )}
                    <button type="button" className="btn-ghost p-1.5" onClick={() => void remove(x.id)} aria-label={`Hapus ${x.title}`}>
                      <Trash2 size={14} aria-hidden="true" />
                    </button>
                  </li>
                ))}
            </ul>
          </div>
        ))}
      </section>
    </div>
  )
}
