import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import type { DXCUserInteraction } from 'dexie-cloud-addon'
import { describe, expect, it, vi } from 'vitest'
import { LoginView } from './LoginDialog'
import { translateAlert } from './messages'

const base = { submitLabel: 'Submit', cancelLabel: 'Cancel', onSubmit: vi.fn(), onCancel: vi.fn() }

describe('layar masuk', () => {
  it('langkah email berbahasa Indonesia dan mengirim email yang dirapikan', async () => {
    const onSubmit = vi.fn()
    const i = {
      ...base,
      onSubmit,
      type: 'email',
      title: 'Log in',
      alerts: [],
      fields: { email: { type: 'text', placeholder: 'you@x.com' } },
    } as DXCUserInteraction
    render(<LoginView interaction={i} />)
    expect(screen.getByRole('heading', { name: 'Masuk ke Qawwam' })).toBeInTheDocument()
    const button = screen.getByRole('button', { name: 'Kirim kode' })
    expect(button).toBeDisabled()
    await userEvent.type(screen.getByLabelText('Email'), '  rifqi@gmail.com ')
    await userEvent.click(button)
    expect(onSubmit).toHaveBeenCalledWith({ email: 'rifqi@gmail.com' })
  })

  it('langkah kode menampilkan pesan kode terkirim dan kode salah', async () => {
    const onSubmit = vi.fn()
    const i = {
      ...base,
      onSubmit,
      type: 'otp',
      title: 'Enter OTP',
      fields: { otp: { type: 'text', label: 'OTP' } },
      alerts: [
        { type: 'info', messageCode: 'OTP_SENT', message: 'sent to {email}', messageParams: { email: 'rifqi@gmail.com' } },
        { type: 'error', messageCode: 'INVALID_OTP', message: 'Invalid OTP', messageParams: {} },
      ],
    } as DXCUserInteraction
    render(<LoginView interaction={i} />)
    expect(screen.getByText(/Kode masuk dikirim ke rifqi@gmail.com/)).toBeInTheDocument()
    expect(screen.getByRole('alert')).toHaveTextContent('Kode salah atau sudah kedaluwarsa')
    await userEvent.type(screen.getByLabelText('Kode dari email'), 'V6A7KMRF')
    await userEvent.click(screen.getByRole('button', { name: 'Masuk' }))
    expect(onSubmit).toHaveBeenCalledWith({ otp: 'V6A7KMRF' })
  })

  it('batal memanggil onCancel', async () => {
    const onCancel = vi.fn()
    const i = { ...base, onCancel, type: 'logout-confirmation', title: 'Confirm', fields: {}, alerts: [] } as unknown as DXCUserInteraction
    render(<LoginView interaction={i} />)
    await userEvent.click(screen.getByRole('button', { name: 'Batal' }))
    expect(onCancel).toHaveBeenCalled()
  })

  it('kode pesan tak dikenal memakai pesan aslinya', () => {
    expect(translateAlert({ messageCode: 'GENERIC_ERROR', message: 'Server {x} down', messageParams: { x: 'A' } })).toBe('Server A down')
    expect(translateAlert({ messageCode: 'LOGOUT_CONFIRMATION', message: '', messageParams: { numUnsyncedChanges: '3' } })).toMatch(
      /^3 perubahan/,
    )
  })
})
