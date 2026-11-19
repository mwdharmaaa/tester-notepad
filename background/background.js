// Tester Notepad - Background Service Worker
// Manages initial data seeding, commands, and in-page drawer toggling on the right

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

/**
 * Toggle In-Page Floating Drawer on Active Tab
 * - Strictly pinned to the right side of the screen (KANAN, right: 0).
 * - Non-blocking floating overlay on top of the web page (zero layout shift).
 * - Tapping anywhere else outside does NOT dismiss or hide the drawer.
 * - Toggled via Alt+L, toolbar icon click, or in-page trigger button.
 */
async function toggleActiveTabDrawer(tab) {
  if (!tab) {
    const [activeTab] = await chrome.tabs.query({ active: true, currentWindow: true });
    tab = activeTab;
  }
  if (!tab?.id) return;

  // Don't inject on restricted internal browser pages
  if (tab.url && (tab.url.startsWith("chrome://") || tab.url.startsWith("edge://") || tab.url.startsWith("about:"))) {
    console.warn("[Tester Notepad] Drawer operates on web pages. Restricted page:", tab.url);
    return;
  }

  // Attempt direct messaging to content script
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
    console.warn("[Tester Notepad] Dynamic injection failed:", injectErr);
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
