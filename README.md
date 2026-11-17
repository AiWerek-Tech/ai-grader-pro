# WMVAA AI Grader Pro

Aplikasi penilaian LJK berbasis Next.js, Google Sheets, dan Gemini untuk workflow guru/admin.

## Menjalankan lokal

1. Salin `.env.example` menjadi `.env.local`
2. Isi `GOOGLE_APPLICATION_CREDENTIALS`, `GOOGLE_SPREADSHEET_ID`, `GEMINI_API_KEY`
3. Jalankan `npm install`
4. Jalankan `npm run dev`

## Environment penting

- `SESSION_SECRET`
  Wajib untuk production, minimal 32 karakter acak.
- `ALLOW_RUNTIME_SETUP`
  Default sebaiknya `false` di production. Ubah ke `true` hanya saat onboarding awal.
- `BOOTSTRAP_ADMIN_USERNAME`
  Username admin pertama di production.
- `BOOTSTRAP_ADMIN_PASSWORD`
  Password admin pertama di production, minimal 12 karakter.
- `BOOTSTRAP_ADMIN_NAME`
  Nama tampilan admin pertama.
- `EMERGENCY_ADMIN_RESET_PASSWORD`
  Opsional. Password admin darurat saat `forceResetAdminAction` dipakai. Jika kosong, sistem akan membuat password sementara acak yang kuat.

## Bootstrap production

Di mode production, aplikasi tidak lagi membuat akun default lemah seperti `admin123` atau `guru123`.
Jika tabel `USERS` masih kosong, bootstrap hanya akan membuat satu akun admin dari env:

- `BOOTSTRAP_ADMIN_USERNAME`
- `BOOTSTRAP_ADMIN_PASSWORD`
- `BOOTSTRAP_ADMIN_NAME`

## Checklist finishing production

- Set `SESSION_SECRET` yang kuat dan unik
- Pastikan file service account tidak ikut ter-commit
- Set `ALLOW_RUNTIME_SETUP=false` setelah onboarding selesai
- Pastikan reset password admin/guru tidak lagi memakai password statis; distribusikan file kredensial sementara hasil reset dengan aman
- Jalankan `npm run lint`
- Jalankan `npx tsc --noEmit`
- Jalankan `npm run build`
- Uji alur login, setup awal, scan LJK, simpan hasil, dan override skor pada staging
