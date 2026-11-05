import { beforeEach, describe, expect, it } from 'vitest'
import { resetDatabase } from '../test/db-utils'
import { activePackage, packageUsage } from '../domain/tentirPlus'
import { PatientIdentityError } from './daily'
import { db } from './db'
import { saveSession } from './tentir'
import { newMaterial, newPackage, newStudent, saveMaterial, savePackage, saveStudent, TentirError } from './tentirPlus'

beforeEach(resetDatabase)
const TODAY = '2026-11-05'

describe('Tentir+', () => {
  it('murid: inisial unik huruf besar; catatan dicek identitas pasien', async () => {
    await saveStudent({ ...newStudent('ab'), cohort: 'Sem 5' })
    await expect(saveStudent(newStudent('AB'))).rejects.toBeInstanceOf(TentirError)
    await expect(saveStudent({ ...newStudent('CD'), note: 'kakak Tn. Budi' })).rejects.toBeInstanceOf(PatientIdentityError)
    expect((await db.students.toArray())[0].initials).toBe('AB')
  })

  it('paket lunas jadi satu pemasukan; sesi paket bernilai Rp0 tanpa transaksi sendiri', async () => {
    const p = await savePackage({ ...newPackage('ab', TODAY), name: 'Blok 12', sessions: 4, price: 300_000 })
    expect(p.student).toBe('AB')
    expect(await db.transactions.count()).toBe(1)
    await saveSession({ student: 'AB', topic: 'Anatomi', date: TODAY, start: '19.00', hours: 2, fee: 0, paid: true, packageId: p.id })
    expect(await db.transactions.count()).toBe(1)
    const sessions = await db.tentirSessions.toArray()
    const pkgs = await db.tentirPackages.toArray()
    expect(packageUsage(pkgs[0], sessions)).toEqual({ used: 1, left: 3, done: false })
    expect(activePackage('AB', pkgs, sessions)?.id).toBe(p.id)
    await savePackage({ ...pkgs[0], paid: false })
    expect(await db.transactions.count()).toBe(0)
  })

  it('materi: judul wajib, tautan http(s), blok bawaan "Umum"', async () => {
    await expect(saveMaterial({ ...newMaterial(), title: '' })).rejects.toBeInstanceOf(TentirError)
    await expect(saveMaterial({ ...newMaterial(), title: 'x', link: 'drive' })).rejects.toBeInstanceOf(TentirError)
    await saveMaterial({ ...newMaterial(), title: 'Fraktur & dislokasi', link: 'https://drive.google.com/x' })
    expect((await db.materials.toArray())[0].block).toBe('Umum')
  })
})
