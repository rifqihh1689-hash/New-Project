import {
  BookOpen,
  BookOpenText,
  CalendarDays,
  Dumbbell,
  FileText,
  Gift,
  House,
  Inbox,
  RefreshCw,
  SquareCheck,
  Target,
  Users,
  UtensilsCrossed,
  Wallet,
  type LucideIcon,
} from 'lucide-react'
import type { RouteName } from '../../app/router'

export interface NavItem {
  route: RouteName
  label: string
  Icon: LucideIcon
  /** Belum dibangun: fase rencana di DESIGN.md. */
  soon?: { phase: 1 | 2 | 3; what: string }
}

export const NAV_ITEMS: NavItem[] = [
  { route: 'beranda', label: 'Beranda', Icon: House },
  { route: 'tugas', label: 'Tugas', Icon: SquareCheck },
  { route: 'kalender', label: 'Kalender & jaga', Icon: CalendarDays },
  {
    route: 'belajar',
    label: 'Belajar UKMPPD',
    Icon: BookOpen,
    soon: { phase: 3, what: 'Bank soal per sistem organ, blok belajar, dan tryout.' },
  },
  { route: 'tentir', label: 'Tentir', Icon: Users },
  { route: 'uang', label: 'Uang', Icon: Wallet },
  { route: 'habit', label: 'Habit & ibadah', Icon: RefreshCw },
  { route: 'menu', label: 'Menu', Icon: UtensilsCrossed },
  { route: 'latihan', label: 'Latihan', Icon: Dumbbell },
  { route: 'hadiah', label: 'Hadiah', Icon: Gift },
  {
    route: 'target',
    label: 'Target & PPDS',
    Icon: Target,
    soon: { phase: 3, what: 'Main Quest (maks. 3 aktif), portofolio PPDS, systematic review, IELTS.' },
  },
  { route: 'catatan', label: 'Catatan', Icon: FileText, soon: { phase: 2, what: 'Catatan per peran, warna, dan sematan.' } },
  { route: 'muhasabah', label: 'Muhasabah', Icon: BookOpenText },
  { route: 'usulan', label: 'Usulan', Icon: Inbox },
]
