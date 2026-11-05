import { useState } from 'react'
import { formatMultiplier } from '../../domain/sleep'
import { formatHours, formatMonth, monthOf } from '../../domain/time'
import { formatNumber, formatRupiah } from '../../lib/format'
import type { BerandaData } from './data'
import { SleepSheet } from './SleepSheet'

export function StatCards({ data, isPasca }: { data: BerandaData; isPasca: boolean }) {
  const [sleepOpen, setSleepOpen] = useState(false)
  const { snap, sleep, tentir, money, rules } = data
  const type = snap.result.effType
  const tasks = snap.rows.filter((r) => r.kind === 'task')
  const doneTasks = tasks.filter((t) => t.done).length
  const important = tasks.filter((t) => !t.done && t.important).length

  let sleepSub: React.ReactNode
  if (snap.day?.sleepNight == null) sleepSub = 'Ketuk untuk isi jam tidur'
  else if (type === 'jaga')
    sleepSub = (
      <>
        Jaga: pengali tetap <em className="text-text not-italic">{formatMultiplier(rules.jagaMult)}</em>
      </>
    )
  else if (type === 'pasca')
    sleepSub = (
      <>
        Tidur pulih <em className="text-text not-italic">2–3 j</em> setelah pulang
      </>
    )
  else if (sleep.next)
    sleepSub = (
      <>
        Qailulah <em className="text-text not-italic">{sleep.next.minutes} mnt</em> lagi → {formatMultiplier(sleep.next.mult)}
      </>
    )
  else
    sleepSub = (
      <>
        Pengali tertinggi <em className="text-text not-italic">{formatMultiplier(snap.result.mult)}</em>
      </>
    )

  const { min, max } = tentir.capacity
  const tentirSub =
    tentir.hours === 0 ? (
      'belum ada sesi minggu ini'
    ) : tentir.hours < min ? (
      <>
        kurang <em className="text-text not-italic">{formatHours(min - tentir.hours)}</em> lagi
      </>
    ) : tentir.hours > max ? (
      <>
        lewat kapasitas <em className="text-text not-italic">{formatHours(tentir.hours - max)}</em>
      </>
    ) : (
      'dalam kapasitas'
    )

  const budgetPct = money.budget ? Math.round((money.expense / money.budget) * 100) : null
  return (
    <section className={`mb-3 grid grid-cols-2 gap-2.5 md:gap-3 ${isPasca ? '' : 'xl:grid-cols-4'}`}>
      <button type="button" onClick={() => setSleepOpen(true)} className="card text-left transition hover:border-faint">
        <div className="text-[12.5px] text-muted">Tidur 24 jam</div>
        <div className="mt-1 mb-0.5 text-[21px] font-semibold tracking-tight md:text-2xl">
          {sleep.total == null ? '–' : formatHours(sleep.total)}
        </div>
        <div className="text-[12.5px] text-muted">{sleepSub}</div>
      </button>
      <div className="card">
        <div className="text-[12.5px] text-muted">Tugas hari ini</div>
        <div className="mt-1 mb-0.5 text-[21px] font-semibold tracking-tight md:text-2xl">
          {doneTasks} / {tasks.length}
        </div>
        <div className="text-[12.5px] text-muted">
          {tasks.length === 0
            ? 'belum ada tugas'
            : doneTasks === tasks.length
              ? 'semua beres'
              : `sisa ${tasks.length - doneTasks}${important ? ` · ${important} penting` : ''}`}
        </div>
      </div>
      {!isPasca && (
        <div className="card">
          <div className="text-[12.5px] text-muted">Tentir minggu ini</div>
          <div className="mt-1 mb-0.5 text-[21px] font-semibold tracking-tight md:text-2xl">
            {formatNumber(tentir.hours, 1)} j{' '}
            <span className="text-sm font-medium text-muted">
              / {min}–{max} j
            </span>
          </div>
          <div className="relative my-2.5 h-1.5 rounded-full bg-track" aria-hidden="true">
            <div
              className="absolute inset-y-0 right-0 rounded-full"
              style={{ left: `${(min / max) * 100}%`, background: 'color-mix(in srgb, var(--color-tentir) 22%, transparent)' }}
            />
            <div
              className="absolute inset-y-0 left-0 rounded-full bg-tentir bar-anim"
              style={{ width: `${Math.min(100, (tentir.hours / max) * 100)}%` }}
            />
          </div>
          <div className="text-[12.5px] text-muted">{tentirSub}</div>
        </div>
      )}
      {!isPasca && (
        <div className="card">
          <div className="text-[12.5px] text-muted">Pengeluaran {formatMonth(monthOf(data.today)).split(' ')[0]}</div>
          <div className="mt-1 mb-0.5 text-[21px] font-semibold tracking-tight md:text-2xl">{formatRupiah(money.expense)}</div>
          <div className="text-[12.5px] text-muted">
            {budgetPct == null ? (
              'anggaran diatur di Uang'
            ) : (
              <>
                <em className="text-text not-italic">{budgetPct}%</em> dari anggaran ·{' '}
                {budgetPct > 100 ? 'terlampaui' : budgetPct >= 80 ? 'hampir habis' : 'aman'}
              </>
            )}
          </div>
        </div>
      )}
      <SleepSheet open={sleepOpen} onClose={() => setSleepOpen(false)} date={data.today} day={snap.day} rules={rules} />
    </section>
  )
}
