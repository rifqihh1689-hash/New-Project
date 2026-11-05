import type { ISODate } from '../types'
import { addDays, weekday } from './time'

export interface ParsedTask {
  title: string
  date: ISODate
  /** ID peran dari tagar atau tebakan kata kunci; `null` = pakai peran bawaan. */
  roleId: string | null
  important: boolean
}

interface RoleRef {
  id: string
  name: string
  archived?: boolean
}

/** Tebakan peran dari kata kunci, hanya untuk peran bawaan. Tagar (#ukmppd) selalu menang. */
const ROLE_KEYWORDS: Record<string, RegExp> = {
  '#role:ukmppd': /\b(soal|tryout|ukmppd|bank soal|osce|cbt|mini ?to)\b/i,
  '#role:orto': /\b(systematic review|sr|ielts|jurnal|abstrak|ppds|portofolio|ortopedi|orto|toefl)\b/i,
  '#role:tentir': /\b(tentir|murid|les|materi tentir)\b/i,
  '#role:pulih': /\b(tidur|qailulah|olahraga|gym|lari|jalan kaki|stretching|makan sehat|latihan beban)\b/i,
  '#role:uang': /\b(bayar|transfer|tagihan|kos|belanja|utang|nabung|tabung|token listrik|pulsa)\b/i,
  '#role:koas': /\b(bangsal|follow ?up|fu|laporan|logbook|presentasi|referat|refleksi kasus|visite|poli|jaga|stase|lapsus|case report)\b/i,
}

const DAY_WORDS = ['minggu', 'senin', 'selasa', 'rabu', 'kamis', 'jumat', 'sabtu']

const normalize = (s: string) =>
  s
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]/g, '')

/**
 * Catat cepat → tugas. Contoh: "50 soal kardio besok" → tugas UKMPPD untuk besok.
 * - Tanggal: "hari ini", "besok", "lusa", nama hari (hari itu berikutnya, 1–7 hari ke depan).
 * - Peran: tagar nama peran (`#ukmppd`, `#orto`), atau tebakan kata kunci.
 * - Penting: `!` atau kata "penting".
 */
export function parseQuickTask(input: string, today: ISODate, roles: RoleRef[]): ParsedTask {
  let text = ` ${input.trim()} `
  let date = today
  let important = false
  let roleId: string | null = null

  const take = (re: RegExp): RegExpExecArray | null => {
    const m = re.exec(text)
    if (m) text = text.slice(0, m.index) + ' ' + text.slice(m.index + m[0].length)
    return m
  }

  if (take(/\s(!+|penting)(?=\s)/i)) important = true

  if (take(/\s(hari ini|hr ini)(?=\s)/i)) date = today
  else if (take(/\s(besok|bsk)(?=\s)/i)) date = addDays(today, 1)
  else if (take(/\s(lusa)(?=\s)/i)) date = addDays(today, 2)
  else {
    const m = take(new RegExp(`\\s(?:hari\\s+)?(${DAY_WORDS.join('|')})(?=\\s)`, 'i'))
    if (m) {
      const target = DAY_WORDS.indexOf(m[1].toLowerCase())
      const delta = (target - weekday(today) + 7) % 7 || 7
      date = addDays(today, delta)
    }
  }

  const active = roles.filter((r) => !r.archived)
  const tag = take(/\s#([\p{L}\p{N}&_-]+)(?=\s)/u)
  if (tag) {
    const key = normalize(tag[1])
    const found = active.find((r) => normalize(r.name).startsWith(key) || normalize(r.id.replace(/^#role:/, '')) === key)
    if (found) roleId = found.id
  }

  const title = text.replace(/\s+/g, ' ').trim()
  if (!roleId) {
    for (const [id, re] of Object.entries(ROLE_KEYWORDS)) {
      if (re.test(title) && active.some((r) => r.id === id)) {
        roleId = id
        break
      }
    }
  }
  return { title: title.charAt(0).toUpperCase() + title.slice(1), date, roleId, important }
}
