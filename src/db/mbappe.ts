import type { MbappePlan } from '../domain/mbappe'
import { DEFAULT_RULES } from '../domain/rules'
import type { EntityTable } from 'dexie'
import { db } from './db'
import { DEFAULT_PROFILE } from './defaults'

export interface MbappeSummary {
  days: number
  daysSkipped: number
  habits: number
  habitLogs: number
  mutabaah: number
  mutabaahLogs: number
  chapters: number
  mainQuests: number
  reviews: number
  money: number
  rules: boolean
}

/** Tambah baris yang ID-nya belum ada; yang sudah ada (data Qawwam atau impor sebelumnya) tidak disentuh. */
async function addMissing<T extends { id: string }>(table: EntityTable<T, 'id'>, rows: T[]): Promise<{ added: number; skipped: number }> {
  if (!rows.length) return { added: 0, skipped: 0 }
  const existing = await table.bulkGet(rows.map((r) => r.id) as Parameters<typeof table.bulkGet>[0])
  const fresh = rows.filter((_, i) => !existing[i])
  if (fresh.length) await table.bulkPut(fresh)
  return { added: fresh.length, skipped: rows.length - fresh.length }
}

/**
 * Menulis rencana impor MBAPPE OS. Data Qawwam menang: tanggal, habit, log, stase, dan Muhasabah
 * yang sudah ada tidak ditimpa, jadi impor aman diulang. Aturan XP hanya diambil bila belum diubah di Qawwam.
 */
export async function applyMbappe(plan: MbappePlan): Promise<MbappeSummary> {
  return db.transaction(
    'rw',
    [
      db.days,
      db.habits,
      db.habitLogs,
      db.mutabaah,
      db.mutabaahLogs,
      db.chapters,
      db.mainQuests,
      db.reviews,
      db.debts,
      db.savings,
      db.profile,
    ],
    async () => {
      const days = await addMissing(db.days, plan.days)
      const habits = await addMissing(db.habits, plan.habits)
      const habitLogs = await addMissing(db.habitLogs, plan.habitLogs)
      const mutabaah = await addMissing(db.mutabaah, plan.mutabaah)
      const mutabaahLogs = await addMissing(db.mutabaahLogs, plan.mutabaahLogs)
      const chapters = await addMissing(db.chapters, plan.chapters)
      const mainQuests = await addMissing(db.mainQuests, plan.mainQuests)
      const reviews = await addMissing(db.reviews, plan.reviews)
      const debts = await addMissing(db.debts, plan.debts)
      const savings = await addMissing(db.savings, plan.savings)

      let rules = false
      const profile = (await db.profile.get(DEFAULT_PROFILE.id)) ?? DEFAULT_PROFILE
      const changed = Object.fromEntries(
        Object.entries(plan.rules).filter(([k, v]) => JSON.stringify(v) !== JSON.stringify(DEFAULT_RULES[k as keyof typeof DEFAULT_RULES])),
      )
      const untouchedRules = Object.keys(profile.rules ?? {}).length === 0
      const defaultCapacity = JSON.stringify(profile.tentirCapacity) === JSON.stringify(DEFAULT_PROFILE.tentirCapacity)
      if ((untouchedRules && Object.keys(changed).length) || (defaultCapacity && plan.tentirCapacity)) {
        await db.profile.put({
          ...profile,
          id: DEFAULT_PROFILE.id,
          rules: untouchedRules ? changed : profile.rules,
          tentirCapacity: defaultCapacity && plan.tentirCapacity ? plan.tentirCapacity : profile.tentirCapacity,
          updatedAt: Date.now(),
        })
        rules = untouchedRules && Object.keys(changed).length > 0
      }
      return {
        days: days.added,
        daysSkipped: days.skipped,
        habits: habits.added,
        habitLogs: habitLogs.added,
        mutabaah: mutabaah.added,
        mutabaahLogs: mutabaahLogs.added,
        chapters: chapters.added,
        mainQuests: mainQuests.added,
        reviews: reviews.added,
        money: debts.added + savings.added,
        rules,
      }
    },
  )
}
