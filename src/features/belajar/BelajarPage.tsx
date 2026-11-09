import { Plus } from 'lucide-react'
import { useState } from 'react'
import { useToday } from '../../app/useToday'
import { Limited } from '../../components/Limited'
import { PageTop } from '../../components/PageTop'
import { Sheet } from '../../components/Sheet'
import { useToast } from '../../components/toast-context'
import { deleteStudyLog, restoreStudyLog, saveStudyLog, saveStudyTarget } from '../../db/study'
import { MIN_FOR_RANKING, STUDY_SYSTEMS } from '../../domain/study'
import { formatDateShort } from '../../domain/time'
import { formatNumber } from '../../lib/format'
import type { StudyLog } from '../../types'
import { CardsTab } from './CardsTab'
import { useBelajar, type BelajarData } from './data'

const pct = (x: number | null) => (x == null ? '–' : `${Math.round(x * 100)}%`)

/** Hijau ≥ 75%, kuning 60–74%, merah < 60% (ambang kasar kelulusan; hanya penunjuk, bukan nilai resmi). */
const tone = (a: number | null) => (a == null ? 'var(--track)' : a >= 0.75 ? 'var(--ok)' : a >= 0.6 ? 'var(--color-uang)' : 'var(--danger)')

function Tiles({ data }: { data: BelajarData }) {
  const { week, countdown: c, target } = data
  return (
    <section className="mt-3 grid gap-3 sm:grid-cols-3">
      <div className="card">
        <div className="text-xs text-muted">Soal minggu ini</div>
        <div className="mt-1 text-[22px] font-semibold tabular-nums">
          {formatNumber(week.done, 0)}
          <span className="text-[13px] font-normal text-faint"> / {formatNumber(target.weeklyQuestions, 0)}</span>
        </div>
        <div className="relative my-2.5 h-1.5 rounded-full bg-track" aria-hidden="true">
          <div
            className={`absolute inset-y-0 left-0 rounded-full ${week.behind ? 'bg-uang' : 'bg-tentir'}`}
            style={{ width: `${Math.min(100, week.ratio * 100)}%` }}
          />
        </div>
        <p className={`text-xs ${week.behind ? 'text-uang' : 'text-muted'}`}>
          {week.perDayLeft === 0
            ? 'Target minggu ini tercapai.'
            : week.behind
              ? `Agak tertinggal. ${week.perDayLeft} soal/hari sampai Minggu.`
              : `${week.perDayLeft} soal/hari sampai Minggu.`}
        </p>
      </div>
      <div className="card">
        <div className="text-xs text-muted">Akurasi keseluruhan</div>
        <div className="mt-1 text-[22px] font-semibold tabular-nums">{pct(data.accuracy)}</div>
        <p className="mt-2 text-xs text-muted">
          {formatNumber(data.answered, 0)} soal dikerjakan · rata-rata {formatNumber(data.average, 0)}/minggu (4 minggu penuh terakhir)
        </p>
      </div>
      <div className="card">
        <div className="text-xs text-muted">UKMPPD</div>
        <div className="mt-1 text-[22px] font-semibold tabular-nums">{c ? `${formatNumber(c.days, 0)} hari` : '–'}</div>
        <p className="mt-2 text-xs text-muted">
          {c ? `±${c.weeks} minggu lagi. Ubah tanggal di bawah.` : 'Isi tanggal ujian di bagian Target di bawah.'}
        </p>
      </div>
    </section>
  )
}

function Systems({ data }: { data: BelajarData }) {
  const max = Math.max(1, ...data.stats.map((s) => s.total))
  return (
    <section className="card">
      <h2 className="card-title">Per sistem</h2>
      {data.weakest && (
        <p className="mb-2 text-[13px] text-muted">
          Terlemah: <b className="font-semibold text-text">{data.weakest.system}</b> ({pct(data.weakest.accuracy)}).
          {data.stalest && data.stalest.system !== data.weakest.system && (
            <>
              {' '}
              Paling lama tidak disentuh: <b className="font-semibold text-text">{data.stalest.system}</b>
              {data.stalest.lastDate ? ` (${formatDateShort(data.stalest.lastDate)})` : ' (belum pernah)'}.
            </>
          )}
        </p>
      )}
      <ul>
        {data.stats.map((s) => (
          <li key={s.system} className="border-t border-line py-2 text-[13.5px] first:border-t-0">
            <div className="flex justify-between gap-2">
              <span>{s.system}</span>
              <span className="text-muted tabular-nums">
                {s.total ? `${pct(s.accuracy)} · ${formatNumber(s.total, 0)} soal` : <span className="text-faint">belum ada</span>}
              </span>
            </div>
            <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-track" aria-hidden="true">
              <div className="h-full rounded-full" style={{ width: `${(s.total / max) * 100}%`, background: tone(s.accuracy) }} />
            </div>
          </li>
        ))}
      </ul>
      <p className="mt-2 text-xs text-faint">
        Panjang bar = jumlah soal; warna = akurasi (hijau ≥ 75%, kuning ≥ 60%). Dianggap "terlemah" setelah ≥ {MIN_FOR_RANKING} soal.
      </p>
    </section>
  )
}

