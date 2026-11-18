// Tester Notepad - Side Panel Controller
// Native right-side docking on Chrome Dashboard (New Tab) and web pages

(function () {
  "use strict";

  // State
  let serverCodes = [];
  let accounts = [];
  let scratchpad = "";
  let settings = {};
  let showPasswordMap = {};
  let currentFilter = "";

  // Elements
  const clockEl = document.getElementById("sp-clock");
  const btnClose = document.getElementById("sp-btn-close");
  const serverInput = document.getElementById("sp-server-input");
  const btnAddServer = document.getElementById("sp-btn-add-server");
  const serverList = document.getElementById("sp-server-list");
  const serverCount = document.getElementById("sp-server-count");

  const tabBtns = document.querySelectorAll(".sp-tab-btn");
  const tabPanels = document.querySelectorAll(".sp-tab-panel");

  const accountSearch = document.getElementById("sp-account-search");
  const btnOpenAddAccount = document.getElementById("sp-btn-open-add-account");
  const accountForm = document.getElementById("sp-account-form");
  const formTitle = document.getElementById("sp-form-title");
  const formId = document.getElementById("sp-form-account-id");
  const formEmail = document.getElementById("sp-form-email");
  const formPassword = document.getElementById("sp-form-password");
  const btnCancelAccount = document.getElementById("sp-btn-cancel-account");
  const btnSaveAccount = document.getElementById("sp-btn-save-account");
  const accountList = document.getElementById("sp-account-list");

  const scratchpadArea = document.getElementById("sp-scratchpad-textarea");
  const scratchpadInfo = document.getElementById("sp-scratchpad-info");
  const btnCopyScratchpad = document.getElementById("sp-btn-copy-scratchpad");
  const btnClearScratchpad = document.getElementById("sp-btn-clear-scratchpad");
  const scratchpadSync = document.getElementById("sp-scratchpad-sync");

  const toastEl = document.getElementById("sp-toast");
  let toastTimer = null;
  let scratchpadSaveTimer = null;

  // Initialize
  init();

  async function init() {
    initPortConnection();
    initClock();
    await loadData();
    bindEvents();
    renderAll();
  }

  // Connect port to background for state synchronization & toggle tracking
  function initPortConnection() {
    try {
      const port = chrome.runtime.connect({ name: "tester-notepad-sidepanel" });
      chrome.windows.getCurrent().then((win) => {
        if (win?.id) {
          port.postMessage({ type: "SIDEPANEL_MOUNTED", windowId: win.id });
        }
      }).catch(() => {});

      port.onMessage.addListener((msg) => {
        if (msg?.action === "CLOSE_PANEL") {
          window.close();
        }
      });
    } catch (e) {
      console.warn("[Tester Notepad SidePanel] Port connect error:", e);
    }
  }

  // Load storage data
  async function loadData() {
    try {
      const data = await chrome.storage.local.get(["serverCodes", "accounts", "scratchpad", "settings"]);
      serverCodes = Array.isArray(data.serverCodes) ? data.serverCodes : [];
      accounts = Array.isArray(data.accounts) ? data.accounts : [];
      scratchpad = typeof data.scratchpad === "string" ? data.scratchpad : "";
      settings = data.settings || {};
    } catch (e) {
      console.error("[Tester Notepad SidePanel] loadData error:", e);
    }
  }

  // Storage listener for live sync across popup, content script drawer, and side panel
  chrome.storage.onChanged.addListener((changes, area) => {
    if (area !== "local") return;
    if (changes.serverCodes) {
      serverCodes = Array.isArray(changes.serverCodes.newValue) ? changes.serverCodes.newValue : [];
      renderServers();
    }
    if (changes.accounts) {
      accounts = Array.isArray(changes.accounts.newValue) ? changes.accounts.newValue : [];
      renderAccounts();
    }
    if (changes.scratchpad) {
      const newPad = typeof changes.scratchpad.newValue === "string" ? changes.scratchpad.newValue : "";
      if (scratchpadArea && document.activeElement !== scratchpadArea) {
        scratchpad = newPad;
        scratchpadArea.value = newPad;
        updateScratchpadStats();
      }
    }
    if (changes.settings) {
      settings = changes.settings.newValue || {};
    }
  });

  // Digital Clock
  function initClock() {
    function update() {
      const now = new Date();
      const h = String(now.getHours()).padStart(2, "0");
      const m = String(now.getMinutes()).padStart(2, "0");
      const s = String(now.getSeconds()).padStart(2, "0");
      if (clockEl) clockEl.textContent = `${h}:${m}:${s}`;
    }
    update();
    setInterval(update, 1000);
  }

  // Toast Notification
  function showToast(msg) {
    if (!toastEl) return;
    toastEl.textContent = msg.toUpperCase();
    toastEl.classList.add("show");
    if (toastTimer) clearTimeout(toastTimer);
    toastTimer = setTimeout(() => {
      toastEl.classList.remove("show");
    }, 1800);
  }

  // Clipboard Copy helper
  async function copyText(text, label = "COPIED") {
    if (!text) return;
    try {
      await navigator.clipboard.writeText(text);
      showToast(label);
    } catch (err) {
      const input = document.createElement("textarea");
      input.value = text;
      document.body.appendChild(input);
      input.select();
      document.execCommand("copy");
      document.body.removeChild(input);
      showToast(label);
    }
  }

  // Save Helpers
  async function persistServers() {
    await chrome.storage.local.set({ serverCodes });
    renderServers();
  }

  async function persistAccounts() {
    await chrome.storage.local.set({ accounts });
    renderAccounts();
  }

  async function persistScratchpad(val) {
    scratchpad = val;
    await chrome.storage.local.set({ scratchpad: val });
    if (scratchpadSync) {
      scratchpadSync.textContent = "ALL CHANGES SAVED";
      setTimeout(() => {
        if (scratchpadSync) scratchpadSync.textContent = "ALL CHANGES AUTO-SAVED";
      }, 1500);
    }
  }

  // Rendering
  function renderAll() {
    renderServers();
    renderAccounts();
    renderScratchpad();
  }

  function renderServers() {
    if (!serverList || !serverCount) return;
    serverCount.textContent = `${serverCodes.length} ${serverCodes.length === 1 ? "SERVER" : "SERVERS"}`;
    serverList.innerHTML = "";

    if (serverCodes.length === 0) {
      const empty = document.createElement("div");
      empty.className = "sp-sync-status";
      empty.style.padding = "6px 0";
      empty.textContent = "No server codes registered.";
      serverList.appendChild(empty);
      return;
    }

    serverCodes.forEach((srv) => {
      const item = document.createElement("div");
      item.className = "sp-server-item";

      const codeSpan = document.createElement("div");
      codeSpan.className = "sp-server-code";
      codeSpan.textContent = srv.code;
      codeSpan.title = srv.code;

      const actions = document.createElement("div");
      actions.className = "sp-server-item-actions";

      const btnCopy = document.createElement("button");
      btnCopy.className = "sp-btn-action";
      btnCopy.textContent = "COPY";
      btnCopy.addEventListener("click", () => copyText(srv.code, "SERVER COPIED"));

      const btnDel = document.createElement("button");
      btnDel.className = "sp-btn-action";
      btnDel.textContent = "DEL";
      btnDel.addEventListener("click", async () => {
        serverCodes = serverCodes.filter((s) => s.id !== srv.id);
        await persistServers();
        showToast("SERVER DELETED");
      });

      actions.appendChild(btnCopy);
      actions.appendChild(btnDel);
      item.appendChild(codeSpan);
      item.appendChild(actions);
      serverList.appendChild(item);
    });
  }

  function renderAccounts() {
    if (!accountList) return;
    accountList.innerHTML = "";

    const filtered = accounts.filter((acc) => {
      if (!currentFilter) return true;
      const f = currentFilter.toLowerCase();
      return (acc.email && acc.email.toLowerCase().includes(f)) ||
             (acc.password && acc.password.toLowerCase().includes(f));
    });

    if (filtered.length === 0) {
      const empty = document.createElement("div");
      empty.className = "sp-sync-status";
      empty.style.padding = "16px 0";
      empty.style.textAlign = "center";
      empty.textContent = currentFilter ? "No matching accounts found." : "No credentials stored yet.";
      accountList.appendChild(empty);
      return;
    }

    filtered.forEach((acc) => {
      const card = document.createElement("div");
      card.className = "sp-account-card";

      // Email row
      const emailRow = document.createElement("div");
      emailRow.className = "sp-account-row";

      const emailLabel = document.createElement("span");
      emailLabel.className = "sp-account-label";
      emailLabel.textContent = "EMAIL";

      const emailVal = document.createElement("span");
      emailVal.className = "sp-account-val";
      emailVal.textContent = acc.email || "—";
      emailVal.title = acc.email;

      const btnCopyEmail = document.createElement("button");
      btnCopyEmail.className = "sp-btn-action";
      btnCopyEmail.textContent = "COPY EMAIL";
      btnCopyEmail.addEventListener("click", () => copyText(acc.email, "EMAIL COPIED"));

      emailRow.appendChild(emailLabel);
      emailRow.appendChild(emailVal);
      emailRow.appendChild(btnCopyEmail);

      // Password row
      const passRow = document.createElement("div");
      passRow.className = "sp-account-row";

      const passLabel = document.createElement("span");
      passLabel.className = "sp-account-label";
      passLabel.textContent = "PASS";

      const passVal = document.createElement("span");
      passVal.className = "sp-account-val";
      const isShown = showPasswordMap[acc.id] || false;
      passVal.textContent = isShown ? (acc.password || "—") : "••••••••••••";
      passVal.title = isShown ? acc.password : "Masked Password";

      const btnCopyPass = document.createElement("button");
      btnCopyPass.className = "sp-btn-action";
      btnCopyPass.textContent = "COPY PASS";
      btnCopyPass.addEventListener("click", () => copyText(acc.password, "PASSWORD COPIED"));

      passRow.appendChild(passLabel);
      passRow.appendChild(passVal);
      passRow.appendChild(btnCopyPass);

      // Bottom Row: Show/Hide, Edit, Del
      const bottomRow = document.createElement("div");
      bottomRow.className = "sp-account-card-bottom";

      const leftActions = document.createElement("div");
      leftActions.className = "sp-account-card-left-actions";

      const btnToggleShow = document.createElement("button");
      btnToggleShow.className = "sp-btn-action";
      btnToggleShow.textContent = isShown ? "HIDE" : "SHOW";
      btnToggleShow.addEventListener("click", () => {
        showPasswordMap[acc.id] = !isShown;
        renderAccounts();
      });
      leftActions.appendChild(btnToggleShow);

      const rightActions = document.createElement("div");
      rightActions.className = "sp-account-card-right-actions";

      const btnEdit = document.createElement("button");
      btnEdit.className = "sp-btn-action";
      btnEdit.textContent = "EDIT";
      btnEdit.addEventListener("click", () => {
        openEditForm(acc);
      });

      const btnDel = document.createElement("button");
      btnDel.className = "sp-btn-action";
      btnDel.textContent = "DEL";
      btnDel.addEventListener("click", async () => {
        accounts = accounts.filter((a) => a.id !== acc.id);
        await persistAccounts();
        showToast("CREDENTIAL DELETED");
      });

      rightActions.appendChild(btnEdit);
      rightActions.appendChild(btnDel);

      bottomRow.appendChild(leftActions);
      bottomRow.appendChild(rightActions);

      card.appendChild(emailRow);
      card.appendChild(passRow);
      card.appendChild(bottomRow);

      accountList.appendChild(card);
    });
  }

  function openEditForm(acc) {
    if (!accountForm) return;
    accountForm.style.display = "flex";
    if (formTitle) formTitle.textContent = acc ? "EDIT CREDENTIAL" : "NEW CREDENTIAL";
    if (formId) formId.value = acc ? acc.id : "";
    if (formEmail) formEmail.value = acc ? acc.email : "";
    if (formPassword) formPassword.value = acc ? acc.password : "";
    if (formEmail) formEmail.focus();
  }

  function closeForm() {
    if (!accountForm) return;
    accountForm.style.display = "none";
    if (formId) formId.value = "";
    if (formEmail) formEmail.value = "";
    if (formPassword) formPassword.value = "";
  }

  function renderScratchpad() {
    if (!scratchpadArea) return;
    scratchpadArea.value = scratchpad;
    updateScratchpadStats();
  }

  function updateScratchpadStats() {
    if (!scratchpadArea || !scratchpadInfo) return;
    const val = scratchpadArea.value || "";
    const chars = val.length;
    const lines = val ? val.split("\n").length : 0;
    scratchpadInfo.textContent = `${chars} CHARS • ${lines} LINES`;
  }

  // Dummy Generators Logic
  function generateNIK() {
    const provinces = ["31", "32", "33", "34", "35", "36", "12", "13", "51", "73"];
    const prov = provinces[Math.floor(Math.random() * provinces.length)];
    const city = String(Math.floor(Math.random() * 70) + 1).padStart(2, "0");
    const dist = String(Math.floor(Math.random() * 40) + 1).padStart(2, "0");
    const day = String(Math.floor(Math.random() * 28) + 1).padStart(2, "0");
    const month = String(Math.floor(Math.random() * 12) + 1).padStart(2, "0");
    const year = String(Math.floor(Math.random() * 30) + 70); // 70-99
    const seq = String(Math.floor(Math.random() * 900) + 1).padStart(4, "0");
    return `${prov}${city}${dist}${day}${month}${year}${seq}`;
  }

  function generateCC() {
    let num = "424242";
    for (let i = 0; i < 9; i++) num += Math.floor(Math.random() * 10);
    // Luhn checksum
    let sum = 0;
    for (let i = 0; i < 15; i++) {
      let digit = parseInt(num[i], 10);
      if (i % 2 === 0) {
        digit *= 2;
        if (digit > 9) digit -= 9;
      }
      sum += digit;
    }
    const check = (10 - (sum % 10)) % 10;
    num += check;
    const formatted = num.match(/.{1,4}/g).join(" ");
    return `${formatted} (12/28, CVV: 123)`;
  }

  function generatePhone() {
    const prefixes = ["0812", "0813", "0821", "0852", "0857", "0878", "0896"];
    const p = prefixes[Math.floor(Math.random() * prefixes.length)];
    const s = String(Math.floor(Math.random() * 90000000) + 10000000);
    return `+62${p.substring(1)}${s.substring(0, 7)}`;
  }

  function generateUUID() {
    return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, function (c) {
      const r = (Math.random() * 16) | 0;
      const v = c === "x" ? r : (r & 0x3) | 0x8;
      return v.toString(16);
    });
  }

  // Event Handlers
  function bindEvents() {
    // Close Panel button
    if (btnClose) {
      btnClose.addEventListener("click", () => window.close());
    }

    // Keyboard shortcut inside sidepanel: Alt+L closes the panel
    window.addEventListener("keydown", (e) => {
      if (e.altKey && (e.code === "KeyL" || e.keyCode === 76 || e.key.toLowerCase() === "l")) {
        e.preventDefault();
        e.stopPropagation();
        window.close();
      }
    }, true);

    // Add Server
    async function handleAddServer() {
      const code = serverInput?.value?.trim();
      if (!code) return;
      const newSrv = {
        id: `srv_${Date.now()}_${Math.random().toString(36).substr(2, 4)}`,
        code
      };
      serverCodes.push(newSrv);
      serverInput.value = "";
      await persistServers();
      showToast("SERVER ADDED");
    }

    if (btnAddServer) btnAddServer.addEventListener("click", handleAddServer);
    if (serverInput) {
      serverInput.addEventListener("keydown", (e) => {
        if (e.key === "Enter") handleAddServer();
      });
    }

    // Tab switching
    tabBtns.forEach((btn) => {
      btn.addEventListener("click", () => {
        const target = btn.getAttribute("data-tab");
        tabBtns.forEach((b) => b.classList.remove("active"));
        tabPanels.forEach((p) => p.classList.remove("active"));
        btn.classList.add("active");
        const panel = document.getElementById(`tab-${target}`);
        if (panel) panel.classList.add("active");
      });
    });

    // Account Search
    if (accountSearch) {
      accountSearch.addEventListener("input", (e) => {
        currentFilter = e.target.value.trim();
        renderAccounts();
      });
    }

    // Account Form Open / Cancel / Save
    if (btnOpenAddAccount) {
      btnOpenAddAccount.addEventListener("click", () => openEditForm(null));
    }
    if (btnCancelAccount) {
      btnCancelAccount.addEventListener("click", closeForm);
    }
    if (btnSaveAccount) {
      btnSaveAccount.addEventListener("click", async () => {
        const id = formId?.value?.trim();
        const email = formEmail?.value?.trim() || "";
        const password = formPassword?.value?.trim() || "";

        if (!email && !password) {
          showToast("EMPTY CREDENTIAL");
          return;
        }

        if (id) {
          // Edit existing
          accounts = accounts.map((a) => (a.id === id ? { ...a, email, password } : a));
          showToast("CREDENTIAL UPDATED");
        } else {
          // Add new
          const newAcc = {
            id: `acc_${Date.now()}_${Math.random().toString(36).substr(2, 4)}`,
            email,
            password
          };
          accounts.push(newAcc);
          showToast("CREDENTIAL ADDED");
        }
        await persistAccounts();
        closeForm();
      });
    }

    // Scratchpad auto-save
    if (scratchpadArea) {
      scratchpadArea.addEventListener("input", (e) => {
        updateScratchpadStats();
        if (scratchpadSync) scratchpadSync.textContent = "SAVING...";
        if (scratchpadSaveTimer) clearTimeout(scratchpadSaveTimer);
        scratchpadSaveTimer = setTimeout(() => {
          persistScratchpad(e.target.value);
        }, 400);
      });
    }

    if (btnCopyScratchpad) {
      btnCopyScratchpad.addEventListener("click", () => {
        const text = scratchpadArea?.value || "";
        copyText(text, "SCRATCHPAD COPIED");
      });
    }

    if (btnClearScratchpad) {
      btnClearScratchpad.addEventListener("click", async () => {
        if (!confirm("Clear all scratchpad text?")) return;
        if (scratchpadArea) scratchpadArea.value = "";
        await persistScratchpad("");
        updateScratchpadStats();
        showToast("SCRATCHPAD CLEARED");
      });
    }

    // Dummy Data Generators
    const nikBtn = document.getElementById("sp-gen-nik-btn");
    const nikVal = document.getElementById("sp-gen-nik-val");
    if (nikBtn && nikVal) {
      nikBtn.addEventListener("click", () => {
        const val = generateNIK();
        nikVal.textContent = val;
        copyText(val, "NIK COPIED");
      });
    }

    const ccBtn = document.getElementById("sp-gen-cc-btn");
    const ccVal = document.getElementById("sp-gen-cc-val");
    if (ccBtn && ccVal) {
      ccBtn.addEventListener("click", () => {
        const val = generateCC();
        ccVal.textContent = val;
        copyText(val, "CARD COPIED");
      });
    }

    const phoneBtn = document.getElementById("sp-gen-phone-btn");
    const phoneVal = document.getElementById("sp-gen-phone-val");
    if (phoneBtn && phoneVal) {
      phoneBtn.addEventListener("click", () => {
        const val = generatePhone();
        phoneVal.textContent = val;
        copyText(val, "PHONE COPIED");
      });
    }

    const uuidBtn = document.getElementById("sp-gen-uuid-btn");
    const uuidVal = document.getElementById("sp-gen-uuid-val");
    if (uuidBtn && uuidVal) {
      uuidBtn.addEventListener("click", () => {
        const val = generateUUID();
        uuidVal.textContent = val;
        copyText(val, "UUID COPIED");
      });
    }

    const tsBtn = document.getElementById("sp-gen-ts-btn");
    const tsVal = document.getElementById("sp-gen-ts-val");
    if (tsBtn && tsVal) {
      tsBtn.addEventListener("click", () => {
        const now = new Date();
        const val = `${now.toISOString()} (${Math.floor(now.getTime() / 1000)})`;
        tsVal.textContent = val;
        copyText(val, "TIMESTAMP COPIED");
      });
    }
  }
})();
