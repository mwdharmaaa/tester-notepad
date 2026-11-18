// Popup script - Forwarder to unified in-page drawer or Chrome Dashboard
document.addEventListener("DOMContentLoaded", async () => {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (tab?.id) {
    if (tab.url && (tab.url.startsWith("chrome://") || tab.url.startsWith("edge://") || tab.url.startsWith("about:"))) {
      chrome.runtime.sendMessage({ action: "OPEN_DASHBOARD" });
      window.close();
      return;
    }
    try {
      await chrome.tabs.sendMessage(tab.id, { action: "TOGGLE_DRAWER" });
      window.close();
      return;
    } catch (e) {
      chrome.runtime.sendMessage({ action: "OPEN_DASHBOARD" });
      window.close();
    }
  } else {
    chrome.runtime.sendMessage({ action: "OPEN_DASHBOARD" });
    window.close();
  }
});
