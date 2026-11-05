import { Archive, ArchiveRestore, Plus } from 'lucide-react'
import { useState } from 'react'
import { useToast } from '../../components/toast-context'
import { assertNoPatientIdentity } from '../../db/daily'
import { savePhase, saveRole, usePhases, useRoles } from '../../db/structure'
import { DAY_TYPE_LABELS } from '../../domain/dayType'
import { isValidISODate } from '../../domain/time'
import { createId } from '../../lib/id'
import type { Phase, Role } from '../../types'

/**
 * Fase hidup & peran. Berganti fase = isi tanggal selesai, tambah fase baru, arsipkan peran lama.
 * Tidak ada yang dihapus atau direset; tugas lama tetap berlabel peran lamanya.
 */
export function LifeStructure() {
  const phases = usePhases()
  const roles = useRoles()
  const toast = useToast()
  const guard = async (fn: () => Promise<void>) => {
    try {
      await fn()
    } catch (e) {
      toast({ message: (e as Error).message, tone: 'error' })
    }
  }
  const addPhase = () =>
    guard(() =>
      savePhase({
        id: createId('phs'),
        name: 'Fase baru',
        note: '',
        start: null,
        end: null,
        order: Math.max(0, ...(phases ?? []).map((p) => p.order)) + 1,
        archived: false,
        createdAt: Date.now(),
        updatedAt: Date.now(),
      }),
    )
  const addRole = () =>
    guard(() =>
      saveRole({
        id: createId('rol'),
        name: 'Peran baru',
        color: '#8b9096',
        order: Math.max(0, ...(roles ?? []).map((r) => r.order)) + 1,
        recovery: false,
        archived: false,
        createdAt: Date.now(),
        updatedAt: Date.now(),
      }),
    )

  return (
    <>
      <section className="card">
        <h2 className="card-title">Fase hidup</h2>
        <p className="mb-3 text-[13px] text-muted">
          Saat fase berganti, isi tanggal selesai fase lama lalu tambah fase baru. Label tipe hari bisa diganti per fase (mis. "Stase" →
          "Dinas"). XP, streak, dan riwayat tetap berlanjut.
        </p>
        <div className="grid gap-3">
          {(phases ?? []).map((p) => (
            <PhaseRow
              key={p.id}
              phase={p}
              onSave={(next) =>
                guard(async () => {
                  assertNoPatientIdentity(next.name, next.note)
                  await savePhase(next)
                })
              }
            />
          ))}
        </div>
        <button type="button" className="btn-ghost mt-3 border border-line" onClick={() => void addPhase()}>
          <Plus size={16} aria-hidden="true" /> Tambah fase
        </button>
      </section>

      <section className="card">
        <h2 className="card-title">Peran</h2>
        <p className="mb-3 text-[13px] text-muted">
          Peran tidak dihapus, hanya diarsipkan: hilang dari pilihan, tapi tugas lama tetap punya nama dan warnanya.
        </p>
        <div className="grid gap-2">
          {(roles ?? []).map((r) => (
            <RoleRow
              key={r.id}
              role={r}
              onSave={(next) =>
                guard(async () => {
                  assertNoPatientIdentity(next.name)
                  await saveRole(next)
                })
              }
            />
          ))}
        </div>
        <button type="button" className="btn-ghost mt-3 border border-line" onClick={() => void addRole()}>
          <Plus size={16} aria-hidden="true" /> Tambah peran
        </button>
      </section>
    </>
  )
}

