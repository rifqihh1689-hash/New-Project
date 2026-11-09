import { useLiveQuery } from 'dexie-react-hooks'
import { useState } from 'react'
import { Plus } from 'lucide-react'
import { useToday } from '../../app/useToday'
import { Limited } from '../../components/Limited'
import { Sheet } from '../../components/Sheet'
import { useToast } from '../../components/toast-context'
import { deleteCard, gradeCard, restoreCard, saveCard } from '../../db/cards'
import { db } from '../../db/db'
import { cardStats, dueQueue, GRADES, intervalLabel, schedule, type Grade } from '../../domain/srs'
import { STUDY_SYSTEMS } from '../../domain/study'
import { formatDateShort } from '../../domain/time'
import type { Flashcard } from '../../types'

const SESSION = 20

function Review({ queue, today, onDone }: { queue: Flashcard[]; today: string; onDone: () => void }) {
  const toast = useToast()
  const [i, setI] = useState(0)
  const [shown, setShown] = useState(false)
  const [done, setDone] = useState(0)
  const card = queue[i]
  if (!card)
    return (
      <section className="card text-center">
        <h2 className="font-serif text-[22px]">Selesai</h2>
        <p className="mt-1 text-[13px] text-muted">{done} kartu diulas. Kartu berikutnya muncul sesuai jadwal.</p>
        <button type="button" className="btn-primary mt-4" onClick={onDone}>
          Kembali
        </button>
      </section>
    )
  const grade = async (g: Grade) => {
    const prev = await gradeCard(card.id, g, today)
    setDone((n) => n + 1)
    setShown(false)
    setI((n) => n + 1)
    if (prev) toast({ message: 'Tersimpan.', duration: 3000, action: { label: 'Urungkan', onClick: () => void restoreCard(prev) } })
  }
  return (
    <section className="card">
      <div className="mb-2 flex items-center justify-between text-xs text-muted">
        <span>
          Kartu {i + 1} dari {queue.length}
          {card.system ? ` · ${card.system}` : ''}
        </span>
        <button type="button" className="underline-offset-2 hover:underline" onClick={onDone}>
          Berhenti
        </button>
      </div>
      <div className="min-h-[120px] rounded-2xl border border-line bg-surface-2 p-4 text-[16px] leading-relaxed whitespace-pre-line">
        {card.front}
      </div>
      {shown ? (
        <>
          <div className="mt-2 min-h-[80px] rounded-2xl border border-line p-4 text-[15px] leading-relaxed whitespace-pre-line text-muted">
            {card.back}
          </div>
          <div className="mt-3 grid grid-cols-4 gap-1.5">
            {GRADES.map(({ grade: g, label }) => (
              <button key={g} type="button" className="btn-ghost flex-col border border-line py-2" onClick={() => void grade(g)}>
                <span className="text-[13.5px] font-medium">{label}</span>
                <span className="text-[11px] text-faint">{intervalLabel(schedule(card, g).interval)}</span>
              </button>
            ))}
          </div>
        </>
      ) : (
        <button type="button" className="btn-primary mt-3 w-full py-3" onClick={() => setShown(true)}>
          Tampilkan jawaban
        </button>
      )}
    </section>
  )
}

interface Draft {
  id?: string
  front: string
  back: string
  system: string
}

function CardForm({ draft, today, onClose }: { draft: Draft; today: string; onClose: () => void }) {
  const toast = useToast()
  const [d, setD] = useState(draft)
  const save = async (again: boolean) => {
    try {
      await saveCard({ id: d.id, front: d.front, back: d.back, system: d.system }, today)
      if (again) setD({ ...d, id: undefined, front: '', back: '' })
      else onClose()
    } catch (e) {
      toast({ message: (e as Error).message, tone: 'error' })
    }
  }
  const remove = async () => {
    if (!d.id) return
    const row = await deleteCard(d.id)
    onClose()
    if (row) toast({ message: 'Kartu dihapus.', action: { label: 'Urungkan', onClick: () => void restoreCard(row) } })
  }
  const ok = !!d.front.trim() && !!d.back.trim()
  return (
    <div className="grid gap-3">
      <textarea
        className="field min-h-[90px] resize-y"
        value={d.front}
        autoFocus
        maxLength={600}
        onChange={(e) => setD({ ...d, front: e.target.value })}
        placeholder="Depan: pertanyaan atau konsep. Tanpa identitas pasien."
        aria-label="Sisi depan"
      />
      <textarea
        className="field min-h-[90px] resize-y"
        value={d.back}
        maxLength={1200}
        onChange={(e) => setD({ ...d, back: e.target.value })}
        placeholder="Belakang: jawaban dan alasannya."
        aria-label="Sisi belakang"
      />
      <select className="field" value={d.system} onChange={(e) => setD({ ...d, system: e.target.value })} aria-label="Sistem">
        <option value="">Tanpa sistem</option>
        {STUDY_SYSTEMS.map((s) => (
          <option key={s}>{s}</option>
        ))}
      </select>
      <div className="flex flex-wrap gap-2">
        {d.id && (
          <button type="button" className="btn-ghost border border-line" onClick={() => void remove()}>
            Hapus
          </button>
        )}
        {!d.id && (
          <button type="button" className="btn-ghost border border-line" disabled={!ok} onClick={() => void save(true)}>
            Simpan & tambah lagi
          </button>
        )}
        <button type="button" className="btn-primary flex-1 py-3" disabled={!ok} onClick={() => void save(false)}>
          Simpan
        </button>
      </div>
    </div>
  )
}

