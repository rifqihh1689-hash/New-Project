import { Eye, EyeOff } from 'lucide-react'
import { routeHref } from '../../app/router'
import { HIDE_DEBT_KEY, useStoredFlag } from '../../app/useStoredFlag'
import { DAY_SHORT, weekday } from '../../domain/time'
import { formatHours } from '../../domain/time'
import { formatRupiah, formatRupiahShort } from '../../lib/format'
import type { BerandaData } from './data'
import { DAY_TYPE_COLORS } from './dayTypeColors'

export function WeekCard({ data }: { data: BerandaData }) {
  return (
    <div className="card">
      <h3 className="card-title">
        Minggu ini
        <a href={routeHref('kalender')} className="ml-auto text-[13px] font-normal text-faint hover:text-text">
          Kalender →
        </a>
      </h3>
      <div className="grid grid-cols-7 gap-1.5">
        {data.week.map(({ date, type }) => (
          <a
            key={date}
            href={routeHref('tugas', date)}
            className={`rounded-xl bg-surface-2 pt-2 pb-2.5 text-center text-xs text-muted ${date === data.today ? 'outline-[1.5px] outline-text outline-solid' : ''}`}
            aria-label={`${DAY_SHORT[weekday(date)]} ${Number(date.slice(8))}${type ? `, ${type}` : ''}`}
          >
            {DAY_SHORT[weekday(date)]}
            <b className="mt-0.5 mb-1.5 block text-[15px] font-semibold text-text">{Number(date.slice(8))}</b>
            <span
              className="mx-auto block size-2 rounded-full"
              style={{ background: type ? DAY_TYPE_COLORS[type] : 'var(--track)' }}
              aria-hidden="true"
            />
          </a>
        ))}
      </div>
      <div className="mt-3 flex flex-wrap gap-3.5 text-xs text-muted">
        {(['stase', 'jaga', 'pasca', 'libur'] as const).map((t) => (
          <span key={t} className="flex items-center gap-1.5">
            <i className="dot" style={{ background: DAY_TYPE_COLORS[t] }} />
            {{ stase: 'Stase', jaga: 'Jaga', pasca: 'Pasca-jaga', libur: 'Libur' }[t]}
          </span>
        ))}
      </div>
    </div>
  )
}

export function TentirCard({ data }: { data: BerandaData }) {
  const { sessions } = data.tentir
  return (
    <div className="card">
      <h3 className="card-title">
        Tentir <span className="text-[13px] font-medium text-faint">{sessions.length} sesi minggu ini</span>
        <a href={routeHref('tentir')} className="ml-auto text-[13px] font-normal text-faint hover:text-text">
          + Sesi
        </a>
      </h3>
      {sessions.length === 0 && <p className="text-[13px] text-muted">Belum ada sesi minggu ini.</p>}
      {sessions.map((s) => (
        <div key={s.id} className="flex items-center gap-2.5 border-t border-line py-2 text-[13px] first:border-t-0">
          <span className="w-[42px] text-xs text-muted">{DAY_SHORT[weekday(s.date)]}</span>
          <div className="flex-1">
            Murid {s.student} · {s.topic}
            <small className="block text-xs text-muted">
              {formatHours(s.hours)}
              {s.start ? ` · ${s.start}` : ''}
              {s.date === data.today ? ' · hari ini' : s.date < data.today ? ' · selesai ✓' : ''}
            </small>
          </div>
          <span className="text-[12.5px] text-muted tabular-nums">{formatRupiah(s.fee)}</span>
        </div>
      ))}
      <p className="mt-2.5 text-xs text-faint">Sesi lunas → otomatis jadi pemasukan di Uang.</p>
    </div>
  )
}

export function MoneyCard({ data }: { data: BerandaData }) {
  const { money } = data
  const [hideDebt, setHideDebt] = useStoredFlag(HIDE_DEBT_KEY, false)
  const line = (label: string, value: string) => (
    <div className="mt-3 flex justify-between text-[13px] text-muted">
      <span>{label}</span>
      <b className="font-semibold text-text">{value}</b>
    </div>
  )
  const bar = (pct: number, color: string) => (
    <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-track">
      <i className="block h-full rounded-full bar-anim" style={{ width: `${Math.max(0, Math.min(100, pct))}%`, background: color }} />
    </div>
  )
  const debtPct = money.debtInitial ? Math.round(((money.debtInitial - money.debtLeft) / money.debtInitial) * 100) : 0
  const bridgeTarget = money.bridge.reduce((s, b) => s + b.target, 0)
  const bridgeNow = money.bridge.reduce((s, b) => s + b.deposits.reduce((p, d) => p + d.amount, 0), 0)
  return (
    <div className="card">
      <h3 className="card-title">
        Uang
        {hideDebt && money.hasDebt && (
          // Tanpa teks: saat disembunyikan, kata "utang" tidak boleh terlihat.
          <button
            type="button"
            className="btn-ghost ml-auto p-1 text-faint"
            aria-label="Tampilkan bagian tersembunyi"
            onClick={() => setHideDebt(false)}
          >
            <EyeOff size={14} aria-hidden="true" />
          </button>
        )}
        <a
          href={routeHref('uang')}
          className={`${hideDebt && money.hasDebt ? '' : 'ml-auto '}text-[13px] font-normal text-faint hover:text-text`}
        >
          Buka →
        </a>
      </h3>
      {line('Masuk bulan ini', formatRupiah(money.income))}
      {line(
        'Keluar bulan ini',
        money.budget ? `${formatRupiahShort(money.expense)} / ${formatRupiahShort(money.budget)}` : formatRupiah(money.expense),
      )}
      {money.budget > 0 && bar((money.expense / money.budget) * 100, money.expense > money.budget ? 'var(--danger)' : 'var(--ok)')}
      {(!money.hasDebt || hideDebt) && !money.bridge.length && money.tentirIncome === 0 ? (
        <p className="mt-3 text-xs text-faint">
          {hideDebt ? 'Atur dana jembatan dan anggaran di halaman Uang.' : 'Atur dana jembatan, utang, dan anggaran di halaman Uang.'}
        </p>
      ) : (
        <>
          {money.hasDebt && !hideDebt && (
            <>
              <div className="mt-3 flex items-center justify-between text-[13px] text-muted">
                <span>Sisa utang</span>
                <span className="flex items-center gap-1">
                  <b className="font-semibold text-text tabular-nums">
                    {formatRupiah(money.debtLeft)} · {debtPct}% lunas
                  </b>
                  <button
                    type="button"
                    className="btn-ghost p-1"
                    aria-label="Sembunyikan utang dari layar"
                    onClick={() => setHideDebt(true)}
                  >
                    <Eye size={14} aria-hidden="true" />
                  </button>
                </span>
              </div>
              {bar(debtPct, 'var(--color-uang)')}
            </>
          )}
          {money.bridge.length > 0 && (
            <>
              {line('Dana jembatan', `${formatRupiahShort(bridgeNow)} / ${formatRupiahShort(bridgeTarget)}`)}
              {bar(bridgeTarget ? (bridgeNow / bridgeTarget) * 100 : 0, 'var(--color-tentir)')}
            </>
          )}
          {line('Masuk dari tentir (bulan ini)', formatRupiah(money.tentirIncome))}
        </>
      )}
    </div>
  )
}
