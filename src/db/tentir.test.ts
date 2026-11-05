import { beforeEach, describe, expect, it } from 'vitest'
import { resetDatabase } from '../test/db-utils'
import { loadDaySnapshot, PatientIdentityError, setDayType, setWorkEnd } from './daily'
import { db } from './db'
import { deleteSession, loadTentirRate, restoreSession, saveSession, saveTentirSettings, setPaid, TENTIR_CATEGORY_ID } from './tentir'
import { loadProfile, updateProfile } from './structure'

beforeEach(resetDatabase)

const TODAY = '2026-11-05'
const base = { student: 'ab', topic: 'Anatomi', date: TODAY, start: '19.00', hours: 2, fee: 170_000, paid: false }

describe('sesi tentir', () => {
  it('sesi lunas jadi pemasukan; diubah ikut berubah; dicabut lunasnya → transaksi hilang', async () => {
    const { id } = await saveSession({ ...base, paid: true })
    const s = (await db.tentirSessions.get(id))!
    expect(s.student).toBe('AB')
    const tx = (await db.transactions.get(s.transactionId!))!
    expect(tx).toMatchObject({ amount: 170_000, type: 'income', categoryId: TENTIR_CATEGORY_ID, tentirSessionId: id, date: TODAY })

    await saveSession({ ...s, fee: 200_000 })
    expect(await db.transactions.count()).toBe(1)
    expect((await db.transactions.get(s.transactionId!))?.amount).toBe(200_000)

    await setPaid((await db.tentirSessions.get(id))!, false)
    expect(await db.transactions.count()).toBe(0)
    expect((await db.tentirSessions.get(id))?.transactionId).toBeNull()
  })

  it('hapus sesi ikut menghapus transaksinya, dan bisa diurungkan', async () => {
    const { id } = await saveSession({ ...base, paid: true })
    const removed = (await deleteSession(id))!
    expect(await db.transactions.count()).toBe(0)
    await restoreSession(removed)
    expect(await db.tentirSessions.count()).toBe(1)
    expect(await db.transactions.count()).toBe(1)
  })

  it('quest tentir ikut batas kerja malam; sesi yang melewati batas tidak pernah dicatat lembur', async () => {
    await setDayType(TODAY, 'stase')
    let snap = await loadDaySnapshot(TODAY, TODAY)
    expect(snap.rows.some((r) => r.habitKind === 'tentir')).toBe(false)

    await saveSession(base)
    snap = await loadDaySnapshot(TODAY, TODAY)
    expect(snap.rows.find((r) => r.habitKind === 'tentir')).toMatchObject({
      done: true,
      size: 'sedang',
      title: 'Sesi tentir selesai ≤ 21.00',
    })

    await saveSession({ ...base, start: '20.30', hours: 1.5 }) // 20.30–22.00
    snap = await loadDaySnapshot(TODAY, TODAY)
    expect(snap.rows.find((r) => r.habitKind === 'tentir')?.done).toBe(false)
    expect(snap.day?.workEnd ?? null).toBeNull() // tidak ada lembur otomatis
    expect(snap.result.penalty).toBe(0)

    // Batas digeser ke 22.30 → sesi itu masuk batas; quest berganti nama.
    await updateProfile({ rules: { workEndLimit: '22.30' } })
    snap = await loadDaySnapshot(TODAY, TODAY)
    expect(snap.rows.find((r) => r.habitKind === 'tentir')).toMatchObject({ done: true, title: 'Sesi tentir selesai ≤ 22.30' })
    expect(snap.rows.find((r) => r.habitKind === 'workend')?.title).toBe('Berhenti kerja ≤ 22.30')
  })

  it('batas kerja malam dimatikan: tanpa quest tentir, tanpa habit berhenti kerja, tanpa penalti', async () => {
    await setDayType(TODAY, 'stase')
    await saveSession({ ...base, start: '21.00' })
    await setWorkEnd(TODAY, 'late')
    expect((await loadDaySnapshot(TODAY, TODAY)).result.penalty).toBe(15)
    await updateProfile({ rules: { workEndLimit: null } })
    const snap = await loadDaySnapshot(TODAY, TODAY)
    expect(snap.rows.some((x) => x.habitKind === 'tentir' || x.habitKind === 'workend')).toBe(false)
    expect(snap.result.penalty).toBe(0)
  })

  it('di hari jaga tidak ada quest tentir', async () => {
    await setDayType(TODAY, 'jaga')
    await saveSession({ ...base, start: '21.00' })
    const snap = await loadDaySnapshot(TODAY, TODAY)
    expect(snap.rows.some((x) => x.habitKind === 'tentir')).toBe(false)
  })

  it('identitas pasien ditolak; tarif & kapasitas tersimpan di profil', async () => {
    await expect(saveSession({ ...base, topic: 'kasus Tn. Budi' })).rejects.toBeInstanceOf(PatientIdentityError)
    expect(await loadTentirRate()).toBe(85_000)
    await saveTentirSettings({ rate: 100_000, min: 8 })
    expect(await loadTentirRate()).toBe(100_000)
    expect((await loadProfile()).tentirCapacity).toEqual({ min: 8, max: 15 })
    await expect(saveTentirSettings({ min: 20 })).rejects.toThrow()
  })
})
