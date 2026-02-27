# CVSKJ - Sales & Distribution Management System

A modern, responsive web application for managing sales, inventory, and employees, built with React, Vite, and Supabase.

## 🚀 Features

- **Dashboard**: Real-time overview of sales and stock.
- **Point of Sales (POS)**: Efficient transaction processing with cart management.
- **Inventory Management**: Track products, stock levels, and categories.
- **Customer Management**: Maintain customer profiles and credit limits.
- **Employee & Access Control**: Role-based access (Admin, Staff, etc.).
- **Reports**: Detailed sales and stock reports.
- **PWA Support**: Installable on devices as a native-like app.

## 🛠 Tech Stack

- **Frontend**: React, TypeScript, Vite
- **UI Framework**: Tailwind CSS, Shadcn UI
- **State Management**: TanStack Query, React Context
- **Database**: Supabase (PostgreSQL)
- **Deployment**: Static Hosting (aaPanel, Nginx, Vercel, Netlify)

---

## 📦 Deployment Guide: aaPanel (STB / VPS)

This guide details how to deploy the application on an STB (Set Top Box) or VPS running aaPanel.

### 1. Prerequisites (On your Computer)

- **Node.js**: Installed (v18 or later).
- **Source Code**: This project folder.

### 2. Build the Project

Before uploading to aaPanel, you must build the project to generate the static files.

1.  Open your terminal in the project folder.
2.  Install dependencies (if not already done):
    ```bash
    npm install
    ```
3.  Create the production build:
    ```bash
    npm run build
    ```
4.  This will create a **`dist`** folder. This folder contains everything you need for the website.

### 3. Setup aaPanel

1.  **Login to aaPanel** on your STB/VPS.
2.  **Website** > **Add Site**.
3.  **Domain**: Enter your domain or IP address (e.g., `192.168.1.100`).
4.  **Database**: Not needed (we use Supabase externally).
5.  **PHP Version**: Pure Static.
6.  Click **Submit**.

### 4. Upload Files

1.  Go to **Files** in aaPanel.
2.  Navigate to the website directory (usually `/www/wwwroot/your-domain`).
3.  Delete standard files (`index.html`, `404.html`).
4.  **Upload** the contents of the **`dist`** folder you created in Step 2.
    - _Tip_: Zip the contents of `dist`, upload the zip, and unzip it in aaPanel for faster transfer.
5.  Ensure `index.html` is in the root of your site directory.

### 5. Configure Nginx (Vital for React Apps)

Since this is a Single Page Application (SPA), we need to tell Nginx to redirect all routes to `index.html`.

1.  In aaPanel, go to **Website**.
2.  Click the **Conf** (Configuration) button for your site.
3.  Select **URL Rewrite** (or manually edit Config).
4.  Add the following rule:

    ```nginx
    location / {
      try_files $uri $uri/ /index.html;
    }
    ```

5.  **Save** the configuration.

### 6. Environment Variables

The application connects to Supabase. These values are baked into the build, but if you need to change them, you must edit `.env.local` locally and rebuild.

Ensure your `.env.local` file has the correct Supabase credentials before running `npm run build`.

```env
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key
```

### 7. STB Specifics (Optimizations)

If running on a low-power STB (Armbian/Android):

- **Web Server**: Nginx is recommended over Apache for better performance.
- **Caching**: In aaPanel Site Config > **Site configuration**, enable caching for static assets (js, css, png) to reduce load.

---

## 💻 Local Development

To run the project locally on your machine:

1.  Install dependencies:
    ```bash
    npm install
    ```
2.  Start the development server:
    ```bash
    npm run dev
    ```
3.  Open `http://localhost:8080`.

## 🏗 Arsitektur Sistem (Frontend & Backend Terpisah)

Aplikasi ini dirancang dengan arsitektur modern **Terpisah (Decoupled)** yang membagi beban kerja antara tampilan (Frontend) dan pengolah data (Backend) menggunakan konsep *Backend-as-a-Service* (BaaS).

### 1. Frontend (Antarmuka Pengguna)
- **Teknologi:** React, TypeScript, Vite, Tailwind CSS.
- **Lokasi Kode:** Berada di dalam folder `src/`.
- **Tugas:** Menampilkan UI/UX, interaksi klik pengguna, validasi form, dan *routing* halaman.
- **Cara Kerja:** Berjalan murni di browser pengguna (*Client-Side*).

