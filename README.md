# Tester Notepad - Web QA Credential, Chrome Dashboard & Drawer

> **Browser Extension Manifest V3** dengan desain ultra-minimalis monokrom (hitam, putih, abu-abu) tanpa emoji, dirancang khusus untuk Web Tester / QA Engineer untuk menyimpan, menyalin kredensial (Email & Password), autofill form login, serta menampilkan seluruh catatan email & testing tools langsung di **Dashboard Chrome** (New Tab Page) dan In-Page Drawer.

---

## Fitur Utama

1. **Chrome Workspace Dashboard (New Tab Integration):**
   - Catatan email, server codes, dan scratchpad kini otomatis muncul di **Dashboard Chrome** setiap kali membuka tab baru (`chrome://newtab`).
   - **Integrated Omnibox Search Bar:** Ketik kata kunci untuk pencarian Google instan atau masukkan URL/localhost untuk navigasi cepat (tekan `/` untuk fokus cepat).
   - **Digital Clock & Date:** Jam digital presisi & tanggal live untuk monitor sesi testing.
   - **Full Credentials Grid:** Kelola catatan email & password dengan filter pencarian instan, tombol copy satu klik, modal edit, dan form tambah akun.
   - **Pinned Top-Tier Server Codes:** Slot server code selalu di posisi atas prioritas utama.
   - **Two-Way Real-time Sync:** Semua perubahan pada dashboard otomatis tersinkronisasi instan ke in-page drawer dan side panel.

2. **Unified In-Page Drawer Access:**
   - Pada halaman web biasa (`http`, `https`, `file`), ekstensi dapat dibuka melalui:
     - **Klik icon ekstensi di toolbar browser**
     - **Tekan shortcut keyboard `Alt + L` (atau `Alt + N`)**
     - **Klik icon floating di pojok kanan bawah layar**
   - Menampilkan drawer slide-out dari sisi kanan layar.
   - Terisolasi 100% menggunakan **Shadow DOM**, tidak terpengaruh CSS website dan tidak merusak layout halaman.
   - Dilengkapi tombol navigasi **Dashboard** di header drawer untuk membuka Dashboard Chrome tab dalam 1 klik.

3. **Restricted Page Smart Fallback:**
   - Jika pengguna berada di halaman internal browser (`chrome://newtab`, `chrome://extensions`, `chrome://settings`, dll.) di mana content script dibatasi oleh sistem keamanan Chrome, mengklik icon ekstensi atau menekan shortcut `Alt + L` akan otomatis membuka atau memfokuskan tab **Chrome Dashboard**.

4. **Chrome Native Side Panel:**
   - Mendukung Chrome Side Panel (`side_panel`) bawaan browser untuk akses kredensial berdampingan dengan tab web apa pun tanpa menutupi konten halaman.

5. **Top Priority Tier: Server Codes (Beda Kasta):**
   - Slot khusus di bagian **paling atas** untuk paste code server / endpoint / URL / host port.
   - Terpisah secara kasta & protokol dari Email & Password (selalu di atas, tidak akan pernah berada di bawah Email & Password).
   - Tombol **Copy** instan dan tombol **Del** untuk setiap server code yang disimpan.

6. **Fast Copy Email & Password:**
   - Tombol **Copy** pada Email: Salin email ke clipboard dalam satu klik.
   - Tombol **Copy** pada Password: Salin password ke clipboard dalam satu klik.
   - Tombol **Show/Hide**: Menampilkan/menyembunyikan teks password.
   - Tombol **Edit** dan **Delete** eksplisit di tiap akun, serta **Clear All** di toolbar.
   - Feedback toast minimalis saat penyalinan berhasil.

7. **One-Click Autofill Form:**
   - Deteksi otomatis elemen input username/email dan password pada halaman web aktif.
   - Mengisi kredensial secara langsung dan memicu event `input`, `change`, dan `blur` sehingga kompatibel dengan React, Vue, Angular, Svelte, dan standard HTML forms.

8. **Web Tester Scratchpad:**
   - Area catatan fleksibel untuk menyimpan OTP sementara, Bearer Token, API response snippet, URL staging, atau skenario test.
   - Auto-save ke `chrome.storage.local` secara real-time.
   - Tombol satu klik **Copy All** dan **Clear**.

