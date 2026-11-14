import { useLiveQuery } from 'dexie-react-hooks'
import { CalendarClock, Check, Plus, Settings2, Wand2 } from 'lucide-react'
import { useState } from 'react'
import { Sheet } from '../../components/Sheet'
import { TimeCommitField, TimeField } from '../../components/TimeField'
import { useToast } from '../../components/toast-context'
import {
  applyWeekPlan,
  deletePlanned,
  loadWeekPlan,
  restorePlanned,
  savePlanned,
  saveTrainingSchedule,
  undoWeekPlan,
  type PlannedState,
  type WeekPlan as WeekPlanData,
} from '../../db/schedule'
import { DAY_TYPE_LABELS } from '../../domain/dayType'
import { SPLITS } from '../../domain/exerciseCatalog'
import { plannedTitle, RUN_LABELS } from '../../domain/schedule'
import { DAY_SHORT, weekday } from '../../domain/time'
import type { ISODate, PlannedWorkout, RunType, Workout } from '../../types'
import { DAY_TYPE_COLORS } from '../beranda/dayTypeColors'

const STATE_CLASS: Record<PlannedState | 'usulan', string> = {
  rencana: '',
  selesai: 'border-transparent bg-surface-2 text-ok',
  terlewat: 'text-faint line-through',
  bentrok: 'border-uang text-uang',
  usulan: 'border-dashed text-faint',
}

const chipText = (p: Pick<PlannedWorkout, 'kind' | 'day' | 'run' | 'start'>) =>
  `${p.start} · ${plannedTitle(p).replace(/^Latihan beban/, 'Beban')}`

type Draft = Omit<PlannedWorkout, 'id' | 'updatedAt' | 'source'> & { id?: string }

/**
 * Program latihan dimasukkan ke jam: tujuh hari minggu ini dengan sesi beban & lari yang sudah diberi
 * jam, mengikuti jaga, tentir, agenda, dan ritme. "Susun" menaruh sesi ke hari & jam kosong.
 */
