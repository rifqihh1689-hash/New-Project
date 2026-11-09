import { useLiveQuery } from 'dexie-react-hooks'
import { Plus } from 'lucide-react'
import { useState } from 'react'
import { useToday } from '../../app/useToday'
import { Limited } from '../../components/Limited'
import { PageTop } from '../../components/PageTop'
import { RoleTag } from '../../components/RoleTag'
import { Sheet } from '../../components/Sheet'
import { useToast } from '../../components/toast-context'
import { db } from '../../db/db'
import { deleteDoc, deleteQuest, restoreDoc, restoreQuest, saveDoc, saveQuest, seedDocs, setDocStatus, setQuestStatus } from '../../db/ppds'
import { roleLookup, useRoles } from '../../db/structure'
import {
  activeQuests,
  canActivate,
  DOC_GROUPS,
  docStats,
  dueLabel,
  MAX_ACTIVE_QUESTS,
  nextDeadline,
  STATUS_LABELS,
  STATUS_ORDER,
} from '../../domain/ppds'
import { formatDateShort } from '../../domain/time'
import type { DocStatus, MainQuest, PpdsDoc, Role } from '../../types'

const STATUS_STYLE: Record<DocStatus, string> = {
  belum: 'text-muted border-line',
  proses: 'text-uang border-uang/50',
  siap: 'text-ok border-ok/50',
}

// ---------- Main Quest ----------

interface QuestDraft {
  id?: string
  name: string
  roleId: string
  next: string
  progress: number
}

function QuestForm({ draft, roles, onClose }: { draft: QuestDraft; roles: Role[]; onClose: () => void }) {
  const toast = useToast()
  const [d, setD] = useState(draft)
  const save = async () => {
    try {
      await saveQuest(d)
      onClose()
    } catch (e) {
      toast({ message: (e as Error).message, tone: 'error' })
    }
  }
  return (
    <div className="grid gap-3">
      <input
        className="field"
        value={d.name}
        autoFocus
        maxLength={80}
        onChange={(e) => setD({ ...d, name: e.target.value })}
        placeholder="mis. Lulus UKMPPD pertama kali"
        aria-label="Nama Main Quest"
      />
      <select className="field" value={d.roleId} onChange={(e) => setD({ ...d, roleId: e.target.value })} aria-label="Peran">
        {roles
          .filter((r) => !r.archived)
          .map((r) => (
            <option key={r.id} value={r.id}>
              {r.name}
            </option>
          ))}
      </select>
      <input
        className="field"
        value={d.next}
        maxLength={120}
        onChange={(e) => setD({ ...d, next: e.target.value })}
        placeholder="Langkah berikutnya (satu hal kecil yang konkret)"
        aria-label="Langkah berikutnya"
      />
      <label className="text-xs text-muted">
        Progres {Math.round(d.progress * 100)}%
        <input
          type="range"
          min={0}
          max={100}
          step={5}
          value={Math.round(d.progress * 100)}
          onChange={(e) => setD({ ...d, progress: Number(e.target.value) / 100 })}
          className="mt-1 w-full"
        />
      </label>
      <button type="button" className="btn-primary py-3" disabled={!d.name.trim()} onClick={() => void save()}>
        Simpan
      </button>
    </div>
  )
}

