/**
 * Klien REST Dexie Cloud untuk connector. Hanya dua operasi: baca semua baris tabel milik pemilik,
 * dan tulis baris baru (dipakai untuk tabel `proposals` saja).
 */

export interface Env {
  /** URL database, mis. https://xxxx.dexie.cloud */
  DEXIE_DB_URL: string
  DEXIE_CLIENT_ID: string
  DEXIE_CLIENT_SECRET: string
  /** Email akun Qawwam di Dexie Cloud (pemilik data). */
  OWNER_EMAIL: string
  /** Rahasia di URL connector: https://…/mcp/<CONNECTOR_KEY>. Minimal 24 karakter. */
  CONNECTOR_KEY: string
}

export interface Store {
  all<T = Record<string, unknown>>(table: string): Promise<T[]>
  put(table: string, rows: Record<string, unknown>[]): Promise<void>
}

type Fetch = typeof fetch

/** Kolom milik Dexie Cloud yang tidak berguna untuk Claude. */
const CLOUD_FIELDS = ['owner', 'realmId', '$$ts']

/** ID privat `#…` disimpan server sebagai `#…:<userId>`; kembalikan ke bentuk yang dipakai app. */
export function clientId(id: unknown, owner: unknown): unknown {
  if (typeof id !== 'string' || typeof owner !== 'string' || !id.startsWith('#')) return id
  const suffix = `:${owner}`
  return id.endsWith(suffix) ? id.slice(0, -suffix.length) : id
}

export function dexieStore(env: Env, fetchFn: Fetch = fetch): Store {
  const base = env.DEXIE_DB_URL.replace(/\/+$/, '')
  let token: { value: string; exp: number } | null = null
  // Satu permintaan token dipakai bersama oleh pembacaan tabel yang berjalan paralel.
  let pending: Promise<string> | null = null

  const getToken = (): Promise<string> => {
    if (token && token.exp - 60_000 > Date.now()) return Promise.resolve(token.value)
    pending ??= requestToken().finally(() => {
      pending = null
    })
    return pending
  }

  const requestToken = async () => {
    const res = await fetchFn(`${base}/token`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        grant_type: 'client_credentials',
        scopes: ['ACCESS_DB', 'GLOBAL_READ', 'GLOBAL_WRITE'],
        client_id: env.DEXIE_CLIENT_ID,
        client_secret: env.DEXIE_CLIENT_SECRET,
      }),
    })
    if (!res.ok) throw new Error(`Dexie Cloud menolak kunci klien (${res.status}).`)
    const body = (await res.json()) as { accessToken: string; accessTokenExpiration?: number }
    token = { value: body.accessToken, exp: body.accessTokenExpiration ?? Date.now() + 10 * 60_000 }
    return token.value
  }

  return {
    async all<T>(table: string): Promise<T[]> {
      const res = await fetchFn(`${base}/all/${encodeURIComponent(table)}`, {
        headers: { authorization: `Bearer ${await getToken()}`, accept: 'application/json' },
      })
      // Tabel dari versi skema yang belum pernah disinkron perangkat mana pun belum dikenal server: anggap kosong.
      if (res.status === 422 && /not known/i.test(await res.text())) return []
      if (!res.ok) throw new Error(`Gagal membaca ${table} (${res.status}).`)
      const rows = (await res.json()) as Record<string, unknown>[]
      return rows
        .filter((r) => !env.OWNER_EMAIL || r.owner === env.OWNER_EMAIL)
        .map((r) => {
          const out: Record<string, unknown> = { ...r, id: clientId(r.id, r.owner) }
          for (const k of CLOUD_FIELDS) delete out[k]
          return out as T
        })
    },
    async put(table: string, rows: Record<string, unknown>[]): Promise<void> {
      const body = rows.map((r) => ({ ...r, owner: env.OWNER_EMAIL, realmId: env.OWNER_EMAIL }))
      const res = await fetchFn(`${base}/all/${encodeURIComponent(table)}`, {
        method: 'POST',
        headers: { authorization: `Bearer ${await getToken()}`, 'content-type': 'application/json' },
        body: JSON.stringify(body),
      })
      if (!res.ok) throw new Error(`Gagal menulis ${table} (${res.status}).`)
    },
  }
}
