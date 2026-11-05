import { Plus } from 'lucide-react'
import { useState } from 'react'
import { Sheet } from '../../components/Sheet'
import { useToast } from '../../components/toast-context'
import {
  addDeposit,
  addPayment,
  copyBudgets,
  deleteGoal,
  deleteRecurring,
  newDebt,
  newRecurring,
  newSaving,
  restoreGoal,
  saveDebt,
  saveRecurring,
  saveSaving,
  setBudget,
} from '../../db/money'
import { categoriesFor, type BudgetLevel } from '../../domain/money'
import { addMonths, formatDateShort, formatMonth, MONTH_NAMES } from '../../domain/time'
import { formatRupiah, formatRupiahShort } from '../../lib/format'
import type { Debt, RecurringRule, Saving } from '../../types'
import { AmountField } from './AmountField'
import type { UangData } from './data'

const LEVEL: Record<BudgetLevel, { bar: string; text: string; label: string }> = {
  aman: { bar: 'bg-ok', text: 'text-muted', label: 'aman' },
  hampir: { bar: 'bg-uang', text: 'text-uang', label: 'hampir habis' },
  lewat: { bar: 'bg-danger', text: 'text-danger', label: 'lewat' },
}

const Bar = ({ pct, className }: { pct: number; className: string }) => (
  <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-track" aria-hidden="true">
    <div className={`h-full rounded-full ${className} bar-anim`} style={{ width: `${Math.max(0, Math.min(100, pct * 100))}%` }} />
  </div>
)

const monthYear = (d: string) => `${MONTH_NAMES[Number(d.slice(5, 7)) - 1].slice(0, 3)} ${d.slice(0, 4)}`

// ---------- Anggaran ----------

export function BudgetCard({ data }: { data: UangData }) {
  const toast = useToast()
  const [open, setOpen] = useState(false)
  const t = data.budgetTotal
  const copy = async () => {
    const n = await copyBudgets(addMonths(data.month, -1), data.month)
    toast({ message: n ? `${n} anggaran disalin dari bulan lalu.` : 'Semua kategori sudah punya anggaran.' })
  }
  return (
    <section className="card">
      <h2 className="card-title">
        Anggaran {formatMonth(data.month)}
        <button type="button" className="btn-ghost -my-1 ml-auto border border-line py-1.5" onClick={() => setOpen(true)}>
          Atur
        </button>
      </h2>
      {!data.usage.length ? (
        <div className="text-[13px] text-muted">
          Belum ada anggaran bulan ini.
          {data.prevBudgets > 0 && (
            <button type="button" className="ml-1 underline underline-offset-2" onClick={() => void copy()}>
              Salin dari bulan lalu
            </button>
          )}
        </div>
      ) : (
        <>
          <div className="text-[13px] text-muted tabular-nums">
            {formatRupiah(t.spent)} dari {formatRupiah(t.limit)} ·{' '}
            <span className={LEVEL[t.level].text}>
              {t.remaining >= 0 ? `sisa ${formatRupiah(t.remaining)}` : `lewat ${formatRupiah(-t.remaining)}`}
            </span>
          </div>
          <Bar pct={t.limit ? t.spent / t.limit : 0} className={LEVEL[t.level].bar} />
          <ul className="mt-3 grid gap-2.5">
            {data.usage.map((u) => (
              <li key={u.budget.id} className="text-[13px]">
                <div className="flex gap-2">
                  <span className="dot mt-1.5" style={{ background: u.category.color }} aria-hidden="true" />
                  <span className="flex-1">{u.category.name}</span>
                  <span className={`tabular-nums ${LEVEL[u.level].text}`}>
                    {formatRupiahShort(u.spent)} / {formatRupiahShort(u.budget.amount)}
                    {u.level !== 'aman' && ` · ${LEVEL[u.level].label}`}
                  </span>
                </div>
                <Bar pct={u.ratio} className={LEVEL[u.level].bar} />
              </li>
            ))}
          </ul>
        </>
      )}
      <Sheet open={open} title={`Anggaran ${formatMonth(data.month)}`} onClose={() => setOpen(false)}>
        {open && <BudgetForm data={data} onCopy={() => void copy()} />}
      </Sheet>
    </section>
  )
}

