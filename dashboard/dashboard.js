/**
 * Chrome Dashboard Script - Tester Notepad
 * Handles clock, search navigation, top-tier server codes, email credentials,
 * scratchpad autosave, dummy generators, backup/restore, and storage sync.
 */

document.addEventListener("DOMContentLoaded", async () => {
  // Storage Keys
  const STORAGE_KEY_SERVERS = "serverCodes";
  const STORAGE_KEY_ACCOUNTS = "accounts";
  const STORAGE_KEY_SCRATCHPAD = "scratchpad";
  const STORAGE_KEY_SETTINGS = "settings";

  // State
  let serverCodes = [];
  let accounts = [];
  let scratchpad = "";
  let settings = {
    theme: "dark",
    floatingIconEnabled: true,
    keepOpenOnCopy: true,
    autofillNotification: true
  };
  let showPasswords = {}; // accountId -> boolean
  let searchQuery = "";
  let scratchpadDebounceTimer = null;

  // DOM Elements
  const liveTimeEl = document.getElementById("dash-live-time");
  const liveDateEl = document.getElementById("dash-live-date");
  const searchForm = document.getElementById("dash-search-form");
  const searchInput = document.getElementById("dash-search-input");
  const themeToggleBtn = document.getElementById("btn-theme-toggle");
  const themeLabel = document.getElementById("theme-label");

  // Server Codes DOM
  const serverInput = document.getElementById("dash-server-input");
  const addServerBtn = document.getElementById("btn-add-server");
  const serverList = document.getElementById("dash-server-list");
  const serverCountBadge = document.getElementById("server-count-badge");

  // Accounts DOM
  const accountsContainer = document.getElementById("dash-accounts-container");
  const accountCountBadge = document.getElementById("account-count-badge");
  const accountSearchInput = document.getElementById("dash-account-search");
  const clearFilterBtn = document.getElementById("btn-clear-filter");
  const showAddAccountBtn = document.getElementById("btn-show-add-account");
  const addAccountPanel = document.getElementById("add-account-panel");
  const newAccEmail = document.getElementById("new-acc-email");
  const newAccPass = document.getElementById("new-acc-pass");
  const btnGenPassForAdd = document.getElementById("btn-gen-pass-for-add");
  const btnSaveNewAccount = document.getElementById("btn-save-new-account");
  const btnCancelAddAccount = document.getElementById("btn-cancel-add-account");
  const btnClearAllAccounts = document.getElementById("btn-clear-all-accounts");

  // Scratchpad DOM
  const scratchpadInput = document.getElementById("dash-scratchpad-input");
  const scratchpadStat = document.getElementById("scratchpad-stat");
  const scratchpadStatus = document.getElementById("scratchpad-status");
  const btnCopyScratchpad = document.getElementById("btn-copy-scratchpad");
  const btnClearScratchpad = document.getElementById("btn-clear-scratchpad");

  // Edit Modal DOM
  const editModalBackdrop = document.getElementById("edit-modal-backdrop");
  const editAccId = document.getElementById("edit-acc-id");
  const editAccEmail = document.getElementById("edit-acc-email");
  const editAccPass = document.getElementById("edit-acc-pass");
  const btnGenPassForEdit = document.getElementById("btn-gen-pass-for-edit");
  const btnSaveEditAccount = document.getElementById("btn-save-edit-account");
  const btnCancelEditAccount = document.getElementById("btn-cancel-edit-account");
  const btnCloseEditModal = document.getElementById("btn-close-edit-modal");

  // Header Action Buttons
  const btnOpenSandbox = document.getElementById("btn-open-sandbox");
  const chipOpenSandbox = document.getElementById("chip-open-sandbox");
  const chipChromeExt = document.getElementById("chip-chrome-ext");
  const btnExportBackup = document.getElementById("btn-export-backup");
  const inputImportBackup = document.getElementById("input-import-backup");
  const btnResetDemo = document.getElementById("btn-reset-demo");
  const toastContainer = document.getElementById("toast-container");

  // ========================================================
  // CLOCK & DATE
  // ========================================================
  function updateClock() {
    const now = new Date();
    const hours = String(now.getHours()).padStart(2, "0");
    const minutes = String(now.getMinutes()).padStart(2, "0");
    const seconds = String(now.getSeconds()).padStart(2, "0");
    if (liveTimeEl) {
      liveTimeEl.textContent = `${hours}:${minutes}:${seconds}`;
    }

    if (liveDateEl) {
      const options = { weekday: "long", year: "numeric", month: "long", day: "numeric" };
      liveDateEl.textContent = now.toLocaleDateString(undefined, options);
    }
  }
  setInterval(updateClock, 1000);
  updateClock();

  // ========================================================
  // OMNIBOX SEARCH NAVIGATION
  // ========================================================
  if (searchForm) {
    searchForm.addEventListener("submit", (e) => {
      e.preventDefault();
      const query = (searchInput.value || "").trim();
      if (!query) return;

      // Direct URL check
      const isHttp = /^https?:\/\//i.test(query);
      const isLocalhost = /^localhost(:\d+)?/i.test(query) || /^127\.0\.0\.1(:\d+)?/.test(query);
      const isDomain = !query.includes(" ") && query.includes(".") && !query.startsWith(".");

      if (isHttp) {
        window.location.href = query;
      } else if (isLocalhost) {
        window.location.href = "http://" + query;
      } else if (isDomain) {
        window.location.href = "https://" + query;
      } else {
        // Search via Google
        window.location.href = "https://www.google.com/search?q=" + encodeURIComponent(query);
      }
    });
  }

  // Quick chips
  if (chipChromeExt) {
    chipChromeExt.addEventListener("click", (e) => {
      e.preventDefault();
      if (chrome.tabs && chrome.tabs.create) {
        chrome.tabs.create({ url: "chrome://extensions" });
      } else {
        window.location.href = "chrome://extensions";
      }
    });
  }

  const handleOpenSandbox = () => {
    const url = chrome.runtime.getURL("test/test_page.html");
    if (chrome.tabs && chrome.tabs.create) {
      chrome.tabs.create({ url });
    } else {
      window.open(url, "_blank");
    }
  };

  if (btnOpenSandbox) btnOpenSandbox.addEventListener("click", handleOpenSandbox);
  if (chipOpenSandbox) chipOpenSandbox.addEventListener("click", handleOpenSandbox);

  // ========================================================
  // CLIPBOARD & TOAST SYSTEM
  // ========================================================
  async function copyText(text, label = "Item") {
    try {
      if (navigator.clipboard && navigator.clipboard.writeText) {
        await navigator.clipboard.writeText(text);
      } else {
        const t = document.createElement("textarea");
        t.value = text;
        t.style.position = "fixed";
        t.style.opacity = "0";
        document.body.appendChild(t);
        t.select();
        document.execCommand("copy");
        t.remove();
      }
      showToast(`${label} copied to clipboard`, "success");
      return true;
    } catch (err) {
      showToast("Copy failed", "error");
      return false;
    }
  }

  function showToast(message, type = "info") {
    if (!toastContainer) return;
    const toast = document.createElement("div");
    toast.className = `dash-toast dash-toast-${type}`;
    toast.innerHTML = `<span class="dash-toast-badge">${escapeHtml(type)}</span><span>${escapeHtml(message)}</span>`;
    toastContainer.appendChild(toast);

    setTimeout(() => {
      toast.classList.add("dash-toast-hide");
      setTimeout(() => toast.remove(), 200);
    }, 2200);
  }

  function escapeHtml(str) {
    if (!str) return "";
    return String(str)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");
  }

  // ========================================================
  // STORAGE LOAD & SYNC
  // ========================================================
  async function loadData() {
    try {
      const data = await chrome.storage.local.get([
        STORAGE_KEY_SERVERS,
        STORAGE_KEY_ACCOUNTS,
        STORAGE_KEY_SCRATCHPAD,
        STORAGE_KEY_SETTINGS
      ]);

      if (Array.isArray(data.serverCodes)) {
        serverCodes = data.serverCodes;
      }
      if (Array.isArray(data.accounts)) {
        accounts = data.accounts.map((a) => ({
          id: a.id || "acc_" + Math.random().toString(36).substring(2, 7),
          email: a.email || a.label || "",
          password: a.password || ""
        }));
      }
      if (typeof data.scratchpad === "string") {
        scratchpad = data.scratchpad;
      }
      if (data.settings) {
        settings = Object.assign(settings, data.settings);
      }

      applyTheme();
      renderServers();
      renderAccounts();
      renderScratchpad();
    } catch (e) {
      console.warn("[Dashboard] Load error:", e);
    }
  }

  // Real-time synchronization
  chrome.storage.onChanged.addListener((changes, area) => {
    if (area === "local") {
      let shouldRenderServers = false;
      let shouldRenderAccounts = false;

      if (changes.serverCodes) {
        serverCodes = changes.serverCodes.newValue || [];
        shouldRenderServers = true;
      }
      if (changes.accounts) {
        const raw = changes.accounts.newValue || [];
        accounts = raw.map((a) => ({
          id: a.id || "acc_" + Math.random().toString(36).substring(2, 7),
          email: a.email || a.label || "",
          password: a.password || ""
        }));
        shouldRenderAccounts = true;
      }
      if (changes.scratchpad) {
        const newVal = changes.scratchpad.newValue || "";
        if (scratchpadInput && scratchpadInput !== document.activeElement) {
          scratchpad = newVal;
          scratchpadInput.value = scratchpad;
          updateScratchpadStats();
        }
      }
      if (changes.settings) {
        settings = Object.assign(settings, changes.settings.newValue || {});
        applyTheme();
      }

      if (shouldRenderServers) renderServers();
      if (shouldRenderAccounts) renderAccounts();
    }
  });

  // ========================================================
  // THEME MANAGEMENT
  // ========================================================
  function applyTheme() {
    if (settings.theme === "light") {
      document.body.classList.remove("theme-dark");
      document.body.classList.add("theme-light");
      if (themeLabel) themeLabel.textContent = "DARK";
    } else {
      document.body.classList.remove("theme-light");
      document.body.classList.add("theme-dark");
      if (themeLabel) themeLabel.textContent = "LIGHT";
    }
  }

  if (themeToggleBtn) {
    themeToggleBtn.addEventListener("click", async () => {
      settings.theme = settings.theme === "dark" ? "light" : "dark";
      await chrome.storage.local.set({ [STORAGE_KEY_SETTINGS]: settings });
      applyTheme();
      showToast(`Switched to ${settings.theme.toUpperCase()} mode`, "info");
    });
  }

  // ========================================================
  // TOP-TIER SERVER CODES (BEDA KASTA)
  // ========================================================
  function renderServers() {
    if (serverCountBadge) {
      serverCountBadge.textContent = `${serverCodes.length} SERVER${serverCodes.length === 1 ? "" : "S"}`;
    }

    if (!serverList) return;

    if (serverCodes.length === 0) {
      serverList.innerHTML = `<div style="text-align: center; color: var(--text-muted); font-size: 11px; padding: 12px 0;">No server codes pinned yet. Add one above.</div>`;
      return;
    }

    serverList.innerHTML = serverCodes
      .map(
        (srv) => `
        <div class="server-item" data-id="${escapeHtml(srv.id)}">
          <span class="server-code-text" title="${escapeHtml(srv.code)}">${escapeHtml(srv.code)}</span>
          <div class="server-item-actions">
            <button class="btn-mini btn-copy-server" data-code="${escapeHtml(srv.code)}">COPY</button>
            <button class="btn-mini btn-mini-danger btn-del-server" data-id="${escapeHtml(srv.id)}">DEL</button>
          </div>
        </div>
      `
      )
      .join("");

    serverList.querySelectorAll(".btn-copy-server").forEach((btn) => {
      btn.addEventListener("click", () => {
        copyText(btn.dataset.code, "Server code");
      });
    });

    serverList.querySelectorAll(".btn-del-server").forEach((btn) => {
      btn.addEventListener("click", async () => {
        const id = btn.dataset.id;
        serverCodes = serverCodes.filter((s) => s.id !== id);
        await chrome.storage.local.set({ [STORAGE_KEY_SERVERS]: serverCodes });
        showToast("Server deleted", "info");
        renderServers();
      });
    });
  }

  async function handleAddServer() {
    if (!serverInput) return;
    const code = serverInput.value.trim();
    if (!code) {
      showToast("Please enter a server code or host", "warning");
      return;
    }

    const newServer = {
      id: "srv_" + Date.now().toString(36),
      code
    };

    serverCodes.push(newServer);
    await chrome.storage.local.set({ [STORAGE_KEY_SERVERS]: serverCodes });
    serverInput.value = "";
    showToast("Server code added to Top Tier", "success");
    renderServers();
  }

  if (addServerBtn) addServerBtn.addEventListener("click", handleAddServer);
  if (serverInput) {
    serverInput.addEventListener("keydown", (e) => {
      if (e.key === "Enter") {
        e.preventDefault();
        handleAddServer();
      }
    });
  }

  // ========================================================
  // CREDENTIALS / CATATAN EMAIL
  // ========================================================
  function renderAccounts() {
    const query = searchQuery.trim().toLowerCase();
    const filtered = query
      ? accounts.filter((a) => a.email.toLowerCase().includes(query))
      : accounts;

    if (accountCountBadge) {
      accountCountBadge.textContent = `${filtered.length} OF ${accounts.length} ACCOUNT${accounts.length === 1 ? "" : "S"}`;
    }

    if (!accountsContainer) return;

    if (filtered.length === 0) {
      if (accounts.length === 0) {
        accountsContainer.innerHTML = `<div style="text-align: center; color: var(--text-muted); font-size: 12px; padding: 24px 0;">No email credentials saved yet. Click "+ ADD EMAIL" to add your first.</div>`;
      } else {
        accountsContainer.innerHTML = `<div style="text-align: center; color: var(--text-muted); font-size: 12px; padding: 24px 0;">No matching credentials found for "${escapeHtml(searchQuery)}".</div>`;
      }
      return;
    }

    accountsContainer.innerHTML = filtered
      .map((acc) => {
        const isPassVisible = !!showPasswords[acc.id];
        const passDisplay = isPassVisible
          ? escapeHtml(acc.password)
          : `<span class="card-pass-masked">••••••••••••</span>`;

        return `
          <div class="account-card" data-id="${escapeHtml(acc.id)}">
            <!-- Email Row -->
            <div class="card-field-row">
              <span class="card-field-val" title="${escapeHtml(acc.email)}">${escapeHtml(acc.email)}</span>
              <div class="card-field-controls">
                <button class="btn-mini btn-copy-email" data-email="${escapeHtml(acc.email)}">COPY EMAIL</button>
              </div>
            </div>

            <!-- Password Row -->
            <div class="card-field-row">
              <span class="card-field-val">${passDisplay}</span>
              <div class="card-field-controls">
                <button class="btn-mini btn-toggle-pass" data-id="${escapeHtml(acc.id)}">
                  ${isPassVisible ? "HIDE" : "SHOW"}
                </button>
                <button class="btn-mini btn-copy-pass" data-pass="${escapeHtml(acc.password)}">COPY PASS</button>
              </div>
            </div>

            <!-- Bottom Actions -->
            <div class="card-bottom-actions">
              <button class="btn-mini btn-edit-acc" data-id="${escapeHtml(acc.id)}">EDIT</button>
              <button class="btn-mini btn-mini-danger btn-del-acc" data-id="${escapeHtml(acc.id)}">DEL</button>
            </div>
          </div>
        `;
      })
      .join("");

    // Wire Card Events
    accountsContainer.querySelectorAll(".btn-copy-email").forEach((b) => {
      b.addEventListener("click", () => copyText(b.dataset.email, "Email"));
    });

    accountsContainer.querySelectorAll(".btn-copy-pass").forEach((b) => {
      b.addEventListener("click", () => copyText(b.dataset.pass, "Password"));
    });

    accountsContainer.querySelectorAll(".btn-toggle-pass").forEach((b) => {
      b.addEventListener("click", () => {
        const id = b.dataset.id;
        showPasswords[id] = !showPasswords[id];
        renderAccounts();
      });
    });

    accountsContainer.querySelectorAll(".btn-edit-acc").forEach((b) => {
      b.addEventListener("click", () => openEditModal(b.dataset.id));
    });

    accountsContainer.querySelectorAll(".btn-del-acc").forEach((b) => {
      b.addEventListener("click", async () => {
        const id = b.dataset.id;
        accounts = accounts.filter((a) => a.id !== id);
        await chrome.storage.local.set({ [STORAGE_KEY_ACCOUNTS]: accounts });
        showToast("Credential deleted", "info");
        renderAccounts();
      });
    });
  }

  // Search Filter
  if (accountSearchInput) {
    accountSearchInput.addEventListener("input", (e) => {
      searchQuery = e.target.value;
      if (clearFilterBtn) {
        clearFilterBtn.style.display = searchQuery ? "block" : "none";
      }
      renderAccounts();
    });
  }

  if (clearFilterBtn) {
    clearFilterBtn.addEventListener("click", () => {
      searchQuery = "";
      if (accountSearchInput) accountSearchInput.value = "";
      clearFilterBtn.style.display = "none";
      renderAccounts();
    });
  }

  // Show/Hide Add Account Panel
  if (showAddAccountBtn) {
    showAddAccountBtn.addEventListener("click", () => {
      if (addAccountPanel.style.display === "none") {
        addAccountPanel.style.display = "flex";
        newAccEmail.focus();
      } else {
        addAccountPanel.style.display = "none";
      }
    });
  }

  if (btnCancelAddAccount) {
    btnCancelAddAccount.addEventListener("click", () => {
      addAccountPanel.style.display = "none";
      newAccEmail.value = "";
      newAccPass.value = "";
    });
  }

  if (btnGenPassForAdd) {
    btnGenPassForAdd.addEventListener("click", () => {
      newAccPass.value = generateStrongPassword();
      showToast("Strong password generated", "info");
    });
  }

  if (btnSaveNewAccount) {
    btnSaveNewAccount.addEventListener("click", async () => {
      const email = newAccEmail.value.trim();
      const password = newAccPass.value;

      if (!email) {
        showToast("Email address is required", "warning");
        newAccEmail.focus();
        return;
      }

      const newAccount = {
        id: "acc_" + Date.now().toString(36) + Math.random().toString(36).substring(2, 5),
        email,
        password
      };

      accounts.unshift(newAccount);
      await chrome.storage.local.set({ [STORAGE_KEY_ACCOUNTS]: accounts });

      newAccEmail.value = "";
      newAccPass.value = "";
      addAccountPanel.style.display = "none";
      showToast("Email credential added", "success");
      renderAccounts();
    });
  }

  // Clear All Accounts
  if (btnClearAllAccounts) {
    btnClearAllAccounts.addEventListener("click", async () => {
      if (accounts.length === 0) return;
      if (confirm(`Are you sure you want to delete ALL ${accounts.length} credential accounts?`)) {
        accounts = [];
        await chrome.storage.local.set({ [STORAGE_KEY_ACCOUNTS]: accounts });
        showToast("All credentials cleared", "info");
        renderAccounts();
      }
    });
  }

  // ========================================================
  // EDIT ACCOUNT MODAL
  // ========================================================
  function openEditModal(id) {
    const acc = accounts.find((a) => a.id === id);
    if (!acc) return;

    editAccId.value = acc.id;
    editAccEmail.value = acc.email;
    editAccPass.value = acc.password;
    editModalBackdrop.style.display = "flex";
    editAccEmail.focus();
  }

  function closeEditModal() {
    editModalBackdrop.style.display = "none";
    editAccId.value = "";
    editAccEmail.value = "";
    editAccPass.value = "";
  }

  if (btnCancelEditAccount) btnCancelEditAccount.addEventListener("click", closeEditModal);
  if (btnCloseEditModal) btnCloseEditModal.addEventListener("click", closeEditModal);

  if (btnGenPassForEdit) {
    btnGenPassForEdit.addEventListener("click", () => {
      editAccPass.value = generateStrongPassword();
      showToast("Strong password generated", "info");
    });
  }

  if (btnSaveEditAccount) {
    btnSaveEditAccount.addEventListener("click", async () => {
      const id = editAccId.value;
      const email = editAccEmail.value.trim();
      const password = editAccPass.value;

      if (!email) {
        showToast("Email address cannot be empty", "warning");
        editAccEmail.focus();
        return;
      }

      const index = accounts.findIndex((a) => a.id === id);
      if (index !== -1) {
        accounts[index].email = email;
        accounts[index].password = password;
        await chrome.storage.local.set({ [STORAGE_KEY_ACCOUNTS]: accounts });
        showToast("Credential updated", "success");
        closeEditModal();
        renderAccounts();
      }
    });
  }

  // ========================================================
  // SCRATCHPAD
  // ========================================================
  function renderScratchpad() {
    if (scratchpadInput) {
      scratchpadInput.value = scratchpad;
      updateScratchpadStats();
    }
  }

  function updateScratchpadStats() {
    if (!scratchpadInput || !scratchpadStat) return;
    const text = scratchpadInput.value;
    const chars = text.length;
    const lines = text ? text.split("\n").length : 0;
    scratchpadStat.textContent = `${chars} chars • ${lines} lines`;
  }

  if (scratchpadInput) {
    scratchpadInput.addEventListener("input", () => {
      updateScratchpadStats();
      if (scratchpadStatus) scratchpadStatus.textContent = "SAVING...";

      clearTimeout(scratchpadDebounceTimer);
      scratchpadDebounceTimer = setTimeout(async () => {
        scratchpad = scratchpadInput.value;
        await chrome.storage.local.set({ [STORAGE_KEY_SCRATCHPAD]: scratchpad });
        if (scratchpadStatus) scratchpadStatus.textContent = "SYNCED";
      }, 350);
    });
  }

  if (btnCopyScratchpad) {
    btnCopyScratchpad.addEventListener("click", () => {
      if (!scratchpadInput.value) {
        showToast("Scratchpad is empty", "warning");
        return;
      }
      copyText(scratchpadInput.value, "Scratchpad content");
    });
  }

  if (btnClearScratchpad) {
    btnClearScratchpad.addEventListener("click", async () => {
      if (!scratchpadInput.value) return;
      if (confirm("Clear all scratchpad text?")) {
        scratchpadInput.value = "";
        scratchpad = "";
        await chrome.storage.local.set({ [STORAGE_KEY_SCRATCHPAD]: scratchpad });
        updateScratchpadStats();
        showToast("Scratchpad cleared", "info");
      }
    });
  }

  // ========================================================
  // DUMMY GENERATORS
  // ========================================================
  function generateStrongPassword() {
    const uppers = "ABCDEFGHJKLMNPQRSTUVWXYZ";
    const lowers = "abcdefghijkmnopqrstuvwxyz";
    const digits = "23456789";
    const symbols = "!@#$%^&*_-+=";
    let pass = "";
    pass += uppers[Math.floor(Math.random() * uppers.length)];
    pass += lowers[Math.floor(Math.random() * lowers.length)];
    pass += digits[Math.floor(Math.random() * digits.length)];
    pass += symbols[Math.floor(Math.random() * symbols.length)];
    const all = uppers + lowers + digits + symbols;
    for (let i = 0; i < 8; i++) {
      pass += all[Math.floor(Math.random() * all.length)];
    }
    return pass.split("").sort(() => 0.5 - Math.random()).join("");
  }

  const DummyGenerators = {
    email: () => {
      const stamp = Date.now().toString(36);
      const rand = Math.random().toString(36).substring(2, 6);
      return `tester.${stamp}.${rand}@testmail.local`;
    },
    password: generateStrongPassword,
    phone: () => {
      const prefixes = ["0812", "0813", "0821", "0852", "0878", "0896"];
      const prefix = prefixes[Math.floor(Math.random() * prefixes.length)];
      let num = prefix;
      for (let i = 0; i < 8; i++) {
        num += Math.floor(Math.random() * 10);
      }
      return num;
    },
    nik: () => {
      const day = String(Math.floor(Math.random() * 28) + 1).padStart(2, "0");
      const month = String(Math.floor(Math.random() * 12) + 1).padStart(2, "0");
      const year = String(Math.floor(Math.random() * 40) + 70).padStart(2, "0");
      const seq = String(Math.floor(Math.random() * 999) + 1).padStart(4, "0");
      return `317101${day}${month}${year}${seq}`;
    },
    card: () => "4242424242424242",
    uuid: () => {
      return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, function (c) {
        const r = (Math.random() * 16) | 0;
        const v = c === "x" ? r : (r & 0x3) | 0x8;
        return v.toString(16);
      });
    },
    lorem: () =>
      "Lorem ipsum dolor sit amet, consectetur adipiscing elit. Sed do eiusmod tempor incididunt ut labore et dolore magna aliqua."
  };

  document.querySelectorAll(".generator-btn").forEach((btn) => {
    btn.addEventListener("click", () => {
      const type = btn.dataset.gen;
      const fn = DummyGenerators[type];
      if (fn) {
        const val = fn();
        copyText(val, btn.querySelector(".gen-name")?.textContent || "Generated data");
      }
    });
  });

  // ========================================================
  // BACKUP / EXPORT / IMPORT / RESET
  // ========================================================
  if (btnExportBackup) {
    btnExportBackup.addEventListener("click", () => {
      const payload = {
        version: "1.1.0",
        exportedAt: new Date().toISOString(),
        serverCodes,
        accounts,
        scratchpad,
        settings
      };

      const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(payload, null, 2));
      const a = document.createElement("a");
      a.setAttribute("href", dataStr);
      a.setAttribute("download", `tester-notepad-backup-${Date.now()}.json`);
      document.body.appendChild(a);
      a.click();
      a.remove();
      showToast("Backup exported", "success");
    });
  }

  if (inputImportBackup) {
    inputImportBackup.addEventListener("change", (e) => {
      const file = e.target.files?.[0];
      if (!file) return;

      const reader = new FileReader();
      reader.onload = async (evt) => {
        try {
          const imported = JSON.parse(evt.target.result);
          if (Array.isArray(imported.serverCodes)) {
            serverCodes = imported.serverCodes;
            await chrome.storage.local.set({ [STORAGE_KEY_SERVERS]: serverCodes });
          }
          if (Array.isArray(imported.accounts)) {
            accounts = imported.accounts.map((a) => ({
              id: a.id || "acc_" + Math.random().toString(36).substring(2, 7),
              email: a.email || a.label || "",
              password: a.password || ""
            }));
            await chrome.storage.local.set({ [STORAGE_KEY_ACCOUNTS]: accounts });
          }
          if (typeof imported.scratchpad === "string") {
            scratchpad = imported.scratchpad;
            await chrome.storage.local.set({ [STORAGE_KEY_SCRATCHPAD]: scratchpad });
          }
          if (imported.settings) {
            settings = Object.assign(settings, imported.settings);
            await chrome.storage.local.set({ [STORAGE_KEY_SETTINGS]: settings });
          }

          showToast("Backup imported successfully", "success");
          applyTheme();
          renderServers();
          renderAccounts();
          renderScratchpad();
        } catch (err) {
          showToast("Invalid JSON file", "error");
        }
      };
      reader.readAsText(file);
      inputImportBackup.value = "";
    });
  }

  if (btnResetDemo) {
    btnResetDemo.addEventListener("click", async () => {
      if (confirm("Reset to default demo data? This will overwrite your current test accounts.")) {
        const DEFAULT_SERVERS = [
          {
            id: "srv_1",
            code: "https://staging-api.tester.local:8443"
          }
        ];
        const DEFAULT_ACCOUNTS = [
          {
            id: "acc_1",
            email: "admin@tester.local",
            password: "AdminPass2026!"
          },
          {
            id: "acc_2",
            email: "user@testmail.com",
            password: "UserPass@1234"
          },
          {
            id: "acc_3",
            email: "qa@staging.test",
            password: "QAPassword99!"
          }
        ];
        serverCodes = DEFAULT_SERVERS;
        accounts = DEFAULT_ACCOUNTS;
        await chrome.storage.local.set({
          [STORAGE_KEY_SERVERS]: serverCodes,
          [STORAGE_KEY_ACCOUNTS]: accounts
        });
        showToast("Reset to default data", "info");
        renderServers();
        renderAccounts();
      }
    });
  }

  // ========================================================
  // KEYBOARD SHORTCUTS
  // ========================================================
  window.addEventListener("keydown", (e) => {
    // Focus search on '/'
    if (e.key === "/" && document.activeElement !== searchInput && document.activeElement !== scratchpadInput) {
      if (document.activeElement?.tagName !== "INPUT" && document.activeElement?.tagName !== "TEXTAREA") {
        e.preventDefault();
        if (searchInput) searchInput.focus();
      }
    }

    // Alt + A: Open Add Form
    if (e.altKey && (e.key === "a" || e.key === "A")) {
      e.preventDefault();
      if (addAccountPanel) {
        addAccountPanel.style.display = "flex";
        newAccEmail.focus();
      }
    }

    // Escape: Close modals
    if (e.key === "Escape") {
      if (editModalBackdrop && editModalBackdrop.style.display === "flex") {
        closeEditModal();
      } else if (addAccountPanel && addAccountPanel.style.display === "flex") {
        addAccountPanel.style.display = "none";
      } else if (searchQuery) {
        searchQuery = "";
        if (accountSearchInput) accountSearchInput.value = "";
        if (clearFilterBtn) clearFilterBtn.style.display = "none";
        renderAccounts();
      }
    }
  });

  // Initialize
  await loadData();
});
