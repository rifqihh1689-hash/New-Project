import { describe, expect, it } from 'vitest'
import { DEFAULT_ROLES } from '../db/defaults'
import { parseDate, parseDelimited, parseImport, parseWeekdays } from './importer'

const ctx = { roles: DEFAULT_ROLES, today: '2026-11-05' }

describe('nilai', () => {
  it('hari dalam minggu', () => {
    expect(parseWeekdays('Sen, Rab, Jum')).toEqual([1, 3, 5])
    expect(parseWeekdays('Senin-Jumat')).toEqual([1, 2, 3, 4, 5])
    expect(parseWeekdays('Sab dan Min')).toEqual([0, 6])
    expect(parseWeekdays('setiap hari')).toEqual([])
    expect(parseWeekdays('Mon Wed')).toEqual([1, 3])
    expect(parseWeekdays('kadang')).toBeNull()
  })

  it('tanggal gaya Indonesia', () => {
    expect(parseDate('2026-11-12', '2026-11-05')).toBe('2026-11-12')
    expect(parseDate('12/11/2026', '2026-11-05')).toBe('2026-11-12')
    expect(parseDate('12-11', '2026-11-05')).toBe('2026-11-12')
    expect(parseDate('3 Des', '2026-11-05')).toBe('2026-12-03')
    expect(parseDate('6 november 2026', '2026-11-05')).toBe('2026-11-06')
    expect(parseDate('31/2', '2026-11-05')).toBeNull()
  })

  it('CSV dengan tanda kutip & TSV dari Google Sheets', () => {
    expect(parseDelimited('a,b\n"x, y",2')).toEqual([
      ['a', 'b'],
      ['x, y', '2'],
    ])
    expect(parseDelimited('a\tb\nx\ty')).toEqual([
      ['a', 'b'],
      ['x', 'y'],
    ])
  })
})

describe('impor', () => {
  it('sel tempelan dari Google Sheets (TSV) berbagai jenis', () => {
    const tsv = [
      'Jenis\tTipe hari\tTanggal\tHari\tJam\tSampai\tJudul\tPeran\tMenit\tCatatan',
      'ritme\tstase\t\t\t6.00\t16.00\tStase\tkoas\t\t',
      'ritme\tstase, libur\t\t\t12.00\t\tMakan siang\t\t\t',
      'latihan\t\t\tSen, Rab, Jum\t\t\tUpper body\t\t45\tBench 3x5, row 3x8',
      'tugas\t\t12/11\t\t\t\tPresentasi lapsus\tkoas\t\t',
      'jaga\t\t14/11\t\t\t\t\t\t\t',
    ].join('\n')
    const rows = parseImport(tsv, ctx)
    expect(rows.every((r) => !r.error)).toBe(true)
    expect(rows.map((r) => r.item?.kind)).toEqual(['ritme', 'ritme', 'ritme', 'habit', 'tugas', 'jaga'])
    expect(rows[0].item).toEqual({
      kind: 'ritme',
      dayType: 'stase',
      slot: { time: '06.00', until: '16.00', title: 'Stase', roleId: '#role:koas', work: true },
    })
    expect(rows[3].item).toMatchObject({
      name: 'Upper body',
      weekdays: [1, 3, 5],
      minutes: 45,
      roleId: '#role:pulih',
      note: 'Bench 3x5, row 3x8',
    })
    expect(rows[4].item).toEqual({ kind: 'tugas', title: 'Presentasi lapsus', date: '2026-11-12', roleId: '#role:koas', important: false })
    expect(rows[5].item).toEqual({ kind: 'jaga', date: '2026-11-14' })
  })

  it('balasan JSON Claude dibungkus ```json', () => {
    const reply =
      'Berikut hasilnya:\n```json\n{"items":[{"jenis":"stase","judul":"Stase Anak","mulai":"2026-12-14","selesai":"2027-01-24","masuk":"06.30","pulang":"14.00","bobot":"sedang"},{"jenis":"habit","judul":"Lari easy","hari":["Sel","Kam"],"menit":30}]}\n```'
    const rows = parseImport(reply, ctx)
    expect(rows[0].item).toEqual({
      kind: 'stase',
      name: 'Stase Anak',
      start: '2026-12-14',
      end: '2027-01-24',
      masuk: '06.30',
      pulang: '14.00',
      weight: 'sedang',
    })
    expect(rows[1].item).toMatchObject({ kind: 'habit', name: 'Lari easy', weekdays: [2, 4], minutes: 30 })
  })

  it('tanpa kolom jenis memakai jenis pilihan', () => {
    const rows = parseImport('judul,tanggal,penting\nBayar kos,30/11,ya', { ...ctx, defaultKind: 'tugas' })
    expect(rows[0].item).toMatchObject({ kind: 'tugas', title: 'Bayar kos', date: '2026-11-30', roleId: '#role:uang', important: true })
  })

  it('baris salah diberi alasan dengan nomor baris, identitas pasien ditandai', () => {
    const rows = parseImport('jenis,tanggal,judul\ntugas,besok?,Laporan\nterbang,,x\ntugas,12/11,FU Tn. Budi', ctx)
    expect(rows[0]).toMatchObject({ line: 2, error: expect.stringMatching(/Tanggal/) })
    expect(rows[1]).toMatchObject({ line: 3, error: expect.stringMatching(/tidak dikenal/) })
    expect(rows[2]).toMatchObject({ line: 4, phi: 'sapaan + nama pasien' })
  })

  it('teks tanpa kepala kolom ditolak dengan jelas', () => {
    expect(parseImport('hanya catatan biasa', ctx)[0].error).toMatch(/nama kolom/)
  })
})

