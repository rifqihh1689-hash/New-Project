import { beforeEach, describe, expect, it } from 'vitest'
import { resetDatabase } from '../test/db-utils'
import { formatQty } from '../domain/menu'
import { weekDates } from '../domain/time'
import type { DayType } from '../types'
import { db } from './db'
import { autoPlan, loadMenus, restorePlan, saveMenu, savePrices, setMeal, shoppingTask, updateNutrition } from './menu'
import { loadProfile } from './structure'

const dates = weekDates('2026-11-02')
const types = new Map<string, DayType | null>(dates.map((d) => [d, d >= '2026-11-07' ? 'libur' : 'stase']))

beforeEach(resetDatabase)

describe('rencana makan', () => {
  it('isi otomatis mengisi yang kosong, mempertahankan pilihan manual, dan bisa diurungkan', async () => {
    await updateNutrition({ phase: 'cut', mealsPerDay: 3 })
    await setMeal(dates[0], 'siang', '#menu:soto-ayam')
    const before = await autoPlan(dates, types, { onlyEmpty: true, seed: 5 })
    expect(await db.mealPlans.count()).toBe(21)
    expect((await db.mealPlans.get('#meal:2026-11-02:siang'))?.menuId).toBe('#menu:soto-ayam')
    await restorePlan(dates, before)
    expect(await db.mealPlans.count()).toBe(1)
  })

  it('setelan makan tersimpan di profil', async () => {
    await updateNutrition({ weightKg: 70 })
    await updateNutrition({ phase: 'bulk', mealsPerDay: 5 })
    expect((await loadProfile()).nutrition).toEqual({ weightKg: 70, phase: 'bulk', mealsPerDay: 5 })
  })

  it('menu bawaan bisa diubah tanpa duplikat; menu baru ikut tampil', async () => {
    const menus = await loadMenus()
    const egg = menus.find((m) => m.id === '#menu:telur-rebus')!
    await saveMenu({ ...egg, costRp: 7_500 })
    await saveMenu({ ...egg, id: 'mnu_x', name: 'Ayam bakar madu', source: 'masak' })
    const after = await loadMenus()
    expect(after).toHaveLength(menus.length + 1)
    expect(after.find((m) => m.id === '#menu:telur-rebus')?.costRp).toBe(7_500)
  })

  it('daftar belanja menjadi tugas dengan subtugas per bahan', async () => {
    const id = await shoppingTask(
      [
        { name: 'Telur', qty: 14, unit: 'butir' },
        { name: 'Dada ayam', qty: 1200, unit: 'g' },
      ],
      '2026-11-07',
      formatQty,
    )
    const task = (await db.tasks.get(id))!
    expect(task).toMatchObject({ title: 'Belanja mingguan', roleId: '#role:uang', date: '2026-11-07' })
    expect(task.subtasks.map((s) => s.title)).toEqual(['Telur 14 butir', 'Dada ayam 1,2 kg'])
  })
})

describe('harga bahan tersimpan', () => {
  it('memperbarui biaya menu masak dan mencatat tanggal', async () => {
    const before = (await loadMenus()).find((m) => m.id === '#menu:ayam-panggang')!
    const nutrition = (await loadProfile()).nutrition
    expect(nutrition?.pricesUpdatedAt).toBeUndefined()
    await savePrices([{ name: 'Dada ayam', unit: 'g', rpPerUnit: 60 }])
    const after = (await loadMenus()).find((m) => m.id === '#menu:ayam-panggang')!
    expect(after.costRp - before.costRp).toBe(2_200) // 150 g × Rp15 lebih mahal = 2.250 → dibulatkan
    expect((await loadProfile()).nutrition?.pricesUpdatedAt).toBeGreaterThan(0)
  })
})
