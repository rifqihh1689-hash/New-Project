import { roleLookup } from '../../db/structure'
import { MONTH_NAMES, monthsBetween } from '../../domain/time'
import type { Phase } from '../../types'
import type { BerandaData } from './data'

const monthYear = (d: string) => `${MONTH_NAMES[Number(d.slice(5, 7)) - 1].slice(0, 3)} ${d.slice(0, 4)}`

function phaseLine(p: Phase, current: boolean, today: string): { title: string; sub: string } {
  if (current) return { title: `Sekarang · ${p.name}`, sub: p.note || (p.end ? `sampai ${monthYear(p.end)}` : '') }
  const date = p.end ?? p.start
  if (!date) return { title: p.name, sub: p.note }
  const months = monthsBetween(today, date)
  const when = months > 0 ? `±${months} bulan lagi` : months === 0 ? 'bulan ini' : 'sudah lewat'
  return { title: `${p.name} · ${monthYear(date)}`, sub: [when, p.note].filter(Boolean).join(' · ') }
}

/** Jalan ke PPDS: fase hidup + Main Quest aktif (maks. 3). */
export function RoadCard({ data }: { data: BerandaData }) {
  const role = roleLookup(data.roles)
  const steps: { key: string; title: string; sub: string; now: boolean }[] = []
  for (const p of data.phases) {
    const now = data.phase?.id === p.id
    steps.push({ key: p.id, ...phaseLine(p, now, data.today), now })
    // Akhir fase saat ini ditampilkan sebagai tonggak sendiri, seperti "Koas selesai · Des 2027".
    if (now && p.end)
      steps.push({
        key: `${p.id}-end`,
        title: `${p.name} selesai · ${monthYear(p.end)}`,
        sub: `±${monthsBetween(data.today, p.end)} bulan lagi`,
        now: false,
      })
  }
  return (
    <div className="card">
      <h3 className="card-title">Jalan ke {data.phases[data.phases.length - 1]?.name.replace(/^Daftar\s+/i, '') ?? 'tujuan'}</h3>
      <ol className="relative grid gap-3.5 pl-[26px] before:absolute before:top-1.5 before:bottom-1.5 before:left-[5px] before:w-0.5 before:bg-track">
        {steps.map((s) => (
          <li key={s.key} className="relative">
            <span
              className={`absolute top-1 -left-[26px] size-3 rounded-full border-2 ${s.now ? 'border-orto bg-orto' : 'border-faint bg-surface'}`}
              aria-hidden="true"
            />
            <b className="font-semibold">{s.title}</b>
            {s.sub && <span className="block text-[12.5px] text-muted">{s.sub}</span>}
          </li>
        ))}
      </ol>
      <div className="mt-4 grid gap-2 border-t border-line pt-3.5">
        {data.mainQuests.length === 0 && <p className="text-[13px] text-muted">Belum ada Main Quest aktif. Dibuat di Target &amp; PPDS.</p>}
        {data.mainQuests.map((q) => (
          <div key={q.id} className="flex items-center gap-2.5 text-[13px]">
            <span className="dot" style={{ background: role(q.roleId).color }} aria-hidden="true" />
            <div className="flex-1">
              {q.name}
              {q.next && <small className="block text-xs text-muted">langkah berikut: {q.next}</small>}
            </div>
            <div className="h-[5px] w-[72px] overflow-hidden rounded-full bg-track">
              <i
                className="block h-full rounded-full"
                style={{ width: `${Math.round(q.progress * 100)}%`, background: role(q.roleId).color }}
              />
            </div>
          </div>
        ))}
      </div>
      <p className="mt-2.5 text-xs text-faint">Main Quest maksimal 3 sekaligus (WIP ≤ 3).</p>
    </div>
  )
}
