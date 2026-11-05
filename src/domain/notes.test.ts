import { describe, expect, it } from 'vitest'
import type { Note } from '../types'
import { filterNotes, noteTitle } from './notes'

const n = (id: string, text: string, roleId: string | null, pinned = false, updatedAt = 1): Note => ({
  id,
  text,
  roleId,
  color: null,
  pinned,
  createdAt: 0,
  updatedAt,
})

describe('catatan', () => {
  it('judul dari baris pertama', () => {
    expect(noteTitle('  Ide tentir paket\nisi lain')).toBe('Ide tentir paket')
    expect(noteTitle('x'.repeat(100))).toHaveLength(80)
  })
  it('cari semua kata, filter peran, sematan di atas', () => {
    const list = [
      n('a', 'Fraktur femur: klasifikasi Garden', '#role:orto', false, 3),
      n('b', 'Paket tentir blok 12', '#role:tentir', true, 1),
      n('c', 'Ide konten', null, false, 2),
    ]
    expect(filterNotes(list, '', null).map((x) => x.id)).toEqual(['b', 'a', 'c'])
    expect(filterNotes(list, 'GARDEN fraktur', null).map((x) => x.id)).toEqual(['a'])
    expect(filterNotes(list, '', '#role:tentir').map((x) => x.id)).toEqual(['b'])
    expect(filterNotes(list, '', 'tanpa').map((x) => x.id)).toEqual(['c'])
  })
})
