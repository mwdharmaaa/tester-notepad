# Tester Notepad - Web QA Credential & Scratchpad Drawer

> **Browser Extension Manifest V3** yang dirancang khusus untuk Web Tester / QA Engineer untuk menyimpan, menyalin kredensial (Email & Password), autofill form login, dan mencatat data pengujian sementara secara instan.

---

## 🚀 Fitur Utama

1. **Floating Trigger Icon (Pojok Kanan Bawah):**
   - Icon melayang yang elegan di pojok kanan bawah layar.
   - Dilengkapi badge penghitung akun kredensial yang tersimpan.
   - Klik icon untuk membuka/menutup drawer notepad di sisi kanan layar.
   - Shortcut keyboard: Tekan **`Alt + L`** (atau `Alt + N`) untuk toggle drawer secara instan.

2. **Slide-Out Right Drawer (Notepad Kanan Layar):**
   - Panel meluncur halus dari sisi kanan layar (`transform: translateX`).
   - Terisolasi 100% menggunakan **Shadow DOM**, sehingga styling extension tidak terpengaruh oleh CSS website tujuan (Bootstrap, Tailwind, reset CSS) dan tidak merusak layout halaman yang sedang di-test.
   - Dilengkapi tombol **Pin 📌** (agar drawer tetap terbuka saat mengetik di form) dan tombol **Close ✕**.

3. **Fast Copy Email & Password:**
   - Tombol **📋 Copy** pada Email: Salin email ke clipboard dalam satu klik.
   - Tombol **🔑 Copy** pada Password: Salin password ke clipboard dalam satu klik.
   - Toggle **👁️ / 🙈 Show/Hide Password**: Menampilkan/menyembunyikan teks password.
   - Visual feedback toast (*"Copied!"*) saat penyalinan berhasil.

4. **🪄 One-Click Autofill Form:**
   - Deteksi otomatis elemen input username/email dan password pada halaman web aktif.
   - Mengisi kredensial secara langsung dan memicu event `input`, `change`, dan `blur` sehingga kompatibel dengan React, Vue, Angular, Svelte, dan standard HTML forms.

5. **📝 Web Tester Scratchpad:**
   - Area catatan fleksibel untuk menyimpan OTP sementara, Bearer Token, API response snippet, URL staging, atau skenario test.
   - Auto-save ke `chrome.storage.local` secara real-time.
   - Tombol satu klik **Copy All Notes** dan **Clear Scratchpad**.

6. **⚡ Dummy Data Generators:**
   - Salin instan data dummy uji coba:
     - 📧 **Random Test Email** (`tester.<timestamp>@testmail.local`)
     - 🔐 **Strong Password** (12 karakter kombinasi huruf besar, kecil, angka, simbol)
     - 📱 **Nomor HP Indonesia** (`0812xxxxxxxx`)
     - 🆔 **NIK / KTP Dummy 16 Digit**
     - 💳 **Kartu Kredit Test Visa** (`4242 4242 4242 4242`)
     - 🔢 **UUID v4**
     - 📄 **Lorem Ipsum Paragraph**

7. **💾 Backup & Restore (JSON):**
   - Ekspor seluruh akun dan catatan ke file JSON untuk dibagikan ke tim QA.
   - Impor file backup JSON kapan saja.
   - Opsi reset ke data akun default.

---

## 📁 Struktur Direktori

```
tester-notepad/
├── manifest.json              # Manifest V3 configuration
├── background/
│   └── background.js          # Service worker, storage seeding, shortcuts
├── content/
│   ├── content.js             # Shadow DOM drawer, clipboard copy, autofill
│   └── content.css            # Content host reset styling
├── popup/
│   ├── popup.html             # Toolbar action popup
│   ├── popup.css              # Popup styling
│   └── popup.js               # Quick copy toolbar script
├── icons/
│   ├── icon16.png
│   ├── icon32.png
│   ├── icon48.png
│   └── icon128.png
├── test/
│   └── test_page.html         # Interactive sandbox test portal
├── generate_icons.py          # Python icon generator
├── runapp.sh                  # Chrome runner (Linux/Ubuntu)
├── runapp.ps1                 # Chrome runner (Windows PowerShell)
├── test.sh                    # Automated test suite (Linux)
└── test.ps1                   # Automated test suite (PowerShell)
```

---

## 🛠️ Cara Menjalankan & Menguji

### 1. Jalankan Menggunakan Script Otomatis
Di Ubuntu / Linux:
```bash
cd /home/user/space/project/tools/ext/tester-notepad
./runapp.sh
```
Script di atas akan mendeteksi Google Chrome, membuat profil dev terisolasi di `/tmp`, memuat unpacked extension, dan langsung membuka `test/test_page.html`.

Di Windows:
```powershell
cd space\project\tools\ext\tester-notepad
.\runapp.ps1
```

### 2. Memuat Manual di Google Chrome
1. Buka browser Google Chrome dan kunjungi `chrome://extensions/`.
2. Aktifkan **Developer mode** di pojok kanan atas.
3. Klik tombol **Load unpacked**.
4. Pilih folder:
   `/home/user/space/project/tools/ext/tester-notepad`
5. Buka sembarang website atau file `test/test_page.html` untuk langsung menggunakannya.

### 3. Menjalankan Integrity Test
```bash
./test.sh
```

---

## ⌨️ Shortcut Keyboard

| Shortcut | Deskripsi |
| :--- | :--- |
| **`Alt + L`** (atau `Alt + N`) | Toggle Tester Notepad Drawer (Buka / Tutup panel) |
| **`Esc`** | Menutup panel drawer (jika tidak di-pin) |
