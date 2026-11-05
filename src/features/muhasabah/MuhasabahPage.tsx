import { Check as CheckIcon, ChevronLeft, ChevronRight } from 'lucide-react'
import { useState } from 'react'
import { routeHref } from '../../app/router'
import { useToday } from '../../app/useToday'
import { PageTop } from '../../components/PageTop'
import { RoleTag } from '../../components/RoleTag'
import { useToast } from '../../components/toast-context'
import { moveTasks } from '../../db/daily'
import { completeReview, saveReviewText } from '../../db/review'
import { roleLookup } from '../../db/structure'
import { detectPatientIdentity, PHI_HINT } from '../../domain/phi'
import { addDays, DAY_SHORT, formatHours, MONTH_NAMES, weekday, weekStart } from '../../domain/time'
import { formatNumber, formatRupiah } from '../../lib/format'
import type { Review } from '../../types'
import { useMuhasabah, type MuhasabahData } from './data'

const short = (d: string) => `${DAY_SHORT[weekday(d)]}, ${Number(d.slice(8))} ${MONTH_NAMES[Number(d.slice(5, 7)) - 1].slice(0, 3)}`

function Tile({ label, value, sub }: { label: string; value: string; sub: string }) {
  return (
    <div className="card">
      <div className="text-[12.5px] text-muted">{label}</div>
      <div className="mt-1 mb-0.5 text-[21px] font-semibold tracking-tight md:text-2xl">{value}</div>
      <div className="text-[12.5px] text-muted">{sub}</div>
    </div>
  )
}

function Numbers({ data }: { data: MuhasabahData }) {
  const n = data.numbers
  const habitPct = n.habitApplicable ? Math.round((n.habitDone / n.habitApplicable) * 100) : null
  const { min, max } = data.tentirCapacity
  return (
    <section className="mt-4 grid grid-cols-2 gap-2.5 md:gap-3 xl:grid-cols-4">
      <Tile label="Tugas selesai" value={String(n.tasksDone)} sub={`${n.tasksOpen} masih terbuka`} />
      <Tile label="Habit" value={habitPct == null ? '–' : `${habitPct}%`} sub={`${n.habitDone}/${n.habitApplicable} kotak berlaku`} />
      <Tile label="Rata-rata tidur" value={n.avgSleep == null ? '–' : formatHours(n.avgSleep)} sub="malam + qailulah, tanpa pasca-jaga" />
      <Tile label="Hari lolos" value={`${n.passDays}/${n.recordedDays}`} sub="≥ 60% isi hari selesai" />
      <Tile label="XP minggu ini" value={formatNumber(n.xp)} sub={`+${data.rules.reviewXP} bila Muhasabah selesai`} />
      <Tile label="Jaga" value={`${n.jaga} malam`} sub={n.overtime ? `lewat 21.00: ${n.overtime}×` : 'tidak pernah lewat 21.00'} />
      <Tile label="Tentir" value={`${formatNumber(n.tentirHours, 1)} j`} sub={`kapasitas ${min}–${max} j`} />
      <Tile label="Keluar" value={formatRupiah(n.expense)} sub={`masuk ${formatRupiah(n.income)}`} />
    </section>
  )
}

