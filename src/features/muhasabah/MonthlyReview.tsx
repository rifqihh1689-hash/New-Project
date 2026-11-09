import { ChevronLeft, ChevronRight, ClipboardCopy } from 'lucide-react'
import { useState } from 'react'
import { HIDE_DEBT_KEY, useStoredFlag } from '../../app/useStoredFlag'
import { useToday } from '../../app/useToday'
import { useToast } from '../../components/toast-context'
import { completeMonthReview, restoreReview, saveMonthReviewText } from '../../db/review'
import { detectPatientIdentity } from '../../domain/phi'
import { addMonths, formatHours, formatMonth, monthOf } from '../../domain/time'
import { formatNumber, formatRupiah } from '../../lib/format'
import type { Review } from '../../types'
import { useMonthly, type MonthlyData } from './monthly'

const shortDate = (d: string) => `${Number(d.slice(8))}/${Number(d.slice(5, 7))}`

function Delta({
  now,
  before,
  unit = '',
  better = 'up',
}: {
  now: number | null
  before: number | null
  unit?: string
  better?: 'up' | 'down'
}) {
  if (now == null || before == null || now === before) return null
  const diff = Math.round((now - before) * 10) / 10
  const good = better === 'up' ? diff > 0 : diff < 0
  return (
    <span className={good ? 'text-ok' : 'text-uang'}>
      {' '}
      {diff > 0 ? '▲' : '▼'} {formatNumber(Math.abs(diff), 1)}
      {unit} vs bulan lalu
    </span>
  )
}

function Tiles({ data }: { data: MonthlyData }) {
  const n = data.numbers
  const p = data.prev
  const tile = (label: string, value: string, sub: React.ReactNode) => (
    <div className="card">
      <div className="text-[12.5px] text-muted">{label}</div>
      <div className="mt-1 mb-0.5 text-[21px] font-semibold tracking-tight md:text-2xl">{value}</div>
      <div className="text-[12.5px] text-muted">{sub}</div>
    </div>
  )
  return (
    <section className="stagger mt-4 grid grid-cols-2 gap-2.5 md:gap-3 xl:grid-cols-4">
      {tile(
        'XP bulan ini',
        formatNumber(n.xp),
        data.complete ? (
          <Delta now={n.xp} before={p.recordedDays ? p.xp : null} />
        ) : (
          `berjalan ${data.elapsed} dari ${data.totalDays} hari · bulan lalu ${formatNumber(p.xp)}`
        ),
      )}
      {tile('Hari lolos', `${n.passDays}/${n.recordedDays}`, 'hari bertipe yang ≥ 60% selesai')}
      {tile(
        'Rata-rata tidur',
        n.avgSleep == null ? '–' : formatHours(n.avgSleep),
        <>
          tanpa pasca-jaga
          <Delta now={n.avgSleep} before={p.avgSleep} unit=" j" />
        </>,
      )}
      {tile('Jaga', `${n.jaga} malam`, n.overtime ? `lembur malam ${n.overtime}×` : 'tanpa lembur malam')}
    </section>
  )
}

