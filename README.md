# WMVAA AI Grader Pro

Platform koreksi Lembar Jawaban Komputer (LJK) & asesmen digital tingkat enterprise berbasis **Next.js 16 (App Router)**, **Google Gemini Vision & AI**, dan **Google Sheets** sebagai database cloud real-time. Dirancang untuk operasional sekolah (Admin & Guru) melalui browser desktop, mobile, PWA, serta aplikasi Android pendamping.

* 🌐 **Aplikasi Web Live:** [https://app.wmvaa.id/ai-grader](https://app.wmvaa.id/ai-grader)
* 🏫 **Portal Resmi WMVAA:** [https://wmvaa.id](https://wmvaa.id) · [https://app.wmvaa.id](https://app.wmvaa.id)
* 📱 **Repository Aplikasi Android:** [AiWerek-Tech/ai-grader-pro-mobile](https://github.com/AiWerek-Tech/ai-grader-pro-mobile)

---

## Fitur Utama Web

### 1. Autentikasi, RBAC & Keamanan Sesi
* **Login Terenkripsi:** Cookie HTTP-only terenkripsi via `iron-session` (masa berlaku sesi 6 jam) dengan validasi hash `bcryptjs`.
* **Pilih Cepat Akun Guru / Admin:** Dropdown nama guru/admin otomatis dari data pengguna untuk login cepat yang rapi di desktop maupun layar HP.
* **Role-Based Access Control (RBAC):** Pemisahan hak akses ketat antara **ADMIN** dan **GURU** melalui middleware/proxy (`src/proxy.ts`) dan guard pada setiap Server Action (`requireAuth`, `requireAdmin`).

### 2. Dashboard Overview & Pemantauan Akademik (`/dashboard`)
* Ringkasan statistik siswa, guru, kunci jawaban, hasil koreksi, serta status Sesi Akademik aktif (Tahun Ajaran & Semester).
* Indikator kesehatan sistem cepat dan navigasi responsif (sidebar sticky di desktop & bottom navigation bar ramah sentuhan di mobile).

### 3. Studio Kunci Jawaban Bank Soal AKM & Pembobotan Guru (`/dashboard/kunci`)
* **Studio 2-Langkah Gaya Bank Soal + Standar Kurikulum Merdeka:** Dropdown **Jenis Asesmen Kurikulum Merdeka** (STS, SAS, SAT, Sumatif Lingkup Materi, Formatif/UH, Diagnostik Kognitif/Non-Kognitif, ASAJ/US, Try Out, atau Kustom) & **Dropdown Semester** (Ganjil/Genap), konfigurasi **Jumlah Soal & Bobot Nilai %** per jenis dalam satu layar beserta tombol **Bagi Otomatis 100%** & rekapitulasi real-time, lalu pengisian kunci cepat via **Input Kilat** (tempel teks, Excel `.xlsx`, AI) atau **Papan Cepat** keyboard.
* **Ekstraksi AI Multi-Dokumen (`.docx`, `.pdf`, Multi-Foto, Teks):** Mendukung 3 mode cerdas (**Kunci Saja**, **Naskah Soal + Kunci**, atau **Jawab Naskah Soal Mentah oleh AI**), ekstraksi langsung file Word `.docx` tanpa konversi manual, pratinjau hasil sebelum diterapkan, serta mode **Ganti Semua** atau **Tambahkan Lanjutan (Append)**.
* **Kewenangan Pembobotan Penuh Guru:** Pembobotan persentase `%` per jenis soal (otomatis terhitung ke poin per butir), pilihan **4 Opsi (A–D) / 5 Opsi (A–E)** langsung di kartu PG, opsi lanjutan **AKM Kompleks (`Mutlak` / `Parsial Proporsional`)**, penalti jawaban salah, penandaan **Bonus / Anulir** opsional per nomor, duplikat multi-kelas sekaligus, filter & badge semester, cetak kunci pegangan guru, dan **Hitung Ulang Nilai Tersimpan (`Re-grade`)**.
* Mendukung penuh **8 tipe soal**:
  1. **Pilihan Ganda (`A–E`)** — `single_choice`
  2. **Pilihan Ganda (`A–D`)** — `single_choice_4`
  3. **Benar / Salah** — `true_false`
  4. **Pilihan Ganda Kompleks** — `multiple_select`
  5. **Benar-Salah Majemuk (MTF)** — `multiple_true_false`
  6. **Menjodohkan** — `matching`
  7. **Isian Singkat** — `short_answer`
  8. **Uraian / Esai** — `essay`

### 4. Generator & Cetak LJK Digital / Hybrid (`/dashboard/ljk` & `/print/ljk`)
* Menghasilkan lembar LJK siap cetak ukuran A4 lengkap dengan **Kop Sekolah dinamis (SMP / SMA)**, **QR Code identitas di kanan-atas kotak identitas siswa** (ID kunci, siswa/NIS), dan **4 penanda sudut (*fiducial markers*)** untuk kalibrasi pemindaian OMR & AI Vision berakurasi tinggi.
* **Tata Letak Kolom & Area Jawaban Adaptif:** Pembagian jumlah soal objektif seimbang per kolom (mis. 30 soal menjadi `10 + 10 + 10` di 3 kolom), kotak tulis terbuka untuk **Isian Singkat** (mendukung angka, pecahan, simbol matematika, maupun kata), serta **Zona Uraian/Esai Terintegrasi** anti-terpotong yang menyesuaikan tinggi baris secara otomatis atau berpindah ke Halaman 2 bila diperlukan.
* Mendukung filter lintas semester (`Semua Semester / Ganjil / Genap`), cetak per kelas, pemilihan siswa tertentu, serta pencetakan langsung dari Android APK melalui bridge `PrintManager`.

### 5. Pemindai & Analisis LJK Hibrida (`/dashboard/analisis` & `/api/scan`)
* **Hybrid OMR + Gemini Vision Consensus Engine:** Memadukan deteksi grid OMR lokal berkecepatan tinggi (`hybrid-detector.ts`) dengan pembacaan visual AI (`gemini-fallback.ts`) serta fallback otomatis yang aman.
* **Auto-Resolve Kunci via QR & Progres Kelengkapan Kelas:** Mengenali kode ujian dari QR Code kanan-atas secara otomatis, menampilkan bar **Progres Scan Kelas & Daftar Siswa Belum Discan**, serta mencocokkan NIS/nama siswa secara otomatis dan menyimpan draft ke `localStorage`.
* **Multi-Input Fleksibel:** Potret kamera 1-klik dari HP, unggah banyak foto dari galeri sekaligus, atau *Live WebRTC Scanner* dengan panduan bidik *4 corner fiducial*.

### 6. Hasil Nilai, Cetak PDF Nilai Kelas Ber-Kop Sekolah & Analisis Butir (`/dashboard/hasil`)
* **Cetak PDF Nilai Kelas Ber-Kop Sekolah Resmi (`HasilPrintSheet`):** Mencetak laporan daftar nilai siswa per kelas ukuran A4 siap arsip lengkap dengan **Kop Surat Sekolah Resmi (Logo Yayasan & Sekolah, Nama Yayasan, Nama Sekolah SMP/SMA, Alamat)**, ringkasan statistik kelas & ketuntasan KKM, tabel nilai berurut abjad (`NIS, Nama, Kelas, B/S/K, Nilai Akhir, Predikat, Ketuntasan`), serta blok tanda tangan **Kepala Sekolah & Guru Mata Pelajaran**.
* **Analisis Daya Serap Butir Soal Visual:** Menampilkan persentase ketercapaian per nomor soal lengkap dengan klasifikasi tingkat kesukaran (**Mudah / Sedang / Sulit**) untuk evaluasi pembelajaran guru.
* **Automated Essay Scoring (AI) & Ekspor Excel:** Menilai jawaban uraian/esai siswa secara batch menggunakan Gemini AI berdasarkan rubrik & poin maksimal (`scoreStudentEssaysWithAIAction`), inspeksi jawaban per nomor soal secara interaktif, override skor terkontrol, filter lintas semester, dan ekspor laporan `.xlsx` (`exceljs`).

### 7. Manajemen Data Master & Akademik
* **Data Siswa (`/dashboard/siswa`):** CRUD siswa, filter kelas & jenjang (`SMP`/`SMA`), validasi data, operasi massal (*bulk delete/clean*), serta impor/ekspor Excel.
* **Data Guru & Akun (`/dashboard/guru` — Admin):** Tambah/edit akun guru, aktif/nonaktifkan status akun, reset password, dan unggah foto profil.
* **Kelas, Mata Pelajaran & Kenaikan Kelas (`/dashboard/kelas-mapel`):** Pengelolaan master kelas/mapel serta fitur kenaikan kelas massal.
* **Tugas Mengajar (`/dashboard/tugas-mengajar` — Admin):** Penugasan relasi Guru, Mata Pelajaran, dan Kelas.

### 8. Pengaturan AI, System Doctor & Audit Log (Admin)
* **Pengaturan Sistem (`/dashboard/settings`):** Atur Tahun Ajaran/Semester aktif, model Gemini AI, dan pool multi API Key (`ai_api_keys_pool`) dengan rotasi *round-robin*.
* **System Doctor (`/dashboard/doctor`):** Diagnostik integritas struktur tab Google Spreadsheet dan pemulihan otomatis (*self-healing*).
* **Audit Log (`/dashboard/logs`):** Pemantauan riwayat aktivitas autentikasi, pemindaian, dan perubahan data.
* **QR Akses HP Guru (`/api/system/network`):** Pembuatan QR Code instan dari header dashboard untuk menghubungkan aplikasi Android guru ke server hosting atau server LAN sekolah.

---

## Teknologi & Arsitektur

* **Framework:** Next.js `16.2.3` (App Router, Turbopack, `basePath: /ai-grader`) & React `19.2.4`
* **Styling & UI:** Tailwind CSS v4, Lucide React, Sonner, `next-themes`, `qrcode.react`
* **AI & Pemrosesan Citra:** `@google/generative-ai`, `jsqr`, `sharp` *(opsional dengan lazy loader aman)*
* **Database & Ekspor:** `googleapis` (Google Sheets API v4), `exceljs`
* **Keamanan:** `iron-session`, `bcryptjs`, validasi origin Server Actions, CSP & security headers di `next.config.mjs`
* **Runtime Hosting:** Custom HTTP wrapper `server.js` kompatibel dengan **cPanel Node.js App (LiteSpeed / Phusion Passenger)** pada Node.js `>= 20.0.0`.

---

## Menjalankan Secara Lokal

1. Salin `.env.example` menjadi `.env.local`.
2. Isi variabel konfigurasi:
   * `GOOGLE_APPLICATION_CREDENTIALS` (path ke file JSON Service Account Google)
   * `GOOGLE_SPREADSHEET_ID` (ID Google Spreadsheet)
   * `GEMINI_API_KEY` (API key Gemini)
   * `SESSION_SECRET` (wajib minimal 32 karakter acak untuk mode production)
   * `NEXT_PUBLIC_BASE_PATH` (default `/ai-grader`, atau kosongkan jika berjalan di root domain)
3. Pasang dependensi & jalankan server pengembangan:
   ```bash
   npm install
   npm run dev
   ```
4. Akses aplikasi di `http://localhost:3000/ai-grader`.

---

## Variabel Environment Penting

| Variabel | Keterangan |
| --- | --- |
| `NEXT_PUBLIC_BASE_PATH` | Prefix subfolder hosting (contoh `/ai-grader` untuk `https://app.wmvaa.id/ai-grader`). |
| `SESSION_SECRET` | Kunci enkripsi cookie `iron-session` (wajib minimal 32 karakter di production). |
| `GOOGLE_APPLICATION_CREDENTIALS` | Path absolut atau relatif ke file kredensial JSON Service Account Google Sheets. |
| `GOOGLE_SPREADSHEET_ID` | ID dokumen Google Spreadsheet database. |
| `GEMINI_API_KEY` | API key utama Google Gemini (`GEMINI_API_KEYS` opsional untuk multi-key). |
| `ALLOW_RUNTIME_SETUP` | Sebaiknya `false` di production; aktifkan `true` hanya saat onboarding awal. |
| `BOOTSTRAP_ADMIN_USERNAME` | Username admin awal di production jika sheet pengguna masih kosong. |
| `BOOTSTRAP_ADMIN_PASSWORD` | Password admin awal di production (minimal 12 karakter). |
| `BOOTSTRAP_ADMIN_NAME` | Nama tampilan akun admin awal. |
| `EMERGENCY_ADMIN_RESET_PASSWORD` | Opsional untuk reset admin darurat (`forceResetAdminAction`). |

---

## Build & Deploy Production (cPanel Node.js)

1. Jalankan pemeriksaan tipe dan build produksi:
   ```bash
   npx tsc --noEmit
   npm run build
   ```
2. Pada **cPanel File Manager** (`Application root` mis. `~/wmvaa-grader`), unggah file produksi yang dibutuhkan (`server.js`, `next.config.mjs`, `package.json`, `package-lock.json`, `.env.local`, file kredensial Google JSON, `.next/` tanpa `.next/cache`, dan `public/`).
3. Pada **cPanel Setup Node.js App**:
   * **Node.js version:** `20.x`
   * **Application mode:** `Production`
   * **Application startup file:** `server.js`
   * Klik **Run NPM Install** (saat instalasi awal atau pembaruan dependensi), isi **Environment variables**, lalu klik **RESTART**.
