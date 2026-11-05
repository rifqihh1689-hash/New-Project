import { ChevronLeft, ChevronRight, Moon, Plus, Trash2 } from 'lucide-react'
import { useLiveQuery } from 'dexie-react-hooks'
import { useState } from 'react'
import { routeHref } from '../../app/router'
import { useToday } from '../../app/useToday'
import { PageTop } from '../../components/PageTop'
import { Sheet } from '../../components/Sheet'
import { TimeField } from '../../components/TimeField'
import { useToast } from '../../components/toast-context'
import { deleteEvent, restoreEvent, saveEvent, setJaga } from '../../db/calendar'
import { moveTasks } from '../../db/daily'
import { db } from '../../db/db'
import { currentPhase, usePhases } from '../../db/structure'
import { DAY_TYPE_LABELS, suggestDayType } from '../../domain/dayType'
import { detectPatientIdentity } from '../../domain/phi'
import { addDays, addMonths, DAY_SHORT, formatDateLong, formatDateShort, formatMonth, monthOf } from '../../domain/time'
import { DayTypePicker } from '../beranda/DayTypePicker'
import { DAY_TYPE_COLORS } from '../beranda/dayTypeColors'
import { useKalender, type KalenderData } from './data'

const WEEK = [1, 2, 3, 4, 5, 6, 0]

function Grid({ data, today, jagaMode, onPick }: { data: KalenderData; today: string; jagaMode: boolean; onPick: (d: string) => void }) {
  return (
    <div>
      <div className="mb-1 grid grid-cols-7 text-center text-[11px] text-faint">
        {WEEK.map((w) => (
          <span key={w}>{DAY_SHORT[w]}</span>
        ))}
      </div>
      <div className="grid grid-cols-7 gap-1">
        {data.grid.map((d) => {
          const inMonth = monthOf(d) === data.month
          const type = data.types(d)
          const events = data.eventCount.get(d) ?? 0
          const tentir = data.tentirCount.get(d) ?? 0
          const label = `${formatDateLong(d)}${type ? `, ${DAY_TYPE_LABELS[type]}` : ''}${events ? `, ${events} agenda` : ''}`
          return (
            <button
              key={d}
              type="button"
              onClick={() => onPick(d)}
              aria-label={label}
              aria-pressed={jagaMode ? type === 'jaga' : undefined}
              className={`relative flex aspect-square min-h-11 flex-col items-center justify-center rounded-xl text-[13px] tabular-nums transition active:scale-95 ${
                inMonth ? '' : 'opacity-35'
              } ${d === today ? 'ring-[1.5px] ring-text' : ''} ${type === 'jaga' ? 'font-semibold text-white' : 'bg-surface-2'}`}
              style={type === 'jaga' ? { background: DAY_TYPE_COLORS.jaga } : undefined}
            >
              {Number(d.slice(8))}
              <span className="absolute bottom-1 flex gap-0.5" aria-hidden="true">
                {type && type !== 'jaga' && <i className="size-1.5 rounded-full" style={{ background: DAY_TYPE_COLORS[type] }} />}
                {events > 0 && <i className={`size-1.5 rounded-full ${type === 'jaga' ? 'bg-white' : 'bg-text'}`} />}
                {tentir > 0 && <i className="size-1.5 rounded-full bg-tentir" />}
              </span>
            </button>
          )
        })}
      </div>
      <div className="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-[11px] text-muted">
        {(['stase', 'jaga', 'pasca', 'libur'] as const).map((t) => (
          <span key={t} className="flex items-center gap-1">
            <i className="size-2 rounded-full" style={{ background: DAY_TYPE_COLORS[t] }} aria-hidden="true" />
            {DAY_TYPE_LABELS[t]}
          </span>
        ))}
        <span className="flex items-center gap-1">
          <i className="size-2 rounded-full bg-text" aria-hidden="true" /> agenda
        </span>
        <span className="flex items-center gap-1">
          <i className="size-2 rounded-full bg-tentir" aria-hidden="true" /> tentir
        </span>
      </div>
    </div>
  )
}

function DaySheet({ date, onClose }: { date: string | null; onClose: () => void }) {
  return (
    <Sheet open={!!date} title={date ? formatDateLong(date) : ''} onClose={onClose}>
      {date && <DayBody key={date} date={date} onClose={onClose} />}
    </Sheet>
  )
}

