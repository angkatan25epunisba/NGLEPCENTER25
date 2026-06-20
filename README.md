# EP Care Center

Platform aspirasi, konsultasi, curhat akademik, kendala perkuliahan, keluhan, dan masukan
mahasiswa Program Studi Ekonomi Pembangunan, Fakultas Ekonomi dan Bisnis, Universitas Islam
Bandung — disampaikan kepada Ketua Kelas sebagai perantara ke dosen wali dan pihak terkait.

Desain: glassmorphism premium, neon accent, aurora gradient, particle background, custom cursor,
smooth scroll-reveal, dan animasi premium di semua halaman.

---

## 1. Struktur Folder

```
epcc/
├── index.html                 # Landing page
├── css/
│   ├── main.css                # Design system: variabel warna, tipografi, komponen (card, btn, dll)
│   ├── home.css                 # Khusus landing page
│   └── dashboard.css            # Khusus dashboard
├── js/
│   ├── firebase.js              # Init Firebase, Auth, Firestore helper, role system
│   ├── ui.js                    # Cursor, particle, toast, scroll-reveal, util
│   └── dashboard.js              # Logic dashboard mahasiswa & admin
├── pages/
│   ├── about.html
│   ├── team.html
│   ├── gallery.html
│   ├── contact.html
│   └── dashboard.html
├── assets/
│   └── favicon.svg
└── firestore.rules             # Security Rules (deploy lewat Firebase CLI/Console)
```

**Penting:** semua halaman di folder `pages/` mereferensikan asset dengan path relatif `../css/`,
`../js/`, `../assets/`. Jangan pindahkan file ke folder lain tanpa menyesuaikan path tersebut.

---

## 2. Setup Firebase

1. Buka [Firebase Console](https://console.firebase.google.com) → buat project baru (atau pakai
   project yang sudah ada di `js/firebase.js`, yaitu `nglepcenter25`).
2. **Authentication** → Sign-in method → aktifkan **Google**.
3. **Firestore Database** → buat database (mode production).
4. **Storage** → aktifkan, untuk upload file/gambar laporan.
5. Salin konfigurasi web app (`apiKey`, `authDomain`, dst) dan tempel ke `js/firebase.js` jika
   kamu membuat project baru — saat ini sudah terisi dengan project `nglepcenter25`.
6. Tambahkan domain GitHub Pages kamu (`<username>.github.io`) ke
   **Authentication → Settings → Authorized domains** agar login Google tidak diblokir.

### Deploy Firestore Rules

```bash
npm install -g firebase-tools
firebase login
firebase init firestore   # pilih project yang sama, gunakan firestore.rules yang sudah ada
firebase deploy --only firestore:rules
```

Aturan akses (`firestore.rules`) sudah mengimplementasikan:
- **Mahasiswa**: hanya bisa membuat & melihat laporan miliknya sendiri.
- **Admin**: bisa melihat & mengelola seluruh laporan.
- **Founder / Developer**: akses penuh ke semua koleksi (termasuk hapus).
- **Akun privileged otomatis**: `kamilfauzan651@gmail.com` → role `developer`,
  `angkatan25epunisba@gmail.com` → role `founder` (logic ada di `js/firebase.js`, dieksekusi saat
  login pertama kali / setiap login via `ensureUserDocument`).

---

## 3. Struktur Firestore Collections

| Collection          | Isi |
|----------------------|-----|
| `users`              | uid, email, displayName, photoURL, role, reportCount, createdAt, lastLoginAt |
| `reports`            | uid, nama, email, kategori, judul, isi, status, urgency, fileUrls[], timestamp, riwayatStatus[], seenAdmin, seenUser |
| `notifications`      | uid, judul, pesan, type, read, createdAt |
| `gallery`            | title, imageUrl, category, date, createdAt |
| `settings`           | konfigurasi global (opsional) |
| `activity_logs`      | log aksi admin/staff untuk audit |
| `contact_messages`   | name, email, subject, message, status, createdAt (dari halaman Kontak) |

