import { Dumbbell, Footprints, Plus, Trash2 } from 'lucide-react'
import { useState } from 'react'
import { useToday } from '../../app/useToday'
import { PageTop } from '../../components/PageTop'
import { useToast } from '../../components/toast-context'
import { deleteWorkout, newExercise, restoreWorkout, saveTargets } from '../../db/training'
import { formatDuration, formatPace, parseDuration, type Readiness, type StrengthAction } from '../../domain/training'
import { formatDateShort, MONTH_NAMES } from '../../domain/time'
import { formatNumber } from '../../lib/format'
import type { Exercise, RunType, Workout } from '../../types'
import { useLatihan, type LatihanData } from './data'
import { ExerciseEditor } from './ExerciseEditor'
import { RunForm, StrengthForm } from './forms'
import { Sparkline } from './Sparkline'

const READY: Record<Readiness, { label: string; tone: string }> = {
  normal: { label: 'Siap latihan normal', tone: 'text-ok' },
  'ringan-tidur': { label: 'Tidur < 5 jam: latihan ringan', tone: 'text-uang' },
  'ringan-pasca': { label: 'Pasca-jaga: teknik saja', tone: 'text-uang' },
  jaga: { label: 'Hari jaga: istirahat latihan', tone: 'text-muted' },
}

const ACTION: Record<StrengthAction, { label: string; tone: string }> = {
  mulai: { label: 'Mulai', tone: 'text-muted' },
  naik: { label: 'Naik', tone: 'text-ok' },
  'tambah-rep': { label: '+ rep', tone: 'text-tentir' },
  ulang: { label: 'Ulang', tone: 'text-muted' },
  turun: { label: 'Turun', tone: 'text-danger' },
  deload: { label: 'Deload', tone: 'text-uang' },
  ringan: { label: 'Ringan', tone: 'text-uang' },
  lewati: { label: 'Lewati', tone: 'text-faint' },
}

const RUN_LABEL: Record<RunType, string> = { easy: 'santai', long: 'panjang', kualitas: 'kualitas', tes: 'tes' }

const kg = (n: number) => `${formatNumber(n, 2)} kg`
const monthYear = (d: string) => `${MONTH_NAMES[Number(d.slice(5, 7)) - 1]} ${d.slice(0, 4)}`
const paceRange = (r: [number, number] | null) => (r ? `${formatPace(r[0])}–${formatPace(r[1])}/km` : null)

function Bar({ value, max }: { value: number; max: number }) {
  const pct = max > 0 ? Math.min(100, (value / max) * 100) : 0
  return (
    <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-track">
      <div className="h-full rounded-full bg-text" style={{ width: `${pct}%` }} />
    </div>
  )
}

function Targets({ data }: { data: LatihanData }) {
  const bench = data.strength.find((s) => s.ex.id === '#ex:bench')
  const proj = data.benchProjection
  const est = data.runPlan.est5k
  return (
    <section className="mt-3 grid gap-3 sm:grid-cols-3">
      <div className="card">
        <div className="text-xs text-muted">Bench (perkiraan 1RM)</div>
        <div className="mt-1 text-[22px] font-semibold tabular-nums">
          {proj && proj.best > 0 ? kg(Math.round(proj.best * 10) / 10) : '–'}
          <span className="text-[13px] font-normal text-faint"> / {kg(data.targets.benchKg)}</span>
        </div>
        <Bar value={proj?.best ?? 0} max={data.targets.benchKg} />
        <p className="mt-2 text-xs text-muted">
          {!proj || proj.best === 0
            ? 'Catat sesi bench pertama untuk mulai.'
            : proj.weeks === 0
              ? 'Target tercapai. Naikkan target di Setelan latihan.'
              : bench?.plateau.stalled
                ? 'Stagnan 4 sesi: deload otomatis di sesi berikutnya.'
                : proj.date
                  ? `Dengan tren sekarang ±${proj.weeks} minggu (${monthYear(proj.date)}).`
                  : (bench?.history.length ?? 0) < 3
                    ? 'Perkiraan kapan target tercapai muncul setelah 3 sesi.'
                    : 'Tren 8 minggu terakhir masih datar.'}
        </p>
      </div>
      <div className="card">
        <div className="text-xs text-muted">Perkiraan 5K</div>
        <div className="mt-1 text-[22px] font-semibold tabular-nums">
          {est ? formatDuration(est) : '–'}
          <span className="text-[13px] font-normal text-faint"> / {formatDuration(data.targets.fiveKSec)}</span>
        </div>
        <Bar value={est ? data.targets.fiveKSec : 0} max={est ? Math.max(est, data.targets.fiveKSec) : 1} />
        <p className="mt-2 text-xs text-muted">
          {!est
            ? 'Catat satu lari tes/kualitas (3–21 km) untuk perkiraan.'
            : est <= data.targets.fiveKSec
              ? 'Sudah di bawah target.'
              : `Kurang ${formatDuration(est - data.targets.fiveKSec)}.${data.runPlan.stalled ? ' Perkiraan tidak membaik 3 minggu.' : ''}`}
        </p>
      </div>
      <div className="card">
        <div className="text-xs text-muted">Lari minggu ini</div>
        <div className="mt-1 text-[22px] font-semibold tabular-nums">
          {formatNumber(data.runDoneKm, 1)} km
          <span className="text-[13px] font-normal text-faint"> / {formatNumber(data.runPlan.targetKm, 1)} km</span>
        </div>
        <Bar value={data.runDoneKm} max={data.runPlan.targetKm} />
        <p className="mt-2 text-xs text-muted">
          {data.runPlan.recovery
            ? 'Minggu pemulihan.'
            : data.jaga >= 2
              ? `${data.jaga} jaga: volume ditahan.`
              : 'Naik maks. 10% dari minggu lalu.'}
        </p>
      </div>
    </section>
  )
}