export function WeekPlan({ today, onLog }: { today: ISODate; onLog: (kind: Workout['kind'], day?: string) => void }) {
  const toast = useToast()
  const data = useLiveQuery(() => loadWeekPlan(today), [today])
  const [draft, setDraft] = useState<Draft | null>(null)
  const [settings, setSettings] = useState(false)
  if (!data) return null
  const planned = data.days.flatMap((d) => d.sessions)
  const left = planned.filter((s) => s.state === 'rencana' || s.state === 'bentrok').length
  const arrange = async () => {
    const change = await applyWeekPlan(today)
    toast({
      message: change.added.length
        ? `${change.added.length} sesi dimasukkan ke jadwal minggu ini.${change.skipped.length ? ` ${change.skipped.length} tidak mendapat tempat.` : ''}`
        : (change.skipped[0] ?? 'Tidak ada sesi yang perlu dijadwalkan lagi minggu ini.'),
      tone: change.added.length ? 'success' : 'info',
      action: { label: 'Urungkan', onClick: () => void undoWeekPlan(change) },
    })
  }
  const blank = (date: ISODate): Draft => ({
    date,
    kind: 'beban',
    start: data.days.find((d) => d.date === date)?.type === 'libur' ? data.settings.timeLibur : data.settings.timeStase,
    minutes: data.settings.strengthMinutes,
  })
  return (
    <section className="card lg:col-span-2">
      <h2 className="card-title flex-wrap">
        <CalendarClock size={17} aria-hidden="true" /> Jadwal minggu ini
        <span className="ml-auto flex gap-1.5">
          <button
            type="button"
            className="btn-ghost -my-1 border border-line py-1.5"
            aria-expanded={settings}
            onClick={() => setSettings(!settings)}
          >
            <Settings2 size={15} aria-hidden="true" /> Atur
          </button>
          <button type="button" className="btn-primary -my-1 py-1.5" onClick={() => void arrange()}>
            <Wand2 size={15} aria-hidden="true" /> {data.hasPlan ? 'Susun ulang' : 'Susun'}
          </button>
        </span>
      </h2>
      <p className="mb-2 text-[13px] text-muted">
        {data.hasPlan ? (
          <>
            {left} sesi tersisa · {data.doneStrength} beban & {data.doneRuns} lari selesai.
            {data.issues > 0 && (
              <span className="text-uang"> {data.issues} sesi bentrok dengan jaga, tentir, atau agenda: susun ulang.</span>
            )}
            {data.missed > 0 && <span> {data.missed} terlewat; "Susun ulang" menaruhnya di sisa minggu.</span>}
          </>
        ) : (
          'Belum dijadwalkan. Garis putus-putus = susunan yang disarankan dari jadwal jaga, tentir, dan agenda minggu ini. Tekan Susun untuk memasukkannya ke jadwal.'
        )}
      </p>
      {settings && <ScheduleSettings data={data} />}
      <ul>
        {data.days.map((d) => {
          const preview = data.hasPlan ? [] : data.preview.sessions.filter((p) => p.date === d.date)
          const rest = d.type === 'jaga' || d.type === 'pasca'
          const past = d.date < today
          return (
            <li key={d.date} className="flex min-h-[44px] items-center gap-2.5 border-t border-line py-1.5 first:border-t-0">
              <span
                className={`w-[52px] shrink-0 text-[13px] tabular-nums ${d.date === today ? 'font-semibold' : past ? 'text-faint' : ''}`}
              >
                {DAY_SHORT[weekday(d.date)]} {Number(d.date.slice(8))}
              </span>
              <span className="flex w-[84px] shrink-0 items-center gap-1.5 text-xs text-muted" title={d.typed ? undefined : 'Perkiraan'}>
                <span className="dot" style={{ background: DAY_TYPE_COLORS[d.type], opacity: d.typed ? 1 : 0.45 }} aria-hidden="true" />
                <span className="truncate">{DAY_TYPE_LABELS[d.type].replace(' malam', '')}</span>
              </span>
              <span className="flex min-w-0 flex-1 flex-wrap gap-1.5">
                {d.sessions.map(({ p, state, issue }) => (
                  <button
                    key={p.id}
                    type="button"
                    className={`chip py-1 text-xs ${STATE_CLASS[state]}`}
                    onClick={() => setDraft(p)}
                    aria-label={`${chipText(p)}, ${state}${issue ? ` (${issue})` : ''}. Ubah`}
                  >
                    {state === 'selesai' && <Check size={12} aria-hidden="true" />}
                    {chipText(p)}
                    {issue && <span className="no-underline"> · {issue}</span>}
                  </button>
                ))}
                {preview.map((p) => (
                  <span key={p.id} className={`chip py-1 text-xs ${STATE_CLASS.usulan}`}>
                    {chipText(p)}
                  </span>
                ))}
                {d.extra.map((w) => (
                  <span key={w.id} className={`chip py-1 text-xs ${STATE_CLASS.selesai}`}>
                    <Check size={12} aria-hidden="true" /> {w.kind === 'beban' ? 'Beban' : 'Lari'}
                  </span>
                ))}
                {!d.sessions.length && !preview.length && !d.extra.length && (
                  <span className="text-xs text-faint">{rest ? 'pemulihan, tanpa latihan' : 'istirahat'}</span>
                )}
              </span>
              {!past && (
                <button
                  type="button"
                  className="btn-ghost shrink-0 p-1.5"
                  onClick={() => setDraft(blank(d.date))}
                  aria-label={`Tambah sesi ${DAY_SHORT[weekday(d.date)]} ${Number(d.date.slice(8))}`}
                >
                  <Plus size={15} aria-hidden="true" />
                </button>
              )}
            </li>
          )
        })}
      </ul>
      {!data.hasPlan && data.preview.skipped.length > 0 && <p className="mt-2 text-xs text-uang">{data.preview.skipped.join(' ')}</p>}
      <p className="mt-2 text-xs text-faint">
        Tanpa latihan di hari jaga & pasca-jaga. Sesi tampil di jadwal Beranda dan Kalender, dan slot kosong tentir menghindarinya. Mencatat
        sesi menandainya selesai.
      </p>
      <Sheet open={!!draft} title={draft?.id ? 'Ubah sesi' : 'Sesi baru'} onClose={() => setDraft(null)}>
        {draft && (
          <PlannedForm
            key={draft.id ?? draft.date}
            initial={draft}
            data={data}
            today={today}
            onClose={() => setDraft(null)}
            onLog={onLog}
          />
        )}
      </Sheet>
    </section>
  )
}

