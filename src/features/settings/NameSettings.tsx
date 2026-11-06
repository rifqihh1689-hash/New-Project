import { useToast } from '../../components/toast-context'
import { updateProfile, useProfile } from '../../db/structure'

/** Nama panggilan untuk sapaan di Beranda ("Selamat pagi, Rifqi."). */
export function NameSettings() {
  const profile = useProfile()
  const toast = useToast()
  if (!profile) return null
  return (
    <section className="card">
      <h2 className="card-title">Nama panggilan</h2>
      <input
        key={profile.name}
        className="field"
        defaultValue={profile.name}
        maxLength={24}
        placeholder="mis. Rifqi"
        aria-label="Nama panggilan"
        autoComplete="nickname"
        onBlur={(e) => {
          const name = e.target.value.trim()
          if (name === profile.name) return
          void updateProfile({ name }).then(() =>
            toast({ message: name ? `Sapaan Beranda: "Selamat pagi, ${name}."` : 'Nama panggilan dikosongkan.' }),
          )
        }}
      />
      <p className="mt-1.5 text-xs text-faint">Dipakai untuk sapaan di Beranda. Boleh dikosongkan.</p>
    </section>
  )
}