function StrengthCard({ data, onLog }: { data: LatihanData; onLog: () => void }) {
  return (
    <section className="card">
      <h2 className="card-title">
        <Dumbbell size={17} aria-hidden="true" /> Sesi beban berikutnya
        <button type="button" onClick={onLog} className="btn-primary -my-1 ml-auto py-1.5">
          <Plus size={15} aria-hidden="true" /> Catat
        </button>
      </h2>
      <ul>
        {data.strength.map(({ ex, plan }) => (
          <li key={ex.id} className="border-t border-line py-2 first:border-t-0">
            <div className="flex items-baseline gap-2 text-[13.5px]">
              <span className="font-medium">{ex.name}</span>
              <span className={`text-xs font-medium ${ACTION[plan.action].tone}`}>{ACTION[plan.action].label}</span>
              <span className="ml-auto text-right tabular-nums">
                {plan.kg != null ? `${kg(plan.kg)} · ` : ''}
                {plan.sets > 0 ? `${plan.sets}×${plan.repMin}${plan.repMax > plan.repMin ? `–${plan.repMax}` : ''}` : '–'}
              </span>
            </div>
            <p className="mt-0.5 text-xs text-muted">{plan.reason}</p>
          </li>
        ))}
      </ul>
      <p className="mt-2 text-xs text-faint">
        Beban naik hanya setelah semua set mencapai rep maks dan tidak terasa berat. Gagal 2× → turun 10%. e1RM datar 4 sesi → deload.
      </p>
    </section>
  )
}

function RunCard({ data, onLog }: { data: LatihanData; onLog: () => void }) {
  const p = data.runPlan
  const easy = paceRange(p.easyPace)
  const tempo = paceRange(p.tempoPace)
  return (
    <section className="card">
      <h2 className="card-title">
        <Footprints size={17} aria-hidden="true" /> Rencana lari minggu ini
        <button type="button" onClick={onLog} className="btn-primary -my-1 ml-auto py-1.5">
          <Plus size={15} aria-hidden="true" /> Catat
        </button>
      </h2>
      <ul className="grid gap-1.5 text-[13.5px]">
        <li className="flex gap-2">
          <span className="text-muted">Volume</span>
          <span className="ml-auto tabular-nums">
            {formatNumber(p.targetKm, 1)} km · sisa {formatNumber(Math.max(0, p.targetKm - data.runDoneKm), 1)} km
          </span>
        </li>
        <li className="flex gap-2">
          <span className="text-muted">{p.easyRuns}× santai</span>
          <span className="ml-auto tabular-nums">{easy ?? 'bisa ngobrol'}</span>
        </li>
        {p.qualityRuns > 0 && (
          <li className="flex gap-2">
            <span className="text-muted">{p.qualityRuns}× kualitas (tempo 20 mnt)</span>
            <span className="ml-auto tabular-nums">{tempo ?? 'berat tapi terkontrol'}</span>
          </li>
        )}
      </ul>
      {p.notes.length > 0 && (
        <ul className="mt-2 grid gap-1 text-xs text-uang">
          {p.notes.map((n) => (
            <li key={n}>{n}</li>
          ))}
        </ul>
      )}
      <p className="mt-2 text-xs text-faint">
        ±80% lari santai, sisanya kualitas. Tiap 4 minggu, setelah 3 minggu naik, satu minggu pemulihan. Tes 5K sebulan sekali untuk
        memperbarui pace.
      </p>
    </section>
  )
}

