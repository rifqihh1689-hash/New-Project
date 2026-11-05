/**
 * Server MCP minimal lewat Streamable HTTP (tanpa SDK): JSON-RPC di satu endpoint POST, balasan JSON.
 * Tanpa sesi dan tanpa SSE, cukup untuk alat yang menjawab sekali.
 */
import { INSTRUCTIONS, ToolError, TOOLS, type ToolContext } from './tools'

export const SUPPORTED_VERSIONS = ['2025-06-18', '2025-03-26', '2024-11-05']
export const SERVER_INFO = { name: 'qawwam', title: 'Qawwam', version: '0.1.0' }

interface RpcRequest {
  jsonrpc: '2.0'
  id?: string | number | null
  method: string
  params?: Record<string, unknown>
}

type RpcResponse =
  | { jsonrpc: '2.0'; id: string | number | null; result: unknown }
  | { jsonrpc: '2.0'; id: string | number | null; error: { code: number; message: string } }

const ok = (id: RpcRequest['id'], result: unknown): RpcResponse => ({ jsonrpc: '2.0', id: id ?? null, result })
const fail = (id: RpcRequest['id'], code: number, message: string): RpcResponse => ({
  jsonrpc: '2.0',
  id: id ?? null,
  error: { code, message },
})

function listTools() {
  return {
    tools: TOOLS.map((t) => ({
      name: t.name,
      title: t.title,
      description: t.description,
      inputSchema: t.inputSchema,
      annotations: { title: t.title, readOnlyHint: t.readOnly, destructiveHint: false, idempotentHint: t.readOnly, openWorldHint: false },
    })),
  }
}

async function callTool(params: Record<string, unknown> | undefined, ctx: ToolContext) {
  const tool = TOOLS.find((t) => t.name === params?.name)
  if (!tool) return null
  const args = (params?.arguments ?? {}) as Record<string, unknown>
  try {
    const out = await tool.run(args, ctx)
    const text = typeof out === 'string' ? out : JSON.stringify(out)
    return {
      content: [{ type: 'text', text }],
      ...(typeof out === 'object' && out !== null ? { structuredContent: out } : {}),
    }
  } catch (e) {
    // Galat alat dikembalikan ke Claude (bukan galat protokol) supaya ia bisa memperbaiki permintaannya.
    const message = e instanceof ToolError ? e.message : `Galat: ${(e as Error).message}`
    return { content: [{ type: 'text', text: message }], isError: true }
  }
}

async function handleOne(msg: unknown, ctx: ToolContext): Promise<RpcResponse | null> {
  if (!msg || typeof msg !== 'object' || (msg as RpcRequest).jsonrpc !== '2.0' || typeof (msg as RpcRequest).method !== 'string')
    return fail(null, -32600, 'Invalid Request')
  const req = msg as RpcRequest
  const isNotification = !('id' in req)
  if (isNotification) return null
  switch (req.method) {
    case 'initialize': {
      const asked = String(req.params?.protocolVersion ?? '')
      return ok(req.id, {
        protocolVersion: SUPPORTED_VERSIONS.includes(asked) ? asked : SUPPORTED_VERSIONS[0],
        capabilities: { tools: { listChanged: false } },
        serverInfo: SERVER_INFO,
        instructions: INSTRUCTIONS,
      })
    }
    case 'ping':
      return ok(req.id, {})
    case 'tools/list':
      return ok(req.id, listTools())
    case 'tools/call': {
      const result = await callTool(req.params, ctx)
      return result ? ok(req.id, result) : fail(req.id, -32602, `Alat tidak dikenal: ${String(req.params?.name)}`)
    }
    case 'resources/list':
      return ok(req.id, { resources: [] })
    case 'prompts/list':
      return ok(req.id, { prompts: [] })
    default:
      return fail(req.id, -32601, `Method not found: ${req.method}`)
  }
}

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json; charset=utf-8' } })

/** Satu permintaan HTTP ke endpoint MCP. */
export async function handleMcp(request: Request, ctx: ToolContext): Promise<Response> {
  if (request.method !== 'POST') return new Response('Method Not Allowed', { status: 405, headers: { allow: 'POST' } })
  let body: unknown
  try {
    body = await request.json()
  } catch {
    return json(fail(null, -32700, 'Parse error'), 400)
  }
  if (Array.isArray(body)) {
    const out = (await Promise.all(body.map((m) => handleOne(m, ctx)))).filter((r): r is RpcResponse => r !== null)
    return out.length ? json(out) : new Response(null, { status: 202 })
  }
  const res = await handleOne(body, ctx)
  return res ? json(res) : new Response(null, { status: 202 })
}
