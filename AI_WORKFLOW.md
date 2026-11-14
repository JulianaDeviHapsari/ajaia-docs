# Catatan Alur Kerja AI

> Catatan ini ditulis berdasarkan sesi pengerjaan nyata. **Candidate: tinjau dan sesuaikan dengan pengalaman Anda sendiri sebelum mengirim** — peninjau akan menanyakannya di wawancara.

## Alat AI yang digunakan
- **Claude** (asisten AI Anthropic) sebagai pasangan pemrograman: merancang cakupan, menulis kode server/klien, tes, dan dokumentasi, serta menjalankan perintah (build, tes, Chrome *headless*) di lingkungan kerja.

## Di mana AI paling mempercepat
- **Perancangan cakupan:** memetakan tugas yang ambigu menjadi daftar "wajib / sengaja dilewati" dengan cepat.
- **Kerangka full-stack:** skema SQLite, rute Express, validasi, komponen React, dan CSS dalam hitungan menit.
- **Menulis tes:** 12 tes API (akses berbasis peran, sanitasi, unggah) dan skrip E2E browser.
- **Dokumentasi:** README, arsitektur, dan skrip video.

## Output AI yang diubah / ditolak (kasus nyata)
1. **Rute SPA `app.get('*')` → dihapus.** Kode awal membuat server crash saat start karena Express 5 menolak `*` (`path-to-regexp`). Diganti middleware *fallback* yang melewatkan `/api`.
2. **Skrip tes `node --test test/` → pola glob.** Node 22 memperlakukan direktori sebagai berkas; diganti `"test/*.test.js"`.
3. **Ekstensi Underline & Placeholder dibuang.** Tiptap v3 sudah menyertakan Underline di StarterKit; menambahkannya lagi menyebabkan ekstensi ganda.
4. **Bug editor: huruf hilang saat mengetik setelah menekan tombol toolbar/autosave.** Rancangan awal memberi `useEditor` opsi yang berubah (`editable:false` + `setContent` via efek). Ditemukan lewat uji E2E, bukan tinjauan kode. Perbaikan: editor dibuat setelah dokumen termuat dengan opsi stabil (komponen luar memuat, komponen dalam mengedit).
5. **Bug fokus toolbar:** klik tombol memindahkan fokus dari editor sehingga ketikan berikutnya (atau Enter) mengenai tombol. Diperbaiki dengan `preventDefault` pada `mousedown` toolbar.
6. **Dipilih `node:sqlite`** alih-alih `better-sqlite3` agar tidak ada kompilasi native di mesin peninjau.

## Cara memverifikasi
- **Kebenaran:** 12 tes otomatis (`npm test`) untuk aturan akses, validasi, sanitasi, dan impor `.md/.txt/.docx`.
- **UX & keandalan:** uji E2E di Chrome nyata — buat/ganti nama/format → *reload* → format bertahan; Alice membagikan ke Bob (editor) dan Carol (viewer); Carol tidak bisa mengedit; hasil edit Bob terlihat oleh Alice; unggah `.md` berhasil dan `.exe` ditolak; tanpa galat konsol. Tangkapan layar di `docs/screenshots/`.
- **Keamanan dasar:** tes eksplisit bahwa `<script>` dan atribut `onclick` dibuang, serta orang asing mendapat 404.
- **Yang tidak diverifikasi:** beban/konkurensi tinggi, browser selain Chrome, kualitas konversi `.docx` kompleks (tabel, gambar).
