import { Plus } from 'lucide-react'
import { useState } from 'react'
import { useToast } from '../../components/toast-context'
import { savePrices } from '../../db/menu'
import { displayUnit, pricesAge } from '../../domain/menu'
import { formatRupiah } from '../../lib/format'
import type { IngredientPrice, NutritionSettings } from '../../types'

const UNITS = ['g', 'ml', 'butir', 'buah', 'bungkus', 'porsi']

/** Harga bahan: diperbarui ±sebulan sekali, biaya semua menu masak ikut. */
export function PricesCard({ nutrition }: { nutrition: NutritionSettings }) {
  const toast = useToast()
  const [adding, setAdding] = useState({ name: '', unit: 'g', price: '' })
  const age = pricesAge(nutrition.pricesUpdatedAt)
  const save = async (prices: IngredientPrice[], overheadRp?: number) => {
    await savePrices(prices, overheadRp)
    toast({ message: 'Harga tersimpan. Biaya menu masak ikut diperbarui.', duration: 2500 })
  }
  const setPrice = (i: number, displayPrice: number) => {
    const p = nutrition.prices[i]
    const rp = displayPrice / displayUnit(p.unit).factor
    if (!(rp > 0) || rp === p.rpPerUnit) return
    void save(nutrition.prices.map((x, j) => (j === i ? { ...x, rpPerUnit: rp } : x)))
  }
  const add = () => {
    const price = Number(adding.price.replace(/[^\d]/g, ''))
    if (!adding.name.trim() || !price) return
    void save([...nutrition.prices, { name: adding.name.trim(), unit: adding.unit, rpPerUnit: price / displayUnit(adding.unit).factor }])
    setAdding({ name: '', unit: 'g', price: '' })
  }
  return (
    <section id="harga-bahan" className="card mt-3 scroll-mt-4">
      <h2 className="card-title">
        Harga bahan
        <span className="text-[13px] font-medium text-faint">
          {age == null ? 'masih harga perkiraan bawaan' : age === 0 ? 'diperbarui hari ini' : `diperbarui ${age} hari lalu`}
        </span>
      </h2>
      <p className="mb-3 text-[13px] text-muted">
        Cukup diperbarui sebulan sekali (lebih cepat kalau harga ayam/telur naik-turun tajam). Biaya semua menu masak dan daftar belanja
        dihitung dari sini.
      </p>
      <ul className="grid gap-x-6 gap-y-2 sm:grid-cols-2">
        {nutrition.prices.map((p, i) => {
          const u = displayUnit(p.unit)
          return (
            <li key={`${p.name}|${p.unit}`} className="flex items-center gap-2 text-[13.5px]">
              <span className="flex-1">{p.name}</span>
              <span className="text-xs text-faint">Rp</span>
              <input
                className="field w-[104px] py-1.5 text-right tabular-nums"
                inputMode="numeric"
                defaultValue={Math.round(p.rpPerUnit * u.factor)}
                aria-label={`Harga ${p.name} per ${u.label}`}
                onBlur={(e) => setPrice(i, Number(e.target.value.replace(/[^\d]/g, '')))}
              />
              <span className="w-12 text-xs text-muted">/{u.label}</span>
            </li>
          )
        })}
      </ul>
      <div className="mt-3 flex flex-wrap items-center gap-2 border-t border-line pt-3">
        <input
          className="field min-w-[140px] flex-1 py-1.5"
          placeholder="Bahan baru, mis. Udang"
          value={adding.name}
          onChange={(e) => setAdding((a) => ({ ...a, name: e.target.value }))}
          aria-label="Nama bahan baru"
        />
        <input
          className="field w-[110px] py-1.5"
          inputMode="numeric"
          placeholder="Harga"
          value={adding.price}
          onChange={(e) => setAdding((a) => ({ ...a, price: e.target.value }))}
          aria-label="Harga bahan baru"
        />
        <select
          className="field w-auto py-1.5"
          value={adding.unit}
          onChange={(e) => setAdding((a) => ({ ...a, unit: e.target.value }))}
          aria-label="Satuan"
        >
          {UNITS.map((u) => (
            <option key={u} value={u}>
              per {displayUnit(u).label}
            </option>
          ))}
        </select>
        <button
          type="button"
          className="btn-ghost border border-line py-1.5"
          onClick={add}
          disabled={!adding.name.trim() || !adding.price.trim()}
        >
          <Plus size={15} aria-hidden="true" /> Tambah
        </button>
      </div>
      <label className="mt-3 flex items-center gap-2 text-[13px] text-muted">
        Bumbu, minyak & gas per porsi
        <input
          className="field w-[104px] py-1.5 text-right tabular-nums"
          inputMode="numeric"
          defaultValue={nutrition.overheadRp}
          aria-label="Bumbu, minyak & gas per porsi"
          onBlur={(e) => {
            const v = Number(e.target.value.replace(/[^\d]/g, ''))
            if (v !== nutrition.overheadRp) void save(nutrition.prices, v)
          }}
        />
        <span className="text-xs text-faint">({formatRupiah(nutrition.overheadRp)})</span>
      </label>
      <p className="mt-2 text-xs text-faint">
        Nama bahan harus sama dengan yang tertulis di bahan menu (mis. "Dada ayam", satuan g) supaya biayanya terhitung.
      </p>
    </section>
  )
}
