# Connector Qawwam untuk Claude

Server MCP kecil (Cloudflare Worker, paket gratis) yang membuat Claude bisa **membaca** data Qawwam dari Dexie Cloud dan **mengirim usulan** ke halaman Usulan. Claude tidak bisa mengubah atau menghapus data langsung: setiap usulan kamu setujui dulu di app, item per item.

## Alat yang tersedia

| Alat                            | Fungsi                                                                                                                                                                              |
| ------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `get_overview`                  | Konteks saat ini: hari ini & tipe hari, fase, stase, level/XP/streak, peran, habit, mutaba'ah, Main Quest, aturan XP, tentir, makan, target latihan, dana jembatan, usulan menunggu |
| `get_summary(from, to)`         | Ringkasan per hari + total (tidur, XP, lolos, tugas per peran, habit, mutaba'ah, tentir, latihan, lembur). Cocok untuk Muhasabah                                                    |
| `list_records(table, from, to)` | Data mentah satu tabel                                                                                                                                                              |
| `get_training_plan`             | Resep sesi beban berikutnya, proyeksi bench, rencana lari minggu ini                                                                                                                |
| `propose(summary, items)`       | Kirim usulan (tugas, jadwal jaga, habit, stase, ritme, menu) → halaman **Usulan**                                                                                                   |

Semua hitungan memakai kode yang sama dengan app (`src/domain`), jadi XP dan resep latihan identik.

## Keamanan

- URL connector berisi kunci rahasia (`/mcp/<CONNECTOR_KEY>`). **Perlakukan URL itu seperti kata sandi.** Siapa pun yang memegangnya bisa membaca datamu lewat Claude.
- Mencabut akses: ganti `CONNECTOR_KEY` (langkah 4) lalu perbarui URL di Claude.
- Kunci klien Dexie Cloud hanya disimpan sebagai _secret_ di Cloudflare, tidak pernah di repo.
- Usulan yang mirip identitas pasien ditolak di connector dan sekali lagi di app.

## Pasang (±15 menit, sekali saja)

Butuh: akun Cloudflare gratis, laptop dengan Node.js, dan file `dexie-cloud.key` dari saat database Dexie Cloud dibuat (`npx dexie-cloud create`).

1. **Siapkan kunci klien Dexie Cloud.** `client_id` & `client_secret` ada di file `dexie-cloud.key` yang dibuat saat database disiapkan. Kalau file itu tidak ada di laptopmu, sambungkan ulang ke database yang sama (verifikasi lewat kode email) supaya file baru dibuat:
   ```bash
   npx dexie-cloud connect https://xxxx.dexie.cloud
   ```
2. **Masuk ke Cloudflare:**
   ```bash
   cd connector
   npm install
   npx wrangler login
   ```
3. **Isi rahasia** (masing-masing akan ditanya nilainya):
   ```bash
   npx wrangler secret put DEXIE_DB_URL         # https://xxxx.dexie.cloud (lihat .env.local)
   npx wrangler secret put DEXIE_CLIENT_ID
   npx wrangler secret put DEXIE_CLIENT_SECRET
   npx wrangler secret put OWNER_EMAIL          # email akun Qawwam
   ```
4. **Buat kunci URL acak** dan simpan:
   ```bash
   node -e "console.log(require('crypto').randomBytes(24).toString('base64url'))"
   npx wrangler secret put CONNECTOR_KEY        # tempel hasil di atas
   ```
5. **Deploy:**
   ```bash
   npx wrangler deploy
   ```
   Hasilnya alamat seperti `https://qawwam-connector.<akunmu>.workers.dev`.
6. **Tambahkan ke Claude:** claude.ai → Settings → Connectors → _Add custom connector_. Nama: `Qawwam`. URL: `https://qawwam-connector.<akunmu>.workers.dev/mcp/<CONNECTOR_KEY>`. Biarkan OAuth kosong. Connector yang ditambahkan di claude.ai ikut tersedia di app Claude iPhone/iPad.
7. **Coba:** di chat baru, aktifkan connector Qawwam lalu minta "Ringkas mingguku dari Qawwam" atau "Usulkan tugas belajar UKMPPD untuk 3 hari ke depan sesuai jadwal jagaku". Usulan muncul di Qawwam → **Usulan** (dan pemberitahuan di Beranda).

## Pengembangan

```bash
npm run build                 # bundel (wrangler --dry-run) ke dist/
npm run dev                   # jalan lokal; isi .dev.vars dengan rahasia yang sama
```

Tes ada di `src/connector.test.ts` dan ikut `npm test` di root repo.

Catatan: tabel dari versi skema baru (mis. `workouts`) baru dikenal server setelah app versi itu sinkron sekali dari perangkat mana pun; sebelum itu connector menganggapnya kosong.
