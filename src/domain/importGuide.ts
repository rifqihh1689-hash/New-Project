/**
 * Format item JSON Qawwam, dipakai perintah Impor untuk Claude dan tool `propose` di connector.
 * Satu sumber supaya keduanya tidak pernah berbeda.
 */
export const IMPORT_ITEM_GUIDE = `- {"jenis":"ritme","tipe_hari":"stase|jaga|pasca|libur","jam":"06.00","sampai":"14.00","judul":"...","peran":"...","catatan":"..."}  → jadwal harian berulang; satu set lengkap per tipe hari (menggantikan jadwal lama tipe itu).
- {"jenis":"habit","judul":"...","hari":["Sen","Rab","Jum"],"tipe_hari":["stase","libur"],"menit":45,"ukuran":"kecil|sedang|besar","peran":"pulih","catatan":"detail, mis. set & repetisi"}  → kebiasaan/program latihan berulang. "hari" kosong = setiap hari.
- {"jenis":"tugas","judul":"...","tanggal":"YYYY-MM-DD","peran":"...","penting":true}  → tugas sekali di tanggal tertentu.
- {"jenis":"jaga","tanggal":"YYYY-MM-DD"}  → malam jaga. Besoknya otomatis pasca-jaga bila belum diisi.
- {"jenis":"agenda","judul":"...","tanggal":"YYYY-MM-DD","jam":"08.00","sampai":"10.00","peran":"..."}  → agenda/acara sekali (ujian, seminar, rapat); jam boleh kosong.
- {"jenis":"menu","judul":"...","sumber":"masak|beli","waktu_makan":["sarapan","siang","malam","snack"],"protein":40,"biaya":12000,"bahan":"Dada ayam 130 g; Beras 80 g","bekal":true,"tempat":"..."}  → daftar menu makan; protein (gram) & biaya (Rupiah) per porsi, bahan per porsi untuk menu masak.
- {"jenis":"stase","judul":"Stase ...","mulai":"YYYY-MM-DD","selesai":"YYYY-MM-DD","masuk":"06.00","pulang":"16.00","bobot":"ringan|sedang|berat"}  → rotasi stase beserta jam masuk/pulang.
- {"jenis":"pemasukan","jumlah":500000,"tanggal":"YYYY-MM-DD","kategori":"Kiriman & gaji","catatan":"kiriman ortu"}  → uang masuk. Jumlah dalam Rupiah (angka, atau "500rb"/"1,5jt"); tanggal kosong = hari ini; kategori kosong = ditebak dari catatan.
- {"jenis":"pengeluaran","jumlah":25000,"tanggal":"YYYY-MM-DD","kategori":"Makan","catatan":"makan siang"}  → uang keluar. Kategori bawaan: Makan, Transportasi, Kos & tagihan, Belajar & buku, Kesehatan, Sedekah & infak, Belanja, Hiburan, Lainnya (pemasukan: Tentir, Kiriman & gaji, Lainnya).
- {"jenis":"utang","judul":"Pinjaman kakak","jumlah":3000000,"target":"YYYY-MM-DD"}  → utang baru (target = tanggal ingin lunas, boleh kosong). Nama sama = jumlah & target diperbarui.
- {"jenis":"cicilan","judul":"Pinjaman kakak","jumlah":500000,"tanggal":"YYYY-MM-DD"}  → bayar utang yang sudah ada (nama harus sama).
- {"jenis":"setoran","judul":"Dana jembatan","jumlah":1000000,"tanggal":"YYYY-MM-DD"}  → setor ke tabungan yang sudah ada; "jenis":"penarikan" untuk menarik.`
