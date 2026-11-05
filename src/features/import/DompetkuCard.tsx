import { useState } from 'react'
import { useToast } from '../../components/toast-context'
import { applyDompetku } from '../../db/dompetku'
import { convertDompetku } from '../../domain/dompetku'
import { formatMonth } from '../../domain/time'
import { formatRupiah } from '../../lib/format'

/** Pratinjau & impor backup Dompetku (Setelan → Export JSON di Dompetku). */
export function DompetkuCard({ data, onDone }: { data: Record<string, unknown>; onDone: () => void }) {
  const toast = useToast()
  const [busy, setBusy] = useState(false)
  const plan = convertDompetku(data)
  const s = plan.stats
  const income = plan.transactions.filter((t) => t.type === 'income').reduce((a, t) => a + t.amount, 0)
  const expense = plan.transactions.filter((t) => t.type === 'expense').reduce((a, t) => a + t.amount, 0)
  const row = (label: string, value: number | string) => (
    <li className="flex justify-between border-b border-line py-1.5 text-[13.5px]">
      <span>{label}</span>
      <span className="text-muted tabular-nums">{value}</span>
    </li>
  )
  const run = async () => {
    setBusy(true)
    try {
      const r = await applyDompetku(plan)
      const skipped = r.transactions.skipped + r.budgets.skipped + r.recurring.skipped
      toast({
        message: `Dompetku diimpor: ${r.transactions.added} transaksi, ${r.budgets.added} anggaran, ${r.recurring.added} aturan berulang, ${r.categories.added} kategori.${skipped ? ` ${skipped} sudah ada, tidak ditimpa.` : ''}`,
        duration: 8000,
      })
      onDone()
    } catch (e) {
      toast({ message: `Gagal mengimpor: ${(e as Error).message}`, tone: 'error' })
    } finally {
      setBusy(false)
    }
  }
  return (
    <section className="card">
      <h2 className="card-title">Backup Dompetku terdeteksi</h2>
      <ul>
        {row('Transaksi', plan.transactions.length)}
        {row('Periode', s.months.length ? `${formatMonth(s.months[0])} – ${formatMonth(s.months[s.months.length - 1])}` : '–')}
        {row('Pemasukan / pengeluaran', `${formatRupiah(income)} / ${formatRupiah(expense)}`)}
        {row('Anggaran', plan.budgets.length)}
        {row('Aturan berulang', plan.recurring.length)}
        {row('Kategori buatan sendiri', plan.categories.length)}
      </ul>
      <ul className="mt-3 grid gap-1 text-xs text-muted">
        <li>Kategori bawaan Dompetku dipetakan ke kategori Qawwam (Gaji → Kiriman & gaji, Tagihan → Kos & tagihan).</li>
        <li>Data yang sudah ada di Qawwam tidak ditimpa; impor aman diulang. Transaksi berulang tidak akan tercatat dobel.</li>
        {s.notesDropped > 0 && <li>{s.notesDropped} catatan berisi pola identitas pasien dikosongkan.</li>}
        {s.skipped > 0 && <li>{s.skipped} transaksi rusak dilewati.</li>}
      </ul>
      <button
        type="button"
        className="btn-primary mt-4 w-full py-3"
        disabled={busy || !plan.transactions.length}
        onClick={() => void run()}
      >
        Impor dari Dompetku
      </button>
    </section>
  )
}
