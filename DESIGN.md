# Qawwam — Desain (draf v0)

Satu app untuk mengatur hidup selama perjalanan **koas → UKMPPD → PPDS Ortopedi**.
Menggabungkan **MBAPPE OS** (`levelup`) dan **Dompetku** (`dompetku`) menjadi satu tempat yang tersinkron di HP, iPad, dan laptop, dan bisa dibaca serta diisi lewat Claude.

Status: draf hasil brainstorming, belum ada kode selain prototipe Beranda (`prototipe/beranda.html`).

## Nama

**Qawwam** (قَوَّام): yang terus-menerus tegak dan teguh menjalankan sesuatu. Dipakai di QS An-Nisa 4:135 dan Al-Ma'idah 5:8 (*kūnū qawwāmīn*).
Akarnya (q-w-m) sama dengan **qiyam** (qiyamul lail, awal harimu) dan **istiqamah** (konsisten).
Kerabatnya, **qawāmā** di QS Al-Furqan 25:67, berarti pertengahan dalam membelanjakan harta: semboyan untuk modul Uang.

Fitur review mingguan dan bulanan bernama **Muhasabah**.

## Konteks pengguna

- Koas FK UB / RSSA Malang. Koas selesai Des 2027 → UKMPPD Feb 2028 → target PPDS Ortopedi.
- Stase pagi, selesai ±14.00. Jaga malam rutin, butuh 2–3 jam pulih setelah jaga.
- Tidur 5–6 jam, bangun ±03.45 untuk qiyamul lail.
- Tentir 1:1 sebagai sampingan, kapasitas 9–15 jam per minggu.
- Perangkat: HP, iPad, laptop. Langganan Claude: Pro.

## Prinsip

Dibawa dari MBAPPE OS, ditambah aturan baru untuk sinkron dan Claude.

| Prinsip | Artinya di Qawwam |
|---|---|
| Alur harian ≤ 2 menit | Isian wajib harian cukup beberapa ketukan. Yang lain opsional. |
| Tenang dulu, game tipis | Gamifikasi hanya satu strip (level, XP, pengali tidur, streak). Tidak ada notifikasi yang mengejar. |
| Hadiah untuk pemulihan, bukan volume | Pengali tidur dari total tidur 24 jam (malam + qailulah). Rumus XP dari MBAPPE OS. |
| Tipe hari menentukan isi | STASE / JAGA / PASCA-JAGA / LIBUR. Pasca-jaga hanya berisi pemulihan, tugas lain pindah ke besok. Jaga dan pasca-jaga tidak memutus streak. |
| Mutaba'ah tanpa skor | Tidak masuk XP, level, streak. Hanya konsistensi 7 dan 30 hari. |
| WIP ≤ 3 | Maksimal 3 Main Quest aktif. |
| Tanpa identitas pasien | Deteksi No. RM, angka ≥ 6 digit, Tn./Ny./An. + nama di semua kolom teks. Wajib, karena data tersinkron ke server dan dibaca Claude. |
| Claude mengusulkan, kamu memutuskan | Semua yang ditulis Claude masuk **Usulan** dulu, disetujui dengan satu ketukan. |
| Data milikmu | Export/import JSON tetap ada, walau sudah sinkron. |

## Peran

| Peran | Warna | Isi |
|---|---|---|
| Koas | biru | stase, jadwal jaga, logbook kasus (tanpa identitas) |
| UKMPPD | ungu | bank soal, blok belajar, tryout |
| Ortopedi | oranye | systematic review, IELTS, portofolio PPDS |
| Tentir | hijau | sesi, jam vs kapasitas, pemasukan |
| Tubuh & pulih | toska | tidur, qailulah, olahraga |
| Uang & rumah | kuning | utang, dana jembatan, tagihan |

Ibadah sengaja **bukan** peran (peran ikut dihitung). Mutaba'ah punya tempat sendiri.

## Arsitektur

```
HP / iPad / laptop  ⇄  Dexie Cloud  ⇄  Connector Qawwam (MCP)  ⇄  Claude (Project "Qawwam" + memori)
 (PWA, offline-first)     (sinkron)      (Cloudflare Worker)
```

- **App:** React + TypeScript + Vite + Tailwind, IndexedDB lewat Dexie. Sama dengan Dompetku. PWA, bisa dipasang di layar utama, jalan tanpa internet. Hosting GitHub Pages.
- **Sinkron:** Dexie Cloud. Paket gratis: 3 pengguna produksi, 100 MB. Login email + kode. Foto dan screenshot tidak ikut sinkron (atau dikompres) supaya muat di 100 MB.
- **Connector:** remote MCP server di Cloudflare Workers, dipasang sebagai custom connector di akun Claude Pro. Membaca dan menulis data lewat Dexie Cloud REST API (`/all/...`, token `client_credentials`). Login connector pakai OAuth.
- **Claude:** Project "Qawwam" berisi instruksi dan konteks hidup. Memori Claude menyimpan konteks, connector memberi data terbaru.
- **Opsional nanti:** tombol Claude di dalam app (butuh API key, bayar per pakai, perkiraan US$1–3 per bulan).

