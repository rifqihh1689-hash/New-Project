# Qawwam — Desain (v2)

Satu app untuk mengatur hidup selama perjalanan **koas → UKMPPD → PPDS Ortopedi**.
Menggabungkan **MBAPPE OS** (`levelup`) dan **Dompetku** (`dompetku`) menjadi satu tempat yang tersinkron di HP, iPad, dan laptop, dan bisa dibaca serta diisi lewat Claude.

Status: Fase 1 berjalan dan sudah online (GitHub Pages + sinkron Dexie Cloud). Rincian apa yang sudah jadi ada di [Status implementasi](#status-implementasi). Dokumen ini menggabungkan draf v0, keputusan selama pembangunan Fase 1, dan brainstorming v2.

## Nama

**Qawwam** (قَوَّام): yang terus-menerus tegak dan teguh menjalankan sesuatu. Dipakai di QS An-Nisa 4:135 dan Al-Ma'idah 5:8 (*kūnū qawwāmīn*).
Akarnya (q-w-m) sama dengan **qiyam** (qiyamul lail, awal harimu) dan **istiqamah** (konsisten).
Kerabatnya, **qawāmā** di QS Al-Furqan 25:67, berarti pertengahan dalam membelanjakan harta: semboyan untuk modul Uang.

Fitur review mingguan dan bulanan bernama **Muhasabah**.

## Konteks pengguna

- Koas FK UB / RSSA Malang. Koas selesai Des 2027 → UKMPPD Feb 2028 → target PPDS Ortopedi.
- Stase pagi, biasanya selesai ±14.00; jam masuk/pulang berbeda per stase (diatur di Setelan › Stase). Jaga malam rutin, butuh 2–3 jam pulih setelah jaga.
- Tidur 5–6 jam, bangun ±03.45 untuk qiyamul lail.
- Tentir 1:1 untuk 2 mahasiswa preklinik (semester 1 dan semester 5), Rp85.000 per jam. Kapasitas sampingan 9–15 jam per minggu.
- Makan campuran beli dan masak; semua fasilitas masak ada di kos, masak terutama di hari libur. Latihan beban: target protein 1,6 g/kg berat badan, dominan ayam dan telur (ikan, sapi, udang jarang karena belum pernah memasaknya). Anggaran makan Rp300–400 rb per minggu, ingin hemat. Makan 3–5 kali sehari tergantung fase bulk atau cut.
- Perangkat: HP, iPad, laptop. Langganan Claude: Pro.

## Prinsip

Dibawa dari MBAPPE OS, ditambah aturan baru untuk sinkron dan Claude.

| Prinsip | Artinya di Qawwam |
|---|---|
| Wajib kecil, dalam opsional | Isian wajib ≤ 1 menit sehari (cukup supaya data valid dan streak aman). Perencanaan, statistik, game, dan Muhasabah boleh selama yang kamu mau. |
| Tenang tapi hidup | Tampilan tenang, gamifikasi penuh tapi berbasis bukti (lihat Sistem game). Notifikasi lembut, maksimal 2 per hari, tidak ada di hari pasca-jaga. |
| Hadiah untuk pemulihan, bukan volume | Pengali tidur dari total tidur 24 jam (malam + qailulah). Rumus XP dari MBAPPE OS. |
| Tipe hari menentukan isi | STASE / JAGA / PASCA-JAGA / LIBUR. Pasca-jaga hanya berisi pemulihan, tugas lain pindah ke besok. Jaga dan pasca-jaga tidak memutus streak. |
| Mutaba'ah tanpa skor | Tidak masuk XP, level, streak. Hanya konsistensi 7 dan 30 hari. |
| WIP ≤ 3 | Maksimal 3 Main Quest aktif. |
| Kuota sampingan 9–15 j | Semua usaha sampingan (tentir, produk digital, konten) masuk satu kuota mingguan. Yang dinaikkan Rp per jam, bukan jumlah jam. |
| Tanpa identitas pasien | Deteksi No. RM, angka ≥ 6 digit, Tn./Ny./An. + nama di semua kolom teks (termasuk impor dan subtugas). Wajib, karena data tersinkron ke server dan dibaca Claude. |
| Claude mengusulkan, kamu memutuskan | Semua yang ditulis Claude masuk **Usulan** dulu, disetujui dengan satu ketukan. Impor dari file juga selalu lewat pratinjau. |
| Fleksibel tanpa ubah kode | Jadwal, jam stase, ritme, habit, peran, fase hidup, dan menu adalah data yang bisa diubah atau diimpor, bukan angka yang ditulis di kode. |
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
Peran tidak dihapus, hanya diarsipkan; nama dan warna bisa diganti di Setelan.

## Modul

### Makan & belanja

Tujuan: tidak perlu memikirkan menu setiap hari.

- **Waktu makan mengikuti fase:** bulk 5× (sarapan, snack pagi, siang, snack sore, malam), maintain 4×, cut 3×. Bisa diatur sendiri.
- **Target protein** = berat badan × 1,6 g/kg; tampil per hari dan rata-rata mingguan.
- **Daftar menu** campuran beli dan masak: waktu makan yang cocok, perkiraan protein & biaya per porsi, bahan per porsi, cocok untuk bekal, masak lama (hari libur), tempat beli. Menu bawaan berisi ayam & telur dengan harga perkiraan Malang; tanpa ikan, sapi, udang.
- **Rencana mingguan disusun otomatis** dari daftar menu dan tipe hari: sarapan cepat di hari stase, siang beli dekat RS atau bekal, makan sebelum jaga + bekal jaga, pasca-jaga tanpa masak (praktis/beli), libur untuk belanja dan masak lauk beberapa hari. Utamakan protein, jaga anggaran, hindari pengulangan. Bisa isi yang kosong saja atau susun ulang (dengan Urungkan); tiap slot bisa diganti manual.
- **Daftar belanja** otomatis dari menu masak minggu itu, sekali ketuk jadi tugas "Belanja mingguan" (subtugas per bahan) di hari libur.
- **Kartu "Makan hari ini"** di Beranda.
- **Anggaran:** perkiraan biaya mingguan dibandingkan anggaran (bawaan Rp350 rb); nanti masuk anggaran Makan di modul Uang.
- Daftar menu bisa diimpor; Claude menyusun menu dari jadwal jaga dan anggaran, hasilnya masuk Usulan.

### Tentir+

Data per murid (semester, blok), paket dan sisa sesi, status bayar, angka **Rp per jam**, slot kosong bulanan yang dihitung dari jadwal jaga (dikirim ke murid supaya jarang jadwal ulang), template pesan WA, dan perpustakaan materi per blok yang bisa dipakai ulang tahun berikutnya.

- Arah strategi: kelompok kecil satu angkatan (contoh Rp60.000 per orang per jam: 2 orang = Rp120.000/jam, 3 orang = Rp180.000/jam, dibandingkan 1:1 Rp85.000/jam), paket per blok dibayar di muka, materi per blok jadi produk digital.

### Lainnya

- **Flashcard UKMPPD.** Kartu dengan pengulangan berjarak, dibuat Claude dari catatan. Target 15 menit per hari.
- **Berkas PPDS.** Daftar dokumen dan tenggat: STR, sertifikat, nilai, surat rekomendasi, IELTS, publikasi.
- **Produk digital (sederhana).** Catatan produk dan penjualan, supaya terlihat penghasilan per jam kerja.
- **Di luar app:** rekening dengan fitur kantong dan autodebet (cicilan utang, dana jembatan, uang harian) supaya uang terbagi otomatis begitu masuk.

## Impor jadwal

Sumber jadwal beragam: Google Sheets, screenshot, PDF dari RS, catatan program latihan. Dua jalur, hasil akhirnya sama (pratinjau → setujui):

1. **Teks terstruktur di app** (Setelan › Impor): tempel sel dari Google Sheets (TSV), CSV, atau JSON Qawwam. Pratinjau per baris, baris bermasalah dan pola identitas pasien ditandai, lalu impor.
2. **Lewat Claude** untuk screenshot, PDF, dan catatan bebas. Sebelum connector ada: tombol "Salin perintah untuk Claude" berisi format JSON Qawwam; Claude membalas JSON, hasilnya ditempel di Impor. Setelah connector ada: Claude memanggil `propose`, hasilnya masuk Usulan.

| Jenis | Masuk ke | Kolom |
|---|---|---|
| `ritme` | Ritme harian per tipe hari (menggantikan template tipe itu) | tipe_hari, jam, sampai, judul, peran, catatan |
| `habit` | Habit (jadwal latihan dsb.); nama sama = diperbarui | judul, hari, tipe_hari, menit, ukuran, peran, catatan |
| `tugas` | Tugas bertanggal; judul + tanggal sama = dilewati | judul, tanggal, peran, penting |
| `jaga` | Tipe hari Jaga di tanggal itu | tanggal |
| `stase` | Stase + jam masuk/pulang; nama + mulai sama = diperbarui | judul, mulai, selesai, masuk, pulang, bobot |
| `menu` | Daftar menu; nama sama = diperbarui | judul, sumber, waktu, protein, biaya, bahan, tempat, bekal |

Tanggal gaya Indonesia (`12/11`, `3 Des`), hari (`Sen, Rab, Jum`, `Senin-Jumat`, `setiap hari`), dan jam (`6`, `06:30`, `1400`) dikenali. Impor aman diulang.

## UX

- **Peran perangkat.** HP = **Hari ini** (mengerjakan: centang, catat, cek jadwal). iPad/laptop = **Rencana & Muhasabah** (merencanakan minggu, statistik, review). Beranda penuh kartu hanya di layar lebar; di HP layar utamanya fokus ke hari ini.
- **Satu jempol.** 4 tab di bawah + tombol Catat besar di tengah. Aksi utama di jangkauan jempol.
- **Gestur.** Geser kanan = selesai, geser kiri = pindah ke besok, tahan = detail. Selalu ada Urungkan, bukan dialog konfirmasi.
- **Catat cepat bahasa alami.** "besok 19.00 tentir A 2 jam" langsung jadi agenda + sesi tentir.
- **Dibuka bertahap.** Hari pertama cukup Hari ini, Tugas, Habit. Modul lain terbuka seiring level, supaya tidak kewalahan.
- **Ritual.** Check-in pagi (≤ 30 detik) → Tutup hari (1–2 menit, ringkasan XP hari itu) → Muhasabah mingguan (15–30 menit, terasa seperti Weekly Raid) → rekap musim tiap ganti stase.
- **Notifikasi & batasan iPhone.** Web push bisa di iPhone (iOS 16.4+, app harus dibuka dari ikon layar utama), begitu juga angka badge di ikon. Widget layar utama dan getar tidak tersedia untuk web app di iPhone; kalau nanti dibutuhkan, app dibungkus jadi app native (mis. Capacitor). Push butuh pengirim di server (GitHub Pages hanya file statis), jadi dikirim oleh Cloudflare Worker yang sama dengan connector, terjadwal dengan cron.
- **Bahasa Indonesia penuh**, termasuk layar masuk sinkron (email + kode).

## Sistem game

Berbasis bukti: game fiction dan interaksi sosial memperbesar efek pada perilaku; kolaborasi + kompetisi lebih efektif daripada kompetisi saja; gamifikasi sering gagal kalau tidak membuat pemain merasa mampu dan bebas memilih.

- **Kampanye "Jalan ke PPDS".** Cerita utama dari koas sampai PPDS. Tiap **stase = musim** dengan target sendiri, dan ditutup dengan **rekap musim**.
- **Karakter.** Level, 6 stat (dari MBAPPE OS), status effect (Sleep Debt, Pasca-jaga, Overtime).
- **Peta penguasaan UKMPPD.** Pohon keahlian per sistem organ. Levelnya naik dari akurasi soal dan flashcard, bukan sekadar jumlah, supaya rasa mampu terasa nyata.
- **Quest.** Quest harian otomatis per tipe hari, quest mingguan, Main Quest ≤ 3. Kamu memilih dari beberapa pilihan quest (kebebasan memilih).
- **Boss.** Utang (HP turun tiap bayar), tryout bulanan (mini-boss), UKMPPD Feb 2028 (final boss dengan hitung mundur).
- **Streak + shield.** Jaga dan pasca-jaga netral, tidak memutus streak.
- **Muhasabah = Weekly Raid.** Selesai sekali seminggu (Sabtu–Selasa, minimal satu prioritas) memberi +50 XP.
- **Koin → hadiah nyata** yang kamu tentukan sendiri (dari MBAPPE OS: rewards & claims).
- **Pencapaian** yang bermakna dan jarang (mis. "4 minggu tidur rata-rata ≥ 5,5 jam", "100 soal muskuloskeletal benar").
- **Party (opsional).** Satu atau dua teman koas: quest bersama, saling lihat ringkasan mingguan. Kolaborasi dulu, kompetisi ringan belakangan.
- **Umpan balik.** Animasi saat centang dan naik level, rekap musim bergaya ringkasan tahunan.
- **Pagar.** Tidak ada cara menang dengan mengurangi tidur (rumus MBAPPE OS). Hari lewat jendela isi mundur (1 hari) dibekukan. Mutaba'ah tetap tanpa skor. Tidak ada hukuman berat. Ada **mode fokus** untuk menyembunyikan semua elemen game saat masa ujian.

### Rumus XP (dari MBAPPE OS, sudah dipakai)

- **Stase / Libur:** `round(min(Σ XP selesai, 100) × pengali tidur) − 15·[lewat 21.00]`. Pengali dari total tidur: ≥ 6,5 j ×1,2 · 6–6,5 ×1,0 · 5–6 ×0,8 · < 5 atau kosong ×0,6.
- **Jaga:** `round(min(Σ, 100) × 1,0)`, tanpa penalti malam.
- **Pasca-jaga:** `round(100 × selesai/total)`, hanya sah bila kemarin jaga; selain itu dihitung stase.
- **Lolos** bila ≥ 60% isi hari selesai. **Level** L → L+1 butuh `150 + 50·L`.

## Arsitektur

```
HP / iPad / laptop  ⇄  Dexie Cloud  ⇄  Connector Qawwam (MCP)  ⇄  Claude (Project "Qawwam" + memori)
 (PWA, offline-first)     (sinkron)      (Cloudflare Worker)
```

- **App:** React + TypeScript + Vite + Tailwind, IndexedDB lewat Dexie. Sama dengan Dompetku. PWA, bisa dipasang di layar utama, jalan tanpa internet. Hosting GitHub Pages (deploy otomatis dari `main`).
- **Sinkron:** Dexie Cloud. Paket gratis: 3 pengguna produksi, 100 MB. Login email + kode, wajib sekali per perangkat lalu tetap jalan offline. URL database disimpan sebagai variabel repo `DEXIE_CLOUD_URL` (bukan rahasia); kunci klien tidak pernah masuk repo. Foto dan screenshot tidak ikut sinkron (atau dikompres) supaya muat di 100 MB.
- **Connector:** remote MCP server di Cloudflare Workers, dipasang sebagai custom connector di akun Claude Pro. Membaca dan menulis data lewat Dexie Cloud REST API (`/all/...`, token `client_credentials`). Login connector pakai OAuth. Worker yang sama mengirim web push terjadwal.
- **Claude:** Project "Qawwam" berisi instruksi dan konteks hidup. Memori Claude menyimpan konteks, connector memberi data terbaru.
- **Opsional nanti:** tombol Claude di dalam app (butuh API key, bayar per pakai, perkiraan US$1–3 per bulan).

Catatan: aplikasi buatan sendiri tidak boleh memakai login atau kuota langganan Claude Pro. Karena itu Claude "datang" ke data lewat connector, bukan app yang memanggil akun Claude.

## Model data

Semua kunci primer berupa string yang dibuat otomatis oleh app (syarat Dexie Cloud). Tanggal `YYYY-MM-DD`, zona waktu WIB, hari berganti pukul 03.00.

- Baris baru: ID acak berawalan tabel (`tsk_…`, `nte_…`).
- Baris "satu per kunci alami" (hari per tanggal, log habit/mutaba'ah per tanggal, profil, Muhasabah per minggu, rencana makan per tanggal & waktu makan): ID privat `#…` (`#day:2026-11-05`). Dexie Cloud menerjemahkannya per pengguna, jadi HP dan laptop yang offline menulis ke baris yang sama, bukan membuat duplikat.
- Bawaan (peran, fase, mutaba'ah, habit inti, menu awal) hidup di kode dengan ID `#…`; database hanya menyimpan perubahanmu. Perangkat baru tidak pernah menimpa nama atau warna yang sudah kamu ubah.
- Peran, fase, habit, mutaba'ah, dan menu tidak dihapus, hanya diarsipkan/dinonaktifkan. Riwayat lama tetap utuh.
- Mengubah skema = menambah versi Dexie; data lama tidak tersentuh (v2 menambah tabel Menu).

| Tabel | Isi utama | Status |
|---|---|---|
| `profile` | nama, aturan XP yang diubah, template ritme per tipe hari, kapasitas tentir, setelan makan (berat badan, fase, jumlah makan, g/kg, anggaran) | dipakai |
| `lifeRoles` | peran: nama, warna, urutan, peran pemulihan, diarsipkan (`roles` dipakai Dexie Cloud sendiri) | dipakai |
| `phases` | fase hidup (Koas → UKMPPD → PPDS): nama, mulai, selesai, label tipe hari per fase | dipakai |
| `days` | tanggal, tipe hari, tidur malam, qailulah, jam berhenti kerja, catatan, hasil beku | dipakai |
| `chapters` | stase: nama, mulai, selesai, bobot, jam masuk & pulang | dipakai |
| `tasks` | judul, peran, tanggal, tenggat, penting, subtugas, selesai, sumber (manual/claude) | dipakai |
| `habits` / `habitLogs` | kebiasaan, hari & tipe hari berlaku, ukuran XP, target menit, catatan; log per tanggal (selesai + menit) | dipakai |
| `mutabaah` / `mutabaahLogs` | daftar amalan; log per tanggal (tanpa skor) | dipakai |
| `reviews` | Muhasabah mingguan/bulanan: 3 prioritas, refleksi (berhasil, macet, fokus), angka ringkasan, selesai + XP | dipakai |
| `menus` / `mealPlans` | daftar menu (beli/masak, waktu makan, protein, biaya, bahan, bekal); rencana per tanggal & waktu makan. Daftar belanja dihitung dari rencana, tidak disimpan terpisah | dipakai |
| `events` | agenda, jadwal jaga, jadwal stase | disiapkan |
| `mainQuests` | nama, peran, status (aktif/beku/selesai), langkah berikut, progres | disiapkan |
| `tentirSessions` | inisial murid, topik, tanggal, jam, durasi, tarif, lunas. Otomatis membuat transaksi pemasukan. | disiapkan |
| `students`, `tentirPackages`, `materials` | murid (inisial, semester), paket + sisa sesi, materi per blok | rencana |
| `flashcards` | kartu, sistem organ, jadwal ulang berikutnya | rencana |
| `documents` | berkas PPDS: nama, status, tenggat, catatan | rencana |
| `transactions`, `categories`, `budgets`, `recurring` | dari Dompetku | disiapkan |
| `savings`, `debts` | wishlist/tabungan per pos + setoran; utang + pembayaran | disiapkan |
| `notes` | teks, peran, warna, sematkan | disiapkan |
| `proposals` | usulan dari Claude: daftar operasi, status (menunggu/disetujui/ditolak) | disiapkan |

"Disiapkan" = tabel sudah ada di skema, layarnya belum. "Rencana" = ditambah lewat versi skema berikutnya.

## Alur

- **Pagi (≤ 1 menit):** mutaba'ah → tipe hari → jam tidur malam.
- **Siang:** jam qailulah (1 ketukan).
- **Malam — Tutup hari:** centang, pindahkan sisa ke besok, isi jam berhenti kerja.
- **Kapan saja:** Catat cepat (Tugas / Catatan / Uang / Tentir) dari kolom di atas atau tombol `+`.
- **Hari libur:** susun menu minggu ini, belanja, masak lauk beberapa hari.
- **Minggu malam — Muhasabah mingguan (15–30 menit):** di app atau lewat Claude. Hasil: 3 prioritas minggu depan (tampil di Beranda).
- **Awal bulan — Muhasabah bulanan:** lewat Claude. Tren tidur vs jaga, progres UKMPPD, proyeksi utang dan tabungan.
  - **Laporan dampak (N-of-1):** bandingkan periode sebelum (data MBAPPE OS) dan sesudah Qawwam untuk 3 indikator utama: % tugas inti selesai per minggu, soal UKMPPD per minggu + akurasi tryout, rata-rata tidur 24 jam. Laporkan effect size + 95% CI dan tren (interrupted time series) dengan kovariat bobot stase dan jumlah jaga, bukan sekadar p-value. Butuh ±3–6 bulan data per periode supaya efek sedang bisa terdeteksi. Angka mingguan yang dibutuhkan sudah disimpan di tiap Muhasabah.
- **Desain berbasis bukti:** rencana di "Ritme hari ini" ditulis dalam format jika–maka ("jika pulang stase, maka qailulah 60 menit"); progres dicatat dan bisa dibagikan ke orang yang dipercaya; gamifikasi dirancang untuk rasa mampu, kebebasan memilih, dan keterhubungan.

## Saat fase hidup berganti

Tidak ada yang direset. Fase, peran, habit, ritme, dan menu adalah data, bukan kode:

- **Fase:** tutup fase lama (isi tanggal selesai), tambah fase baru. Jalan ke PPDS di Beranda mengikuti.
- **Peran:** arsipkan "Koas", tambah "Internsip" atau "PPDS". Tugas lama tetap berlabel Koas.
- **Tipe hari:** empat tipe tetap (karena aturan pasca-jaga dan streak bergantung padanya), tapi labelnya bisa diganti per fase, mis. "Stase" → "Dinas".
- **Stase & ritme:** jam masuk/pulang per stase, ritme harian per tipe hari, bisa diimpor.
- **Habit, mutaba'ah, menu:** nonaktifkan/arsipkan yang lama, tambah yang baru.
- **XP, level, streak:** berlanjut. Hari yang sudah lewat dibekukan, jadi mengubah aturan tidak mengubah masa lalu.

## Connector: tool yang direncanakan

| Tool | Fungsi |
|---|---|
| `get_profile` | konteks, peran, target, tanggal penting |
| `get_summary(from, to)` | ringkasan periode: tidur, tipe hari, tugas per peran, habit, mutaba'ah, tentir, uang, makan |
| `list_tasks`, `list_days`, `list_events`, `list_tentir`, `list_transactions` | data mentah per rentang tanggal |
| `get_review(period)` | Muhasabah yang sudah tersimpan (termasuk angka mingguan) |
| `propose(items)` | tugas, agenda, habit, jadwal jaga, stase, ritme, prioritas, catatan, menu & daftar belanja, slot tentir, flashcard → masuk **Usulan**. Formatnya sama dengan JSON impor. |

Tidak ada tool yang menghapus data.

## Fase

1. **Fondasi & harian:** proyek baru, login + sinkron Dexie Cloud, Beranda, Catat cepat, Tugas (per hari + peran), Habit & Mutaba'ah, tipe hari + tidur + XP, Muhasabah mingguan, impor data MBAPPE OS. Di akhir fase: connector + Usulan.
2. **Terhubung:** Uang (port Dompetku + tabungan, utang, dana jembatan), Tentir+ (sesi → pemasukan, paket, Rp/jam, slot dari jadwal jaga), Makan & belanja, Kalender & jadwal jaga, Catatan, impor data Dompetku, Muhasabah bulanan.
3. **Pelengkap:** Belajar UKMPPD (bank soal per sistem organ + flashcard), Target & PPDS (portofolio, systematic review, IELTS, berkas PPDS), logbook kasus ortopedi, produk digital, Buku, tombol Claude di dalam app (opsional).

Makan & belanja dan impor jadwal dikerjakan lebih awal (saat Fase 1) karena diminta.

## Status implementasi

| Bagian | Status |
|---|---|
| Fondasi, PWA, tema gelap/terang, deploy GitHub Pages | selesai |
| Sinkron Dexie Cloud + layar masuk Indonesia | selesai |
| Beranda (prototipe), Catat cepat, pemilih tipe hari, XP/level/streak/pengali tidur, hari beku | selesai |
| Tugas: tampilan Hari & papan Minggu, subtugas | selesai |
| Habit & Mutaba'ah: kotak 7 hari, target menit, catatan program | selesai |
| Muhasabah mingguan (+50 XP, prioritas di Beranda) | selesai |
| Setelan: stase & jamnya, ritme harian, fase hidup, peran, export JSON | selesai |
| Impor jadwal (Sheets/CSV/Claude) | selesai |
| Makan & belanja | sedang dibangun |
| Impor MBAPPE OS, connector + Usulan | Fase 1, belum |
| Beranda HP fokus "Hari ini", gestur geser, dibuka bertahap, notifikasi | UX v2, belum |
| Sistem game v2 (kampanye, 6 stat, quest pilihan, boss, koin, pencapaian, mode fokus) | belum; yang ada baru level, XP, streak, pengali, Raid |
| Modul Fase 2–3 lainnya | belum |

## Belum diputuskan

- Rumus XP: dipakai apa adanya dari MBAPPE OS (saat ini) atau disederhanakan.
- Daftar mutaba'ah final.
- Nama dan warna peran final.
- Data MBAPPE OS mana yang diimpor (riwayat XP, hari terkunci, latihan).
- Tarif kelompok dan harga paket tentir.
- Berat badan untuk target protein (diisi di halaman Menu).
