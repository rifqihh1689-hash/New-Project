import { Download, LogIn, LogOut, RefreshCw } from 'lucide-react'
import { PageTop } from '../../components/PageTop'
import { useToast } from '../../components/toast-context'
import { backupFileName, createBackup } from '../../db/backup'
import { login, logout, syncNow, useSyncInfo } from '../../db/cloud'
import { CLOUD_URL } from '../../db/db'
import type { ThemePreference } from '../../types'
import { SyncDot } from '../nav/SyncBadge'
import { useInstallPrompt } from '../pwa/install'
import { LifeStructure } from './LifeStructure'
import { RitmeSettings, StaseSettings } from './ScheduleSettings'
import { useThemeContext } from './theme-context'

const THEMES: { value: ThemePreference; label: string }[] = [
  { value: 'light', label: 'Terang' },
  { value: 'dark', label: 'Gelap' },
  { value: 'system', label: 'Ikuti sistem' },
]

export function SettingsPage() {
  const [theme, setTheme] = useThemeContext()
  const sync = useSyncInfo()
  const toast = useToast()
  const install = useInstallPrompt()

  const exportJson = async () => {
    const backup = await createBackup()
    const blob = new Blob([JSON.stringify(backup, null, 2)], { type: 'application/json' })
    const a = document.createElement('a')
    a.href = URL.createObjectURL(blob)
    a.download = backupFileName()
    document.body.appendChild(a)
    a.click()
    setTimeout(() => {
      URL.revokeObjectURL(a.href)
      a.remove()
    }, 1500)
    toast({ message: 'Backup JSON diunduh.' })
  }
  const run = (fn: () => Promise<void>, ok?: string) => async () => {
    try {
      await fn()
      if (ok) toast({ message: ok })
    } catch (e) {
      toast({ message: `Gagal: ${(e as Error).message}`, tone: 'error' })
    }
  }

  return (
    <>
      <PageTop title="Setelan & akun" />
      <h1 className="mt-4 text-[26px] font-semibold tracking-tight md:hidden">Setelan</h1>
      <div className="mx-auto mt-4 grid max-w-2xl gap-3 md:mt-[26px]">
        <section className="card">
          <h2 className="card-title">Sinkron &amp; akun</h2>
          <div className="flex items-center gap-2.5 text-[13px]">
            <SyncDot mode={sync.mode} />
            <span className="flex-1">
              {sync.label}
              {sync.email && <span className="block text-muted">{sync.email}</span>}
            </span>
          </div>
          {CLOUD_URL ? (
            <div className="mt-3 flex flex-wrap gap-2">
              {sync.email ? (
                <>
                  <button type="button" className="btn-ghost border border-line" onClick={run(syncNow, 'Sinkron selesai.')}>
                    <RefreshCw size={15} aria-hidden="true" /> Sinkron sekarang
                  </button>
                  <button type="button" className="btn-ghost border border-line" onClick={run(logout)}>
                    <LogOut size={15} aria-hidden="true" /> Keluar
                  </button>
                </>
              ) : (
                <button type="button" className="btn-primary" onClick={run(login)}>
                  <LogIn size={15} aria-hidden="true" /> Masuk dengan email
                </button>
              )}
            </div>
          ) : (
            <p className="mt-2 text-[13px] text-muted">
              Data tersimpan di perangkat ini saja. Sinkron HP, iPad, dan laptop aktif setelah database Dexie Cloud dibuat dan URL-nya diisi
              saat build (lihat README › Sinkron).
            </p>
          )}
        </section>

        <section className="card">
          <h2 className="card-title">Tema</h2>
          <div role="radiogroup" aria-label="Tema" className="flex rounded-full bg-surface-2 p-[3px]">
            {THEMES.map((t) => (
              <button
                key={t.value}
                type="button"
                role="radio"
                aria-checked={theme === t.value}
                onClick={() => setTheme(t.value)}
                className={`flex-1 rounded-full px-3 py-1.5 text-[13px] ${theme === t.value ? 'bg-surface text-text shadow-sm' : 'text-muted'}`}
              >
                {t.label}
              </button>
            ))}
          </div>
        </section>

        <section className="card">
          <h2 className="card-title">Impor jadwal</h2>
          <p className="mb-3 text-[13px] text-muted">
            Jadwal harian, program latihan, tugas, jadwal jaga, dan stase dari Google Sheets, CSV, atau balasan Claude (untuk screenshot,
            PDF, catatan).
          </p>
          <a href="#/impor" className="btn-primary">
            Buka Impor
          </a>
        </section>
        <StaseSettings />
        <RitmeSettings />
        <LifeStructure />

        <section className="card">
          <h2 className="card-title">Data milikmu</h2>
          <p className="mb-3 text-[13px] text-muted">
            Export semua data ke JSON kapan saja, walau sudah sinkron. Impor (termasuk dari MBAPPE OS) menyusul di Fase 1.
          </p>
          <button type="button" className="btn-ghost border border-line" onClick={() => void exportJson()}>
            <Download size={15} aria-hidden="true" /> Export JSON
          </button>
        </section>

        {!install.installed && (
          <section className="card">
            <h2 className="card-title">Pasang di layar utama</h2>
            {install.canInstall ? (
              <button type="button" className="btn-primary" onClick={() => void install.install()}>
                Pasang Qawwam
              </button>
            ) : (
              <p className="text-[13px] text-muted">
                iPhone/iPad: buka di Safari → Bagikan → Tambah ke Layar Utama. Android/laptop: menu browser → Pasang aplikasi.
              </p>
            )}
          </section>
        )}

        <p className="py-2 text-center text-xs text-faint">Qawwam v{__APP_VERSION__} · قَوَّام</p>
      </div>
    </>
  )
}