function Weeks({ data }: { data: MonthlyData }) {
  const sj = data.sleepJaga
  return (
    <section className="card">
      <h2 className="card-title">Tren per minggu</h2>
      <table className="w-full text-[13px] tabular-nums">
        <thead>
          <tr className="text-left text-xs text-faint">
            <th className="pb-1 font-normal">Minggu</th>
            <th className="pb-1 text-right font-normal">XP</th>
            <th className="pb-1 text-right font-normal">Lolos</th>
            <th className="pb-1 text-right font-normal">Jaga</th>
            <th className="pb-1 text-right font-normal">Tidur</th>
          </tr>
        </thead>
        <tbody>
          {data.weeks.map((w) => (
            <tr key={w.monday} className="border-t border-line">
              <td className="py-1.5">{shortDate(w.monday)}</td>
              <td className="py-1.5 text-right">{w.n.xp}</td>
              <td className="py-1.5 text-right">
                {w.n.passDays}/{w.n.recordedDays}
              </td>
              <td className="py-1.5 text-right">{w.n.jaga}</td>
              <td className={`py-1.5 text-right ${w.n.avgSleep != null && w.n.avgSleep < 5.5 ? 'text-uang' : ''}`}>
                {w.n.avgSleep == null ? '–' : formatNumber(w.n.avgSleep, 1)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      {sj.heavy != null && sj.light != null && (
        <p className="mt-2 text-xs text-muted">
          Minggu dengan ≥ 2 jaga: tidur rata-rata <b className="font-semibold text-text">{formatNumber(sj.heavy, 1)} j</b> vs minggu lain{' '}
          <b className="font-semibold text-text">{formatNumber(sj.light, 1)} j</b>.
        </p>
      )}
    </section>
  )
}

function Areas({ data }: { data: MonthlyData }) {
  const [hideDebt] = useStoredFlag(HIDE_DEBT_KEY, false)
  const x = data.extras
  const n = data.numbers
  const habitPct = n.habitApplicable ? Math.round((n.habitDone / n.habitApplicable) * 100) : null
  const row = (label: string, value: string) => (
    <li key={label} className="flex gap-2 border-t border-line py-1.5 first:border-t-0">
      <span className="flex-1 text-muted">{label}</span>
      <span className="text-right tabular-nums">{value}</span>
    </li>
  )
  return (
    <section className="card">
      <h2 className="card-title">Per bidang</h2>
      <ul className="text-[13px]">
        {x.tasksByRole.map((r) => row(r.name, `${r.done}/${r.total} tugas`))}
        {row('Habit', habitPct == null ? '–' : `${habitPct}% (${n.habitDone}/${n.habitApplicable})`)}
        {x.mutabaah.map((m) => row(m.name, `${m.days}/${m.of} hari`))}
        {row(
          'Tentir',
          `${formatNumber(x.tentir.hours, 1)} j · ${formatRupiah(x.tentir.income)}${x.tentir.perHour ? ` · ${formatRupiah(x.tentir.perHour)}/j` : ''}`,
        )}
        {row(
          'Uang',
          `masuk ${formatRupiah(x.money.income)} · keluar ${formatRupiah(x.money.expense)}${x.money.budget ? ` / ${formatRupiah(x.money.budget)}` : ''}`,
        )}
        {x.money.bridge && row('Dana jembatan', `${formatRupiah(x.money.bridge.saved)} / ${formatRupiah(x.money.bridge.target)}`)}
        {x.money.debtLeft > 0 && !hideDebt && row('Sisa utang', formatRupiah(x.money.debtLeft))}
        {row(
          'Latihan',
          `${x.training.strength} sesi beban · ${formatNumber(x.training.runKm, 1)} km lari${x.training.benchEnd != null ? ` · bench ${formatNumber(x.training.benchStart ?? 0, 1)} → ${formatNumber(x.training.benchEnd, 1)} kg` : ''}`,
        )}
      </ul>
    </section>
  )
}

function Reflection({ data }: { data: MonthlyData }) {
  const toast = useToast()
  const today = useToday()
  const [r, setR] = useState<Review>(data.review)
  const save = async (changes: Partial<Pick<Review, 'priorities' | 'wins' | 'stuck' | 'focus'>>) => {
    try {
      await saveMonthReviewText(data.month, changes)
    } catch (e) {
      toast({ message: (e as Error).message, tone: 'error' })
    }
  }
  const field = (key: 'wins' | 'stuck' | 'focus', label: string, placeholder: string) => (
    <label className="block">
      <span className="label">{label}</span>
      <textarea
        className="field min-h-[72px] resize-y"
        value={r[key]}
        placeholder={placeholder}
        onChange={(e) => setR({ ...r, [key]: e.target.value })}
        onBlur={() => void save({ [key]: r[key] })}
      />
      {detectPatientIdentity(r[key]) && <span className="mt-1 block text-xs text-danger">Mirip identitas pasien.</span>}
    </label>
  )
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(data.text)
      toast({ message: 'Ringkasan disalin. Tempel ke Claude untuk dianalisis.' })
    } catch {
      toast({ message: 'Tidak bisa menyalin otomatis di browser ini.', tone: 'error' })
    }
  }
  const complete = async () => {
    try {
      const before = await completeMonthReview(data.month, today, data.numbers)
      toast({
        message: 'Muhasabah bulan ini selesai. Prioritasnya tampil untuk bulan depan.',
        action: { label: 'Urungkan', onClick: () => void restoreReview(before) },
      })
    } catch (e) {
      toast({ message: (e as Error).message, tone: 'error' })
    }
  }
  return (
    <section className="card">
      <h2 className="card-title">Refleksi bulan ini</h2>
      <div className="grid gap-3">
        {field('wins', 'Yang berjalan baik', 'mis. tidur ≥ 6 j di minggu ringan, bank soal konsisten')}
        {field('stuck', 'Yang macet & kenapa', 'mis. 3 jaga berturut, belajar terhenti')}
        {field('focus', 'Fokus bulan depan', 'satu kalimat')}
        <div>
          <span className="label">3 prioritas bulan depan</span>
          <div className="grid gap-1.5">
            {[0, 1, 2].map((i) => (
              <input
                key={i}
                className="field"
                value={r.priorities[i] ?? ''}
                placeholder={`Prioritas ${i + 1}`}
                aria-label={`Prioritas bulan depan ${i + 1}`}
                onChange={(e) => setR({ ...r, priorities: r.priorities.map((p, j) => (j === i ? e.target.value : p)) })}
                onBlur={() => void save({ priorities: r.priorities })}
              />
            ))}
          </div>
        </div>
      </div>
      <div className="mt-4 flex flex-wrap gap-2">
        <button type="button" className="btn-ghost border border-line" onClick={() => void copy()}>
          <ClipboardCopy size={15} aria-hidden="true" /> Salin ringkasan untuk Claude
        </button>
        <button type="button" className="btn-primary flex-1" disabled={!data.canComplete} onClick={() => void complete()}>
          {data.review.completedAt ? 'Perbarui angka' : 'Selesaikan Muhasabah bulanan'}
        </button>
      </div>
      <p className="mt-2 text-xs text-faint">
        {data.canComplete
          ? 'Angka bulan ini disimpan agar Claude (lewat connector) bisa membandingkan antar bulan. Tanpa XP; XP tetap dari Muhasabah mingguan.'
          : 'Bisa diselesaikan mulai tanggal 25. Refleksi boleh diisi kapan saja.'}
      </p>
    </section>
  )
}

export function MonthlyReview() {
  const today = useToday()
  const [month, setMonth] = useState(() => monthOf(today))
  const data = useMonthly(month, today)
  const thisMonth = month === monthOf(today)
  return (
    <>
      <section className="mt-3 flex flex-wrap items-center gap-3">
        <div className="flex items-center gap-1">
          <button type="button" className="btn-ghost p-2" onClick={() => setMonth(addMonths(month, -1))} aria-label="Bulan sebelumnya">
            <ChevronLeft size={18} aria-hidden="true" />
          </button>
          <div className="min-w-[170px] text-center font-serif text-xl">{formatMonth(month)}</div>
          <button
            type="button"
            className="btn-ghost p-2"
            onClick={() => setMonth(addMonths(month, 1))}
            aria-label="Bulan berikutnya"
            disabled={thisMonth}
          >
            <ChevronRight size={18} aria-hidden="true" />
          </button>
        </div>
        {data?.review.completedAt ? <span className="chip ml-auto border-transparent bg-surface-2 text-ok">Selesai</span> : null}
      </section>
      {data && (
        <>
          <Tiles data={data} />
          <div className="stagger mt-3 grid items-start gap-3 lg:grid-cols-2">
            <Weeks data={data} />
            <Areas data={data} />
            <Reflection key={month} data={data} />
          </div>
        </>
      )}
    </>
  )
}
