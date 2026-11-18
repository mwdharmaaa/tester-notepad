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
 * Unified Drawer Toggle
 * Dispatches TOGGLE_DRAWER directly to active tab. Never creates a new tab.
 */
async function toggleTabDrawer(tab) {
  if (!tab?.id) return;

  // Don't inject on internal restricted browser pages
  if (tab.url && (tab.url.startsWith("chrome://") || tab.url.startsWith("edge://") || tab.url.startsWith("about:"))) {
    console.warn("[Tester Notepad] Cannot toggle drawer on restricted browser pages:", tab.url);
    return;
  }

  try {
    const res = await chrome.tabs.sendMessage(tab.id, { action: "TOGGLE_DRAWER" });
    if (res?.status === "OK") return;
  } catch (err) {
    // Content script not ready on this tab yet (e.g. extension just reloaded or tab opened before extension)
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
      }, 100);
    } catch (injectErr) {
      console.warn("[Tester Notepad] Dynamic injection failed:", injectErr);
    }
  }
}

// 1. When extension icon in Chrome toolbar is clicked -> Toggle in-page drawer!
chrome.action.onClicked.addListener(async (tab) => {
  await toggleTabDrawer(tab);
});

// 2. When keyboard shortcut (Alt+L) is triggered -> Toggle in-page drawer!
chrome.commands.onCommand.addListener(async (command) => {
  if (command === "toggle_drawer") {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (tab) {
      await toggleTabDrawer(tab);
    }
  }
});

// Message listener
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.action === "PING") {
    sendResponse({ status: "PONG" });
    return true;
  }
});
