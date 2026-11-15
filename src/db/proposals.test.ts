import { beforeEach, describe, expect, it } from 'vitest'
import { resetDatabase } from '../test/db-utils'
import { db } from './db'
import {
  addProposal,
  approveProposal,
  compactProposals,
  deleteProposal,
  deleteRejectedProposals,
  loadProposals,
  previewProposal,
  rejectProposal,
  reopenProposal,
  restoreProposals,
} from './proposals'
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

  it('kartu dari Claude: jadi kartu ulasan jatuh tempo hari ini; depan yang sama dilewati; identitas pasien ditolak', async () => {
    const cards = [
      { jenis: 'kartu', depan: 'Tanda khas stenosis aorta?', belakang: 'Murmur ejeksi sistolik di ICS 2 kanan.', sistem: 'kardiovaskular' },
      { jenis: 'kartu', depan: 'tanda khas stenosis aorta?', belakang: 'duplikat' },
      { jenis: 'kartu', depan: 'Kasus Tn. Budi tadi pagi', belakang: 'jawaban' },
      { jenis: 'kartu', depan: 'Tanpa belakang' },
    ]
    const p = await addProposal('Kartu kardio', cards)
    const rows = previewProposal(p, await loadRoles(), TODAY)
    expect(rows[2].phi).toBeTruthy()
    expect(rows[3].error).toMatch(/depan.*belakang/)
    const result = await approveProposal(p.id, TODAY)
    expect(result).toMatch(/1 kartu ulasan, 1 kartu sudah ada/)
    const stored = await db.flashcards.toArray()
    expect(stored).toHaveLength(1)
    expect(stored[0]).toMatchObject({
      front: 'Tanda khas stenosis aorta?',
      system: 'Kardiovaskular',
      source: 'claude',
      interval: 0,
      reps: 0,
    })
  })

  describe('pembersihan riwayat', () => {
    const DAY = 86_400_000
    const NOW = Date.UTC(2026, 10, 15)
    const decidedAgo = async (summary: string, days: number, status: 'disetujui' | 'ditolak') => {
      const p = await addProposal(summary, items.slice(0, 2))
      await db.proposals.update(p.id, {
        status,
        decidedAt: NOW - days * DAY,
        result: status === 'disetujui' ? 'Diimpor: 2 tugas.' : undefined,
      })
      return p.id
    }

    it('meringkas yang diputuskan > 30 hari: item dibuang, judul/status/hasil tetap; yang baru dan yang menunggu tidak disentuh', async () => {
      const lama = await decidedAgo('Lama disetujui', 40, 'disetujui')
      const lamaTolak = await decidedAgo('Lama ditolak', 31, 'ditolak')
      const baru = await decidedAgo('Baru', 5, 'disetujui')
      const menunggu = (await addProposal('Menunggu', items.slice(0, 1))).id
      expect(await compactProposals(NOW)).toBe(2)
      expect(await db.proposals.get(lama)).toMatchObject({
        items: [],
        summary: 'Lama disetujui',
        status: 'disetujui',
        result: 'Diimpor: 2 tugas.',
      })
      expect((await db.proposals.get(lamaTolak))?.items).toEqual([])
      expect((await db.proposals.get(baru))?.items).toHaveLength(2)
      expect((await db.proposals.get(menunggu))?.items).toHaveLength(1)
      // Aman diulang.
      expect(await compactProposals(NOW)).toBe(0)
    })

    it('hapus satu: hanya yang sudah diputuskan, bisa diurungkan; hapus semua yang ditolak', async () => {
      const a = await decidedAgo('A', 1, 'disetujui')
      await decidedAgo('B', 1, 'ditolak')
      await decidedAgo('C', 2, 'ditolak')
      const menunggu = (await addProposal('Menunggu', items.slice(0, 1))).id
      expect(await deleteProposal(menunggu)).toBeUndefined() // usulan menunggu tidak bisa dihapus dari riwayat
      const row = await deleteProposal(a)
      expect(await db.proposals.get(a)).toBeUndefined()
      await restoreProposals([row!])
      expect(await db.proposals.get(a)).toBeDefined()
      const removed = await deleteRejectedProposals()
      expect(removed).toHaveLength(2)
      expect((await db.proposals.toArray()).map((p) => p.status).sort()).toEqual(['disetujui', 'menunggu'])
      await restoreProposals(removed)
      expect(await db.proposals.count()).toBe(4)
    })
  })
})
