import { useLiveQuery } from 'dexie-react-hooks'
import { useState } from 'react'
import { useToast } from '../../components/toast-context'
import { addTask, deleteTask, PatientIdentityError } from '../../db/daily'
import { db } from '../../db/db'
import { saveNote } from '../../db/notes'
import { DEFAULT_ROLE_ID } from '../../db/defaults'
import { roleLookup, useRoles } from '../../db/structure'
import { detectPatientIdentity } from '../../domain/phi'
import { guessRole, parseQuickTask } from '../../domain/quickCapture'
import { DEFAULT_TENTIR_RATE, parseTentir, sessionRange } from '../../domain/tentir'
import { dayKey, relativeDayLabel } from '../../domain/time'
import { deleteSession, loadTentirRate, saveSession } from '../../db/tentir'
import { deleteTransaction, loadCategories, saveTransaction } from '../../db/money'
import { categoryLookup, parseQuickMoney } from '../../domain/money'
import { formatNumber, formatRupiah } from '../../lib/format'

export type CaptureMode = 'tugas' | 'catatan' | 'uang' | 'tentir'

export const CAPTURE_MODES: { mode: CaptureMode; label: string; ready: boolean; placeholder: string }[] = [
  { mode: 'tugas', label: 'Tugas', ready: true, placeholder: 'Catat cepat… mis. “50 soal kardio besok”' },
  { mode: 'catatan', label: 'Catatan', ready: true, placeholder: 'Catatan singkat, tanpa identitas pasien' },
  { mode: 'uang', label: 'Uang', ready: true, placeholder: 'Uang… mis. “25rb makan siang”, “+500rb kiriman”' },
  { mode: 'tentir', label: 'Tentir', ready: true, placeholder: 'Sesi tentir… mis. “AB 2j anatomi 19.00 lunas”' },
]

/** Logika Catat cepat, dipakai kolom di atas (laptop/iPad) dan lembar + (HP). */
export function useQuickCapture(onSaved?: () => void) {
  const toast = useToast()
  const roles = useRoles()
  const [mode, setMode] = useState<CaptureMode>('tugas')
  const [text, setText] = useState('')
  const today = dayKey()
  const role = roleLookup(roles)

  const rate = useLiveQuery(loadTentirRate) ?? DEFAULT_TENTIR_RATE
  const categories = useLiveQuery(loadCategories)
  const parsed = mode === 'tugas' && text.trim() ? parseQuickTask(text, today, roles ?? []) : null
  const tentir = mode === 'tentir' && text.trim() ? parseTentir(text, today) : null
  const money = mode === 'uang' && text.trim() && categories ? parseQuickMoney(text, today, categories) : null
  const phi = text.trim() ? detectPatientIdentity(text) : null
  const preview = parsed
    ? [role(parsed.roleId ?? DEFAULT_ROLE_ID).name, relativeDayLabel(parsed.date, today), parsed.important ? 'penting' : null]
        .filter(Boolean)
        .join(' · ')
    : tentir
      ? [
          tentir.student || 'inisial?',
          relativeDayLabel(tentir.date, today),
          sessionRange(tentir) ?? `${formatNumber(tentir.hours, 1)} j`,
          formatRupiah(rate * tentir.hours),
          tentir.paid ? 'lunas' : null,
        ]
          .filter(Boolean)
          .join(' · ')
      : money
        ? [
            money.amount ? `${money.type === 'income' ? '+' : '−'}${formatRupiah(money.amount)}` : 'nominal?',
            categoryLookup(categories ?? [])(money.categoryId).name,
            relativeDayLabel(money.date, today),
          ].join(' · ')
        : null

  const submit = async () => {
    const value = text.trim()
    if (!value) return
    try {
      if (mode === 'tugas') {
        const p = parseQuickTask(value, today, roles ?? [])
        if (!p.title) return
        const task = await addTask({ title: p.title, roleId: p.roleId, date: p.date, important: p.important })
        toast({
          message: `Tugas tersimpan · ${role(task.roleId).name} · ${relativeDayLabel(task.date, today)}`,
          action: { label: 'Urungkan', onClick: () => void deleteTask(task.id) },
        })
      } else if (mode === 'catatan') {
        // Peran ditebak dari isi (mis. "fraktur" → Ortopedi), sama seperti Catat cepat tugas.
        const note = await saveNote({ text: value, roleId: guessRole(value, roles ?? []), color: null, pinned: false })
        toast({ message: 'Catatan tersimpan.', action: { label: 'Urungkan', onClick: () => void db.notes.delete(note.id) } })
      } else if (mode === 'tentir') {
        const t = parseTentir(value, today)
        if (!t.student) {
          toast({ message: 'Tulis inisial murid dengan huruf kapital, mis. “AB 2j anatomi”.', tone: 'warning' })
          return
        }
        const { id, overtime } = await saveSession({ ...t, fee: Math.round(rate * t.hours) })
        toast({
          message: `Sesi ${t.student} · ${relativeDayLabel(t.date, today)}${overtime ? ' · lewat 21.00, dicatat lembur' : ''}`,
          tone: overtime ? 'warning' : 'success',
          action: {
            label: 'Urungkan',
            onClick: () => void deleteSession(id),
          },
        })
      } else if (mode === 'uang') {
        const m = parseQuickMoney(value, today, categories ?? [])
        if (!m.amount) {
          toast({ message: 'Tulis nominalnya, mis. “25rb makan siang”.', tone: 'warning' })
          return
        }
        const tx = await saveTransaction({ amount: m.amount, type: m.type, categoryId: m.categoryId, date: m.date, note: m.note })
        toast({
          message: `${m.type === 'income' ? 'Pemasukan' : 'Pengeluaran'} ${formatRupiah(m.amount)} · ${categoryLookup(categories ?? [])(m.categoryId).name}`,
          action: { label: 'Urungkan', onClick: () => void deleteTransaction(tx.id) },
        })
      } else return
      setText('')
      onSaved?.()
    } catch (e) {
      toast({ message: e instanceof PatientIdentityError ? e.message : 'Gagal menyimpan.', tone: 'error', duration: 6000 })
    }
  }

  return { mode, setMode, text, setText, preview, phi, submit, ready: CAPTURE_MODES.find((m) => m.mode === mode)!.ready }
}