function Progress({ data }: { data: LatihanData }) {
  const rows = data.strength.filter((s) => s.history.length > 0)
  const fiveK = data.runs.filter((r) => r.run.type === 'tes' || r.run.type === 'kualitas')
  return (
    <section className="card">
      <h2 className="card-title">Progres</h2>
      {!rows.length && !data.runs.length && <p className="text-[13px] text-muted">Belum ada sesi tercatat.</p>}
      <ul>
        {rows.map(({ ex, history, plateau }) => {
          const last = history[history.length - 1]
          return (
            <li key={ex.id} className="flex items-center gap-3 border-t border-line py-2 first:border-t-0">
              <span className="flex-1 text-[13.5px]">
                {ex.name}
                <span className="block text-xs text-muted tabular-nums">
                  e1RM {kg(Math.round(last.e1rm * 10) / 10)}
                  {plateau.slopePerWeek != null &&
                    ` · ${plateau.slopePerWeek >= 0 ? '+' : ''}${formatNumber(plateau.slopePerWeek, 1)} kg/mgg`}
                  {plateau.stalled && <span className="text-uang"> · stagnan</span>}
                </span>
              </span>
              <Sparkline values={history.slice(-12).map((h) => h.e1rm)} label={`Tren e1RM ${ex.name}`} />
            </li>
          )
        })}
        {fiveK.length > 0 && (
          <li className="flex items-center gap-3 border-t border-line py-2 first:border-t-0">
            <span className="flex-1 text-[13.5px]">
              Pace lari keras
              <span className="block text-xs text-muted tabular-nums">
                terakhir {formatPace(fiveK[fiveK.length - 1].run.sec / fiveK[fiveK.length - 1].run.km)}/km
              </span>
            </span>
            {/* Dibalik agar garis naik = makin cepat. */}
            <Sparkline
              values={fiveK.slice(-12).map((r) => -r.run.sec / r.run.km)}
              label="Tren pace lari keras"
              color="var(--color-pulih)"
            />
          </li>
        )}
      </ul>
    </section>
  )
}

function describe(w: Workout, names: Map<string, string>): string {
  if (w.kind === 'lari' && w.run)
    return `${formatNumber(w.run.km, 1)} km · ${formatDuration(w.run.sec)} · ${formatPace(w.run.sec / w.run.km)}/km · ${RUN_LABEL[w.run.type]}`
  return w.entries
    .map((e) => {
      const top = Math.max(...e.sets.map((s) => s.kg))
      return `${names.get(e.exerciseId) ?? 'Gerakan'} ${formatNumber(top, 2)}×${e.sets.map((s) => s.reps).join('/')}`
    })
    .join(' · ')
}

function Recent({ data }: { data: LatihanData }) {
  const toast = useToast()
  const names = new Map(data.exercises.map((e) => [e.id, e.name]))
  const remove = async (id: string) => {
    const w = await deleteWorkout(id)
    if (w) toast({ message: 'Sesi dihapus.', action: { label: 'Urungkan', onClick: () => void restoreWorkout(w) } })
  }
  return (
    <section className="card">
      <h2 className="card-title">Riwayat</h2>
      {!data.recent.length && <p className="text-[13px] text-muted">Belum ada.</p>}
      <ul>
        {data.recent.map((w) => (
          <li key={w.id} className="flex items-start gap-2 border-t border-line py-2 first:border-t-0">
            {w.kind === 'lari' ? (
              <Footprints size={15} className="mt-0.5 shrink-0 text-pulih" aria-hidden="true" />
            ) : (
              <Dumbbell size={15} className="mt-0.5 shrink-0 text-tentir" aria-hidden="true" />
            )}
            <span className="flex-1 text-[13px]">
              <span className="text-xs text-muted">{formatDateShort(w.date)}</span>
              <span className="block">{describe(w, names)}</span>
              {w.note && <span className="block text-xs text-faint">{w.note}</span>}
            </span>
            <button type="button" className="btn-ghost p-1.5" onClick={() => void remove(w.id)} aria-label="Hapus sesi">
              <Trash2 size={14} aria-hidden="true" />
            </button>
          </li>
        ))}
      </ul>
    </section>
  )
}

