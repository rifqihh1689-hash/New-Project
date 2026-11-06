import { useClockMinutes } from '../../app/useToday'
import { roleLookup } from '../../db/structure'
import { dayTypeLabel } from '../../domain/dayType'
import { dayRibbon, DAY_END, formatIn, greeting, headline, nowNext } from '../../domain/headline'
import { slotNote } from '../../domain/ritme'
import { DAY_NAMES, MONTH_NAMES, weekday } from '../../domain/time'
import type { RitmeSlot } from '../../types'
import type { BerandaData } from './data'
import { DayTypePicker } from './DayTypePicker'
import { DAY_TYPE_COLORS } from './dayTypeColors'

const DAY_START = 180
const pct = (m: number) => ((Math.min(Math.max(m, DAY_START), DAY_END) - DAY_START) / (DAY_END - DAY_START)) * 100
const clock = (m: number) => `${String(Math.floor(m / 60) % 24).padStart(2, '0')}.${String(m % 60).padStart(2, '0')}`

/**
 * Pembuka Beranda: sapaan menurut jam, satu kalimat arahan yang berubah sepanjang hari, slot ritme
 * yang sedang berjalan & berikutnya, pita 24 jam dengan penanda "sekarang", lalu tipe hari.
 * Warna latarnya mengikuti tipe hari.
 */
