import { describe, expect, it, vi } from 'vitest'
import { dexieStore, type Env } from './dexie'
import worker, { sameKey } from './index'
import { handleMcp } from './mcp'

const OWNER = 'pemilik@contoh.id'
const KEY = 'k'.repeat(32)
const env: Env = {
  DEXIE_DB_URL: 'https://db.contoh.dexie.cloud',
  DEXIE_CLIENT_ID: 'id',
  DEXIE_CLIENT_SECRET: 'rahasia',
  OWNER_EMAIL: OWNER,
  CONNECTOR_KEY: KEY,
}
// Kamis 5 Nov 2026, 10.00 WIB.
const NOW = Date.UTC(2026, 10, 5, 3, 0)

/** Dexie Cloud palsu: bentuk data seperti di server (ID privat bersufiks userId, owner/realmId, $$ts). */
function fakeCloud(tables: Record<string, Record<string, unknown>[]>) {
  const cloud = (row: Record<string, unknown>, owner = OWNER) => ({
    ...row,
    id: String(row.id).startsWith('#') ? `${row.id}:${owner}` : row.id,
    owner,
    realmId: owner,
    $$ts: 1,
  })
  const data: Record<string, Record<string, unknown>[]> = {}
  for (const [t, rows] of Object.entries(tables)) data[t] = rows.map((r) => cloud(r))
  const posted: { table: string; rows: Record<string, unknown>[] }[] = []
  let tokens = 0
  const fetchFn = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = new URL(String(input))
    if (url.pathname === '/token') {
      tokens++
      const body = JSON.parse(String(init?.body))
      if (body.client_secret !== 'rahasia') return new Response('no', { status: 401 })
      return Response.json({ type: 'tokens', accessToken: 'tok', accessTokenExpiration: NOW + 3600_000 + Date.now() })
    }
    expect(new Headers(init?.headers).get('authorization')).toBe('Bearer tok')
    const table = decodeURIComponent(url.pathname.replace('/all/', ''))
    if (init?.method === 'POST') {
      const rows = JSON.parse(String(init.body))
      posted.push({ table, rows })
      return new Response(null, { status: 200 })
    }
    if (!data[table]) return new Response(`Primary key for table '${table}' not known. Please let a client sync`, { status: 422 })
    return Response.json(data[table])
  })
  return { fetchFn, posted, data, cloud, tokenCount: () => tokens }
}

let nextId = 1
const rpc = (method: string, params?: Record<string, unknown>) =>
  new Request('https://w.example/mcp/x', {
    method: 'POST',
    headers: { 'content-type': 'application/json', accept: 'application/json, text/event-stream' },
    body: JSON.stringify({ jsonrpc: '2.0', id: nextId++, method, params }),
  })

async function call(c: ReturnType<typeof fakeCloud>, name: string, args: Record<string, unknown> = {}) {
  const res = await handleMcp(rpc('tools/call', { name, arguments: args }), { store: dexieStore(env, c.fetchFn), now: NOW })
  const body = (await res.json()) as { result: { content: { text: string }[]; isError?: boolean; structuredContent?: unknown } }
  return body.result
}

const task = (id: string, date: string, done: boolean, roleId = '#role:ukmppd') => ({
  id,
  title: `Tugas ${id}`,
  roleId,
  date,
  due: null,
  important: false,
  size: 'besar',
  subtasks: [],
  done,
  doneAt: null,
  source: 'manual',
  createdAt: 1,
  updatedAt: 1,
})

