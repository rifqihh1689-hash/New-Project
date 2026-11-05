import type { MonthKey } from '../types'
import { monthDates } from './calendar'
import { formatMonth, weekStart } from './time'
import { computeWeekNumbers, type WeekInput, type WeekNumbers } from './weekly'

export interface WeekRow {
  monday: string
  n: WeekNumbers
}

/** Minggu (Senin) yang punya hari di bulan itu, beserta angka minggu itu yang terpotong ke bulan tersebut. */
export function monthWeekRows(month: MonthKey, input: Omit<WeekInput, 'dates'>): WeekRow[] {
  const dates = monthDates(month)
  const mondays = [...new Set(dates.map(weekStart))]
  return mondays.map((monday) => ({
    monday,
    n: computeWeekNumbers({ ...input, dates: dates.filter((d) => weekStart(d) === monday) }),
  }))
}

/** Rata-rata tidur di minggu dengan ≥ 2 jaga dibanding minggu lainnya (bila keduanya ada). */
export function sleepVsJaga(rows: WeekRow[]): { heavy: number | null; light: number | null } {
  const avg = (list: WeekRow[]) => {
    const v = list.map((r) => r.n.avgSleep).filter((x): x is number => x != null)
    return v.length ? Math.round((v.reduce((a, b) => a + b, 0) / v.length) * 10) / 10 : null
  }
  return { heavy: avg(rows.filter((r) => r.n.jaga >= 2)), light: avg(rows.filter((r) => r.n.jaga < 2)) }
}

export interface MonthExtras {
  tasksByRole: { name: string; done: number; total: number }[]
  mutabaah: { name: string; days: number; of: number }[]
  tentir: { hours: number; income: number; perHour: number | null }
  money: { income: number; expense: number; budget: number; bridge: { saved: number; target: number } | null; debtLeft: number }
  training: { strength: number; runKm: number; benchStart: number | null; benchEnd: number | null }
}

const rp = (n: number) => `Rp${Math.round(n).toLocaleString('id-ID')}`
const pct = (a: number, b: number) => (b ? `${Math.round((a / b) * 100)}%` : '–')

/** Ringkasan bulan dalam teks polos, untuk ditempel ke Claude (atau dibaca lewat connector). */
export function monthSummaryText(month: MonthKey, n: WeekNumbers, prev: WeekNumbers | null, weeks: WeekRow[], x: MonthExtras): string {
  const sj = sleepVsJaga(weeks)
  const lines = [
    `Muhasabah bulanan Qawwam — ${formatMonth(month)}`,
    '',
    `XP ${n.xp}${prev ? ` (bulan lalu ${prev.xp})` : ''}; hari lolos ${n.passDays}/${n.recordedDays}; jaga ${n.jaga}×; lembur ${n.overtime}×.`,
    `Tidur rata-rata (selain pasca-jaga): ${n.avgSleep ?? '–'} j${prev?.avgSleep != null ? ` (bulan lalu ${prev.avgSleep} j)` : ''}.`,
    sj.heavy != null && sj.light != null ? `Minggu dengan ≥ 2 jaga: tidur ${sj.heavy} j vs minggu lain ${sj.light} j.` : '',
    `Tugas selesai ${n.tasksDone} (terbuka ${n.tasksOpen}); habit ${pct(n.habitDone, n.habitApplicable)}.`,
    `Per peran: ${x.tasksByRole.map((r) => `${r.name} ${r.done}/${r.total}`).join(', ') || '–'}.`,
    `Mutaba'ah: ${x.mutabaah.map((m) => `${m.name} ${m.days}/${m.of}`).join(', ') || '–'}.`,
    `Tentir: ${Math.round(x.tentir.hours * 10) / 10} j, ${rp(x.tentir.income)}${x.tentir.perHour ? `, ${rp(x.tentir.perHour)}/jam` : ''}.`,
    `Uang: masuk ${rp(x.money.income)}, keluar ${rp(x.money.expense)}${x.money.budget ? ` dari anggaran ${rp(x.money.budget)}` : ''}${
      x.money.bridge ? `; dana jembatan ${rp(x.money.bridge.saved)}/${rp(x.money.bridge.target)}` : ''
    }${x.money.debtLeft ? `; sisa utang ${rp(x.money.debtLeft)}` : ''}.`,
    `Latihan: ${x.training.strength} sesi beban, lari ${x.training.runKm} km${
      x.training.benchEnd != null ? `; bench e1RM ${x.training.benchStart ?? '–'} → ${x.training.benchEnd} kg` : ''
    }.`,
    '',
    'Per minggu (Senin · XP · lolos · jaga · tidur):',
    ...weeks.map((w) => `- ${w.monday} · ${w.n.xp} · ${w.n.passDays}/${w.n.recordedDays} · ${w.n.jaga} · ${w.n.avgSleep ?? '–'} j`),
  ]
  // Buang baris kosong ganda (mis. bila baris tidur vs jaga tidak ada).
  return lines
    .filter((l, i) => !(l === '' && lines[i - 1] === ''))
    .filter((l, i, arr) => l !== '' || (i > 0 && arr[i - 1] !== ''))
    .join('\n')
}