function BudgetForm({ data, onCopy }: { data: UangData; onCopy: () => void }) {
  const current = new Map(data.budgets.map((b) => [b.categoryId, b.amount]))
  return (
    <div className="grid gap-3">
      {categoriesFor('expense', data.categories).map((c) => (
        <div key={c.id} className="grid grid-cols-[1fr_9rem] items-center gap-2 text-[13.5px]">
          <span className="flex items-center gap-2">
            <span className="dot" style={{ background: c.color }} aria-hidden="true" />
            {c.name}
          </span>
          <input
            className="field py-1.5 text-right tabular-nums"
            inputMode="numeric"
            aria-label={`Anggaran ${c.name}`}
            placeholder="0"
            defaultValue={current.get(c.id)?.toLocaleString('id-ID') ?? ''}
            onBlur={(e) => void setBudget(data.month, c.id, Number(e.target.value.replace(/[^\d]/g, '')) || 0)}
          />
        </div>
      ))}
      {data.prevBudgets > 0 && (
        <button type="button" className="btn-ghost border border-line" onClick={onCopy}>
          Salin yang kosong dari bulan lalu
        </button>
      )}
      <p className="text-xs text-faint">Tersimpan saat kolom ditinggalkan. Kosongkan untuk menghapus. Hampir habis = ≥ 80% terpakai.</p>
    </div>
  )
}

// ---------- Tabungan & utang ----------

type Editing = { kind: 'saving'; row: Saving } | { kind: 'debt'; row: Debt } | null
type Topup = { kind: 'saving' | 'debt'; id: string; name: string } | null

export function GoalsCard({ data }: { data: UangData }) {
  const toast = useToast()
  const [editing, setEditing] = useState<Editing>(null)
  const [topup, setTopup] = useState<Topup>(null)
  const hasBridge = data.savings.some((x) => x.s.kind === 'jembatan')
  const remove = async (table: 'savings' | 'debts', id: string) => {
    const row = await deleteGoal(table, id)
    setEditing(null)
    if (row) toast({ message: 'Dihapus.', action: { label: 'Urungkan', onClick: () => void restoreGoal(table, row) } })
  }
  return (
    <section className="card">
      <h2 className="card-title">Tabungan & utang</h2>
      {!data.savings.length && !data.debts.length && (
        <p className="text-[13px] text-muted">
          Mulai dengan <b className="font-medium text-text">dana jembatan</b> (biaya hidup selama jeda koas → PPDS). Hadiah berbiaya terbuka
          setelah targetnya tercapai.
        </p>
      )}
      <ul className="grid gap-3">
        {data.savings.map(({ s, plan }) => (
          <li key={s.id} className="text-[13.5px]">
            <div className="flex items-baseline gap-2">
              <button type="button" className="flex-1 text-left font-medium" onClick={() => setEditing({ kind: 'saving', row: s })}>
                {s.name}
                {s.kind === 'jembatan' && s.name.toLowerCase() !== 'dana jembatan' && (
                  <span className="ml-1.5 text-[11px] font-normal text-tentir">dana jembatan</span>
                )}
              </button>
              <button type="button" className="btn-ghost py-1 text-xs" onClick={() => setTopup({ kind: 'saving', id: s.id, name: s.name })}>
                + Setor
              </button>
            </div>
            <div className="text-xs text-muted tabular-nums">
              {formatRupiah(plan.done)} / {formatRupiah(plan.target)}
              {plan.left === 0
                ? ' · tercapai'
                : plan.perMonth
                  ? ` · ${formatRupiahShort(plan.perMonth)}/bln sampai ${monthYear(s.targetDate!)}`
                  : ` · kurang ${formatRupiahShort(plan.left)}`}
            </div>
            <Bar pct={plan.pct} className={s.kind === 'jembatan' ? 'bg-tentir' : 'bg-ok'} />
          </li>
        ))}
        {data.debts.map(({ d, plan }) => (
          <li key={d.id} className="text-[13.5px]">
            <div className="flex items-baseline gap-2">
              <button type="button" className="flex-1 text-left font-medium" onClick={() => setEditing({ kind: 'debt', row: d })}>
                {d.name} <span className="ml-1 text-[11px] font-normal text-uang">utang</span>
              </button>
              {plan.left > 0 && (
                <button type="button" className="btn-ghost py-1 text-xs" onClick={() => setTopup({ kind: 'debt', id: d.id, name: d.name })}>
                  + Bayar
                </button>
              )}
            </div>
            <div className="text-xs text-muted tabular-nums">
              sisa {formatRupiah(plan.left)} dari {formatRupiah(plan.target)}
              {plan.left === 0
                ? ' · lunas'
                : plan.perMonth
                  ? ` · ${formatRupiahShort(plan.perMonth)}/bln sampai ${monthYear(d.targetDate!)}`
                  : ''}
            </div>
            <Bar pct={plan.pct} className="bg-uang" />
          </li>
        ))}
      </ul>
      <div className="mt-3 flex flex-wrap gap-2">
        <button
          type="button"
          className="btn-ghost border border-line py-1.5"
          onClick={() => setEditing({ kind: 'saving', row: newSaving(hasBridge ? 'wishlist' : 'jembatan') })}
        >
          <Plus size={14} aria-hidden="true" /> Tabungan
        </button>
        <button type="button" className="btn-ghost border border-line py-1.5" onClick={() => setEditing({ kind: 'debt', row: newDebt() })}>
          <Plus size={14} aria-hidden="true" /> Utang
        </button>
      </div>
      <Sheet open={!!editing} title={editing?.kind === 'debt' ? 'Utang' : 'Tabungan'} onClose={() => setEditing(null)}>
        {editing && <GoalForm key={editing.row.id} editing={editing} onClose={() => setEditing(null)} onDelete={remove} />}
      </Sheet>
      <Sheet
        open={!!topup}
        title={topup ? `${topup.kind === 'debt' ? 'Bayar' : 'Setor'} · ${topup.name}` : ''}
        onClose={() => setTopup(null)}
      >
        {topup && <TopupForm topup={topup} today={data.today} onClose={() => setTopup(null)} />}
      </Sheet>
    </section>
  )
}

