import {
  BookOpen,
  BookOpenText,
  CalendarDays,
  FileText,
  House,
  RefreshCw,
  SquareCheck,
  Target,
  Users,
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
  {
    route: 'kalender',
    label: 'Kalender & jaga',
    Icon: CalendarDays,
    soon: { phase: 2, what: 'Agenda, jadwal jaga, dan jadwal stase. Jadwal jaga otomatis menyetel tipe hari.' },
  },
  {
    route: 'belajar',
    label: 'Belajar UKMPPD',
    Icon: BookOpen,
    soon: { phase: 3, what: 'Bank soal per sistem organ, blok belajar, dan tryout.' },
  },
  {
    route: 'tentir',
    label: 'Tentir',
    Icon: Users,
    soon: { phase: 2, what: 'Sesi tentir, jam vs kapasitas 9–15 j/minggu. Sesi tercatat otomatis jadi pemasukan.' },
  },
  {
    route: 'uang',
    label: 'Uang',
    Icon: Wallet,
    soon: { phase: 2, what: 'Port Dompetku: transaksi, anggaran, berulang, ditambah tabungan, utang, dan dana jembatan.' },
  },
  {
    route: 'habit',
    label: 'Habit & ibadah',
    Icon: RefreshCw,
    soon: { phase: 1, what: "Atur habit harian per tipe hari dan daftar mutaba'ah, konsistensi 7 & 30 hari, impor data MBAPPE OS." },
  },
  {
    route: 'target',
    label: 'Target & PPDS',
    Icon: Target,
    soon: { phase: 3, what: 'Main Quest (maks. 3 aktif), portofolio PPDS, systematic review, IELTS.' },
  },
  { route: 'catatan', label: 'Catatan', Icon: FileText, soon: { phase: 2, what: 'Catatan per peran, warna, dan sematan.' } },
  {
    route: 'muhasabah',
    label: 'Muhasabah',
    Icon: BookOpenText,
    soon: { phase: 1, what: 'Review mingguan 15–30 menit: berhasil, macet, fokus, dan 3 prioritas minggu depan.' },
  },
]
