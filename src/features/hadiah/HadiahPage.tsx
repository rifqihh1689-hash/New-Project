import { Gift, Lock, Plus } from 'lucide-react'
import { useState } from 'react'
import { useToday } from '../../app/useToday'
import { PageTop } from '../../components/PageTop'
import { Sheet } from '../../components/Sheet'
import { useToast } from '../../components/toast-context'
import { claimReward, newReward, saveReward, undoClaim } from '../../db/rewards'
import { detectPatientIdentity } from '../../domain/phi'
import { claimBlock, REWARD_IDEAS } from '../../domain/rewards'
import { formatDateShort } from '../../domain/time'
import { formatNumber, formatRupiah } from '../../lib/format'
import type { Reward } from '../../types'
import { useHadiah, type HadiahData } from './data'

const costText = (cost: number) => (cost > 0 ? formatRupiah(cost) : 'Gratis')

function Summary({ data }: { data: HadiahData }) {
  const { level, tokens, bridge } = data
  const pct = Math.round((level.into / level.need) * 100)
  return (
    <section className="mt-3 grid gap-3 sm:grid-cols-2">
      <div className="card">
        <div className="text-xs text-muted">Token hadiah</div>
        <div className="mt-1 flex items-baseline gap-2">
          <span className={`text-[26px] font-semibold tabular-nums ${tokens ? 'text-ok' : ''}`}>{tokens}</span>
          <span className="text-[13px] text-muted">
            Level {level.level} · {formatNumber(level.into)}/{formatNumber(level.need)} XP ke level {level.level + 1}
          </span>
        </div>
        <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-track" aria-hidden="true">
          <div className="h-full rounded-full bg-tentir" style={{ width: `${pct}%` }} />
        </div>
        <p className="mt-2 text-xs text-muted">1 token tiap naik level. Sudah diklaim {data.claims.length}.</p>
      </div>
      <div className="card">
        <div className="text-xs text-muted">Dana jembatan</div>
        {bridge.target == null ? (
          <p className="mt-1 text-[13px] text-muted">
            Belum ada target dana jembatan, jadi hadiah berbiaya tidak dikunci. Target bisa diimpor dari MBAPPE OS atau diisi di modul Uang
            (Fase 2).
          </p>
        ) : (
          <>
            <div className="mt-1 text-[22px] font-semibold tabular-nums">
              {formatRupiah(bridge.saved)}
              <span className="text-[13px] font-normal text-faint"> / {formatRupiah(bridge.target)}</span>
            </div>
            <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-track" aria-hidden="true">
              <div className="h-full rounded-full bg-uang" style={{ width: `${Math.min(100, (bridge.saved / bridge.target) * 100)}%` }} />
            </div>
            <p className={`mt-2 text-xs ${bridge.reached ? 'text-ok' : 'text-muted'}`}>
              {bridge.reached
                ? 'Tercapai: hadiah berbiaya terbuka.'
                : 'Hadiah berbiaya terkunci sampai target tercapai. Yang gratis tetap bisa.'}
            </p>
          </>
        )}
      </div>
    </section>
  )
}

function RewardEditor({ reward, onClose }: { reward: Reward | null; onClose: () => void }) {
  return (
    <Sheet open={!!reward} title={reward?.name ? 'Ubah hadiah' : 'Hadiah baru'} onClose={onClose}>
      {reward && <EditorBody key={reward.id} initial={reward} onClose={onClose} />}
    </Sheet>
  )
}

function EditorBody({ initial, onClose }: { initial: Reward; onClose: () => void }) {
  const toast = useToast()
  const [r, setR] = useState(initial)
  const phi = r.name.trim() ? detectPatientIdentity(r.name) : null
  const save = async (archived = r.archived) => {
    try {
      await saveReward({ ...r, archived })
      onClose()
    } catch (e) {
      toast({ message: (e as Error).message, tone: 'error' })
    }
  }
  return (
    <div className="grid gap-4">
      <label>
        <span className="label">Nama</span>
        <input
          className="field"
          value={r.name}
          maxLength={60}
          onChange={(e) => setR({ ...r, name: e.target.value })}
          placeholder="mis. Makan di tempat favorit"
        />
        {phi && <span className="mt-1 block text-xs text-danger">Mirip identitas pasien ({phi}).</span>}
      </label>
      <label>
        <span className="label">Biaya (Rp, 0 = gratis)</span>
        <input
          className="field"
          inputMode="numeric"
          value={r.cost ? r.cost.toLocaleString('id-ID') : '0'}
          onChange={(e) => setR({ ...r, cost: Number(e.target.value.replace(/[^\d]/g, '')) || 0 })}
        />
      </label>
      <div className="flex gap-2">
        {initial.name && (
          <button type="button" className="btn-ghost border border-line" onClick={() => void save(!initial.archived)}>
            {initial.archived ? 'Aktifkan lagi' : 'Arsipkan'}
          </button>
        )}
        <button type="button" className="btn-primary flex-1 py-3" disabled={!r.name.trim() || !!phi} onClick={() => void save()}>
          Simpan
        </button>
      </div>
    </div>
  )
}