function GoalForm({
  editing,
  onClose,
  onDelete,
}: {
  editing: NonNullable<Editing>
  onClose: () => void
  onDelete: (t: 'savings' | 'debts', id: string) => void
}) {
  const toast = useToast()
  const isDebt = editing.kind === 'debt'
  const [name, setName] = useState(editing.row.name)
  const [amount, setAmount] = useState(isDebt ? (editing.row as Debt).initial : (editing.row as Saving).target)
  const [targetDate, setTargetDate] = useState(editing.row.targetDate ?? '')
  const [kind, setKind] = useState<Saving['kind']>(isDebt ? 'lainnya' : (editing.row as Saving).kind)
  const isNew = !editing.row.name
  const save = async () => {
    try {
      const common = { name, targetDate: targetDate || null }
      if (isDebt) await saveDebt({ ...(editing.row as Debt), ...common, initial: amount })
      else await saveSaving({ ...(editing.row as Saving), ...common, target: amount, kind })
      onClose()
    } catch (e) {
      toast({ message: (e as Error).message, tone: 'error' })
    }
  }
  return (
    <div className="grid gap-4">
      <label className="text-xs text-muted">
        Nama
        <input
          className="field mt-1"
          value={name}
          maxLength={60}
          onChange={(e) => setName(e.target.value)}
          placeholder={isDebt ? 'mis. Pinjaman kakak' : 'mis. Laptop baru'}
        />
      </label>
      {!isDebt && (
        <div role="radiogroup" aria-label="Jenis tabungan" className="flex rounded-full bg-surface-2 p-[3px]">
          {(
            [
              ['jembatan', 'Dana jembatan'],
              ['wishlist', 'Wishlist'],
              ['lainnya', 'Lainnya'],
            ] as const
          ).map(([v, label]) => (
            <button
              key={v}
              type="button"
              role="radio"
              aria-checked={kind === v}
              onClick={() => setKind(v)}
              className={`flex-1 rounded-full px-2 py-1.5 text-[13px] ${kind === v ? 'bg-surface text-text shadow-sm' : 'text-muted'}`}
            >
              {label}
            </button>
          ))}
        </div>
      )}
      <div className="grid grid-cols-2 gap-2">
        <AmountField label={isDebt ? 'Jumlah utang' : 'Target'} value={amount} onChange={setAmount} />
        <label className="text-xs text-muted">
          {isDebt ? 'Target lunas' : 'Target tanggal'}
          <input className="field mt-1" type="date" value={targetDate} onChange={(e) => setTargetDate(e.target.value)} />
        </label>
      </div>
      <div className="flex gap-2">
        {!isNew && (
          <button
            type="button"
            className="btn-ghost border border-line"
            onClick={() => onDelete(isDebt ? 'debts' : 'savings', editing.row.id)}
          >
            Hapus
          </button>
        )}
        <button type="button" className="btn-primary flex-1 py-3" disabled={!name.trim() || !(amount > 0)} onClick={() => void save()}>
          Simpan
        </button>
      </div>
    </div>
  )
}