function PhaseRow({ phase, onSave }: { phase: Phase; onSave: (p: Phase) => void }) {
  const [open, setOpen] = useState(false)
  const set = (changes: Partial<Phase>) => onSave({ ...phase, ...changes })
  return (
    <div className={`rounded-xl border border-line p-3 ${phase.archived ? 'opacity-55' : ''}`}>
      <div className="flex items-center gap-2">
        <input
          className="field flex-1 font-medium"
          defaultValue={phase.name}
          onBlur={(e) => e.target.value.trim() && e.target.value !== phase.name && set({ name: e.target.value.trim() })}
          aria-label="Nama fase"
        />
        <button
          type="button"
          className="btn-ghost p-2"
          onClick={() => set({ archived: !phase.archived })}
          aria-label={phase.archived ? 'Pulihkan fase' : 'Arsipkan fase'}
          title={phase.archived ? 'Pulihkan' : 'Arsipkan'}
        >
          {phase.archived ? <ArchiveRestore size={16} aria-hidden="true" /> : <Archive size={16} aria-hidden="true" />}
        </button>
      </div>
      <div className="mt-2 grid grid-cols-2 gap-2">
        <label className="text-xs text-muted">
          Mulai
          <input
            className="field mt-1"
            type="date"
            defaultValue={phase.start ?? ''}
            onBlur={(e) => set({ start: isValidISODate(e.target.value) ? e.target.value : null })}
          />
        </label>
        <label className="text-xs text-muted">
          Selesai / tanggal penting
          <input
            className="field mt-1"
            type="date"
            defaultValue={phase.end ?? ''}
            onBlur={(e) => set({ end: isValidISODate(e.target.value) ? e.target.value : null })}
          />
        </label>
      </div>
      <div className="mt-2 flex flex-wrap items-center gap-2">
        <input
          className="field flex-1 text-[13px]"
          defaultValue={phase.note}
          placeholder="Keterangan, mis. RS tempat stase"
          onBlur={(e) => e.target.value !== phase.note && set({ note: e.target.value })}
          aria-label="Keterangan fase"
        />
        <button type="button" className="text-xs text-muted underline-offset-2 hover:underline" onClick={() => setOpen((o) => !o)}>
          Label tipe hari
        </button>
      </div>
      {open && (
        <div className="mt-2 grid grid-cols-2 gap-2 md:grid-cols-4">
          {(Object.keys(DAY_TYPE_LABELS) as (keyof typeof DAY_TYPE_LABELS)[]).map((t) => (
            <input
              key={t}
              className="field text-[13px]"
              defaultValue={phase.dayTypeLabels?.[t] ?? ''}
              placeholder={DAY_TYPE_LABELS[t]}
              aria-label={`Label ${DAY_TYPE_LABELS[t]}`}
              onBlur={(e) => set({ dayTypeLabels: { ...phase.dayTypeLabels, [t]: e.target.value.trim() || undefined } })}
            />
          ))}
        </div>
      )}
    </div>
  )
}

function RoleRow({ role, onSave }: { role: Role; onSave: (r: Role) => void }) {
  const set = (changes: Partial<Role>) => onSave({ ...role, ...changes })
  return (
    <div className={`flex items-center gap-2 ${role.archived ? 'opacity-55' : ''}`}>
      <input
        type="color"
        defaultValue={role.color}
        onBlur={(e) => e.target.value !== role.color && set({ color: e.target.value })}
        className="size-9 shrink-0 cursor-pointer rounded-lg border border-line bg-transparent p-1"
        aria-label={`Warna ${role.name}`}
      />
      <input
        className="field flex-1"
        defaultValue={role.name}
        onBlur={(e) => e.target.value.trim() && e.target.value !== role.name && set({ name: e.target.value.trim() })}
        aria-label="Nama peran"
      />
      {role.recovery && <span className="text-xs text-faint">pemulihan</span>}
      <button
        type="button"
        className="btn-ghost p-2"
        onClick={() => set({ archived: !role.archived })}
        aria-label={role.archived ? 'Pulihkan peran' : 'Arsipkan peran'}
        title={role.archived ? 'Pulihkan' : 'Arsipkan'}
      >
        {role.archived ? <ArchiveRestore size={16} aria-hidden="true" /> : <Archive size={16} aria-hidden="true" />}
      </button>
    </div>
  )
}