function History({ data, onEdit }: { data: BelajarData; onEdit: (l: StudyLog) => void }) {
  return (
    <section className="card">
      <h2 className="card-title">Riwayat</h2>
      {!data.logs.length && <p className="text-[13px] text-muted">Belum ada catatan. Catat setelah selesai satu blok soal.</p>}
      <Limited items={data.logs}>
        {(list) => (
          <ul>
            {list.map((l) => (
              <li key={l.id}>
                <button
                  type="button"
                  onClick={() => onEdit(l)}
                  className="flex w-full items-center gap-2 border-t border-line py-2 text-left text-[13.5px] first:border-t-0"
                >
                  <span className="flex-1">
                    {l.system}
                    {l.kind === 'tryout' && <span className="ml-1.5 text-[11px] text-tentir">tryout</span>}
                    <span className="block text-xs text-muted">
                      {formatDateShort(l.date)}
                      {l.note ? ` · ${l.note}` : ''}
                    </span>
                  </span>
                  <span className="text-right tabular-nums">
                    {l.correct}/{l.total}
                    <span className="block text-xs" style={{ color: tone(l.correct / l.total) }}>
                      {pct(l.correct / l.total)}
                    </span>
                  </span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </Limited>
    </section>
  )
}

function Target({ data }: { data: BelajarData }) {
  const toast = useToast()
  const save = async (changes: Parameters<typeof saveStudyTarget>[0]) => {
    try {
      await saveStudyTarget(changes)
    } catch (e) {
      toast({ message: (e as Error).message, tone: 'error' })
    }
  }
  return (
    <section className="card">
      <h2 className="card-title">Target</h2>
      <div className="grid grid-cols-2 gap-3">
        <label className="text-xs text-muted">
          Tanggal UKMPPD
          <input
            type="date"
            className="field mt-1"
            defaultValue={data.target.examDate ?? ''}
            onBlur={(e) => void save({ examDate: e.target.value || null })}
          />
        </label>
        <label className="text-xs text-muted">
          Soal per minggu
          <input
            type="number"
            inputMode="numeric"
            min={1}
            className="field mt-1"
            defaultValue={data.target.weeklyQuestions}
            onBlur={(e) => void save({ weeklyQuestions: Number(e.target.value) })}
          />
        </label>
      </div>
      <p className="mt-2 text-xs text-faint">
        Tanggal ujian dipakai untuk hitung mundur dan temuan di Beranda. Target bisa diubah kapan saja.
      </p>
    </section>
  )
}

interface Draft {
  id?: string
  date: string
  system: string
  kind: StudyLog['kind']
  total: string
  correct: string
  note: string
  wrongFront: string
  wrongBack: string
}

function LogForm({ draft, onClose }: { draft: Draft; onClose: () => void }) {
  const toast = useToast()
  const [d, setD] = useState(draft)
  const total = Number(d.total)
  const correct = Number(d.correct)
  const ok = total >= 1 && correct >= 0 && correct <= total
  const save = async () => {
    try {
      await saveStudyLog({
        id: d.id,
        date: d.date,
        system: d.system,
        kind: d.kind,
        total,
        correct,
        note: d.note,
        wrong: { front: d.wrongFront, back: d.wrongBack },
      })
      onClose()
    } catch (e) {
      toast({ message: (e as Error).message, tone: 'error' })
    }
  }
  const remove = async () => {
    if (!d.id) return
    const row = await deleteStudyLog(d.id)
    onClose()
    if (row) toast({ message: 'Dihapus.', action: { label: 'Urungkan', onClick: () => void restoreStudyLog(row) } })
  }
  return (
    <div className="grid gap-3">
      <label className="text-xs text-muted">
        Sistem
        <select className="field mt-1" value={d.system} onChange={(e) => setD({ ...d, system: e.target.value })}>
          {STUDY_SYSTEMS.map((s) => (
            <option key={s}>{s}</option>
          ))}
        </select>
      </label>
      <div className="grid grid-cols-3 gap-2">
        <label className="text-xs text-muted">
          Soal
          <input
            type="number"
            inputMode="numeric"
            min={1}
            className="field mt-1"
            value={d.total}
            autoFocus
            onChange={(e) => setD({ ...d, total: e.target.value })}
          />
        </label>
        <label className="text-xs text-muted">
          Benar
          <input
            type="number"
            inputMode="numeric"
            min={0}
            className="field mt-1"
            value={d.correct}
            onChange={(e) => setD({ ...d, correct: e.target.value })}
          />
        </label>
        <label className="text-xs text-muted">
          Tanggal
          <input type="date" className="field mt-1" value={d.date} onChange={(e) => setD({ ...d, date: e.target.value })} />
        </label>
      </div>
      {total >= 1 && correct > total && <p className="text-xs text-danger">Benar tidak boleh melebihi jumlah soal.</p>}
      <div className="flex gap-1.5" role="radiogroup" aria-label="Jenis">
        {(['soal', 'tryout'] as const).map((k) => (
          <button
            key={k}
            type="button"
            role="radio"
            aria-checked={d.kind === k}
            onClick={() => setD({ ...d, kind: k })}
            className={`chip py-1 ${d.kind === k ? 'border-transparent bg-btn text-btn-text' : ''}`}
          >
            {k === 'soal' ? 'Latihan soal' : 'Tryout'}
          </button>
        ))}
      </div>
      <input
        className="field"
        value={d.note}
        maxLength={120}
        onChange={(e) => setD({ ...d, note: e.target.value })}
        placeholder="Catatan (mis. topik lemah). Tanpa identitas pasien."
        aria-label="Catatan"
      />
      {!d.id && (
        <details className="rounded-xl border border-line px-3 py-2">
          <summary className="cursor-pointer text-[13px] text-muted">Ada yang salah? Buat kartu ulasan</summary>
          <div className="mt-2 grid gap-2">
            <textarea
              className="field min-h-[60px] resize-y"
              value={d.wrongFront}
              maxLength={600}
              onChange={(e) => setD({ ...d, wrongFront: e.target.value })}
              placeholder="Konsep atau pertanyaan yang terlewat"
              aria-label="Kartu: sisi depan"
            />
            <textarea
              className="field min-h-[60px] resize-y"
              value={d.wrongBack}
              maxLength={1200}
              onChange={(e) => setD({ ...d, wrongBack: e.target.value })}
              placeholder="Jawaban benar dan kenapa"
              aria-label="Kartu: sisi belakang"
            />
            <p className="text-xs text-faint">Jadi kartu di tab Kartu ulasan, dijadwalkan hari ini lalu 1, 3, 8 hari dst.</p>
          </div>
        </details>
      )}
      <div className="flex gap-2">
        {d.id && (
          <button type="button" className="btn-ghost border border-line" onClick={() => void remove()}>
            Hapus
          </button>
        )}
        <button type="button" className="btn-primary flex-1 py-3" disabled={!ok} onClick={() => void save()}>
          Simpan
        </button>
      </div>
    </div>
  )
}

export function BelajarPage() {
  const today = useToday()
  const data = useBelajar(today)
  const [editing, setEditing] = useState<Draft | null>(null)
  const [tab, setTab] = useState<'soal' | 'kartu'>('soal')
  const draftFor = (l?: StudyLog): Draft =>
    l
      ? {
          id: l.id,
          date: l.date,
          system: l.system,
          kind: l.kind,
          total: String(l.total),
          correct: String(l.correct),
          note: l.note ?? '',
          wrongFront: '',
          wrongBack: '',
        }
      : {
          date: today,
          system: data?.stalest?.system ?? STUDY_SYSTEMS[0],
          kind: 'soal',
          total: '',
          correct: '',
          note: '',
          wrongFront: '',
          wrongBack: '',
        }
  return (
    <>
      <PageTop title="Belajar UKMPPD" />
      <h1 className="mt-4 text-[26px] font-semibold tracking-tight md:hidden">Belajar UKMPPD</h1>
      <div role="tablist" aria-label="Bagian Belajar" className="mt-3 flex gap-1 rounded-full bg-surface-2 p-[3px] md:mt-[26px] md:w-fit">
        {(
          [
            ['soal', 'Soal'],
            ['kartu', 'Kartu ulasan'],
          ] as const
        ).map(([v, label]) => (
          <button
            key={v}
            type="button"
            role="tab"
            aria-selected={tab === v}
            onClick={() => setTab(v)}
            className={`shrink-0 rounded-full px-3.5 py-1.5 text-[13px] ${tab === v ? 'bg-surface text-text shadow-sm' : 'text-muted'}`}
          >
            {label}
          </button>
        ))}
      </div>
      {tab === 'kartu' && <CardsTab />}
      {tab === 'soal' && (
        <div className="mt-3 flex">
          <button type="button" className="btn-primary" onClick={() => setEditing(draftFor())}>
            <Plus size={15} aria-hidden="true" /> Catat soal
          </button>
        </div>
      )}
      {tab === 'soal' && data && (
        <>
          <Tiles data={data} />
          <div className="stagger mt-3 grid items-start gap-3 lg:grid-cols-2">
            <Systems data={data} />
            <div className="grid gap-3">
              <Target data={data} />
              <History data={data} onEdit={(l) => setEditing(draftFor(l))} />
            </div>
          </div>
        </>
      )}
      <Sheet open={!!editing} title={editing?.id ? 'Ubah catatan soal' : 'Catat soal'} onClose={() => setEditing(null)}>
        {editing && <LogForm key={editing.id ?? 'baru'} draft={editing} onClose={() => setEditing(null)} />}
      </Sheet>
    </>
  )
}
