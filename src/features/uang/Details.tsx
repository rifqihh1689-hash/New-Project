import { useLiveQuery } from 'dexie-react-hooks'
import { BarChart } from '../../components/BarChart'
import { Limited } from '../../components/Limited'
import { db } from '../../db/db'
import { debtSchedule, monthlyFlow, savingSeries } from '../../domain/moneyHistory'
import { addMonths, formatDateShort, formatMonth, monthOf, MONTH_NAMES } from '../../domain/time'
import { formatRupiah, formatRupiahShort } from '../../lib/format'
import type { MonthKey } from '../../types'
import { LineChart } from '../latihan/LineChart'
import type { UangData } from './data'

const short = (m: MonthKey) => MONTH_NAMES[Number(m.slice(5, 7)) - 1].slice(0, 3)
const shortYear = (m: MonthKey) => `${short(m)} ’${m.slice(2, 4)}`
const monthLabel = (iso: string) => formatMonth(monthOf(iso))
const pct = (x: number) => `${Math.round(Math.max(0, Math.min(1, x)) * 100)}%`

const Bar = ({ value, color }: { value: number; color: string }) => (
  <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-track" aria-hidden="true">
    <div className="h-full rounded-full" style={{ width: `${Math.max(0, Math.min(1, value)) * 100}%`, background: color }} />
  </div>
)

