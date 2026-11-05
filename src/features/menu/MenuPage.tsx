import { ChevronLeft, ChevronRight, Plus, RefreshCw, ShoppingBasket, Sparkles } from 'lucide-react'
import { useState } from 'react'
import { navigate, routeHref } from '../../app/router'
import { useToday } from '../../app/useToday'
import { PageTop } from '../../components/PageTop'
import { Sheet } from '../../components/Sheet'
import { useToast } from '../../components/toast-context'
import { autoPlan, restorePlan, setMeal, shoppingTask, updateNutrition } from '../../db/menu'
import { DAY_TYPE_LABELS } from '../../domain/dayType'
import { formatQty, mealsForPhase, PHASE_LABELS, SLOT_LABELS } from '../../domain/menu'
import { addDays, DAY_NAMES, MONTH_NAMES, weekday, weekStart } from '../../domain/time'
import { formatRupiah } from '../../lib/format'
import type { FoodPhase, MealSlot, Menu } from '../../types'
import { DAY_TYPE_COLORS } from '../beranda/dayTypeColors'
import { useMenuPage, type MenuPageData } from './data'
import { MenuEditor, type MenuDraft } from './MenuEditor'

const shortDate = (d: string) => `${Number(d.slice(8))} ${MONTH_NAMES[Number(d.slice(5, 7)) - 1].slice(0, 3)}`

function SourceTag({ menu }: { menu: Menu }) {
  return (
    <span
      className={`rounded-md px-1.5 py-px text-[10.5px] font-medium ${menu.source === 'masak' ? 'bg-surface-2 text-ok' : 'bg-surface-2 text-uang'}`}
    >
      {menu.source === 'masak' ? 'masak' : 'beli'}
    </span>
  )
}

function Settings({ data }: { data: MenuPageData }) {
  const n = data.nutrition
  const seg = <T extends string | number>(value: T, options: { v: T; label: string }[], onPick: (v: T) => void, label: string) => (
    <div role="radiogroup" aria-label={label} className="flex rounded-full bg-surface-2 p-[3px]">
      {options.map((o) => (
        <button
          key={String(o.v)}
          type="button"
          role="radio"
          aria-checked={value === o.v}
          onClick={() => onPick(o.v)}
          className={`flex-1 rounded-full px-3 py-1.5 text-[13px] ${value === o.v ? 'bg-surface text-text shadow-sm' : 'text-muted'}`}
        >
          {o.label}
        </button>
      ))}
    </div>
  )
  return (
    <section className="card">
      <h2 className="card-title">Setelan makan</h2>
      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        <label className="text-xs text-muted">
          Berat badan (kg)
          <input
            className="field mt-1"
            inputMode="decimal"
            defaultValue={n.weightKg ?? ''}
            placeholder="mis. 70"
            onBlur={(e) => {
              const v = Number(e.target.value.replace(',', '.'))
              void updateNutrition({ weightKg: v > 20 && v < 250 ? Math.round(v * 10) / 10 : null })
            }}
          />
        </label>
        <div className="text-xs text-muted">
          Fase
          <div className="mt-1">
            {seg<FoodPhase>(
              n.phase,
              (['bulk', 'maintain', 'cut'] as const).map((v) => ({ v, label: PHASE_LABELS[v] })),
              (phase) => void updateNutrition({ phase, mealsPerDay: mealsForPhase(phase) }),
              'Fase',
            )}
          </div>
        </div>
        <div className="text-xs text-muted">
          Makan per hari
          <div className="mt-1">
            {seg<3 | 4 | 5>(
              n.mealsPerDay,
              [3, 4, 5].map((v) => ({ v: v as 3 | 4 | 5, label: `${v}×` })),
              (mealsPerDay) => void updateNutrition({ mealsPerDay }),
              'Makan per hari',
            )}
          </div>
        </div>
        <div className="grid grid-cols-2 gap-2">
          <label className="text-xs text-muted">
            Protein g/kg
            <input
              className="field mt-1"
              inputMode="decimal"
              defaultValue={n.proteinPerKg}
              onBlur={(e) => {
                const v = Number(e.target.value.replace(',', '.'))
                if (v >= 0.8 && v <= 3) void updateNutrition({ proteinPerKg: v })
              }}
            />
          </label>
          <label className="text-xs text-muted">
            Anggaran/minggu
            <input
              className="field mt-1"
              inputMode="numeric"
              defaultValue={n.weeklyBudget}
              onBlur={(e) => {
                const v = Number(e.target.value.replace(/[^\d]/g, ''))
                if (v >= 50_000) void updateNutrition({ weeklyBudget: v })
              }}
            />
          </label>
        </div>
      </div>
      <p className="mt-2 text-xs text-faint">
        {data.target
          ? `Target protein ±${data.target} g/hari (${n.proteinPerKg} g × ${n.weightKg} kg).`
          : 'Isi berat badan untuk menghitung target protein.'}{' '}
        Fase bulk = 5× makan, maintain 4×, cut 3× (bisa diubah).
      </p>
    </section>
  )
}

