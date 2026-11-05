import type { Note } from '../types'

/** Warna kartu catatan (strip atas), selaras dengan warna peran. */
export const NOTE_COLORS: { key: string; label: string; hex: string }[] = [
  { key: 'kuning', label: 'Kuning', hex: '#d4ad45' },
  { key: 'hijau', label: 'Hijau', hex: '#4cb782' },
  { key: 'biru', label: 'Biru', hex: '#5b8def' },
  { key: 'ungu', label: 'Ungu', hex: '#9b7bea' },
  { key: 'oranye', label: 'Oranye', hex: '#e8925b' },
  { key: 'merah', label: 'Merah', hex: '#e34948' },
  { key: 'tosca', label: 'Tosca', hex: '#3bb5c4' },
]

/** Baris pertama sebagai judul (maks. 80 karakter). */
export function noteTitle(text: string): string {
  const first = text.trim().split('\n')[0]?.trim() ?? ''
  return first.length > 80 ? `${first.slice(0, 79)}…` : first
}

/**
 * Saring & urutkan catatan: semua kata kunci harus ada (tanpa beda huruf besar),
 * peran `null` = semua, `'tanpa'` = tanpa peran. Disematkan di atas, lalu yang terakhir diubah.
 */
export function filterNotes(notes: Note[], query: string, roleId: string | null): Note[] {
  const words = query.toLowerCase().split(/\s+/).filter(Boolean)
  return notes
    .filter((n) => roleId == null || (roleId === 'tanpa' ? !n.roleId : n.roleId === roleId))
    .filter((n) => words.every((w) => n.text.toLowerCase().includes(w)))
    .sort((a, b) => Number(b.pinned) - Number(a.pinned) || b.updatedAt - a.updatedAt)
}
