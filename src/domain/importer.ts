import type { Chapter, DayType, ISODate, RitmeSlot, XpSize } from '../types'
import { DAY_TYPES } from './dayType'
import { detectPatientIdentity } from './phi'
import { guessRole, matchRole, type RoleRef } from './quickCapture'
import { normalizeClock } from './ritme'
import { formatDateShort, isValidISODate, MONTH_NAMES } from './time'

export type ImportKind = 'ritme' | 'habit' | 'tugas' | 'jaga' | 'stase'

export const IMPORT_KINDS: ImportKind[] = ['ritme', 'habit', 'tugas', 'jaga', 'stase']

export const IMPORT_KIND_LABELS: Record<ImportKind, string> = {
  ritme: 'Ritme harian',
  habit: 'Habit / latihan',
  tugas: 'Tugas',
  jaga: 'Jadwal jaga',
  stase: 'Stase',
}

export type ImportItem =
  | { kind: 'ritme'; dayType: DayType; slot: RitmeSlot }
  | {
      kind: 'habit'
      name: string
      weekdays: number[]
      dayTypes: DayType[]
      minutes: number | null
      size: XpSize
      roleId: string
      note?: string
    }
  | { kind: 'tugas'; title: string; date: ISODate; roleId: string; important: boolean }
  | { kind: 'jaga'; date: ISODate }
  | { kind: 'stase'; name: string; start: ISODate; end: ISODate; masuk?: string; pulang?: string; weight: Chapter['weight'] }

export interface ImportRow {
  /** Nomor baris di teks asli (CSV) atau urutan item (JSON), mulai 1. */
  line: number
  item?: ImportItem
  error?: string
  /** Alasan bila mirip identitas pasien: baris tidak boleh diimpor. */
  phi?: string
}

export interface ImportContext {
  roles: RoleRef[]
  today: ISODate
  /** Jenis untuk baris tanpa kolom `jenis`. */
  defaultKind?: ImportKind
}

type Rec = Record<string, string>

// ---------- Kolom & nilai ----------

const COLUMN_ALIASES: Record<string, string> = {
  jenis: 'jenis',
  tipe: 'jenis',
  kategori: 'jenis',
  tipe_hari: 'tipe_hari',
  tipehari: 'tipe_hari',
  day_type: 'tipe_hari',
  tanggal: 'tanggal',
  tgl: 'tanggal',
  date: 'tanggal',
  hari: 'hari',
  days: 'hari',
  jam: 'jam',
  jam_mulai: 'jam',
  waktu: 'jam',
  mulai_jam: 'jam',
  sampai: 'sampai',
  jam_selesai: 'sampai',
  selesai_jam: 'sampai',
  judul: 'judul',
  nama: 'judul',
  kegiatan: 'judul',
  title: 'judul',
  peran: 'peran',
  role: 'peran',
  menit: 'menit',
  durasi: 'menit',
  ukuran: 'ukuran',
  xp: 'ukuran',
  penting: 'penting',
  catatan: 'catatan',
  keterangan: 'catatan',
  detail: 'catatan',
  mulai: 'mulai',
  selesai: 'selesai',
  masuk: 'masuk',
  pulang: 'pulang',
  bobot: 'bobot',
  kerja: 'kerja',
}

const normKey = (k: string) =>
  k
    .trim()
    .toLowerCase()
    .replace(/[\s-]+/g, '_')
    .replace(/[^a-z_]/g, '')

const KIND_ALIASES: Record<string, ImportKind> = {
  ritme: 'ritme',
  jadwal: 'ritme',
  jadwal_harian: 'ritme',
  jadwalharian: 'ritme',
  habit: 'habit',
  rutin: 'habit',
  latihan: 'habit',
  program: 'habit',
  tugas: 'tugas',
  task: 'tugas',
  todo: 'tugas',
  jaga: 'jaga',
  jadwal_jaga: 'jaga',
  stase: 'stase',
  rotasi: 'stase',
}

const DAY_TYPE_ALIASES: Record<string, DayType> = {
  stase: 'stase',
  dinas: 'stase',
  kerja: 'stase',
  jaga: 'jaga',
  jaga_malam: 'jaga',
  pasca: 'pasca',
  pasca_jaga: 'pasca',
  pascajaga: 'pasca',
  libur: 'libur',
  off: 'libur',
}