function TopupForm({ topup, today, onClose }: { topup: NonNullable<Topup>; today: string; onClose: () => void }) {
  const toast = useToast()
  const [amount, setAmount] = useState(0)
  const [date, setDate] = useState(today)
  const [withdraw, setWithdraw] = useState(false)
  const save = async () => {
    try {
      if (topup.kind === 'debt') await addPayment(topup.id, amount, date)
      else await addDeposit(topup.id, withdraw ? -amount : amount, date)
      toast({ message: `${topup.kind === 'debt' ? 'Pembayaran' : withdraw ? 'Penarikan' : 'Setoran'} ${formatRupiah(amount)} tercatat.` })
      onClose()
    } catch (e) {
      toast({ message: (e as Error).message, tone: 'error' })
    }
  }
  return (
    <div className="grid gap-4">
      <div className="grid grid-cols-[1fr_auto] gap-2">
        <AmountField label="Nominal" value={amount} onChange={setAmount} autoFocus />
        <label className="text-xs text-muted">
          Tanggal
          <input className="field mt-1" type="date" value={date} onChange={(e) => setDate(e.target.value)} />
        </label>
      </div>
      {topup.kind === 'saving' && (
        <label className="flex items-center gap-2 text-[13px] text-muted">
          <input type="checkbox" className="size-4 accent-current" checked={withdraw} onChange={(e) => setWithdraw(e.target.checked)} />
          Penarikan (mengurangi tabungan)
        </label>
      )}
      <button type="button" className="btn-primary w-full py-3" disabled={!(amount > 0)} onClick={() => void save()}>
        Simpan
      </button>
    </div>
  )
}

// ---------- Berulang ----------

export function RecurringCard({ data }: { data: UangData }) {
  const [editing, setEditing] = useState<RecurringRule | null>(null)
  return (
    <section className="card">
      <h2 className="card-title">
        Berulang
        <button
          type="button"
          className="btn-ghost -my-1 ml-auto border border-line py-1.5"
          onClick={() => setEditing(newRecurring(data.today))}
        >
          <Plus size={14} aria-hidden="true" /> Aturan
        </button>
      </h2>
      {!data.recurring.length && (
        <p className="text-[13px] text-muted">Mis. kos tiap tanggal 1, kuota tiap tanggal 15. Dicatat otomatis saat jatuh tempo.</p>
      )}
      <ul>
        {data.recurring.map(({ rule, next }) => (
          <li key={rule.id}>
            <button
              type="button"
              onClick={() => setEditing(rule)}
              className={`flex w-full items-center gap-2 border-t border-line py-2 text-left text-[13.5px] first:border-t-0 ${rule.active ? '' : 'opacity-55'}`}
            >
              <span className="dot" style={{ background: data.cat(rule.categoryId).color }} aria-hidden="true" />
              <span className="flex-1">
                {rule.note || data.cat(rule.categoryId).name}
                <span className="block text-xs text-muted">
                  tiap tgl {rule.dayOfMonth}
                  {rule.active ? (next ? ` · berikutnya ${formatDateShort(next)}` : ' · berakhir') : ' · nonaktif'}
                </span>
              </span>
              <span className={`tabular-nums ${rule.type === 'income' ? 'text-ok' : ''}`}>
                {rule.type === 'income' ? '+' : '−'}
                {formatRupiah(rule.amount)}
              </span>
            </button>
          </li>
        ))}
      </ul>
      <Sheet open={!!editing} title="Transaksi berulang" onClose={() => setEditing(null)}>
        {editing && <RecurringForm key={editing.id} initial={editing} data={data} onClose={() => setEditing(null)} />}
      </Sheet>
    </section>
  )
}

