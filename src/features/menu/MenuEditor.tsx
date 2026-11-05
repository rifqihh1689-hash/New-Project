import { useState } from 'react'
import { Sheet } from '../../components/Sheet'
import { useToast } from '../../components/toast-context'
import { newMenu, saveMenu } from '../../db/menu'
import { ingredientsText, menuCost, parseIngredients, SLOT_LABELS, SLOT_ORDER } from '../../domain/menu'
import { detectPatientIdentity } from '../../domain/phi'
import type { Menu, NutritionSettings } from '../../types'

export type MenuDraft = Menu | 'baru'

export function MenuEditor({ draft, nutrition, onClose }: { draft: MenuDraft | null; nutrition: NutritionSettings; onClose: () => void }) {
  return (
    <Sheet open={!!draft} title={draft === 'baru' ? 'Menu baru' : 'Ubah menu'} onClose={onClose}>
      {draft && <MenuForm key={draft === 'baru' ? 'baru' : draft.id} draft={draft} nutrition={nutrition} onClose={onClose} />}
    </Sheet>
  )
}

function MenuForm({ draft, nutrition, onClose }: { draft: MenuDraft; nutrition: NutritionSettings; onClose: () => void }) {
  const toast = useToast()
  const [m, setM] = useState<Menu>(() => (draft === 'baru' ? newMenu() : draft))
  const [bahan, setBahan] = useState(() => ingredientsText(m.ingredients))
  const set = (c: Partial<Menu>) => setM((prev) => ({ ...prev, ...c }))
  const parsed = parseIngredients(bahan)
  const auto = parsed ? menuCost({ source: m.source, ingredients: parsed, costRp: m.costRp }, nutrition.prices, nutrition.overheadRp) : null
  const phi = detectPatientIdentity(`${m.name} ${m.note ?? ''}`)
  const save = async (changes: Partial<Menu> = {}) => {
    try {
      if (!m.name.trim()) throw new Error('Nama menu kosong.')
      if (!m.slots.length) throw new Error('Pilih minimal satu waktu makan.')
      if (!parsed) throw new Error('Format bahan: "Telur 2 butir; Dada ayam 150 g".')
      await saveMenu({ ...m, ...changes, name: m.name.trim(), ingredients: parsed })
      onClose()
    } catch (e) {
      toast({ message: (e as Error).message, tone: 'error' })
    }
  }
  const num = (v: string) => Math.max(0, Math.round(Number(v.replace(/[^\d]/g, '')) || 0))
  return (
    <form
      className="grid gap-4"
      onSubmit={(e) => {
        e.preventDefault()
        void save()
      }}
    >
      <label>
        <span className="label">Nama</span>
        <input
          className="field"
          value={m.name}
          onChange={(e) => set({ name: e.target.value })}
          placeholder="mis. Ayam bakar madu + nasi"
          maxLength={80}
        />
      </label>
      <div className="flex rounded-full bg-surface-2 p-[3px]">
        {(['masak', 'beli'] as const).map((s) => (
          <button
            key={s}
            type="button"
            aria-pressed={m.source === s}
            onClick={() => set({ source: s })}
            className={`flex-1 rounded-full px-3 py-1.5 text-[13px] ${m.source === s ? 'bg-surface text-text shadow-sm' : 'text-muted'}`}
          >
            {s === 'masak' ? 'Masak sendiri' : 'Beli'}
          </button>
        ))}
      </div>
      <div>
        <span className="label">Cocok untuk</span>
        <div className="flex flex-wrap gap-1.5">
          {SLOT_ORDER.map((slot) => (
            <button
              key={slot}
              type="button"
              aria-pressed={m.slots.includes(slot)}
              onClick={() => set({ slots: m.slots.includes(slot) ? m.slots.filter((x) => x !== slot) : [...m.slots, slot] })}
              className={`chip py-1 ${m.slots.includes(slot) ? 'border-transparent bg-btn text-btn-text' : ''}`}
            >
              {SLOT_LABELS[slot]}
            </button>
          ))}
        </div>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <label>
          <span className="label">Protein / porsi (g)</span>
          <input className="field" inputMode="numeric" value={m.proteinG} onChange={(e) => set({ proteinG: num(e.target.value) })} />
        </label>
        <label>
          <span className="label">Biaya / porsi (Rp)</span>
          {auto?.auto ? (
            <span className="field block text-muted" title="Dihitung dari harga bahan">
              {auto.cost.toLocaleString('id-ID')} <span className="text-xs text-faint">otomatis</span>
            </span>
          ) : (
            <input className="field" inputMode="numeric" value={m.costRp} onChange={(e) => set({ costRp: num(e.target.value) })} />
          )}
        </label>
      </div>
      {m.source === 'masak' ? (
        <label>
          <span className="label">Bahan per porsi (untuk daftar belanja)</span>
          <textarea
            className="field min-h-[64px]"
            value={bahan}
            onChange={(e) => setBahan(e.target.value)}
            placeholder="Telur 2 butir; Dada ayam 150 g; Beras 80 g"
          />
          {!parsed && <span className="mt-1 block text-xs text-danger">Format: nama, jumlah, satuan. Pisahkan dengan titik koma.</span>}
        </label>
      ) : (
        <label>
          <span className="label">Tempat beli</span>
          <input
            className="field"
            value={m.place ?? ''}
            onChange={(e) => set({ place: e.target.value || undefined })}
            placeholder="mis. warung dekat RS"
          />
        </label>
      )}
      <div className="flex flex-wrap gap-4 text-[13px]">
        <label className="flex items-center gap-2">
          <input type="checkbox" className="size-4 accent-current" checked={m.bekal} onChange={(e) => set({ bekal: e.target.checked })} />
          Bisa jadi bekal jaga
        </label>
        {m.source === 'masak' && (
          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              className="size-4 accent-current"
              checked={m.heavyCook}
              onChange={(e) => set({ heavyCook: e.target.checked })}
            />
            Masak lama (hari libur)
          </label>
        )}
      </div>
      {phi && (
        <p className="text-xs text-danger" role="alert">
          Mirip identitas pasien ({phi}).
        </p>
      )}
      <div className="flex items-center gap-2">
        {draft !== 'baru' && (
          <button type="button" className="btn-ghost" onClick={() => void save({ archived: !m.archived })}>
            {m.archived ? 'Pakai lagi' : 'Arsipkan'}
          </button>
        )}
        <button type="submit" className="btn-primary ml-auto px-6 py-2.5" disabled={!m.name.trim() || !!phi || !parsed}>
          Simpan
        </button>
      </div>
      <p className="text-xs text-faint">
        Biaya menu masak dihitung dari harga bahan bila semua bahannya sudah berharga (lihat Harga bahan); menu beli diisi manual.
      </p>
    </form>
  )
}
