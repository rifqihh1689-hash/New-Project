import { ChevronLeft, ChevronRight, Plus } from 'lucide-react'
import { useState } from 'react'
import { useToday } from '../../app/useToday'
import { PageTop } from '../../components/PageTop'
import { useToast } from '../../components/toast-context'
import { saveTentirSettings, setPaid } from '../../db/tentir'
import { isLate, sessionRange, type CapacityState } from '../../domain/tentir'
import { addDays, DAY_SHORT, formatDateShort, MONTH_NAMES, weekday, weekStart } from '../../domain/time'
import { formatNumber, formatRupiah } from '../../lib/format'
import type { TentirSession } from '../../types'
import { useTentirPage, type TentirPageData } from './data'
import { SessionEditor, type SessionDraft } from './SessionEditor'

const shortDate = (d: string) => `${Number(d.slice(8))} ${MONTH_NAMES[Number(d.slice(5, 7)) - 1].slice(0, 3)}`
const hrs = (h: number) => `${formatNumber(h, 1)} j`

const CAP_TEXT: Record<CapacityState, (d: TentirPageData) => string> = {
  kosong: () => 'Belum ada sesi minggu ini.',
  kurang: (d) => `Kurang ${hrs(d.capacity.min - d.summary.hours)} dari kuota minimum.`,
  pas: () => 'Dalam kuota sampingan.',
  lewat: (d) => `Lewat kapasitas ${hrs(d.summary.hours - d.capacity.max)}: naikkan Rp/jam, bukan jamnya.`,
}

function Tiles({ data }: { data: TentirPageData }) {
  const { summary: s, capacity: cap, last28 } = data
  return (
    <section className="mt-3 grid gap-3 sm:grid-cols-3">
      <div className="card">
        <div className="text-xs text-muted">Jam tentir</div>
        <div className="mt-1 text-[22px] font-semibold tabular-nums">
          {hrs(s.hours)}
          <span className="text-[13px] font-normal text-faint">
            {' '}
            / {cap.min}–{cap.max} j
          </span>
        </div>
        <div className="relative my-2.5 h-1.5 rounded-full bg-track" aria-hidden="true">
          <div
            className="absolute inset-y-0 right-0 rounded-full"
            style={{ left: `${(cap.min / cap.max) * 100}%`, background: 'color-mix(in srgb, var(--color-tentir) 22%, transparent)' }}
          />
          <div
            className={`absolute inset-y-0 left-0 rounded-full ${data.state === 'lewat' ? 'bg-danger' : 'bg-tentir'}`}
            style={{ width: `${Math.min(100, (s.hours / cap.max) * 100)}%` }}
          />
        </div>
        <p className={`text-xs ${data.state === 'lewat' ? 'text-danger' : 'text-muted'}`}>{CAP_TEXT[data.state](data)}</p>
      </div>
      <div className="card">
        <div className="text-xs text-muted">Pemasukan</div>
        <div className="mt-1 text-[22px] font-semibold tabular-nums">{formatRupiah(s.fee)}</div>
        <p className="mt-2 text-xs text-muted">
          {s.count} sesi · lunas {formatRupiah(s.paid)}
          {s.fee > s.paid ? ` · belum ${formatRupiah(s.fee - s.paid)}` : ''}
        </p>
      </div>
      <div className="card">
        <div className="text-xs text-muted">Rp per jam</div>
        <div className="mt-1 text-[22px] font-semibold tabular-nums">{s.perHour ? formatRupiah(s.perHour) : '–'}</div>
        <p className="mt-2 text-xs text-muted">
          {last28.perHour
            ? `Rata-rata 4 minggu ${formatRupiah(last28.perHour)} · ${hrs(last28.hours)}`
            : 'Angka yang dinaikkan, bukan jamnya.'}
        </p>
      </div>
    </section>
  )
}