9. **Dummy Data Generators:**
   - Salin instan data dummy uji coba:
     - **Random Test Email** (`tester.<timestamp>@testmail.local`)
     - **Strong Password** (12 karakter kombinasi huruf besar, kecil, angka, simbol)
     - **Nomor HP Indonesia** (`0812xxxxxxxx`)
     - **NIK / KTP Dummy 16 Digit**
     - **Kartu Kredit Test Visa** (`4242 4242 4242 4242`)
     - **UUID v4**
     - **Lorem Ipsum Paragraph**

10. **Backup & Restore (JSON):**
    - Ekspor seluruh akun dan catatan ke file JSON untuk dibagikan ke tim QA.
    - Impor file backup JSON kapan saja.
    - Opsi reset ke data akun default.

---

## Struktur Direktori

```
tester-notepad/
├── manifest.json              # Manifest V3 (Newtab override, sidePanel, permissions)
├── background/
│   └── background.js          # Service worker, storage seeding, smart dashboard fallback
├── content/
│   ├── content.js             # Shadow DOM drawer, autofill, dashboard launcher
│   └── content.css            # Content host reset styling
├── dashboard/
│   ├── dashboard.html         # Chrome New Tab Dashboard Workspace
│   ├── dashboard.css          # Minimalist monochrome dashboard styling
│   └── dashboard.js           # Dashboard controller (clock, search, storage sync)
├── sidepanel/
│   ├── sidepanel.html         # Chrome native Side Panel
│   ├── sidepanel.css          # Compact side panel styling
│   └── sidepanel.js           # Side panel controller
├── popup/
│   ├── popup.html             # Toolbar action popup
│   ├── popup.css              # Popup styling (monokrom)
│   └── popup.js               # Quick forwarder script
├── icons/
│   ├── icon16.png
│   ├── icon32.png
│   ├── icon48.png
│   └── icon128.png
├── test/
│   └── test_page.html         # Interactive sandbox test portal
├── generate_icons.py          # Python monochrome icon generator
├── runapp.sh                  # Chrome runner (Linux/Ubuntu)
├── runapp.ps1                 # Chrome runner (Windows PowerShell)
├── test.sh                    # Automated test suite (Linux)
└── test.ps1                   # Automated test suite (PowerShell)
```

---

## Cara Menjalankan & Menguji

### 1. Jalankan Menggunakan Script Otomatis
Di Ubuntu / Linux:
```bash
cd /home/user/space/project/tools/ext/tester-notepad
./runapp.sh
```

Di Windows:
```powershell
cd space\project\tools\ext\tester-notepad
.\runapp.ps1
```

Script akan meluncurkan Google Chrome dengan profil pengembang sementara, membuka tab **Chrome Dashboard** dan portal uji coba **Test Sandbox**.

### 2. Memuat Manual di Google Chrome
1. Buka browser Google Chrome dan kunjungi `chrome://extensions/`.
2. Aktifkan **Developer mode** di pojok kanan atas.
3. Klik tombol **Load unpacked**.
4. Pilih folder:
   `/home/user/space/project/tools/ext/tester-notepad`
5. Buka Tab Baru (`Ctrl + T`) &rarr; **Dashboard Catatan Email & Tester Notepad** langsung muncul di halaman awal Chrome!

### 3. Menjalankan Integrity Test
```bash
./test.sh
```

---

## Shortcut Keyboard

| Shortcut | Deskripsi |
| :--- | :--- |
| **`Ctrl + T`** | Buka Tab Baru &rarr; Langsung menampilkan Chrome Dashboard Catatan Email |
| **`Alt + L`** (atau `Alt + N`) | Toggle Drawer pada halaman web aktif / Buka Dashboard jika di halaman sistem |
| **`/`** | Fokus instan ke Omnibox Search Bar pada Chrome Dashboard |
| **`Alt + A`** | Buka form tambah kredensial baru pada Dashboard |
| **`Esc`** | Menutup modal edit / reset filter pencarian / tutup drawer |
