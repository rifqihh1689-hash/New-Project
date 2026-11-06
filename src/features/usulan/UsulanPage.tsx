import { Inbox } from 'lucide-react'
import { useLiveQuery } from 'dexie-react-hooks'
import { useState } from 'react'
import { routeHref } from '../../app/router'
import { useToday } from '../../app/useToday'
import { PageTop } from '../../components/PageTop'
import { useToast } from '../../components/toast-context'
import { useMoneyRefs, type MoneyRefs } from '../../db/money'
import { approveProposal, loadProposals, previewProposal, rejectProposal, reopenProposal } from '../../db/proposals'
import { roleLookup, useRoles } from '../../db/structure'
import { DAY_TYPE_LABELS } from '../../domain/dayType'
import { describeItem, itemLabel } from '../../domain/importer'
import { categoryLookup } from '../../domain/money'
import type { Proposal, Role } from '../../types'

const when = (ms: number) =>
  new Date(ms).toLocaleString('id-ID', { timeZone: 'Asia/Jakarta', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })

function Pending({ p, roles, money, today }: { p: Proposal; roles: Role[]; money: MoneyRefs; today: string }) {
  const toast = useToast()
  const role = roleLookup(roles)
  const cat = categoryLookup(money.categories)
  const rows = previewProposal(p, roles, today, money)
  const [skipped, setSkipped] = useState<Set<number>>(new Set())
  const usable = rows.map((r, i) => ({ r, i })).filter(({ r }) => r.item && !r.phi)
  const chosen = usable.filter(({ i }) => !skipped.has(i))
  const approve = async () => {
    try {
      const result = await approveProposal(p.id, today, new Set(chosen.map(({ i }) => i)))
      toast({ message: result, duration: 6000 })
    } catch (e) {
      toast({ message: (e as Error).message, tone: 'error' })
    }
  }
  const reject = async () => {
    await rejectProposal(p.id)
    toast({ message: 'Usulan ditolak.', action: { label: 'Urungkan', onClick: () => void reopenProposal(p.id) } })
  }
  return (
    <section className="card">
      <h2 className="card-title flex-wrap">
        <span className="flex-1">{p.summary || 'Usulan dari Claude'}</span>
        <span className="text-xs font-normal text-faint">{when(p.createdAt)}</span>
      </h2>
      <ul className="grid gap-1">
        {rows.map((r, i) => (
          <li key={i}>
            {r.item && !r.phi ? (
              <label className="flex items-start gap-2.5 rounded-lg px-1 py-1 text-[13.5px] hover:bg-surface-2">
                <input
                  type="checkbox"
                  className="mt-0.5 size-4 accent-current"
                  checked={!skipped.has(i)}
                  onChange={() =>
                    setSkipped((s) => {
                      const next = new Set(s)
                      if (next.has(i)) next.delete(i)
                      else next.add(i)
                      return next
                    })
                  }
                />
                <span className="flex-1">
                  <span className="text-muted">{itemLabel(r.item)} · </span>
                  {r.item.kind === 'ritme' && <span className="text-muted">{DAY_TYPE_LABELS[r.item.dayType]} · </span>}
                  {describeItem(
                    r.item,
                    (id) => role(id).name,
                    (id) => cat(id).name,
                  )}
                  {r.item.kind === 'habit' && r.item.note && <span className="block text-xs text-muted">{r.item.note}</span>}
                </span>
              </label>
            ) : (
              <p className="px-1 py-1 text-[13px] text-danger">
                Item {r.line}: {r.phi ? `mirip identitas pasien (${r.phi}), tidak akan ditulis.` : r.error}
              </p>
            )}
          </li>
        ))}
      </ul>
      <div className="mt-3 flex gap-2">
        <button type="button" className="btn-ghost border border-line" onClick={() => void reject()}>
          Tolak
        </button>
        <button type="button" className="btn-primary flex-1" disabled={!chosen.length} onClick={() => void approve()}>
          Setujui {chosen.length} item
        </button>
      </div>
    </section>
  )
}

export function UsulanPage() {
  const today = useToday()
  const roles = useRoles()
  const money = useMoneyRefs()
  const list = useLiveQuery(loadProposals)
  const pending = list?.filter((p) => p.status === 'menunggu') ?? []
  const decided = list?.filter((p) => p.status !== 'menunggu') ?? []
  return (
    <>
      <PageTop title="Usulan" />
      <h1 className="mt-4 text-[26px] font-semibold tracking-tight md:hidden">Usulan</h1>
      <p className="mt-2 max-w-[640px] text-[13px] text-muted md:mt-3">
        Semua yang ditulis Claude lewat connector masuk ke sini dulu. Pilih item yang mau dipakai, lalu setujui. Tidak ada usulan yang
        menghapus data, dan item yang mirip identitas pasien tidak pernah ditulis.
      </p>
      {list && roles && money && (
        <div className="stagger mt-3 grid items-start gap-3 lg:grid-cols-2">
          {pending.map((p) => (
            <Pending key={p.id} p={p} roles={roles} money={money} today={today} />
          ))}
          {!pending.length && (
            <section className="card">
              <h2 className="card-title">
                <Inbox size={17} aria-hidden="true" /> Belum ada usulan
              </h2>
              <p className="text-[13px] text-muted">
                Minta Claude (dengan connector Qawwam) mis. “susun tugas belajar UKMPPD minggu ini dari jadwal jagaku” atau “buat menu
                minggu depan Rp350 rb”. Tanpa connector, minta JSON lewat{' '}
                <a href={routeHref('impor')} className="underline underline-offset-2">
                  Impor
                </a>
                .
              </p>
            </section>
          )}
          {decided.length > 0 && (
            <section className="card">
              <h2 className="card-title">Riwayat</h2>
              <ul>
                {decided.slice(0, 20).map((p) => (
                  <li key={p.id} className="border-t border-line py-2 text-[13.5px] first:border-t-0">
                    <div className="flex gap-2">
                      <span className="flex-1">{p.summary || 'Usulan dari Claude'}</span>
                      <span className={`text-xs ${p.status === 'disetujui' ? 'text-ok' : 'text-faint'}`}>{p.status}</span>
                    </div>
                    <div className="text-xs text-muted">
                      {p.decidedAt ? when(p.decidedAt) : ''}
                      {p.result ? ` · ${p.result}` : ''}
                    </div>
                  </li>
                ))}
              </ul>
            </section>
          )}
        </div>
      )}
    </>
  )
}