const WEEKDAY_WORDS: Record<string, number> = {
  min: 0,
  minggu: 0,
  ahad: 0,
  sun: 0,
  sunday: 0,
  sen: 1,
  senin: 1,
  mon: 1,
  monday: 1,
  sel: 2,
  selasa: 2,
  tue: 2,
  tuesday: 2,
  rab: 3,
  rabu: 3,
  wed: 3,
  wednesday: 3,
  kam: 4,
  kamis: 4,
  thu: 4,
  thursday: 4,
  jum: 5,
  jumat: 5,
  fri: 5,
  friday: 5,
  sab: 6,
  sabtu: 6,
  sat: 6,
  saturday: 6,
}

const yes = (v: string) => /^(ya|y|yes|true|1|penting|!+)$/i.test(v.trim())

/** "Sen, Rab, Jum" · "Senin-Jumat" · "setiap hari" → hari dalam minggu (kosong = setiap hari). */
export function parseWeekdays(value: string): number[] | null {
  const v = value.trim().toLowerCase()
  if (!v || /^(setiap|tiap|semua)\s*hari$|^harian$|^daily$/.test(v)) return []
  const result = new Set<number>()
  for (const part of v.split(/[,;/&+]|\s+dan\s+|\s+/).filter(Boolean)) {
    const range = /^([a-z]+)[–-]([a-z]+)$/.exec(part)
    if (range) {
      const a = WEEKDAY_WORDS[range[1]]
      const b = WEEKDAY_WORDS[range[2]]
      if (a === undefined || b === undefined) return null
      // Urutan Senin..Minggu agar "Sen-Min" mencakup seminggu.
      const order = [1, 2, 3, 4, 5, 6, 0]
      const ia = order.indexOf(a)
      const ib = order.indexOf(b)
      if (ia > ib) return null
      for (let i = ia; i <= ib; i++) result.add(order[i])
      continue
    }
    const d = WEEKDAY_WORDS[part.replace(/[^a-z]/g, '')]
    if (d === undefined) return null
    result.add(d)
  }
  return [...result].sort((x, y) => x - y)
}

const MONTHS = MONTH_NAMES.map((m) => m.toLowerCase())

/** "2026-11-12" · "12/11/2026" · "12-11" · "12 Nov 2026" · "12 november" → ISO. Tahun kosong = tahun ini. */
export function parseDate(value: string, today: ISODate): ISODate | null {
  const v = value.trim().toLowerCase()
  if (isValidISODate(v)) return v
  const year = Number(today.slice(0, 4))
  let d: number
  let m: number
  let y: number
  let match: RegExpExecArray | null
  if ((match = /^(\d{1,2})[/.-](\d{1,2})(?:[/.-](\d{2,4}))?$/.exec(v))) {
    d = Number(match[1])
    m = Number(match[2])
    y = match[3] ? Number(match[3].length === 2 ? `20${match[3]}` : match[3]) : year
  } else if ((match = /^(\d{1,2})\s+([a-z]+)\.?(?:\s+(\d{4}))?$/.exec(v))) {
    d = Number(match[1])
    const idx = MONTHS.findIndex((name) => name.startsWith(match![2].slice(0, 3)))
    if (idx < 0) return null
    m = idx + 1
    y = match[3] ? Number(match[3]) : year
  } else return null
  const iso = `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`
  return isValidISODate(iso) ? iso : null
}

function parseDayTypes(value: string): DayType[] | null {
  const v = value.trim().toLowerCase()
  if (/^(semua|setiap|all)/.test(v)) return [...DAY_TYPES]
  const out: DayType[] = []
  for (const part of v
    .split(/[,;/&+]|\s+dan\s+/)
    .map((p) => normKey(p))
    .filter(Boolean)) {
    const t = DAY_TYPE_ALIASES[part]
    if (!t) return null
    if (!out.includes(t)) out.push(t)
  }
  return out
}

// ---------- Format teks ----------

/** Pisah CSV/TSV dengan dukungan tanda kutip ("a, b"). */
export function parseDelimited(text: string): string[][] {
  const lines = text.replace(/\r\n?/g, '\n')
  const first = lines.split('\n').find((l) => l.trim()) ?? ''
  const delim = first.includes('\t') ? '\t' : (first.match(/;/g)?.length ?? 0) > (first.match(/,/g)?.length ?? 0) ? ';' : ','
  const rows: string[][] = []
  let row: string[] = []
  let cell = ''
  let quoted = false
  for (let i = 0; i < lines.length; i++) {
    const c = lines[i]
    if (quoted) {
      if (c === '"' && lines[i + 1] === '"') {
        cell += '"'
        i++
      } else if (c === '"') quoted = false
      else cell += c
    } else if (c === '"' && cell === '') quoted = true
    else if (c === delim) {
      row.push(cell)
      cell = ''
    } else if (c === '\n') {
      row.push(cell)
      rows.push(row)
      row = []
      cell = ''
    } else cell += c
  }
  row.push(cell)
  rows.push(row)
  return rows
}

