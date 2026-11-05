import type { DompetkuPlan } from '../domain/dompetku'
import { db } from './db'
import { addMissing } from './mbappe'

/** Menulis impor Dompetku. Data yang sudah ada di Qawwam (ID sama) tidak ditimpa, jadi aman diulang. */
export async function applyDompetku(plan: DompetkuPlan) {
  return db.transaction('rw', [db.categories, db.transactions, db.budgets, db.recurring], async () => {
    const categories = await addMissing(db.categories, plan.categories)
    const transactions = await addMissing(db.transactions, plan.transactions)
    const budgets = await addMissing(db.budgets, plan.budgets)
    const recurring = await addMissing(db.recurring, plan.recurring)
    return { categories, transactions, budgets, recurring }
  })
}
