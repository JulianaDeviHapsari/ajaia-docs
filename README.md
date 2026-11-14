# Ajaia Docs

Editor dokumen kolaboratif ringan (terinspirasi Google Docs) — tugas Ajaia LLC "AI-Native Full Stack Developer".

**Stack:** React + Vite + Tiptap (editor) · Node 22 + Express 5 · SQLite (`node:sqlite` bawaan Node, tanpa dependensi native) · satu unit deploy (server menyajikan hasil build client).

## Fitur

| Area | Yang berfungsi |
|---|---|
| Dokumen | Buat, ganti nama (klik judul), edit, simpan otomatis, buka kembali, hapus (pemilik) |
| Format teks | Tebal, miring, garis bawah, Judul 1–3, daftar berpoin, daftar bernomor |
| Unggah file | `.txt`, `.md`, `.docx` → menjadi dokumen baru yang dapat diedit (maks 2 MB). Tipe lain ditolak dengan pesan jelas |
| Berbagi | Pemilik membagikan lewat email dengan peran **Bisa mengedit** / **Hanya lihat**, mengubah peran, atau mencabut akses. Daftar dipisah: *Dokumen saya* vs *Dibagikan kepada saya* |
| Ketahanan | SQLite; dokumen, format, dan data berbagi bertahan setelah refresh/restart |
| Keamanan dasar | Izin diperiksa di server, HTML disanitasi (allow-list), validasi input, deteksi konflik edit (HTTP 409) |

## Akun demo (autentikasi simulasi — tanpa kata sandi)

| Pengguna | Email | Peran pada dokumen contoh |
|---|---|---|
| Alice Owner | alice@example.com | Pemilik |
| Bob Editor | bob@example.com | Bisa mengedit |
| Carol Viewer | carol@example.com | Hanya lihat |

Pada layar masuk cukup pilih salah satu akun. Dokumen contoh milik Alice sudah dibagikan ke Bob dan Carol.

**Cara memeriksa alur berbagi dengan cepat:** buka dua jendela (satu biasa, satu *incognito*), masuk sebagai Alice dan Carol, lalu bandingkan hak akses pada dokumen yang sama.

## Menjalankan secara lokal

Prasyarat: **Node.js ≥ 22.5** (memakai `node:sqlite`).

```bash
# 1. pasang dependensi & build client
npm run setup          # = npm i di server/ dan client/
npm run build          # build client ke client/dist

# 2. jalankan (server + client dalam satu port)
npm start              # http://localhost:3001
```

Mode pengembangan (hot reload), dua terminal:

```bash
cd server && npm run dev      # API di :3001
cd client && npm run dev      # UI di :5173 (proxy /api → :3001)
```

Variabel lingkungan (opsional): `PORT` (default 3001), `DB_FILE` (default `server/data/ajaia.db`).

## Pengujian

```bash
npm test               # 12 tes API otomatis (node:test), database in-memory
```

Tes mencakup: CRUD & persistensi, sanitasi HTML, aturan akses (orang asing/viewer/editor/pemilik), validasi berbagi, konflik versi, dan impor `.md/.txt/.docx` beserta kasus ditolak (tipe salah, kosong, terlalu besar).

Opsional — uji E2E browser (butuh Chrome terpasang, server berjalan di port 3055 dengan DB baru):

```bash
cd e2e && npm i && node run.mjs ./screenshots
```

## Deploy

`Dockerfile` dan `render.yaml` disertakan. Contoh dengan Docker:

```bash
docker build -t ajaia-docs .
docker run -p 3001:3001 -v ajaia-data:/data ajaia-docs
```

Catatan: pada layanan gratis, disk biasanya sementara — data kembali ke data contoh saat instance di-*restart*. Pasang volume/disk persisten bila data harus bertahan.

## Batasan yang disengaja

Lihat [ARCHITECTURE.md](ARCHITECTURE.md) untuk alasan dan rencana lanjutan. Ringkasnya: tidak ada kolaborasi waktu nyata (hanya deteksi konflik), autentikasi simulasi, tidak ada riwayat versi/komentar/ekspor, impor `.docx` hanya mempertahankan struktur dasar (judul, tebal/miring, daftar).