function DayBody({ date, onClose }: { date: string; onClose: () => void }) {
  const toast = useToast()
  const phases = usePhases()
  const info = useLiveQuery(async () => {
    const [day, prev, events, tasks, sessions] = await Promise.all([
      db.days.get(`#day:${date}`),
      db.days.get(`#day:${addDays(date, -1)}`),
      db.events.where('date').equals(date).toArray(),
      db.tasks.where('date').equals(date).toArray(),
      db.tentirSessions.where('date').equals(date).toArray(),
    ])
    return { day, prev, events: events.sort((a, b) => (a.start ?? '99').localeCompare(b.start ?? '99')), tasks, sessions }
  }, [date])
  const [title, setTitle] = useState('')
  const [start, setStart] = useState('')
  const [end, setEnd] = useState('')
  const phi = title.trim() ? detectPatientIdentity(title) : null
  if (!info) return null
  const add = async () => {
    try {
      await saveEvent({ title, date, start: start || null, end: end || null })
      setTitle('')
      setStart('')
      setEnd('')
    } catch (e) {
      toast({ message: (e as Error).message, tone: 'error' })
    }
  }
  const remove = async (id: string) => {
    const ev = await deleteEvent(id)
    if (ev) toast({ message: 'Agenda dihapus.', action: { label: 'Urungkan', onClick: () => void restoreEvent(ev) } })
  }
  const open = info.tasks.filter((t) => !t.done).length
  return (
    <div className="grid gap-4">
      <DayTypePicker
        date={date}
        value={info.day?.type ?? null}
        suggested={suggestDayType(date, info.prev?.type ?? null)}
        phase={currentPhase(phases ?? [], date)}
      />
      <div>
        <span className="label">Agenda</span>
        {!info.events.length && <p className="text-[13px] text-faint">Belum ada agenda.</p>}
        <ul>
          {info.events.map((ev) => (
            <li key={ev.id} className="flex items-center gap-2 border-t border-line py-2 text-[13.5px] first:border-t-0">
              <span className="w-[86px] shrink-0 text-xs text-muted tabular-nums">
                {ev.start ? `${ev.start}${ev.end ? `–${ev.end}` : ''}` : 'sepanjang hari'}
              </span>
              <span className="flex-1">{ev.title}</span>
              <button type="button" className="btn-ghost p-1.5" onClick={() => void remove(ev.id)} aria-label={`Hapus agenda ${ev.title}`}>
                <Trash2 size={14} aria-hidden="true" />
              </button>
            </li>
          ))}
        </ul>
        <form
          className="mt-2 grid grid-cols-[1fr_4.5rem_4.5rem_auto] gap-1.5"
          onSubmit={(e) => {
            e.preventDefault()
            void add()
          }}
        >
          <input
            className="field py-2"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="mis. Ujian OSCE"
            aria-label="Judul agenda"
            maxLength={80}
          />
          <TimeField className="field px-2 py-2" value={start} onChange={setStart} placeholder="08.00" aria-label="Jam mulai" />
          <TimeField className="field px-2 py-2" value={end} onChange={setEnd} placeholder="10.00" aria-label="Jam selesai" />
          <button type="submit" className="btn-primary px-3" disabled={!title.trim() || !!phi} aria-label="Tambah agenda">
            <Plus size={16} aria-hidden="true" />
          </button>
        </form>
        {phi && <p className="mt-1 text-xs text-danger">Mirip identitas pasien ({phi}).</p>}
      </div>
      <div className="flex flex-wrap gap-2 text-[13px]">
        <a href={routeHref('tugas', date)} onClick={onClose} className="chip">
          {info.tasks.length ? `${open} tugas belum selesai dari ${info.tasks.length}` : 'Tambah tugas'} →
        </a>
        {info.sessions.length > 0 && (
          <a href={routeHref('tentir')} onClick={onClose} className="chip">
            {info.sessions.length} sesi tentir →
          </a>
        )}
      </div>
    </div>
  )
}

