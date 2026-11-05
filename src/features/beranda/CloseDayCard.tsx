import { useToast } from '../../components/toast-context'
import { moveTasks, moveUndoneToTomorrow, setWorkEnd } from '../../db/daily'
import type { BerandaData } from './data'

/** Malam: jam berhenti kerja dan pindahkan sisa tugas ke besok. */
export function CloseDayCard({ data }: { data: BerandaData }) {
  const toast = useToast()
  const workEnd = data.snap.day?.workEnd ?? null
  // Batas kerja malam bisa diubah/dimatikan di Setelan.
  const limit = data.rules.workEndLimit
  const left = data.snap.rows.filter((r) => r.kind === 'task' && !r.done).length
  const moveLeft = async () => {
    const ids = await moveUndoneToTomorrow(data.today)
    toast({
      message: `${ids.length} tugas dipindah ke besok.`,
      action: { label: 'Urungkan', onClick: () => void moveTasks(ids, data.today) },
    })
  }
  const opt = (value: 'ok' | 'late', label: string) => (
    <button
      type="button"
      role="radio"
      aria-checked={workEnd === value}
      onClick={() => void setWorkEnd(data.today, workEnd === value ? null : value)}
      className={`flex-1 rounded-full px-3 py-1.5 text-[13px] ${workEnd === value ? 'bg-surface text-text shadow-sm' : 'text-muted'}`}
    >
      {label}
    </button>
  )
  return (
    <div className="card">
      <h3 className="card-title">
        Tutup hari <span className="text-[13px] font-medium text-faint">malam, ±1 menit</span>
      </h3>
      {limit && (
        <div className="mb-3 flex items-center gap-3">
          <span className="text-[13px] text-muted">Berhenti kerja</span>
          <div role="radiogroup" aria-label="Jam berhenti kerja" className="flex flex-1 rounded-full bg-surface-2 p-[3px]">
            {opt('ok', `≤ ${limit}`)}
            {opt('late', 'Lewat')}
          </div>
        </div>
      )}
      <button
        type="button"
        disabled={left === 0}
        onClick={() => void moveLeft()}
        className="btn-ghost w-full justify-between border border-line disabled:opacity-50"
      >
        Pindahkan sisa tugas ke besok <span className="text-faint">{left}</span>
      </button>
      {data.snap.result.penalty > 0 && (
        <p className="mt-2 text-xs text-faint">
          Lewat {limit}: −{data.snap.result.penalty} XP. Tidur lebih penting dari satu tugas lagi.
        </p>
      )}
    </div>
  )
}