function Quests({ quests, roles }: { quests: MainQuest[]; roles: Role[] }) {
  const toast = useToast()
  const role = roleLookup(roles)
  const [editing, setEditing] = useState<QuestDraft | null>(null)
  const active = activeQuests(quests)
  const rest = quests.filter((q) => q.status !== 'aktif').sort((a, b) => b.updatedAt - a.updatedAt)
  const change = async (q: MainQuest, status: MainQuest['status'], message: string) => {
    try {
      const prev = await setQuestStatus(q.id, status)
      if (prev) toast({ message, action: { label: 'Urungkan', onClick: () => void restoreQuest(prev) } })
    } catch (e) {
      toast({ message: (e as Error).message, tone: 'error' })
    }
  }
  const remove = async (id: string) => {
    const row = await deleteQuest(id)
    setEditing(null)
    if (row) toast({ message: 'Dihapus.', action: { label: 'Urungkan', onClick: () => void restoreQuest(row) } })
  }
  return (
    <section className="card">
      <h2 className="card-title">
        Main Quest{' '}
        <span className="text-[13px] font-medium text-faint">
          {active.length}/{MAX_ACTIVE_QUESTS} aktif
        </span>
        <button
          type="button"
          className="btn-primary -my-1 ml-auto py-1.5"
          disabled={!canActivate(quests)}
          onClick={() => setEditing({ name: '', roleId: '#role:orto', next: '', progress: 0 })}
        >
          <Plus size={15} aria-hidden="true" /> Quest
        </button>
      </h2>
      {!active.length && (
        <p className="text-[13px] text-muted">
          Belum ada Main Quest aktif. Pilih 1–3 tujuan besar (mis. lulus UKMPPD, laporan kasus pertama). Batas 3 supaya fokus tidak pecah.
        </p>
      )}
      <ul className="grid gap-3">
        {active.map((q) => (
          <li key={q.id} className="text-[13.5px]">
            <div className="flex items-start gap-2">
              <button
                type="button"
                className="flex-1 text-left font-medium"
                onClick={() => setEditing({ id: q.id, name: q.name, roleId: q.roleId, next: q.next, progress: q.progress })}
              >
                {q.name}
              </button>
              <RoleTag role={role(q.roleId)} compact />
            </div>
            {q.next && <div className="text-xs text-muted">Langkah berikut: {q.next}</div>}
            <div className="mt-1.5 flex items-center gap-2">
              <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-track" aria-hidden="true">
                <div
                  className="h-full rounded-full"
                  style={{ width: `${Math.round(q.progress * 100)}%`, background: role(q.roleId).color }}
                />
              </div>
              <span className="w-9 text-right text-xs text-muted tabular-nums">{Math.round(q.progress * 100)}%</span>
            </div>
            <div className="mt-1.5 flex gap-1.5">
              <button
                type="button"
                className="btn-ghost border border-line px-2 py-1 text-xs"
                onClick={() => void change(q, 'selesai', 'Quest selesai.')}
              >
                Selesai
              </button>
              <button
                type="button"
                className="btn-ghost border border-line px-2 py-1 text-xs"
                onClick={() => void change(q, 'beku', 'Quest dibekukan.')}
              >
                Bekukan
              </button>
            </div>
          </li>
        ))}
      </ul>
      {rest.length > 0 && (
        <details className="mt-3 border-t border-line pt-3">
          <summary className="cursor-pointer text-[13px] text-muted">Beku & selesai ({rest.length})</summary>
          <ul className="mt-2 text-[13px]">
            {rest.map((q) => (
              <li key={q.id} className="flex items-center gap-2 border-t border-line py-1.5 first:border-t-0">
                <span className="flex-1">
                  {q.name} <span className="text-xs text-faint">{q.status}</span>
                </span>
                {q.status === 'beku' && (
                  <button
                    type="button"
                    className="btn-ghost px-2 py-1 text-xs"
                    onClick={() => void change(q, 'aktif', 'Quest diaktifkan lagi.')}
                  >
                    Aktifkan
                  </button>
                )}
                <button type="button" className="btn-ghost px-2 py-1 text-xs text-faint" onClick={() => void remove(q.id)}>
                  Hapus
                </button>
              </li>
            ))}
          </ul>
        </details>
      )}
      <Sheet open={!!editing} title={editing?.id ? 'Ubah Main Quest' : 'Main Quest baru'} onClose={() => setEditing(null)}>
        {editing && <QuestForm key={editing.id ?? 'baru'} draft={editing} roles={roles} onClose={() => setEditing(null)} />}
      </Sheet>
    </section>
  )
}

// ---------- Berkas PPDS ----------

interface DocDraft {
  id?: string
  name: string
  group: PpdsDoc['group']
  status: DocStatus
  due: string
  note: string
}

