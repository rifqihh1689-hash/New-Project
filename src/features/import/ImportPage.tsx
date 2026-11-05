import { ClipboardCopy, Download, FileUp, TriangleAlert } from 'lucide-react'
import { useMemo, useState } from 'react'
import { useToday } from '../../app/useToday'
import { PageTop } from '../../components/PageTop'
import { useToast } from '../../components/toast-context'
import { applyImport, summaryText } from '../../db/importer'
import { roleLookup, useRoles } from '../../db/structure'
import { describeItem, IMPORT_KIND_LABELS, IMPORT_KINDS, parseImport, type ImportKind } from '../../domain/importer'
import { PHI_HINT } from '../../domain/phi'
import { DAY_TYPE_LABELS } from '../../domain/dayType'
import { parseDompetku } from '../../domain/dompetku'
import { parseMbappe } from '../../domain/mbappe'
import { DompetkuCard } from './DompetkuCard'
import { MbappeCard } from './MbappeCard'
import { claudePrompt, csvTemplate, sheetTemplate } from './templates'

async function copy(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text)
    return true
  } catch {
    return false
  }
}

function download(name: string, text: string, type: string) {
  const a = document.createElement('a')
  a.href = URL.createObjectURL(new Blob([text], { type }))
  a.download = name
  document.body.appendChild(a)
  a.click()
  setTimeout(() => {
    URL.revokeObjectURL(a.href)
    a.remove()
  }, 1500)
}

