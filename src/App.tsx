import { lazy, Suspense, useEffect, useState, type CSSProperties } from 'react'
import { useRoute, type RouteName } from './app/router'
import { useToday } from './app/useToday'
import { ToastProvider } from './components/Toast'
import { freezeLockedDays } from './db/daily'
import { runRecurring } from './db/money'
import { LoginDialog } from './features/auth/LoginDialog'
import { BerandaPage } from './features/beranda/BerandaPage'
import { CaptureSheet } from './features/capture/QuickCapture'
import { MobileTop } from './features/nav/MobileTop'
import { MorePage } from './features/nav/MorePage'
import { Sidebar } from './features/nav/Sidebar'
import { useSidebar } from './features/nav/useSidebar'
import { SoonPage } from './features/nav/SoonPage'
import { TabBar } from './features/nav/TabBar'
import { PwaUpdater } from './features/pwa/PwaUpdater'
import { useTheme } from './features/settings/theme'
import { ThemeContext } from './features/settings/theme-context'
import { useLiveQuery } from 'dexie-react-hooks'
import { db } from './db/db'

// Beranda ikut bundel awal (halaman pertama); halaman lain dimuat saat dibuka, tetap ter-cache untuk offline.
const BelajarPage = lazy(() => import('./features/belajar/BelajarPage').then((m) => ({ default: m.BelajarPage })))
const TargetPage = lazy(() => import('./features/target/TargetPage').then((m) => ({ default: m.TargetPage })))
const HabitPage = lazy(() => import('./features/habit/HabitPage').then((m) => ({ default: m.HabitPage })))
const ImportPage = lazy(() => import('./features/import/ImportPage').then((m) => ({ default: m.ImportPage })))
const CatatanPage = lazy(() => import('./features/catatan/CatatanPage').then((m) => ({ default: m.CatatanPage })))
const HadiahPage = lazy(() => import('./features/hadiah/HadiahPage').then((m) => ({ default: m.HadiahPage })))
const KalenderPage = lazy(() => import('./features/kalender/KalenderPage').then((m) => ({ default: m.KalenderPage })))
const LatihanPage = lazy(() => import('./features/latihan/LatihanPage').then((m) => ({ default: m.LatihanPage })))
const MenuPage = lazy(() => import('./features/menu/MenuPage').then((m) => ({ default: m.MenuPage })))
const TentirPage = lazy(() => import('./features/tentir/TentirPage').then((m) => ({ default: m.TentirPage })))
const UangPage = lazy(() => import('./features/uang/UangPage').then((m) => ({ default: m.UangPage })))
const UsulanPage = lazy(() => import('./features/usulan/UsulanPage').then((m) => ({ default: m.UsulanPage })))
const MuhasabahPage = lazy(() => import('./features/muhasabah/MuhasabahPage').then((m) => ({ default: m.MuhasabahPage })))
const SettingsPage = lazy(() => import('./features/settings/SettingsPage').then((m) => ({ default: m.SettingsPage })))
const TugasPage = lazy(() => import('./features/tugas/TugasPage').then((m) => ({ default: m.TugasPage })))

function Page({ name, date }: { name: RouteName; date: string | null }) {
  switch (name) {
    case 'beranda':
      return <BerandaPage />
    case 'tugas':
      return <TugasPage date={date} />
    case 'muhasabah':
      return <MuhasabahPage date={date} />
    case 'belajar':
      return <BelajarPage />
    case 'target':
      return <TargetPage />
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
  const [sidebarCollapsed, toggleSidebar] = useSidebar()
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
    <div
      // Lebar sidebar lewat variabel supaya kolom grid & latar ikut berubah saat diciutkan.
      style={{ '--sbw': sidebarCollapsed ? '68px' : '232px' } as CSSProperties}
      className="min-h-dvh md:grid md:grid-cols-[var(--sbw)_1fr] md:bg-[linear-gradient(to_right,var(--side)_calc(var(--sbw)_-_1px),var(--line)_calc(var(--sbw)_-_1px)_var(--sbw),var(--bg)_var(--sbw))] md:transition-[grid-template-columns] md:duration-300 md:ease-out"
    >
      <Sidebar
        active={route.name}
        counts={{ tugas: openTasks ? String(openTasks) : undefined }}
        collapsed={sidebarCollapsed}
        onToggle={toggleSidebar}
      />
      <div className="min-w-0">
        <MobileTop />
        <main className="mx-auto w-full max-w-[1240px] px-4 pb-[calc(110px+var(--safe-bottom))] md:px-8 md:pt-[22px] md:pb-12">
          {/* Kunci per rute: setiap pindah halaman, isinya masuk dengan animasi halus. */}
          <div key={route.name} className="animate-page-in">
            <Suspense fallback={null}>
              <Page name={route.name} date={route.date} />
            </Suspense>
          </div>
        </main>
      </div>
      {/* Latar status bar iPhone: isi halaman yang digulir tidak lagi menumpuk di bawah jam & baterai. */}
      <div
        aria-hidden="true"
        className="pointer-events-none fixed inset-x-0 top-0 z-40 h-[var(--safe-top)] bg-bg/90 backdrop-blur-md md:hidden"
      />
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
