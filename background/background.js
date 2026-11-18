// Tester Notepad - Background Service Worker
// Manages initial data seeding, commands, and tab messaging

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

const DEFAULT_NOTES = `=== WEB TESTER SCRATCHPAD ===
• Test Staging: https://staging.testapp.local
• Mock OTP: 738291
• Test Card: 4242 4242 4242 4242 (04/28, CVV: 123)
• Dummy NIK: 3171010101900001
• Notes: Check checkout flow with discount code TEST50
`;

const DEFAULT_SETTINGS = {
  floatingIconEnabled: true,
  theme: "dark", // "dark", "light", "cyber"
  keepOpenOnCopy: true,
  autofillNotification: true
};

chrome.runtime.onInstalled.addListener(async (details) => {
  console.log("[Tester Notepad] Extension installed:", details.reason);
  const data = await chrome.storage.local.get(["accounts", "scratchpad", "settings"]);
  
  if (!data.accounts || !Array.isArray(data.accounts) || data.accounts.length === 0) {
    await chrome.storage.local.set({ accounts: DEFAULT_ACCOUNTS });
  }
  if (typeof data.scratchpad !== "string") {
    await chrome.storage.local.set({ scratchpad: DEFAULT_NOTES });
  }
  if (!data.settings) {
    await chrome.storage.local.set({ settings: DEFAULT_SETTINGS });
  }
});

// Handle keyboard shortcut (e.g., Alt+N)
chrome.commands.onCommand.addListener(async (command) => {
  if (command === "toggle_drawer") {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (tab?.id) {
      chrome.tabs.sendMessage(tab.id, { action: "TOGGLE_DRAWER" }).catch(() => {
        // Tab might not have content script injected (e.g. chrome://)
      });
    }
  }
});

// Broadcast changes or listen for queries
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.action === "PING") {
    sendResponse({ status: "PONG" });
    return true;
  }
});
