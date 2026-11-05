import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import App from './App'

describe('App', () => {
  it('menampilkan nama aplikasi', () => {
    render(<App />)
    expect(screen.getByText('Qawwam')).toBeInTheDocument()
  })
})