### 2. Backend (Database & API Server)
- **Teknologi:** Supabase (PostgreSQL, PostgREST API, GoTrue Auth).
- **Lokasi Kode:** Skema database dan *Logic* berada di folder `supabase/migrations/`.
- **Tugas:** Menyimpan data, mengamankan akses data (RLS/Row Level Security), validasi otentikasi login, dan mengeksekusi fungsi SQL.
- **Cara Kerja:** Berjalan di layanan server Cloud (Supabase) yang langsung merespons permintaan API dari Frontend.

---

## 🚀 Panduan Deployment Mudah Terpisah

Karena arsitekturnya terpisah, Anda meng-*hosting* (deploy) Frontend dan Backend di tempat yang berbeda agar jauh lebih aman, ringan, dan mudah dikelola.

### Langkah 1: Deploy Backend (Supabase)
Backend Anda sudah dikelola sepenuhnya oleh Supabase.
1. Buat proyek baru di [Supabase.com](https://supabase.com/).
2. Hubungkan ke *database*.
3. Salin konfigurasi di file `supabase/migrations/` dan jalankan di **SQL Editor** Supabase Anda untuk membentuk kerangka tabel, fungsi, dan profil secara otomatis.
4. **PENTING: Konfigurasi Login Google (Wajib)**
   - Masuk ke menu **Authentication** -> **Providers** di dasbor Supabase.
   - Aktifkan **Google**.
   - Masukkan **Client ID** dan **Client Secret** dari Google Cloud Console.
   - Tambahkan URL website Anda (contoh: `http://localhost:8080` untuk lokal, atau URL Vercel/Cloudflare Anda) ke bagian **URL Configuration** -> **Redirect URLs**.
5. Salin **Project URL** dan **Anon Key** yang diberikan oleh Supabase.

### Langkah 2: Deploy Frontend (Vercel / Cloudflare Pages)
Anda tidak perlu lagi menyewa VPS (aaPanel) yang mahal. Frontend React dapat di-*hosting* **GRATIS** dan sangat cepat menggunakan [Cloudflare Pages](https://pages.cloudflare.com/) atau [Vercel](https://vercel.com/):

**Cara Cloudflare Pages (Rekomendasi):**
1. Upload folder proyek (*JBROCK*) ini ke akun GitHub Anda.
2. Login ke **Cloudflare Dashboard**, masuk ke menu **Workers & Pages**, klik **Create -> Pages -> Connect to Git**.
3. Pilih repositori GitHub `JBROCK` Anda.
4. Gunakan pengaturan keamanan berikut pada menu *Build Settings*:
   - Framework preset: `Vite`
   - Build command: `npm run build`
   - Build output directory: `dist`
5. Buka menu **Environment Variables**, lalu masukkan kredensial Backend Anda:
   - `VITE_SUPABASE_URL` = `https://[KODE_PROYEK].supabase.co`
   - `VITE_SUPABASE_ANON_KEY` = `[KUNCI_ANON_PANJANG_ANDA]`
6. Klik **Save and Deploy**. Website Anda akan online dalam waktu kurang dari 2 menit.
*(Jika ada pembaruan kode di masa depan, Anda cukup "Push" ke GitHub, dan Cloudflare otomatis mengupdate website tanpa perlu setting manual).*

---

## 💻 Local Development (Bekerja Secara Lokal)

Jika Anda ingin mengubah tampilan/kode di komputer pribadi:
1. Pastikan terinstal **Node.js**
2. Ketik `npm install` untuk mengunduh pustaka.
3. Buat file bernama `.env.local` di root folder proyek, lalu isi URL dan Key Supabase Anda.
4. Ketik `npm run dev` untuk menjalankan website percobaan di `http://localhost:8080`.

## 📂 Struktur Direktori Proyek

```
JBROCK/
├── src/                  # 💻 FRONTEND: Semua kode tampilan (Pages, Komponen)
├── supabase/migrations/  # ⚙️ BACKEND: Semua skema Tabel, Fungsi SQL, dan Keamanan (RLS)
├── public/               # File statis (Ikon, Logo)
└── .env.local            # Kunci penghubung antara Frontend dan Backend (Tidak boleh masuk GitHub)
```