const sample = () =>
  fakeCloud({
    profile: [{ id: '#profile', name: '', ritme: {}, rules: {}, tentirCapacity: { min: 9, max: 15 }, updatedAt: 1 }],
    days: [
      { id: '#day:2026-11-04', date: '2026-11-04', type: 'stase', sleepNight: 6, nap: 0.5, workEnd: 'ok', note: '', updatedAt: 1 },
      { id: '#day:2026-11-05', date: '2026-11-05', type: 'stase', sleepNight: 5, nap: 0, workEnd: null, note: '', updatedAt: 1 },
    ],
    tasks: [task('tsk_a', '2026-11-04', true), task('tsk_b', '2026-11-04', false, '#role:orto'), task('tsk_c', '2026-11-05', true)],
    lifeRoles: [
      {
        id: '#role:orto',
        name: 'Ortopedi & PPDS',
        color: '#e8925b',
        order: 3,
        recovery: false,
        archived: false,
        createdAt: 1,
        updatedAt: 1,
      },
    ],
    transactions: [
      { id: 'trx_1', amount: 25_000, type: 'expense', categoryId: 'cat_kopi', date: '2026-11-04', note: '', createdAt: 1, updatedAt: 1 },
      {
        id: 'trx_2',
        amount: 500_000,
        type: 'income',
        categoryId: '#cat:kiriman',
        date: '2026-11-05',
        note: '',
        createdAt: 1,
        updatedAt: 1,
      },
      { id: 'trx_3', amount: 99_000, type: 'expense', categoryId: '#cat:makan', date: '2026-10-01', note: '', createdAt: 1, updatedAt: 1 },
    ],
    categories: [
      { id: 'cat_kopi', name: 'Kopi', icon: 'tag', color: '#7c4a2d', kind: 'expense', builtIn: false, createdAt: 1, updatedAt: 1 },
    ],
    workouts: [
      {
        id: 'wko_1',
        date: '2026-11-02',
        kind: 'beban',
        entries: [{ exerciseId: '#ex:bench', sets: [8, 8, 8].map((reps) => ({ kg: 60, reps })), feel: 'pas' }],
        run: null,
        note: '',
        createdAt: 1,
        updatedAt: 1,
      },
    ],
  })

describe('akses', () => {
  it('URL tanpa kunci yang benar → 404; kunci dibandingkan waktu-konstan', async () => {
    vi.stubGlobal('fetch', vi.fn())
    const get = (path: string, init?: RequestInit) => worker.fetch(new Request(`https://w.example${path}`, init), env)
    expect((await get('/')).status).toBe(200)
    expect((await get('/mcp/salah', { method: 'POST', body: '{}' })).status).toBe(404)
    expect((await get(`/mcp/${KEY}`)).status).toBe(405) // GET tidak dipakai
    expect(
      (await worker.fetch(new Request(`https://w.example/mcp/${KEY}`, { method: 'POST' }), { ...env, CONNECTOR_KEY: 'pendek' })).status,
    ).toBe(404)
    expect(sameKey('abc', 'abc')).toBe(true)
    expect(sameKey('abc', 'abd')).toBe(false)
    vi.unstubAllGlobals()
  })
})

describe('protokol MCP', () => {
  it('initialize, notifikasi 202, tools/list, method tak dikenal', async () => {
    const c = sample()
    const ctx = { store: dexieStore(env, c.fetchFn), now: NOW }
    const init = await (await handleMcp(rpc('initialize', { protocolVersion: '2025-03-26', capabilities: {} }), ctx)).json()
    expect(init.result).toMatchObject({ protocolVersion: '2025-03-26', serverInfo: { name: 'qawwam' }, capabilities: { tools: {} } })
    expect(init.result.instructions).toMatch(/identitas pasien/)
    const note = new Request('https://w/mcp', {
      method: 'POST',
      body: JSON.stringify({ jsonrpc: '2.0', method: 'notifications/initialized' }),
    })
    expect((await handleMcp(note, ctx)).status).toBe(202)
    const list = await (await handleMcp(rpc('tools/list'), ctx)).json()
    expect(list.result.tools.map((t: { name: string }) => t.name)).toEqual([
      'get_overview',
      'get_summary',
      'list_records',
      'get_training_plan',
      'propose',
    ])
    expect(list.result.tools.find((t: { name: string }) => t.name === 'propose').annotations.readOnlyHint).toBe(false)
    expect((await (await handleMcp(rpc('apa/ini'), ctx)).json()).error.code).toBe(-32601)
    const bad = new Request('https://w/mcp', { method: 'POST', body: '{' })
    expect((await handleMcp(bad, ctx)).status).toBe(400)
  })
})

