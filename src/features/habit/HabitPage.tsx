import { Archive, ArchiveRestore, Pencil, Plus, Timer } from 'lucide-react'
import { useState } from 'react'
import { useToday } from '../../app/useToday'
import { PageTop } from '../../components/PageTop'
import { RoleTag } from '../../components/RoleTag'
import { Sheet } from '../../components/Sheet'
import { useToast } from '../../components/toast-context'
import { addHabitMinutes, assertNoPatientIdentity, setHabitDone, setMutabaahDone } from '../../db/daily'
import { roleLookup, saveHabit, saveMutabaahItem } from '../../db/structure'
import { DAY_TYPE_LABELS } from '../../domain/dayType'
import { dayInitial, type HabitCell } from '../../domain/habitGrid'
import { DAY_NAMES, MONTH_NAMES, weekday } from '../../domain/time'
import { createId } from '../../lib/id'
import type { Habit } from '../../types'
import { useHabitPage, type HabitPageData } from './data'
import { HabitEditor, type HabitDraft } from './HabitEditor'
import { HABIT_TEMPLATES } from './templates'

const dateLabel = (d: string) => `${DAY_NAMES[weekday(d)]} ${Number(d.slice(8))} ${MONTH_NAMES[Number(d.slice(5, 7)) - 1].slice(0, 3)}`

/** Kepala kolom: inisial hari, sejajar dengan kotak. */
function DayHeader({ dates }: { dates: string[] }) {
  return (
    <div className="grid grid-cols-7 gap-1 md:gap-1.5" aria-hidden="true">
      {dates.map((d) => (
        <span key={d} className="w-[30px] text-center text-[11px] text-faint md:w-[34px]">
          {dayInitial(d)}
        </span>
      ))}
    </div>
  )
}

function Cell({ cell, tone, onToggle, why }: { cell: HabitCell; tone: 'ok' | 'muted'; onToggle: () => void; why: string }) {
  const n = Number(cell.date.slice(8))
  const na = cell.applies === false
  const fill = tone === 'ok' ? 'bg-ok text-white' : 'bg-muted text-surface'
  // Tidak berlaku menang atas centang: habit tidur di hari pasca-jaga tidak dihitung, jadi jangan tampak hijau.
  const done = cell.done && !na
  const state = na ? 'tidak berlaku' : done ? 'selesai' : 'belum'
  return (
    <button
      type="button"
      onClick={onToggle}
      aria-label={`${dateLabel(cell.date)}: ${state}${cell.locked ? ', terkunci' : ''}`}
      aria-pressed={done}
      title={why || undefined}
      className={`grid size-[30px] place-items-center rounded-[9px] text-[11px] font-medium tabular-nums transition md:size-[34px] ${
        done ? fill : na ? 'text-faint' : 'bg-surface-2 text-muted'
      } ${cell.isToday ? 'outline-[1.5px] outline-text outline-solid' : ''} ${cell.locked ? 'opacity-55' : ''} ${cell.editable ? 'active:scale-95' : 'cursor-default'}`}
    >
      {na ? '·' : n}
    </button>
  )
}

function MinutesSheet({ habit, today, minutes, onClose }: { habit: Habit | null; today: string; minutes: number; onClose: () => void }) {
  const add = (delta: number) => habit && void addHabitMinutes(habit, today, delta)
  return (
    <Sheet open={!!habit} title={habit ? `Menit · ${habit.name}` : ''} onClose={onClose}>
      {habit && (
        <div className="grid gap-4">
          <div className="text-center">
            <div className="text-3xl font-semibold tabular-nums">{minutes}</div>
            <div className="text-[13px] text-muted">{habit.minutes ? `dari target ${habit.minutes} menit hari ini` : 'menit hari ini'}</div>
          </div>
          <div className="flex flex-wrap justify-center gap-1.5">
            {[5, 10, 15, 30, 45, 60].map((m) => (
              <button key={m} type="button" className="chip" onClick={() => add(m)}>
                +{m}
              </button>
            ))}
            <button type="button" className="chip" onClick={() => add(-15)} disabled={minutes === 0}>
              −15
            </button>
          </div>
          <button type="button" className="btn-primary w-full py-3" onClick={onClose}>
            Selesai
          </button>
        </div>
      )}
    </Sheet>
  )
}

