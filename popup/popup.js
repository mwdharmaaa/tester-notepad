// Popup script - Clean Monochrome (Top-Tier Servers + Credentials)
document.addEventListener("DOMContentLoaded", async () => {
  const serverContainer = document.getElementById("popup-server-container");
  const serverInput = document.getElementById("popup-server-input");
  const addServerBtn = document.getElementById("popup-btn-add-server");

  const accountsContainer = document.getElementById("accounts-container");
  const searchInput = document.getElementById("popup-search");
  const toggleIcon = document.getElementById("toggle-floating-icon");
  const toggleDrawerBtn = document.getElementById("btn-toggle-page-drawer");
  const toast = document.getElementById("toast");

  let serverCodes = [];
  let accounts = [];
  let settings = {};

  async function loadData() {
    const data = await chrome.storage.local.get(["serverCodes", "accounts", "settings"]);
    serverCodes = data.serverCodes || [];
    accounts = data.accounts || [];
    settings = data.settings || { floatingIconEnabled: true };
    toggleIcon.checked = !!settings.floatingIconEnabled;
    renderServers(serverCodes);
    renderAccounts(accounts);
  }

  function showToast(msg) {
    toast.textContent = msg;
    toast.classList.add("show");
    setTimeout(() => toast.classList.remove("show"), 1400);
  }

  async function copyText(text, label) {
    try {
      await navigator.clipboard.writeText(text);
      showToast(`${label} copied`);
    } catch (e) {
      showToast("Copy failed");
    }
  }

  // Render Servers (Always Top Tier)
  function renderServers(list) {
    if (list.length === 0) {
      serverContainer.innerHTML = `<div style="color: #71717a; font-size: 10px; padding: 4px 2px;">No server codes.</div>`;
      return;
    }

    serverContainer.innerHTML = list
      .map(
        (srv) => `
      <div class="server-row">
        <span class="server-val" title="${escapeHtml(srv.code)}">${escapeHtml(srv.code)}</span>
        <div style="display: flex; gap: 4px;">
          <button class="btn-copy btn-copy-srv" data-val="${escapeHtml(srv.code)}">Copy</button>
          <button class="btn-copy btn-del-srv" data-id="${srv.id}" style="color: #a1a1aa;">Del</button>
        </div>
      </div>
    `
      )
      .join("");

    serverContainer.querySelectorAll(".btn-copy-srv").forEach((b) => {
      b.addEventListener("click", () => copyText(b.dataset.val, "Server code"));
    });

    serverContainer.querySelectorAll(".btn-del-srv").forEach((b) => {
      b.addEventListener("click", async () => {
        const id = b.dataset.id;
        serverCodes = serverCodes.filter((s) => s.id !== id);
        await chrome.storage.local.set({ serverCodes });
        showToast("Server deleted");
        renderServers(serverCodes);
      });
    });
  }

  // Render Accounts
  function renderAccounts(list) {
    if (list.length === 0) {
      accountsContainer.innerHTML = `<div style="text-align: center; color: #71717a; padding: 14px;">No credentials found.</div>`;
      return;
    }

    accountsContainer.innerHTML = list
      .map(
        (acc) => `
      <div class="acc-card">
        <div class="row">
          <span class="val" title="${escapeHtml(acc.email)}">${escapeHtml(acc.email)}</span>
          <div style="display: flex; gap: 4px;">
            <button class="btn-copy btn-copy-email" data-val="${escapeHtml(acc.email)}">Copy</button>
            <button class="btn-copy btn-del-acc" data-id="${acc.id}" style="color: #a1a1aa;">Del</button>
          </div>
        </div>
        <div class="row">
          <span class="val">••••••••</span>
          <button class="btn-copy btn-copy-pass" data-val="${escapeHtml(acc.password)}">Copy</button>
        </div>
      </div>
    `
      )
      .join("");

    accountsContainer.querySelectorAll(".btn-copy-email").forEach((b) => {
      b.addEventListener("click", () => copyText(b.dataset.val, "Email"));
    });

    accountsContainer.querySelectorAll(".btn-copy-pass").forEach((b) => {
      b.addEventListener("click", () => copyText(b.dataset.val, "Password"));
    });

    accountsContainer.querySelectorAll(".btn-del-acc").forEach((b) => {
      b.addEventListener("click", async () => {
        const id = b.dataset.id;
        accounts = accounts.filter((a) => a.id !== id);
        await chrome.storage.local.set({ accounts });
        showToast("Deleted");
        renderAccounts(accounts);
      });
    });
  }

  function escapeHtml(s) {
    return (s || "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  // Add Server Handler
  const handleAddServer = async () => {
    const code = serverInput.value.trim();
    if (!code) return;
    const newServer = { id: "srv_" + Date.now(), code };
    serverCodes.push(newServer);
    await chrome.storage.local.set({ serverCodes });
    serverInput.value = "";
    showToast("Server added");
    renderServers(serverCodes);
  };

  addServerBtn.addEventListener("click", handleAddServer);
  serverInput.addEventListener("keydown", (e) => {
    if (e.key === "Enter") {
      e.preventDefault();
      handleAddServer();
    }
  });

  searchInput.addEventListener("input", (e) => {
    const q = e.target.value.toLowerCase();
    const filtered = accounts.filter((a) => a.email.toLowerCase().includes(q));
    renderAccounts(filtered);
  });

  toggleIcon.addEventListener("change", async (e) => {
    settings.floatingIconEnabled = e.target.checked;
    await chrome.storage.local.set({ settings });
  });

  toggleDrawerBtn.addEventListener("click", async () => {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (tab?.id) {
      chrome.tabs.sendMessage(tab.id, { action: "TOGGLE_DRAWER" }).catch(() => {});
      window.close();
    }
  });

  await loadData();
});
