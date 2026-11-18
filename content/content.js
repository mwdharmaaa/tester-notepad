/**
 * Tester Notepad - Content Script
 * Encapsulated via Shadow DOM for 100% style isolation on any webpage.
 */

(function () {
  // Prevent duplicate injection
  if (document.getElementById("tester-notepad-root")) return;

  const ROOT_ID = "tester-notepad-root";
  const STORAGE_KEY_ACCOUNTS = "accounts";
  const STORAGE_KEY_SCRATCHPAD = "scratchpad";
  const STORAGE_KEY_SETTINGS = "settings";

  // State
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
  let showPasswords = {}; // map of accountId -> boolean

  // Create Root & Shadow
  const rootEl = document.createElement("div");
  rootEl.id = ROOT_ID;
  document.documentElement.appendChild(rootEl);
  const shadow = rootEl.attachShadow({ mode: "open" });

  // Load Initial Storage
  async function loadData() {
    try {
      const data = await chrome.storage.local.get([
        STORAGE_KEY_ACCOUNTS,
        STORAGE_KEY_SCRATCHPAD,
        STORAGE_KEY_SETTINGS
      ]);
      if (Array.isArray(data.accounts)) accounts = data.accounts;
      if (typeof data.scratchpad === "string") scratchpad = data.scratchpad;
      if (data.settings) settings = Object.assign(settings, data.settings);
    } catch (e) {
      console.warn("[Tester Notepad] Storage load error:", e);
    }
  }

  // Save Storage
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

  // Listen to external storage updates
  chrome.storage.onChanged.addListener((changes, area) => {
    if (area === "local") {
      let shouldRerender = false;
      if (changes.accounts) {
        accounts = changes.accounts.newValue || [];
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

  // Listen for background messages (keyboard shortcuts)
  chrome.runtime.onMessage.addListener((message) => {
    if (message.action === "TOGGLE_DRAWER") {
      toggleDrawer();
    }
  });

  // Clipboard copy helper
  async function copyToClipboard(text, successMsg = "Copied!") {
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
      showToast("Failed to copy", "error");
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
        // Dispatch synthetic events for React, Vue, Angular
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
        showToast(`Filled ${filledCount} fields (${account.label})!`, "success");
      } else {
        showToast("No standard login fields detected on this page.", "warning");
      }
    } catch (e) {
      console.error("[Tester Notepad] Autofill error:", e);
      showToast("Autofill failed: " + e.message, "error");
    }
  }

  // Toast Notification System inside Shadow DOM
  function showToast(message, type = "info") {
    const container = shadow.getElementById("tn-toast-container");
    if (!container) return;

    const toast = document.createElement("div");
    toast.className = `tn-toast tn-toast-${type}`;

    let icon = "✓";
    if (type === "error") icon = "✕";
    if (type === "warning") icon = "!";
    if (type === "info") icon = "ℹ";

    toast.innerHTML = `<span class="tn-toast-icon">${icon}</span><span class="tn-toast-msg">${escapeHtml(
      message
    )}</span>`;
    container.appendChild(toast);

    setTimeout(() => {
      toast.classList.add("tn-toast-hide");
      setTimeout(() => toast.remove(), 250);
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
      // 16 digits format: 3171 + 01 + DDMMYY + 0001
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

  // Build Encapsulated CSS
  function getStyles() {
    return `
      * {
        box-sizing: border-box;
        margin: 0;
        padding: 0;
        font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
      }

      /* Floating Button */
      .tn-trigger-btn {
        pointer-events: auto;
        position: fixed;
        bottom: 24px;
        right: 24px;
        width: 52px;
        height: 52px;
        border-radius: 50%;
        background: linear-gradient(135deg, #4f46e5 0%, #7c3aed 100%);
        border: 2px solid rgba(255, 255, 255, 0.25);
        box-shadow: 0 8px 24px -4px rgba(79, 70, 229, 0.55), 0 4px 12px 0 rgba(0, 0, 0, 0.2);
        display: flex;
        align-items: center;
        justify-content: center;
        cursor: pointer;
        z-index: 2147483647;
        transition: transform 0.2s cubic-bezier(0.16, 1, 0.3, 1), box-shadow 0.2s ease, opacity 0.2s;
        user-select: none;
      }
      .tn-trigger-btn:hover {
        transform: scale(1.08) translateY(-2px);
        box-shadow: 0 12px 28px -2px rgba(79, 70, 229, 0.7), 0 6px 16px 0 rgba(0, 0, 0, 0.25);
      }
      .tn-trigger-btn:active {
        transform: scale(0.96);
      }
      .tn-trigger-icon {
        width: 24px;
        height: 24px;
        color: #ffffff;
      }
      .tn-trigger-badge {
        position: absolute;
        top: -3px;
        right: -3px;
        background: #10b981;
        color: #ffffff;
        font-size: 10px;
        font-weight: 700;
        min-width: 18px;
        height: 18px;
        border-radius: 9px;
        display: flex;
        align-items: center;
        justify-content: center;
        padding: 0 4px;
        border: 2px solid #0f172a;
      }

      /* Backdrop */
      .tn-backdrop {
        pointer-events: auto;
        position: fixed;
        inset: 0;
        background: rgba(15, 23, 42, 0.3);
        backdrop-filter: blur(2px);
        z-index: 2147483646;
        opacity: 0;
        visibility: hidden;
        transition: opacity 0.25s ease, visibility 0.25s;
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
        background: #0f172a;
        color: #f1f5f9;
        box-shadow: -8px 0 32px rgba(0, 0, 0, 0.5), -1px 0 0 rgba(255, 255, 255, 0.1);
        z-index: 2147483647;
        display: flex;
        flex-direction: column;
        transform: translateX(100%);
        transition: transform 0.28s cubic-bezier(0.16, 1, 0.3, 1);
      }
      .tn-drawer.tn-open {
        transform: translateX(0);
      }

      /* Light Theme Override */
      .tn-theme-light .tn-drawer {
        background: #ffffff;
        color: #1e293b;
        box-shadow: -8px 0 32px rgba(0, 0, 0, 0.15), -1px 0 0 rgba(0, 0, 0, 0.08);
      }

      /* Header */
      .tn-header {
        display: flex;
        align-items: center;
        justify-content: space-between;
        padding: 14px 18px;
        background: #1e293b;
        border-bottom: 1px solid #334155;
      }
      .tn-theme-light .tn-header {
        background: #f8fafc;
        border-bottom: 1px solid #e2e8f0;
      }
      .tn-header-brand {
        display: flex;
        align-items: center;
        gap: 10px;
      }
      .tn-brand-icon {
        width: 28px;
        height: 28px;
        border-radius: 6px;
        background: linear-gradient(135deg, #4f46e5, #06b6d4);
        display: flex;
        align-items: center;
        justify-content: center;
        font-size: 14px;
        color: #fff;
      }
      .tn-brand-title {
        font-size: 15px;
        font-weight: 700;
        letter-spacing: -0.2px;
        display: flex;
        align-items: center;
        gap: 6px;
      }
      .tn-brand-tag {
        font-size: 10px;
        font-weight: 600;
        text-transform: uppercase;
        background: rgba(99, 102, 241, 0.2);
        color: #818cf8;
        padding: 2px 6px;
        border-radius: 4px;
      }
      .tn-header-actions {
        display: flex;
        align-items: center;
        gap: 6px;
      }
      .tn-icon-btn {
        background: transparent;
        border: none;
        color: #94a3b8;
        cursor: pointer;
        width: 28px;
        height: 28px;
        border-radius: 6px;
        display: flex;
        align-items: center;
        justify-content: center;
        transition: background 0.15s, color 0.15s;
      }
      .tn-icon-btn:hover {
        background: #334155;
        color: #ffffff;
      }
      .tn-theme-light .tn-icon-btn:hover {
        background: #e2e8f0;
        color: #0f172a;
      }
      .tn-icon-btn.tn-active {
        color: #818cf8;
        background: rgba(99, 102, 241, 0.2);
      }

      /* Tabs */
      .tn-tabs {
        display: flex;
        background: #172033;
        border-bottom: 1px solid #334155;
        padding: 0 8px;
      }
      .tn-theme-light .tn-tabs {
        background: #f1f5f9;
        border-bottom: 1px solid #e2e8f0;
      }
      .tn-tab {
        flex: 1;
        padding: 10px 4px;
        font-size: 12px;
        font-weight: 600;
        color: #94a3b8;
        background: transparent;
        border: none;
        border-bottom: 2px solid transparent;
        cursor: pointer;
        display: flex;
        align-items: center;
        justify-content: center;
        gap: 6px;
        transition: color 0.15s, border-color 0.15s;
      }
      .tn-tab:hover {
        color: #f8fafc;
      }
      .tn-theme-light .tn-tab:hover {
        color: #0f172a;
      }
      .tn-tab.tn-active {
        color: #818cf8;
        border-bottom-color: #818cf8;
      }

      /* Content Body */
      .tn-body {
        flex: 1;
        overflow-y: auto;
        padding: 16px;
        display: flex;
        flex-direction: column;
        gap: 14px;
      }
      .tn-body::-webkit-scrollbar {
        width: 6px;
      }
      .tn-body::-webkit-scrollbar-thumb {
        background: #334155;
        border-radius: 3px;
      }

      /* Search & Controls */
      .tn-toolbar {
        display: flex;
        gap: 8px;
        align-items: center;
      }
      .tn-search-box {
        flex: 1;
        position: relative;
      }
      .tn-search-input {
        width: 100%;
        background: #1e293b;
        border: 1px solid #334155;
        border-radius: 8px;
        color: #f8fafc;
        font-size: 13px;
        padding: 8px 12px 8px 32px;
        outline: none;
        transition: border-color 0.15s, box-shadow 0.15s;
      }
      .tn-theme-light .tn-search-input {
        background: #f8fafc;
        border-color: #cbd5e1;
        color: #0f172a;
      }
      .tn-search-input:focus {
        border-color: #6366f1;
        box-shadow: 0 0 0 2px rgba(99, 102, 241, 0.25);
      }
      .tn-search-icon {
        position: absolute;
        left: 10px;
        top: 50%;
        transform: translateY(-50%);
        color: #64748b;
        pointer-events: none;
      }
      .tn-btn-add {
        background: #4f46e5;
        color: #ffffff;
        border: none;
        border-radius: 8px;
        padding: 8px 12px;
        font-size: 12px;
        font-weight: 600;
        cursor: pointer;
        display: flex;
        align-items: center;
        gap: 4px;
        white-space: nowrap;
        transition: background 0.15s;
      }
      .tn-btn-add:hover {
        background: #4338ca;
      }

      /* Credential Cards */
      .tn-card-list {
        display: flex;
        flex-direction: column;
        gap: 12px;
      }
      .tn-card {
        background: #1e293b;
        border: 1px solid #334155;
        border-radius: 10px;
        padding: 12px;
        display: flex;
        flex-direction: column;
        gap: 10px;
        transition: transform 0.15s ease, border-color 0.15s ease;
      }
      .tn-theme-light .tn-card {
        background: #f8fafc;
        border: 1px solid #e2e8f0;
      }
      .tn-card:hover {
        border-color: #475569;
        transform: translateY(-1px);
      }
      .tn-card-header {
        display: flex;
        align-items: center;
        justify-content: space-between;
      }
      .tn-card-title-group {
        display: flex;
        align-items: center;
        gap: 8px;
      }
      .tn-card-label {
        font-size: 14px;
        font-weight: 700;
        color: #f8fafc;
      }
      .tn-theme-light .tn-card-label {
        color: #0f172a;
      }
      .tn-card-role {
        font-size: 10px;
        font-weight: 600;
        padding: 2px 6px;
        border-radius: 4px;
        background: rgba(16, 185, 129, 0.2);
        color: #34d399;
      }
      .tn-card-actions {
        display: flex;
        gap: 4px;
      }

      /* Field Row */
      .tn-field-row {
        background: #0f172a;
        border: 1px solid #334155;
        border-radius: 6px;
        padding: 6px 8px;
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 8px;
      }
      .tn-theme-light .tn-field-row {
        background: #ffffff;
        border: 1px solid #cbd5e1;
      }
      .tn-field-info {
        display: flex;
        flex-direction: column;
        overflow: hidden;
        flex: 1;
      }
      .tn-field-label {
        font-size: 10px;
        font-weight: 600;
        color: #64748b;
        text-transform: uppercase;
        letter-spacing: 0.4px;
      }
      .tn-field-value {
        font-size: 12px;
        font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
        color: #e2e8f0;
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
      }
      .tn-theme-light .tn-field-value {
        color: #1e293b;
      }
      .tn-field-buttons {
        display: flex;
        align-items: center;
        gap: 4px;
      }
      .tn-copy-btn {
        background: #334155;
        color: #e2e8f0;
        border: none;
        border-radius: 4px;
        padding: 4px 8px;
        font-size: 11px;
        font-weight: 600;
        cursor: pointer;
        display: flex;
        align-items: center;
        gap: 4px;
        transition: background 0.15s, color 0.15s;
      }
      .tn-theme-light .tn-copy-btn {
        background: #e2e8f0;
        color: #334155;
      }
      .tn-copy-btn:hover {
        background: #4f46e5;
        color: #ffffff;
      }
      .tn-copy-btn.tn-copied {
        background: #10b981 !important;
        color: #ffffff !important;
      }

      /* Card Footer & Autofill */
      .tn-card-footer {
        display: flex;
        align-items: center;
        justify-content: space-between;
        margin-top: 2px;
        gap: 8px;
      }
      .tn-card-note {
        font-size: 11px;
        color: #94a3b8;
        font-style: italic;
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
        flex: 1;
      }
      .tn-btn-autofill {
        background: rgba(99, 102, 241, 0.15);
        color: #a5b4fc;
        border: 1px solid rgba(99, 102, 241, 0.4);
        border-radius: 6px;
        padding: 4px 10px;
        font-size: 11px;
        font-weight: 600;
        cursor: pointer;
        display: flex;
        align-items: center;
        gap: 5px;
        transition: all 0.15s;
        white-space: nowrap;
      }
      .tn-btn-autofill:hover {
        background: #4f46e5;
        color: #ffffff;
        border-color: #4f46e5;
      }

      /* Form Inline Add/Edit */
      .tn-form-container {
        background: #1e293b;
        border: 1px solid #4f46e5;
        border-radius: 10px;
        padding: 14px;
        display: flex;
        flex-direction: column;
        gap: 10px;
      }
      .tn-theme-light .tn-form-container {
        background: #f8fafc;
        border-color: #6366f1;
      }
      .tn-form-title {
        font-size: 13px;
        font-weight: 700;
        color: #818cf8;
      }
      .tn-input-group {
        display: flex;
        flex-direction: column;
        gap: 4px;
      }
      .tn-input-label {
        font-size: 11px;
        color: #94a3b8;
        font-weight: 600;
      }
      .tn-text-input {
        background: #0f172a;
        border: 1px solid #334155;
        border-radius: 6px;
        color: #f8fafc;
        font-size: 12px;
        padding: 7px 10px;
        outline: none;
      }
      .tn-theme-light .tn-text-input {
        background: #ffffff;
        border-color: #cbd5e1;
        color: #0f172a;
      }
      .tn-text-input:focus {
        border-color: #6366f1;
      }
      .tn-form-actions {
        display: flex;
        justify-content: flex-end;
        gap: 8px;
        margin-top: 4px;
      }
      .tn-btn-cancel {
        background: transparent;
        color: #94a3b8;
        border: 1px solid #334155;
        border-radius: 6px;
        padding: 6px 12px;
        font-size: 12px;
        cursor: pointer;
      }
      .tn-btn-save {
        background: #4f46e5;
        color: #ffffff;
        border: none;
        border-radius: 6px;
        padding: 6px 14px;
        font-size: 12px;
        font-weight: 600;
        cursor: pointer;
      }

      /* Scratchpad Tab */
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
        min-height: 380px;
        background: #1e293b;
        border: 1px solid #334155;
        border-radius: 8px;
        color: #f8fafc;
        font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
        font-size: 12px;
        line-height: 1.5;
        padding: 12px;
        resize: none;
        outline: none;
      }
      .tn-theme-light .tn-scratchpad-input {
        background: #f8fafc;
        border-color: #cbd5e1;
        color: #0f172a;
      }
      .tn-scratchpad-input:focus {
        border-color: #6366f1;
      }
      .tn-scratchpad-toolbar {
        display: flex;
        justify-content: space-between;
        align-items: center;
      }
      .tn-scratchpad-info {
        font-size: 11px;
        color: #64748b;
      }
      .tn-scratchpad-actions {
        display: flex;
        gap: 8px;
      }

      /* Generators Tab */
      .tn-gen-grid {
        display: grid;
        grid-template-columns: 1fr;
        gap: 10px;
      }
      .tn-gen-item {
        background: #1e293b;
        border: 1px solid #334155;
        border-radius: 8px;
        padding: 10px 12px;
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 8px;
      }
      .tn-theme-light .tn-gen-item {
        background: #f8fafc;
        border-color: #e2e8f0;
      }
      .tn-gen-info {
        display: flex;
        flex-direction: column;
        gap: 2px;
      }
      .tn-gen-name {
        font-size: 13px;
        font-weight: 600;
        color: #f8fafc;
        display: flex;
        align-items: center;
        gap: 6px;
      }
      .tn-theme-light .tn-gen-name {
        color: #0f172a;
      }
      .tn-gen-desc {
        font-size: 11px;
        color: #64748b;
      }

      /* Settings Tab */
      .tn-settings-list {
        display: flex;
        flex-direction: column;
        gap: 14px;
      }
      .tn-settings-group {
        background: #1e293b;
        border: 1px solid #334155;
        border-radius: 8px;
        padding: 12px;
        display: flex;
        flex-direction: column;
        gap: 10px;
      }
      .tn-theme-light .tn-settings-group {
        background: #f8fafc;
        border-color: #e2e8f0;
      }
      .tn-settings-title {
        font-size: 12px;
        font-weight: 700;
        color: #818cf8;
        text-transform: uppercase;
        letter-spacing: 0.5px;
      }
      .tn-setting-row {
        display: flex;
        align-items: center;
        justify-content: space-between;
      }
      .tn-setting-label {
        font-size: 13px;
        color: #e2e8f0;
      }
      .tn-theme-light .tn-setting-label {
        color: #1e293b;
      }

      /* Toast Notification */
      #tn-toast-container {
        position: fixed;
        bottom: 24px;
        right: 410px;
        display: flex;
        flex-direction: column;
        gap: 8px;
        z-index: 2147483647;
        pointer-events: none;
      }
      .tn-toast {
        background: #1e293b;
        color: #ffffff;
        border-radius: 8px;
        padding: 8px 14px;
        font-size: 12px;
        font-weight: 600;
        box-shadow: 0 4px 16px rgba(0, 0, 0, 0.4);
        display: flex;
        align-items: center;
        gap: 8px;
        border-left: 4px solid #6366f1;
        animation: tnSlideIn 0.2s cubic-bezier(0.16, 1, 0.3, 1) forwards;
        transition: opacity 0.25s, transform 0.25s;
      }
      .tn-toast.tn-toast-success {
        border-left-color: #10b981;
      }
      .tn-toast.tn-toast-error {
        border-left-color: #ef4444;
      }
      .tn-toast.tn-toast-warning {
        border-left-color: #f59e0b;
      }
      .tn-toast-hide {
        opacity: 0;
        transform: translateY(10px);
      }
      @keyframes tnSlideIn {
        from {
          opacity: 0;
          transform: translateY(12px);
        }
        to {
          opacity: 1;
          transform: translateY(0);
        }
      }
    `;
  }

  // Render UI
  function render() {
    // If floating icon is disabled in settings, hide it unless drawer is open
    const isIconVisible = settings.floatingIconEnabled;
    const themeClass = settings.theme === "light" ? "tn-theme-light" : "tn-theme-dark";

    const filteredAccounts = accounts.filter((acc) => {
      if (!searchQuery.trim()) return true;
      const q = searchQuery.toLowerCase();
      return (
        acc.label.toLowerCase().includes(q) ||
        acc.email.toLowerCase().includes(q) ||
        (acc.role && acc.role.toLowerCase().includes(q)) ||
        (acc.note && acc.note.toLowerCase().includes(q))
      );
    });

    shadow.innerHTML = `
      <style>${getStyles()}</style>
      <div class="${themeClass}">
        <!-- Floating Action Button (Icon kecil di kanan bawah) -->
        ${
          isIconVisible
            ? `
          <div class="tn-trigger-btn" id="tn-trigger" title="Tester Notepad (Click or Alt+L / Alt+N)">
            <svg class="tn-trigger-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
              <polyline points="14 2 14 8 20 8"></polyline>
              <line x1="16" y1="13" x2="8" y2="13"></line>
              <line x1="16" y1="17" x2="8" y2="17"></line>
              <polyline points="10 9 9 9 8 9"></polyline>
            </svg>
            <div class="tn-trigger-badge">${accounts.length}</div>
          </div>
        `
            : ""
        }

        <!-- Backdrop -->
        <div class="tn-backdrop ${isDrawerOpen && !isPinned ? "tn-open" : ""}" id="tn-backdrop"></div>

        <!-- Slide-out Drawer Panel (Notepad di kanan layar) -->
        <div class="tn-drawer ${isDrawerOpen ? "tn-open" : ""}" id="tn-drawer">
          <!-- Drawer Header -->
          <div class="tn-header">
            <div class="tn-header-brand">
              <div class="tn-brand-icon">📝</div>
              <div>
                <div class="tn-brand-title">
                  Tester Notepad
                  <span class="tn-brand-tag">Web QA</span>
                </div>
              </div>
            </div>
            <div class="tn-header-actions">
              <button class="tn-icon-btn ${isPinned ? "tn-active" : ""}" id="tn-btn-pin" title="${
      isPinned ? "Unpin Drawer" : "Pin Drawer (Stay Open)"
    }">
                📌
              </button>
              <button class="tn-icon-btn" id="tn-btn-close" title="Close (Esc)">
                ✕
              </button>
            </div>
          </div>

          <!-- Navigation Tabs -->
          <div class="tn-tabs">
            <button class="tn-tab ${activeTab === "credentials" ? "tn-active" : ""}" data-tab="credentials">
              🔑 Credentials
            </button>
            <button class="tn-tab ${activeTab === "scratchpad" ? "tn-active" : ""}" data-tab="scratchpad">
              📝 Scratchpad
            </button>
            <button class="tn-tab ${activeTab === "generators" ? "tn-active" : ""}" data-tab="generators">
              ⚡ Generators
            </button>
            <button class="tn-tab ${activeTab === "settings" ? "tn-active" : ""}" data-tab="settings">
              ⚙️ Settings
            </button>
          </div>

          <!-- Content Body -->
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
        <!-- Toolbar & Search -->
        <div class="tn-toolbar">
          <div class="tn-search-box">
            <span class="tn-search-icon">🔍</span>
            <input 
              type="text" 
              class="tn-search-input" 
              id="tn-search-input" 
              placeholder="Search accounts, email, role..." 
              value="${escapeHtml(searchQuery)}"
            />
          </div>
          <button class="tn-btn-add" id="tn-btn-toggle-add">
            ${showAddForm ? "✕ Close" : "+ New"}
          </button>
        </div>

        <!-- Add / Edit Form -->
        ${
          showAddForm
            ? `
          <div class="tn-form-container" id="tn-account-form">
            <div class="tn-form-title">${editingAccountId ? "Edit Account" : "Add New Test Account"}</div>
            <div class="tn-input-group">
              <label class="tn-input-label">Account Label</label>
              <input type="text" class="tn-text-input" id="tn-form-label" placeholder="e.g. Superadmin, Buyer Test" value="${
                editingAccountId ? escapeHtml(accounts.find((a) => a.id === editingAccountId)?.label || "") : ""
              }" />
            </div>
            <div class="tn-input-group">
              <label class="tn-input-label">Email or Username</label>
              <input type="text" class="tn-text-input" id="tn-form-email" placeholder="e.g. admin@tester.local" value="${
                editingAccountId ? escapeHtml(accounts.find((a) => a.id === editingAccountId)?.email || "") : ""
              }" />
            </div>
            <div class="tn-input-group">
              <label class="tn-input-label">Password</label>
              <input type="text" class="tn-text-input" id="tn-form-password" placeholder="e.g. Secret123!" value="${
                editingAccountId ? escapeHtml(accounts.find((a) => a.id === editingAccountId)?.password || "") : ""
              }" />
            </div>
            <div class="tn-input-group">
              <label class="tn-input-label">Role / Tag</label>
              <input type="text" class="tn-text-input" id="tn-form-role" placeholder="e.g. Admin, Customer, QA" value="${
                editingAccountId ? escapeHtml(accounts.find((a) => a.id === editingAccountId)?.role || "") : ""
              }" />
            </div>
            <div class="tn-input-group">
              <label class="tn-input-label">Note (Optional)</label>
              <input type="text" class="tn-text-input" id="tn-form-note" placeholder="e.g. Bypassed 2FA, Wallet balance $500" value="${
                editingAccountId ? escapeHtml(accounts.find((a) => a.id === editingAccountId)?.note || "") : ""
              }" />
            </div>
            <div class="tn-form-actions">
              <button class="tn-btn-cancel" id="tn-form-cancel">Cancel</button>
              <button class="tn-btn-save" id="tn-form-save">Save Account</button>
            </div>
          </div>
        `
            : ""
        }

        <!-- Cards List -->
        <div class="tn-card-list">
          ${
            filteredAccounts.length === 0
              ? `<div style="text-align: center; color: #64748b; font-size: 13px; padding: 24px;">No test credentials found. Click '+ New' to add one.</div>`
              : filteredAccounts
                  .map((acc) => {
                    const isVisible = !!showPasswords[acc.id];
                    const maskedPassword = isVisible ? escapeHtml(acc.password) : "••••••••••••";
                    return `
              <div class="tn-card" data-account-id="${acc.id}">
                <div class="tn-card-header">
                  <div class="tn-card-title-group">
                    <span class="tn-card-label">${escapeHtml(acc.label)}</span>
                    ${acc.role ? `<span class="tn-card-role">${escapeHtml(acc.role)}</span>` : ""}
                  </div>
                  <div class="tn-card-actions">
                    <button class="tn-icon-btn tn-btn-edit-account" data-id="${acc.id}" title="Edit Account">✏️</button>
                    <button class="tn-icon-btn tn-btn-delete-account" data-id="${acc.id}" title="Delete Account">🗑️</button>
                  </div>
                </div>

                <!-- Email Row -->
                <div class="tn-field-row">
                  <div class="tn-field-info">
                    <span class="tn-field-label">Email / User</span>
                    <span class="tn-field-value" title="${escapeHtml(acc.email)}">${escapeHtml(acc.email)}</span>
                  </div>
                  <div class="tn-field-buttons">
                    <button class="tn-copy-btn tn-copy-email-btn" data-text="${escapeHtml(acc.email)}">
                      📋 Copy
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
                    <button class="tn-icon-btn tn-toggle-pass-btn" data-id="${acc.id}" title="${
                      isVisible ? "Hide Password" : "Show Password"
                    }">
                      ${isVisible ? "🙈" : "👁️"}
                    </button>
                    <button class="tn-copy-btn tn-copy-pass-btn" data-text="${escapeHtml(acc.password)}">
                      🔑 Copy
                    </button>
                  </div>
                </div>

                <!-- Footer & Autofill Action -->
                <div class="tn-card-footer">
                  <span class="tn-card-note" title="${escapeHtml(acc.note || "")}">${
                      acc.note ? `💡 ${escapeHtml(acc.note)}` : ""
                    }</span>
                  <button class="tn-btn-autofill" data-id="${acc.id}" title="Autofill inputs on this webpage">
                    🪄 Autofill
                  </button>
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
            <span class="tn-scratchpad-info">${lineCount} lines • ${charCount} chars • Auto-saved</span>
            <div class="tn-scratchpad-actions">
              <button class="tn-copy-btn" id="tn-btn-copy-notes">📋 Copy All</button>
              <button class="tn-btn-cancel" id="tn-btn-clear-notes" style="padding: 4px 8px; font-size: 11px;">🧹 Clear</button>
            </div>
          </div>
          <textarea 
            class="tn-scratchpad-input" 
            id="tn-scratchpad-input" 
            placeholder="Write temporary test data, tokens, OTPs, URLs, or bug repro notes here..."
          >${escapeHtml(scratchpad)}</textarea>
        </div>
      `;
    }

    if (activeTab === "generators") {
      return `
        <div class="tn-gen-grid">
          <div class="tn-gen-item">
            <div class="tn-gen-info">
              <span class="tn-gen-name">📧 Random Test Email</span>
              <span class="tn-gen-desc">tester.timestamp@testmail.local</span>
            </div>
            <button class="tn-copy-btn tn-gen-btn" data-gen="randomEmail">Copy</button>
          </div>

          <div class="tn-gen-item">
            <div class="tn-gen-info">
              <span class="tn-gen-name">🔐 Strong Password</span>
              <span class="tn-gen-desc">12 chars mixed with symbol & digits</span>
            </div>
            <button class="tn-copy-btn tn-gen-btn" data-gen="randomPassword">Copy</button>
          </div>

          <div class="tn-gen-item">
            <div class="tn-gen-info">
              <span class="tn-gen-name">📱 Indonesian Mobile Phone</span>
              <span class="tn-gen-desc">0812xxxxxxxx format</span>
            </div>
            <button class="tn-copy-btn tn-gen-btn" data-gen="randomPhone">Copy</button>
          </div>

          <div class="tn-gen-item">
            <div class="tn-gen-info">
              <span class="tn-gen-name">🆔 Dummy 16-Digit NIK / KTP</span>
              <span class="tn-gen-desc">Valid format standard numeric</span>
            </div>
            <button class="tn-copy-btn tn-gen-btn" data-gen="randomNIK">Copy</button>
          </div>

          <div class="tn-gen-item">
            <div class="tn-gen-info">
              <span class="tn-gen-name">💳 Test Visa Credit Card</span>
              <span class="tn-gen-desc">4242 4242 4242 4242</span>
            </div>
            <button class="tn-copy-btn tn-gen-btn" data-gen="randomCard">Copy</button>
          </div>

          <div class="tn-gen-item">
            <div class="tn-gen-info">
              <span class="tn-gen-name">🔢 UUID v4</span>
              <span class="tn-gen-desc">Standard 36-char unique identifier</span>
            </div>
            <button class="tn-copy-btn tn-gen-btn" data-gen="randomUUID">Copy</button>
          </div>

          <div class="tn-gen-item">
            <div class="tn-gen-info">
              <span class="tn-gen-name">📄 Lorem Ipsum Paragraph</span>
              <span class="tn-gen-desc">Standard dummy body text</span>
            </div>
            <button class="tn-copy-btn tn-gen-btn" data-gen="loremShort">Copy</button>
          </div>
        </div>
      `;
    }

    if (activeTab === "settings") {
      return `
        <div class="tn-settings-list">
          <div class="tn-settings-group">
            <div class="tn-settings-title">Display & Appearance</div>
            <div class="tn-setting-row">
              <span class="tn-setting-label">Show Floating Icon</span>
              <input type="checkbox" id="tn-set-icon-toggle" ${settings.floatingIconEnabled ? "checked" : ""} />
            </div>
            <div class="tn-setting-row">
              <span class="tn-setting-label">Theme</span>
              <select id="tn-set-theme" class="tn-text-input" style="padding: 4px 8px;">
                <option value="dark" ${settings.theme === "dark" ? "selected" : ""}>Dark Theme</option>
                <option value="light" ${settings.theme === "light" ? "selected" : ""}>Light Theme</option>
              </select>
            </div>
          </div>

          <div class="tn-settings-group">
            <div class="tn-settings-title">Data Backup & Restore</div>
            <button class="tn-copy-btn" id="tn-btn-export" style="justify-content: center; padding: 8px;">
              💾 Export All Data (JSON)
            </button>
            <label class="tn-copy-btn" style="justify-content: center; padding: 8px; cursor: pointer;">
              📂 Import Data (JSON)
              <input type="file" id="tn-input-import" accept=".json" style="display: none;" />
            </label>
            <button class="tn-btn-cancel" id="tn-btn-reset-data" style="margin-top: 4px; padding: 6px;">
              ⚠️ Reset to Default Demo Accounts
            </button>
          </div>

          <div class="tn-settings-group">
            <div class="tn-settings-title">Keyboard Shortcuts</div>
            <div style="font-size: 12px; color: #94a3b8; line-height: 1.6;">
              • <b>Alt + L</b> : Toggle Tester Notepad Drawer (atau <b>Alt + N</b>)<br/>
              • <b>Esc</b> : Close Drawer
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
        showToast(isPinned ? "Drawer pinned (stays open)" : "Drawer unpinned", "info");
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

    // Search Input
    const searchInput = shadow.getElementById("tn-search-input");
    if (searchInput) {
      searchInput.addEventListener("input", (e) => {
        searchQuery = e.target.value;
        const list = shadow.querySelector(".tn-card-list");
        if (list) {
          const filtered = accounts.filter((acc) => {
            if (!searchQuery.trim()) return true;
            const q = searchQuery.toLowerCase();
            return (
              acc.label.toLowerCase().includes(q) ||
              acc.email.toLowerCase().includes(q) ||
              (acc.role && acc.role.toLowerCase().includes(q)) ||
              (acc.note && acc.note.toLowerCase().includes(q))
            );
          });
          // re-render only the cards list
          const container = shadow.querySelector(".tn-body");
          if (container) {
            container.innerHTML = renderTabContent(filtered);
            bindEvents();
            // restore focus
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

    // Save Form
    const saveFormBtn = shadow.getElementById("tn-form-save");
    if (saveFormBtn) {
      saveFormBtn.addEventListener("click", async () => {
        const label = shadow.getElementById("tn-form-label").value.trim();
        const email = shadow.getElementById("tn-form-email").value.trim();
        const password = shadow.getElementById("tn-form-password").value.trim();
        const role = shadow.getElementById("tn-form-role").value.trim();
        const note = shadow.getElementById("tn-form-note").value.trim();

        if (!label || !email) {
          showToast("Label and Email are required!", "error");
          return;
        }

        if (editingAccountId) {
          const updated = accounts.map((a) => {
            if (a.id === editingAccountId) {
              return { ...a, label, email, password, role, note };
            }
            return a;
          });
          await saveAccounts(updated);
          showToast("Account updated!", "success");
        } else {
          const newAcc = {
            id: "acc_" + Date.now(),
            label,
            email,
            password,
            role,
            note
          };
          await saveAccounts([...accounts, newAcc]);
          showToast("Account added!", "success");
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
        copyToClipboard(text, "Email copied to clipboard!");
        e.currentTarget.classList.add("tn-copied");
        setTimeout(() => e.currentTarget.classList.remove("tn-copied"), 1000);
      });
    });

    // Copy Password
    shadow.querySelectorAll(".tn-copy-pass-btn").forEach((btn) => {
      btn.addEventListener("click", (e) => {
        const text = e.currentTarget.getAttribute("data-text");
        copyToClipboard(text, "Password copied to clipboard!");
        e.currentTarget.classList.add("tn-copied");
        setTimeout(() => e.currentTarget.classList.remove("tn-copied"), 1000);
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
        if (confirm("Delete this credential?")) {
          const updated = accounts.filter((a) => a.id !== id);
          await saveAccounts(updated);
          showToast("Credential deleted.", "info");
        }
      });
    });

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
          info.textContent = `${lineCount} lines • ${charCount} chars • Auto-saved`;
        }
      });
    }

    // Copy All Scratchpad Notes
    const copyNotesBtn = shadow.getElementById("tn-btn-copy-notes");
    if (copyNotesBtn) {
      copyNotesBtn.addEventListener("click", () => {
        copyToClipboard(scratchpad, "All scratchpad notes copied!");
      });
    }

    // Clear Scratchpad
    const clearNotesBtn = shadow.getElementById("tn-btn-clear-notes");
    if (clearNotesBtn) {
      clearNotesBtn.addEventListener("click", async () => {
        if (confirm("Clear all scratchpad text?")) {
          await saveScratchpad("");
          render();
          showToast("Scratchpad cleared.", "info");
        }
      });
    }

    // Dummy Generators
    shadow.querySelectorAll(".tn-gen-btn").forEach((btn) => {
      btn.addEventListener("click", (e) => {
        const genType = e.currentTarget.getAttribute("data-gen");
        if (DummyGenerators[genType]) {
          const val = DummyGenerators[genType]();
          copyToClipboard(val, `Generated & copied: ${val}`);
          e.currentTarget.classList.add("tn-copied");
          setTimeout(() => e.currentTarget.classList.remove("tn-copied"), 1000);
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
            : "Floating icon hidden (use Alt+L to open)",
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
        showToast("Backup exported successfully!", "success");
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
            if (Array.isArray(imported.accounts)) {
              await saveAccounts(imported.accounts);
            }
            if (typeof imported.scratchpad === "string") {
              await saveScratchpad(imported.scratchpad);
            }
            if (imported.settings) {
              await saveSettings(imported.settings);
            }
            showToast("Backup imported successfully!", "success");
            render();
          } catch (err) {
            showToast("Failed to parse JSON backup file.", "error");
          }
        };
        reader.readAsText(file);
      });
    }

    // Settings: Reset Data
    const resetBtn = shadow.getElementById("tn-btn-reset-data");
    if (resetBtn) {
      resetBtn.addEventListener("click", async () => {
        if (confirm("Reset accounts to initial demo credentials?")) {
          const DEFAULT_ACCOUNTS = [
            {
              id: "acc_1",
              label: "Super Admin",
              email: "admin@tester.local",
              password: "AdminSuperSecret2026!",
              role: "Admin",
              note: "Full platform permissions, bypassed 2FA"
            },
            {
              id: "acc_2",
              label: "Customer Standard",
              email: "customer.qa@testmail.com",
              password: "CustomerPass@1234",
              role: "Customer",
              note: "Verified customer account with dummy wallet"
            },
            {
              id: "acc_3",
              label: "QA Vendor / Seller",
              email: "vendor.merchant@staging.test",
              password: "Vendor#SecurePass99",
              role: "Merchant",
              note: "Seller account with 10 dummy catalog items"
            },
            {
              id: "acc_4",
              label: "Invalid / Locked User",
              email: "blocked.user@testmail.com",
              password: "WrongPassword999!",
              role: "Test Edge",
              note: "Test invalid credentials or account lockout"
            }
          ];
          await saveAccounts(DEFAULT_ACCOUNTS);
          showToast("Reset to defaults complete.", "info");
          render();
        }
      });
    }
  }

  // Global Keyboard Shortcuts
  window.addEventListener("keydown", (e) => {
    // Alt + L or Alt + N to toggle
    if (e.altKey && (e.key === "l" || e.key === "L" || e.key === "n" || e.key === "N")) {
      e.preventDefault();
      toggleDrawer();
    }
    // Escape to close if open and not pinned
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
