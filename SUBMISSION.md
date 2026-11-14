# SUBMISSION — Ajaia Docs

Kandidat: Juliana Devi Hapsari

## Tautan (ISI SEBELUM MENGIRIM)
- **Produk live:** `<<ISI: URL deploy>>`
- **Video panduan (3–5 menit):** lihat `video-url.txt` → `<<ISI: URL Loom/YouTube unlisted>>`
- **Folder Google Drive:** `<<ISI: tautan folder>>`

## Isi folder
| Berkas | Keterangan |
|---|---|
| `server/`, `client/` | Kode sumber (Express + SQLite, React + Tiptap) |
| `README.md` | Fitur, akun demo, cara menjalankan lokal, pengujian, deploy |
| `ARCHITECTURE.md` | Catatan arsitektur, keputusan, yang dilewati, rencana 2–4 jam |
| `AI_WORKFLOW.md` | Catatan alur kerja AI |
| `SUBMISSION.md` | Daftar ini |
| `video-url.txt` | URL video panduan |
| `VIDEO_SCRIPT.md` | Naskah/alur rekaman video |
| `docs/screenshots/` | Tangkapan layar alur utama |
| `e2e/` | Skrip uji E2E browser (opsional) |
| `Dockerfile`, `render.yaml` | Konfigurasi deploy |

## Akun uji untuk meninjau berbagi (tanpa kata sandi)
`alice@example.com` (pemilik) · `bob@example.com` (editor) · `carol@example.com` (viewer). Pilih akun di layar masuk.

## Status fitur
**Berfungsi:** buat/ganti nama/edit/simpan otomatis/buka kembali; tebal, miring, garis bawah, Judul 1–3, daftar berpoin & bernomor; unggah `.txt/.md/.docx` → dokumen baru; berbagi berbasis peran (editor/viewer) + cabut akses; pemisahan dokumen pribadi vs dibagikan; persistensi SQLite; validasi & penanganan galat; 12 tes API + uji E2E browser.

**Belum lengkap / sengaja dilewati:** kolaborasi waktu nyata (hanya deteksi konflik 409), autentikasi sungguhan (simulasi), riwayat versi, komentar, ekspor, `.docx` hanya struktur dasar (tanpa tabel/gambar).

**Berikutnya (2–4 jam):** autentikasi nyata + tautan undangan; ekspor Markdown/PDF; riwayat versi; pembaruan langsung (SSE) — rincian di `ARCHITECTURE.md`.