/** Pemasukan vs pengeluaran 6 bulan terakhir + tabel. */
export function FlowDetail({ month }: { month: MonthKey }) {
  const from = addMonths(month, -5)
  const txs = useLiveQuery(() => db.transactions.where('date').between(`${from}-01`, `${month}-31`, true, true).toArray(), [from, month])
  if (!txs) return null
  const rows = monthlyFlow(txs, month)
  const active = rows.filter((r) => r.income || r.expense)
  const avg = (k: 'income' | 'expense') => (active.length ? active.reduce((a, r) => a + r[k], 0) / active.length : 0)
  return (
    <div className="grid gap-4">
      <BarChart
        label="Pemasukan dan pengeluaran 6 bulan terakhir"
        labels={rows.map((r) => short(r.month))}
        titles={rows.map((r) => formatMonth(r.month))}
        series={[
          { label: 'Pemasukan', color: 'var(--color-tentir)', values: rows.map((r) => r.income) },
          { label: 'Pengeluaran', color: 'var(--color-uang)', values: rows.map((r) => r.expense) },
        ]}
        format={formatRupiah}
        formatAxis={formatRupiahShort}
      />
      {active.length > 0 && (
        <p className="text-[13px] text-muted">
          Rata-rata per bulan: masuk <b className="font-semibold text-text">{formatRupiah(Math.round(avg('income')))}</b>, keluar{' '}
          <b className="font-semibold text-text">{formatRupiah(Math.round(avg('expense')))}</b>.
        </p>
      )}
      <table className="w-full text-[13px] tabular-nums">
        <thead className="text-xs text-faint">
          <tr>
            <th className="py-1 text-left font-medium">Bulan</th>
            <th className="py-1 text-right font-medium">Masuk</th>
            <th className="py-1 text-right font-medium">Keluar</th>
            <th className="py-1 text-right font-medium">Sisa</th>
          </tr>
        </thead>
        <tbody>
          {[...rows].reverse().map((r) => (
            <tr key={r.month} className="border-t border-line">
              <td className="py-1.5">{formatMonth(r.month)}</td>
              <td className="py-1.5 text-right">{formatRupiahShort(r.income)}</td>
              <td className="py-1.5 text-right">{formatRupiahShort(r.expense)}</td>
              <td className={`py-1.5 text-right ${r.income - r.expense < 0 ? 'text-danger' : ''}`}>
                {formatRupiahShort(r.income - r.expense)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

/** Total terkumpul dari waktu ke waktu + rincian per tabungan. */
export function SavingsDetail({ data }: { data: UangData }) {
  const series = savingSeries(data.savings.map((x) => x.s))
  const target = data.savings.reduce((a, x) => a + x.plan.target, 0)
  const done = data.savings.reduce((a, x) => a + x.plan.done, 0)
  const deposits = data.savings
    .flatMap(({ s }) => s.deposits.map((d) => ({ ...d, name: s.name })))
    .sort((a, b) => b.date.localeCompare(a.date))
  return (
    <div className="grid gap-4">
      <div>
        <div className="text-xs text-muted">Total terkumpul</div>
        <div className="text-[22px] font-semibold tabular-nums">
          {formatRupiah(done)}{' '}
          <span className="text-[13px] font-normal text-faint">
            / {formatRupiah(target)} · {pct(target ? done / target : 0)}
          </span>
        </div>
      </div>
      {series.length >= 2 ? (
        <LineChart
          label="Total tabungan terkumpul"
          points={series}
          target={target ? { y: target, label: 'target' } : undefined}
          format={formatRupiahShort}
          formatX={formatDateShort}
        />
      ) : (
        <p className="text-[13px] text-muted">Grafik muncul setelah ada dua setoran atau lebih.</p>
      )}
      <ul className="grid gap-3">
        {data.savings.map(({ s, plan }) => (
          <li key={s.id} className="text-[13.5px]">
            <div className="flex justify-between gap-2">
              <span className="font-medium">{s.name}</span>
              <span className="text-muted tabular-nums">{pct(plan.pct)}</span>
            </div>
            <div className="text-xs text-muted tabular-nums">
              {formatRupiah(plan.done)} / {formatRupiah(plan.target)}
              {plan.left === 0
                ? ' · tercapai'
                : plan.perMonth
                  ? ` · ${formatRupiahShort(plan.perMonth)}/bln sampai ${monthLabel(s.targetDate!)}`
                  : ''}
            </div>
            <Bar value={plan.pct} color={s.kind === 'jembatan' ? 'var(--color-tentir)' : 'var(--ok)'} />
          </li>
        ))}
      </ul>
      {deposits.length > 0 && (
        <section>
          <h3 className="mb-1 text-[13px] font-semibold">Riwayat setoran</h3>
          <Limited items={deposits} limit={5}>
            {(list) => (
              <ul className="text-[13px]">
                {list.map((d, i) => (
                  <li key={`${d.date}-${i}`} className="flex justify-between border-t border-line py-1.5 first:border-t-0">
                    <span>
                      {d.name} <span className="text-xs text-muted">{formatDateShort(d.date)}</span>
                    </span>
                    <span className={`tabular-nums ${d.amount < 0 ? 'text-danger' : ''}`}>{formatRupiah(d.amount)}</span>
                  </li>
                ))}
              </ul>
            )}
          </Limited>
        </section>
      )}
    </div>
  )
}

/** Proyeksi cicilan per bulan sampai lunas + sisa dari waktu ke waktu + rincian per utang. */
export function DebtDetail({ data }: { data: UangData }) {
  const { months, unscheduled, payoff } = debtSchedule(
    data.debts.map((x) => x.d),
    data.today,
  )
  const left = data.debts.reduce((a, x) => a + x.plan.left, 0)
  const total = data.debts.reduce((a, x) => a + x.plan.target, 0)
  return (
    <div className="grid gap-4">
      <div>
        <div className="text-xs text-muted">Sisa</div>
        <div className="text-[22px] font-semibold tabular-nums">
          {formatRupiah(left)} <span className="text-[13px] font-normal text-faint">· {pct(total ? 1 - left / total : 0)} lunas</span>
        </div>
        {payoff && <p className="mt-1 text-[13px] text-muted">Perkiraan lunas semua: {formatMonth(payoff)}.</p>}
      </div>
      {months.length > 0 && (
        <>
          <section>
            <h3 className="mb-1 text-[13px] font-semibold">Cicilan per bulan</h3>
            <BarChart
              label="Perkiraan cicilan per bulan sampai lunas"
              labels={months.map((m) => (months.length > 12 ? short(m.month)[0] : months.length > 6 ? short(m.month) : shortYear(m.month)))}
              titles={months.map((m) => formatMonth(m.month))}
              series={[{ label: 'Cicilan', color: 'var(--color-uang)', values: months.map((m) => m.payment) }]}
              format={formatRupiah}
              formatAxis={formatRupiahShort}
            />
            <p className="mt-1 text-xs text-faint">Perkiraan dari sisa tiap utang dibagi rata sampai tanggal targetnya.</p>
          </section>
          {months.length >= 2 && (
            <section>
              <h3 className="mb-1 text-[13px] font-semibold">Sisa dari bulan ke bulan</h3>
              <LineChart
                label="Perkiraan sisa setelah cicilan tiap bulan"
                points={months.map((m) => ({ x: `${m.month}-01`, y: m.remaining }))}
                format={formatRupiahShort}
                formatX={monthLabel}
                color="var(--color-uang)"
              />
            </section>
          )}
        </>
      )}
      {unscheduled > 0 && (
        <p className="text-xs text-muted">{formatRupiah(unscheduled)} belum punya tanggal target, jadi belum masuk proyeksi.</p>
      )}
      <ul className="grid gap-3">
        {data.debts.map(({ d, plan }) => (
          <li key={d.id} className="text-[13.5px]">
            <div className="flex justify-between gap-2">
              <span className="font-medium">{d.name}</span>
              <span className="shrink-0 text-muted tabular-nums">{pct(plan.pct)}</span>
            </div>
            <div className="text-xs text-muted tabular-nums">
              sisa {formatRupiah(plan.left)}
              {plan.left === 0 ? ' · lunas' : d.targetDate ? ` · lunas ${monthLabel(d.targetDate)}` : ''}
            </div>
            <Bar value={plan.pct} color="var(--color-uang)" />
          </li>
        ))}
      </ul>
    </div>
  )
}
