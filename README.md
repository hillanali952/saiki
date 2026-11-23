# PES Face Generator

Foto -> wajah PES 2021 PC. Semua diproses di perangkat.

## A. Pasang sebagai situs (GitHub Pages)
Upload semua file ke repo, lalu Settings -> Pages -> Deploy from a branch (main, root).

## B. Jadikan APK (dibangun otomatis oleh GitHub, gratis)
1. Upload semua file ke repo (seperti A). `build-apk.yml` ikut terunggah di root, itu tidak apa-apa.
2. Di repo: Add file -> Create new file. Pada kolom nama ketik:  .github/workflows/build-apk.yml
   (ketik garis miring, folder terbentuk sendiri). Tempel seluruh isi file `build-apk.yml`, lalu Commit.
3. Buka tab Actions -> pilih "Build APK" -> Run workflow. Tunggu sekitar 5-10 menit sampai hijau.
4. Buka tab Releases (halaman utama repo, sisi kanan/bawah) -> rilis terbaru -> unduh PESFace.apk -> pasang.
   (Izinkan "pasang dari sumber tidak dikenal" untuk Chrome/File bila diminta.)
Kalau langkah 3 gagal (merah), buka langkah yang merah, salin tulisan galatnya, dan kirim ke saya.

APK sudah membawa MediaPipe dan modelnya, jadi deteksi wajah jalan tanpa internet.
Hasil ZIP disimpan di Dokumen/PESFace/ atau lewat tombol Bagikan.
