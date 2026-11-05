import { useLiveQuery } from 'dexie-react-hooks'
import { useState } from 'react'
import { useToast } from '../../components/toast-context'
import { loadProfile, rulesOf, updateRules } from '../../db/structure'
import { normalizeClock } from '../../domain/ritme'

/**
 * Batas kerja malam (aturan MBAPPE OS "berhenti kerja ≤ 21.00") dibuat fleksibel:
 * jamnya bisa diganti, penaltinya diatur, atau aturannya dimatikan sama sekali.
 */
export function WorkEndSettings() {
  const rules = useLiveQuery(async () => rulesOf(await loadProfile()), [])
  if (!rules) return null
  return <Body key={`${rules.workEndLimit}-${rules.overtimePenalty}`} limit={rules.workEndLimit} penalty={rules.overtimePenalty} />
}

function Body({ limit, penalty }: { limit: string | null; penalty: number }) {
  const toast = useToast()
  const [time, setTime] = useState(limit ?? '21.00')
  const on = limit != null
  const saveTime = async () => {
    const t = normalizeClock(time)
    if (!t) {
      toast({ message: 'Format jam: 21.00', tone: 'error' })
      setTime(limit ?? '21.00')
      return
    }
    if (t !== limit) {
      await updateRules({ workEndLimit: t })
      toast({ message: `Batas kerja malam: ${t}.` })
    }
  }
  return (
    <section className="card">
      <h2 className="card-title">Batas kerja malam</h2>
      <div role="radiogroup" aria-label="Batas kerja malam" className="flex rounded-full bg-surface-2 p-[3px]">
        {(
          [
            [true, 'Aktif'],
            [false, 'Mati'],
          ] as const
        ).map(([v, label]) => (
          <button
            key={label}
            type="button"
            role="radio"
            aria-checked={on === v}
            onClick={() => void updateRules({ workEndLimit: v ? (normalizeClock(time) ?? '21.00') : null })}
            className={`flex-1 rounded-full px-3 py-1.5 text-[13px] ${on === v ? 'bg-surface text-text shadow-sm' : 'text-muted'}`}
          >
            {label}
          </button>
        ))}
      </div>
      {on && (
        <div className="mt-3 grid grid-cols-2 gap-2">
          <label className="text-xs text-muted">
            Berhenti kerja paling lambat
            <input
              className="field mt-1"
              inputMode="numeric"
              value={time}
              onChange={(e) => setTime(e.target.value)}
              onBlur={() => void saveTime()}
              aria-label="Jam batas kerja malam"
            />
          </label>
          <label className="text-xs text-muted">
            Penalti bila lewat (XP)
            <input
              className="field mt-1"
              inputMode="numeric"
              defaultValue={penalty}
              aria-label="Penalti lewat batas"
              onBlur={(e) => {
                const v = Math.round(Number(e.target.value))
                if (v >= 0 && v <= 100 && v !== penalty) void updateRules({ overtimePenalty: v })
              }}
            />
          </label>
        </div>
      )}
      <p className="mt-3 text-xs text-faint">
        {on
          ? `Habit "Berhenti kerja ≤ ${limit}" dan quest "Sesi tentir selesai ≤ ${limit}" mengikuti jam ini. Lembur hanya tercatat bila kamu pilih "Lewat" di Tutup hari; sesi tentir tidak pernah otomatis dihitung lembur. Isi 0 untuk tanpa penalti.`
          : 'Tanpa batas: tidak ada penalti malam, habit "Berhenti kerja", atau quest batas tentir. Hari yang sudah terkunci tidak berubah.'}
      </p>
    </section>
  )
}

/** Berapa hari ke belakang yang centangnya masih mengubah XP. Hari yang lebih lama tetap bisa dicentang (catatan). */
export function BackfillSettings() {
  const rules = useLiveQuery(async () => rulesOf(await loadProfile()), [])
  if (!rules) return null
  return (
    <section className="card">
      <h2 className="card-title">Isi mundur</h2>
      <div role="radiogroup" aria-label="Isi mundur" className="flex rounded-full bg-surface-2 p-[3px]">
        {[1, 2, 3, 7].map((n) => (
          <button
            key={n}
            type="button"
            role="radio"
            aria-checked={rules.backfillDays === n}
            onClick={() => void updateRules({ backfillDays: n })}
            className={`flex-1 rounded-full px-3 py-1.5 text-[13px] ${rules.backfillDays === n ? 'bg-surface text-text shadow-sm' : 'text-muted'}`}
          >
            {n} hari
          </button>
        ))}
      </div>
      <p className="mt-3 text-xs text-faint">
        Centang habit & tugas sampai {rules.backfillDays} hari ke belakang masih mengubah XP. Hari yang lebih lama tetap bisa dicentang
        untuk catatan, tapi XP-nya sudah dibekukan (diberi tahu saat dicentang). Hari yang sudah beku tidak ikut berubah bila angka ini
        dinaikkan.
      </p>
    </section>
  )
}