function TaskLists({ data }: { data: MuhasabahData }) {
  const toast = useToast()
  const role = roleLookup(data.roles)
  const nextMonday = addDays(data.monday, 7)
  const moveOpen = async () => {
    const moved = data.open.map((t) => ({ id: t.id, date: t.date }))
    await moveTasks(
      moved.map((t) => t.id),
      nextMonday,
    )
    toast({
      message: `${moved.length} tugas dipindah ke Senin depan.`,
      action: { label: 'Urungkan', onClick: () => void Promise.all(moved.map((t) => moveTasks([t.id], t.date))) },
    })
  }
  return (
    <section className="mt-3 grid gap-3 lg:grid-cols-2">
      <div className="card">
        <h2 className="card-title">
          Selesai minggu ini <span className="text-[13px] font-medium text-faint">{data.done.length}</span>
        </h2>
        {data.done.length === 0 && <p className="text-[13px] text-muted">Belum ada.</p>}
        <ul>
          {data.done.map((t) => (
            <li key={t.id} className="flex items-start gap-3 border-t border-line py-2 first:border-t-0">
              <CheckIcon size={16} className="mt-0.5 shrink-0 text-ok" aria-hidden="true" />
              <span className="flex-1 text-[13.5px]">{t.title}</span>
              <RoleTag role={role(t.roleId)} compact />
            </li>
          ))}
        </ul>
      </div>
      <div className="card">
        <h2 className="card-title">
          Belum selesai <span className="text-[13px] font-medium text-faint">{data.open.length}</span>
          <a href={routeHref('tugas', data.monday)} className="ml-auto text-[13px] font-normal text-faint hover:text-text">
            Buka papan →
          </a>
        </h2>
        {data.open.length === 0 && <p className="text-[13px] text-muted">Semua beres.</p>}
        <ul>
          {data.open.map((t) => (
            <li key={t.id} className="flex items-start gap-3 border-t border-line py-2 first:border-t-0">
              <span className="mt-0.5 w-9 shrink-0 text-xs text-faint">{DAY_SHORT[weekday(t.date)]}</span>
              <span className="flex-1 text-[13.5px]">{t.title}</span>
              <RoleTag role={role(t.roleId)} compact />
            </li>
          ))}
        </ul>
        {data.open.length > 0 && (
          <button type="button" onClick={() => void moveOpen()} className="btn-ghost mt-2 w-full justify-between border border-line">
            Pindahkan ke Senin depan <span className="text-faint">{data.open.length}</span>
          </button>
        )}
      </div>
    </section>
  )
}

/** Kolom refleksi yang tersimpan sendiri saat ditinggalkan; menolak identitas pasien. */
function Field({
  label,
  initial,
  onSave,
  rows = 2,
  placeholder,
}: {
  label: string
  initial: string
  onSave: (v: string) => Promise<void>
  rows?: number
  placeholder?: string
}) {
  const [value, setValue] = useState(initial)
  const phi = value.trim() ? detectPatientIdentity(value) : null
  const Tag = rows > 1 ? 'textarea' : 'input'
  return (
    <label className="block">
      <span className="label">{label}</span>
      <Tag
        className="field resize-y"
        rows={rows > 1 ? rows : undefined}
        value={value}
        placeholder={placeholder}
        maxLength={rows > 1 ? 1000 : 120}
        onChange={(e) => setValue(e.target.value)}
        onBlur={() => value !== initial && !phi && void onSave(value)}
      />
      {phi && (
        <span className="mt-1.5 block text-xs text-danger" role="alert">
          Mirip identitas pasien ({phi}), tidak disimpan. {PHI_HINT}
        </span>
      )}
    </label>
  )
}

