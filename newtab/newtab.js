/**
 * Chrome New Tab Dashboard Controller
 * Handles Google Search and direct URL navigation for the authentic Chrome dashboard
 */

document.addEventListener("DOMContentLoaded", () => {
  const form = document.getElementById("chrome-search-form");
  const input = document.getElementById("search-input");
  const extLink = document.getElementById("link-chrome-extensions");
  const customizeBtn = document.getElementById("btn-customize-chrome");

  if (form && input) {
    form.addEventListener("submit", (e) => {
      e.preventDefault();
      const raw = input.value.trim();
      if (!raw) return;

      const isUrl = /^https?:\/\//i.test(raw);
      const isLocalhost = /^localhost(:\d+)?/i.test(raw) || /^127\.0\.0\.1(:\d+)?/.test(raw);
      const isIpWithPort = /^\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}(:\d+)?/.test(raw);
      const isDomain = !raw.includes(" ") && raw.includes(".") && !raw.startsWith(".");

      if (isUrl) {
        window.location.href = raw;
      } else if (isLocalhost || isIpWithPort) {
        window.location.href = "http://" + raw;
      } else if (isDomain) {
        window.location.href = "https://" + raw;
      } else {
        window.location.href = "https://www.google.com/search?q=" + encodeURIComponent(raw);
      }
    });
  }

  if (extLink) {
    extLink.addEventListener("click", (e) => {
      e.preventDefault();
      if (chrome.tabs && chrome.tabs.create) {
        chrome.tabs.create({ url: "chrome://extensions" });
      } else {
        window.location.href = "chrome://extensions";
      }
    });
  }

  if (customizeBtn) {
    customizeBtn.addEventListener("click", () => {
      // Toggle the Tester Notepad drawer directly
      const [tabId] = [null];
      window.dispatchEvent(
        new KeyboardEvent("keydown", {
          key: "l",
          altKey: true,
          bubbles: true
        })
      );
    });
  }
});
