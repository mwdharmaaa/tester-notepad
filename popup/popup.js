// Popup script - Clean Monochrome (Email & Password Only)
document.addEventListener("DOMContentLoaded", async () => {
  const container = document.getElementById("accounts-container");
  const searchInput = document.getElementById("popup-search");
  const toggleIcon = document.getElementById("toggle-floating-icon");
  const toggleDrawerBtn = document.getElementById("btn-toggle-page-drawer");
  const toast = document.getElementById("toast");

  let accounts = [];
  let settings = {};

  async function loadData() {
    const data = await chrome.storage.local.get(["accounts", "settings"]);
    accounts = data.accounts || [];
    settings = data.settings || { floatingIconEnabled: true };
    toggleIcon.checked = !!settings.floatingIconEnabled;
    render(accounts);
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

  function render(list) {
    if (list.length === 0) {
      container.innerHTML = `<div style="text-align:center; color:#71717a; padding:20px;">No credentials found.</div>`;
      return;
    }

    container.innerHTML = list
      .map(
        (acc) => `
      <div class="acc-card">
        <div class="row">
          <span class="val" title="${escapeHtml(acc.email)}">${escapeHtml(acc.email)}</span>
          <button class="btn-copy btn-copy-email" data-val="${escapeHtml(acc.email)}">Copy</button>
        </div>
        <div class="row">
          <span class="val">••••••••</span>
          <button class="btn-copy btn-copy-pass" data-val="${escapeHtml(acc.password)}">Copy</button>
        </div>
      </div>
    `
      )
      .join("");

    container.querySelectorAll(".btn-copy-email").forEach((b) => {
      b.addEventListener("click", () => copyText(b.dataset.val, "Email"));
    });

    container.querySelectorAll(".btn-copy-pass").forEach((b) => {
      b.addEventListener("click", () => copyText(b.dataset.val, "Password"));
    });
  }

  function escapeHtml(s) {
    return (s || "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  searchInput.addEventListener("input", (e) => {
    const q = e.target.value.toLowerCase();
    const filtered = accounts.filter(
      (a) => a.email.toLowerCase().includes(q)
    );
    render(filtered);
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