export function Hero({ data }: { data: BerandaData }) {
  const minutes = useClockMinutes()
  const role = roleLookup(data.roles)
  const type = data.snap.day?.type ?? null
  const shownType = type ?? data.suggested
  const tint = DAY_TYPE_COLORS[shownType]
  const t = minutes < DAY_START ? minutes + 1440 : minutes
  const { now, next, inMinutes } = nowNext(data.ritme, minutes)
  const blocks = dayRibbon(data.ritme)
  const colorOf = (s: RitmeSlot) => (s.roleId ? (role(s.roleId)?.color ?? 'var(--faint)') : 'var(--faint)')
  const [, m, d] = data.today.split('-').map(Number)
  // Tiap bagian tidak dipatah di tengah ("minggu 2" tetap satu baris).
  const eyebrow = [
    `${DAY_NAMES[weekday(data.today)]}, ${d} ${MONTH_NAMES[m - 1].slice(0, 3)}`,
    data.phase?.name,
    data.chapter ? `${data.chapter.name} · minggu ${data.chapterWeek}` : null,
  ].filter((x): x is string => !!x)
  const line = headline({
    type,
    suggested: data.suggested,
    invalidPasca: data.snap.result.invalidPasca,
    hasTentir: data.tentir.today,
    workLabel: dayTypeLabel('stase', data.phase),
    pulang: data.pulang,
    minutes,
    workEndLimit: data.rules.workEndLimit,
    napDone: (data.snap.day?.nap ?? 0) > 0,
  })
  const summary = blocks.map((b) => `${b.slot.time} ${b.slot.title}`).join(', ')

  return (
    <section
      className="relative mt-3 mb-3.5 overflow-hidden rounded-[22px] border border-line bg-surface p-4 sm:p-5 md:mt-[22px] md:p-6"
      aria-labelledby="hero-greeting"
    >
      {/* Cahaya lembut berwarna tipe hari: biru stase, ungu jaga, toska pasca, emas libur. */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -top-28 -right-20 size-72 rounded-full opacity-[0.22] blur-3xl transition-colors duration-700"
        style={{ background: tint }}
      />
      <div className="relative grid gap-4 lg:grid-cols-[1fr_minmax(300px,380px)] lg:items-end lg:gap-8">
        <div className="min-w-0">
          <div className="flex flex-wrap gap-x-1.5 text-[11.5px] font-medium tracking-[0.07em] text-muted uppercase">
            {eyebrow.map((part, i) => (
              <span key={part} className="whitespace-nowrap">
                {i > 0 && (
                  <span aria-hidden="true" className="mr-1.5">
                    ·
                  </span>
                )}
                {part}
              </span>
            ))}
          </div>
          <h2 id="hero-greeting" className="mt-1.5 font-serif text-[27px] leading-[1.15] font-normal tracking-[-0.01em] md:text-[34px]">
            {greeting(minutes, data.profile.name)}
          </h2>
          <p className="mt-1.5 max-w-[560px] text-[14.5px] leading-snug text-muted md:text-[15.5px]">{line}</p>
        </div>

        <div className="grid grid-cols-2 gap-2">
          <NowTile
            label={type ? 'Sekarang' : 'Perkiraan'}
            slot={now}
            color={now ? colorOf(now) : null}
            sub={now ? (now.until ? `${now.time}–${now.until}` : (slotNote(now) ?? `sejak ${now.time}`)) : undefined}
            empty={next ? `Jeda sampai ${next.time}` : 'Hari sudah selesai'}
          />
          <NowTile
            label="Berikutnya"
            slot={next}
            color={next ? colorOf(next) : null}
            sub={next && inMinutes != null ? `${formatIn(inMinutes)} lagi` : undefined}
            showTime
            empty="Tutup hari & tidur"
          />
        </div>
      </div>

      {blocks.length > 0 && (
        <div className="relative mt-3.5 md:mt-4">
          <div
            role="img"
            aria-label={`Ritme hari ini: ${summary}. Sekarang ${clock(minutes)}.`}
            className="relative h-2.5 rounded-full bg-track"
          >
            {blocks.map((b) => (
              <span
                key={`${b.slot.time}-${b.slot.title}`}
                className="absolute inset-y-0 rounded-full"
                style={{
                  left: `calc(${pct(b.start)}% + 1px)`,
                  width: `max(3px, calc(${pct(b.end) - pct(b.start)}% - 2px))`,
                  background: colorOf(b.slot),
                  opacity: b.end <= t ? 0.35 : 1,
                }}
              />
            ))}
            <span
              aria-hidden="true"
              className="absolute -top-1.5 -bottom-1.5 w-[3px] -translate-x-1/2 rounded-full bg-text ring-2 ring-surface"
              style={{ left: `${pct(t)}%` }}
            />
          </div>
          <div className="mt-1 flex justify-between text-[10.5px] text-faint tabular-nums md:text-[11px]" aria-hidden="true">
            <span>03.00</span>
            <span>09.00</span>
            <span>15.00</span>
            <span>21.00</span>
            <span>03.00</span>
          </div>
        </div>
      )}

      <DayTypePicker
        date={data.today}
        value={type}
        suggested={data.suggested}
        phase={data.phase}
        variant="segmented"
        className="relative mt-3.5 md:mt-4 lg:max-w-[560px]"
      />
    </section>
  )
}

function NowTile({
  label,
  slot,
  color,
  sub,
  empty,
  showTime = false,
}: {
  label: string
  slot: RitmeSlot | null
  color: string | null
  sub?: string
  empty: string
  showTime?: boolean
}) {
  return (
    <div className="min-w-0 rounded-2xl border border-line bg-bg/40 px-3 py-2.5">
      <div className="truncate text-[11px] font-semibold tracking-[0.05em] text-faint uppercase">{label}</div>
      {slot ? (
        <>
          <div className="mt-1 flex min-w-0 items-start gap-1.5 text-[14px] leading-snug font-semibold">
            <span className="mt-[6px] size-2 shrink-0 rounded-full" style={{ background: color ?? 'var(--faint)' }} aria-hidden="true" />
            <span className="line-clamp-2 min-w-0">
              {showTime && <span className="font-normal text-muted tabular-nums">{slot.time} </span>}
              {slot.title}
            </span>
          </div>
          {sub && <div className="mt-0.5 truncate pl-3.5 text-xs text-muted tabular-nums">{sub}</div>}
        </>
      ) : (
        <div className="mt-1 text-[14px] leading-snug font-semibold text-muted">{empty}</div>
      )}
    </div>
  )
}
