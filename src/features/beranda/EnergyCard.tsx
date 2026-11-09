import { useToast } from '../../components/toast-context'
import { setEnergy } from '../../db/daily'
import { ENERGY_LABELS, ENERGY_LEVELS } from '../../domain/energy'
import { addDays } from '../../domain/time'
import type { BerandaData } from './data'

const TONE = ['var(--danger)', 'var(--color-uang)', 'var(--faint)', 'var(--ok)', 'var(--color-tentir)']

/** Satu ketukan: energi hari ini. Tidak masuk XP; dipakai Beranda untuk melihat pola dan meringankan beban. */
export function EnergyCard({ data }: { data: BerandaData }) {
  const toast = useToast()
  const { energy } = data
  const set = async (v: (typeof ENERGY_LEVELS)[number]) => {
    const next = energy.today === v ? null : v
    const prev = await setEnergy(data.today, next)
    toast({
      message: next ? `Energi: ${ENERGY_LABELS[next - 1]}.` : 'Energi dihapus.',
      duration: 3000,
      action: { label: 'Urungkan', onClick: () => void setEnergy(data.today, prev) },
    })
  }
  return (
    <div className="card">
      <h3 className="card-title">
        Energi hari ini
        {energy.avg7 != null && (
          <span className="text-[13px] font-medium text-faint">
            rata-rata 7 hari {energy.avg7.toLocaleString('id-ID', { maximumFractionDigits: 1 })}
          </span>
        )}
      </h3>
      <div role="radiogroup" aria-label="Energi hari ini" className="grid grid-cols-5 gap-1.5">
        {ENERGY_LEVELS.map((v) => (
          <button
            key={v}
            type="button"
            role="radio"
            aria-checked={energy.today === v}
            onClick={() => void set(v)}
            className={`rounded-xl border py-2 text-[12.5px] ${energy.today === v ? 'border-transparent bg-btn text-btn-text' : 'border-line text-muted hover:bg-surface-2'}`}
          >
            <span className="block text-[15px] font-semibold tabular-nums">{v}</span>
            {ENERGY_LABELS[v - 1]}
          </button>
        ))}
      </div>
      <div className="mt-3 flex items-end gap-1.5" aria-label="Energi 7 hari terakhir">
        {energy.recent.map((e, i) => (
          <div key={i} className="flex flex-1 flex-col items-center gap-1" title={e ? `${ENERGY_LABELS[e - 1]} (${e})` : 'tidak dicatat'}>
            <div className="h-8 w-full rounded-md bg-track">
              {e != null && (
                <div
                  className="w-full rounded-md"
                  style={{ height: `${(e / 5) * 100}%`, background: TONE[e - 1], marginTop: `${100 - (e / 5) * 100}%` }}
                />
              )}
            </div>
            <span className="text-[10.5px] text-faint">
              {'MSSRKJS'[(new Date(`${addDays(data.today, i - 6)}T00:00:00Z`).getUTCDay() + 6) % 7]}
            </span>
          </div>
        ))}
      </div>
    </div>
  )
}
