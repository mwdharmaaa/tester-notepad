// Tester Notepad - Background Service Worker
// Manages data seeding, commands, in-page drawer toggling, and internal page fallback

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
    const cleaned = data.accounts.map((a) => ({
      id: a.id,
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

let floatingPopupWinId = null;

// Track when popup window is closed
chrome.windows.onRemoved.addListener((closedId) => {
  if (closedId === floatingPopupWinId) {
    floatingPopupWinId = null;
  }
});

/**
 * Fallback Floating Window for internal restricted pages (chrome://newtab, etc.)
 * where Chrome prohibits content script injection.
 */
async function toggleFloatingPopup() {
  if (floatingPopupWinId !== null) {
    try {
      const existing = await chrome.windows.get(floatingPopupWinId);
      if (existing) {
        await chrome.windows.remove(floatingPopupWinId);
        floatingPopupWinId = null;
        return;
      }
    } catch (_) {
      floatingPopupWinId = null;
    }
  }

  // Check if any window with floating.html is open
  try {
    const wins = await chrome.windows.getAll({ populate: true });
    for (const w of wins) {
      if (w.tabs && w.tabs.some((t) => t.url && t.url.includes("floating/floating.html"))) {
        await chrome.windows.remove(w.id);
        floatingPopupWinId = null;
        return;
      }
    }
  } catch (_) {}

  // Open right-docked minimal popup window
  const width = 420;
  let height = 750;
  let top = 40;
  let left = 1200;

  try {
    const cur = await chrome.windows.getLastFocused();
    if (cur && cur.width && cur.height) {
      height = Math.max(500, cur.height - 50);
      top = Math.max(0, (cur.top || 0) + 30);
      left = Math.max(0, (cur.left || 0) + cur.width - width - 20);
    }
  } catch (_) {}

  try {
    const newWin = await chrome.windows.create({
      url: chrome.runtime.getURL("floating/floating.html"),
      type: "popup",
      width,
      height,
      left,
      top,
      focused: true
    });
    floatingPopupWinId = newWin.id;
  } catch (err) {
    console.error("[Tester Notepad] Error opening popup fallback:", err);
  }
}

/**
 * Toggle In-Page Floating Drawer on Active Tab
 * - Pinned to the right side of the screen (right: 0).
 * - Non-blocking overlay (DOES NOT shift or squeeze the webpage).
 * - Clicking or typing anywhere outside the drawer DOES NOT close it.
 * - Only toggled via Alt+L or clicking the extension icon.
 */
async function toggleActiveTabDrawer(tab) {
  if (!tab) {
    const [activeTab] = await chrome.tabs.query({ active: true, currentWindow: true });
    tab = activeTab;
  }
  if (!tab?.id) return;

  const isInternalPage = !tab.url ||
    tab.url.startsWith("chrome://") ||
    tab.url.startsWith("edge://") ||
    tab.url.startsWith("about:") ||
    tab.url.startsWith("chrome-extension://");

  if (isInternalPage) {
    // Internal restricted pages where Chrome security blocks content scripts
    await toggleFloatingPopup();
    return;
  }

  // Normal Web Page: Attempt direct messaging first
  try {
    const ping = await chrome.tabs.sendMessage(tab.id, { action: "PING" });
    if (ping?.status === "PONG") {
      await chrome.tabs.sendMessage(tab.id, { action: "TOGGLE_DRAWER" });
      return;
    }
  } catch (_) {
    // Content script not ready yet, proceed to inject
  }

  try {
    await chrome.scripting.insertCSS({
      target: { tabId: tab.id },
      files: ["content/content.css"]
    });
    await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      files: ["content/content.js"]
    });
    setTimeout(async () => {
      try {
        await chrome.tabs.sendMessage(tab.id, { action: "TOGGLE_DRAWER" });
      } catch (_) {}
    }, 60);
  } catch (injectErr) {
    console.warn("[Tester Notepad] Injection failed, falling back to popup window:", injectErr);
    await toggleFloatingPopup();
  }
}

// 1. Keyboard Shortcut (Alt+L) Trigger
chrome.commands.onCommand.addListener(async (command) => {
  if (command === "toggle_drawer" || command === "_execute_action") {
    await toggleActiveTabDrawer();
  }
});

// 2. Toolbar Icon Click Trigger
chrome.action.onClicked.addListener(async (tab) => {
  await toggleActiveTabDrawer(tab);
});

// 3. Message Listener
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.action === "TOGGLE_DRAWER") {
    toggleActiveTabDrawer().then(() => sendResponse({ status: "OK" }));
    return true;
  }
  if (message.action === "PING") {
    sendResponse({ status: "PONG" });
    return true;
  }
});