function Days({ data, today, onAdd }: { data: TentirPageData; today: string; onAdd: (date: string) => void }) {
  const top = Math.max(3, ...data.perDay)
  return (
    <section className="card">
      <h2 className="card-title">Jam per hari</h2>
      <div className="grid grid-cols-7 gap-1.5">
        {data.dates.map((d, i) => {
          const h = data.perDay[i]
          const type = data.dayTypes.get(d)
          const late = data.sessions.some((s) => s.date === d && isLate(s) === true)
          return (
            <button
              key={d}
              type="button"
              onClick={() => onAdd(d)}
              aria-label={`${DAY_SHORT[weekday(d)]} ${shortDate(d)}: ${hrs(h)}${late ? ', lewat 21.00' : ''}. Tambah sesi.`}
              className={`flex flex-col items-center gap-1 rounded-xl py-2 transition hover:bg-surface-2 ${d === today ? 'bg-surface-2' : ''}`}
            >
              <span className="text-[11px] text-muted tabular-nums">{h ? formatNumber(h, 1) : ''}</span>
              <span className="flex h-16 w-5 items-end overflow-hidden rounded-md bg-track">
                <span className={`w-full rounded-md ${late ? 'bg-danger' : 'bg-tentir'}`} style={{ height: `${(h / top) * 100}%` }} />
              </span>
              <span className="text-[11px] font-medium">{DAY_SHORT[weekday(d)]}</span>
              <span className="text-[10px] text-faint">{type === 'jaga' ? 'jaga' : type === 'pasca' ? 'pasca' : Number(d.slice(8))}</span>
            </button>
          )
        })}
      </div>
      <p className="mt-2 text-xs text-faint">
        Ketuk hari untuk menambah sesi. Merah = selesai lewat 21.00 (dihitung lembur). Hari bertentir mendapat quest “Sesi tentir selesai ≤
        21.00”.
      </p>
    </section>
  )
}

function SessionRow({ s, onEdit }: { s: TentirSession; onEdit: () => void }) {
  const toast = useToast()
  const late = isLate(s)
  return (
    <li className="flex items-start gap-2 border-t border-line py-2 first:border-t-0">
      <button type="button" onClick={onEdit} className="flex flex-1 items-start gap-2.5 text-left">
        <span className="grid size-8 shrink-0 place-items-center rounded-full bg-surface-2 text-[11px] font-semibold">{s.student}</span>
        <span className="flex-1 text-[13.5px]">
          {s.topic || 'Tanpa topik'}
          <span className="block text-xs text-muted tabular-nums">
            {sessionRange(s) ?? 'jam mulai kosong'} · {hrs(s.hours)} · {formatRupiah(s.fee)}
            {late && <span className="text-danger"> · lewat 21.00</span>}
          </span>
        </span>
      </button>
      <button
        type="button"
        aria-pressed={s.paid}
        onClick={() =>
          void setPaid(s, !s.paid).then(() =>
            toast({ message: s.paid ? `Sesi ${s.student} belum lunas.` : `Sesi ${s.student} lunas · masuk pemasukan.` }),
          )
        }
        className={`chip py-1 text-xs ${s.paid ? 'border-transparent bg-ok text-white' : ''}`}
      >
        {s.paid ? 'Lunas' : 'Belum'}
      </button>
    </li>
  )
}

function Sessions({ data, onEdit, onAdd }: { data: TentirPageData; onEdit: (s: TentirSession) => void; onAdd: () => void }) {
  const byDate = data.dates.map((d) => ({ d, list: data.sessions.filter((s) => s.date === d) })).filter((g) => g.list.length)
  return (
    <section className="card">
      <h2 className="card-title">
        Sesi <span className="text-[13px] font-medium text-faint">{data.sessions.length}</span>
        <button type="button" onClick={onAdd} className="btn-primary -my-1 ml-auto py-1.5">
          <Plus size={15} aria-hidden="true" /> Sesi
        </button>
      </h2>
      {!byDate.length && <p className="text-[13px] text-muted">Belum ada sesi di minggu ini.</p>}
      {byDate.map((g) => (
        <div key={g.d} className="mb-2">
          <div className="text-xs font-medium tracking-wide text-faint uppercase">{formatDateShort(g.d)}</div>
          <ul>
            {g.list.map((s) => (
              <SessionRow key={s.id} s={s} onEdit={() => onEdit(s)} />
            ))}
          </ul>
        </div>
      ))}
    </section>
  )
}