function Summary({ data }: { data: MenuPageData }) {
  const s = data.summary
  const budget = data.nutrition.weeklyBudget
  const pct = Math.round((s.totalCost / budget) * 100)
  // Merah hanya untuk anggaran yang terlewati; protein di atas target itu baik.
  const tile = (label: string, value: string, sub: string, bar?: number, overIsBad = false) => (
    <div className="card">
      <div className="text-[12.5px] text-muted">{label}</div>
      <div className="mt-1 mb-0.5 text-[21px] font-semibold tracking-tight md:text-2xl">{value}</div>
      {bar !== undefined && (
        <div className="my-2 h-1.5 overflow-hidden rounded-full bg-track">
          <i
            className="block h-full rounded-full"
            style={{ width: `${Math.min(100, bar)}%`, background: overIsBad && bar > 100 ? 'var(--danger)' : 'var(--color-tentir)' }}
          />
        </div>
      )}
      <div className="text-[12.5px] text-muted">{sub}</div>
    </div>
  )
  const total = data.dates.length * data.slots.length
  return (
    <section className="mt-3 grid grid-cols-2 gap-2.5 md:gap-3 xl:grid-cols-3">
      {tile('Perkiraan biaya minggu ini', formatRupiah(s.totalCost), `${pct}% dari ${formatRupiah(budget)}`, pct, true)}
      {tile(
        'Protein rata-rata',
        s.avgProtein == null ? '–' : `${s.avgProtein} g`,
        data.target ? `target ${data.target} g/hari` : 'isi berat badan untuk target',
        data.target && s.avgProtein != null ? (s.avgProtein / data.target) * 100 : undefined,
      )}
      {tile('Terisi', `${s.filled}/${total}`, `${data.slots.length}× makan × 7 hari`)}
    </section>
  )
}

function Picker({
  open,
  slot,
  date,
  current,
  menus,
  onClose,
}: {
  open: boolean
  slot: MealSlot | null
  date: string | null
  current: string | null
  menus: Menu[]
  onClose: () => void
}) {
  const active = menus.filter((m) => !m.archived)
  const fit = active.filter((m) => slot && m.slots.includes(slot))
  const other = active.filter((m) => !slot || !m.slots.includes(slot))
  const pick = async (id: string | null) => {
    if (slot && date) await setMeal(date, slot, id)
    onClose()
  }
  const row = (m: Menu) => (
    <li key={m.id}>
      <button
        type="button"
        onClick={() => void pick(m.id)}
        className={`flex w-full items-center gap-2 rounded-xl px-3 py-2.5 text-left text-[13.5px] hover:bg-surface-2 ${current === m.id ? 'bg-surface-2' : ''}`}
      >
        <span className="flex-1">{m.name}</span>
        <SourceTag menu={m} />
        <span className="w-[74px] text-right text-xs text-muted tabular-nums">
          {m.proteinG} g · {Math.round(m.costRp / 1000)}rb
        </span>
      </button>
    </li>
  )
  return (
    <Sheet open={open} title={slot && date ? `${SLOT_LABELS[slot]} · ${DAY_NAMES[weekday(date)]}` : ''} onClose={onClose}>
      <ul className="grid gap-0.5">{fit.map(row)}</ul>
      {other.length > 0 && (
        <details className="mt-2">
          <summary className="cursor-pointer px-3 text-xs text-muted">Menu lain ({other.length})</summary>
          <ul className="mt-1 grid gap-0.5">{other.map(row)}</ul>
        </details>
      )}
      {current && (
        <button type="button" className="btn-ghost mt-3 w-full border border-line" onClick={() => void pick(null)}>
          Kosongkan
        </button>
      )}
    </Sheet>
  )
}

