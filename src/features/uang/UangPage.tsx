import { ChevronLeft, ChevronRight, Plus } from 'lucide-react'
import { useState } from 'react'
import { useToday } from '../../app/useToday'
import { PageTop } from '../../components/PageTop'
import { useToast } from '../../components/toast-context'
import { deleteCategory, newCategory, saveCategory } from '../../db/money'
import { addMonths, formatDateShort, formatMonth, monthOf } from '../../domain/time'
import { formatRupiah, formatRupiahShort } from '../../lib/format'
import type { Category } from '../../types'
import { useUang, type UangData } from './data'
import { BudgetCard, GoalsCard, RecurringCard } from './Planning'
import { TransactionForm, type TxDraft } from './TransactionForm'

/** "1,98 jt" / "250 rb": ringkas tapi cukup presisi untuk ubin sempit di HP. */
const compact = (n: number) => (n >= 1e6 ? `${(n / 1e6).toLocaleString('id-ID', { maximumFractionDigits: 2 })} jt` : formatRupiahShort(n))

function Tiles({ data }: { data: UangData }) {
  const s = data.summary
  // Di HP tiga kolom sempit: nominal ringkas ("1,98 jt") supaya tidak meluber; layar lebar tampil penuh.
  const tile = (label: string, value: number, tone = '') => (
    <div className="card min-w-0 px-3 py-3 md:p-[18px]">
      <div className="text-xs text-muted">{label}</div>
      <div className={`mt-1 truncate text-[17px] font-semibold tabular-nums md:text-[22px] ${tone}`} title={formatRupiah(value)}>
        <span className="sm:hidden">
          {value < 0 ? '−' : ''}
          {compact(Math.abs(value))}
        </span>
        <span className="hidden sm:inline">{formatRupiah(value)}</span>
      </div>
    </div>
  )
  return (
    <section className="mt-3 grid grid-cols-3 gap-2 md:gap-3">
      {tile('Pemasukan', s.income, 'text-ok')}
      {tile('Pengeluaran', s.expense)}
      {tile('Sisa', s.balance, s.balance < 0 ? 'text-danger' : '')}
    </section>
  )
}

function Transactions({ data, onEdit, onAdd }: { data: UangData; onEdit: (d: TxDraft) => void; onAdd: () => void }) {
  const dates = [...new Set(data.txs.map((t) => t.date))]
  return (
    <section className="card">
      <h2 className="card-title">
        Transaksi <span className="text-[13px] font-medium text-faint">{data.txs.length}</span>
        <button type="button" className="btn-primary -my-1 ml-auto py-1.5" onClick={onAdd}>
          <Plus size={15} aria-hidden="true" /> Transaksi
        </button>
      </h2>
      {!dates.length && (
        <p className="text-[13px] text-muted">Belum ada transaksi bulan ini. Catat cepat: “25rb makan siang”, “+500rb kiriman”.</p>
      )}
      {dates.map((d) => (
        <div key={d} className="mb-2">
          <div className="text-xs font-medium tracking-wide text-faint uppercase">{formatDateShort(d)}</div>
          <ul>
            {data.txs
              .filter((t) => t.date === d)
              .map((t) => {
                const c = data.cat(t.categoryId)
                return (
                  <li key={t.id}>
                    <button
                      type="button"
                      onClick={() => onEdit(t)}
                      className="flex w-full items-center gap-2.5 border-t border-line py-2 text-left text-[13.5px] first:border-t-0"
                    >
                      <span className="dot" style={{ background: c.color }} aria-hidden="true" />
                      <span className="flex-1">
                        {t.note || c.name}
                        <span className="block text-xs text-muted">
                          {c.name}
                          {t.recurringId ? ' · berulang' : ''}
                          {t.tentirSessionId ? ' · dari Tentir' : ''}
                        </span>
                      </span>
                      <span className={`tabular-nums ${t.type === 'income' ? 'text-ok' : ''}`}>
                        {t.type === 'income' ? '+' : '−'}
                        {formatRupiah(t.amount)}
                      </span>
                    </button>
                  </li>
                )
              })}
          </ul>
        </div>
      ))}
    </section>
  )
}

function Breakdown({ data }: { data: UangData }) {
  if (!data.byCategory.length) return null
  return (
    <section className="card">
      <h2 className="card-title">Pengeluaran per kategori</h2>
      <ul className="grid gap-2">
        {data.byCategory.map((s) => (
          <li key={s.category.id} className="text-[13px]">
            <div className="flex gap-2">
              <span className="flex-1">{s.category.name}</span>
              <span className="text-muted tabular-nums">
                {formatRupiah(s.total)} · {Math.round(s.ratio * 100)}%
              </span>
            </div>
            <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-track" aria-hidden="true">
              <div className="h-full rounded-full bar-anim" style={{ width: `${s.ratio * 100}%`, background: s.category.color }} />
            </div>
          </li>
        ))}
      </ul>
    </section>
  )
}

const COLORS = ['#eb6834', '#2a78d6', '#e34948', '#9b7bea', '#1baf7a', '#3bb5c4', '#e87ba4', '#d4ad45', '#64748b']

