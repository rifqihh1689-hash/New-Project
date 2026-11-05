/**
 * ID acak global untuk baris baru, berawalan nama tabel (`tsk_…`).
 * Dexie Cloud menerima ID buatan aplikasi asalkan acak dan unik secara global.
 */
export function createId(prefix: string): string {
  const raw =
    typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
      ? crypto.randomUUID().replace(/-/g, '')
      : `${Date.now().toString(36)}${Math.random().toString(36).slice(2)}${Math.random().toString(36).slice(2)}`
  return `${prefix}_${raw}`
}

/** ID privat deterministik: satu baris per kunci alami per pengguna (lihat `types.ts`). */
export const privateId = {
  profile: () => '#profile',
  day: (date: string) => `#day:${date}`,
  habitLog: (habitId: string, date: string) => `#hl:${habitId}:${date}`,
  mutabaahLog: (itemId: string, date: string) => `#ml:${itemId}:${date}`,
  budget: (month: string, categoryId: string) => `#bud:${month}:${categoryId}`,
  weeklyReview: (monday: string) => `#rev:minggu:${monday}`,
  monthlyReview: (month: string) => `#rev:bulan:${month}`,
}