function ScheduleSettings({ data }: { data: WeekPlanData }) {
  const s = data.settings
  const save = (c: Parameters<typeof saveTrainingSchedule>[0]) => void saveTrainingSchedule(c)
  return (
    <div className="mb-3 grid gap-3 rounded-xl border border-line p-3">
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        <label className="text-xs text-muted">
          Sesi beban / minggu
          <select className="field mt-1" value={s.strengthPerWeek} onChange={(e) => save({ strengthPerWeek: Number(e.target.value) })}>
            {[0, 1, 2, 3, 4, 5, 6].map((n) => (
              <option key={n} value={n}>
                {n}×
              </option>
            ))}
          </select>
        </label>
        <label className="text-xs text-muted">
          Lama sesi beban
          <select className="field mt-1" value={s.strengthMinutes} onChange={(e) => save({ strengthMinutes: Number(e.target.value) })}>
            {[30, 45, 60, 75, 90].map((n) => (
              <option key={n} value={n}>
                {n} menit
              </option>
            ))}
          </select>
        </label>
        <label className="text-xs text-muted">
          Jam di hari stase
          <TimeCommitField className="field mt-1" initial={s.timeStase} placeholder="16.30" onCommit={(t) => t && save({ timeStase: t })} />
        </label>
        <label className="text-xs text-muted">
          Jam di hari libur
          <TimeCommitField className="field mt-1" initial={s.timeLibur} placeholder="09.30" onCommit={(t) => t && save({ timeLibur: t })} />
        </label>
      </div>
      <label className="flex items-center gap-2 text-[13px]">
        <input type="checkbox" className="size-4 accent-[var(--btn)]" checked={s.auto} onChange={(e) => save({ auto: e.target.checked })} />
        Susun otomatis tiap awal minggu
      </label>
      <p className="text-xs text-faint">
        Jam yang disukai dipakai bila kosong; kalau terisi tentir atau agenda, sesi digeser ke jam kosong terdekat. Lari mengikuti rencana
        lari mingguan ({data.runPlan.easyRuns} santai{data.runPlan.qualityRuns ? `, ${data.runPlan.qualityRuns} kualitas` : ''}).
      </p>
    </div>
  )
}

const RUN_TYPES: RunType[] = ['easy', 'kualitas', 'long']

