// extension/content/main.js
chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
  if (msg.type === "ping") { sendResponse({ ok: true }); return false; }
  if (msg.type === "scrape") { sendResponse({ ok: true, posting: Workday.isPosting() ? Workday.scrape() : Generic.scrape() }); return false; }
  if (msg.type === "fill") { (Workday.isApplication() ? Workday.fill(msg.data) : Generic.fill(msg.data)).then(sendResponse); return true; }
  if (msg.type === "page_info") { sendResponse({ ok: true, info: Workday.pageInfo() }); return false; }
  if (msg.type === "advance") { sendResponse(Workday.advance()); return false; }
  if (msg.type === "form_fields") { Workday.formFields().then(fields => sendResponse({ ok: true, fields })); return true; }
  if (msg.type === "apply_answers") { Workday.applyAnswers(msg.answers).then(sendResponse); return true; }
  return false;
});
