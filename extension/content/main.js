// extension/content/main.js
chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
  if (msg.type === "scrape") { sendResponse({ ok: true, posting: Workday.isPosting() ? Workday.scrape() : Generic.scrape() }); return false; }
  if (msg.type === "fill") { (Workday.isApplication() ? Workday.fill(msg.data) : Generic.fill(msg.data)).then(sendResponse); return true; }
  return false;
});