function HabitCard({ data }: { data: HabitPageData }) {
  const toast = useToast()
  const role = roleLookup(data.roles)
  const weekDone = data.weekDone
  const [editing, setEditing] = useState<HabitDraft | null>(null)
  const [timing, setTiming] = useState<string | null>(null)
  const timingRow = data.rows.find((r) => r.habit.id === timing)
  const names = new Set(data.habits.map((h) => h.name.toLowerCase()))
  const templates = HABIT_TEMPLATES.filter((t) => !names.has(t.name.toLowerCase()))
  const nextOrder = Math.max(0, ...data.habits.map((h) => h.order)) + 1

  const why = (h: Habit, c: HabitCell) => {
    if (h.kind === 'sleep') return 'Otomatis dari jam tidur'
    if (h.kind === 'workend') return 'Otomatis dari "Tutup hari"'
    if (c.applies === false) return `Tidak berlaku saat ${DAY_TYPE_LABELS[data.dayTypes.get(c.date)!]}`
    if (c.locked) return 'Terkunci: lewat jendela isi mundur'
    return ''
  }
  const toggle = (h: Habit, c: HabitCell) => {
    if (c.editable) return void setHabitDone(h.id, c.date, !c.done)
    const reason = why(h, c)
    if (reason) toast({ message: reason, tone: 'info', duration: 2500 })
  }
  const addTemplate = async (t: (typeof HABIT_TEMPLATES)[number]) => {
    const now = Date.now()
    await saveHabit({ ...t, id: createId('hab'), kind: 'normal', active: true, order: nextOrder, createdAt: now, updatedAt: now })
    toast({ message: `Habit "${t.name}" ditambahkan.` })
  }

  return (
    <section className="card">
      <h2 className="card-title">
        Habit <span className="text-[13px] font-medium text-faint">{data.rows.length} aktif</span>
        <button type="button" onClick={() => setEditing('baru')} className="btn-ghost -my-1 ml-auto border border-line py-1.5">
          <Plus size={15} aria-hidden="true" /> Habit baru
        </button>
      </h2>
      <div className="mb-1 hidden justify-end md:flex">
        <DayHeader dates={data.dates} />
      </div>
      <ul>
        {data.rows.map(({ habit: h, cells, summary, todayMinutes }) => (
          <li key={h.id} className="flex flex-wrap items-center gap-x-3 gap-y-2 border-t border-line py-3 first:border-t-0">
            <div className="min-w-[180px] flex-1">
              <button type="button" onClick={() => setEditing(h)} className="group flex items-center gap-1.5 text-left font-medium">
                {h.name}
                <Pencil size={12} className="text-faint opacity-0 transition group-hover:opacity-100" aria-hidden="true" />
              </button>
              <div className="mt-0.5 flex flex-wrap items-center gap-x-2 text-xs text-muted">
                <RoleTag role={role(h.roleId)} />
                {h.freq === 'weekly' ? (
                  <span>1×/minggu · {weekDone.has(h.id) ? 'minggu ini selesai' : 'minggu ini belum'}</span>
                ) : (
                  <span>
                    {summary.done}/{summary.applicable} hari
                  </span>
                )}
                {h.minutes && (
                  <span>
                    · hari ini {todayMinutes}/{h.minutes} mnt
                  </span>
                )}
                {h.kind !== 'normal' && <span className="text-faint">· otomatis</span>}
              </div>
              {h.note && <div className="mt-0.5 text-xs text-faint">{h.note}</div>}
            </div>
            {h.minutes ? (
              <button type="button" className="chip py-1" onClick={() => setTiming(h.id)} aria-label={`Catat menit ${h.name}`}>
                <Timer size={14} aria-hidden="true" /> Menit
              </button>
            ) : null}
            <div className="grid w-full grid-cols-7 justify-items-center gap-1 sm:ml-auto sm:w-auto md:gap-1.5">
              {cells.map((c) => (
                <Cell key={c.date} cell={c} tone="ok" onToggle={() => toggle(h, c)} why={why(h, c)} />
              ))}
            </div>
          </li>
        ))}
      </ul>
      {templates.length > 0 && (
        <div className="mt-3 border-t border-line pt-3">
          <div className="mb-2 flex items-center text-xs text-faint">
            Tambah cepat
            <a href="#/impor" className="ml-auto hover:text-text">
              Impor program latihan →
            </a>
          </div>
          <div className="flex flex-wrap gap-1.5">
            {templates.map((t) => (
              <button key={t.name} type="button" className="chip py-1" onClick={() => void addTemplate(t)}>
                <Plus size={13} aria-hidden="true" /> {t.name}
              </button>
            ))}
          </div>
        </div>
      )}
      {data.inactive.length > 0 && (
        <details className="mt-3 border-t border-line pt-3 text-[13px]">
          <summary className="cursor-pointer text-muted">Nonaktif ({data.inactive.length})</summary>
          <ul className="mt-2 grid gap-1">
            {data.inactive.map((h) => (
              <li key={h.id} className="flex items-center gap-2 text-muted">
                <span className="flex-1">{h.name}</span>
                <button type="button" className="btn-ghost py-1" onClick={() => void saveHabit({ ...h, active: true })}>
                  Aktifkan
                </button>
              </li>
            ))}
          </ul>
        </details>
      )}
      <HabitEditor draft={editing} roles={data.roles} nextOrder={nextOrder} onClose={() => setEditing(null)} />
      <MinutesSheet
        habit={timingRow?.habit ?? null}
        today={data.today}
        minutes={timingRow?.todayMinutes ?? 0}
        onClose={() => setTiming(null)}
      />
    </section>
  )
}