function RecurringForm({ initial, data, onClose }: { initial: RecurringRule; data: UangData; onClose: () => void }) {
  const toast = useToast()
  const [r, setR] = useState(initial)
  const set = (c: Partial<RecurringRule>) => setR((x) => ({ ...x, ...c }))
  const isNew = !data.recurring.some((x) => x.rule.id === initial.id)
  const save = async () => {
    try {
      await saveRecurring(r)
      onClose()
    } catch (e) {
      toast({ message: (e as Error).message, tone: 'error' })
    }
  }
  return (
    <div className="grid gap-4">
      <div role="radiogroup" aria-label="Jenis" className="flex rounded-full bg-surface-2 p-[3px]">
        {(
          [
            ['expense', 'Pengeluaran'],
            ['income', 'Pemasukan'],
          ] as const
        ).map(([v, label]) => (
          <button
            key={v}
            type="button"
            role="radio"
            aria-checked={r.type === v}
            onClick={() => set({ type: v, categoryId: v === 'income' ? '#cat:kiriman' : '#cat:tagihan' })}
            className={`flex-1 rounded-full px-3 py-1.5 text-[13px] ${r.type === v ? 'bg-surface text-text shadow-sm' : 'text-muted'}`}
          >
            {label}
          </button>
        ))}
      </div>
      <div className="grid grid-cols-[1fr_6rem] gap-2">
        <AmountField label="Nominal" value={r.amount} onChange={(amount) => set({ amount })} />
        <label className="text-xs text-muted">
          Tiap tanggal
          <input
            className="field mt-1"
            inputMode="numeric"
            value={r.dayOfMonth || ''}
            onChange={(e) => set({ dayOfMonth: Math.min(31, Number(e.target.value.replace(/\D/g, '')) || 0) })}
          />
        </label>
      </div>
      <label className="text-xs text-muted">
        Catatan
        <input
          className="field mt-1"
          value={r.note}
          maxLength={80}
          onChange={(e) => set({ note: e.target.value })}
          placeholder="mis. Bayar kos"
        />
      </label>
      <label className="text-xs text-muted">
        Kategori
        <select className="field mt-1" value={r.categoryId} onChange={(e) => set({ categoryId: e.target.value })}>
          {categoriesFor(r.type, data.categories).map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>
      </label>
      <div className="grid grid-cols-2 gap-2">
        <label className="text-xs text-muted">
          Mulai bulan
          <input
            className="field mt-1"
            type="month"
            value={r.startMonth}
            onChange={(e) => e.target.value && set({ startMonth: e.target.value })}
          />
        </label>
        <label className="text-xs text-muted">
          Sampai (opsional)
          <input
            className="field mt-1"
            type="month"
            value={r.endMonth ?? ''}
            onChange={(e) => set({ endMonth: e.target.value || undefined })}
          />
        </label>
      </div>
      <div className="flex flex-wrap gap-2">
        {!isNew && (
          <>
            <button
              type="button"
              className="btn-ghost border border-line"
              onClick={() => void saveRecurring({ ...r, active: !r.active }).then(onClose)}
            >
              {r.active ? 'Nonaktifkan' : 'Aktifkan'}
            </button>
            <button type="button" className="btn-ghost border border-line" onClick={() => void deleteRecurring(r.id).then(onClose)}>
              Hapus
            </button>
          </>
        )}
        <button
          type="button"
          className="btn-primary flex-1 py-3"
          disabled={!(r.amount > 0) || !(r.dayOfMonth >= 1)}
          onClick={() => void save()}
        >
          Simpan
        </button>
      </div>
      <p className="text-xs text-faint">
        Transaksi dibuat otomatis saat jatuh tempo (bulan yang terlewat ikut dikejar). Menghapus aturan tidak menghapus transaksi yang sudah
        tercatat.
      </p>
    </div>
  )
}
