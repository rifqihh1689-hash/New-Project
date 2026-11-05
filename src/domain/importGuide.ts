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
- {"jenis":"stase","judul":"Stase ...","mulai":"YYYY-MM-DD","selesai":"YYYY-MM-DD","masuk":"06.00","pulang":"16.00","bobot":"ringan|sedang|berat"}  → rotasi stase beserta jam masuk/pulang.`
