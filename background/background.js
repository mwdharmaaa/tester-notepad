// Tester Notepad - Background Service Worker
// Manages initial data seeding, commands, and dedicated floating window lifecycle

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

// Floating Window ID tracker
let floatingWindowId = null;
let activeFloatingPort = null;

// Track port connection from floating window
chrome.runtime.onConnect.addListener((port) => {
  if (port.name === "tester-notepad-floating" || port.name === "tester-notepad-sidepanel") {
    activeFloatingPort = port;
    port.onMessage.addListener((msg) => {
      if (msg?.type === "FLOATING_MOUNTED" && msg.windowId) {
        floatingWindowId = msg.windowId;
      }
    });
    port.onDisconnect.addListener(() => {
      if (activeFloatingPort === port) {
        activeFloatingPort = null;
      }
    });
  }
});

// Track when window is closed by user (via OS close button)
chrome.windows.onRemoved.addListener((closedWinId) => {
  if (closedWinId === floatingWindowId) {
    floatingWindowId = null;
    activeFloatingPort = null;
  }
});

/**
 * Toggle Floating Notepad Window
 * Creates a dedicated minimal popup window that floats ON TOP of Chrome.
 * - Chrome layer is below, extension layer is on top.
 * - DOES NOT shrink, squeeze, or shift ("bukan ngegeser") the Chrome page.
 * - Works 100% reliably on Chrome New Tab (dashboard) and all websites.
 * - Non-blocking to the underlying browser.
 */
async function toggleFloatingNotepad() {
  // 1. If window is already tracked, close it (Toggle OFF)
  if (floatingWindowId !== null) {
    try {
      const existing = await chrome.windows.get(floatingWindowId);
      if (existing) {
        if (activeFloatingPort) {
          try {
            activeFloatingPort.postMessage({ action: "CLOSE_WINDOW" });
          } catch (_) {}
        }
        await chrome.windows.remove(floatingWindowId);
        floatingWindowId = null;
        activeFloatingPort = null;
        return;
      }
    } catch (_) {
      floatingWindowId = null;
      activeFloatingPort = null;
    }
  }

  // 2. Also search if any open window contains floating.html
  try {
    const allWins = await chrome.windows.getAll({ populate: true });
    for (const win of allWins) {
      if (win.type === "popup" && win.tabs) {
        const hasOurTab = win.tabs.some(
          (t) => t.url && (t.url.includes("floating/floating.html") || t.url.includes("sidepanel/sidepanel.html"))
        );
        if (hasOurTab) {
          await chrome.windows.remove(win.id);
          floatingWindowId = null;
          activeFloatingPort = null;
          return;
        }
      }
    }
  } catch (_) {}

  // 3. Toggle ON: Create new floating window positioned on top of Chrome
  const width = 420;
  let height = 750;
  let top = 40;
  let left = 1200;

  try {
    const currentWin = await chrome.windows.getLastFocused();
    if (currentWin && currentWin.width && currentWin.height) {
      height = Math.max(500, currentWin.height - 50);
      top = Math.max(0, (currentWin.top || 0) + 30);
      left = Math.max(0, (currentWin.left || 0) + currentWin.width - width - 20);
    }
  } catch (err) {
    console.warn("[Tester Notepad] Could not query focused window:", err);
  }

  try {
    const createdWin = await chrome.windows.create({
      url: chrome.runtime.getURL("floating/floating.html"),
      type: "popup",
      width: width,
      height: height,
      left: left,
      top: top,
      focused: true
    });
    floatingWindowId = createdWin.id;
  } catch (err) {
    console.error("[Tester Notepad] Error opening floating window:", err);
  }
}

// 1. Keyboard Shortcut (Alt+L) Trigger
chrome.commands.onCommand.addListener(async (command) => {
  if (command === "toggle_drawer" || command === "_execute_action") {
    await toggleFloatingNotepad();
  }
});

// 2. Toolbar Icon Click Trigger
chrome.action.onClicked.addListener(async () => {
  await toggleFloatingNotepad();
});

// 3. Message Listener from Content Script or Floating Window
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.action === "TOGGLE_FLOATING_NOTEPAD" || message.action === "TOGGLE_DRAWER") {
    toggleFloatingNotepad().then(() => sendResponse({ status: "OK" }));
    return true;
  }
  if (message.action === "PING") {
    sendResponse({ status: "PONG" });
    return true;
  }
  if (message.action === "CLOSE_FLOATING") {
    if (floatingWindowId !== null) {
      chrome.windows.remove(floatingWindowId).catch(() => {});
      floatingWindowId = null;
    }
    sendResponse({ status: "OK" });
    return true;
  }
});
