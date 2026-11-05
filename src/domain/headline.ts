import type { DayType } from '../types'
import { DAY_TYPE_LABELS } from './dayType'

export interface HeadlineContext {
  type: DayType | null
  suggested: DayType
  invalidPasca: boolean
  hasTentir: boolean
  /** Label tipe "stase" pada fase ini (mis. "Dinas" saat PPDS). */
  workLabel?: string
}

/** Kalimat pembuka Beranda. Pendek, tenang, satu arahan. */
export function headline(ctx: HeadlineContext): string {
  const work = (ctx.workLabel ?? DAY_TYPE_LABELS.stase).toLowerCase()
  switch (ctx.type) {
    case null:
      return ctx.suggested === 'pasca'
        ? 'Kemarin jaga. Pilih tipe hari dulu, mungkin hari ini pasca-jaga.'
        : `Hari ini tipe apa? Pilih dulu, isinya menyesuaikan.`
    case 'stase':
      return `Hari ${work}. Pulang ±14.00, qailulah dulu${ctx.hasTentir ? ' sebelum tentir' : ''}.`
    case 'jaga':
      return 'Malam ini jaga. Simpan tenaga, tidur sore dulu 2 jam.'
    case 'pasca':
      return ctx.invalidPasca ? `Kemarin bukan jaga, jadi hari ini dihitung hari ${work}.` : 'Pasca-jaga. Hari ini cuma satu tugas: pulih.'
    case 'libur':
      return 'Libur. Satu blok belajar panjang, sisanya istirahat.'
  }
}
