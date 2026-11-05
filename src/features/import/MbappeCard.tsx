import { useState } from 'react'
import { useToast } from '../../components/toast-context'
import { applyMbappe } from '../../db/mbappe'
import { useRoles } from '../../db/structure'
import { convertMbappe } from '../../domain/mbappe'
import { formatNumber } from '../../lib/format'

/** Pratinjau & impor file export MBAPPE OS (levelup). */
export function MbappeCard({ data, onDone }: { data: Record<string, unknown>; onDone: () => void }) {
  const roles = useRoles()
  const toast = useToast()
  const [busy, setBusy] = useState(false)
  if (!roles) return null
  const plan = convertMbappe(data, roles)
  const s = plan.stats
  const row = (label: string, value: number | string) => (
    <li className="flex justify-between border-b border-line py-1.5 text-[13.5px]">
      <span>{label}</span>
      <span className="text-muted tabular-nums">{value}</span>
    </li>
  )
  const run = async () => {
    setBusy(true)
    try {
      const r = await applyMbappe(plan)
      toast({
        message: `MBAPPE OS diimpor: ${r.days} hari, ${r.habits} habit, ${r.habitLogs} centang habit, ${r.mutabaahLogs} centang mutaba'ah, ${r.reviews} Muhasabah.${r.daysSkipped ? ` ${r.daysSkipped} hari sudah ada di Qawwam, tidak ditimpa.` : ''}`,
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
      <h2 className="card-title">
        File MBAPPE OS terdeteksi{' '}
        <span className="text-[13px] font-medium text-faint">schemaVersion {String(data.schemaVersion ?? 1)}</span>
      </h2>
      <ul>
        {row('Hari', `${plan.days.length} (${s.frozenDays} beku)`)}
        {row('XP lama yang terbawa', formatNumber(s.totalXp))}
        {row('Quest → habit baru', plan.habits.length)}
        {row('Centang habit', plan.habitLogs.length)}
        {row("Amalan mutaba'ah baru", plan.mutabaah.length)}
        {row("Centang mutaba'ah", plan.mutabaahLogs.length)}
        {row('Stase', plan.chapters.length)}
        {row('Main Quest', plan.mainQuests.length)}
        {row('Muhasabah (prioritas & Raid)', plan.reviews.length)}
        {row('Utang & dana jembatan', plan.debts.length + plan.savings.length)}
      </ul>
      <ul className="mt-3 grid gap-1 text-xs text-muted">
        <li>Tanggal, habit, dan Muhasabah yang sudah ada di Qawwam tidak ditimpa; impor aman diulang.</li>
        <li>Tidur, jam kerja, pra-jaga, dan pasca-jaga digabung ke habit bawaan Qawwam; "Tahajjud" ke "Qiyamul lail".</li>
        {s.weeklyQuests.length > 0 && (
          <li>Quest mingguan jadi habit mingguan (1× per minggu, di luar syarat lolos): {s.weeklyQuests.join(', ')}.</li>
        )}
        {s.notImported.length > 0 && <li>Belum ada tempatnya di Qawwam, jadi belum diimpor: {s.notImported.join(', ')}.</li>}
        {s.skippedSample > 0 && <li>{s.skippedSample} data contoh MBAPPE OS dilewati.</li>}
        {s.notesDropped > 0 && <li className="text-danger">{s.notesDropped} catatan berisi pola identitas pasien tidak diimpor.</li>}
      </ul>
      <button
        type="button"
        className="btn-primary mt-4 w-full py-3"
        disabled={busy || (!plan.days.length && !plan.habits.length)}
        onClick={() => void run()}
      >
        Impor dari MBAPPE OS
      </button>
    </section>
  )
}
