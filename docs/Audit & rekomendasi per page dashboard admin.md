## Yang sudah saya eksekusi (patch bug paling krusial)
- `src/app/dashboard/settings/page.tsx`: memperbaiki bug input tab *Identitas* yang sebelumnya pakai `onChange={()=>{}}` (state tidak tersinkron, preview & submit bisa tidak sesuai).
- `src/app/dashboard/kunci/page.tsx`: tombol `Buat Master Baru` sebelumnya dead-end (tidak ada aksi) dan ikon IRT tampil “garbled”; sekarang ada feedback `toast.info(...)` dan ikon diperbaiki.
- `src/app/dashboard/hasil/page.tsx`: memperbaiki bug filter search yang sebelumnya membaca field yang tidak ada (`nama_tes`), sekarang pakai `judul_ujian`.
- `src/app/dashboard/page.tsx` (dashboard overview): memperbaiki issue Tailwind class dinamis seperti `to-${color}` / `hover:border-${color}` yang berisiko tidak generate style di build Tailwind; diganti mapping statis.
- `src/components/siswa/SearchFilters.tsx`: menambahkan `id="search-input"` agar keyboard shortcut “search focus” dari `siswa/page.tsx` benar-benar bekerja.

Saya juga rapikan beberapa warning lint (unused vars) di modul AI utility supaya `npm run lint` bersih lagi, dan `npm run build` sukses.

---

## Audit & rekomendasi per page dashboard admin

- `src/app/dashboard/page.tsx` (overview)
  - Status: **belum sempurna (desain berisiko “hilang”)** karena Tailwind class dinamis.
  - Rekomendasi: gunakan mapping statis (sudah saya lakukan), plus guard: `user?.nama?.split(' ')?.[0]` agar tidak crash jika `nama` kosong/undefined.

- `src/app/dashboard/siswa/page.tsx`
  - Status: **cukup fungsional**, tapi ditemukan bug keyboard shortcut.
  - Rekomendasi: pecah component besar ini jadi sub-komponen agar state/logic lebih aman; pertimbangkan mengintegrasikan atau menghapus lazy component yang benar-benar tidak dipakai (mis. `BulkOperations` bila tetap tidak dirender).

- `src/app/dashboard/guru/page.tsx`
  - Status: **cukup fungsional** (CRUD wiring terlihat nyambung).
  - Rekomendasi (fungsi+security): `downloadWelcomeCard` menuliskan password (plaintext) di file yang diunduh. Ini sebaiknya dihapus/diubah jadi token sementara atau tanpa password.

- `src/app/dashboard/tugas-mengajar/page.tsx`
  - Status: **cukup baik** (add/delete tersambung).
  - Rekomendasi: tampilkan toast untuk error `console.error(e)` agar user paham gagal/sukses, bukan hanya log.

- `src/app/dashboard/kelas-mapel/page.tsx`
  - Status: **baik** (modal add/edit/delete jelas).
  - Rekomendasi: validasi duplikasi (mis. nama kelas/mapel) dan perjelas UX saat update gagal (mis. tampilkan res.message secara konsisten).

- `src/app/dashboard/kunci/page.tsx`
  - Status: **belum sempurna** karena “Buat Master Baru” belum implement.
  - Rekomendasi: implement create/edit UI yang memanggil `saveKunciAction(...)` (sambil menentukan `guruId`/pemilik ujian). Sampai itu ada, lebih baik “disable/hide” tombol daripada sekadar toast.

- `src/app/dashboard/hasil/page.tsx`
  - Status: **sudah dibetulkan** untuk bug search.
  - Rekomendasi: guard `det.confidence_score` jika bisa undefined/null (biar tidak tampil `NaN%`), dan pertimbangkan optimasi lookup (hindari `siswa.find`/`kunci.find` berulang per row dengan membangun map).

- `src/app/dashboard/doctor/page.tsx`
  - Status: **cukup baik**.
  - Rekomendasi: setelah `healSystemAction()`, pertimbangkan menampilkan state “refresh diagnostics” (spinner) agar terasa tidak “beku” saat diagnosis reload.

- `src/app/dashboard/logs/page.tsx`
  - Status: **baik untuk read-only**, tapi dari sisi UX/perform **kurang ideal**.
  - Rekomendasi: tambahkan pagination / filter level (ERROR/WARN/INFO) atau limit via query param. Saat ini selalu ambil 500 log.

- `src/app/dashboard/settings/page.tsx`
  - Status: **sudah saya perbaiki bug fungsional** (input branding).
  - Rekomendasi: validasi URL logo (serta pastikan domain host gambar diizinkan untuk `next/image`), dan saat restore: batasi ukuran file + validasi schema JSON agar tidak merusak data.

- `src/app/dashboard/profile/page.tsx`
  - Status: **cukup baik**.
  - Rekomendasi: sanitasi `profile_url` (minimal enforce `https://` atau allowlist domain) dan tampilkan error yang lebih spesifik saat update gagal.

---

## Bagian mana dulu selanjutnya?
Kalau Anda ingin saya lanjut “eksekusi perbaikan” (bukan hanya rekomendasi), prioritas berikutnya yang paling memberi dampak:
1. `dashboard/kunci/page.tsx` (implementasi “Buat Master Baru” beneran)
2. `dashboard/logs/page.tsx` (pagination/filter)
3. `dashboard/siswa/page.tsx` (refactor jadi komponen kecil + rapikan integrasi fitur lazy)

Kalau Anda setuju, sebutkan Anda mau fokus ke yang mana dulu (kunci vs logs vs siswa).