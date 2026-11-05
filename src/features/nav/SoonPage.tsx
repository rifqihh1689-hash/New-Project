import { NAV_ITEMS } from './items'
import type { RouteName } from '../../app/router'

export function SoonPage({ route }: { route: RouteName }) {
  const item = NAV_ITEMS.find((i) => i.route === route)
  if (!item?.soon) return null
  const Icon = item.Icon
  return (
    <section className="card mx-auto mt-6 max-w-xl text-center">
      <Icon size={28} strokeWidth={1.6} className="mx-auto mb-3 text-faint" aria-hidden="true" />
      <h2 className="font-serif text-[22px]">{item.label}</h2>
      <p className="mt-1 text-[13px] text-faint">Direncanakan di Fase {item.soon.phase}</p>
      <p className="mx-auto mt-3 max-w-md text-muted">{item.soon.what}</p>
      <a href="#/" className="btn-primary mt-5">
        Kembali ke Beranda
      </a>
    </section>
  )
}
