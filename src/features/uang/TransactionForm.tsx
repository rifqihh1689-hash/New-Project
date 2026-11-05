import { useState } from 'react'
import { routeHref } from '../../app/router'
import { Sheet } from '../../components/Sheet'
import { useToast } from '../../components/toast-context'
import { deleteTransaction, restoreTransaction, saveTransaction } from '../../db/money'
import { categoriesFor } from '../../domain/money'
import { detectPatientIdentity } from '../../domain/phi'
import type { Category, Transaction, TransactionType } from '../../types'
import { AmountField } from './AmountField'

export type TxDraft = Transaction | { date: string; type?: TransactionType }

/** Tambah / ubah transaksi. Transaksi dari sesi tentir hanya bisa dilihat. */
export function TransactionForm({ draft, categories, onClose }: { draft: TxDraft | null; categories: Category[]; onClose: () => void }) {
  const editing = !!draft && 'id' in draft
  return (
    <Sheet open={!!draft} title={editing ? 'Ubah transaksi' : 'Transaksi baru'} onClose={onClose}>
      {draft && <Body key={'id' in draft ? draft.id : 'baru'} draft={draft} categories={categories} onClose={onClose} />}
    </Sheet>
  )
}

function Body({ draft, categories, onClose }: { draft: TxDraft; categories: Category[]; onClose: () => void }) {
  const toast = useToast()
  const existing = 'id' in draft ? draft : null
  const [type, setType] = useState<TransactionType>(existing?.type ?? draft.type ?? 'expense')
  const [amount, setAmount] = useState(existing?.amount ?? 0)
  const [categoryId, setCategoryId] = useState(existing?.categoryId ?? (type === 'income' ? '#cat:kiriman' : '#cat:makan'))
  const [date, setDate] = useState(draft.date)
  const [note, setNote] = useState(existing?.note ?? '')
  const options = categoriesFor(type, categories)
  const phi = note.trim() ? detectPatientIdentity(note) : null
  const locked = !!existing?.tentirSessionId

  const pickType = (t: TransactionType) => {
    setType(t)
    if (!categoriesFor(t, categories).some((c) => c.id === categoryId)) setCategoryId(t === 'income' ? '#cat:kiriman' : '#cat:makan')
  }
  const save = async () => {
    try {
      await saveTransaction({ id: existing?.id, amount, type, categoryId, date, note })
      onClose()
    } catch (e) {
      toast({ message: (e as Error).message, tone: 'error' })
    }
  }
  const remove = async () => {
    if (!existing) return
    try {
      const tx = await deleteTransaction(existing.id)
      onClose()
      if (tx) toast({ message: 'Transaksi dihapus.', action: { label: 'Urungkan', onClick: () => void restoreTransaction(tx) } })
    } catch (e) {
      toast({ message: (e as Error).message, tone: 'error' })
    }
  }

  if (locked)
    return (
      <p className="text-[13.5px] text-muted">
        Transaksi ini dibuat otomatis dari sesi tentir yang lunas. Ubah jumlah, tanggal, atau status lunasnya di{' '}
        <a href={routeHref('tentir')} className="underline underline-offset-2" onClick={onClose}>
          halaman Tentir
        </a>
        .
      </p>
    )

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
            aria-checked={type === v}
            onClick={() => pickType(v)}
            className={`flex-1 rounded-full px-3 py-1.5 text-[13px] ${type === v ? 'bg-surface text-text shadow-sm' : 'text-muted'}`}
          >
            {label}
          </button>
        ))}
      </div>
      <AmountField label="Nominal" value={amount} onChange={setAmount} autoFocus={!existing} large />
      <div>
        <span className="label">Kategori</span>
        <div className="flex flex-wrap gap-1.5">
          {options.map((c) => (
            <button
              key={c.id}
              type="button"
              aria-pressed={categoryId === c.id}
              onClick={() => setCategoryId(c.id)}
              className={`chip py-1 ${categoryId === c.id ? 'border-transparent bg-btn text-btn-text' : ''}`}
            >
              <span className="dot" style={{ background: c.color }} aria-hidden="true" />
              {c.name}
            </button>
          ))}
        </div>
      </div>
      <div className="grid grid-cols-[auto_1fr] gap-2">
        <label className="text-xs text-muted">
          Tanggal
          <input className="field mt-1" type="date" value={date} onChange={(e) => setDate(e.target.value)} />
        </label>
        <label className="text-xs text-muted">
          Catatan
          <input className="field mt-1" value={note} maxLength={120} onChange={(e) => setNote(e.target.value)} placeholder="opsional" />
        </label>
      </div>
      {phi && <p className="-mt-2 text-xs text-danger">Mirip identitas pasien ({phi}).</p>}
      <div className="flex gap-2">
        {existing && (
          <button type="button" className="btn-ghost border border-line" onClick={() => void remove()}>
            Hapus
          </button>
        )}
        <button type="button" className="btn-primary flex-1 py-3" disabled={!(amount > 0) || !!phi} onClick={() => void save()}>
          Simpan
        </button>
      </div>
    </div>
  )
}
