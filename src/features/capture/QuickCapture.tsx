import { TriangleAlert } from 'lucide-react'
import { Sheet } from '../../components/Sheet'
import { PHI_HINT } from '../../domain/phi'
import { CAPTURE_MODES, useQuickCapture, type CaptureMode } from './useQuickCapture'

function ModeSwitch({ mode, setMode }: { mode: CaptureMode; setMode: (m: CaptureMode) => void }) {
  return (
    <div role="tablist" aria-label="Jenis catatan" className="flex shrink-0 rounded-full bg-surface-2 p-[3px]">
      {CAPTURE_MODES.map((m) => (
        <button
          key={m.mode}
          type="button"
          role="tab"
          aria-selected={mode === m.mode}
          disabled={!m.ready}
          title={m.ready ? undefined : 'Mulai Fase 2'}
          onClick={() => setMode(m.mode)}
          className={`rounded-full px-3 py-1.5 text-[13px] disabled:opacity-45 ${mode === m.mode ? 'bg-surface text-text shadow-sm' : 'text-muted'}`}
        >
          {m.label}
        </button>
      ))}
    </div>
  )
}

function Hint({ preview, phi }: { preview: string | null; phi: string | null }) {
  if (phi)
    return (
      <p className="flex items-start gap-1.5 text-xs text-danger" role="alert">
        <TriangleAlert size={14} className="mt-px shrink-0" aria-hidden="true" />
        Mirip identitas pasien ({phi}). {PHI_HINT}
      </p>
    )
  if (preview) return <p className="text-xs text-muted">→ {preview}</p>
  return null
}

/** Kolom Catat cepat di bagian atas (iPad/laptop). */
export function CaptureBar() {
  const c = useQuickCapture()
  const placeholder = CAPTURE_MODES.find((m) => m.mode === c.mode)!.placeholder
  return (
    <div className="relative w-full max-w-[620px]">
      <form
        className="flex items-center gap-1.5 rounded-full border border-line bg-surface py-[5px] pr-[5px] pl-1.5"
        onSubmit={(e) => {
          e.preventDefault()
          void c.submit()
        }}
      >
        <ModeSwitch mode={c.mode} setMode={c.setMode} />
        <input
          value={c.text}
          onChange={(e) => c.setText(e.target.value)}
          placeholder={placeholder}
          disabled={!c.ready}
          aria-label="Catat cepat"
          className="min-w-0 flex-1 bg-transparent px-2 text-text outline-none placeholder:text-faint"
        />
        <button type="submit" className="btn-primary" disabled={!c.ready || !c.text.trim() || !!c.phi}>
          Catat
        </button>
      </form>
      <div className="absolute top-full left-5 mt-1.5">
        <Hint preview={c.preview} phi={c.phi} />
      </div>
    </div>
  )
}

/** Lembar Catat cepat dari tombol + (HP). */
export function CaptureSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  return (
    <Sheet open={open} title="Catat cepat" onClose={onClose}>
      <CaptureSheetBody onSaved={onClose} />
    </Sheet>
  )
}

function CaptureSheetBody({ onSaved }: { onSaved: () => void }) {
  const c = useQuickCapture(onSaved)
  const placeholder = CAPTURE_MODES.find((m) => m.mode === c.mode)!.placeholder
  return (
    <form
      className="grid gap-3"
      onSubmit={(e) => {
        e.preventDefault()
        void c.submit()
      }}
    >
      <ModeSwitch mode={c.mode} setMode={c.setMode} />
      <input
        value={c.text}
        onChange={(e) => c.setText(e.target.value)}
        placeholder={placeholder}
        disabled={!c.ready}
        aria-label="Catat cepat"
        className="field"
        enterKeyHint="done"
      />
      <Hint preview={c.preview} phi={c.phi} />
      {c.mode === 'tugas' && (
        <p className="text-xs text-faint">Tanggal: “besok”, “lusa”, “senin”. Peran: #ukmppd, #orto, #tentir. Penting: “!”.</p>
      )}
      {c.mode === 'tentir' && (
        <p className="text-xs text-faint">
          Inisial kapital (AB), durasi “2j”/“90m”, jam “19.00”, tanggal “besok”, “lunas”. Tarif dari Setelan tentir.
        </p>
      )}
      <button type="submit" className="btn-primary w-full py-3" disabled={!c.ready || !c.text.trim() || !!c.phi}>
        Catat
      </button>
    </form>
  )
}