function WeekPlan({ data, today }: { data: MenuPageData; today: string }) {
  const [picking, setPicking] = useState<{ date: string; slot: MealSlot } | null>(null)
  const byId = new Map(data.menus.map((m) => [m.id, m]))
  return (
    <section className="mt-3 gap-3 lg:columns-2">
      {data.dates.map((date) => {
        const type = data.dayTypes.get(date)
        const day = data.summary.days.find((d) => d.date === date)!
        return (
          <div
            key={date}
            className={`card mb-3 break-inside-avoid p-3.5 md:p-4 ${date === today ? 'outline-[1.5px] outline-text outline-solid' : ''}`}
          >
            <div className="mb-1.5 flex items-center gap-2">
              <span className="font-semibold">{DAY_NAMES[weekday(date)]}</span>
              <span className="text-[13px] text-muted">{shortDate(date)}</span>
              {type && (
                <span className="flex items-center gap-1.5 text-xs text-muted">
                  <span className="dot" style={{ background: DAY_TYPE_COLORS[type] }} aria-hidden="true" />
                  {DAY_TYPE_LABELS[type]}
                </span>
              )}
              <span className="ml-auto text-xs text-faint tabular-nums">
                {day.protein} g · {formatRupiah(day.cost)}
              </span>
            </div>
            <ul>
              {data.slots.map((slot) => {
                const id = data.plan.get(`${date}|${slot}`)
                const m = id ? byId.get(id) : undefined
                return (
                  <li key={slot}>
                    <button
                      type="button"
                      onClick={() => setPicking({ date, slot })}
                      className="flex w-full items-center gap-2 border-t border-line py-2 text-left first:border-t-0"
                      aria-label={`${SLOT_LABELS[slot]} ${DAY_NAMES[weekday(date)]}: ${m?.name ?? 'kosong'}`}
                    >
                      <span className="w-[86px] shrink-0 text-xs text-muted">{SLOT_LABELS[slot]}</span>
                      {m ? (
                        <>
                          <span className="flex-1 text-[13.5px]">{m.name}</span>
                          <SourceTag menu={m} />
                          <span className="w-10 text-right text-xs text-faint tabular-nums">{m.proteinG} g</span>
                        </>
                      ) : (
                        <span className="flex-1 text-[13px] text-faint">pilih menu…</span>
                      )}
                    </button>
                  </li>
                )
              })}
            </ul>
          </div>
        )
      })}
      <Picker
        open={!!picking}
        slot={picking?.slot ?? null}
        date={picking?.date ?? null}
        current={picking ? (data.plan.get(`${picking.date}|${picking.slot}`) ?? null) : null}
        menus={data.menus}
        onClose={() => setPicking(null)}
      />
    </section>
  )
}

function Shopping({ data, today }: { data: MenuPageData; today: string }) {
  const toast = useToast()
  if (!data.shopping.length) return null
  // Belanja di hari libur pertama minggu ini yang belum lewat, atau hari ini.
  const shopDate =
    data.dates.find((d) => d >= today && data.dayTypes.get(d) === 'libur') ??
    (today >= data.dates[0] && today <= data.dates[6] ? today : data.dates[0])
  const make = async () => {
    await shoppingTask(data.shopping, shopDate, formatQty)
    toast({
      message: `Tugas "Belanja mingguan" dibuat untuk ${DAY_NAMES[weekday(shopDate)]}.`,
      action: { label: 'Lihat', onClick: () => navigate('tugas', shopDate) },
    })
  }
  return (
    <section className="card mt-3">
      <h2 className="card-title">
        <ShoppingBasket size={17} className="text-muted" aria-hidden="true" />
        Daftar belanja <span className="text-[13px] font-medium text-faint">dari menu masak minggu ini</span>
      </h2>
      <ul className="grid gap-x-6 gap-y-1 text-[13.5px] sm:grid-cols-2">
        {data.shopping.map((i) => (
          <li key={`${i.name}|${i.unit}`} className="flex justify-between border-b border-line py-1.5">
            <span>{i.name}</span>
            <span className="text-muted tabular-nums">{formatQty(i)}</span>
          </li>
        ))}
      </ul>
      <button type="button" className="btn-ghost mt-3 border border-line" onClick={() => void make()}>
        Jadikan tugas belanja ({DAY_NAMES[weekday(shopDate)]})
      </button>
    </section>
  )
}