function Reflection({ data, today }: { data: MuhasabahData; today: string }) {
  const toast = useToast()
  const r = data.review
  const save = (changes: Partial<Pick<Review, 'priorities' | 'wins' | 'stuck' | 'focus'>>) =>
    saveReviewText(data.monday, changes).catch((e: Error) => toast({ message: e.message, tone: 'error' }))
  const priorities = [0, 1, 2].map((i) => r.priorities[i] ?? '')
  const complete = async () => {
    try {
      await completeReview(data.monday, today, data.numbers, data.rules.reviewXP)
      toast({ message: `Muhasabah selesai · +${data.rules.reviewXP} XP. Prioritasnya tampil di Beranda minggu depan.` })
    } catch (e) {
      toast({ message: (e as Error).message, tone: 'error' })
    }
  }
  return (
    <section className="card mt-3">
      <h2 className="card-title">
        Refleksi <span className="text-[13px] font-medium text-faint">15–30 menit, tersimpan otomatis</span>
      </h2>
      <div className="grid gap-4 lg:grid-cols-3">
        <Field
          label="Apa yang berhasil?"
          initial={r.wins}
          onSave={(v) => save({ wins: v })}
          rows={3}
          placeholder="mis. qailulah konsisten setelah stase"
        />
        <Field
          label="Apa yang macet?"
          initial={r.stuck}
          onSave={(v) => save({ stuck: v })}
          rows={3}
          placeholder="mis. bank soal tertinggal saat minggu jaga"
        />
        <Field label="Fokus minggu depan" initial={r.focus} onSave={(v) => save({ focus: v })} rows={3} placeholder="satu kalimat" />
      </div>
      <div className="mt-4 grid gap-3 md:grid-cols-3">
        {priorities.map((p, i) => (
          <Field
            key={i}
            label={`Prioritas ${i + 1}`}
            initial={p}
            rows={1}
            placeholder={['mis. 200 soal kardio', 'mis. seleksi 60 abstrak SR', 'mis. tentir ≤ 12 j'][i]}
            onSave={(v) => save({ priorities: priorities.map((x, j) => (j === i ? v.trim() : x)) })}
          />
        ))}
      </div>
      <div className="mt-5 flex flex-wrap items-center gap-3 border-t border-line pt-4">
        {r.completedAt ? (
          <p className="flex items-center gap-2 text-[13px] text-ok">
            <CheckIcon size={16} aria-hidden="true" /> Selesai · +{r.xp ?? data.rules.reviewXP} XP
          </p>
        ) : data.window === 'buka' ? (
          <>
            <button
              type="button"
              className="btn-primary px-5 py-2.5"
              onClick={() => void complete()}
              disabled={!priorities.some((p) => p.trim())}
            >
              Selesaikan Muhasabah · +{data.rules.reviewXP} XP
            </button>
            <p className="text-xs text-faint">
              {priorities.some((p) => p.trim()) ? 'Sekali seminggu, Sabtu sampai Selasa.' : 'Isi minimal satu prioritas dulu.'}
            </p>
          </>
        ) : (
          <p className="text-[13px] text-muted">
            {data.window === 'belum'
              ? 'Bisa diselesaikan mulai Sabtu. Refleksi boleh dicicil dari sekarang.'
              : 'Jendela XP sudah lewat (Sabtu–Selasa). Refleksi tetap bisa ditulis.'}
          </p>
        )}
      </div>
    </section>
  )
}

export function MuhasabahPage({ date }: { date: string | null }) {
  const today = useToday()
  const [monday, setMonday] = useState(() => weekStart(date ?? today))
  const data = useMuhasabah(monday, today)
  const thisWeek = monday === weekStart(today)
  return (
    <>
      <PageTop title="Muhasabah" />
      <h1 className="mt-4 text-[26px] font-semibold tracking-tight md:hidden">Muhasabah</h1>
      <section className="mt-3 flex flex-wrap items-center gap-3 md:mt-[26px]">
        <div className="flex items-center gap-1">
          <button type="button" className="btn-ghost p-2" onClick={() => setMonday(addDays(monday, -7))} aria-label="Minggu sebelumnya">
            <ChevronLeft size={18} aria-hidden="true" />
          </button>
          <div className="min-w-[190px] text-center">
            <div className="font-serif text-xl">
              {thisWeek ? 'Minggu ini' : monday === weekStart(addDays(today, -7)) ? 'Minggu lalu' : 'Minggu'}
            </div>
            <div className="text-xs text-muted">
              {short(monday)} sampai {short(addDays(monday, 6))}
            </div>
          </div>
          <button
            type="button"
            className="btn-ghost p-2"
            onClick={() => setMonday(addDays(monday, 7))}
            aria-label="Minggu berikutnya"
            disabled={thisWeek}
          >
            <ChevronRight size={18} aria-hidden="true" />
          </button>
          {!thisWeek && (
            <button type="button" className="chip ml-1 py-1" onClick={() => setMonday(weekStart(today))}>
              Minggu ini
            </button>
          )}
        </div>
        {data?.review.completedAt ? <span className="chip ml-auto border-transparent bg-surface-2 text-ok">Selesai</span> : null}
      </section>
      {data && (
        <>
          <Numbers data={data} />
          <TaskLists data={data} />
          <Reflection key={monday} data={data} today={today} />
        </>
      )}
    </>
  )
}
