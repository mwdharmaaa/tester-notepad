// Tester Notepad - Background Service Worker
// Manages initial data seeding, commands, tab messaging, and right-side floating drawer toggling

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

  // Auto-sync open extension tabs and live web pages
  await syncExtensionTabs();
  await injectIntoExistingWebTabs();
});

/**
 * Automatically refresh any stale extension tabs (e.g. test_page.html) so they pick up latest scripts
 */
async function syncExtensionTabs() {
  try {
    const extBaseUrl = chrome.runtime.getURL("");
    const tabs = await chrome.tabs.query({});
    for (const tab of tabs) {
      if (tab.url && tab.url.startsWith(extBaseUrl)) {
        await chrome.tabs.reload(tab.id);
      }
    }
  } catch (_) {}
}

/**
 * Automatically inject content engine into already open web tabs on extension start/update
 */
async function injectIntoExistingWebTabs() {
  try {
    const tabs = await chrome.tabs.query({ url: ["http://*/*", "https://*/*", "file:///*"] });
    for (const tab of tabs) {
      try {
        await chrome.scripting.insertCSS({
          target: { tabId: tab.id },
          files: ["content/content.css"]
        });
        await chrome.scripting.executeScript({
          target: { tabId: tab.id },
          files: ["content/content.js"]
        });
      } catch (_) {}
    }
  } catch (_) {}
}

// Run initial sync on service worker startup
syncExtensionTabs();
injectIntoExistingWebTabs();

/**
 * Robust active tab resolver for MV3 service workers across Wayland/GNOME
 */
async function getActiveTab(preferredTab) {
  if (preferredTab?.id) return preferredTab;
  try {
    const [focused] = await chrome.tabs.query({ active: true, lastFocusedWindow: true });
    if (focused?.id) return focused;
  } catch (_) {}
  try {
    const [current] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (current?.id) return current;
  } catch (_) {}
  try {
    const [anyActive] = await chrome.tabs.query({ active: true });
    if (anyActive?.id) return anyActive;
  } catch (_) {}
  return null;
}

/**
 * Check if a URL cannot have content scripts injected by browser security
 */
function isRestrictedUrl(url) {
  if (!url) return true;
  if (
    url.startsWith("chrome://") ||
    url.startsWith("edge://") ||
    url.startsWith("about:") ||
    url.startsWith("view-source:") ||
    url.startsWith("https://chrome.google.com/webstore") ||
    url.startsWith("https://chromewebstore.google.com")
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
 * Ensure content script is actively ready on tab
 */
async function ensureInjected(tabId) {
  try {
    const ping = await chrome.tabs.sendMessage(tabId, { action: "PING" });
    if (ping?.status === "PONG") return true;
  } catch (_) {}

  try {
    await chrome.scripting.insertCSS({
      target: { tabId },
      files: ["content/content.css"]
    });
    await chrome.scripting.executeScript({
      target: { tabId },
      files: ["content/content.js"]
    });
    return true;
  } catch (err) {
    console.warn("[Tester Notepad] Injection failed on tab:", tabId, err);
    return false;
  }
}

/**
 * Toggle In-Page Floating Drawer on Active Tab
 * - Strictly pinned to the right side of the screen (KANAN, right: 0).
 * - Non-blocking floating overlay on top of the web page (zero layout shift).
 * - Tapping anywhere else outside does NOT dismiss or hide the drawer.
 * - Toggled via Alt+L, toolbar icon click, or in-page trigger button.
 * - NEVER creates new tabs. NEVER redirects tabs.
 */
async function toggleActiveTabDrawer(preferredTab) {
  const tab = await getActiveTab(preferredTab);
  if (!tab?.id) return;

  // 1. If our own extension tab (e.g. test_page.html)
  if (tab.url && tab.url.startsWith(chrome.runtime.getURL(""))) {
    try {
      const res = await chrome.tabs.sendMessage(tab.id, { action: "TOGGLE_DRAWER" });
      if (res?.status === "OK") return;
    } catch (_) {
      // Stale tab lacking the injected script -> reload it so it picks up the latest DOM
      await chrome.tabs.reload(tab.id);
      return;
    }
    return;
  }

  // 2. On restricted browser pages where Chrome blocks content scripts (chrome://, etc.)
  if (isRestrictedUrl(tab.url)) {
    try {
      await chrome.action.setBadgeText({ tabId: tab.id, text: "WEB" });
      await chrome.action.setBadgeBackgroundColor({ tabId: tab.id, color: "#e11d48" });
      await chrome.action.setTitle({
        tabId: tab.id,
        title: "Tester Notepad: Buka di halaman web (http/https) untuk mengambang di kanan"
      });
      setTimeout(() => {
        chrome.action.setBadgeText({ tabId: tab.id, text: "" }).catch(() => {});
      }, 3500);
    } catch (_) {}
    return;
  }

  // 3. Normal Web Page (http://, https://, file://)
  const ready = await ensureInjected(tab.id);
  if (ready) {
    await chrome.tabs.sendMessage(tab.id, { action: "TOGGLE_DRAWER" }).catch(() => {});
  }
}

// 1. Keyboard Shortcut (Alt+L) Trigger -> Toggle in-page drawer on the right
chrome.commands.onCommand.addListener(async (command) => {
  if (command === "toggle_drawer" || command === "_execute_action") {
    await toggleActiveTabDrawer();
  }
});

// 2. Toolbar Icon Click Trigger -> Toggle in-page drawer on the right
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
