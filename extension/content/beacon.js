// extension/content/beacon.js
// A small fixed pill on Workday pages that opens the side panel; sessionStorage remembers a dismissal.
(function () {
  if (window.top !== window) return;
  if (typeof chrome === "undefined" || !chrome.runtime || !chrome.runtime.getURL) return;
  try { if (sessionStorage.getItem("jobie-beacon-dismissed")) return; } catch (e) { /* sandboxed page: show anyway */ }
  // A pill left by a previous extension instance points at a dead runtime, so replace it.
  const stale = document.getElementById("jobie-beacon");
  if (stale) stale.remove();

  const host = document.createElement("div");
  host.id = "jobie-beacon";
  const shadow = host.attachShadow({ mode: "open" });
  shadow.innerHTML = `
    <style>
      :host { all: initial; position: fixed; right: 16px; bottom: 16px; z-index: 2147483647; }
      .pill { display: flex; align-items: center; gap: 8px; padding: 6px 10px 6px 6px; border-radius: 999px;
        background: #F5F6F3; color: #16191C; border: 1px solid #D8DCD5; box-shadow: 0 0 0 2px #1F5C3A, 0 6px 20px rgba(22,25,28,.18);
        font: 600 13px/1 system-ui, "Segoe UI", sans-serif; cursor: pointer; animation: rise 150ms ease-out; }
      .pill:hover { background: #FFFFFF; }
      .pill img { width: 28px; height: 28px; display: block; }
      .close { position: absolute; top: -8px; right: -8px; width: 20px; height: 20px; border-radius: 50%; border: 1px solid #D8DCD5;
        background: #FFFFFF; color: #5B6168; font: 500 13px/18px system-ui, "Segoe UI", sans-serif; cursor: pointer; padding: 0; }
      .close:hover { color: #16191C; }
      @keyframes rise { from { opacity: 0; transform: translateY(4px); } to { opacity: 1; transform: none; } }
      @media (prefers-reduced-motion: reduce) { .pill { animation: none; } }
      @media (prefers-color-scheme: dark) {
        .pill { background: #1B1E21; color: #E8EAE6; border-color: #2A2E31; box-shadow: 0 0 0 2px #6FBF8E, 0 6px 20px rgba(0,0,0,.4); }
        .pill:hover { background: #22262A; }
        .close { background: #1B1E21; color: #E8EAE6; border-color: #2A2E31; }
      }
    </style>
    <button type="button" class="pill" id="open" title="Open jobie-agent in the side panel">
      <img alt=""><span>jobie-agent</span>
    </button>
    <button type="button" class="close" id="close" title="Hide for this tab" aria-label="Hide jobie-agent button">x</button>`;
  shadow.querySelector("img").src = chrome.runtime.getURL("icons/icon-48.png");

  shadow.getElementById("open").addEventListener("click", () => {
    chrome.runtime.sendMessage({ type: "open_side_panel" }, () => void chrome.runtime.lastError);
  });
  shadow.getElementById("close").addEventListener("click", () => {
    try { sessionStorage.setItem("jobie-beacon-dismissed", "1"); } catch (e) { /* ignore */ }
    host.remove();
  });
  document.documentElement.appendChild(host);
})();
