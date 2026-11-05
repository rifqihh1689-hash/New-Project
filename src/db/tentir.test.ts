import { beforeEach, describe, expect, it } from 'vitest'
import { resetDatabase } from '../test/db-utils'
import { loadDaySnapshot, PatientIdentityError, setDayType } from './daily'
import { db } from './db'
import { deleteSession, loadTentirRate, restoreSession, saveSession, saveTentirSettings, setPaid, TENTIR_CATEGORY_ID } from './tentir'
import { loadProfile } from './structure'

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

  it('quest "selesai ≤ 21.00" muncul di hari bertentir; lewat 21.00 mencatat lembur', async () => {
    await setDayType(TODAY, 'stase')
    let snap = await loadDaySnapshot(TODAY, TODAY)
    expect(snap.rows.some((r) => r.habitKind === 'tentir')).toBe(false)

    await saveSession(base)
    snap = await loadDaySnapshot(TODAY, TODAY)
    expect(snap.rows.find((r) => r.habitKind === 'tentir')).toMatchObject({ done: true, size: 'sedang' })

    const late = await saveSession({ ...base, start: '20.00' })
    expect(late.overtime).toBe(true)
    snap = await loadDaySnapshot(TODAY, TODAY)
    expect(snap.rows.find((r) => r.habitKind === 'tentir')?.done).toBe(false)
    expect(snap.day?.workEnd).toBe('late')
    expect(snap.result.penalty).toBe(15)
  })

  it('di hari jaga tidak ada quest tentir dan tidak mencatat lembur', async () => {
    await setDayType(TODAY, 'jaga')
    const r = await saveSession({ ...base, start: '21.00' })
    expect(r.overtime).toBe(false)
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
