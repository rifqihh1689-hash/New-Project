import { useEffect, useState } from 'react'
import { useRoute, type RouteName } from './app/router'
import { useToday } from './app/useToday'
import { ToastProvider } from './components/Toast'
import { freezeLockedDays } from './db/daily'
import { runRecurring } from './db/money'
import { LoginDialog } from './features/auth/LoginDialog'
import { BerandaPage } from './features/beranda/BerandaPage'
import { CaptureSheet } from './features/capture/QuickCapture'
import { HabitPage } from './features/habit/HabitPage'
import { ImportPage } from './features/import/ImportPage'
import { CatatanPage } from './features/catatan/CatatanPage'
import { HadiahPage } from './features/hadiah/HadiahPage'
import { KalenderPage } from './features/kalender/KalenderPage'
import { LatihanPage } from './features/latihan/LatihanPage'
import { MenuPage } from './features/menu/MenuPage'
import { TentirPage } from './features/tentir/TentirPage'
import { UangPage } from './features/uang/UangPage'
import { UsulanPage } from './features/usulan/UsulanPage'
import { MuhasabahPage } from './features/muhasabah/MuhasabahPage'
import { MobileTop } from './features/nav/MobileTop'
import { MorePage } from './features/nav/MorePage'
import { Sidebar } from './features/nav/Sidebar'
import { SoonPage } from './features/nav/SoonPage'
import { TabBar } from './features/nav/TabBar'
import { PwaUpdater } from './features/pwa/PwaUpdater'
import { SettingsPage } from './features/settings/SettingsPage'
import { useTheme } from './features/settings/theme'
import { ThemeContext } from './features/settings/theme-context'
import { TugasPage } from './features/tugas/TugasPage'
import { useLiveQuery } from 'dexie-react-hooks'
import { db } from './db/db'

function Page({ name, date }: { name: RouteName; date: string | null }) {
  switch (name) {
    case 'beranda':
      return <BerandaPage />
    case 'tugas':
      return <TugasPage date={date} />
    case 'muhasabah':
      return <MuhasabahPage date={date} />
    case 'habit':
      return <HabitPage />
    case 'menu':
      return <MenuPage date={date} />
    case 'latihan':
      return <LatihanPage />
    case 'tentir':
      return <TentirPage />
    case 'hadiah':
      return <HadiahPage />
    case 'usulan':
      return <UsulanPage />
    case 'uang':
      return <UangPage />
    case 'kalender':
      return <KalenderPage />
    case 'catatan':
      return <CatatanPage />
    case 'impor':
      return <ImportPage />
    case 'setelan':
      return <SettingsPage />
    case 'lainnya':
      return <MorePage />
    default:
      return <SoonPage route={name} />
  }
}

function Shell() {
  const route = useRoute()
  const today = useToday()
  const [capture, setCapture] = useState(false)
  const openTasks = useLiveQuery(
    () =>
      db.tasks
        .where('date')
        .equals(today)
        .filter((t) => !t.done)
        .count(),
    [today],
  )

  // Hari yang lewat jendela isi mundur dibekukan saat app dibuka dan saat hari berganti.
  useEffect(() => {
    void freezeLockedDays(today)
    // Transaksi berulang yang jatuh tempo dicatat otomatis (ID deterministik, aman di banyak perangkat).
    void runRecurring(today)
  }, [today])

  return (
    <div className="min-h-dvh md:grid md:grid-cols-[232px_1fr] md:bg-[linear-gradient(to_right,var(--side)_231px,var(--line)_231px_232px,var(--bg)_232px)]">
      <Sidebar active={route.name} counts={{ tugas: openTasks ? String(openTasks) : undefined }} />
      <div className="min-w-0">
        <MobileTop />
        <main className="mx-auto w-full max-w-[1240px] px-4 pb-[calc(110px+env(safe-area-inset-bottom))] md:px-8 md:pt-[22px] md:pb-12">
          {/* Kunci per rute: setiap pindah halaman, isinya masuk dengan animasi halus. */}
          <div key={route.name} className="animate-page-in">
            <Page name={route.name} date={route.date} />
          </div>
        </main>
      </div>
      <TabBar active={route.name} onCapture={() => setCapture(true)} />
      <CaptureSheet open={capture} onClose={() => setCapture(false)} />
      <PwaUpdater />
      <LoginDialog />
    </div>
  )
}

export default function App() {
  const theme = useTheme()
  return (
    <ThemeContext.Provider value={theme}>
      <ToastProvider>
        <Shell />
      </ToastProvider>
    </ThemeContext.Provider>
  )
}
