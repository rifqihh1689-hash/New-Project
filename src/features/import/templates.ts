import { IMPORT_ITEM_GUIDE } from '../../domain/importGuide'
import type { Role } from '../../types'

const COLUMNS = [
  'jenis',
  'tipe_hari',
  'tanggal',
  'hari',
  'jam',
  'sampai',
  'judul',
  'peran',
  'menit',
  'ukuran',
  'penting',
  'catatan',
  'mulai',
  'selesai',
  'masuk',
  'pulang',
  'bobot',
  'jumlah',
  'kategori',
  'target',
]

const EXAMPLES: Record<string, string>[] = [
  { jenis: 'ritme', tipe_hari: 'stase', jam: '03.45', judul: 'Qiyamul lail', peran: 'ibadah' },
  { jenis: 'ritme', tipe_hari: 'stase', jam: '06.00', sampai: '14.00', judul: 'Stase', peran: 'koas' },
  { jenis: 'ritme', tipe_hari: 'stase', jam: '14.30', judul: 'Qailulah', peran: 'pulih', catatan: '60 mnt' },
  {
    jenis: 'habit',
    hari: 'Sen, Rab, Jum',
    judul: 'Latihan beban',
    peran: 'pulih',
    menit: '45',
    ukuran: 'besar',
    catatan: 'Bench 3x5, row 3x8, squat 3x5',
  },
  { jenis: 'tugas', tanggal: '12/11', judul: 'Presentasi lapsus', peran: 'koas', penting: 'ya' },
  { jenis: 'jaga', tanggal: '14/11' },
  { jenis: 'stase', judul: 'Stase Bedah', mulai: '2/11', selesai: '13/12', masuk: '06.00', pulang: '16.00', bobot: 'berat' },
  {
    jenis: 'menu',
    judul: 'Ayam bakar madu + nasi',
    sumber: 'masak',
    waktu_makan: 'siang, malam',
    protein: '40',
    biaya: '12000',
    bahan: 'Dada ayam 130 g; Beras 80 g',
    bekal: 'ya',
  },
  {
    jenis: 'menu',
    judul: 'Nasi ayam geprek',
    sumber: 'beli',
    waktu_makan: 'siang',
    protein: '25',
    biaya: '15000',
    tempat: 'warung dekat RS',
  },
  { jenis: 'pemasukan', tanggal: '1/11', jumlah: '1500000', kategori: 'Kiriman & gaji', catatan: 'Kiriman ortu' },
  { jenis: 'pengeluaran', tanggal: '5/11', jumlah: '25rb', kategori: 'Makan', catatan: 'Makan siang' },
  { jenis: 'utang', judul: 'Pinjaman kakak', jumlah: '3000000', target: '30/6/2027' },
  { jenis: 'cicilan', judul: 'Pinjaman kakak', tanggal: '5/11', jumlah: '500000' },
  { jenis: 'setoran', judul: 'Dana jembatan', tanggal: '5/11', jumlah: '1000000' },
]

/** Template untuk ditempel ke Google Sheets: tab memisahkan kolom, jadi langsung terbagi rapi. */
export function sheetTemplate(): string {
  return [COLUMNS, ...EXAMPLES.map((e) => COLUMNS.map((c) => e[c] ?? ''))].map((row) => row.join('\t')).join('\n')
}

/** Template CSV untuk diunduh (Excel/Numbers). */
export function csvTemplate(): string {
  const esc = (v: string) => (/[",\n]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v)
  return [COLUMNS, ...EXAMPLES.map((e) => COLUMNS.map((c) => e[c] ?? ''))].map((row) => row.map(esc).join(',')).join('\n')
}

/**
 * Perintah untuk Claude: ubah screenshot/PDF/catatan jadi JSON Qawwam.
 * Ditempel di app Claude bersama lampirannya; balasannya ditempel kembali di Impor.
 */
export function claudePrompt(today: string, roles: Role[]): string {
  const roleList = roles
    .filter((r) => !r.archived)
    .map((r) => `${r.id.replace(/^#role:/, '')} (${r.name})`)
    .join(', ')
  return `Tolong ubah jadwal, program, atau catatan keuangan di lampiran (screenshot, PDF, mutasi rekening, atau catatan) menjadi data untuk app Qawwam.

Balas HANYA dengan satu blok \`\`\`json berisi {"items": [...]}. Hari ini ${today} (WIB). Tanggal pakai YYYY-MM-DD, jam pakai HH.MM.

Jenis item yang boleh:
${IMPORT_ITEM_GUIDE}

Peran yang tersedia: ${roleList}. Pakai "ibadah" untuk slot ritme ibadah.
Jangan tulis identitas pasien (nama, No. RM, tanggal lahir). Kalau ada yang tidak jelas, tebak yang paling masuk akal dan sebutkan di luar blok JSON.`
}
