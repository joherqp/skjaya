# Panduan Deploy ke Cloudflare Pages (via CLI)

Dokumen ini berisi langkah-langkah untuk melakukan *deploy* aplikasi JBROCK ke Cloudflare Pages menggunakan baris perintah (CLI). Cara ini berguna jika Anda ingin melakukan *deploy* manual tanpa melalui GitHub.

## Prasyarat
Pastikan Anda sudah memiliki akun Cloudflare dan telah menginstal Node.js di komputer Anda.

## Langkah-langkah

### 1. Instalasi Wrangler
Wrangler adalah alat CLI resmi dari Cloudflare. Instal secara global menggunakan npm:

```bash
npm install -g wrangler
```

### 2. Login ke Cloudflare
Jalankan perintah berikut untuk menghubungkan CLI dengan akun Cloudflare Anda:

```bash
wrangler login
```
*Jendela browser akan terbuka, silakan klik "Allow" untuk memberikan akses.*

### 3. Build Proyek
Sebelum melakukan *deploy*, Anda harus membuat versi produksi dari aplikasi:

```bash
npm run build
```
Hasil *build* akan berada di dalam folder `dist`.

### 4. Deploy ke Cloudflare Pages
Gunakan perintah berikut untuk mengunggah folder `dist` ke Cloudflare Pages:

```bash
wrangler pages deploy dist
```

### 5. Konfigurasi (Opsional)
Saat pertama kali menjalankan perintah di atas, Anda akan diminta untuk:
- **Create a new project?** Pilih `Yes`.
- **Project name:** Masukkan nama proyek Anda (misal: `jbrock-app`).
- **Production branch:** Biasanya `main` atau `master`.

---

## Tips Tambahan:
- **Environment Variables**: Jika aplikasi Anda membutuhkan variabel lingkungan (seperti `VITE_SUPABASE_URL`), pastikan untuk menambahkannya di Dashboard Cloudflare Pages (Menu **Settings -> Functions -> Environment Variables**).
- **Direct Link**: Setelah proses selesai, Anda akan mendapatkan URL unik (misal: `https://xxxx.jbrock-app.pages.dev`).

---
*Dibuat pada: 26 Februari 2026*
