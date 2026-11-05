import { Plus, RotateCcw, Trash2 } from 'lucide-react'
import { useState } from 'react'
import { useToday } from '../../app/useToday'
import { useToast } from '../../components/toast-context'
import { assertNoPatientIdentity } from '../../db/daily'
import { DEFAULT_RITME } from '../../db/defaults'
import { deleteChapter, saveChapter, saveRitme, useChapters, useProfile, useRoles } from '../../db/structure'
import { DAY_TYPE_LABELS, DAY_TYPES } from '../../domain/dayType'
import { normalizeClock, slotOrder } from '../../domain/ritme'
import { addDays, isValidISODate } from '../../domain/time'
import { createId } from '../../lib/id'
import type { Chapter, DayType, RitmeSlot } from '../../types'

/** `HH.MM` ↔ nilai `<input type="time">` (`HH:MM`). */
const toInput = (v?: string) => (v ? v.replace('.', ':') : '')
const fromInput = (v: string) => (v ? normalizeClock(v) : null)

function useGuard() {
  const toast = useToast()
  return async (fn: () => Promise<void>) => {
    try {
      await fn()
    } catch (e) {
      toast({ message: (e as Error).message, tone: 'error' })
    }
  }
}

/** Stase: rentang tanggal, bobot, dan jam masuk/pulang khusus. */
export function StaseSettings() {
  const today = useToday()
  const chapters = useChapters()
  const toast = useToast()
  const guard = useGuard()
  const save = (c: Chapter) =>
    guard(async () => {
      assertNoPatientIdentity(c.name)
      if (c.end < c.start) throw new Error('Tanggal selesai stase sebelum tanggal mulai.')
      await saveChapter(c)
    })
  const add = () => {
    const last = chapters?.[chapters.length - 1]
    const start = last && last.end >= today ? addDays(last.end, 1) : today
    const now = Date.now()
    void save({ id: createId('chp'), name: 'Stase baru', start, end: addDays(start, 41), weight: 'sedang', createdAt: now, updatedAt: now })
  }
  const remove = async (c: Chapter) => {
    const removed = await deleteChapter(c.id)
    if (removed) toast({ message: `Stase "${c.name}" dihapus.`, action: { label: 'Urungkan', onClick: () => void saveChapter(removed) } })
  }

  return (
    <section className="card">
      <h2 className="card-title">Stase</h2>
      <p className="mb-3 text-[13px] text-muted">
        Jam masuk & pulang tiap stase menggantikan slot "Stase" di ritme, termasuk kalimat pembuka Beranda ("Pulang ±16.00"). Kosongkan bila
        sama dengan ritme umum.
      </p>
      <div className="grid gap-3">
        {(chapters ?? []).map((c) => {
          const running = c.start <= today && today <= c.end
          return (
            <div key={c.id} className="rounded-xl border border-line p-3">
              <div className="flex items-center gap-2">
                <input
                  className="field flex-1 font-medium"
                  defaultValue={c.name}
                  aria-label="Nama stase"
                  onBlur={(e) => e.target.value.trim() && e.target.value !== c.name && void save({ ...c, name: e.target.value.trim() })}
                />
                {running && <span className="chip shrink-0 border-transparent bg-surface-2 py-1 text-xs text-ok">berjalan</span>}
                <button type="button" className="btn-ghost p-2" onClick={() => void remove(c)} aria-label={`Hapus stase ${c.name}`}>
                  <Trash2 size={16} aria-hidden="true" />
                </button>
              </div>
              <div className="mt-2 grid grid-cols-2 gap-2 md:grid-cols-5">
                <label className="text-xs text-muted">
                  Mulai
                  <input
                    className="field mt-1"
                    type="date"
                    defaultValue={c.start}
                    onBlur={(e) =>
                      isValidISODate(e.target.value) && e.target.value !== c.start && void save({ ...c, start: e.target.value })
                    }
                  />
                </label>
                <label className="text-xs text-muted">
                  Selesai
                  <input
                    className="field mt-1"
                    type="date"
                    defaultValue={c.end}
                    onBlur={(e) => isValidISODate(e.target.value) && e.target.value !== c.end && void save({ ...c, end: e.target.value })}
                  />
                </label>
                <label className="text-xs text-muted">
                  Masuk
                  <input
                    className="field mt-1"
                    type="time"
                    defaultValue={toInput(c.masuk)}
                    onBlur={(e) => void save({ ...c, masuk: fromInput(e.target.value) ?? undefined })}
                  />
                </label>
                <label className="text-xs text-muted">
                  Pulang
                  <input
                    className="field mt-1"
                    type="time"
                    defaultValue={toInput(c.pulang)}
                    onBlur={(e) => void save({ ...c, pulang: fromInput(e.target.value) ?? undefined })}
                  />
                </label>
                <label className="text-xs text-muted">
                  Bobot
                  <select
                    className="field mt-1"
                    value={c.weight}
                    onChange={(e) => void save({ ...c, weight: e.target.value as Chapter['weight'] })}
                  >
                    <option value="ringan">Ringan</option>
                    <option value="sedang">Sedang</option>
                    <option value="berat">Berat</option>
                  </select>
                </label>
              </div>
            </div>
          )
        })}
        {chapters?.length === 0 && <p className="text-[13px] text-faint">Belum ada stase.</p>}
      </div>
      <button type="button" className="btn-ghost mt-3 border border-line" onClick={add}>
        <Plus size={16} aria-hidden="true" /> Tambah stase
      </button>
    </section>
  )
}

