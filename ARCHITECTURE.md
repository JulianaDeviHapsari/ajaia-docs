# Catatan Arsitektur

## Gambaran

```
Browser (React + Tiptap)  ──HTTP/JSON──▶  Express 5 API  ──▶  SQLite (node:sqlite)
        ▲                                      │
        └────── file statis client/dist ◀──────┘   (satu proses, satu port)
```

- **Client** (`client/`): daftar dokumen, editor, dialog berbagi, layar masuk. Routing sederhana berbasis hash (`#/doc/:id`).
- **Server** (`server/src/`): `app.js` (rute + logika akses), `db.js` (skema + seed), `importer.js` (txt/md/docx → HTML), `sanitize.js` (allow-list HTML).
- **Data model:** `users`, `documents(owner_id, title, content, version)`, `shares(document_id, user_id, role)`.

## Keputusan utama & alasannya

1. **Konten disimpan sebagai HTML yang disanitasi** (bukan JSON ProseMirror). Lebih mudah diperiksa, diimpor, dan diekspor; sanitasi server (allow-list tag, tanpa atribut) mencegah XSS meski klien dimanipulasi. Kompromi: kurang cocok bila nanti butuh CRDT/OT — pada saat itu perlu migrasi ke dokumen terstruktur.
2. **Satu fungsi akses di server** (`loadDoc(req, minRole)`): peran `owner > editor > viewer`. Semua rute dokumen melewatinya sehingga aturan tidak tersebar. Orang tanpa akses mendapat **404** (bukan 403) agar keberadaan dokumen tidak bocor.
3. **Autentikasi simulasi** (header `X-User-Id` dari pilihan akun demo). Sengaja dipilih agar waktu dipakai untuk alur berbagi; tidak aman untuk produksi (lihat "Berikutnya").
4. **SQLite via `node:sqlite`**: nol dependensi native → `npm i` selalu berhasil di mesin penguji, tanpa layanan berbayar. Kompromi: modul masih berstatus *experimental* di Node 22 (diberi tanda `--no-warnings`), butuh Node ≥ 22.5.
5. **Simpan otomatis dengan antrean serial + `version`**: perubahan di-*debounce* 800 ms, setiap permintaan membawa versi terakhir. Jika dua orang mengedit bersamaan, yang kedua mendapat 409 dan banner "muat ulang" — lebih jujur daripada diam-diam menimpa. Kompromi: bukan kolaborasi waktu nyata.
6. **Editor dibuat setelah data siap dengan opsi stabil.** `useEditor` menerapkan ulang opsi tiap render; opsi yang berubah (`editable`, `content`) pernah membuat ketikan hilang (ditemukan lewat uji E2E, lihat AI_WORKFLOW.md).
7. **Unggah → dokumen baru** (bukan lampiran): paling relevan dengan produk dokumen. `.md` lewat `marked`, `.docx` lewat `mammoth`, `.txt` di-*escape* per paragraf; semuanya disanitasi. Batas 2 MB dan daftar tipe ditampilkan di UI.
8. **Satu unit deploy**: server menyajikan `client/dist`, sehingga hanya satu layanan/URL yang perlu dijalankan peninjau.

## Yang sengaja tidak dikerjakan

Kolaborasi waktu nyata/kursor, komentar & saran, riwayat versi, ekspor PDF/Markdown, undangan ke email yang belum terdaftar, kata sandi/OAuth sungguhan, *rate limiting*, impor ke draf yang sudah ada, pemeliharaan gambar/tabel pada `.docx`.

## Dengan 2–4 jam tambahan

1. Autentikasi nyata (sesi cookie + hash kata sandi atau OAuth) dan tautan undangan.
2. Ekspor Markdown/PDF dan riwayat versi (tabel `document_versions`, snapshot tiap N simpan).
3. Indikator kehadiran + pembaruan langsung (SSE/WebSocket), lalu Yjs bila diperlukan penggabungan sungguhan.
4. Tes komponen frontend dan menjadikan uji E2E bagian dari CI.