function Library({ data }: { data: MenuPageData }) {
  const [editing, setEditing] = useState<MenuDraft | null>(null)
  const groups = [
    { label: 'Masak', list: data.menus.filter((m) => !m.archived && m.source === 'masak') },
    { label: 'Beli', list: data.menus.filter((m) => !m.archived && m.source === 'beli') },
  ]
  const archived = data.menus.filter((m) => m.archived)
  return (
    <section className="card mt-3">
      <h2 className="card-title">
        Daftar menu <span className="text-[13px] font-medium text-faint">{data.menus.length - archived.length}</span>
        <button type="button" onClick={() => setEditing('baru')} className="btn-ghost -my-1 ml-auto border border-line py-1.5">
          <Plus size={15} aria-hidden="true" /> Menu baru
        </button>
      </h2>
      <div className="grid gap-4 md:grid-cols-2">
        {groups.map((g) => (
          <div key={g.label}>
            <div className="mb-1 text-xs font-medium tracking-wide text-faint uppercase">{g.label}</div>
            <ul>
              {g.list.map((m) => (
                <li key={m.id}>
                  <button
                    type="button"
                    onClick={() => setEditing(m)}
                    className="flex w-full items-center gap-2 border-t border-line py-2 text-left first:border-t-0"
                  >
                    <span className="flex-1 text-[13.5px]">
                      {m.name}
                      <span className="block text-xs text-muted">
                        {m.slots.map((s) => SLOT_LABELS[s]).join(', ')}
                        {m.bekal ? ' · bekal' : ''}
                        {m.heavyCook ? ' · masak lama' : ''}
                      </span>
                    </span>
                    <span className="text-right text-xs text-muted tabular-nums">
                      {m.proteinG} g<span className="block">{formatRupiah(m.costRp)}</span>
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
      {archived.length > 0 && (
        <details className="mt-3 text-[13px]">
          <summary className="cursor-pointer text-muted">Diarsipkan ({archived.length})</summary>
          <ul className="mt-1">
            {archived.map((m) => (
              <li key={m.id}>
                <button type="button" className="py-1 text-muted hover:text-text" onClick={() => setEditing(m)}>
                  {m.name}
                </button>
              </li>
            ))}
          </ul>
        </details>
      )}
      <p className="mt-3 text-xs text-faint">
        Menu bawaan berisi ayam & telur, harga dan protein perkiraan. Tambah menu sendiri di sini atau lewat{' '}
        <a href={routeHref('impor')} className="underline-offset-2 hover:underline">
          Impor
        </a>
        .
      </p>
      <MenuEditor draft={editing} onClose={() => setEditing(null)} />
    </section>
  )
}

export function MenuPage({ date: routeDate }: { date: string | null }) {
  const today = useToday()
  const toast = useToast()
  const [monday, setMonday] = useState(() => weekStart(routeDate ?? today))
  const data = useMenuPage(monday)
  const thisWeek = monday === weekStart(today)
  const run = async (onlyEmpty: boolean) => {
    if (!data) return
    const before = await autoPlan(data.dates, data.dayTypes, { onlyEmpty })
    toast({
      message: onlyEmpty ? 'Waktu makan yang kosong sudah diisi.' : 'Menu minggu ini disusun ulang.',
      duration: 6000,
      action: { label: 'Urungkan', onClick: () => void restorePlan(data.dates, before) },
    })
  }
  return (
    <>
      <PageTop title="Menu" />
      <h1 className="mt-4 text-[26px] font-semibold tracking-tight md:hidden">Menu</h1>
      <section className="mt-3 flex flex-wrap items-center gap-3 md:mt-[26px]">
        <div className="flex items-center gap-1">
          <button type="button" className="btn-ghost p-2" onClick={() => setMonday(addDays(monday, -7))} aria-label="Minggu sebelumnya">
            <ChevronLeft size={18} aria-hidden="true" />
          </button>
          <div className="min-w-[150px] text-center">
            <div className="font-serif text-xl">{thisWeek ? 'Minggu ini' : `${shortDate(monday)} – ${shortDate(addDays(monday, 6))}`}</div>
            <div className="text-xs text-muted">
              {shortDate(monday)} – {shortDate(addDays(monday, 6))}
            </div>
          </div>
          <button type="button" className="btn-ghost p-2" onClick={() => setMonday(addDays(monday, 7))} aria-label="Minggu berikutnya">
            <ChevronRight size={18} aria-hidden="true" />
          </button>
        </div>
        <div className="flex flex-wrap gap-2 lg:ml-auto">
          <button type="button" className="btn-primary" onClick={() => void run(true)}>
            <Sparkles size={15} aria-hidden="true" /> Isi otomatis
          </button>
          <button type="button" className="btn-ghost border border-line" onClick={() => void run(false)}>
            <RefreshCw size={15} aria-hidden="true" /> Susun ulang
          </button>
        </div>
      </section>
      {data && (
        <>
          <Summary data={data} />
          <WeekPlan data={data} today={today} />
          <Shopping data={data} today={today} />
          <Settings data={data} />
          <Library data={data} />
        </>
      )}
      <p className="mt-3 text-xs text-faint">
        Isi otomatis mengikuti tipe hari: libur → masak (sekalian untuk bekal), stase → siang beli atau bekal, jaga → malam bekal,
        pasca-jaga → yang praktis. Tipe hari mendatang bisa diatur di Tugas atau lewat impor jadwal jaga.
      </p>
    </>
  )
}