function DocForm({ draft, onClose }: { draft: DocDraft; onClose: () => void }) {
  const toast = useToast()
  const [d, setD] = useState(draft)
  const save = async () => {
    try {
      await saveDoc({ ...d, due: d.due || null })
      onClose()
    } catch (e) {
      toast({ message: (e as Error).message, tone: 'error' })
    }
  }
  const remove = async () => {
    if (!d.id) return
    const row = await deleteDoc(d.id)
    onClose()
    if (row) toast({ message: 'Dihapus.', action: { label: 'Urungkan', onClick: () => void restoreDoc(row) } })
  }
  return (
    <div className="grid gap-3">
      <input
        className="field"
        value={d.name}
        autoFocus
        maxLength={100}
        onChange={(e) => setD({ ...d, name: e.target.value })}
        placeholder="Nama butir"
        aria-label="Nama butir"
      />
      <div className="grid grid-cols-2 gap-2">
        <select
          className="field"
          value={d.group}
          onChange={(e) => setD({ ...d, group: e.target.value as PpdsDoc['group'] })}
          aria-label="Kelompok"
        >
          {Object.entries(DOC_GROUPS).map(([k, v]) => (
            <option key={k} value={k}>
              {v}
            </option>
          ))}
        </select>
        <select
          className="field"
          value={d.status}
          onChange={(e) => setD({ ...d, status: e.target.value as DocStatus })}
          aria-label="Status"
        >
          {STATUS_ORDER.map((s) => (
            <option key={s} value={s}>
              {STATUS_LABELS[s]}
            </option>
          ))}
        </select>
      </div>
      <label className="text-xs text-muted">
        Tenggat (opsional)
        <input type="date" className="field mt-1" value={d.due} onChange={(e) => setD({ ...d, due: e.target.value })} />
      </label>
      <input
        className="field"
        value={d.note}
        maxLength={160}
        onChange={(e) => setD({ ...d, note: e.target.value })}
        placeholder="Catatan (tanpa identitas pasien)"
        aria-label="Catatan"
      />
      <div className="flex gap-2">
        {d.id && (
          <button type="button" className="btn-ghost border border-line" onClick={() => void remove()}>
            Hapus
          </button>
        )}
        <button type="button" className="btn-primary flex-1 py-3" disabled={!d.name.trim()} onClick={() => void save()}>
          Simpan
        </button>
      </div>
    </div>
  )
}