function Settings({ data }: { data: LatihanData }) {
  const [editing, setEditing] = useState<Exercise | null>(null)
  const time = (field: 'fiveKSec' | 'tenKSec', label: string) => (
    <label className="text-xs text-muted">
      {label}
      <input
        className="field mt-1"
        inputMode="numeric"
        defaultValue={formatDuration(data.targets[field])}
        onBlur={(e) => {
          const sec = parseDuration(e.target.value)
          if (sec) void saveTargets({ [field]: sec })
        }}
      />
    </label>
  )
  const active = data.exercises.filter((e) => !e.archived)
  const archived = data.exercises.filter((e) => e.archived)
  return (
    <section className="card">
      <h2 className="card-title">Setelan latihan</h2>
      <div className="grid grid-cols-3 gap-2">
        <label className="text-xs text-muted">
          Target bench (kg)
          <input
            className="field mt-1"
            inputMode="decimal"
            defaultValue={data.targets.benchKg}
            onBlur={(e) => {
              const v = Number(e.target.value.replace(',', '.'))
              if (v > 0 && v < 400) void saveTargets({ benchKg: v })
            }}
          />
        </label>
        {time('fiveKSec', 'Target 5K')}
        {time('tenKSec', 'Target 10K')}
      </div>
      <div className="mt-4 mb-1 flex items-center text-xs font-medium tracking-wide text-faint uppercase">
        Gerakan
        <button
          type="button"
          className="btn-ghost ml-auto py-1 normal-case"
          onClick={() => setEditing(newExercise(Math.max(0, ...data.exercises.map((e) => e.order)) + 1))}
        >
          <Plus size={14} aria-hidden="true" /> Tambah
        </button>
      </div>
      <ul>
        {active.map((ex) => (
          <li key={ex.id}>
            <button
              type="button"
              onClick={() => setEditing(ex)}
              className="flex w-full items-center gap-2 border-t border-line py-2 text-left text-[13.5px] first:border-t-0"
            >
              <span className="flex-1">{ex.name}</span>
              <span className="text-xs text-muted tabular-nums">
                {ex.sets}×{ex.repMin}–{ex.repMax} · +{formatNumber(ex.increment, 2)} kg
              </span>
            </button>
          </li>
        ))}
      </ul>
      {archived.length > 0 && (
        <details className="mt-2 text-[13px]">
          <summary className="cursor-pointer text-muted">Diarsipkan ({archived.length})</summary>
          <ul className="mt-1">
            {archived.map((ex) => (
              <li key={ex.id}>
                <button type="button" className="py-1 text-muted hover:text-text" onClick={() => setEditing(ex)}>
                  {ex.name}
                </button>
              </li>
            ))}
          </ul>
        </details>
      )}
      <ExerciseEditor exercise={editing} onClose={() => setEditing(null)} />
    </section>
  )
}

export function LatihanPage() {
  const today = useToday()
  const data = useLatihan(today)
  const [form, setForm] = useState<'beban' | 'lari' | null>(null)
  return (
    <>
      <PageTop title="Latihan" />
      <h1 className="mt-4 text-[26px] font-semibold tracking-tight md:hidden">Latihan</h1>
      {data && (
        <>
          <p className={`mt-2 text-[13px] md:mt-3 ${READY[data.ready].tone}`}>
            Hari ini: {READY[data.ready].label}
            {data.dayType == null && <span className="text-faint"> (tipe hari belum dipilih)</span>}
          </p>
          <Targets data={data} />
          <div className="mt-3 grid items-start gap-3 lg:grid-cols-2">
            <StrengthCard data={data} onLog={() => setForm('beban')} />
            <RunCard data={data} onLog={() => setForm('lari')} />
            <Progress data={data} />
            <Recent data={data} />
            <Settings data={data} />
          </div>
          <StrengthForm
            open={form === 'beban'}
            onClose={() => setForm(null)}
            today={today}
            exercises={data.exercises}
            plans={data.strength.map((s) => s.plan)}
          />
          <RunForm open={form === 'lari'} onClose={() => setForm(null)} today={today} />
        </>
      )}
    </>
  )
}
