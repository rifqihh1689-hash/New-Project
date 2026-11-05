import { beforeEach, describe, expect, it } from 'vitest'
import { resetDatabase } from '../test/db-utils'
import { convertDompetku, parseDompetku } from '../domain/dompetku'
import { PatientIdentityError } from './daily'
import { db } from './db'
import { applyDompetku } from './dompetku'
import {
  addDeposit,
  addPayment,
  copyBudgets,
  deleteCategory,
  deleteTransaction,
  loadCategories,
  MoneyError,
  newCategory,
  newDebt,
  newRecurring,
  newSaving,
  runRecurring,
  saveCategory,
  saveDebt,
  saveRecurring,
  saveSaving,
  saveTransaction,
  setBudget,
} from './money'
import { saveSession } from './tentir'

beforeEach(resetDatabase)

const TODAY = '2026-11-05'

describe('transaksi', () => {
  it('validasi nominal, identitas pasien, dan transaksi tentir hanya lewat Tentir', async () => {
    await expect(saveTransaction({ amount: 0, type: 'expense', categoryId: '#cat:makan', date: TODAY, note: '' })).rejects.toBeInstanceOf(
      MoneyError,
    )
    await expect(
      saveTransaction({ amount: 50_000, type: 'expense', categoryId: '#cat:kesehatan', date: TODAY, note: 'obat untuk Tn. Budi' }),
    ).rejects.toBeInstanceOf(PatientIdentityError)
    const t = await saveTransaction({ amount: 25_000, type: 'expense', categoryId: '#cat:makan', date: TODAY, note: ' makan siang ' })
    expect(t.note).toBe('makan siang')
    const { id } = await saveSession({ student: 'AB', topic: 'Anatomi', date: TODAY, start: '19.00', hours: 2, fee: 170_000, paid: true })
    const tentirTx = (await db.transactions.toArray()).find((x) => x.tentirSessionId === id)!
    await expect(deleteTransaction(tentirTx.id)).rejects.toThrow('Tentir')
    await expect(saveTransaction({ ...tentirTx, amount: 1 })).rejects.toThrow('Tentir')
  })
})

describe('anggaran', () => {
  it('satu per kategori per bulan; 0 = hapus; salin dari bulan lalu tanpa menimpa', async () => {
    await setBudget('2026-10', '#cat:makan', 1_200_000)
    await setBudget('2026-10', '#cat:transport', 200_000)
    await setBudget('2026-11', '#cat:makan', 1_000_000)
    await setBudget('2026-11', '#cat:makan', 1_100_000)
    expect(await db.budgets.where('month').equals('2026-11').count()).toBe(1)
    expect(await copyBudgets('2026-10', '2026-11')).toBe(1)
    const nov = await db.budgets.where('month').equals('2026-11').toArray()
    expect(nov.find((b) => b.categoryId === '#cat:makan')?.amount).toBe(1_100_000)
    await setBudget('2026-11', '#cat:transport', 0)
    expect(await db.budgets.where('month').equals('2026-11').count()).toBe(1)
  })
})

describe('berulang', () => {
  it('membuat transaksi jatuh tempo sekali saja (aman dijalankan ulang)', async () => {
    await saveRecurring({ ...newRecurring('2026-09-01'), amount: 900_000, note: 'Kos', dayOfMonth: 1 })
    expect(await runRecurring(TODAY)).toBe(3) // Sep, Okt, Nov
    expect(await runRecurring(TODAY)).toBe(0)
    const txs = await db.transactions.toArray()
    expect(txs.map((t) => t.date).sort()).toEqual(['2026-09-01', '2026-10-01', '2026-11-01'])
    await expect(saveRecurring({ ...newRecurring(TODAY), amount: 0 })).rejects.toBeInstanceOf(MoneyError)
  })
})