Catatan: aplikasi buatan sendiri tidak boleh memakai login atau kuota langganan Claude Pro. Karena itu Claude "datang" ke data lewat connector, bukan app yang memanggil akun Claude.

## Model data (draf)

Semua kunci primer berupa string yang dibuat otomatis (syarat Dexie Cloud). Tanggal `YYYY-MM-DD`, zona waktu WIB.

| Tabel | Isi utama |
|---|---|
| `roles` | nama, warna, urutan |
| `days` | tanggal, tipe hari, tidur malam, qailulah, jam berhenti kerja, catatan, hasil beku |
| `chapters` | stase: nama, mulai, selesai, bobot (ringan/sedang/berat) |
| `tasks` | judul, peran, tanggal, tenggat, penting, subtugas, selesai, sumber (manual/claude) |
| `habits` / `habitLogs` | kebiasaan, hari & tipe hari berlaku, ukuran XP, menit; log per tanggal |
| `mutabaah` / `mutabaahLogs` | daftar amalan; log per tanggal (tanpa skor) |
| `events` | agenda, jadwal jaga, jadwal stase |
| `mainQuests` | nama, peran, status (aktif/beku/selesai), langkah berikut, progres |
| `tentirSessions` | inisial murid, topik, tanggal, jam, durasi, tarif, lunas. Otomatis membuat transaksi pemasukan. |
| `transactions`, `categories`, `budgets`, `recurring` | dari Dompetku |
| `savings`, `debts` | wishlist/tabungan per pos + setoran; utang + pembayaran |
| `notes` | teks, peran, warna, sematkan |
| `reviews` | Muhasabah mingguan/bulanan: 3 prioritas, refleksi (berhasil, macet, fokus), angka ringkasan |
| `proposals` | usulan dari Claude: daftar operasi, status (menunggu/disetujui/ditolak) |

## Alur

- **Pagi (≤ 1 menit):** mutaba'ah → tipe hari → jam tidur malam.
- **Siang:** jam qailulah (1 ketukan).
- **Malam — Tutup hari:** centang, pindahkan sisa ke besok, isi jam berhenti kerja.
- **Kapan saja:** Catat cepat (Tugas / Catatan / Uang / Tentir) dari kolom di atas atau tombol `+`.
- **Minggu malam — Muhasabah mingguan (15–30 menit):** di app atau lewat Claude. Hasil: 3 prioritas minggu depan.
- **Awal bulan — Muhasabah bulanan:** lewat Claude. Tren tidur vs jaga, progres UKMPPD, proyeksi utang dan tabungan.

## Connector: tool yang direncanakan

| Tool | Fungsi |
|---|---|
| `get_profile` | konteks, peran, target, tanggal penting |
| `get_summary(from, to)` | ringkasan periode: tidur, tipe hari, tugas per peran, habit, mutaba'ah, tentir, uang |
| `list_tasks`, `list_days`, `list_events`, `list_tentir`, `list_transactions` | data mentah per rentang tanggal |
| `get_review(period)` | Muhasabah yang sudah tersimpan |
| `propose(items)` | tugas, agenda, habit, jadwal jaga, prioritas, catatan → masuk **Usulan** |

Tidak ada tool yang menghapus data.

## Fase

1. **Fondasi & harian:** proyek baru, login + sinkron Dexie Cloud, Beranda, Catat cepat, Tugas (per hari + peran), Habit & Mutaba'ah, tipe hari + tidur + XP, Muhasabah mingguan, impor data MBAPPE OS. Di akhir fase: connector + Usulan.
2. **Terhubung:** Uang (port Dompetku + tabungan, utang, dana jembatan), Tentir (sesi → pemasukan), Kalender & jadwal jaga, Catatan, impor data Dompetku, Muhasabah bulanan.
3. **Pelengkap:** Belajar UKMPPD (bank soal per sistem organ), Target & PPDS (portofolio, systematic review, IELTS), logbook kasus ortopedi, Buku, tombol Claude di dalam app (opsional).

## Belum diputuskan

- Rumus XP: dipakai apa adanya dari MBAPPE OS atau disederhanakan.
- Daftar mutaba'ah final.
- Nama dan warna peran final.
- Data MBAPPE OS mana yang diimpor (riwayat XP, hari terkunci, latihan).