function MutabaahCard({ data }: { data: HabitPageData }) {
  const toast = useToast()
  const [editing, setEditing] = useState(false)
  const [name, setName] = useState('')
  const nextOrder = Math.max(0, ...data.allMutabaah.map((m) => m.order)) + 1
  const add = async () => {
    try {
      assertNoPatientIdentity(name)
      const now = Date.now()
      await saveMutabaahItem({ id: createId('mut'), name: name.trim(), order: nextOrder, archived: false, createdAt: now, updatedAt: now })
      setName('')
    } catch (e) {
      toast({ message: (e as Error).message, tone: 'error' })
    }
  }
  return (
    <section className="card">
      <h2 className="card-title">
        Mutaba'ah <span className="text-[13px] font-medium text-faint">tanpa skor</span>
        <button type="button" onClick={() => setEditing((v) => !v)} className="btn-ghost -my-1 ml-auto border border-line py-1.5">
          {editing ? 'Selesai' : 'Ubah daftar'}
        </button>
      </h2>
      <div className="mb-1 hidden justify-end md:flex">
        <DayHeader dates={data.dates} />
      </div>
      <ul>
        {data.mutabaah.map(({ item, cells, week, month }) => (
          <li key={item.id} className="flex flex-wrap items-center gap-x-3 gap-y-2 border-t border-line py-3 first:border-t-0">
            <div className="min-w-[180px] flex-1">
              {editing ? (
                <input
                  className="field py-1.5"
                  defaultValue={item.name}
                  aria-label="Nama amalan"
                  onBlur={(e) => {
                    const v = e.target.value.trim()
                    if (v && v !== item.name) void saveMutabaahItem({ ...item, name: v })
                  }}
                />
              ) : (
                <div className="font-medium">{item.name}</div>
              )}
              <div className="mt-0.5 text-xs text-muted">
                7 hari {week}/7 · 30 hari {month}/30
              </div>
            </div>
            {editing ? (
              <button
                type="button"
                className="btn-ghost p-2"
                onClick={() => void saveMutabaahItem({ ...item, archived: true })}
                aria-label={`Arsipkan ${item.name}`}
              >
                <Archive size={16} aria-hidden="true" />
              </button>
            ) : (
              <div className="grid w-full grid-cols-7 justify-items-center gap-1 sm:ml-auto sm:w-auto md:gap-1.5">
                {cells.map((c) => (
                  <Cell
                    key={c.date}
                    cell={{ ...c, applies: true, minutes: 0, editable: true, locked: false }}
                    tone="muted"
                    why=""
                    onToggle={() => void setMutabaahDone(item.id, c.date, !c.done)}
                  />
                ))}
              </div>
            )}
          </li>
        ))}
      </ul>
      {editing && (
        <>
          <form
            className="mt-3 flex gap-2"
            onSubmit={(e) => {
              e.preventDefault()
              if (name.trim()) void add()
            }}
          >
            <input
              className="field"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Amalan baru, mis. Sedekah subuh"
              aria-label="Amalan baru"
            />
            <button type="submit" className="btn-primary" disabled={!name.trim()}>
              Tambah
            </button>
          </form>
          {data.archivedMutabaah.length > 0 && (
            <ul className="mt-3 grid gap-1 text-[13px] text-muted">
              {data.archivedMutabaah.map((m) => (
                <li key={m.id} className="flex items-center gap-2">
                  <span className="flex-1">{m.name} (arsip)</span>
                  <button
                    type="button"
                    className="btn-ghost p-2"
                    onClick={() => void saveMutabaahItem({ ...m, archived: false })}
                    aria-label={`Pulihkan ${m.name}`}
                  >
                    <ArchiveRestore size={16} aria-hidden="true" />
                  </button>
                </li>
              ))}
            </ul>
          )}
        </>
      )}
      <p className="mt-3 text-xs text-faint">Tidak masuk XP, level, atau streak. Boleh diisi untuk hari-hari sebelumnya.</p>
    </section>
  )
}

export function HabitPage() {
  const today = useToday()
  const data = useHabitPage(today)
  return (
    <>
      <PageTop title="Habit & ibadah" />
      <h1 className="mt-4 text-[26px] font-semibold tracking-tight md:hidden">Habit &amp; ibadah</h1>
      <p className="mt-1 text-[13px] text-muted md:mt-[26px]">
        7 hari terakhir. Ketuk kotak untuk mengisi atau membatalkan. Habit hanya bisa diisi mundur 1 hari; yang lebih lama terkunci.
      </p>
      {data && (
        <div className="mt-4 grid gap-3 xl:grid-cols-[1.3fr_1fr]">
          <HabitCard data={data} />
          <MutabaahCard data={data} />
        </div>
      )}
    </>
  )
}