describe('impor menu', () => {
  it('menu dari Sheets dan dari Claude (kolom "waktu" berisi nama waktu makan)', () => {
    const tsv =
      'jenis\tjudul\tsumber\twaktu_makan\tprotein\tbiaya\tbahan\tbekal\nmenu\tAyam bakar madu\tmasak\tsiang, malam\t40\t12rb\tDada ayam 130 g; Beras 80 g\tya'
    expect(parseImport(tsv, ctx)[0].item).toEqual({
      kind: 'menu',
      name: 'Ayam bakar madu',
      source: 'masak',
      slots: ['siang', 'malam'],
      proteinG: 40,
      costRp: 12_000,
      ingredients: [
        { name: 'Dada ayam', qty: 130, unit: 'g' },
        { name: 'Beras', qty: 80, unit: 'g' },
      ],
      bekal: true,
      heavyCook: false,
    })
    const json =
      '```json\n[{"jenis":"menu","judul":"Nasi geprek","sumber":"beli","waktu":"siang","protein":25,"biaya":15000,"tempat":"warung"}]\n```'
    expect(parseImport(json, ctx)[0].item).toMatchObject({
      kind: 'menu',
      source: 'beli',
      slots: ['siang'],
      costRp: 15_000,
      place: 'warung',
      ingredients: [],
    })
  })
})

describe('keuangan', () => {
  const money = { ...ctx, debts: ['Pinjaman kakak'], savings: ['Dana jembatan'] }
  const one = (o: Record<string, unknown>, c = money) => parseImport(JSON.stringify([o]), c)[0]

  it('pemasukan & pengeluaran: jumlah angka atau teks, kategori dicocokkan atau ditebak', () => {
    expect(one({ jenis: 'pemasukan', jumlah: 1_500_000, catatan: 'kiriman ortu' }).item).toEqual({
      kind: 'transaksi',
      type: 'income',
      amount: 1_500_000,
      date: '2026-11-05',
      categoryId: '#cat:kiriman',
      note: 'kiriman ortu',
    })
    expect(one({ jenis: 'pengeluaran', jumlah: '1,5jt', kategori: 'kos', tanggal: '1/11' }).item).toMatchObject({
      type: 'expense',
      amount: 1_500_000,
      categoryId: '#cat:tagihan',
      date: '2026-11-01',
    })
    expect(one({ jenis: 'pengeluaran', jumlah: '25rb', catatan: 'makan siang warteg' }).item).toMatchObject({ categoryId: '#cat:makan' })
    // Angka polos dari JSON dipakai apa adanya (25 ≠ 25rb di sini).
    expect(one({ jenis: 'pengeluaran', jumlah: 25 }).item).toMatchObject({ amount: 25 })
    expect(one({ jenis: 'pengeluaran', jumlah: 'banyak' }).error).toMatch(/Jumlah/)
    expect(one({ jenis: 'pengeluaran', jumlah: 50_000, kategori: 'Tentir' }).error).toMatch(/tidak ada untuk pengeluaran/)
  })

  it('utang baru dengan target lunas', () => {
    expect(one({ jenis: 'hutang', judul: 'Cicilan laptop', jumlah: 6_000_000, target: '30/6/2027' }).item).toEqual({
      kind: 'utang',
      name: 'Cicilan laptop',
      amount: 6_000_000,
      targetDate: '2027-06-30',
    })
  })

  it('cicilan & setoran ke yang sudah ada (nama tanpa beda huruf besar); penarikan negatif', () => {
    expect(one({ jenis: 'cicilan', judul: 'pinjaman KAKAK', jumlah: 500_000 }).item).toMatchObject({
      name: 'Pinjaman kakak',
      amount: 500_000,
    })
    expect(one({ jenis: 'cicilan', judul: 'Pinjaman teman', jumlah: 1 }).error).toMatch(/tidak ditemukan \(yang ada: Pinjaman kakak\)/)
    expect(one({ jenis: 'penarikan', judul: 'Dana jembatan', jumlah: 200_000 }).item).toMatchObject({ kind: 'setoran', amount: -200_000 })
    expect(one({ jenis: 'setoran', judul: 'Dana jembatan', jumlah: '-200rb' }).item).toMatchObject({ amount: -200_000 })
  })

  it('utang baru dan cicilan pertamanya dalam satu kiriman', () => {
    const rows = parseImport(
      JSON.stringify([
        { jenis: 'utang', judul: 'Cicilan laptop', jumlah: 6_000_000 },
        { jenis: 'cicilan', judul: 'cicilan laptop', jumlah: 500_000 },
      ]),
      money,
    )
    expect(rows.map((r) => r.error)).toEqual([undefined, undefined])
    expect(rows[1].item).toMatchObject({ kind: 'cicilan', name: 'Cicilan laptop', amount: 500_000 })
  })

  it('catatan uang juga dicek identitas pasien', () => {
    expect(one({ jenis: 'pengeluaran', jumlah: 50_000, catatan: 'obat untuk Tn. Budi' }).phi).toBeTruthy()
  })
})
