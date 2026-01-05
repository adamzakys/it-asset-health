# 📱 BMS IT Asset & Logbook (Prototype)

![Status](https://img.shields.io/badge/Status-Prototype-orange) ![Platform](https://img.shields.io/badge/Platform-PWA-blue) ![MadeWith](https://img.shields.io/badge/Made%20with-HTML%20%26%20Google%20Apps%20Script-green)

Project iseng-iseng berhadiah (tapi serius) untuk mendigitalisasi operasional IT di PT Berlian Manyar Sejahtera. Aplikasi ini dibuat untuk menggantikan pelaporan manual via WhatsApp dan Excel menjadi sistem berbasis Web App (PWA) yang terintegrasi.

> **🚧 PERINGATAN:** Repository ini masih dalam tahap **Testing & Pengembangan (Prototype)**. Codingan mungkin masih berantakan dan fitur bisa berubah sewaktu-waktu.

## 🌟 Fitur Utama

Aplikasi ini dirancang sebagai "Super App" sederhana untuk teknisi IT/Magang:

* **📷 Intelligent QR Scanner:** Scan QR Code aset langsung dari Kamera atau upload file QR dari Galeri HP.
* **🛠️ Patrol Reporting:** Lapor kondisi aset (Normal/Rusak) dengan bukti foto ganda (Kamera/Galeri).
* **📝 Digital Logbook:** Jurnal harian untuk mencatat aktivitas teknisi/magang + lokasi & foto kegiatan.
* **📲 Smart WhatsApp Share:** Generate teks laporan otomatis yang rapi & formal, siap kirim ke grup WA (anti-repot ngetik).
* **🧰 IT Tools:** Kumpulan script & link download penting (AutoClean, Driver Printer, Network Fix) dalam satu genggaman.
* **📊 Dashboard & Statistik:** Pantau jumlah aset dan status kerusakan secara real-time.

## 🛠️ Teknologi yang Dipakai

Project ini dibangun dengan konsep *Serverless* hemat biaya:

* **Frontend:** HTML5, JavaScript (Vanilla), Tailwind CSS (via CDN).
* **Backend & Database:** Google Apps Script (GAS) & Google Sheets.
* **Library:** `html5-qrcode` (untuk scanner), `SweetAlert2` (untuk popup cantik).
* **Hosting:** Netlify (untuk frontend wrapper).

## 🚀 Cara Akses (Demo)

Karena ini PWA, tidak perlu install di PlayStore.
1.  Buka link: **[MASUKKAN LINK NETLIFY KAMU DI SINI]**
2.  Buka di Chrome (Android) / Safari (iOS).
3.  Pilih menu titik tiga -> **"Add to Home Screen"**.

## 📂 Struktur Project

```text
/
├── index.html        # File utama aplikasi (UI & Logic Frontend)
├── script.js         # (Jika dipisah) Logika JavaScript
├── manifest.json     # Konfigurasi PWA (Ikon, Nama App)
├── sw.js             # Service Worker (untuk fitur offline/cache)
└── README.md         # File dokumentasi ini