function RewardList({ data }: { data: HadiahData }) {
  const toast = useToast()
  const [editing, setEditing] = useState<Reward | null>(null)
  const active = data.rewards.filter((r) => !r.archived)
  const archived = data.rewards.filter((r) => r.archived)
  const names = new Set(data.rewards.map((r) => r.name.toLowerCase()))
  const ideas = REWARD_IDEAS.filter((i) => !names.has(i.name.toLowerCase()))
  const claim = async (r: Reward) => {
    try {
      const c = await claimReward(r.id, data.today)
      toast({
        message: `Selamat menikmati: ${c.name}.`,
        duration: 6000,
        action: { label: 'Urungkan', onClick: () => void undoClaim(c.id) },
      })
    } catch (e) {
      toast({ message: (e as Error).message, tone: 'warning' })
    }
  }
  return (
    <section className="card">
      <h2 className="card-title">
        <Gift size={17} aria-hidden="true" /> Daftar hadiah
        <button type="button" onClick={() => setEditing(newReward())} className="btn-ghost -my-1 ml-auto border border-line py-1.5">
          <Plus size={15} aria-hidden="true" /> Hadiah
        </button>
      </h2>
      {!active.length && <p className="text-[13px] text-muted">Isi sendiri hadiah yang benar-benar kamu tunggu. Ide cepat ada di bawah.</p>}
      <ul>
        {active.map((r) => {
          const block = claimBlock(r, data.tokens, data.bridge)
          return (
            <li key={r.id} className="flex items-center gap-2 border-t border-line py-2 first:border-t-0">
              <button type="button" onClick={() => setEditing(r)} className="flex-1 text-left text-[13.5px]">
                {r.name}
                <span className="block text-xs text-muted tabular-nums">{costText(r.cost)}</span>
              </button>
              <button
                type="button"
                className={block ? 'btn-ghost border border-line py-1.5' : 'btn-primary py-1.5'}
                disabled={!!block}
                title={block === 'jembatan' ? 'Terkunci sampai dana jembatan tercapai' : block === 'token' ? 'Belum ada token' : undefined}
                onClick={() => void claim(r)}
              >
                {block === 'jembatan' && <Lock size={13} aria-hidden="true" />} Klaim
              </button>
            </li>
          )
        })}
      </ul>
      {ideas.length > 0 && (
        <div className="mt-3 border-t border-line pt-3">
          <div className="mb-2 text-xs text-faint">Tambah cepat</div>
          <div className="flex flex-wrap gap-1.5">
            {ideas.map((i) => (
              <button key={i.name} type="button" className="chip py-1" onClick={() => void saveReward(newReward(i.name, i.cost))}>
                <Plus size={13} aria-hidden="true" /> {i.name}
                <span className="text-faint">{i.cost ? formatRupiah(i.cost) : 'gratis'}</span>
              </button>
            ))}
          </div>
        </div>
      )}
      {archived.length > 0 && (
        <details className="mt-3 text-[13px]">
          <summary className="cursor-pointer text-muted">Diarsipkan ({archived.length})</summary>
          <ul className="mt-1">
            {archived.map((r) => (
              <li key={r.id}>
                <button type="button" className="py-1 text-muted hover:text-text" onClick={() => setEditing(r)}>
                  {r.name}
                </button>
              </li>
            ))}
          </ul>
        </details>
      )}
      <RewardEditor reward={editing} onClose={() => setEditing(null)} />
    </section>
  )
}

function History({ data }: { data: HadiahData }) {
  return (
    <section className="card">
      <h2 className="card-title">
        Riwayat klaim <span className="text-[13px] font-medium text-faint">{data.claims.length}</span>
      </h2>
      {!data.claims.length && <p className="text-[13px] text-muted">Belum ada klaim.</p>}
      <ul>
        {data.claims.map((c) => (
          <li key={c.id} className="flex items-center gap-2 border-t border-line py-2 text-[13.5px] first:border-t-0">
            <span className="flex-1">
              {c.name}
              <span className="block text-xs text-muted">
                {formatDateShort(c.date)} · Level {c.level}
              </span>
            </span>
            <span className="text-xs text-muted tabular-nums">{costText(c.cost)}</span>
          </li>
        ))}
      </ul>
    </section>
  )
}

export function HadiahPage() {
  const today = useToday()
  const data = useHadiah(today)
  return (
    <>
      <PageTop title="Hadiah" />
      <h1 className="mt-4 text-[26px] font-semibold tracking-tight md:hidden">Hadiah</h1>
      {data && (
        <>
          <Summary data={data} />
          <div className="mt-3 grid items-start gap-3 lg:grid-cols-2">
            <RewardList data={data} />
            <History data={data} />
          </div>
        </>
      )}
    </>
  )
}