describe('alat baca', () => {
  it('get_overview: hari ini, peran bawaan + yang diubah, level dari XP', async () => {
    const c = sample()
    const r = await call(c, 'get_overview')
    expect(r.isError).toBeUndefined()
    const o = r.structuredContent as Record<string, any>
    expect(o.today).toBe('2026-11-05')
    expect(o.dayType).toBe('stase')
    expect(o.roles.find((x: { id: string }) => x.id === '#role:orto').name).toBe('Ortopedi & PPDS')
    expect(o.roles.length).toBeGreaterThanOrEqual(6)
    expect(o.level.totalXp).toBeGreaterThan(0)
    expect(o.pendingProposals).toBe(0)
    expect(c.tokenCount()).toBe(1) // token dipakai ulang dalam satu permintaan
  })

  it('get_summary: XP & tugas per peran; ID privat dari server dinormalkan', async () => {
    const c = sample()
    const s = (await call(c, 'get_summary', { from: '2026-11-04', to: '2026-11-05' })).structuredContent as Record<string, any>
    expect(s.days.map((d: { date: string }) => d.date)).toEqual(['2026-11-04', '2026-11-05'])
    expect(s.days[0]).toMatchObject({ type: 'stase', sleepTotal: 6.5, tasks: '1/2' })
    expect(s.days[0].xp).toBe(48) // (tugas besar 20 + habit tidur ≥ 6 j 10 + berhenti kerja ≤ 21.00 10) × 1,2
    expect(s.totals.tasksByRole['Ortopedi & PPDS']).toEqual({ done: 0, total: 1 })
    expect(s.totals.money).toEqual({ income: 500_000, expense: 25_000, balance: 475_000, expenseByCategory: { Kopi: 25_000 } })
    expect((await call(c, 'get_summary', { from: '2026-11-05', to: '2026-11-01' })).isError).toBe(true)
  })

  it('list_records menyaring tanggal dan membuang kolom Dexie Cloud', async () => {
    const c = sample()
    const r = (await call(c, 'list_records', { table: 'tasks', from: '2026-11-05' })).structuredContent as Record<string, any>
    expect(r.count).toBe(1)
    expect(r.rows[0]).not.toHaveProperty('owner')
    expect(r.rows[0]).not.toHaveProperty('$$ts')
    const days = (await call(c, 'list_records', { table: 'days' })).structuredContent as Record<string, any>
    expect(days.rows[0].id).toBe('#day:2026-11-04')
    expect((await call(c, 'list_records', { table: 'rahasia' })).isError).toBe(true)
  })

  it('tabel yang belum dikenal server (skema baru belum sinkron) dianggap kosong', async () => {
    const c = sample()
    const r = (await call(c, 'list_records', { table: 'claims' })).structuredContent as Record<string, any>
    expect(r.count).toBe(0)
  })

  it('baris milik akun lain diabaikan', async () => {
    const c = sample()
    c.data.tasks.push(c.cloud(task('tsk_lain', '2026-11-05', true), 'orang@lain.id'))
    const r = (await call(c, 'list_records', { table: 'tasks' })).structuredContent as Record<string, any>
    expect(r.rows.map((x: { id: string }) => x.id)).not.toContain('tsk_lain')
  })

  it('get_training_plan memakai algoritma app: bench 60×8×3 → naik 62,5 kg', async () => {
    const c = sample()
    const p = (await call(c, 'get_training_plan')).structuredContent as Record<string, any>
    const bench = p.strength.find((s: { exercise: string }) => s.exercise === 'Bench press')
    expect(bench.next).toMatchObject({ action: 'naik', kg: 62.5 })
    expect(p.readiness).toBe('normal')
    expect(p.run.targetKm).toBeGreaterThan(0)
  })
})

describe('propose', () => {
  it('menyimpan usulan untuk pemilik (owner & realmId) dengan status menunggu', async () => {
    const c = sample()
    const r = await call(c, 'propose', {
      summary: 'Belajar besok',
      items: [
        { jenis: 'tugas', judul: '40 soal muskuloskeletal', tanggal: '2026-11-06', peran: 'ukmppd' },
        { jenis: 'jaga', tanggal: '2026-11-08' },
      ],
    })
    expect(r.isError).toBeUndefined()
    expect(r.content[0].text).toMatch(/tersimpan \(2 item\)/)
    expect(c.posted).toHaveLength(1)
    expect(c.posted[0].table).toBe('proposals')
    expect(c.posted[0].rows[0]).toMatchObject({
      owner: OWNER,
      realmId: OWNER,
      status: 'menunggu',
      source: 'claude',
      summary: 'Belajar besok',
    })
    expect(String(c.posted[0].rows[0].id)).toMatch(/^prp_/)
  })

  it('item bermasalah atau mirip identitas pasien → tidak ada yang disimpan, Claude diberi tahu', async () => {
    const c = sample()
    const r = await call(c, 'propose', {
      summary: 'Follow up',
      items: [
        { jenis: 'tugas', judul: 'Follow up Tn. Budi bed 4', tanggal: '2026-11-06' },
        { jenis: 'tugas', judul: 'Tanpa tanggal' },
      ],
    })
    expect(r.isError).toBe(true)
    expect(r.content[0].text).toMatch(/item 1: mirip identitas pasien/)
    expect(r.content[0].text).toMatch(/item 2:/)
    expect(c.posted).toHaveLength(0)
  })
})
