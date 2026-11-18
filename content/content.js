/**
 * Tester Notepad - Content Script
 * Strictly Monochrome Minimalist UI (Black, White, Grays) - Zero Emojis
 * Pinned Top-Tier Server Codes Slot ("Beda Kasta") + Email & Password Cards
 * Encapsulated via Shadow DOM for 100% style isolation.
 */

(function () {
  // Prevent duplicate injection
  if (document.getElementById("tester-notepad-root")) return;

  const ROOT_ID = "tester-notepad-root";
  const STORAGE_KEY_SERVERS = "serverCodes";
  const STORAGE_KEY_ACCOUNTS = "accounts";
  const STORAGE_KEY_SCRATCHPAD = "scratchpad";
  const STORAGE_KEY_SETTINGS = "settings";

  // State
  let serverCodes = [];
  let accounts = [];
  let scratchpad = "";
  let settings = {
    floatingIconEnabled: true,
    theme: "dark",
    keepOpenOnCopy: true,
    autofillNotification: true
  };

  let isDrawerOpen = false;
  let isPinned = false;
  let activeTab = "credentials"; // "credentials", "scratchpad", "generators", "settings"
  let searchQuery = "";
  let editingAccountId = null;
  let showAddForm = false;
  let showPasswords = {}; // accountId -> boolean

  // Create Root & Shadow
  const rootEl = document.createElement("div");
  rootEl.id = ROOT_ID;
  document.documentElement.appendChild(rootEl);
  const shadow = rootEl.attachShadow({ mode: "open" });

  // Minimalist Line SVG Icons
  const Icons = {
    doc: `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline><line x1="16" y1="13" x2="8" y2="13"></line><line x1="16" y1="17" x2="8" y2="17"></line><polyline points="10 9 9 9 8 9"></polyline></svg>`,
    close: `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>`,
    pin: `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="12" y1="17" x2="12" y2="22"></line><path d="M5 17h14v-1.76a2 2 0 0 0-1.11-1.79l-1.78-.9A2 2 0 0 1 15 10.76V6h1a1 1 0 0 0 0-2H8a1 1 0 0 0 0 2h1v4.76a2 2 0 0 1-1.11 1.79l-1.78.9A2 2 0 0 0 5 15.24Z"></path></svg>`,
    search: `<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="8"></circle><line x1="21" y1="21" x2="16.65" y2="16.65"></line></svg>`,
    edit: `<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path></svg>`,
    trash: `<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg>`,
    dashboard: `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="7" height="7"></rect><rect x="14" y="3" width="7" height="7"></rect><rect x="14" y="14" width="7" height="7"></rect><rect x="3" y="14" width="7" height="7"></rect></svg>`
  };

  // Load Initial Storage
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
          id: a.id,
          email: a.email || a.label || "",
          password: a.password || ""
        }));
      }
      if (typeof data.scratchpad === "string") scratchpad = data.scratchpad;
      if (data.settings) settings = Object.assign(settings, data.settings);
    } catch (e) {
      console.warn("[Tester Notepad] Storage load error:", e);
    }
  }

  // Save Storage
  async function saveServers(newServers) {
    serverCodes = newServers;
    await chrome.storage.local.set({ [STORAGE_KEY_SERVERS]: serverCodes });
    render();
  }

  async function saveAccounts(newAccounts) {
    accounts = newAccounts;
    await chrome.storage.local.set({ [STORAGE_KEY_ACCOUNTS]: accounts });
    render();
  }

  async function saveScratchpad(text) {
    scratchpad = text;
    await chrome.storage.local.set({ [STORAGE_KEY_SCRATCHPAD]: scratchpad });
  }

  async function saveSettings(newSettings) {
    settings = Object.assign(settings, newSettings);
    await chrome.storage.local.set({ [STORAGE_KEY_SETTINGS]: settings });
    render();
  }

  // Storage listener
  chrome.storage.onChanged.addListener((changes, area) => {
    if (area === "local") {
      let shouldRerender = false;
      if (changes.serverCodes) {
        serverCodes = changes.serverCodes.newValue || [];
        shouldRerender = true;
      }
      if (changes.accounts) {
        const raw = changes.accounts.newValue || [];
        accounts = raw.map((a) => ({
          id: a.id,
          email: a.email || a.label || "",
          password: a.password || ""
        }));
        shouldRerender = true;
      }
      if (changes.scratchpad && changes.scratchpad.newValue !== scratchpad) {
        scratchpad = changes.scratchpad.newValue || "";
        const textarea = shadow.getElementById("tn-scratchpad-input");
        if (textarea && textarea !== shadow.activeElement) {
          textarea.value = scratchpad;
        }
      }
      if (changes.settings) {
        settings = Object.assign(settings, changes.settings.newValue || {});
        shouldRerender = true;
      }
      if (shouldRerender) render();
    }
  });

  // Background commands
  chrome.runtime.onMessage.addListener((message) => {
    if (message.action === "TOGGLE_DRAWER") {
      toggleDrawer();
    }
  });

  // Clipboard copy helper
  async function copyToClipboard(text, successMsg = "Copied") {
    try {
      if (navigator.clipboard && navigator.clipboard.writeText) {
        await navigator.clipboard.writeText(text);
      } else {
        const temp = document.createElement("textarea");
        temp.value = text;
        temp.style.position = "fixed";
        temp.style.opacity = "0";
        document.body.appendChild(temp);
        temp.select();
        document.execCommand("copy");
        document.body.removeChild(temp);
      }
      showToast(successMsg, "success");
      return true;
    } catch (err) {
      showToast("Copy failed", "error");
      return false;
    }
  }

  // Autofill helper
  function autofillPage(account) {
    try {
      const emailInputs = Array.from(
        document.querySelectorAll(
          'input[type="email"], input[type="text"][name*="user" i], input[type="text"][name*="email" i], input[type="text"][id*="user" i], input[type="text"][id*="email" i], input[autocomplete*="username"], input[autocomplete*="email"]'
        )
      ).filter((el) => {
        const style = window.getComputedStyle(el);
        return style.display !== "none" && style.visibility !== "hidden" && !el.disabled;
      });

      const passInputs = Array.from(
        document.querySelectorAll('input[type="password"]')
      ).filter((el) => {
        const style = window.getComputedStyle(el);
        return style.display !== "none" && style.visibility !== "hidden" && !el.disabled;
      });

      let filledCount = 0;

      function setInputValue(el, value) {
        el.focus();
        el.value = value;
        el.dispatchEvent(new Event("input", { bubbles: true, cancelable: true }));
        el.dispatchEvent(new Event("change", { bubbles: true, cancelable: true }));
        el.dispatchEvent(new Event("blur", { bubbles: true, cancelable: true }));
        filledCount++;
      }

      if (emailInputs.length > 0) {
        setInputValue(emailInputs[0], account.email);
      }

      if (passInputs.length > 0) {
        setInputValue(passInputs[0], account.password);
      }

      if (filledCount > 0) {
        showToast(`Filled ${filledCount} field(s)`, "success");
      } else {
        showToast("No login inputs found", "warning");
      }
    } catch (e) {
      console.error("[Tester Notepad] Autofill error:", e);
      showToast("Autofill failed", "error");
    }
  }

  // Toast Notification System
  function showToast(message, type = "info") {
    const container = shadow.getElementById("tn-toast-container");
    if (!container) return;

    const toast = document.createElement("div");
    toast.className = `tn-toast tn-toast-${type}`;

    toast.innerHTML = `<span class="tn-toast-badge">[${type.toUpperCase()}]</span><span class="tn-toast-msg">${escapeHtml(
      message
    )}</span>`;
    container.appendChild(toast);

    setTimeout(() => {
      toast.classList.add("tn-toast-hide");
      setTimeout(() => toast.remove(), 200);
    }, 2000);
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

  function toggleDrawer() {
    isDrawerOpen = !isDrawerOpen;
    render();
  }

  // Dummy Data Generators
  const DummyGenerators = {
    randomEmail: () => {
      const stamp = Date.now().toString(36);
      const rand = Math.random().toString(36).substring(2, 6);
      return `tester.${stamp}.${rand}@testmail.local`;
    },
    randomPassword: () => {
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
    },
    randomPhone: () => {
      const prefixes = ["0812", "0813", "0821", "0852", "0878", "0896"];
      const prefix = prefixes[Math.floor(Math.random() * prefixes.length)];
      let num = prefix;
      for (let i = 0; i < 8; i++) {
        num += Math.floor(Math.random() * 10);
      }
      return num;
    },
    randomNIK: () => {
      const day = String(Math.floor(Math.random() * 28) + 1).padStart(2, "0");
      const month = String(Math.floor(Math.random() * 12) + 1).padStart(2, "0");
      const year = String(Math.floor(Math.random() * 40) + 70).padStart(2, "0");
      const seq = String(Math.floor(Math.random() * 999) + 1).padStart(4, "0");
      return `317101${day}${month}${year}${seq}`;
    },
    randomCard: () => {
      return "4242424242424242";
    },
    randomUUID: () => {
      return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, function (c) {
        const r = (Math.random() * 16) | 0;
        const v = c === "x" ? r : (r & 0x3) | 0x8;
        return v.toString(16);
      });
    },
    loremShort: () => {
      return "Lorem ipsum dolor sit amet, consectetur adipiscing elit. Sed do eiusmod tempor incididunt ut labore et dolore magna aliqua.";
    }
  };

  // Strictly Monochrome Styles: Pure Black, Pure White, Grays
  function getStyles() {
    return `
      * {
        box-sizing: border-box;
        margin: 0;
        padding: 0;
        font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
      }

      /* Floating Button (Pojok Kanan Bawah) */
      .tn-trigger-btn {
        pointer-events: auto;
        position: fixed;
        bottom: 24px;
        right: 24px;
        width: 48px;
        height: 48px;
        border-radius: 24px;
        background: #09090b;
        border: 1px solid #3f3f46;
        box-shadow: 0 4px 20px rgba(0, 0, 0, 0.7);
        display: flex;
        align-items: center;
        justify-content: center;
        cursor: pointer;
        z-index: 2147483647;
        color: #ffffff;
        transition: background 0.15s, border-color 0.15s, transform 0.15s;
        user-select: none;
      }
      .tn-trigger-btn:hover {
        background: #18181b;
        border-color: #71717a;
        transform: translateY(-2px);
      }
      .tn-trigger-btn:active {
        transform: scale(0.96);
      }
      .tn-trigger-badge {
        position: absolute;
        top: -4px;
        right: -4px;
        background: #ffffff;
        color: #09090b;
        font-size: 10px;
        font-weight: 700;
        min-width: 17px;
        height: 17px;
        border-radius: 9px;
        display: flex;
        align-items: center;
        justify-content: center;
        padding: 0 4px;
        border: 1px solid #09090b;
      }

      /* Backdrop */
      .tn-backdrop {
        pointer-events: auto;
        position: fixed;
        inset: 0;
        background: rgba(0, 0, 0, 0.6);
        z-index: 2147483646;
        opacity: 0;
        visibility: hidden;
        transition: opacity 0.2s ease, visibility 0.2s;
      }
      .tn-backdrop.tn-open {
        opacity: 1;
        visibility: visible;
      }

      /* Slide-out Drawer Panel */
      .tn-drawer {
        pointer-events: auto;
        position: fixed;
        top: 0;
        right: 0;
        width: 395px;
        max-width: calc(100vw - 16px);
        height: 100vh;
        background: #09090b;
        color: #f4f4f5;
        border-left: 1px solid #27272a;
        box-shadow: -8px 0 28px rgba(0, 0, 0, 0.8);
        z-index: 2147483647;
        display: flex;
        flex-direction: column;
        transform: translateX(100%);
        transition: transform 0.22s cubic-bezier(0.16, 1, 0.3, 1);
      }
      .tn-drawer.tn-open {
        transform: translateX(0);
      }

      /* Light Mode Monochrome Variant */
      .tn-theme-light .tn-drawer {
        background: #ffffff;
        color: #09090b;
        border-left: 1px solid #e4e4e7;
        box-shadow: -8px 0 28px rgba(0, 0, 0, 0.15);
      }

      /* Header */
      .tn-header {
        display: flex;
        align-items: center;
        justify-content: space-between;
        padding: 14px 18px;
        background: #09090b;
        border-bottom: 1px solid #27272a;
      }
      .tn-theme-light .tn-header {
        background: #ffffff;
        border-bottom: 1px solid #e4e4e7;
      }
      .tn-brand-group {
        display: flex;
        align-items: center;
        gap: 10px;
      }
      .tn-brand-icon {
        width: 26px;
        height: 26px;
        border-radius: 4px;
        background: #18181b;
        border: 1px solid #3f3f46;
        display: flex;
        align-items: center;
        justify-content: center;
        color: #ffffff;
      }
      .tn-brand-text {
        display: flex;
        flex-direction: column;
      }
      .tn-brand-title {
        font-size: 13px;
        font-weight: 700;
        letter-spacing: 0.5px;
        text-transform: uppercase;
        color: #ffffff;
      }
      .tn-theme-light .tn-brand-title {
        color: #09090b;
      }
      .tn-brand-sub {
        font-size: 10px;
        color: #71717a;
        text-transform: uppercase;
        letter-spacing: 0.3px;
      }
      .tn-header-actions {
        display: flex;
        align-items: center;
        gap: 6px;
      }
      .tn-icon-btn {
        background: #18181b;
        border: 1px solid #27272a;
        color: #a1a1aa;
        cursor: pointer;
        width: 28px;
        height: 28px;
        border-radius: 4px;
        display: flex;
        align-items: center;
        justify-content: center;
        transition: background 0.15s, color 0.15s, border-color 0.15s;
      }
      .tn-theme-light .tn-icon-btn {
        background: #f4f4f5;
        border: 1px solid #e4e4e7;
        color: #52525b;
      }
      .tn-icon-btn:hover {
        background: #27272a;
        color: #ffffff;
        border-color: #3f3f46;
      }
      .tn-theme-light .tn-icon-btn:hover {
        background: #e4e4e7;
        color: #09090b;
      }
      .tn-icon-btn.tn-active {
        background: #ffffff;
        color: #09090b;
        border-color: #ffffff;
      }

      /* Tabs */
      .tn-tabs {
        display: flex;
        background: #09090b;
        border-bottom: 1px solid #27272a;
        padding: 0 12px;
      }
      .tn-theme-light .tn-tabs {
        background: #ffffff;
        border-bottom: 1px solid #e4e4e7;
      }
      .tn-tab {
        flex: 1;
        padding: 10px 4px;
        font-size: 11px;
        font-weight: 600;
        text-transform: uppercase;
        letter-spacing: 0.4px;
        color: #71717a;
        background: transparent;
        border: none;
        border-bottom: 2px solid transparent;
        cursor: pointer;
        text-align: center;
        transition: color 0.15s, border-color 0.15s;
      }
      .tn-tab:hover {
        color: #d4d4d8;
      }
      .tn-theme-light .tn-tab:hover {
        color: #27272a;
      }
      .tn-tab.tn-active {
        color: #ffffff;
        border-bottom-color: #ffffff;
      }
      .tn-theme-light .tn-tab.tn-active {
        color: #09090b;
        border-bottom-color: #09090b;
      }

      /* Body */
      .tn-body {
        flex: 1;
        overflow-y: auto;
        padding: 14px 16px;
        display: flex;
        flex-direction: column;
        gap: 12px;
      }
      .tn-body::-webkit-scrollbar {
        width: 5px;
      }
      .tn-body::-webkit-scrollbar-thumb {
        background: #27272a;
        border-radius: 2px;
      }

      /* ========================================================
         SERVER CODES SECTION (ALWAYS PINNED TOP TIER - BEDA KASTA)
         ======================================================== */
      .tn-server-section {
        background: #111113;
        border: 1px solid #3f3f46;
        border-radius: 6px;
        padding: 10px;
        display: flex;
        flex-direction: column;
        gap: 8px;
        box-shadow: 0 4px 14px rgba(0, 0, 0, 0.45);
      }
      .tn-theme-light .tn-server-section {
        background: #f4f4f5;
        border-color: #d4d4d8;
        box-shadow: 0 2px 8px rgba(0, 0, 0, 0.05);
      }
      .tn-server-header {
        display: flex;
        align-items: center;
        justify-content: space-between;
      }
      .tn-server-title {
        font-size: 11px;
        font-weight: 800;
        letter-spacing: 0.6px;
        text-transform: uppercase;
        color: #ffffff;
        display: flex;
        align-items: center;
        gap: 6px;
      }
      .tn-theme-light .tn-server-title {
        color: #09090b;
      }
      .tn-server-badge {
        font-size: 8px;
        font-weight: 800;
        background: #ffffff;
        color: #09090b;
        padding: 1px 5px;
        border-radius: 2px;
        letter-spacing: 0.4px;
        text-transform: uppercase;
      }
      .tn-theme-light .tn-server-badge {
        background: #09090b;
        color: #ffffff;
      }
      .tn-server-input-row {
        display: flex;
        gap: 6px;
      }
      .tn-server-input {
        flex: 1;
        background: #09090b;
        border: 1px solid #27272a;
        border-radius: 4px;
        color: #ffffff;
        font-family: ui-monospace, SFMono-Regular, monospace;
        font-size: 11px;
        padding: 6px 8px;
        outline: none;
        transition: border-color 0.15s;
      }
      .tn-theme-light .tn-server-input {
        background: #ffffff;
        border-color: #e4e4e7;
        color: #09090b;
      }
      .tn-server-input:focus {
        border-color: #ffffff;
      }
      .tn-theme-light .tn-server-input:focus {
        border-color: #09090b;
      }
      .tn-server-list {
        display: flex;
        flex-direction: column;
        gap: 6px;
      }
      .tn-server-item {
        background: #09090b;
        border: 1px solid #27272a;
        border-left: 3px solid #ffffff;
        border-radius: 4px;
        padding: 6px 8px;
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 8px;
      }
      .tn-theme-light .tn-server-item {
        background: #ffffff;
        border-color: #e4e4e7;
        border-left: 3px solid #09090b;
      }
      .tn-server-code {
        font-family: ui-monospace, SFMono-Regular, monospace;
        font-size: 11px;
        color: #f4f4f5;
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
        flex: 1;
      }
      .tn-theme-light .tn-server-code {
        color: #09090b;
      }

      /* Divider & Section Label */
      .tn-tier-divider {
        height: 1px;
        background: #27272a;
        margin: 4px 0 2px 0;
      }
      .tn-theme-light .tn-tier-divider {
        background: #e4e4e7;
      }
      .tn-section-label {
        font-size: 10px;
        font-weight: 700;
        color: #71717a;
        text-transform: uppercase;
        letter-spacing: 0.5px;
      }

      /* Toolbar */
      .tn-toolbar {
        display: flex;
        gap: 8px;
        align-items: center;
      }
      .tn-search-box {
        flex: 1;
        position: relative;
      }
      .tn-search-icon {
        position: absolute;
        left: 10px;
        top: 50%;
        transform: translateY(-50%);
        color: #71717a;
        pointer-events: none;
        display: flex;
        align-items: center;
      }
      .tn-search-input {
        width: 100%;
        background: #121214;
        border: 1px solid #27272a;
        border-radius: 4px;
        color: #ffffff;
        font-size: 12px;
        padding: 7px 10px 7px 30px;
        outline: none;
        transition: border-color 0.15s;
      }
      .tn-theme-light .tn-search-input {
        background: #ffffff;
        border-color: #e4e4e7;
        color: #09090b;
      }
      .tn-search-input:focus {
        border-color: #71717a;
      }
      .tn-theme-light .tn-search-input:focus {
        border-color: #09090b;
      }

      /* Buttons */
      .tn-btn-primary {
        background: #ffffff;
        color: #09090b;
        border: 1px solid #ffffff;
        border-radius: 4px;
        padding: 6px 12px;
        font-size: 11px;
        font-weight: 700;
        cursor: pointer;
        text-transform: uppercase;
        letter-spacing: 0.3px;
        transition: background 0.15s, opacity 0.15s;
        white-space: nowrap;
      }
      .tn-theme-light .tn-btn-primary {
        background: #09090b;
        color: #ffffff;
        border-color: #09090b;
      }
      .tn-btn-primary:hover {
        background: #e4e4e7;
      }
      .tn-theme-light .tn-btn-primary:hover {
        background: #27272a;
      }

      .tn-btn-secondary {
        background: #18181b;
        color: #f4f4f5;
        border: 1px solid #27272a;
        border-radius: 4px;
        padding: 4px 8px;
        font-size: 11px;
        font-weight: 600;
        cursor: pointer;
        transition: background 0.15s, border-color 0.15s, color 0.15s;
        white-space: nowrap;
      }
      .tn-theme-light .tn-btn-secondary {
        background: #f4f4f5;
        border-color: #e4e4e7;
        color: #09090b;
      }
      .tn-btn-secondary:hover {
        background: #27272a;
        border-color: #3f3f46;
        color: #ffffff;
      }
      .tn-theme-light .tn-btn-secondary:hover {
        background: #e4e4e7;
        border-color: #d4d4d8;
      }
      .tn-btn-secondary.tn-copied {
        background: #ffffff !important;
        color: #09090b !important;
        border-color: #ffffff !important;
      }

      .tn-btn-delete {
        background: #18181b;
        color: #a1a1aa;
        border: 1px solid #27272a;
        border-radius: 4px;
        padding: 4px 8px;
        font-size: 11px;
        font-weight: 600;
        cursor: pointer;
        transition: background 0.15s, border-color 0.15s, color 0.15s;
        white-space: nowrap;
      }
      .tn-theme-light .tn-btn-delete {
        background: #f4f4f5;
        border-color: #e4e4e7;
        color: #71717a;
      }
      .tn-btn-delete:hover {
        background: #27272a;
        color: #ffffff;
        border-color: #52525b;
      }
      .tn-theme-light .tn-btn-delete:hover {
        background: #e4e4e7;
        color: #09090b;
      }

      .tn-btn-ghost {
        background: transparent;
        color: #71717a;
        border: 1px solid transparent;
        border-radius: 4px;
        padding: 4px 6px;
        font-size: 11px;
        cursor: pointer;
        transition: color 0.15s, background 0.15s;
      }
      .tn-btn-ghost:hover {
        color: #ffffff;
        background: #18181b;
      }
      .tn-theme-light .tn-btn-ghost:hover {
        color: #09090b;
        background: #f4f4f5;
      }

      /* Compact Credential Card (Email & Password Only) */
      .tn-card-list {
        display: flex;
        flex-direction: column;
        gap: 10px;
      }
      .tn-card {
        background: #121214;
        border: 1px solid #27272a;
        border-radius: 6px;
        padding: 10px;
        display: flex;
        flex-direction: column;
        gap: 6px;
        transition: border-color 0.15s;
      }
      .tn-theme-light .tn-card {
        background: #fcfcfc;
        border: 1px solid #e4e4e7;
      }
      .tn-card:hover {
        border-color: #3f3f46;
      }
      .tn-theme-light .tn-card:hover {
        border-color: #d4d4d8;
      }

      /* Field Row */
      .tn-field-row {
        background: #09090b;
        border: 1px solid #27272a;
        border-radius: 4px;
        padding: 6px 8px;
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 8px;
      }
      .tn-theme-light .tn-field-row {
        background: #ffffff;
        border: 1px solid #e4e4e7;
      }
      .tn-field-info {
        display: flex;
        flex-direction: column;
        overflow: hidden;
        flex: 1;
      }
      .tn-field-label {
        font-size: 9px;
        font-weight: 700;
        color: #71717a;
        text-transform: uppercase;
        letter-spacing: 0.4px;
      }
      .tn-field-value {
        font-size: 12px;
        font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
        color: #f4f4f5;
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
      }
      .tn-theme-light .tn-field-value {
        color: #09090b;
      }
      .tn-field-buttons {
        display: flex;
        align-items: center;
        gap: 4px;
      }

      /* Card Footer */
      .tn-card-footer {
        display: flex;
        align-items: center;
        justify-content: space-between;
        margin-top: 2px;
        gap: 8px;
      }
      .tn-card-actions {
        display: flex;
        gap: 4px;
      }
      .tn-btn-autofill {
        background: #18181b;
        color: #f4f4f5;
        border: 1px solid #3f3f46;
        border-radius: 4px;
        padding: 4px 10px;
        font-size: 11px;
        font-weight: 600;
        cursor: pointer;
        transition: background 0.15s, border-color 0.15s, color 0.15s;
        white-space: nowrap;
      }
      .tn-theme-light .tn-btn-autofill {
        background: #f4f4f5;
        border-color: #d4d4d8;
        color: #09090b;
      }
      .tn-btn-autofill:hover {
        background: #ffffff;
        color: #09090b;
        border-color: #ffffff;
      }
      .tn-theme-light .tn-btn-autofill:hover {
        background: #09090b;
        color: #ffffff;
        border-color: #09090b;
      }

      /* Inline Form (Email & Password Only) */
      .tn-form-container {
        background: #121214;
        border: 1px solid #3f3f46;
        border-radius: 6px;
        padding: 12px;
        display: flex;
        flex-direction: column;
        gap: 8px;
      }
      .tn-theme-light .tn-form-container {
        background: #fcfcfc;
        border-color: #d4d4d8;
      }
      .tn-form-title {
        font-size: 11px;
        font-weight: 700;
        text-transform: uppercase;
        letter-spacing: 0.4px;
        color: #ffffff;
      }
      .tn-theme-light .tn-form-title {
        color: #09090b;
      }
      .tn-input-group {
        display: flex;
        flex-direction: column;
        gap: 3px;
      }
      .tn-input-label {
        font-size: 10px;
        color: #71717a;
        font-weight: 600;
        text-transform: uppercase;
      }
      .tn-text-input {
        background: #09090b;
        border: 1px solid #27272a;
        border-radius: 4px;
        color: #ffffff;
        font-size: 12px;
        padding: 6px 8px;
        outline: none;
      }
      .tn-theme-light .tn-text-input {
        background: #ffffff;
        border-color: #e4e4e7;
        color: #09090b;
      }
      .tn-text-input:focus {
        border-color: #71717a;
      }
      .tn-form-actions {
        display: flex;
        justify-content: flex-end;
        gap: 6px;
        margin-top: 4px;
      }

      /* Scratchpad */
      .tn-scratchpad-area {
        display: flex;
        flex-direction: column;
        flex: 1;
        gap: 8px;
        height: 100%;
      }
      .tn-scratchpad-input {
        width: 100%;
        flex: 1;
        min-height: 400px;
        background: #121214;
        border: 1px solid #27272a;
        border-radius: 6px;
        color: #f4f4f5;
        font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
        font-size: 12px;
        line-height: 1.5;
        padding: 10px;
        resize: none;
        outline: none;
      }
      .tn-theme-light .tn-scratchpad-input {
        background: #fcfcfc;
        border-color: #e4e4e7;
        color: #09090b;
      }
      .tn-scratchpad-input:focus {
        border-color: #71717a;
      }
      .tn-scratchpad-toolbar {
        display: flex;
        justify-content: space-between;
        align-items: center;
      }
      .tn-scratchpad-info {
        font-size: 11px;
        color: #71717a;
      }
      .tn-scratchpad-actions {
        display: flex;
        gap: 6px;
      }

      /* Generators */
      .tn-gen-grid {
        display: flex;
        flex-direction: column;
        gap: 8px;
      }
      .tn-gen-item {
        background: #121214;
        border: 1px solid #27272a;
        border-radius: 6px;
        padding: 10px 12px;
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 8px;
      }
      .tn-theme-light .tn-gen-item {
        background: #fcfcfc;
        border-color: #e4e4e7;
      }
      .tn-gen-info {
        display: flex;
        flex-direction: column;
        gap: 2px;
      }
      .tn-gen-name {
        font-size: 12px;
        font-weight: 700;
        color: #ffffff;
      }
      .tn-theme-light .tn-gen-name {
        color: #09090b;
      }
      .tn-gen-desc {
        font-size: 10px;
        color: #71717a;
        font-family: ui-monospace, monospace;
      }

      /* Settings */
      .tn-settings-list {
        display: flex;
        flex-direction: column;
        gap: 12px;
      }
      .tn-settings-group {
        background: #121214;
        border: 1px solid #27272a;
        border-radius: 6px;
        padding: 12px;
        display: flex;
        flex-direction: column;
        gap: 10px;
      }
      .tn-theme-light .tn-settings-group {
        background: #fcfcfc;
        border-color: #e4e4e7;
      }
      .tn-settings-title {
        font-size: 11px;
        font-weight: 700;
        color: #71717a;
        text-transform: uppercase;
        letter-spacing: 0.5px;
      }
      .tn-setting-row {
        display: flex;
        align-items: center;
        justify-content: space-between;
      }
      .tn-setting-label {
        font-size: 12px;
        color: #f4f4f5;
      }
      .tn-theme-light .tn-setting-label {
        color: #09090b;
      }

      /* Toast */
      #tn-toast-container {
        position: fixed;
        bottom: 24px;
        right: 405px;
        display: flex;
        flex-direction: column;
        gap: 6px;
        z-index: 2147483647;
        pointer-events: none;
      }
      .tn-toast {
        background: #09090b;
        color: #ffffff;
        border: 1px solid #3f3f46;
        border-radius: 4px;
        padding: 6px 12px;
        font-size: 11px;
        font-weight: 600;
        box-shadow: 0 4px 16px rgba(0, 0, 0, 0.6);
        display: flex;
        align-items: center;
        gap: 8px;
        transition: opacity 0.2s, transform 0.2s;
      }
      .tn-toast-badge {
        color: #a1a1aa;
        font-family: ui-monospace, monospace;
        font-size: 10px;
      }
      .tn-toast-hide {
        opacity: 0;
        transform: translateY(8px);
      }
    `;
  }

  // Render UI
  function render() {
    const isIconVisible = settings.floatingIconEnabled;
    const themeClass = settings.theme === "light" ? "tn-theme-light" : "tn-theme-dark";

    const filteredAccounts = accounts.filter((acc) => {
      if (!searchQuery.trim()) return true;
      const q = searchQuery.toLowerCase();
      return acc.email.toLowerCase().includes(q);
    });

    const totalCount = serverCodes.length + accounts.length;

    shadow.innerHTML = `
      <style>${getStyles()}</style>
      <div class="${themeClass}">
        <!-- Floating Trigger Icon (Pojok Kanan Bawah) -->
        ${
          isIconVisible
            ? `
          <div class="tn-trigger-btn" id="tn-trigger" title="Tester Notepad (Alt+L)">
            ${Icons.doc}
            <div class="tn-trigger-badge">${totalCount}</div>
          </div>
        `
            : ""
        }

        <!-- Backdrop -->
        <div class="tn-backdrop ${isDrawerOpen && !isPinned ? "tn-open" : ""}" id="tn-backdrop"></div>

        <!-- Slide-out Drawer Panel (Kanan Layar) -->
        <div class="tn-drawer ${isDrawerOpen ? "tn-open" : ""}" id="tn-drawer">
          <!-- Header -->
          <div class="tn-header">
            <div class="tn-brand-group">
              <div class="tn-brand-icon">${Icons.doc}</div>
              <div class="tn-brand-text">
                <span class="tn-brand-title">Tester Notepad</span>
                <span class="tn-brand-sub">QA Workspace</span>
              </div>
            </div>
            <div class="tn-header-actions">
              <button class="tn-icon-btn" id="tn-btn-dashboard" title="Open Chrome Dashboard">
                ${Icons.dashboard}
              </button>
              <button class="tn-icon-btn ${isPinned ? "tn-active" : ""}" id="tn-btn-pin" title="${
      isPinned ? "Unpin" : "Pin"
    }">
                ${Icons.pin}
              </button>
              <button class="tn-icon-btn" id="tn-btn-close" title="Close">
                ${Icons.close}
              </button>
            </div>
          </div>

          <!-- Tabs -->
          <div class="tn-tabs">
            <button class="tn-tab ${activeTab === "credentials" ? "tn-active" : ""}" data-tab="credentials">
              Credentials
            </button>
            <button class="tn-tab ${activeTab === "scratchpad" ? "tn-active" : ""}" data-tab="scratchpad">
              Scratchpad
            </button>
            <button class="tn-tab ${activeTab === "generators" ? "tn-active" : ""}" data-tab="generators">
              Generators
            </button>
            <button class="tn-tab ${activeTab === "settings" ? "tn-active" : ""}" data-tab="settings">
              Settings
            </button>
          </div>

          <!-- Body -->
          <div class="tn-body">
            ${renderTabContent(filteredAccounts)}
          </div>
        </div>

        <!-- Toast Container -->
        <div id="tn-toast-container"></div>
      </div>
    `;

    bindEvents();
  }

  function renderTabContent(filteredAccounts) {
    if (activeTab === "credentials") {
      return `
        <!-- ========================================================
             SERVER CODES SECTION (ALWAYS PINNED TOP TIER - BEDA KASTA)
             ======================================================== -->
        <div class="tn-server-section">
          <div class="tn-server-header">
            <span class="tn-server-title">
              SERVER CODES
              <span class="tn-server-badge">TOP TIER</span>
            </span>
          </div>

          <!-- Input Slot to Paste Server Code -->
          <div class="tn-server-input-row">
            <input 
              type="text" 
              class="tn-server-input" 
              id="tn-server-input" 
              placeholder="Paste server code / host / URL..." 
            />
            <button class="tn-btn-primary" id="tn-btn-add-server">+ Add</button>
          </div>

          <!-- Server Slots List -->
          <div class="tn-server-list">
            ${
              serverCodes.length === 0
                ? `<div style="color: #71717a; font-size: 11px; padding: 2px;">No server codes saved. Paste code above.</div>`
                : serverCodes
                    .map(
                      (srv) => `
                <div class="tn-server-item" data-id="${srv.id}">
                  <span class="tn-server-code" title="${escapeHtml(srv.code)}">${escapeHtml(srv.code)}</span>
                  <div class="tn-field-buttons">
                    <button class="tn-btn-secondary tn-copy-server-btn" data-text="${escapeHtml(srv.code)}">
                      Copy
                    </button>
                    <button class="tn-btn-delete tn-del-server-btn" data-id="${srv.id}" title="Delete server code">
                      Del
                    </button>
                  </div>
                </div>
              `
                    )
                    .join("")
            }
          </div>
        </div>

        <div class="tn-tier-divider"></div>

        <div class="tn-section-label">CREDENTIALS (EMAIL &amp; PASSWORD)</div>

        <!-- Credentials Toolbar -->
        <div class="tn-toolbar">
          <div class="tn-search-box">
            <span class="tn-search-icon">${Icons.search}</span>
            <input 
              type="text" 
              class="tn-search-input" 
              id="tn-search-input" 
              placeholder="Search email..." 
              value="${escapeHtml(searchQuery)}"
            />
          </div>
          <button class="tn-btn-primary" id="tn-btn-toggle-add">
            ${showAddForm ? "Cancel" : "+ Add"}
          </button>
          ${
            accounts.length > 0
              ? `<button class="tn-btn-delete" id="tn-btn-clear-all" title="Delete all credentials">Clear All</button>`
              : ""
          }
        </div>

        <!-- Inline Add/Edit Form (Email & Password Only) -->
        ${
          showAddForm
            ? `
          <div class="tn-form-container" id="tn-account-form">
            <div class="tn-form-title">${editingAccountId ? "Edit Credential" : "New Credential"}</div>
            <div class="tn-input-group">
              <label class="tn-input-label">Email / Username</label>
              <input type="text" class="tn-text-input" id="tn-form-email" placeholder="e.g. test@example.com" value="${
                editingAccountId ? escapeHtml(accounts.find((a) => a.id === editingAccountId)?.email || "") : ""
              }" />
            </div>
            <div class="tn-input-group">
              <label class="tn-input-label">Password</label>
              <input type="text" class="tn-text-input" id="tn-form-password" placeholder="e.g. Password123!" value="${
                editingAccountId ? escapeHtml(accounts.find((a) => a.id === editingAccountId)?.password || "") : ""
              }" />
            </div>
            <div class="tn-form-actions">
              <button class="tn-btn-ghost" id="tn-form-cancel">Cancel</button>
              <button class="tn-btn-primary" id="tn-form-save">Save</button>
            </div>
          </div>
        `
            : ""
        }

        <!-- Cards List (Compact Email & Password) -->
        <div class="tn-card-list">
          ${
            filteredAccounts.length === 0
              ? `<div style="text-align: center; color: #71717a; font-size: 12px; padding: 20px;">No credentials found. Click '+ Add' to save one.</div>`
              : filteredAccounts
                  .map((acc) => {
                    const isVisible = !!showPasswords[acc.id];
                    const maskedPassword = isVisible ? escapeHtml(acc.password) : "••••••••••••";
                    return `
              <div class="tn-card" data-account-id="${acc.id}">
                <!-- Email Row -->
                <div class="tn-field-row">
                  <div class="tn-field-info">
                    <span class="tn-field-label">Email</span>
                    <span class="tn-field-value" title="${escapeHtml(acc.email)}">${escapeHtml(acc.email)}</span>
                  </div>
                  <div class="tn-field-buttons">
                    <button class="tn-btn-secondary tn-copy-email-btn" data-text="${escapeHtml(acc.email)}">
                      Copy
                    </button>
                  </div>
                </div>

                <!-- Password Row -->
                <div class="tn-field-row">
                  <div class="tn-field-info">
                    <span class="tn-field-label">Password</span>
                    <span class="tn-field-value">${maskedPassword}</span>
                  </div>
                  <div class="tn-field-buttons">
                    <button class="tn-btn-ghost tn-toggle-pass-btn" data-id="${acc.id}">
                      ${isVisible ? "Hide" : "Show"}
                    </button>
                    <button class="tn-btn-secondary tn-copy-pass-btn" data-text="${escapeHtml(acc.password)}">
                      Copy
                    </button>
                  </div>
                </div>

                <!-- Footer Actions -->
                <div class="tn-card-footer">
                  <button class="tn-btn-autofill" data-id="${acc.id}" title="Autofill inputs on this webpage">
                    Autofill
                  </button>
                  <div class="tn-card-actions">
                    <button class="tn-btn-ghost tn-btn-edit-account" data-id="${acc.id}" title="Edit credential">
                      Edit
                    </button>
                    <button class="tn-btn-delete tn-btn-delete-account" data-id="${acc.id}" title="Delete credential">
                      Delete
                    </button>
                  </div>
                </div>
              </div>
            `;
                  })
                  .join("")
          }
        </div>
      `;
    }

    if (activeTab === "scratchpad") {
      const lineCount = scratchpad ? scratchpad.split("\n").length : 0;
      const charCount = scratchpad ? scratchpad.length : 0;
      return `
        <div class="tn-scratchpad-area">
          <div class="tn-scratchpad-toolbar">
            <span class="tn-scratchpad-info">${lineCount} lines • ${charCount} chars</span>
            <div class="tn-scratchpad-actions">
              <button class="tn-btn-secondary" id="tn-btn-copy-notes">Copy All</button>
              <button class="tn-btn-ghost" id="tn-btn-clear-notes">Clear</button>
            </div>
          </div>
          <textarea 
            class="tn-scratchpad-input" 
            id="tn-scratchpad-input" 
            placeholder="Store temporary test notes, tokens, OTPs, or test scenarios..."
          >${escapeHtml(scratchpad)}</textarea>
        </div>
      `;
    }

    if (activeTab === "generators") {
      return `
        <div class="tn-gen-grid">
          <div class="tn-gen-item">
            <div class="tn-gen-info">
              <span class="tn-gen-name">Random Test Email</span>
              <span class="tn-gen-desc">tester.timestamp@testmail.local</span>
            </div>
            <button class="tn-btn-secondary tn-gen-btn" data-gen="randomEmail">Copy</button>
          </div>

          <div class="tn-gen-item">
            <div class="tn-gen-info">
              <span class="tn-gen-name">Strong Password</span>
              <span class="tn-gen-desc">12 characters with digits & symbols</span>
            </div>
            <button class="tn-btn-secondary tn-gen-btn" data-gen="randomPassword">Copy</button>
          </div>

          <div class="tn-gen-item">
            <div class="tn-gen-info">
              <span class="tn-gen-name">Indonesian Mobile Phone</span>
              <span class="tn-gen-desc">0812xxxxxxxx</span>
            </div>
            <button class="tn-btn-secondary tn-gen-btn" data-gen="randomPhone">Copy</button>
          </div>

          <div class="tn-gen-item">
            <div class="tn-gen-info">
              <span class="tn-gen-name">NIK / KTP 16-Digit</span>
              <span class="tn-gen-desc">Numeric compliant standard</span>
            </div>
            <button class="tn-btn-secondary tn-gen-btn" data-gen="randomNIK">Copy</button>
          </div>

          <div class="tn-gen-item">
            <div class="tn-gen-info">
              <span class="tn-gen-name">Test Visa Credit Card</span>
              <span class="tn-gen-desc">4242 4242 4242 4242</span>
            </div>
            <button class="tn-btn-secondary tn-gen-btn" data-gen="randomCard">Copy</button>
          </div>

          <div class="tn-gen-item">
            <div class="tn-gen-info">
              <span class="tn-gen-name">UUID v4</span>
              <span class="tn-gen-desc">Standard 36-char string</span>
            </div>
            <button class="tn-btn-secondary tn-gen-btn" data-gen="randomUUID">Copy</button>
          </div>

          <div class="tn-gen-item">
            <div class="tn-gen-info">
              <span class="tn-gen-name">Lorem Ipsum Text</span>
              <span class="tn-gen-desc">Standard dummy body text</span>
            </div>
            <button class="tn-btn-secondary tn-gen-btn" data-gen="loremShort">Copy</button>
          </div>
        </div>
      `;
    }

    if (activeTab === "settings") {
      return `
        <div class="tn-settings-list">
          <div class="tn-settings-group">
            <div class="tn-settings-title">Display</div>
            <div class="tn-setting-row">
              <span class="tn-setting-label">Show Floating Icon</span>
              <input type="checkbox" id="tn-set-icon-toggle" ${settings.floatingIconEnabled ? "checked" : ""} />
            </div>
            <div class="tn-setting-row">
              <span class="tn-setting-label">Theme Mode</span>
              <select id="tn-set-theme" class="tn-text-input">
                <option value="dark" ${settings.theme === "dark" ? "selected" : ""}>Dark Monochrome</option>
                <option value="light" ${settings.theme === "light" ? "selected" : ""}>Light Monochrome</option>
              </select>
            </div>
          </div>

          <div class="tn-settings-group">
            <div class="tn-settings-title">Backup & Restore</div>
            <button class="tn-btn-secondary" id="tn-btn-export" style="width: 100%; text-align: center;">
              Export JSON Backup
            </button>
            <label class="tn-btn-secondary" style="width: 100%; text-align: center; display: block; cursor: pointer;">
              Import JSON Backup
              <input type="file" id="tn-input-import" accept=".json" style="display: none;" />
            </label>
            <button class="tn-btn-ghost" id="tn-btn-reset-data" style="margin-top: 4px; text-align: center;">
              Reset to Demo Defaults
            </button>
          </div>

          <div class="tn-settings-group">
            <div class="tn-settings-title">Shortcuts</div>
            <div style="font-size: 11px; color: #71717a; line-height: 1.6; font-family: ui-monospace, monospace;">
              Alt + L : Toggle Drawer<br/>
              Esc     : Close Drawer
            </div>
          </div>
        </div>
      `;
    }
  }

  // Event Listeners
  function bindEvents() {
    // Floating Button Toggle
    const trigger = shadow.getElementById("tn-trigger");
    if (trigger) {
      trigger.addEventListener("click", () => {
        toggleDrawer();
      });
    }

    // Backdrop Click
    const backdrop = shadow.getElementById("tn-backdrop");
    if (backdrop) {
      backdrop.addEventListener("click", () => {
        if (!isPinned) {
          isDrawerOpen = false;
          render();
        }
      });
    }

    // Dashboard Button
    const dashBtn = shadow.getElementById("tn-btn-dashboard");
    if (dashBtn) {
      dashBtn.addEventListener("click", () => {
        chrome.runtime.sendMessage({ action: "OPEN_DASHBOARD" });
      });
    }

    // Close Button
    const closeBtn = shadow.getElementById("tn-btn-close");
    if (closeBtn) {
      closeBtn.addEventListener("click", () => {
        isDrawerOpen = false;
        render();
      });
    }

    // Pin Button
    const pinBtn = shadow.getElementById("tn-btn-pin");
    if (pinBtn) {
      pinBtn.addEventListener("click", () => {
        isPinned = !isPinned;
        showToast(isPinned ? "Drawer pinned" : "Drawer unpinned", "info");
        render();
      });
    }

    // Tab Navigation
    shadow.querySelectorAll(".tn-tab").forEach((tab) => {
      tab.addEventListener("click", (e) => {
        activeTab = e.currentTarget.getAttribute("data-tab");
        showAddForm = false;
        editingAccountId = null;
        render();
      });
    });

    // ==========================================
    // SERVER CODES EVENT HANDLERS (TOP TIER)
    // ==========================================
    const addServerBtn = shadow.getElementById("tn-btn-add-server");
    const serverInput = shadow.getElementById("tn-server-input");

    const handleAddServer = async () => {
      if (!serverInput) return;
      const code = serverInput.value.trim();
      if (!code) {
        showToast("Enter server code", "error");
        return;
      }
      const newServer = {
        id: "srv_" + Date.now(),
        code
      };
      await saveServers([...serverCodes, newServer]);
      showToast("Server code added", "success");
    };

    if (addServerBtn) {
      addServerBtn.addEventListener("click", handleAddServer);
    }
    if (serverInput) {
      serverInput.addEventListener("keydown", (e) => {
        if (e.key === "Enter") {
          e.preventDefault();
          handleAddServer();
        }
      });
    }

    // Copy Server Code
    shadow.querySelectorAll(".tn-copy-server-btn").forEach((btn) => {
      btn.addEventListener("click", (e) => {
        const text = e.currentTarget.getAttribute("data-text");
        copyToClipboard(text, "Server code copied");
        e.currentTarget.classList.add("tn-copied");
        setTimeout(() => e.currentTarget.classList.remove("tn-copied"), 600);
      });
    });

    // Delete Server Code
    shadow.querySelectorAll(".tn-del-server-btn").forEach((btn) => {
      btn.addEventListener("click", async (e) => {
        const id = e.currentTarget.getAttribute("data-id");
        const updated = serverCodes.filter((s) => s.id !== id);
        await saveServers(updated);
        showToast("Server code deleted", "info");
      });
    });

    // ==========================================
    // CREDENTIALS EVENT HANDLERS
    // ==========================================
    const searchInput = shadow.getElementById("tn-search-input");
    if (searchInput) {
      searchInput.addEventListener("input", (e) => {
        searchQuery = e.target.value;
        const list = shadow.querySelector(".tn-card-list");
        if (list) {
          const filtered = accounts.filter((acc) => {
            if (!searchQuery.trim()) return true;
            const q = searchQuery.toLowerCase();
            return acc.email.toLowerCase().includes(q);
          });
          const container = shadow.querySelector(".tn-body");
          if (container) {
            container.innerHTML = renderTabContent(filtered);
            bindEvents();
            const newSearch = shadow.getElementById("tn-search-input");
            if (newSearch) {
              newSearch.focus();
              newSearch.selectionStart = newSearch.selectionEnd = newSearch.value.length;
            }
          }
        }
      });
    }

    // Toggle Add Form
    const toggleAddBtn = shadow.getElementById("tn-btn-toggle-add");
    if (toggleAddBtn) {
      toggleAddBtn.addEventListener("click", () => {
        showAddForm = !showAddForm;
        editingAccountId = null;
        render();
      });
    }

    // Cancel Form
    const cancelFormBtn = shadow.getElementById("tn-form-cancel");
    if (cancelFormBtn) {
      cancelFormBtn.addEventListener("click", () => {
        showAddForm = false;
        editingAccountId = null;
        render();
      });
    }

    // Save Form (Email & Password Only)
    const saveFormBtn = shadow.getElementById("tn-form-save");
    if (saveFormBtn) {
      saveFormBtn.addEventListener("click", async () => {
        const email = shadow.getElementById("tn-form-email").value.trim();
        const password = shadow.getElementById("tn-form-password").value.trim();

        if (!email) {
          showToast("Email is required", "error");
          return;
        }

        if (editingAccountId) {
          const updated = accounts.map((a) => {
            if (a.id === editingAccountId) {
              return { id: a.id, email, password };
            }
            return a;
          });
          await saveAccounts(updated);
          showToast("Credential updated", "success");
        } else {
          const newAcc = {
            id: "acc_" + Date.now(),
            email,
            password
          };
          await saveAccounts([...accounts, newAcc]);
          showToast("Credential added", "success");
        }

        showAddForm = false;
        editingAccountId = null;
        render();
      });
    }

    // Copy Email
    shadow.querySelectorAll(".tn-copy-email-btn").forEach((btn) => {
      btn.addEventListener("click", (e) => {
        const text = e.currentTarget.getAttribute("data-text");
        copyToClipboard(text, "Email copied");
        e.currentTarget.classList.add("tn-copied");
        setTimeout(() => e.currentTarget.classList.remove("tn-copied"), 600);
      });
    });

    // Copy Password
    shadow.querySelectorAll(".tn-copy-pass-btn").forEach((btn) => {
      btn.addEventListener("click", (e) => {
        const text = e.currentTarget.getAttribute("data-text");
        copyToClipboard(text, "Password copied");
        e.currentTarget.classList.add("tn-copied");
        setTimeout(() => e.currentTarget.classList.remove("tn-copied"), 600);
      });
    });

    // Toggle Password Visibility
    shadow.querySelectorAll(".tn-toggle-pass-btn").forEach((btn) => {
      btn.addEventListener("click", (e) => {
        const id = e.currentTarget.getAttribute("data-id");
        showPasswords[id] = !showPasswords[id];
        render();
      });
    });

    // Edit Account
    shadow.querySelectorAll(".tn-btn-edit-account").forEach((btn) => {
      btn.addEventListener("click", (e) => {
        editingAccountId = e.currentTarget.getAttribute("data-id");
        showAddForm = true;
        render();
      });
    });

    // Delete Account
    shadow.querySelectorAll(".tn-btn-delete-account").forEach((btn) => {
      btn.addEventListener("click", async (e) => {
        const id = e.currentTarget.getAttribute("data-id");
        const updated = accounts.filter((a) => a.id !== id);
        await saveAccounts(updated);
        showToast("Credential deleted", "info");
      });
    });

    // Clear All Credentials
    const clearAllBtn = shadow.getElementById("tn-btn-clear-all");
    if (clearAllBtn) {
      clearAllBtn.addEventListener("click", async () => {
        await saveAccounts([]);
        showToast("All credentials cleared", "info");
      });
    }

    // Autofill
    shadow.querySelectorAll(".tn-btn-autofill").forEach((btn) => {
      btn.addEventListener("click", (e) => {
        const id = e.currentTarget.getAttribute("data-id");
        const account = accounts.find((a) => a.id === id);
        if (account) {
          autofillPage(account);
        }
      });
    });

    // Scratchpad Auto-Save
    const scratchpadInput = shadow.getElementById("tn-scratchpad-input");
    if (scratchpadInput) {
      scratchpadInput.addEventListener("input", (e) => {
        saveScratchpad(e.target.value);
        const lineCount = e.target.value.split("\n").length;
        const charCount = e.target.value.length;
        const info = shadow.querySelector(".tn-scratchpad-info");
        if (info) {
          info.textContent = `${lineCount} lines • ${charCount} chars`;
        }
      });
    }

    // Copy All Scratchpad Notes
    const copyNotesBtn = shadow.getElementById("tn-btn-copy-notes");
    if (copyNotesBtn) {
      copyNotesBtn.addEventListener("click", () => {
        copyToClipboard(scratchpad, "Scratchpad copied");
      });
    }

    // Clear Scratchpad
    const clearNotesBtn = shadow.getElementById("tn-btn-clear-notes");
    if (clearNotesBtn) {
      clearNotesBtn.addEventListener("click", async () => {
        if (confirm("Clear all scratchpad text?")) {
          await saveScratchpad("");
          render();
          showToast("Scratchpad cleared", "info");
        }
      });
    }

    // Dummy Generators
    shadow.querySelectorAll(".tn-gen-btn").forEach((btn) => {
      btn.addEventListener("click", (e) => {
        const genType = e.currentTarget.getAttribute("data-gen");
        if (DummyGenerators[genType]) {
          const val = DummyGenerators[genType]();
          copyToClipboard(val, `Copied: ${val}`);
          e.currentTarget.classList.add("tn-copied");
          setTimeout(() => e.currentTarget.classList.remove("tn-copied"), 600);
        }
      });
    });

    // Settings: Toggle Floating Icon
    const setIconToggle = shadow.getElementById("tn-set-icon-toggle");
    if (setIconToggle) {
      setIconToggle.addEventListener("change", (e) => {
        saveSettings({ floatingIconEnabled: e.target.checked });
        showToast(
          e.target.checked
            ? "Floating icon enabled"
            : "Floating icon hidden (Alt+L to toggle)",
          "info"
        );
      });
    }

    // Settings: Theme Change
    const setTheme = shadow.getElementById("tn-set-theme");
    if (setTheme) {
      setTheme.addEventListener("change", (e) => {
        saveSettings({ theme: e.target.value });
      });
    }

    // Settings: Export JSON
    const exportBtn = shadow.getElementById("tn-btn-export");
    if (exportBtn) {
      exportBtn.addEventListener("click", () => {
        const exportData = {
          serverCodes,
          accounts,
          scratchpad,
          settings,
          exportedAt: new Date().toISOString()
        };
        const blob = new Blob([JSON.stringify(exportData, null, 2)], {
          type: "application/json"
        });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `tester-notepad-backup-${new Date().toISOString().slice(0, 10)}.json`;
        a.click();
        URL.revokeObjectURL(url);
        showToast("Backup exported", "success");
      });
    }

    // Settings: Import JSON
    const importInput = shadow.getElementById("tn-input-import");
    if (importInput) {
      importInput.addEventListener("change", (e) => {
        const file = e.target.files[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = async (event) => {
          try {
            const imported = JSON.parse(event.target.result);
            if (Array.isArray(imported.serverCodes)) {
              await saveServers(imported.serverCodes);
            }
            if (Array.isArray(imported.accounts)) {
              const cleaned = imported.accounts.map((a) => ({
                id: a.id || "acc_" + Math.random().toString(36).substring(2, 7),
                email: a.email || a.label || "",
                password: a.password || ""
              }));
              await saveAccounts(cleaned);
            }
            if (typeof imported.scratchpad === "string") {
              await saveScratchpad(imported.scratchpad);
            }
            if (imported.settings) {
              await saveSettings(imported.settings);
            }
            showToast("Backup imported", "success");
            render();
          } catch (err) {
            showToast("Invalid JSON file", "error");
          }
        };
        reader.readAsText(file);
      });
    }

    // Settings: Reset Data
    const resetBtn = shadow.getElementById("tn-btn-reset-data");
    if (resetBtn) {
      resetBtn.addEventListener("click", async () => {
        if (confirm("Reset to default demo data?")) {
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
          await saveServers(DEFAULT_SERVERS);
          await saveAccounts(DEFAULT_ACCOUNTS);
          showToast("Reset completed", "info");
          render();
        }
      });
    }
  }

  // Global Keyboard Shortcuts
  window.addEventListener("keydown", (e) => {
    if (e.altKey && (e.key === "l" || e.key === "L" || e.key === "n" || e.key === "N")) {
      e.preventDefault();
      toggleDrawer();
    }
    if (e.key === "Escape" && isDrawerOpen && !isPinned) {
      isDrawerOpen = false;
      render();
    }
  });

  // Initialize
  loadData().then(() => {
    render();
  });
})();
