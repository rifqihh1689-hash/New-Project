import { Gift } from 'lucide-react'
import { formatMultiplier } from '../../domain/sleep'
import { formatNumber } from '../../lib/format'
import type { BerandaData } from './data'

/** Satu strip tipis: level, XP, pengali tidur, streak. Tidak ada yang mengejar. */
export function GameStrip({ data }: { data: BerandaData }) {
  const { level, snap, streak } = data
  const r = snap.result
  const pct = Math.round((level.into / level.need) * 100)
  let mult: string
  if (!snap.day?.type) mult = 'pilih tipe hari'
  else if (r.effType === 'pasca') mult = 'pasca-jaga'
  else if (r.effType === 'jaga') mult = `jaga ${formatMultiplier(r.mult)}`
  else if (r.multMissing) mult = `tidur belum diisi ${formatMultiplier(r.mult)}`
  else mult = `tidur ${formatMultiplier(r.mult)}`
  return (
    <div className="mb-3.5 flex flex-wrap items-center gap-2.5 rounded-[14px] border border-line bg-surface px-3.5 py-2.5 text-[13px] text-muted sm:px-4 md:gap-[18px]">
      <div className="flex items-center gap-2.5">
        <div
          className="relative grid size-[30px] place-items-center rounded-full text-[11px] font-bold text-text"
          style={{ background: `conic-gradient(var(--color-tentir) ${pct}%, var(--track) 0)` }}
          aria-hidden="true"
        >
          <span className="absolute inset-[3px] rounded-full bg-surface" />
          <span className="relative">{level.level}</span>
        </div>
        <div>
          <b className="font-semibold text-text">Level {level.level}</b>
          <span className="hidden sm:inline">
            {' '}
            · {formatNumber(level.into)} / {formatNumber(level.need)} XP
          </span>
        </div>
      </div>
      <div
        className="h-[5px] min-w-[40px] flex-1 overflow-hidden rounded-full bg-track"
        role="progressbar"
        aria-label="XP menuju level berikutnya"
        aria-valuenow={pct}
        aria-valuemin={0}
        aria-valuemax={100}
      >
        <i className="block h-full rounded-full bg-tentir transition-[width] duration-500" style={{ width: `${pct}%` }} />
      </div>
      <div>
        <b className="font-semibold text-text">{r.xp}</b> XP<span className="hidden sm:inline"> hari ini</span>
      </div>
      {data.tokens > 0 && (
        <a
          href="#/hadiah"
          className="flex items-center gap-1.5 rounded-full px-2.5 py-[3px] font-semibold text-ok"
          style={{ background: 'color-mix(in srgb, var(--ok) 14%, transparent)' }}
        >
          <Gift size={13} aria-hidden="true" /> {data.tokens} token
        </a>
      )}
      <div
        className="rounded-full px-2.5 py-[3px] font-semibold text-uang"
        style={{ background: 'color-mix(in srgb, var(--color-uang) 16%, transparent)' }}
      >
        {mult}
      </div>
      <div className="hidden sm:block">
        Streak <b className="font-semibold text-text">{streak.current} hari</b>
      </div>
    </div>
  )
}
