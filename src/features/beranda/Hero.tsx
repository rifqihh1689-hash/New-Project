import { roleLookup } from '../../db/structure'
import { dayTypeLabel } from '../../domain/dayType'
import { dayRibbon, DAY_END, formatIn, headline, nowNext } from '../../domain/headline'
import { pickInsights, type Insight } from '../../domain/insights'
import { slotNote } from '../../domain/ritme'
import { DAY_NAMES, MONTH_NAMES, weekday } from '../../domain/time'
import type { RitmeSlot } from '../../types'
import type { BerandaData } from './data'
import { DayTypePicker } from './DayTypePicker'
import { DAY_TYPE_COLORS } from './dayTypeColors'
import { useSchedule } from './useSchedule'

const DAY_START = 180
const pct = (m: number) => ((Math.min(Math.max(m, DAY_START), DAY_END) - DAY_START) / (DAY_END - DAY_START)) * 100
const clock = (m: number) => `${String(Math.floor(m / 60) % 24).padStart(2, '0')}.${String(m % 60).padStart(2, '0')}`

/**
 * Pembuka Beranda: sapaan menurut jam, satu kalimat arahan yang berubah sepanjang hari, slot ritme
 * yang sedang berjalan & berikutnya, pita 24 jam dengan penanda "sekarang", lalu tipe hari.
 * Warna latarnya mengikuti tipe hari.
 */
export function Hero({ data }: { data: BerandaData }) {
  // Jadwal terpadu: ritme + sesi tentir + agenda + latihan terjadwal + jam tidur.
  const schedule = useSchedule(data)
  const minutes = schedule.minutes
  const role = roleLookup(data.roles)
  const type = data.snap.day?.type ?? null
  const shownType = type ?? data.suggested
  const tint = DAY_TYPE_COLORS[shownType]
  const t = minutes < DAY_START ? minutes + 1440 : minutes
  const { now, next, inMinutes } = nowNext(schedule.items, minutes)
  const blocks = dayRibbon(schedule.items)
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
  const effType = type == null ? null : data.snap.result.effType
  const insights = pickInsights({
    ...data.insightBase,
    today: data.today,
    dayType: effType,
    ritmeLine: line,
    level: data.level,
    streak: data.streak,
    tentir: { hours: data.tentir.hours, min: data.tentir.capacity.min, max: data.tentir.capacity.max },
    money: { expense: data.money.expense, budget: data.money.budget },
    mutabaah: data.mutabaah.map((m) => ({ name: m.item.name, week: m.week })),
  })
  const [top, ...rest] = insights
  // Kalimat ritme tetap ada sebagai baris kecil terakhir (arah per tipe hari), temuan lain maksimal dua.
  const more = rest.filter((x) => x.id !== 'ritme').slice(0, 2)
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
          <h2 id="hero-greeting" className="mt-1.5 font-serif text-[23px] leading-[1.2] font-normal tracking-[-0.01em] md:text-[30px]">
            {top.title}
          </h2>
          {top.detail && <p className="mt-1.5 max-w-[560px] text-[14.5px] leading-snug text-muted md:text-[15.5px]">{top.detail}</p>}
          {top.href && (
            <a href={top.href} className="mt-1.5 inline-block text-[13px] text-faint underline-offset-2 hover:text-text hover:underline">
              Buka →
            </a>
          )}
          {more.length > 0 && (
            <ul className="mt-3 grid max-w-[560px] gap-1.5">
              {more.map((x) => (
                <InsightLine key={x.id} insight={x} />
              ))}
            </ul>
          )}
          {top.id !== 'ritme' && <p className="mt-2 max-w-[560px] text-[12.5px] leading-snug text-faint">{line}</p>}
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
            {blocks.map((b, i) => (
              <span
                key={`${i}-${b.slot.time}-${b.slot.title}`}
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

const TONE: Record<Insight['tone'], string> = { good: 'var(--ok)', warn: 'var(--danger)', info: 'var(--faint)' }

function InsightLine({ insight }: { insight: Insight }) {
  const body = (
    <>
      <span className="mt-[7px] size-1.5 shrink-0 rounded-full" style={{ background: TONE[insight.tone] }} aria-hidden="true" />
      <span className="min-w-0">
        <span className="text-text">{insight.title}</span> {insight.detail && <span className="text-muted">{insight.detail}</span>}
      </span>
    </>
  )
  return (
    <li className="text-[13px] leading-snug">
      {insight.href ? (
        <a href={insight.href} className="flex gap-2 rounded-lg hover:bg-surface-2/60">
          {body}
        </a>
      ) : (
        <div className="flex gap-2">{body}</div>
      )}
    </li>
  )
}
