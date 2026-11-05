import { describe, expect, it } from 'vitest'
import { DEFAULT_ROLES } from '../db/defaults'
import { headline } from './headline'
import { detectPatientIdentity } from './phi'
import { parseQuickTask } from './quickCapture'

describe('deteksi identitas pasien', () => {
  it.each(['No. RM 123', 'rm: 1234', 'pasien 1234567', 'FU Tn. Budi', 'Ny. Siti bed 4', 'An. Rafi demam', 'By. Ny Ani'])(
    'menandai "%s"',
    (text) => {
      expect(detectPatientIdentity(text)).not.toBeNull()
    },
  )

  it.each([
    '50 soal kardio besok',
    'Follow-up bangsal & laporan pagi',
    'Kasus fraktur femur, laki-laki 40-an',
    'Bayar kos Rp200.000',
    'Tentir Murid A',
  ])('membiarkan "%s"', (text) => {
    expect(detectPatientIdentity(text)).toBeNull()
  })
})

describe('Catat cepat', () => {
  const today = '2026-11-05' // Kamis
  const parse = (t: string) => parseQuickTask(t, today, DEFAULT_ROLES)

  it('tanggal dari kata', () => {
    expect(parse('50 soal kardio besok')).toEqual({ title: '50 soal kardio', date: '2026-11-06', roleId: '#role:ukmppd', important: false })
    expect(parse('lusa presentasi lapsus').date).toBe('2026-11-07')
    expect(parse('referat hari senin').date).toBe('2026-11-09')
    expect(parse('referat kamis').date).toBe('2026-11-12') // nama hari ini = minggu depan
    expect(parse('baca jurnal').date).toBe(today)
  })

  it('peran dari tagar, lalu tebakan kata kunci', () => {
    expect(parse('baca materi #tentir').roleId).toBe('#role:tentir')
    expect(parse('baca materi #uang').roleId).toBe('#role:uang')
    expect(parse('seleksi abstrak systematic review').roleId).toBe('#role:orto')
    expect(parse('bayar kos').roleId).toBe('#role:uang')
    expect(parse('telepon ibu').roleId).toBeNull()
  })

  it('penting', () => {
    expect(parse('bayar kos !')).toMatchObject({ title: 'Bayar kos', important: true })
    expect(parse('penting: kumpulkan logbook').important).toBe(true)
  })

  it('peran yang diarsipkan tidak dipilih', () => {
    const roles = DEFAULT_ROLES.map((r) => (r.id === '#role:ukmppd' ? { ...r, archived: true } : r))
    expect(parseQuickTask('50 soal', today, roles).roleId).toBeNull()
  })
})

describe('kalimat pembuka', () => {
  it('menyesuaikan tipe hari & fase', () => {
    expect(headline({ type: 'stase', suggested: 'stase', invalidPasca: false, hasTentir: true })).toBe(
      'Hari stase. Pulang ±14.00, qailulah dulu sebelum tentir.',
    )
    expect(headline({ type: 'stase', suggested: 'stase', invalidPasca: false, hasTentir: false, workLabel: 'Dinas' })).toBe(
      'Hari dinas. Pulang ±14.00, qailulah dulu.',
    )
    expect(headline({ type: 'pasca', suggested: 'pasca', invalidPasca: false, hasTentir: false })).toMatch(/pulih/)
    expect(headline({ type: null, suggested: 'pasca', invalidPasca: false, hasTentir: false })).toMatch(/Kemarin jaga/)
  })
})
