import { formatRupiahShort } from '../lib/format'
import { diffDays, formatDateShort, MONTH_NAMES, weekday } from './time'
import type { DayType, ISODate } from '../types'

/**
 * Kalimat temuan Beranda: satu hal yang paling layak diperhatikan hari ini, dipilih dari data hidup
 * (tidur, tentir, tabungan, belanja, mutaba'ah, latihan, stase, fase). Sengaja tidak pernah membahas utang.
 */
export interface Insight {
  id: string
  title: string
  detail?: string
  tone: 'info' | 'good' | 'warn'
  /** Tautan rute (`#/…`) untuk menindaklanjuti. */
  href?: string
  priority: number
}

export interface InsightInput {
  today: ISODate
  /** Tipe hari efektif (pasca tidak sah dihitung stase). `null` = belum dipilih. */
  dayType: DayType | null
  /** Kalimat ritme bawaan (cadangan bila tidak ada temuan lain). */
  ritmeLine: string
  /** Total tidur (malam + qailulah) 3 hari terakhir, terbaru dulu; `null` = belum diisi. */
  sleep: (number | null)[]
  level: { level: number; into: number; need: number }
  streak: { current: number; best: number }
  tentir: { hours: number; min: number; max: number }
  money: { expense: number; budget: number }
  savings: { name: string; kind: string; saved: number; target: number; perMonth: number | null; depositedThisMonth: boolean }[]
  mutabaah: { name: string; week: number }[]
  /** Hari sejak latihan beban terakhir; `null` = belum pernah. */
  daysSinceStrength: number | null
  nextChapter: { name: string; start: ISODate; weight: 'ringan' | 'sedang' | 'berat' } | null
  /** Tanggal penting berikutnya dari fase hidup (mis. UKMPPD). */
  milestone: { name: string; date: ISODate } | null
  study: {
    weekDone: number
    weekTarget: number
    behind: boolean
    perDayLeft: number
    weakest: { system: string; accuracy: number } | null
    examDateSet: boolean
    cardsDue: number
  } | null
  ppds: {
    questCount: number
    /** Langkah berikutnya dari Main Quest aktif dengan progres terendah yang punya langkah. */
    quest: { name: string; next: string } | null
    docs: { total: number; ready: number; overdue: number }
    nextDoc: { name: string; due: ISODate } | null
  } | null
  /** Muhasabah minggu lalu bisa diisi dan belum selesai. */
  reviewOpen: boolean
}

const daysIn = (iso: ISODate) => new Date(Date.UTC(Number(iso.slice(0, 4)), Number(iso.slice(5, 7)), 0)).getUTCDate()
const hrs = (h: number) => `${h.toLocaleString('id-ID', { maximumFractionDigits: 1 })} j`

