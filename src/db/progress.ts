import { levelFromXp } from '../domain/progress'
import { reviewXpTotal } from '../domain/weekly'
import type { ISODate } from '../types'
import { loadAllResults } from './daily'
import { db } from './db'

/** Total XP (hari + Muhasabah) dan level saat ini. */
export async function loadLevel(today: ISODate) {
  const [{ results, rules }, reviews] = await Promise.all([loadAllResults(today), db.reviews.where('period').equals('minggu').toArray()])
  const totalXp = [...results.values()].reduce((sum, r) => sum + r.xp, 0) + reviewXpTotal(reviews, rules)
  return { totalXp, ...levelFromXp(totalXp, rules) }
}
