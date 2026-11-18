# Tester Notepad - Web QA Credential & Scratchpad Floating Drawer

> **Browser Extension Manifest V3** dengan desain ultra-minimalis monokrom (hitam, putih, abu-abu) tanpa emoji, dirancang khusus untuk Web Tester / QA Engineer. Ekstensi ini berupa **floating in-page drawer** non-blocking di sisi kanan layar untuk menyimpan, menyalin kredensial (Email & Password), autofill form login, serta mencatat data pengujian sementara secara instan — **tanpa membuka tab baru, dan halaman web tetap dapat diklik/dioperasikan secara bebas saat drawer aktif**.

---

## Fitur Utama

1. **Pure Floating In-Page Drawer (Tanpa Tab Baru):**
   - Tidak membuka tab baru atau merubah halaman apa pun.
   - Cukup tekan **`Alt + L`** (atau `Alt + N`), klik icon toolbar ekstensi, atau klik icon floating di pojok kanan bawah: drawer langsung meluncur keluar dari kanan layar di halaman web aktif!
   - Tekan **`Alt + L`** lagi atau klik tombol Close (**`X`**) di header untuk menutupnya.

2. **Non-Blocking Interaction (Bisa Klik & Ketik di Web Tanpa Menutup Drawer):**
   - Tidak ada backdrop gelap yang menghalangi halaman web.
   - Saat drawer aktif terbuka di sebelah kanan layar, pengguna **tetap bisa bebas mengklik tombol, memilih input form, mengetik username/password, scroll halaman, dan submit login di website tanpa menutup ekstensi**!
   - Drawer tetap tenang berada di sisi kanan siap digunakan untuk menyalin data kapan saja.

3. **Top Priority Tier: Server Codes (Beda Kasta):**
   - Slot khusus di bagian **paling atas** untuk paste code server / endpoint / URL / host port.
   - Terpisah secara kasta & protokol dari Email & Password (selalu di atas, tidak akan pernah berada di bawah Email & Password).
   - Tombol **Copy** instan dan tombol **Del** untuk setiap server code yang disimpan.

4. **Fast Copy Email & Password:**
   - Tombol **Copy** pada Email: Salin email ke clipboard dalam satu klik.
   - Tombol **Copy** pada Password: Salin password ke clipboard dalam satu klik.
   - Tombol **Show/Hide**: Menampilkan/menyembunyikan teks password.
   - Tombol **Edit** dan **Delete** eksplisit di tiap akun, serta **Clear All** di toolbar.
   - Feedback toast minimalis saat penyalinan berhasil.

5. **One-Click Autofill Form:**
   - Deteksi otomatis elemen input username/email dan password pada halaman web aktif.
   - Mengisi kredensial secara langsung dan memicu event `input`, `change`, dan `blur` sehingga kompatibel dengan React, Vue, Angular, Svelte, dan standard HTML forms.

6. **Web Tester Scratchpad:**
   - Area catatan fleksibel untuk menyimpan OTP sementara, Bearer Token, API response snippet, URL staging, atau skenario test.
   - Auto-save ke `chrome.storage.local` secara real-time.
   - Tombol satu klik **Copy All** dan **Clear**.

7. **Dummy Data Generators:**
   - Salin instan data dummy uji coba:
     - **Random Test Email** (`tester.<timestamp>@testmail.local`)
     - **Strong Password** (12 karakter kombinasi huruf besar, kecil, angka, simbol)
     - **Nomor HP Indonesia** (`0812xxxxxxxx`)
     - **NIK / KTP Dummy 16 Digit**
     - **Kartu Kredit Test Visa** (`4242 4242 4242 4242`)
     - **UUID v4**
     - **Lorem Ipsum Paragraph**

8. **Backup & Restore (JSON):**
   - Ekspor seluruh akun dan catatan ke file JSON untuk dibagikan ke tim QA.
   - Impor file backup JSON kapan saja.
   - Opsi reset ke data akun default.

---

## Struktur Direktori

```
tester-notepad/
├── manifest.json              # Manifest V3 (action, content_scripts, commands, permissions)
├── background/
│   └── background.js          # Service worker, storage seeding, commands dispatcher
├── content/
│   ├── content.js             # Shadow DOM floating drawer, non-blocking click-through
│   └── content.css            # Content host reset styling
├── popup/
│   ├── popup.html             # Toolbar action forwarder
│   ├── popup.css              # Popup styling
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

### 2. Memuat Manual di Google Chrome
1. Buka browser Google Chrome dan kunjungi `chrome://extensions/`.
2. Aktifkan **Developer mode** di pojok kanan atas.
3. Klik tombol **Load unpacked** (atau icon **Reload** jika sudah dimuat).
4. Pilih folder:
   `/home/user/space/project/tools/ext/tester-notepad`
5. Buka website apa saja (misalnya portal login Anda atau `test/test_page.html`), lalu tekan **`Alt + L`**!
   Drawer akan langsung meluncur di sebelah kanan tanpa membuka tab baru, dan Anda tetap bebas mengklik elemen website di sebelah kiri!

---

## Shortcut Keyboard

| Shortcut | Deskripsi |
| :--- | :--- |
| **`Alt + L`** (atau `Alt + N`) | Toggle Drawer (Buka / Tutup panel floating di kanan) |
| **`Esc`** | Menutup panel drawer (jika tidak di-pin) |
