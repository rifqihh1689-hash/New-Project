import type { DXCAlert } from 'dexie-cloud-addon'

/** Terjemahan pesan Dexie Cloud berdasarkan `messageCode`. Kode tak dikenal memakai pesan aslinya. */
const ALERTS: Partial<Record<DXCAlert['messageCode'], string>> = {
  OTP_SENT: 'Kode masuk dikirim ke {email}. Cek juga folder Spam atau Promosi.',
  INVALID_OTP: 'Kode salah atau sudah kedaluwarsa. Coba lagi, atau minta kode baru.',
  INVALID_EMAIL: 'Format email belum benar.',
  LICENSE_LIMIT_REACHED: 'Batas pengguna paket Dexie Cloud sudah tercapai.',
  NO_SEATS_AVAILABLE: 'Batas pengguna paket Dexie Cloud sudah tercapai.',
  USER_NOT_REGISTERED: 'Email ini belum terdaftar di database Qawwam.',
  USER_NOT_ACCEPTED: 'Email ini belum diizinkan masuk ke database Qawwam.',
  USER_DEACTIVATED: 'Akun ini sedang dinonaktifkan.',
  LOGOUT_CONFIRMATION: '{numUnsyncedChanges} perubahan belum tersinkron akan hilang dari perangkat ini.',
}

const fill = (template: string, params: Record<string, string>) => template.replace(/\{(\w+)\}/g, (_, k: string) => params[k] ?? '')

export function translateAlert(alert: Pick<DXCAlert, 'messageCode' | 'message' | 'messageParams'>): string {
  const template = ALERTS[alert.messageCode] ?? alert.message
  return fill(template, alert.messageParams ?? {})
}
