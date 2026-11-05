/**
 * Meminta browser menyimpan data secara persisten agar IndexedDB tidak mudah
 * dihapus otomatis saat ruang penyimpanan menipis. Aman diabaikan bila tidak didukung.
 */
export async function requestPersistentStorage(): Promise<boolean> {
  try {
    if (!navigator.storage?.persist) return false
    if (await navigator.storage.persisted()) return true
    return await navigator.storage.persist()
  } catch {
    return false
  }
}
