import { Minus, Plus } from 'lucide-react'
import { useState } from 'react'
import { Sheet } from '../../components/Sheet'
import { setSleep } from '../../db/daily'
import { formatMultiplier, sleepMultiplier, sleepTotal } from '../../domain/sleep'
import { formatHours } from '../../domain/time'
import type { Day, ISODate, XpRules } from '../../types'

const NAPS = [0, 20, 30, 45, 60, 90, 120]

interface Props {
  open: boolean
  onClose: () => void
  date: ISODate
  day: Day | null
  rules: XpRules
}

/** Pagi: jam tidur malam. Siang: qailulah satu ketukan. Pratinjau pengali langsung terlihat. */
export function SleepSheet({ open, onClose, date, day, rules }: Props) {
  return (
    <Sheet open={open} title="Tidur 24 jam" onClose={onClose}>
      {open && <SleepForm date={date} day={day} rules={rules} onDone={onClose} />}
    </Sheet>
  )
}

function SleepForm({ date, day, rules, onDone }: { date: ISODate; day: Day | null; rules: XpRules; onDone: () => void }) {
  const [night, setNight] = useState<number>(day?.sleepNight ?? 5.5)
  const [nap, setNap] = useState<number>(day?.nap ?? 0)
  const total = sleepTotal(night, nap, rules)
  const mult = sleepMultiplier(total, rules).mult
  const step = (d: number) => setNight((h) => Math.min(12, Math.max(0, Math.round((h + d) * 4) / 4)))
  const save = async (n = nap) => {
    await setSleep(date, night, n)
    onDone()
  }
  return (
    <div className="grid gap-5">
      <div>
        <span className="label">Tidur malam (sebelum qiyamul lail)</span>
        <div className="flex items-center gap-3">
          <button
            type="button"
            className="grid size-10 place-items-center rounded-full bg-surface-2"
            onClick={() => step(-0.25)}
            aria-label="Kurangi 15 menit"
          >
            <Minus size={18} aria-hidden="true" />
          </button>
          <output className="min-w-[110px] text-center text-2xl font-semibold tabular-nums" aria-live="polite">
            {formatHours(night)}
          </output>
          <button
            type="button"
            className="grid size-10 place-items-center rounded-full bg-surface-2"
            onClick={() => step(0.25)}
            aria-label="Tambah 15 menit"
          >
            <Plus size={18} aria-hidden="true" />
          </button>
        </div>
        <div className="mt-2.5 flex flex-wrap gap-1.5">
          {[4, 4.5, 5, 5.5, 6, 6.5, 7].map((h) => (
            <button
              key={h}
              type="button"
              onClick={() => setNight(h)}
              className={`chip py-1 ${night === h ? 'border-transparent bg-btn text-btn-text' : ''}`}
            >
              {formatHours(h)}
            </button>
          ))}
        </div>
      </div>
      <div>
        <span className="label">Qailulah hari ini {rules.napCounts ? '' : '(tidak dihitung, lihat Setelan)'}</span>
        <div className="flex flex-wrap gap-1.5">
          {NAPS.map((m) => (
            <button
              key={m}
              type="button"
              onClick={() => setNap(m / 60)}
              className={`chip py-1 ${Math.round(nap * 60) === m ? 'border-transparent bg-btn text-btn-text' : ''}`}
            >
              {m === 0 ? 'Belum' : m < 60 ? `${m} mnt` : formatHours(m / 60)}
            </button>
          ))}
        </div>
      </div>
      <div className="flex items-center justify-between rounded-xl bg-surface-2 px-4 py-3 text-[13px] text-muted">
        <span>
          Total <b className="text-text">{total == null ? '–' : formatHours(total)}</b>
        </span>
        <span>
          Pengali <b className="text-text">{formatMultiplier(mult)}</b>
        </span>
      </div>
      <button type="button" className="btn-primary w-full py-3" onClick={() => void save()}>
        Simpan
      </button>
    </div>
  )
}