/** Ambil JSON dari balasan Claude (boleh dibungkus ```json … ```). */
function extractJson(text: string): unknown | undefined {
  const fenced = /```(?:json)?\s*([\s\S]*?)```/i.exec(text)
  const body = (fenced ? fenced[1] : text).trim()
  if (!/^[[{]/.test(body)) return undefined
  try {
    return JSON.parse(body)
  } catch {
    return undefined
  }
}

const toRec = (o: Record<string, unknown>): Rec => {
  const r: Rec = {}
  for (const [k, v] of Object.entries(o)) {
    const key = COLUMN_ALIASES[normKey(k)]
    if (!key || v == null) continue
    r[key] = Array.isArray(v) ? v.join(', ') : typeof v === 'boolean' ? (v ? 'ya' : '') : String(v)
  }
  return r
}

// ---------- Baris → item ----------

function rowToItems(r: Rec, ctx: ImportContext): { items?: ImportItem[]; error?: string } {
  const kind = r.jenis ? KIND_ALIASES[normKey(r.jenis)] : ctx.defaultKind
  if (!kind) return { error: r.jenis ? `Jenis "${r.jenis}" tidak dikenal (pakai: ${IMPORT_KINDS.join(', ')}).` : 'Kolom "jenis" kosong.' }
  const title = (r.judul ?? '').trim()
  const role = (fallback: string | null) => (r.peran ? matchRole(r.peran, ctx.roles) : null) ?? guessRole(title, ctx.roles) ?? fallback

  switch (kind) {
    case 'ritme': {
      const types = parseDayTypes(r.tipe_hari ?? '')
      if (!types?.length) return { error: 'Ritme butuh "tipe_hari" (stase, jaga, pasca, libur, atau semua).' }
      const time = normalizeClock(r.jam ?? '')
      if (!time) return { error: `Jam "${r.jam ?? ''}" tidak dikenali (contoh 06.00).` }
      if (!title) return { error: 'Judul kegiatan kosong.' }
      const until = r.sampai ? normalizeClock(r.sampai) : null
      if (r.sampai && !until) return { error: `Jam selesai "${r.sampai}" tidak dikenali.` }
      const roleId = r.peran && /^(ibadah|-|tanpa)/i.test(r.peran.trim()) ? null : role(null)
      const slot: RitmeSlot = {
        time,
        title,
        ...(until ? { until } : {}),
        ...(r.catatan?.trim() ? { note: r.catatan.trim() } : {}),
        ...(roleId ? { roleId } : {}),
        ...(yes(r.kerja ?? '') || /^stase$/i.test(title) ? { work: true } : {}),
      }
      return { items: types.map((dayType) => ({ kind, dayType, slot })) }
    }
    case 'habit': {
      if (!title) return { error: 'Nama habit kosong.' }
      const weekdays = parseWeekdays(r.hari ?? '')
      if (!weekdays) return { error: `Hari "${r.hari}" tidak dikenali (contoh: Sen, Rab, Jum).` }
      const dayTypes = r.tipe_hari ? parseDayTypes(r.tipe_hari) : ['stase', 'libur']
      if (!dayTypes?.length) return { error: `Tipe hari "${r.tipe_hari}" tidak dikenali.` }
      const minutes = r.menit ? Math.round(Number(r.menit.replace(',', '.').replace(/[^\d.]/g, ''))) : null
      if (r.menit && !(minutes && minutes > 0 && minutes <= 600)) return { error: `Menit "${r.menit}" tidak valid.` }
      const size = (['kecil', 'sedang', 'besar'] as const).find((s) => s === (r.ukuran ?? '').trim().toLowerCase()) ?? 'sedang'
      return {
        items: [
          {
            kind,
            name: title,
            weekdays,
            dayTypes: dayTypes as DayType[],
            minutes,
            size,
            roleId: role('#role:pulih') as string,
            ...(r.catatan?.trim() ? { note: r.catatan.trim() } : {}),
          },
        ],
      }
    }
    case 'tugas': {
      if (!title) return { error: 'Judul tugas kosong.' }
      const date = parseDate(r.tanggal ?? '', ctx.today)
      if (!date) return { error: `Tanggal "${r.tanggal ?? ''}" tidak dikenali (contoh 2026-11-12 atau 12/11).` }
      return { items: [{ kind, title, date, roleId: role('#role:koas') as string, important: yes(r.penting ?? '') }] }
    }
    case 'jaga': {
      const date = parseDate(r.tanggal ?? '', ctx.today)
      if (!date) return { error: `Tanggal jaga "${r.tanggal ?? ''}" tidak dikenali.` }
      return { items: [{ kind, date }] }
    }
    case 'stase': {
      if (!title) return { error: 'Nama stase kosong.' }
      const start = parseDate(r.mulai ?? '', ctx.today)
      const end = parseDate(r.selesai ?? '', ctx.today)
      if (!start || !end) return { error: 'Stase butuh tanggal "mulai" dan "selesai".' }
      if (end < start) return { error: 'Tanggal selesai stase sebelum tanggal mulai.' }
      const masuk = r.masuk ? normalizeClock(r.masuk) : null
      const pulang = r.pulang ? normalizeClock(r.pulang) : null
      if ((r.masuk && !masuk) || (r.pulang && !pulang)) return { error: 'Jam masuk/pulang tidak dikenali.' }
      const weight = (['ringan', 'sedang', 'berat'] as const).find((w) => w === (r.bobot ?? '').trim().toLowerCase()) ?? 'sedang'
      return { items: [{ kind, name: title, start, end, weight, ...(masuk ? { masuk } : {}), ...(pulang ? { pulang } : {}) }] }
    }
  }
}

/**
 * Teks yang ditempel (JSON dari Claude, sel Google Sheets, atau CSV) → baris pratinjau.
 * Tidak menulis apa pun; penulisan terjadi setelah pengguna menyetujui pratinjau.
 */
export function parseImport(text: string, ctx: ImportContext): ImportRow[] {
  if (!text.trim()) return []
  const json = extractJson(text)
  let records: { line: number; rec: Rec }[]
  if (json !== undefined) {
    const list = Array.isArray(json)
      ? json
      : Array.isArray((json as { items?: unknown }).items)
        ? (json as { items: unknown[] }).items
        : null
    if (!list) return [{ line: 1, error: 'JSON harus berupa daftar atau berisi "items".' }]
    records = list.map((o, i) => ({ line: i + 1, rec: o && typeof o === 'object' ? toRec(o as Record<string, unknown>) : {} }))
  } else {
    const rows = parseDelimited(text)
    const headerIdx = rows.findIndex((r) => r.some((c) => c.trim()))
    const header = rows[headerIdx].map((h) => COLUMN_ALIASES[normKey(h)] ?? '')
    if (!header.some(Boolean)) return [{ line: headerIdx + 1, error: 'Baris pertama harus nama kolom (mis. jenis, tanggal, judul).' }]
    records = rows
      .slice(headerIdx + 1)
      .map((cells, i) => ({ line: headerIdx + i + 2, cells }))
      .filter(({ cells }) => cells.some((c) => c.trim()))
      .map(({ line, cells }) => {
        const rec: Rec = {}
        header.forEach((key, j) => {
          if (key && cells[j]?.trim()) rec[key] = cells[j].trim()
        })
        return { line, rec }
      })
  }
  const out: ImportRow[] = []
  for (const { line, rec } of records) {
    const phi = detectPatientIdentity([rec.judul, rec.catatan].filter(Boolean).join(' · '))
    const { items, error } = rowToItems(rec, ctx)
    if (error || !items) out.push({ line, error: error ?? 'Baris tidak bisa dibaca.' })
    else for (const item of items) out.push({ line, item, ...(phi ? { phi } : {}) })
  }
  return out
}

/** Ringkasan satu item untuk pratinjau. */
export function describeItem(item: ImportItem, roleName: (id: string | undefined) => string): string {
  const days = (w: number[]) => (w.length ? w.map((d) => ['Min', 'Sen', 'Sel', 'Rab', 'Kam', 'Jum', 'Sab'][d]).join(', ') : 'setiap hari')
  switch (item.kind) {
    case 'ritme':
      return `${item.slot.time}${item.slot.until ? `–${item.slot.until}` : ''} ${item.slot.title}${item.slot.roleId ? ` · ${roleName(item.slot.roleId)}` : ''}`
    case 'habit':
      return `${item.name} · ${days(item.weekdays)}${item.minutes ? ` · ${item.minutes} mnt` : ''} · ${roleName(item.roleId)}`
    case 'tugas':
      return `${formatDateShort(item.date)} · ${item.title} · ${roleName(item.roleId)}${item.important ? ' · penting' : ''}`
    case 'jaga':
      return `Jaga malam ${formatDateShort(item.date)}`
    case 'stase':
      return `${item.name} · ${formatDateShort(item.start)} – ${formatDateShort(item.end)}${item.masuk || item.pulang ? ` · ${item.masuk ?? '?'}–${item.pulang ?? '?'}` : ''}`
  }
}