function Unpaid({ data, onEdit }: { data: TentirPageData; onEdit: (s: TentirSession) => void }) {
  if (!data.unpaid.length) return null
  const total = data.unpaid.reduce((a, s) => a + s.fee, 0)
  return (
    <section className="card">
      <h2 className="card-title">
        Belum dibayar <span className="ml-auto text-[13px] font-medium text-uang tabular-nums">{formatRupiah(total)}</span>
      </h2>
      <ul>
        {data.unpaid.map((s) => (
          <SessionRow key={s.id} s={s} onEdit={() => onEdit(s)} />
        ))}
      </ul>
    </section>
  )
}

function Settings({ data }: { data: TentirPageData }) {
  const toast = useToast()
  const save = (change: Parameters<typeof saveTentirSettings>[0]) =>
    void saveTentirSettings(change).catch((e: Error) => toast({ message: e.message, tone: 'error' }))
  const num = (v: string) => Number(v.replace(/[^\d,.]/g, '').replace(',', '.'))
  return (
    <section className="card">
      <h2 className="card-title">Setelan tentir</h2>
      <div className="grid grid-cols-3 gap-2">
        <label className="text-xs text-muted">
          Tarif / jam
          <input
            className="field mt-1"
            inputMode="numeric"
            defaultValue={data.rate.toLocaleString('id-ID')}
            onBlur={(e) => {
              const v = Number(e.target.value.replace(/[^\d]/g, ''))
              if (v >= 10_000) save({ rate: v })
            }}
          />
        </label>
        <label className="text-xs text-muted">
          Kuota min (j)
          <input
            className="field mt-1"
            inputMode="decimal"
            defaultValue={data.capacity.min}
            onBlur={(e) => {
              const v = num(e.target.value)
              if (v >= 0 && v <= 60) save({ min: v })
            }}
          />
        </label>
        <label className="text-xs text-muted">
          Kuota maks (j)
          <input
            className="field mt-1"
            inputMode="decimal"
            defaultValue={data.capacity.max}
            onBlur={(e) => {
              const v = num(e.target.value)
              if (v > 0 && v <= 60) save({ max: v })
            }}
          />
        </label>
      </div>
      <p className="mt-2 text-xs text-faint">
        Tarif 1:1 bawaan Rp85.000/jam. Kuota sampingan 9–15 j/minggu dipakai juga di Beranda dan Muhasabah. Catat cepat: “AB 2j anatomi
        19.00 lunas”.
      </p>
    </section>
  )
}

export function TentirPage() {
  const today = useToday()
  const [monday, setMonday] = useState(() => weekStart(today))
  const data = useTentirPage(monday, today)
  const [editing, setEditing] = useState<SessionDraft | null>(null)
  const thisWeek = monday === weekStart(today)
  const newOn = (date: string) => setEditing({ date })
  return (
    <>
      <PageTop title="Tentir" />
      <h1 className="mt-4 text-[26px] font-semibold tracking-tight md:hidden">Tentir</h1>
      <section className="mt-3 flex items-center gap-1 md:mt-[26px]">
        <button type="button" className="btn-ghost p-2" onClick={() => setMonday(addDays(monday, -7))} aria-label="Minggu sebelumnya">
          <ChevronLeft size={18} aria-hidden="true" />
        </button>
        <div className="min-w-[150px] text-center">
          <div className="font-serif text-xl">{thisWeek ? 'Minggu ini' : `${shortDate(monday)} – ${shortDate(addDays(monday, 6))}`}</div>
          <div className="text-xs text-muted">
            {shortDate(monday)} – {shortDate(addDays(monday, 6))}
          </div>
        </div>
        <button type="button" className="btn-ghost p-2" onClick={() => setMonday(addDays(monday, 7))} aria-label="Minggu berikutnya">
          <ChevronRight size={18} aria-hidden="true" />
        </button>
      </section>
      {data && (
        <>
          <Tiles data={data} />
          <div className="stagger mt-3 grid items-start gap-3 lg:grid-cols-2">
            <Days data={data} today={today} onAdd={newOn} />
            <Sessions data={data} onEdit={setEditing} onAdd={() => newOn(thisWeek ? today : monday)} />
            <Unpaid data={data} onEdit={setEditing} />
            <Settings data={data} />
          </div>
          <SessionEditor draft={editing} rate={data.rate} students={data.students} onClose={() => setEditing(null)} />
        </>
      )}
    </>
  )
}
