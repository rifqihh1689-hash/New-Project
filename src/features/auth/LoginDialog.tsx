import type { DXCUserInteraction } from 'dexie-cloud-addon'
import { useObservable } from 'dexie-react-hooks'
import { CircleAlert, Info, TriangleAlert } from 'lucide-react'
import { useState } from 'react'
import { Sheet } from '../../components/Sheet'
import { CLOUD_URL, db } from '../../db/db'
import { translateAlert } from './messages'

interface Copy {
  title: string
  intro?: string
  submit: string
  cancel: string | null
}

function copyFor(i: DXCUserInteraction): Copy {
  switch (i.type) {
    case 'email':
      return {
        title: 'Masuk ke Qawwam',
        intro: 'Masukkan email. Kode masuk dikirim ke email itu. Cukup sekali per perangkat, setelah itu tetap jalan offline.',
        submit: 'Kirim kode',
        cancel: 'Batal',
      }
    case 'otp':
      return { title: 'Masukkan kode', submit: 'Masuk', cancel: 'Batal' }
    case 'logout-confirmation':
      return { title: 'Keluar dari akun?', submit: 'Tetap keluar', cancel: 'Batal' }
    case 'message-alert':
      return { title: 'Pemberitahuan', submit: 'OK', cancel: null }
    default:
      return { title: i.title, submit: i.submitLabel, cancel: i.cancelLabel }
  }
}

const ALERT_ICON = { error: CircleAlert, warning: TriangleAlert, info: Info } as const

/** Email terakhir yang diketik: Dexie menutup lalu membuka ulang dialog saat ada galat, isian jangan hilang. */
let rememberedEmail = ''

/** Tampilan satu langkah masuk Dexie Cloud. Dipisah dari langganan agar mudah dites. */
export function LoginView({ interaction }: { interaction: DXCUserInteraction }) {
  const copy = copyFor(interaction)
  const fieldNames = Object.keys(interaction.fields ?? {})
  const [values, setValues] = useState<Record<string, string>>(() =>
    interaction.type === 'email' ? { email: rememberedEmail } : ({} as Record<string, string>),
  )
  const submit = () => {
    const params = Object.fromEntries(fieldNames.map((n) => [n, (values[n] ?? '').trim()]))
    if (interaction.type === 'email') rememberedEmail = params.email ?? ''
    interaction.onSubmit(params)
  }
  return (
    <Sheet open title={copy.title} onClose={() => interaction.onCancel()}>
      <form
        className="grid gap-4"
        noValidate
        onSubmit={(e) => {
          e.preventDefault()
          submit()
        }}
      >
        {copy.intro && <p className="text-[13px] text-muted">{copy.intro}</p>}
        {interaction.alerts?.map((a, i) => {
          const Icon = ALERT_ICON[a.type]
          return (
            <p
              key={`${a.messageCode}-${i}`}
              role={a.type === 'error' ? 'alert' : 'status'}
              className={`flex items-start gap-2 rounded-xl px-3 py-2.5 text-[13px] ${a.type === 'error' ? 'text-danger' : 'text-text'}`}
              style={{ background: a.type === 'error' ? 'color-mix(in srgb, var(--danger) 12%, transparent)' : 'var(--surface-2)' }}
            >
              <Icon size={16} className="mt-px shrink-0" aria-hidden="true" />
              {translateAlert(a)}
            </p>
          )
        })}
        {fieldNames.map((name) => {
          const isOtp = interaction.type === 'otp' || name === 'otp'
          const isEmail = interaction.type === 'email' || name === 'email'
          return (
            <label key={name}>
              <span className="label">{isOtp ? 'Kode dari email' : isEmail ? 'Email' : (interaction.fields[name]?.label ?? name)}</span>
              <input
                className="field"
                type={isEmail ? 'email' : interaction.fields[name]?.type === 'password' ? 'password' : 'text'}
                inputMode={isEmail ? 'email' : 'text'}
                autoComplete={isOtp ? 'one-time-code' : isEmail ? 'email' : 'off'}
                autoCapitalize={isOtp ? 'characters' : 'none'}
                autoCorrect="off"
                spellCheck={false}
                placeholder={isOtp ? 'mis. V6A7KMRF' : isEmail ? 'nama@gmail.com' : interaction.fields[name]?.placeholder}
                value={values[name] ?? ''}
                onChange={(e) => setValues((v) => ({ ...v, [name]: e.target.value }))}
              />
            </label>
          )
        })}
        <div className="flex items-center justify-end gap-2">
          {copy.cancel && (
            <button type="button" className="btn-ghost" onClick={() => interaction.onCancel()}>
              {copy.cancel}
            </button>
          )}
          <button
            type="submit"
            className={`btn-primary px-6 py-2.5 ${interaction.type === 'logout-confirmation' ? 'bg-danger text-white' : ''}`}
            disabled={fieldNames.some((n) => !(values[n] ?? '').trim())}
          >
            {copy.submit}
          </button>
        </div>
      </form>
    </Sheet>
  )
}

/** Layar masuk Qawwam (menggantikan dialog bawaan Dexie Cloud yang berbahasa Inggris). */
export function LoginDialog() {
  const interaction = useObservable(db.cloud.userInteraction)
  if (!CLOUD_URL || !interaction) return null
  // `key` mereset isian saat berpindah langkah (email → kode).
  return <LoginView key={`${interaction.type}-${interaction.title}`} interaction={interaction} />
}