export function ImportPage() {
  const today = useToday()
  const roles = useRoles()
  const toast = useToast()
  const [text, setText] = useState('')
  const [defaultKind, setDefaultKind] = useState<ImportKind | ''>('')
  const [skipped, setSkipped] = useState<Set<number>>(new Set())
  const [busy, setBusy] = useState(false)
  const role = roleLookup(roles)
  const mbappe = useMemo(() => (text.trim().startsWith('{') ? parseMbappe(text) : null), [text])
  const dompetku = useMemo(() => (text.trim().startsWith('{') ? parseDompetku(text) : null), [text])
  const rows = useMemo(
    () => (mbappe || dompetku ? [] : parseImport(text, { roles: roles ?? [], today, defaultKind: defaultKind || undefined })),
    [text, roles, today, defaultKind, mbappe, dompetku],
  )
  const valid = rows.map((r, i) => ({ r, i })).filter(({ r }) => r.item && !r.phi)
  const chosen = valid.filter(({ i }) => !skipped.has(i))
  const errors = rows.filter((r) => r.error)
  const phiRows = rows.filter((r) => r.phi)
  const ritmeTypes = [...new Set(chosen.flatMap(({ r }) => (r.item?.kind === 'ritme' ? [r.item.dayType] : [])))]

  const copyWith = async (value: string, ok: string) => {
    if (await copy(value)) toast({ message: ok })
    else {
      setText(value)
      toast({
        message: 'Tidak bisa menyalin otomatis; teksnya kutaruh di kotak di bawah untuk disalin manual.',
        tone: 'info',
        duration: 6000,
      })
    }
  }
  const pickFile = (file: File | undefined) => {
    if (!file) return
    const reader = new FileReader()
    reader.onload = () => {
      setText(String(reader.result))
      setSkipped(new Set())
    }
    reader.readAsText(file)
  }
  const run = async () => {
    setBusy(true)
    try {
      const summary = await applyImport(chosen.map(({ r }) => r.item!))
      toast({ message: summaryText(summary), duration: 6000 })
      setText('')
      setSkipped(new Set())
    } catch (e) {
      toast({ message: `Gagal mengimpor: ${(e as Error).message}`, tone: 'error' })
    } finally {
      setBusy(false)
    }
  }

  return (
    <>
      <PageTop title="Impor jadwal" />
      <h1 className="mt-4 text-[26px] font-semibold tracking-tight md:hidden">Impor jadwal</h1>
      <div className="mx-auto mt-4 grid max-w-3xl gap-3 md:mt-[26px]">
        <section className="card">
          <h2 className="card-title">Dari mana jadwalnya?</h2>
          <div className="grid gap-3 md:grid-cols-2">
            <div className="rounded-xl bg-surface-2 p-3.5">
              <div className="font-medium">Screenshot, PDF, catatan</div>
              <p className="mt-1 text-[13px] text-muted">
                Salin perintah ini, kirim ke app Claude bersama lampirannya. Balasan Claude (blok JSON) tempel di kotak bawah.
              </p>
              <button
                type="button"
                className="btn-primary mt-3"
                onClick={() => void copyWith(claudePrompt(today, roles ?? []), 'Perintah untuk Claude disalin.')}
              >
                <ClipboardCopy size={15} aria-hidden="true" /> Salin perintah untuk Claude
              </button>
            </div>
            <div className="rounded-xl bg-surface-2 p-3.5">
              <div className="font-medium">Google Sheets / Excel</div>
              <p className="mt-1 text-[13px] text-muted">
                Salin template, tempel di Sheets, isi. Lalu salin sel-selnya (termasuk baris judul kolom) dan tempel di kotak bawah.
              </p>
              <div className="mt-3 flex flex-wrap gap-2">
                <button
                  type="button"
                  className="btn-ghost border border-line"
                  onClick={() => void copyWith(sheetTemplate(), 'Template disalin. Tempel di sel A1 Google Sheets.')}
                >
                  <ClipboardCopy size={15} aria-hidden="true" /> Salin template
                </button>
                <button
                  type="button"
                  className="btn-ghost border border-line"
                  onClick={() => download('qawwam-template.csv', csvTemplate(), 'text/csv')}
                >
                  <Download size={15} aria-hidden="true" /> CSV
                </button>
              </div>
            </div>
          </div>
          <div className="mt-3 rounded-xl bg-surface-2 p-3.5">
            <div className="font-medium">Data lama MBAPPE OS & Dompetku</div>
            <p className="mt-1 text-[13px] text-muted">
              Di MBAPPE OS maupun Dompetku: Setelan → Export JSON. Lalu pilih filenya / tempel di kotak bawah; Qawwam mengenali keduanya
              otomatis.
            </p>
          </div>
        </section>

        <section className="card">
          <h2 className="card-title">Tempel di sini</h2>
          <textarea
            className="field min-h-[140px] font-mono text-[12.5px]"
            value={text}
            onChange={(e) => {
              setText(e.target.value)
              setSkipped(new Set())
            }}
            placeholder={'jenis\ttanggal\tjudul\njaga\t14/11\t\n…atau balasan JSON dari Claude'}
            aria-label="Teks yang diimpor"
            spellCheck={false}
          />
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <label className="btn-ghost cursor-pointer border border-line">
              <FileUp size={15} aria-hidden="true" /> Pilih file (.csv, .tsv, .json)
              <input
                type="file"
                accept=".csv,.tsv,.txt,.json,text/csv,application/json"
                className="sr-only"
                onChange={(e) => pickFile(e.target.files?.[0])}
              />
            </label>
            <label
              className={`w-full flex-col gap-1 text-[13px] text-muted sm:ml-auto sm:w-auto sm:flex-row sm:items-center sm:gap-2 ${mbappe || dompetku ? 'hidden' : 'flex'}`}
            >
              Tanpa kolom "jenis", anggap sebagai
              <select
                className="field py-1.5 sm:w-auto"
                value={defaultKind}
                onChange={(e) => setDefaultKind(e.target.value as ImportKind | '')}
              >
                <option value="">— wajib ada kolom jenis —</option>
                {IMPORT_KINDS.map((k) => (
                  <option key={k} value={k}>
                    {IMPORT_KIND_LABELS[k]}
                  </option>
                ))}
              </select>
            </label>
          </div>
        </section>

        {mbappe && (
          <MbappeCard
            data={mbappe}
            onDone={() => {
              setText('')
              setSkipped(new Set())
            }}
          />
        )}

        {dompetku && (
          <DompetkuCard
            data={dompetku}
            onDone={() => {
              setText('')
              setSkipped(new Set())
            }}
          />
        )}

        {rows.length > 0 && (
          <section className="card">
            <h2 className="card-title">
              Pratinjau <span className="text-[13px] font-medium text-faint">{chosen.length} dipilih</span>
            </h2>
            {ritmeTypes.length > 0 && (
              <p className="mb-3 rounded-xl bg-surface-2 px-3 py-2 text-[13px] text-muted">
                Ritme {ritmeTypes.map((t) => DAY_TYPE_LABELS[t]).join(', ')} akan <b className="text-text">diganti seluruhnya</b> dengan
                jadwal ini.
              </p>
            )}
            {IMPORT_KINDS.map((kind) => {
              const group = valid.filter(({ r }) => r.item?.kind === kind)
              if (!group.length) return null
              return (
                <div key={kind} className="mb-3">
                  <div className="mb-1 text-xs font-medium tracking-wide text-faint uppercase">
                    {IMPORT_KIND_LABELS[kind]} · {group.length}
                  </div>
                  <ul className="grid gap-1">
                    {group.map(({ r, i }) => (
                      <li key={i}>
                        <label className="flex items-start gap-2.5 rounded-lg px-1 py-1 text-[13.5px] hover:bg-surface-2">
                          <input
                            type="checkbox"
                            className="mt-0.5 size-4 accent-current"
                            checked={!skipped.has(i)}
                            onChange={() =>
                              setSkipped((s) => {
                                const next = new Set(s)
                                if (next.has(i)) next.delete(i)
                                else next.add(i)
                                return next
                              })
                            }
                          />
                          <span className="flex-1">
                            {r.item!.kind === 'ritme' && <span className="text-muted">{DAY_TYPE_LABELS[r.item!.dayType]} · </span>}
                            {describeItem(r.item!, (id) => role(id).name)}
                            {r.item!.kind === 'habit' && r.item!.note && <span className="block text-xs text-muted">{r.item!.note}</span>}
                          </span>
                        </label>
                      </li>
                    ))}
                  </ul>
                </div>
              )
            })}
            {(errors.length > 0 || phiRows.length > 0) && (
              <div
                className="mt-2 grid gap-1.5 rounded-xl p-3 text-[13px]"
                style={{ background: 'color-mix(in srgb, var(--danger) 10%, transparent)' }}
                role="alert"
              >
                <div className="flex items-center gap-2 font-medium text-danger">
                  <TriangleAlert size={15} aria-hidden="true" /> {errors.length + phiRows.length} baris tidak diimpor
                </div>
                {errors.map((r, i) => (
                  <div key={`e${i}`} className="text-muted">
                    Baris {r.line}: {r.error}
                  </div>
                ))}
                {phiRows.map((r, i) => (
                  <div key={`p${i}`} className="text-muted">
                    Baris {r.line}: mirip identitas pasien ({r.phi}). {PHI_HINT}
                  </div>
                ))}
              </div>
            )}
            <button type="button" className="btn-primary mt-4 w-full py-3" disabled={!chosen.length || busy} onClick={() => void run()}>
              Impor {chosen.length} item
            </button>
          </section>
        )}
      </div>
    </>
  )
}