function Docs({ docs, today }: { docs: PpdsDoc[]; today: string }) {
  const toast = useToast()
  const [editing, setEditing] = useState<DocDraft | null>(null)
  const stats = docStats(docs, today)
  const next = nextDeadline(docs)
  const cycle = async (d: PpdsDoc) => {
    const to = STATUS_ORDER[(STATUS_ORDER.indexOf(d.status) + 1) % STATUS_ORDER.length]
    const prev = await setDocStatus(d.id, to)
    if (prev)
      toast({
        message: `${d.name}: ${STATUS_LABELS[to]}.`,
        duration: 3000,
        action: { label: 'Urungkan', onClick: () => void restoreDoc(prev) },
      })
  }
  const groups = (Object.keys(DOC_GROUPS) as PpdsDoc['group'][]).map((g) => ({
    g,
    list: docs
      .filter((d) => d.group === g)
      .sort((a, b) => (a.due ?? '9').localeCompare(b.due ?? '9') || a.name.localeCompare(b.name, 'id')),
  }))
  return (
    <section className="card">
      <h2 className="card-title">
        Persiapan PPDS
        <button
          type="button"
          className="btn-primary -my-1 ml-auto py-1.5"
          onClick={() => setEditing({ name: '', group: 'berkas', status: 'belum', due: '', note: '' })}
        >
          <Plus size={15} aria-hidden="true" /> Butir
        </button>
      </h2>
      {!docs.length ? (
        <div className="text-[13px] text-muted">
          <p>
            Belum ada daftar. Mulai dari contoh umum (STR, ijazah, sertifikat, laporan kasus, TOEFL/IELTS), lalu sesuaikan dengan pedoman
            penerimaan program yang kamu tuju.
          </p>
          <button
            type="button"
            className="btn-ghost mt-2 border border-line"
            onClick={() => void seedDocs().then((n) => toast({ message: `${n} butir contoh ditambahkan.` }))}
          >
            Isi daftar contoh
          </button>
        </div>
      ) : (
        <>
          <div className="text-[22px] font-semibold tabular-nums">
            {stats.ready} <span className="text-[13px] font-normal text-faint">/ {stats.total} siap</span>
          </div>
          <div className="my-2 h-1.5 overflow-hidden rounded-full bg-track" aria-hidden="true">
            <div className="h-full rounded-full bg-orto" style={{ width: `${stats.ratio * 100}%` }} />
          </div>
          <p className={`text-xs ${stats.overdue ? 'text-danger' : 'text-muted'}`}>
            {stats.overdue
              ? `${stats.overdue} butir lewat tenggat.`
              : next
                ? `Tenggat terdekat: ${next.name}, ${dueLabel(next.due!, today)} (${formatDateShort(next.due!)}).`
                : 'Belum ada tenggat. Beri tanggal pada butir yang paling jauh dari siap.'}
          </p>
          {groups
            .filter((x) => x.list.length)
            .map(({ g, list }) => (
              <div key={g} className="mt-3">
                <h3 className="text-xs font-semibold tracking-wide text-faint uppercase">{DOC_GROUPS[g]}</h3>
                <Limited items={list} limit={8}>
                  {(shown) => (
                    <ul>
                      {shown.map((d) => (
                        <li key={d.id} className="flex items-center gap-2 border-t border-line py-2 first:border-t-0">
                          <button
                            type="button"
                            className={`shrink-0 rounded-full border px-2.5 py-0.5 text-[11.5px] ${STATUS_STYLE[d.status]}`}
                            aria-label={`Status ${d.name}: ${STATUS_LABELS[d.status]}. Ketuk untuk mengganti.`}
                            onClick={() => void cycle(d)}
                          >
                            {STATUS_LABELS[d.status]}
                          </button>
                          <button
                            type="button"
                            className="min-w-0 flex-1 text-left text-[13.5px]"
                            onClick={() =>
                              setEditing({ id: d.id, name: d.name, group: d.group, status: d.status, due: d.due ?? '', note: d.note ?? '' })
                            }
                          >
                            <span className={d.status === 'siap' ? 'text-muted line-through' : ''}>{d.name}</span>
                            {(d.due || d.note) && (
                              <span
                                className={`block text-xs ${d.due && d.status !== 'siap' && d.due < today ? 'text-danger' : 'text-muted'}`}
                              >
                                {d.due ? dueLabel(d.due, today) : ''}
                                {d.due && d.note ? ' · ' : ''}
                                {d.note}
                              </span>
                            )}
                          </button>
                        </li>
                      ))}
                    </ul>
                  )}
                </Limited>
              </div>
            ))}
        </>
      )}
      <Sheet open={!!editing} title={editing?.id ? 'Ubah butir' : 'Butir baru'} onClose={() => setEditing(null)}>
        {editing && <DocForm key={editing.id ?? 'baru'} draft={editing} onClose={() => setEditing(null)} />}
      </Sheet>
    </section>
  )
}

export function TargetPage() {
  const today = useToday()
  const roles = useRoles()
  const quests = useLiveQuery(() => db.mainQuests.toArray(), [])
  const docs = useLiveQuery(() => db.ppdsDocs.toArray(), [])
  return (
    <>
      <PageTop title="Target & PPDS" />
      <h1 className="mt-4 text-[26px] font-semibold tracking-tight md:hidden">Target & PPDS</h1>
      {quests && docs && roles && (
        <div className="stagger mt-3 grid items-start gap-3 md:mt-[26px] lg:grid-cols-2">
          <Quests quests={quests} roles={roles} />
          <Docs docs={docs} today={today} />
        </div>
      )}
    </>
  )
}
