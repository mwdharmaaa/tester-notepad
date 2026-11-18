// Tester Notepad - Background Service Worker
// Manages initial data seeding, commands, tab messaging, and unified drawer invocation

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

const DEFAULT_NOTES = `=== WEB TESTER SCRATCHPAD ===
• Staging: https://staging.testapp.local
• Mock OTP: 738291
• Test Card: 4242 4242 4242 4242 (04/28, CVV: 123)
• Dummy NIK: 3171010101900001
• Notes: Check checkout flow with discount code TEST50
`;

const DEFAULT_SETTINGS = {
  floatingIconEnabled: true,
  theme: "dark",
  keepOpenOnCopy: true,
  autofillNotification: true
};

chrome.runtime.onInstalled.addListener(async (details) => {
  console.log("[Tester Notepad] Extension installed/updated:", details.reason);
  const data = await chrome.storage.local.get(["accounts", "scratchpad", "settings", "serverCodes"]);
  
  // Seed Server Codes (Always Top Tier)
  if (!data.serverCodes || !Array.isArray(data.serverCodes) || data.serverCodes.length === 0) {
    await chrome.storage.local.set({ serverCodes: DEFAULT_SERVERS });
  }

  // Seed Accounts
  if (!data.accounts || !Array.isArray(data.accounts) || data.accounts.length === 0) {
    await chrome.storage.local.set({ accounts: DEFAULT_ACCOUNTS });
  } else {
    const cleaned = data.accounts.map(a => ({
      id: a.id || "acc_" + Math.random().toString(36).substring(2, 6),
      email: a.email || a.label || "",
      password: a.password || ""
    }));
    await chrome.storage.local.set({ accounts: cleaned });
  }

  // Seed Notes & Settings
  if (typeof data.scratchpad !== "string") {
    await chrome.storage.local.set({ scratchpad: DEFAULT_NOTES });
  }
  if (!data.settings) {
    await chrome.storage.local.set({ settings: DEFAULT_SETTINGS });
  }
});

/**
 * Open or Focus Chrome Dashboard (New Tab)
 */
async function openOrFocusDashboard() {
  const newTabUrl = chrome.runtime.getURL("newtab/newtab.html");
  try {
    const tabs = await chrome.tabs.query({});
    const existing = tabs.find(t => t.url && t.url.startsWith(newTabUrl));
    if (existing && existing.id) {
      await chrome.tabs.update(existing.id, { active: true });
      if (existing.windowId) {
        await chrome.windows.update(existing.windowId, { focused: true });
      }
      setTimeout(() => {
        chrome.tabs.sendMessage(existing.id, { action: "TOGGLE_DRAWER" }).catch(() => {});
      }, 100);
      return;
    }
    const created = await chrome.tabs.create({ url: newTabUrl });
    if (created?.id) {
      setTimeout(() => {
        chrome.tabs.sendMessage(created.id, { action: "TOGGLE_DRAWER" }).catch(() => {});
      }, 300);
    }
  } catch (err) {
    console.error("[Tester Notepad] Failed to open newtab dashboard:", err);
  }
}

/**
 * Check if a URL is restricted from content script injection
 */
function isRestrictedUrl(url) {
  if (!url) return false;
  // Browser internal restricted pages (chrome://, edge://, about:)
  if (
    url.startsWith("chrome://") ||
    url.startsWith("edge://") ||
    url.startsWith("about:") ||
    url.startsWith("view-source:")
  ) {
    return true;
  }
  // Other extensions' internal pages, but NOT our own extension pages
  if (url.startsWith("chrome-extension://") && !url.startsWith(chrome.runtime.getURL(""))) {
    return true;
  }
  return false;
}

/**
 * Unified Drawer Toggle
 * Dispatches TOGGLE_DRAWER to active tab. If on restricted browser page,
 * opens the New Tab dashboard and toggles the drawer there.
 */
async function toggleTabDrawer(tab) {
  if (!tab?.id) {
    await openOrFocusDashboard();
    return;
  }

  // On restricted browser pages (like chrome://settings, chrome://extensions), open New Tab dashboard
  if (isRestrictedUrl(tab.url)) {
    await openOrFocusDashboard();
    return;
  }

  try {
    await chrome.tabs.sendMessage(tab.id, { action: "TOGGLE_DRAWER" });
  } catch (err) {
    // If content script is not yet injected, inject dynamically then toggle
    try {
      await chrome.scripting.insertCSS({
        target: { tabId: tab.id },
        files: ["content/content.css"]
      });
      await chrome.scripting.executeScript({
        target: { tabId: tab.id },
        files: ["content/content.js"]
      });
      setTimeout(() => {
        chrome.tabs.sendMessage(tab.id, { action: "TOGGLE_DRAWER" }).catch(() => {});
      }, 150);
    } catch (injectErr) {
      console.warn("[Tester Notepad] Dynamic injection failed, fallback to newtab:", injectErr);
      await openOrFocusDashboard();
    }
  }
}

// 1. When extension icon in Chrome toolbar is clicked -> Toggle drawer
chrome.action.onClicked.addListener(async (tab) => {
  await toggleTabDrawer(tab);
});

// 2. When keyboard shortcut (Alt+L) is triggered -> Toggle drawer
chrome.commands.onCommand.addListener(async (command) => {
  if (command === "toggle_drawer") {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (tab) {
      await toggleTabDrawer(tab);
    } else {
      await openOrFocusDashboard();
    }
  }
});

// 3. Message listener
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.action === "PING") {
    sendResponse({ status: "PONG" });
    return true;
  }

  if (message.action === "OPEN_DASHBOARD") {
    openOrFocusDashboard();
    sendResponse({ status: "OK" });
    return true;
  }
});
