/**
 * Connector Qawwam untuk Claude (Cloudflare Worker).
 * Endpoint MCP: POST https://<worker>/mcp/<CONNECTOR_KEY>. URL itu sendiri adalah kunci aksesnya,
 * jadi simpan seperti kata sandi; ganti CONNECTOR_KEY untuk mencabut akses.
 */
import { dexieStore, type Env } from './dexie'
import { handleMcp } from './mcp'

/** Perbandingan waktu-konstan supaya kunci tidak bisa ditebak lewat waktu respons. */
export function sameKey(a: string, b: string): boolean {
  if (!a || !b || a.length !== b.length) return false
  let diff = 0
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i)
  return diff === 0
}

export function configProblem(env: Partial<Env>): string | null {
  const missing = (['DEXIE_DB_URL', 'DEXIE_CLIENT_ID', 'DEXIE_CLIENT_SECRET', 'OWNER_EMAIL', 'CONNECTOR_KEY'] as const).filter(
    (k) => !env[k],
  )
  if (missing.length) return `Belum diatur: ${missing.join(', ')}`
  if ((env.CONNECTOR_KEY ?? '').length < 24) return 'CONNECTOR_KEY minimal 24 karakter.'
  return null
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url)
    if (url.pathname === '/' || url.pathname === '') return new Response('Qawwam connector. Endpoint MCP ada di /mcp/<kunci>.\n')
    const match = /^\/mcp\/([^/]+)\/?$/.exec(url.pathname)
    const problem = configProblem(env)
    if (!match || problem || !sameKey(decodeURIComponent(match[1]), env.CONNECTOR_KEY)) {
      // Konfigurasi kurang hanya diungkap ke pemilik kunci yang benar; selain itu 404 polos.
      if (match && problem && env.CONNECTOR_KEY && sameKey(decodeURIComponent(match[1]), env.CONNECTOR_KEY))
        return new Response(problem, { status: 500 })
      return new Response('Not found', { status: 404 })
    }
    return handleMcp(request, { store: dexieStore(env), now: Date.now() })
  },
}
