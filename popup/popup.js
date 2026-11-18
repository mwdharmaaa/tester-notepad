// Popup script - Forwarder to unified in-page drawer
document.addEventListener("DOMContentLoaded", async () => {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (tab?.id) {
    try {
      await chrome.tabs.sendMessage(tab.id, { action: "TOGGLE_DRAWER" });
      window.close();
      return;
    } catch (e) {
      // If content script was not loaded yet, background worker will handle it
    }
  }
});