function Upcoming({ data, today, onPick }: { data: KalenderData; today: string; onPick: (d: string) => void }) {
  const list = data.events.filter(
    (e) => monthOf(e.date) === data.month && e.date >= (monthOf(today) === data.month ? today : `${data.month}-01`),
  )
  const stase = data.chapters
  return (
    <section className="card">
      <h2 className="card-title">Agenda & stase</h2>
      {stase.length > 0 && (
        <ul className="mb-3 grid gap-1 text-[13px]">
          {stase.map((c) => (
            <li key={c.id} className="flex gap-2">
              <span className="flex-1 font-medium">{c.name}</span>
              <span className="text-muted tabular-nums">
                {formatDateShort(c.start)} – {formatDateShort(c.end)}
                {c.masuk || c.pulang ? ` · ${c.masuk ?? '?'}–${c.pulang ?? '?'}` : ''}
              </span>
            </li>
          ))}
        </ul>
      )}
      {!list.length && <p className="text-[13px] text-muted">Tidak ada agenda tersisa bulan ini. Ketuk tanggal untuk menambah.</p>}
      <ul>
        {list.map((ev) => (
          <li key={ev.id}>
            <button
              type="button"
              onClick={() => onPick(ev.date)}
              className="flex w-full gap-2 border-t border-line py-2 text-left text-[13.5px] first:border-t-0"
            >
              <span className="w-[92px] shrink-0 text-xs text-muted">
                {formatDateShort(ev.date)}
                {ev.start ? ` · ${ev.start}` : ''}
              </span>
              <span className="flex-1">{ev.title}</span>
            </button>
          </li>
        ))}
      </ul>
    </section>
  )
}

export function KalenderPage() {
  const today = useToday()
  const toast = useToast()
  const [month, setMonth] = useState(() => monthOf(today))
  const [jagaMode, setJagaMode] = useState(false)
  const [picked, setPicked] = useState<string | null>(null)
  const data = useKalender(month)
  const pick = async (d: string) => {
    if (!jagaMode || !data) return setPicked(d)
    const on = data.types(d) !== 'jaga'
    const moved = await setJaga(d, on)
    if (moved.length)
      toast({
        message: `${moved.length} tugas di hari pasca-jaga dipindah ke ${formatDateShort(addDays(d, 2))}.`,
        tone: 'info',
        action: { label: 'Urungkan', onClick: () => void moveTasks(moved, addDays(d, 1)) },
      })
  }
  return (
    <>
      <PageTop title="Kalender" />
      <h1 className="mt-4 text-[26px] font-semibold tracking-tight md:hidden">Kalender</h1>
      <section className="mt-3 flex flex-wrap items-center gap-2 md:mt-[26px]">
        <div className="flex items-center gap-1">
          <button type="button" className="btn-ghost p-2" onClick={() => setMonth(addMonths(month, -1))} aria-label="Bulan sebelumnya">
            <ChevronLeft size={18} aria-hidden="true" />
          </button>
          <div className="min-w-[150px] text-center font-serif text-xl">{formatMonth(month)}</div>
          <button type="button" className="btn-ghost p-2" onClick={() => setMonth(addMonths(month, 1))} aria-label="Bulan berikutnya">
            <ChevronRight size={18} aria-hidden="true" />
          </button>
        </div>
        <button
          type="button"
          aria-pressed={jagaMode}
          onClick={() => setJagaMode(!jagaMode)}
          className={`ml-auto ${jagaMode ? 'btn-primary' : 'btn-ghost border border-line'}`}
        >
          <Moon size={15} aria-hidden="true" /> {jagaMode ? 'Selesai atur jaga' : 'Atur jadwal jaga'}
        </button>
      </section>
      {data && (
        <div className="stagger mt-3 grid items-start gap-3 lg:grid-cols-[1.3fr_1fr]">
          <section className="card">
            {jagaMode && (
              <p className="mb-3 rounded-xl bg-surface-2 px-3 py-2 text-[13px] text-muted">
                Ketuk tanggal jaga. Besoknya otomatis pasca-jaga (kalau masih kosong). Ketuk lagi untuk membatalkan.
              </p>
            )}
            <Grid data={data} today={today} jagaMode={jagaMode} onPick={(d) => void pick(d)} />
            <p className="mt-3 text-[13px] text-muted">
              <b className="font-semibold text-text">{data.stats.count} jaga</b> bulan ini
              {data.stats.backToBack > 0 && <span className="text-danger"> · {data.stats.backToBack}× jaga berurutan</span>}
              {data.stats.heavyWeeks.length > 0 && (
                <span className="text-uang"> · minggu {data.stats.heavyWeeks.map(formatDateShort).join(', ')} berisi ≥ 3 jaga</span>
              )}
            </p>
          </section>
          <Upcoming data={data} today={today} onPick={setPicked} />
        </div>
      )}
      <DaySheet date={picked} onClose={() => setPicked(null)} />
    </>
  )
}