export function pickInsights(i: InsightInput): Insight[] {
  const out: Insight[] = []
  const add = (x: Insight) => out.push(x)
  const recovering = i.dayType === 'pasca' || i.dayType === 'jaga'

  // Tidur: paling menentukan hari, jadi paling depan bila kurang.
  const nights = i.sleep.filter((x): x is number => x != null)
  if (nights.length >= 2) {
    const avg = nights.reduce((a, b) => a + b, 0) / nights.length
    if (avg < 6)
      add({
        id: 'tidur-kurang',
        title: `Tidur ${nights.length} hari terakhir rata-rata ${hrs(avg)}.`,
        detail: recovering
          ? 'Utamakan tidur pulih; yang lain bisa menunggu.'
          : 'Jangan tambah beban hari ini. Qailulah 60 mnt paling berharga sekarang.',
        tone: 'warn',
        priority: 90,
      })
    else if (avg >= 6.5 && nights.length >= 3)
      add({
        id: 'tidur-baik',
        title: `Tidur 3 hari terakhir rata-rata ${hrs(avg)}.`,
        detail: 'Pengali XP penuh. Pakai energinya untuk blok belajar.',
        tone: 'good',
        priority: 30,
      })
  }

  if (i.dayType == null || recovering) {
    add({ id: 'ritme', title: i.ritmeLine, tone: 'info', priority: i.dayType == null ? 95 : 70 })
    return out.sort((a, b) => b.priority - a.priority)
  }

  // Pergantian stase dalam seminggu.
  if (i.nextChapter) {
    const d = diffDays(i.nextChapter.start, i.today)
    if (d >= 0 && d <= 7) {
      const when = d === 0 ? 'hari ini' : d === 1 ? 'besok' : formatDateShort(i.nextChapter.start)
      add({
        id: 'stase-baru',
        title: `${i.nextChapter.name} mulai ${when}.`,
        detail:
          i.nextChapter.weight === 'ringan'
            ? 'Stase ringan: waktu yang pas menambah blok belajar atau jam tentir.'
            : i.nextChapter.weight === 'berat'
              ? 'Stase berat: siapkan bekal, tidur, dan kurangi tentir minggu itu.'
              : 'Cek jam masuk & pulangnya di Setelan supaya ritme ikut menyesuaikan.',
        tone: 'info',
        href: '#/kalender',
        priority: 75,
      })
    }
  }

  // Level & streak.
  const toNext = i.level.need - i.level.into
  if (toNext > 0 && toNext <= 40)
    add({
      id: 'level',
      title: `${toNext} XP lagi naik ke level ${i.level.level + 1}.`,
      detail: 'Naik level = 1 token hadiah.',
      tone: 'good',
      href: '#/hadiah',
      priority: 60,
    })
  if (i.streak.current >= 3 && i.streak.current >= i.streak.best)
    add({
      id: 'streak',
      title: `Streak ${i.streak.current} hari, rekor terbaikmu.`,
      detail: 'Cukup lolos 60% hari ini untuk menjaganya.',
      tone: 'good',
      priority: 55,
    })

  // Muhasabah mingguan.
  if (i.reviewOpen)
    add({
      id: 'muhasabah',
      title: 'Muhasabah minggu lalu belum diisi.',
      detail: '10 menit, +50 XP, dan 3 prioritas minggu ini.',
      tone: 'info',
      href: '#/muhasabah',
      priority: 58,
    })

  // Tentir terhadap kuota minggu ini.
  const daysLeft = 7 - ((weekday(i.today) + 6) % 7)
  if (i.tentir.hours > i.tentir.max)
    add({
      id: 'tentir-lewat',
      title: `Tentir minggu ini ${hrs(i.tentir.hours)}, lewat batas ${i.tentir.max} j.`,
      detail: 'Tolak sesi tambahan; naikkan tarif, bukan jamnya.',
      tone: 'warn',
      href: '#/tentir',
      priority: 65,
    })
  else if (daysLeft <= 4 && i.tentir.hours < i.tentir.min)
    add({
      id: 'tentir-kurang',
      title: `Tentir minggu ini ${hrs(i.tentir.hours)} dari minimal ${i.tentir.min} j.`,
      detail: `Sisa ${daysLeft} hari. Kurang ${hrs(i.tentir.min - i.tentir.hours)}.`,
      tone: 'info',
      href: '#/tentir',
      priority: 50,
    })

  // Laju belanja bulan ini terhadap anggaran.
  if (i.money.budget > 0) {
    const day = Number(i.today.slice(8))
    const used = i.money.expense / i.money.budget
    const elapsed = day / daysIn(i.today)
    if (used > 1)
      add({
        id: 'anggaran-lewat',
        title: 'Pengeluaran bulan ini sudah melewati anggaran.',
        detail: `Lewat ${formatRupiahShort(i.money.expense - i.money.budget)}.`,
        tone: 'warn',
        href: '#/uang',
        priority: 62,
      })
    else if (used > elapsed + 0.15)
      add({
        id: 'anggaran-cepat',
        title: `Pengeluaran ${Math.round(used * 100)}% anggaran, bulan baru jalan ${Math.round(elapsed * 100)}%.`,
        detail: `Sisa ${formatRupiahShort(i.money.budget - i.money.expense)} untuk ${daysIn(i.today) - day} hari.`,
        tone: 'warn',
        href: '#/uang',
        priority: 57,
      })
  }

  // Tabungan: dana jembatan dulu.
  const bridge = i.savings.find((s) => s.kind === 'jembatan')
  if (!bridge)
    add({
      id: 'jembatan-belum',
      title: 'Dana jembatan belum dibuat.',
      detail: 'Bantalan biaya hidup untuk jeda koas → PPDS. Mulai dari target kecil di Uang.',
      tone: 'info',
      href: '#/uang',
      priority: 35,
    })
  else if (bridge.saved >= bridge.target)
    add({
      id: 'jembatan-tercapai',
      title: `${bridge.name} sudah tercapai.`,
      detail: 'Hadiah berbiaya terbuka.',
      tone: 'good',
      href: '#/hadiah',
      priority: 45,
    })
  else if (!bridge.depositedThisMonth && Number(i.today.slice(8)) >= 20)
    add({
      id: 'jembatan-setor',
      title: `${bridge.name} belum ada setoran bulan ini.`,
      detail: bridge.perMonth
        ? `Targetnya ${formatRupiahShort(bridge.perMonth)}/bln.`
        : `Terkumpul ${Math.round((bridge.saved / bridge.target) * 100)}%.`,
      tone: 'info',
      href: '#/uang',
      priority: 48,
    })
  else
    add({
      id: 'jembatan-progres',
      title: `${bridge.name} ${Math.round((bridge.saved / bridge.target) * 100)}% terkumpul.`,
      detail: `${formatRupiahShort(bridge.saved)} dari ${formatRupiahShort(bridge.target)}.`,
      tone: 'good',
      href: '#/uang',
      priority: 20,
    })

  // Mutaba'ah: rayakan yang konsisten, ingatkan yang terlewat seminggu.
  const best = [...i.mutabaah].sort((a, b) => b.week - a.week)[0]
  if (best && best.week >= 6)
    add({
      id: 'mutabaah-baik',
      title: `${best.name} ${best.week} dari 7 hari terakhir.`,
      detail: 'Konsisten. Pertahankan.',
      tone: 'good',
      priority: 28,
    })
  const missed = i.mutabaah.find((m) => m.week === 0)
  if (missed)
    add({
      id: 'mutabaah-lewat',
      title: `${missed.name} belum tercatat 7 hari terakhir.`,
      detail: 'Mulai lagi dari yang kecil hari ini.',
      tone: 'info',
      priority: 32,
    })

  // Persiapan PPDS: tenggat berkas dan langkah Main Quest.
  if (i.ppds) {
    const p = i.ppds
    if (p.nextDoc) {
      const d = diffDays(p.nextDoc.due, i.today)
      if (d < 0)
        add({
          id: 'berkas-lewat',
          title: `${p.nextDoc.name} lewat tenggat ${-d} hari.`,
          detail: 'Tetapkan tanggal baru atau tandai siap.',
          tone: 'warn',
          href: '#/target',
          priority: 68,
        })
      else if (d <= 30)
        add({
          id: 'berkas-dekat',
          title: `${p.nextDoc.name}: ${d === 0 ? 'tenggat hari ini' : `${d} hari lagi`}.`,
          detail: `${p.docs.ready} dari ${p.docs.total} butir persiapan PPDS siap.`,
          tone: 'info',
          href: '#/target',
          priority: d <= 7 ? 61 : 44,
        })
    }
    if (p.quest)
      add({
        id: 'quest-langkah',
        title: `${p.quest.name}: ${p.quest.next}`,
        detail: 'Langkah berikutnya Main Quest.',
        tone: 'info',
        href: '#/target',
        priority: 36,
      })
    else if (p.questCount === 0)
      add({
        id: 'quest-kosong',
        title: 'Belum ada Main Quest.',
        detail: 'Pilih 1–3 tujuan besar supaya hari-harimu punya arah.',
        tone: 'info',
        href: '#/target',
        priority: 33,
      })
  }

  // Belajar UKMPPD.
  if (i.study) {
    const st = i.study
    if (st.behind)
      add({
        id: 'belajar-tertinggal',
        title: `Soal minggu ini ${st.weekDone} dari ${st.weekTarget}.`,
        detail: `Agak tertinggal. ${st.perDayLeft} soal/hari sampai Minggu cukup mengejar.`,
        tone: 'warn',
        href: '#/belajar',
        priority: 66,
      })
    else if (st.weekDone >= st.weekTarget && st.weekTarget > 0)
      add({
        id: 'belajar-tercapai',
        title: `Target soal minggu ini tercapai (${st.weekDone}).`,
        detail: 'Sisanya bonus; jaga tidur.',
        tone: 'good',
        href: '#/belajar',
        priority: 42,
      })
    if (st.weakest)
      add({
        id: 'belajar-lemah',
        title: `${st.weakest.system} sistem terlemahmu (${Math.round(st.weakest.accuracy * 100)}%).`,
        detail: 'Satu blok soal di sini hari ini paling berdampak.',
        tone: 'info',
        href: '#/belajar',
        priority: 38,
      })
    if (st.cardsDue > 0)
      add({
        id: 'kartu-jatuh-tempo',
        title: `${st.cardsDue} kartu ulasan jatuh tempo.`,
        detail: `Sekitar ${Math.max(5, Math.min(15, Math.ceil(st.cardsDue / 4)))} menit. Ulasan tepat waktu yang membuat ingatan bertahan.`,
        tone: 'info',
        href: '#/belajar',
        priority: 64,
      })
    if (!st.examDateSet)
      add({
        id: 'belajar-tanggal',
        title: 'Tanggal UKMPPD belum diisi.',
        detail: 'Isi di Belajar UKMPPD untuk hitung mundur.',
        tone: 'info',
        href: '#/belajar',
        priority: 31,
      })
  }

  // Latihan beban.
  if (i.daysSinceStrength != null && i.daysSinceStrength >= 6)
    add({
      id: 'latihan',
      title: `${i.daysSinceStrength} hari tanpa latihan beban.`,
      detail: 'Sesi ringan pun cukup untuk menjaga progres.',
      tone: 'info',
      href: '#/latihan',
      priority: 40,
    })

  // Tanggal penting berikutnya (fase hidup).
  if (i.milestone) {
    const d = diffDays(i.milestone.date, i.today)
    if (d > 0) {
      const weeks = Math.round(d / 7)
      add({
        id: 'milestone',
        title: d <= 60 ? `${i.milestone.name} ${d} hari lagi.` : `${i.milestone.name} ${weeks} minggu lagi.`,
        detail: `${Number(i.milestone.date.slice(8))} ${MONTH_NAMES[Number(i.milestone.date.slice(5, 7)) - 1]} ${i.milestone.date.slice(0, 4)}`,
        tone: 'info',
        href: '#/setelan',
        // Senin lebih menonjol: awal minggu saat merencanakan.
        priority: weekday(i.today) === 1 ? 52 : 25,
      })
    }
  }

  add({ id: 'ritme', title: i.ritmeLine, tone: 'info', priority: 10 })
  return out.sort((a, b) => b.priority - a.priority)
}
