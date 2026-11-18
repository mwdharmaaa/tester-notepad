/**
 * Tester Notepad - Side Panel Controller
 * Handles tabs, storage synchronization, quick-copy, server codes, and scratchpad
 */

document.addEventListener("DOMContentLoaded", async () => {
  const STORAGE_KEY_SERVERS = "serverCodes";
  const STORAGE_KEY_ACCOUNTS = "accounts";
  const STORAGE_KEY_SCRATCHPAD = "scratchpad";

  let serverCodes = [];
  let accounts = [];
  let scratchpad = "";
  let showPasswords = {};
  let currentTab = "credentials";
  let searchFilter = "";

  // DOM elements
  const btnOpenDash = document.getElementById("sp-btn-open-dash");
  const serverInput = document.getElementById("sp-server-input");
  const btnAddServer = document.getElementById("sp-btn-add-server");
  const serverList = document.getElementById("sp-server-list");

  const tabs = document.querySelectorAll(".sp-tab");
  const tabContents = document.querySelectorAll(".sp-tab-content");

  const credSearch = document.getElementById("sp-cred-search");
  const btnAddCred = document.getElementById("sp-btn-add-cred");
  const addForm = document.getElementById("sp-add-form");
  const newEmailInput = document.getElementById("sp-new-email");
  const newPassInput = document.getElementById("sp-new-pass");
  const btnGenPass = document.getElementById("sp-btn-gen-pass");
  const btnSaveCred = document.getElementById("sp-btn-save-cred");
  const btnCancelCred = document.getElementById("sp-btn-cancel-cred");
  const credList = document.getElementById("sp-cred-list");

  const scratchpadInput = document.getElementById("sp-scratchpad-input");
  const btnCopyScratch = document.getElementById("sp-btn-copy-scratch");
  const btnClearScratch = document.getElementById("sp-btn-clear-scratch");
  const toastEl = document.getElementById("sp-toast");

  // Open Full Dashboard
  if (btnOpenDash) {
    btnOpenDash.addEventListener("click", () => {
      const url = chrome.runtime.getURL("dashboard/dashboard.html");
      chrome.tabs.create({ url });
    });
  }

  // Toast
  function showToast(msg) {
    if (!toastEl) return;
    toastEl.textContent = msg;
    toastEl.style.display = "block";
    setTimeout(() => {
      toastEl.style.display = "none";
    }, 1800);
  }

  // Copy helper
  async function copyText(text, label = "Item") {
    try {
      if (navigator.clipboard && navigator.clipboard.writeText) {
        await navigator.clipboard.writeText(text);
      } else {
        const t = document.createElement("textarea");
        t.value = text;
        document.body.appendChild(t);
        t.select();
        document.execCommand("copy");
        t.remove();
      }
      showToast(`${label} copied!`);
    } catch (e) {
      showToast("Copy failed");
    }
  }

  // Load Data
  async function loadData() {
    const data = await chrome.storage.local.get([
      STORAGE_KEY_SERVERS,
      STORAGE_KEY_ACCOUNTS,
      STORAGE_KEY_SCRATCHPAD
    ]);

    if (Array.isArray(data.serverCodes)) serverCodes = data.serverCodes;
    if (Array.isArray(data.accounts)) {
      accounts = data.accounts.map((a) => ({
        id: a.id || "acc_" + Math.random().toString(36).substring(2, 6),
        email: a.email || a.label || "",
        password: a.password || ""
      }));
    }
    if (typeof data.scratchpad === "string") scratchpad = data.scratchpad;

    renderServers();
    renderAccounts();
    if (scratchpadInput) scratchpadInput.value = scratchpad;
  }

  // Real-time Storage Sync
  chrome.storage.onChanged.addListener((changes, area) => {
    if (area === "local") {
      if (changes.serverCodes) {
        serverCodes = changes.serverCodes.newValue || [];
        renderServers();
      }
      if (changes.accounts) {
        accounts = (changes.accounts.newValue || []).map((a) => ({
          id: a.id || "acc_" + Math.random().toString(36).substring(2, 6),
          email: a.email || a.label || "",
          password: a.password || ""
        }));
        renderAccounts();
      }
      if (changes.scratchpad && scratchpadInput !== document.activeElement) {
        scratchpad = changes.scratchpad.newValue || "";
        if (scratchpadInput) scratchpadInput.value = scratchpad;
      }
    }
  });

  // Render Servers
  function renderServers() {
    if (!serverList) return;
    if (serverCodes.length === 0) {
      serverList.innerHTML = `<div style="text-align: center; color: #71717a; padding: 6px 0;">No server codes.</div>`;
      return;
    }
    serverList.innerHTML = serverCodes
      .map(
        (s) => `
      <div class="sp-server-item">
        <span class="sp-server-code" title="${escapeHtml(s.code)}">${escapeHtml(s.code)}</span>
        <div style="display: flex; gap: 4px;">
          <button class="sp-btn-mini btn-copy-srv" data-val="${escapeHtml(s.code)}">COPY</button>
          <button class="sp-btn-mini btn-del-srv" data-id="${escapeHtml(s.id)}" style="color: #ef4444;">DEL</button>
        </div>
      </div>
    `
      )
      .join("");

    serverList.querySelectorAll(".btn-copy-srv").forEach((b) => {
      b.addEventListener("click", () => copyText(b.dataset.val, "Server code"));
    });
    serverList.querySelectorAll(".btn-del-srv").forEach((b) => {
      b.addEventListener("click", async () => {
        serverCodes = serverCodes.filter((s) => s.id !== b.dataset.id);
        await chrome.storage.local.set({ [STORAGE_KEY_SERVERS]: serverCodes });
        showToast("Server deleted");
      });
    });
  }

  // Add Server
  if (btnAddServer && serverInput) {
    const handleAddServer = async () => {
      const code = serverInput.value.trim();
      if (!code) return;
      serverCodes.push({ id: "srv_" + Date.now().toString(36), code });
      await chrome.storage.local.set({ [STORAGE_KEY_SERVERS]: serverCodes });
      serverInput.value = "";
      showToast("Server added");
    };
    btnAddServer.addEventListener("click", handleAddServer);
    serverInput.addEventListener("keydown", (e) => {
      if (e.key === "Enter") handleAddServer();
    });
  }

  // Tabs
  tabs.forEach((tab) => {
    tab.addEventListener("click", () => {
      tabs.forEach((t) => t.classList.remove("active"));
      tabContents.forEach((c) => c.classList.remove("active"));
      tab.classList.add("active");
      const target = document.getElementById("tab-" + tab.dataset.tab);
      if (target) target.classList.add("active");
    });
  });

  // Render Accounts
  function renderAccounts() {
    if (!credList) return;
    const query = searchFilter.trim().toLowerCase();
    const filtered = query
      ? accounts.filter((a) => a.email.toLowerCase().includes(query))
      : accounts;

    if (filtered.length === 0) {
      credList.innerHTML = `<div style="text-align: center; color: #71717a; padding: 16px 0;">No credentials found.</div>`;
      return;
    }

    credList.innerHTML = filtered
      .map((acc) => {
        const isVisible = !!showPasswords[acc.id];
        return `
        <div class="sp-cred-card">
          <div class="sp-cred-row">
            <span class="sp-cred-val" title="${escapeHtml(acc.email)}">${escapeHtml(acc.email)}</span>
            <div style="display: flex; gap: 4px;">
              <button class="sp-btn-mini btn-copy-email" data-val="${escapeHtml(acc.email)}">COPY</button>
              <button class="sp-btn-mini btn-del-cred" data-id="${escapeHtml(acc.id)}" style="color: #ef4444;">DEL</button>
            </div>
          </div>
          <div class="sp-cred-row">
            <span class="sp-cred-val">${isVisible ? escapeHtml(acc.password) : "••••••••••••"}</span>
            <div style="display: flex; gap: 4px;">
              <button class="sp-btn-mini btn-toggle-pass" data-id="${escapeHtml(acc.id)}">${isVisible ? "HIDE" : "SHOW"}</button>
              <button class="sp-btn-mini btn-copy-pass" data-val="${escapeHtml(acc.password)}">COPY</button>
            </div>
          </div>
        </div>
      `;
      })
      .join("");

    credList.querySelectorAll(".btn-copy-email").forEach((b) => {
      b.addEventListener("click", () => copyText(b.dataset.val, "Email"));
    });
    credList.querySelectorAll(".btn-copy-pass").forEach((b) => {
      b.addEventListener("click", () => copyText(b.dataset.val, "Password"));
    });
    credList.querySelectorAll(".btn-toggle-pass").forEach((b) => {
      b.addEventListener("click", () => {
        const id = b.dataset.id;
        showPasswords[id] = !showPasswords[id];
        renderAccounts();
      });
    });
    credList.querySelectorAll(".btn-del-cred").forEach((b) => {
      b.addEventListener("click", async () => {
        accounts = accounts.filter((a) => a.id !== b.dataset.id);
        await chrome.storage.local.set({ [STORAGE_KEY_ACCOUNTS]: accounts });
        showToast("Credential deleted");
      });
    });
  }

  // Filter
  if (credSearch) {
    credSearch.addEventListener("input", (e) => {
      searchFilter = e.target.value;
      renderAccounts();
    });
  }

  // Add Credential Form
  if (btnAddCred) {
    btnAddCred.addEventListener("click", () => {
      addForm.style.display = addForm.style.display === "none" ? "flex" : "none";
      if (addForm.style.display === "flex") newEmailInput.focus();
    });
  }

  if (btnCancelCred) {
    btnCancelCred.addEventListener("click", () => {
      addForm.style.display = "none";
      newEmailInput.value = "";
      newPassInput.value = "";
    });
  }

  if (btnGenPass) {
    btnGenPass.addEventListener("click", () => {
      newPassInput.value = generatePassword();
      showToast("Password generated");
    });
  }

  if (btnSaveCred) {
    btnSaveCred.addEventListener("click", async () => {
      const email = newEmailInput.value.trim();
      const password = newPassInput.value;
      if (!email) {
        showToast("Email is required");
        return;
      }
      accounts.unshift({
        id: "acc_" + Date.now().toString(36),
        email,
        password
      });
      await chrome.storage.local.set({ [STORAGE_KEY_ACCOUNTS]: accounts });
      addForm.style.display = "none";
      newEmailInput.value = "";
      newPassInput.value = "";
      showToast("Credential saved");
    });
  }

  // Scratchpad
  let scratchDebounce = null;
  if (scratchpadInput) {
    scratchpadInput.addEventListener("input", () => {
      clearTimeout(scratchDebounce);
      scratchDebounce = setTimeout(async () => {
        scratchpad = scratchpadInput.value;
        await chrome.storage.local.set({ [STORAGE_KEY_SCRATCHPAD]: scratchpad });
      }, 350);
    });
  }

  if (btnCopyScratch) {
    btnCopyScratch.addEventListener("click", () => {
      if (scratchpadInput.value) copyText(scratchpadInput.value, "Scratchpad");
    });
  }

  if (btnClearScratch) {
    btnClearScratch.addEventListener("click", async () => {
      if (scratchpadInput.value && confirm("Clear scratchpad?")) {
        scratchpadInput.value = "";
        scratchpad = "";
        await chrome.storage.local.set({ [STORAGE_KEY_SCRATCHPAD]: scratchpad });
        showToast("Scratchpad cleared");
      }
    });
  }

  // Dummy Generators
  function generatePassword() {
    const u = "ABCDEFGHJKLMNPQRSTUVWXYZ";
    const l = "abcdefghijkmnopqrstuvwxyz";
    const d = "23456789";
    const s = "!@#$%^&*_-+=";
    let p = u[Math.floor(Math.random() * u.length)] + l[Math.floor(Math.random() * l.length)] + d[Math.floor(Math.random() * d.length)] + s[Math.floor(Math.random() * s.length)];
    const all = u + l + d + s;
    for (let i = 0; i < 8; i++) p += all[Math.floor(Math.random() * all.length)];
    return p.split("").sort(() => 0.5 - Math.random()).join("");
  }

  const DummyGens = {
    email: () => `tester.${Date.now().toString(36)}.${Math.random().toString(36).substring(2, 5)}@testmail.local`,
    password: generatePassword,
    phone: () => "0812" + Math.floor(10000000 + Math.random() * 90000000),
    nik: () => "317101" + Math.floor(1000000000 + Math.random() * 9000000000),
    card: () => "4242424242424242",
    uuid: () => "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
      const r = (Math.random() * 16) | 0;
      return (c === "x" ? r : (r & 0x3) | 0x8).toString(16);
    }),
    lorem: () => "Lorem ipsum dolor sit amet, consectetur adipiscing elit."
  };

  document.querySelectorAll(".sp-gen-btn").forEach((btn) => {
    btn.addEventListener("click", () => {
      const fn = DummyGens[btn.dataset.gen];
      if (fn) copyText(fn(), btn.querySelector("b")?.textContent || "Generated");
    });
  });

  function escapeHtml(s) {
    if (!s) return "";
    return String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
  }

  await loadData();
});
