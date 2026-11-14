# Naskah Video Panduan (target ±4 menit)

Siapkan dua jendela: biasa (Alice) dan *incognito* (Carol). Rekam dengan Loom/OBS; unggah sebagai *unlisted*.

| Waktu | Tayangan | Ucapkan |
|---|---|---|
| 0:00–0:20 | Layar masuk | Tujuan: editor dokumen ringan. Autentikasi simulasi sengaja dipilih agar fokus ke dokumen & berbagi. |
| 0:20–1:30 | Alice: *Dokumen baru* → ganti nama → Judul 1, tebal/miring/garis bawah, daftar berpoin & bernomor → lihat "Tersimpan" → refresh | Autosave 800 ms; format bertahan setelah refresh karena HTML disanitasi disimpan di SQLite. |
| 1:30–2:15 | *Unggah file*: `.md`, lalu coba `.exe` | Mendukung txt/md/docx (maks 2 MB); tipe lain ditolak dengan pesan jelas; hasilnya dokumen baru yang bisa diedit. |
| 2:15–3:15 | Bagikan ke Carol (viewer) & Bob (editor); jendela Carol: hanya baca; Bob mengedit lalu Alice refresh | Izin diperiksa di server; orang asing 404; editor tak bisa membagikan; daftar *Dokumen saya* vs *Dibagikan kepada saya*. |
| 3:15–3:45 | Kode: `loadDoc` di `app.js`, `npm test` | Satu fungsi akses; 12 tes API + E2E browser. |
| 3:45–4:30 | `ARCHITECTURE.md` & `AI_WORKFLOW.md` | Yang sengaja dilewati (real-time, riwayat, ekspor, auth nyata); AI mempercepat kerangka & tes, tetapi dua bug (Express 5 `*`, huruf hilang di editor) ditemukan lewat verifikasi sendiri. |