function Categories({ data }: { data: UangData }) {
  const toast = useToast()
  const [draft, setDraft] = useState<Category | null>(null)
  const custom = data.categories.filter((c) => !c.builtIn)
  const save = async () => {
    if (!draft) return
    try {
      await saveCategory(draft)
      setDraft(null)
    } catch (e) {
      toast({ message: (e as Error).message, tone: 'error' })
    }
  }
  return (
    <details className="card">
      <summary className="cursor-pointer text-[15px] font-semibold">Kategori</summary>
      <ul className="mt-3 flex flex-wrap gap-1.5">
        {data.categories.map((c) => (
          <li key={c.id}>
            <button type="button" className="chip py-1" onClick={() => setDraft(c)}>
              <span className="dot" style={{ background: c.color }} aria-hidden="true" />
              {c.name}
              <span className="text-faint">{c.kind === 'income' ? 'masuk' : c.kind === 'expense' ? 'keluar' : 'keduanya'}</span>
            </button>
          </li>
        ))}
        <li>
          <button type="button" className="chip py-1" onClick={() => setDraft(newCategory('expense'))}>
            <Plus size={13} aria-hidden="true" /> Kategori
          </button>
        </li>
      </ul>
      {draft && (
        <div className="mt-3 grid gap-2 rounded-xl border border-line p-3">
          <input
            className="field"
            value={draft.name}
            maxLength={40}
            onChange={(e) => setDraft({ ...draft, name: e.target.value })}
            placeholder="Nama kategori"
            aria-label="Nama kategori"
          />
          {!draft.builtIn && (
            <select
              className="field"
              value={draft.kind}
              onChange={(e) => setDraft({ ...draft, kind: e.target.value as Category['kind'] })}
              aria-label="Jenis kategori"
            >
              <option value="expense">Pengeluaran</option>
              <option value="income">Pemasukan</option>
              <option value="both">Keduanya</option>
            </select>
          )}
          <div className="flex flex-wrap gap-1.5">
            {COLORS.map((c) => (
              <button
                key={c}
                type="button"
                aria-label={`Warna ${c}`}
                aria-pressed={draft.color === c}
                onClick={() => setDraft({ ...draft, color: c })}
                className={`size-7 rounded-full ${draft.color === c ? 'ring-2 ring-text ring-offset-2 ring-offset-surface' : ''}`}
                style={{ background: c }}
              />
            ))}
          </div>
          <div className="flex gap-2">
            {!draft.builtIn && custom.some((c) => c.id === draft.id) && (
              <button
                type="button"
                className="btn-ghost border border-line"
                onClick={() =>
                  void deleteCategory(draft.id)
                    .then(() => setDraft(null))
                    .catch((e: Error) => toast({ message: e.message, tone: 'error' }))
                }
              >
                Hapus
              </button>
            )}
            <button type="button" className="btn-ghost border border-line" onClick={() => setDraft(null)}>
              Batal
            </button>
            <button type="button" className="btn-primary flex-1" disabled={!draft.name.trim()} onClick={() => void save()}>
              Simpan
            </button>
          </div>
          <p className="text-xs text-faint">
            Kategori bawaan bisa diganti nama & warnanya. Menghapus kategori buatan sendiri memindahkan transaksinya ke Lainnya.
          </p>
        </div>
      )}
    </details>
  )
}

export function UangPage() {
  const today = useToday()
  const [month, setMonth] = useState(() => monthOf(today))
  const data = useUang(month, today)
  const [editing, setEditing] = useState<TxDraft | null>(null)
  const thisMonth = month === monthOf(today)
  return (
    <>
      <PageTop title="Uang" />
      <h1 className="mt-4 text-[26px] font-semibold tracking-tight md:hidden">Uang</h1>
      <section className="mt-3 flex items-center gap-1 md:mt-[26px]">
        <button type="button" className="btn-ghost p-2" onClick={() => setMonth(addMonths(month, -1))} aria-label="Bulan sebelumnya">
          <ChevronLeft size={18} aria-hidden="true" />
        </button>
        <div className="min-w-[150px] text-center">
          <div className="font-serif text-xl">{formatMonth(month)}</div>
          <div className="text-xs text-muted">{thisMonth ? 'bulan ini' : ''}</div>
        </div>
        <button type="button" className="btn-ghost p-2" onClick={() => setMonth(addMonths(month, 1))} aria-label="Bulan berikutnya">
          <ChevronRight size={18} aria-hidden="true" />
        </button>
      </section>
      {data && (
        <>
          <Tiles data={data} />
          <div className="stagger mt-3 grid items-start gap-3 lg:grid-cols-2">
            <div className="grid gap-3">
              <Transactions data={data} onEdit={setEditing} onAdd={() => setEditing({ date: thisMonth ? today : `${month}-01` })} />
              <Breakdown data={data} />
            </div>
            <div className="grid gap-3">
              <BudgetCard data={data} />
              <GoalsCard data={data} />
              <RecurringCard data={data} />
              <Categories data={data} />
            </div>
          </div>
          <TransactionForm draft={editing} categories={data.categories} onClose={() => setEditing(null)} />
        </>
      )}
    </>
  )
}
