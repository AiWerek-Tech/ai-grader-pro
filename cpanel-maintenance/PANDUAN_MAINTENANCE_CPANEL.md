# Panduan Pemasangan Halaman Pemeliharaan (cPanel)

## Mengapa Perlu File Terpisah di `public_html/ai-grader/`?
Ketika **Next.js (Node.js App)** dimatikan (*Stop App*) di cPanel, aplikasi Next.js tidak dapat merespons permintaan pengguna. Tugas menampilkan halaman pemeliharaan harus diambil alih oleh **Web Server (Apache / LiteSpeed)** melalui file statis `maintenance.html` dan aturan `.htaccess`.

---

## Cara Pasang (Hanya 1 Kali Setup, Berlaku Seterusnya)

1. Buka **File Manager** di cPanel Anda.
2. Masuk ke folder publik URL aplikasi: **`public_html/ai-grader/`**  
   *(Pastikan di folder tersebut terdapat file `.htaccess` bawaan cPanel Node.js App; jika file tidak terlihat, klik **Settings** di kanan atas File Manager lalu centang **Show Hidden Files (dotfiles)**).*
3. **Upload file `maintenance.html`** ke dalam folder `public_html/ai-grader/` (sejajar dengan `.htaccess`).
4. **Edit file `.htaccess`** di dalam `public_html/ai-grader/`:
   * Jangan mengubah atau menghapus baris di antara `# DO NOT REMOVE. CLOUDLINUX PASSENGER CONFIGURATION BEGIN` dan `# DO NOT REMOVE. CLOUDLINUX PASSENGER CONFIGURATION END`.
   * Di **bagian paling bawah** (di bawah `CONFIGURATION END`), salin dan tempelkan seluruh isi dari file `htaccess-cpanel.txt`.
   * Klik **Save Changes**.

---

## Cara Kerja & Fitur

* **Otomatis Saat Next.js Stop / Restart / Crash:**  
  Begitu Anda menekan **Stop App** atau **Restart** di cPanel, semua pengunjung (baik dari browser HP, desktop, maupun APK Android) otomatis melihat halaman **"Aplikasi Sedang Dalam Pemeliharaan"** yang rapi dan menenangkan.
* **Auto-Redirect Begitu Server Aktif Kembali:**  
  Halaman `maintenance.html` mengecek endpoint Next.js (`/ai-grader/manifest.webmanifest`) setiap **10 detik**. Begitu Anda menekan **Start App** di cPanel, halaman di layar guru otomatis terbuka kembali tanpa harus menutup browser atau membuka ulang APK.
* **Mode Pemeliharaan Manual (Opsional):**  
  Jika Anda ingin menampilkan halaman pemeliharaan *sebelum* menghentikan Node.js atau selama proses maintenance database, cukup buat file kosong bernama `maintenance.on` di `public_html/ai-grader/`. Hapus (atau ganti nama ke `maintenance.off`) jika sudah selesai.
