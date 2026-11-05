import { db } from '../db/db'

/** Mengosongkan semua tabel agar setiap tes mulai dari keadaan awal. */
export async function resetDatabase(): Promise<void> {
  await db.open()
  await Promise.all(db.tables.filter((t) => !t.name.startsWith('$')).map((t) => t.clear()))
}
