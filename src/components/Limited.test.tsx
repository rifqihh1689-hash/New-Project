import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { Limited } from './Limited'

const List = ({ n, limit }: { n: number; limit?: number }) => (
  <Limited items={Array.from({ length: n }, (_, i) => i + 1)} limit={limit}>
    {(shown) => (
      <ul>
        {shown.map((x) => (
          <li key={x}>item {x}</li>
        ))}
      </ul>
    )}
  </Limited>
)

describe('Limited', () => {
  it('tanpa tombol bila daftar tidak melebihi batas', () => {
    render(<List n={3} limit={5} />)
    expect(screen.getAllByRole('listitem')).toHaveLength(3)
    expect(screen.queryByRole('button')).toBeNull()
  })

  it('menampilkan batas dulu, semua lewat tombol, lalu bisa diringkas lagi', () => {
    render(<List n={12} limit={5} />)
    expect(screen.getAllByRole('listitem')).toHaveLength(5)
    fireEvent.click(screen.getByRole('button', { name: 'Tampilkan semua (12)' }))
    expect(screen.getAllByRole('listitem')).toHaveLength(12)
    fireEvent.click(screen.getByRole('button', { name: 'Tampilkan lebih sedikit' }))
    expect(screen.getAllByRole('listitem')).toHaveLength(5)
  })
})
