import { beforeEach, describe, expect, it } from 'vitest'
import { resetDatabase } from '../test/db-utils'
import { db } from './db'
import { addProposal, approveProposal, loadProposals, previewProposal, rejectProposal, reopenProposal } from './proposals'
import { loadRoles } from './structure'

beforeEach(resetDatabase)

const TODAY = '2026-11-05'
const items = [
  { jenis: 'tugas', judul: 'Baca jurnal fraktur femur', tanggal: '2026-11-06', peran: 'orto' },
  { jenis: 'jaga', tanggal: '2026-11-07' },
  { jenis: 'tugas', judul: 'Follow up Tn. Budi bed 4', tanggal: '2026-11-06' },
]

describe('usulan dari Claude', () => {
  it('pratinjau memakai jalur Impor; baris identitas pasien ditandai', async () => {
    const p = await addProposal('Rencana besok', items)
    const rows = previewProposal(p, await loadRoles(), TODAY)
    expect(rows).toHaveLength(3)
    expect(rows[2].phi).toBeTruthy()
  })

  it('setujui hanya baris terpilih dan tidak pernah menulis baris identitas pasien', async () => {
    const p = await addProposal('Rencana besok', items)
    const result = await approveProposal(p.id, TODAY, new Set([0, 2]))
    expect(result).toMatch(/1 tugas/)
    const tasks = await db.tasks.toArray()
    expect(tasks.map((t) => t.title)).toEqual(['Baca jurnal fraktur femur'])
    expect(tasks[0].roleId).toBe('#role:orto')
    expect(await db.days.count()).toBe(0) // jaga tidak dipilih
    expect((await db.proposals.get(p.id))?.status).toBe('disetujui')
    await expect(approveProposal(p.id, TODAY)).rejects.toThrow('sudah diputuskan')
  })

  it('tolak bisa diurungkan; daftar terbaru di atas', async () => {
    const a = await addProposal('A', items.slice(1, 2))
    await new Promise((r) => setTimeout(r, 2))
    const b = await addProposal('B', items.slice(0, 1))
    await rejectProposal(a.id)
    expect((await loadProposals()).map((p) => p.summary)).toEqual(['B', 'A'])
    await reopenProposal(a.id)
    expect((await approveProposal(a.id, TODAY)).toLowerCase()).toMatch(/jaga/)
    expect((await db.days.get('#day:2026-11-07'))?.type).toBe('jaga')
    void b
  })
})