---

## 4. Cara Deploy ke GitHub Pages

```bash
# 1. Inisialisasi repo (jika belum)
git init
git add .
git commit -m "Initial commit: EP Care Center"

# 2. Hubungkan ke repo GitHub kamu
git remote add origin https://github.com/<username>/<repo>.git
git branch -M main
git push -u origin main

# 3. Aktifkan GitHub Pages
# Buka repo di GitHub → Settings → Pages
# Source: Deploy from a branch → Branch: main → Folder: / (root)
# Simpan, tunggu 1-2 menit, situs aktif di:
# https://<username>.github.io/<repo>/
```

Karena semua path di HTML menggunakan **path relatif** (bukan absolut `/css/...`), website ini
otomatis kompatibel baik di-deploy ke root domain (`username.github.io`) maupun ke subpath repo
(`username.github.io/repo-name/`) — tidak perlu setting tambahan.

---

## 5. Akun dengan Akses Penuh (Developer/Founder)

Role berikut otomatis terdeteksi berdasarkan **email Google** saat login pertama kali:

| Email | Role |
|---|---|
| `kamilfauzan651@gmail.com` | Developer |
| `angkatan25epunisba@gmail.com` | Founder |

Role lain (`mahasiswa`, `admin`) di-assign manual lewat Firestore Console (`users/{uid}` → ubah
field `role`), atau ditambahkan oleh akun privileged melalui panel admin di kemudian hari.

---

## 6. Status yang Sudah Diimplementasikan

✅ Landing page (hero, statistik animasi, how-it-works, kategori, CTA)
✅ Login Google + role system + privileged accounts
✅ Halaman About, Team, Gallery (masonry + lightbox + filter, Firestore-backed), Contact (form → Firestore)
✅ Dashboard mahasiswa: buat laporan, kategori, upload file, urgensi, history, tracking timeline
✅ Dashboard admin/founder/developer: statistik, manajemen laporan, catatan internal
✅ Notifikasi toast (success/error/warning/info)
✅ Custom cursor, particle background, aurora gradient, glassmorphism, neon glow, scroll reveal
✅ Firestore Security Rules sesuai role hierarchy
✅ Fully responsive (mobile + desktop)

### Opsional / Bisa Dikembangkan Lebih Lanjut
- Integrasi **Lottie animation** (disebut di brief sebagai "nice-to-have") belum ditambahkan —
  bisa ditambah dengan memuat `lottie-web` via CDN dan menaruh file `.json` animasi di `assets/`.
- Grafik statistik di dashboard admin (kategori/bulanan) sebaiknya dicek lagi datanya terhubung
  dengan benar ke Firestore real-time saat kamu mulai mengisi data laporan sungguhan.
- Nomor WhatsApp di halaman Kontak (`wa.me/6280000000000`) adalah **placeholder** — ganti dengan
  nomor asli Ketua Kelas/Admin.
- Link Instagram (`@ep.unisba`) di halaman Kontak juga **placeholder** — sesuaikan dengan akun resmi.

---

## 7. Kenapa Sebelumnya Tampil Tanpa Style?

Jika sebelumnya situs tampil sebagai teks polos tanpa warna/animasi saat dibuka di GitHub Pages,
itu karena file `css/`, `js/`, `pages/`, `assets/` belum disusun dalam struktur folder yang benar
saat di-upload ke repo (semua file tercampur rata di satu folder). Karena setiap halaman
mereferensikan asset dengan path relatif (`css/main.css`, `../js/ui.js`, dst), browser gagal
menemukan filenya (404) sehingga semua styling tidak termuat. Paket ini sudah disusun ulang
dengan struktur folder yang benar — tinggal upload **seluruh folder ini** (bukan file lepas) ke
root repository GitHub kamu.