export function CardsTab() {
  const today = useToday()
  const cards = useLiveQuery(() => db.flashcards.toArray(), [])
  const [queue, setQueue] = useState<Flashcard[] | null>(null)
  const [editing, setEditing] = useState<Draft | null>(null)
  if (!cards) return null
  const stats = cardStats(cards, today)
  const sorted = [...cards].sort((a, b) => a.due.localeCompare(b.due) || a.front.localeCompare(b.front))
  const blank: Draft = { front: '', back: '', system: '' }
  return (
    <>
      {queue ? (
        <div className="mt-3">
          <Review queue={queue} today={today} onDone={() => setQueue(null)} />
        </div>
      ) : (
        <>
          <section className="card mt-3">
            <div className="flex items-end justify-between gap-3">
              <div>
                <div className="text-xs text-muted">Jatuh tempo hari ini</div>
                <div className="text-[28px] font-semibold tabular-nums">{stats.due}</div>
                <p className="text-xs text-muted">
                  {stats.total} kartu · {stats.fresh} baru · {stats.mature} sudah mapan (≥ 21 hari)
                </p>
              </div>
              <button type="button" className="btn-primary" disabled={!stats.due} onClick={() => setQueue(dueQueue(cards, today, SESSION))}>
                {stats.due ? `Mulai ulas${stats.due > SESSION ? ` ${SESSION}` : ''}` : 'Tidak ada'}
              </button>
            </div>
            {stats.due > SESSION && (
              <p className="mt-2 text-xs text-faint">Sesi dibatasi {SESSION} kartu supaya ringan; sisanya bisa lanjut setelahnya.</p>
            )}
          </section>
          <section className="card mt-3">
            <h2 className="card-title">
              Semua kartu <span className="text-[13px] font-medium text-faint">{cards.length}</span>
              <button type="button" className="btn-primary -my-1 ml-auto py-1.5" onClick={() => setEditing(blank)}>
                <Plus size={15} aria-hidden="true" /> Kartu
              </button>
            </h2>
            {!cards.length && (
              <p className="text-[13px] text-muted">
                Belum ada kartu. Tulis sendiri, atau centang "buat kartu" saat mencatat soal yang salah di tab Soal: kesalahan jadi bahan
                ulasan.
              </p>
            )}
            <Limited items={sorted}>
              {(list) => (
                <ul>
                  {list.map((c) => (
                    <li key={c.id}>
                      <button
                        type="button"
                        onClick={() => setEditing({ id: c.id, front: c.front, back: c.back, system: c.system ?? '' })}
                        className="flex w-full items-start gap-2 border-t border-line py-2 text-left text-[13.5px] first:border-t-0"
                      >
                        <span className="min-w-0 flex-1">
                          <span className="line-clamp-2">{c.front}</span>
                          <span className="block text-xs text-muted">
                            {c.system ? `${c.system} · ` : ''}
                            {c.source === 'salah' ? 'dari soal salah · ' : ''}
                            {c.due <= today ? 'jatuh tempo' : `ulas ${formatDateShort(c.due)}`}
                          </span>
                        </span>
                        {c.lapses > 0 && <span className="shrink-0 text-xs text-danger">{c.lapses}× lupa</span>}
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </Limited>
          </section>
        </>
      )}
      <Sheet open={!!editing} title={editing?.id ? 'Ubah kartu' : 'Kartu baru'} onClose={() => setEditing(null)}>
        {editing && <CardForm key={editing.id ?? 'baru'} draft={editing} today={today} onClose={() => setEditing(null)} />}
      </Sheet>
    </>
  )
}