describe('kategori, tabungan, utang', () => {
  it('kategori buatan sendiri dihapus → transaksinya pindah ke Lainnya; bawaan tidak bisa dihapus', async () => {
    const c = { ...newCategory('expense'), name: 'Kado' }
    await saveCategory(c)
    expect((await loadCategories()).some((x) => x.name === 'Kado')).toBe(true)
    await saveTransaction({ amount: 40_000, type: 'expense', categoryId: c.id, date: TODAY, note: '' })
    await deleteCategory(c.id)
    expect((await db.transactions.toArray())[0].categoryId).toBe('#cat:lainnya')
    await saveCategory({ ...(await loadCategories())[0], name: 'Makan & minum' })
    await expect(deleteCategory('#cat:makan')).rejects.toBeInstanceOf(MoneyError)
  })

  it('setoran dana jembatan & cicilan utang tersimpan', async () => {
    const s = { ...newSaving('jembatan'), target: 15_000_000 }
    await saveSaving(s)
    await addDeposit(s.id, 1_000_000, TODAY)
    expect((await db.savings.get(s.id))?.deposits).toEqual([{ date: TODAY, amount: 1_000_000 }])
    const d = { ...newDebt(), name: 'Pinjaman kakak', initial: 3_000_000 }
    await saveDebt(d)
    await addPayment(d.id, 500_000, TODAY)
    expect((await db.debts.get(d.id))?.payments).toHaveLength(1)
    await expect(saveSaving({ ...newSaving(), name: 'x', target: 0 })).rejects.toBeInstanceOf(MoneyError)
  })
})

describe('impor Dompetku', () => {
  const backup = JSON.stringify({
    app: 'dompetku',
    version: 1,
    exportedAt: '2026-11-01T00:00:00Z',
    data: {
      categories: [
        { id: 'cat-makan', name: 'Makan', icon: 'utensils', color: '#eb6834', kind: 'expense', builtIn: true, createdAt: 0 },
        { id: 'cat-abc', name: 'Kopi', icon: 'coffee', color: '#7c4a2d', kind: 'expense', builtIn: false, createdAt: 9 },
      ],
      transactions: [
        {
          id: 'tx1',
          amount: 25000,
          type: 'expense',
          categoryId: 'cat-makan',
          date: '2026-10-02',
          note: 'nasi',
          createdAt: 1,
          updatedAt: 1,
        },
        {
          id: 'tx2',
          amount: 18000,
          type: 'expense',
          categoryId: 'cat-abc',
          date: '2026-10-03',
          note: 'Ny. Sari bed 2',
          createdAt: 1,
          updatedAt: 1,
        },
        {
          id: 'rec-r1-2026-10',
          amount: 900000,
          type: 'expense',
          categoryId: 'cat-tagihan',
          date: '2026-10-01',
          note: 'Kos',
          recurringId: 'r1',
          createdAt: 1,
          updatedAt: 1,
        },
        { id: 'tx3', amount: 2000000, type: 'income', categoryId: 'cat-gaji', date: '2026-10-01', note: '', createdAt: 1, updatedAt: 1 },
        { id: 'rusak', amount: -5, type: 'expense', categoryId: 'cat-makan', date: '2026-10-01' },
      ],
      budgets: [{ id: '2026-10:cat-makan', month: '2026-10', categoryId: 'cat-makan', amount: 1200000 }],
      recurring: [
        {
          id: 'r1',
          amount: 900000,
          type: 'expense',
          categoryId: 'cat-tagihan',
          note: 'Kos',
          dayOfMonth: 1,
          startMonth: '2026-10',
          lastGeneratedMonth: '2026-10',
          active: true,
          createdAt: 1,
        },
      ],
    },
  })

  it('memetakan kategori, menyaring catatan berisi identitas pasien, aman diulang, tidak dobel dengan berulang', async () => {
    const data = parseDompetku(backup)!
    const plan = convertDompetku(data)
    expect(plan.stats).toMatchObject({ skipped: 1, notesDropped: 1, months: ['2026-10'] })
    expect(plan.categories.map((c) => c.id)).toEqual(['cat-abc'])
    const first = await applyDompetku(plan)
    expect(first.transactions.added).toBe(4)
    expect((await applyDompetku(plan)).transactions.added).toBe(0)
    const txs = await db.transactions.toArray()
    expect(txs.find((t) => t.id === 'tx1')?.categoryId).toBe('#cat:makan')
    expect(txs.find((t) => t.id === 'tx3')?.categoryId).toBe('#cat:kiriman')
    expect(txs.find((t) => t.id === 'tx2')?.note).toBe('')
    expect((await db.budgets.toArray())[0].id).toBe('#bud:2026-10:#cat:makan')
    expect(await runRecurring(TODAY)).toBe(1) // hanya November; Oktober sudah ada dari Dompetku
    expect(await db.transactions.count()).toBe(5)
    expect(parseDompetku('{"app":"lain"}')).toBeNull()
  })
})
