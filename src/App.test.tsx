import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it } from 'vitest'
import App from './App'
import { db } from './db/db'
import { resetDatabase } from './test/db-utils'

beforeEach(resetDatabase)

describe('App', () => {
  it('membuka Beranda dengan pemilih tipe hari', async () => {
    render(<App />)
    expect(await screen.findByText(/Hari ini tipe apa\?|Kemarin jaga/)).toBeInTheDocument()
    expect(screen.getAllByRole('radiogroup', { name: 'Tipe hari' })[0]).toBeInTheDocument()
  })

  it('memilih tipe hari menyimpan ke database dan mengubah kalimat pembuka', async () => {
    const user = userEvent.setup()
    render(<App />)
    const picker = (await screen.findAllByRole('radiogroup', { name: 'Tipe hari' }))[0]
    await user.click(within(picker).getByRole('radio', { name: /Libur/ }))
    expect(await screen.findByText(/Libur\. Satu blok belajar panjang/)).toBeInTheDocument()
    const days = await db.days.toArray()
    expect(days[0].type).toBe('libur')
  })

  it('Catat cepat menambah tugas dengan peran & tanggal dari teks', async () => {
    const user = userEvent.setup()
    render(<App />)
    const input = (await screen.findAllByLabelText('Catat cepat'))[0]
    await user.type(input, '50 soal kardio besok{Enter}')
    expect(await screen.findByText(/Tugas tersimpan · UKMPPD · Besok/)).toBeInTheDocument()
    const [task] = await db.tasks.toArray()
    expect(task).toMatchObject({ title: '50 soal kardio', roleId: '#role:ukmppd' })
  })
})