/** Ritme harian per tipe hari: jam, kegiatan, keterangan, peran. */
export function RitmeSettings() {
  const profile = useProfile()
  const roles = useRoles()
  const guard = useGuard()
  const [type, setType] = useState<DayType>('stase')
  if (!profile) return null
  const slots = profile.ritme[type] ?? []
  const isDefault = JSON.stringify(slots) === JSON.stringify(DEFAULT_RITME[type])
  const save = (next: RitmeSlot[]) =>
    guard(async () => {
      assertNoPatientIdentity(...next.flatMap((s) => [s.title, s.note ?? '']))
      await saveRitme(
        type,
        [...next].sort((a, b) => slotOrder(a.time) - slotOrder(b.time)),
      )
    })
  const update = (i: number, changes: Partial<RitmeSlot>) => {
    const next = slots.map((s, j) => (j === i ? { ...s, ...changes } : s))
    // Hapus kunci kosong supaya data tetap rapi.
    for (const s of next) for (const k of ['until', 'note', 'roleId'] as const) if (!s[k]) delete s[k]
    void save(next)
  }

  return (
    <section className="card">
      <h2 className="card-title">Ritme harian</h2>
      <p className="mb-3 text-[13px] text-muted">
        Jadwal yang tampil di "Ritme hari ini". Satu template per tipe hari; slot bertanda "kerja" mengikuti jam stase yang sedang berjalan.
      </p>
      <div role="tablist" aria-label="Tipe hari" className="mb-3 flex gap-1 overflow-x-auto rounded-full bg-surface-2 p-[3px]">
        {DAY_TYPES.map((t) => (
          <button
            key={t}
            type="button"
            role="tab"
            aria-selected={type === t}
            onClick={() => setType(t)}
            className={`flex-1 rounded-full px-3 py-1.5 text-[13px] whitespace-nowrap ${type === t ? 'bg-surface text-text shadow-sm' : 'text-muted'}`}
          >
            {DAY_TYPE_LABELS[t]}
          </button>
        ))}
      </div>
      <ul key={type} className="grid gap-2">
        {slots.map((s, i) => (
          <li key={`${i}-${s.time}-${s.title}`} className="rounded-xl border border-line p-2.5">
            <div className="flex flex-wrap items-center gap-2">
              <input
                className="field w-[104px] py-1.5"
                type="time"
                defaultValue={toInput(s.time)}
                aria-label="Jam mulai"
                onBlur={(e) => {
                  const t = fromInput(e.target.value)
                  if (t && t !== s.time) update(i, { time: t })
                }}
              />
              <span className="text-faint">–</span>
              <input
                className="field w-[104px] py-1.5"
                type="time"
                defaultValue={toInput(s.until)}
                aria-label="Jam selesai (opsional)"
                onBlur={(e) => {
                  const t = fromInput(e.target.value) ?? undefined
                  if (t !== s.until) update(i, { until: t })
                }}
              />
              <input
                className="field min-w-[140px] flex-1 py-1.5"
                defaultValue={s.title}
                aria-label="Kegiatan"
                onBlur={(e) => e.target.value.trim() && e.target.value !== s.title && update(i, { title: e.target.value.trim() })}
              />
              <button
                type="button"
                className="btn-ghost p-2"
                onClick={() => void save(slots.filter((_, j) => j !== i))}
                aria-label={`Hapus ${s.title}`}
              >
                <Trash2 size={15} aria-hidden="true" />
              </button>
            </div>
            <div className="mt-2 flex flex-wrap items-center gap-2">
              <input
                className="field min-w-[160px] flex-1 py-1.5 text-[13px]"
                defaultValue={s.note ?? ''}
                placeholder="Keterangan, mis. 60 mnt, naikkan pengali"
                aria-label="Keterangan"
                onBlur={(e) => e.target.value !== (s.note ?? '') && update(i, { note: e.target.value.trim() || undefined })}
              />
              <select
                className="field w-auto py-1.5 text-[13px]"
                value={s.roleId ?? ''}
                onChange={(e) => update(i, { roleId: e.target.value || undefined })}
                aria-label="Peran"
              >
                <option value="">Ibadah / tanpa peran</option>
                {(roles ?? [])
                  .filter((r) => !r.archived || r.id === s.roleId)
                  .map((r) => (
                    <option key={r.id} value={r.id}>
                      {r.name}
                    </option>
                  ))}
              </select>
              <label className="flex items-center gap-1.5 text-xs text-muted">
                <input
                  type="checkbox"
                  checked={!!s.work}
                  onChange={(e) => update(i, { work: e.target.checked || undefined })}
                  className="size-4 accent-current"
                />
                kerja
              </label>
            </div>
          </li>
        ))}
      </ul>
      <div className="mt-3 flex flex-wrap gap-2">
        <button
          type="button"
          className="btn-ghost border border-line"
          onClick={() => void save([...slots, { time: '12.00', title: 'Kegiatan baru' }])}
        >
          <Plus size={16} aria-hidden="true" /> Tambah slot
        </button>
        {!isDefault && (
          <button type="button" className="btn-ghost" onClick={() => void guard(() => saveRitme(type, null))}>
            <RotateCcw size={15} aria-hidden="true" /> Kembalikan bawaan
          </button>
        )}
      </div>
    </section>
  )
}