function PlannedForm({
  initial,
  data,
  today,
  onClose,
  onLog,
}: {
  initial: Draft
  data: WeekPlanData
  today: ISODate
  onClose: () => void
  onLog: (kind: Workout['kind'], day?: string) => void
}) {
  const toast = useToast()
  const [p, setP] = useState<Draft>(initial)
  const set = (c: Partial<Draft>) => setP((cur) => ({ ...cur, ...c }))
  const programDays = SPLITS[data.split].days
  const dates = data.days.filter((d) => d.date >= today || d.date === initial.date)
  const save = async () => {
    try {
      const saved = await savePlanned({
        id: initial.id,
        date: p.date,
        kind: p.kind,
        start: p.start,
        minutes: p.minutes,
        day: p.kind === 'beban' && data.split !== 'fullbody' ? (p.day ?? programDays[0]) : undefined,
        run: p.kind === 'lari' ? (p.run ?? { type: 'easy', km: 4 }) : undefined,
      })
      toast({ message: `${plannedTitle(saved)} dijadwalkan ${DAY_SHORT[weekday(saved.date)]} ${saved.start}.` })
      onClose()
    } catch (e) {
      toast({ message: (e as Error).message, tone: 'error' })
    }
  }
  const remove = async () => {
    if (!initial.id) return
    const removed = await deletePlanned(initial.id)
    onClose()
    if (removed) toast({ message: 'Sesi dihapus dari jadwal.', action: { label: 'Urungkan', onClick: () => void restorePlanned(removed) } })
  }
  return (
    <div className="grid gap-4">
      <div role="radiogroup" aria-label="Jenis sesi" className="flex rounded-full bg-surface-2 p-[3px]">
        {(['beban', 'lari'] as const).map((k) => (
          <button
            key={k}
            type="button"
            role="radio"
            aria-checked={p.kind === k}
            onClick={() => set({ kind: k, minutes: k === 'beban' ? data.settings.strengthMinutes : 40 })}
            className={`flex-1 rounded-full px-3 py-1.5 text-[13px] ${p.kind === k ? 'bg-surface text-text shadow-sm' : 'text-muted'}`}
          >
            {k === 'beban' ? 'Beban' : 'Lari'}
          </button>
        ))}
      </div>
      <div className="grid grid-cols-3 gap-2">
        <label className="text-xs text-muted">
          Hari
          <select className="field mt-1" value={p.date} onChange={(e) => set({ date: e.target.value })}>
            {dates.map((d) => (
              <option key={d.date} value={d.date}>
                {DAY_SHORT[weekday(d.date)]} {Number(d.date.slice(8))} · {DAY_TYPE_LABELS[d.type].replace(' malam', '')}
              </option>
            ))}
          </select>
        </label>
        <label className="text-xs text-muted">
          Jam mulai
          <TimeField className="field mt-1" value={p.start} onChange={(v) => set({ start: v })} placeholder="16.30" />
        </label>
        <label className="text-xs text-muted">
          Lama (menit)
          <input
            className="field mt-1"
            inputMode="numeric"
            value={p.minutes || ''}
            onChange={(e) => set({ minutes: Number(e.target.value.replace(/\D/g, '')) || 0 })}
          />
        </label>
      </div>
      {p.kind === 'beban' && data.split !== 'fullbody' && (
        <div>
          <span className="label">Hari program</span>
          <div role="radiogroup" aria-label="Hari program" className="flex flex-wrap gap-1.5">
            {programDays.map((d) => (
              <button
                key={d}
                type="button"
                role="radio"
                aria-checked={(p.day ?? programDays[0]) === d}
                onClick={() => set({ day: d })}
                className={`chip py-1 ${(p.day ?? programDays[0]) === d ? 'border-transparent bg-btn text-btn-text' : ''}`}
              >
                {d}
              </button>
            ))}
          </div>
        </div>
      )}
      {p.kind === 'lari' && (
        <div className="grid grid-cols-[2fr_1fr] gap-2">
          <div>
            <span className="label">Jenis lari</span>
            <div role="radiogroup" aria-label="Jenis lari" className="flex flex-wrap gap-1.5">
              {RUN_TYPES.map((t) => (
                <button
                  key={t}
                  type="button"
                  role="radio"
                  aria-checked={(p.run?.type ?? 'easy') === t}
                  onClick={() => set({ run: { type: t, km: p.run?.km ?? 4 } })}
                  className={`chip py-1 ${(p.run?.type ?? 'easy') === t ? 'border-transparent bg-btn text-btn-text' : ''}`}
                >
                  {RUN_LABELS[t]}
                </button>
              ))}
            </div>
          </div>
          <label className="text-xs text-muted">
            Jarak (km)
            <input
              className="field mt-1"
              inputMode="decimal"
              defaultValue={String(p.run?.km ?? 4).replace('.', ',')}
              onChange={(e) => set({ run: { type: p.run?.type ?? 'easy', km: Number(e.target.value.replace(',', '.')) || 0 } })}
            />
          </label>
        </div>
      )}
      {data.days.find((d) => d.date === p.date && (d.type === 'jaga' || d.type === 'pasca')) && (
        <p className="-mt-1 text-xs text-uang">Hari itu jaga atau pasca-jaga: pemulihan lebih penting. Sebaiknya pilih hari lain.</p>
      )}
      <div className="flex flex-wrap gap-2">
        {initial.id && (
          <button type="button" className="btn-ghost border border-line" onClick={() => void remove()}>
            Hapus
          </button>
        )}
        {initial.id && initial.date === today && (
          <button
            type="button"
            className="btn-ghost border border-line"
            onClick={() => {
              onClose()
              onLog(initial.kind, initial.day)
            }}
          >
            Catat sekarang
          </button>
        )}
        <button type="button" className="btn-primary flex-1 py-3" onClick={() => void save()}>
          Simpan
        </button>
      </div>
    </div>
  )
}
