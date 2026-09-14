// extension/sidepanel.js
const SERVER = "http://127.0.0.1:8765";
const MODEL_DEFAULTS = {
  bedrock: "global.anthropic.claude-sonnet-4-6",
  anthropic: "claude-sonnet-5",
  openai: "gpt-4o"
};

let lastCvPdfPath = "";
let lastLetterPdfPath = "";
let lastPostingUrl = "";
let lastTailoredUrl = "";
let runStopped = false;
const MAX_PAGES = 8;
const PAGE_CHANGE_TIMEOUT_MS = 20000;

function $(id) { return document.getElementById(id); }

function setShaderSpeed(speed) {
  document.dispatchEvent(new CustomEvent("jobie:shader", { detail: { speed } }));
}

function showStatus(msg) {
  const el = $("status");
  el.textContent = msg;
  el.hidden = false;
}

function clearStatus() {
  const el = $("status");
  el.textContent = "";
  el.hidden = true;
}

function detailOf(resp) {
  if (resp && resp.data && resp.data.detail) return resp.data.detail;
  if (resp && resp.error) return resp.error;
  return "status " + (resp ? resp.status : "unknown");
}

function sendToBg(msg) {
  return new Promise(resolve => {
    chrome.runtime.sendMessage(msg, resp => {
      if (chrome.runtime.lastError) { resolve({ ok: false, status: 0, data: { detail: chrome.runtime.lastError.message } }); return; }
      resolve(resp);
    });
  });
}

async function getActiveTab() {
  const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
  return tabs[0];
}

function sendToTab(tabId, msg) {
  return new Promise(resolve => {
    chrome.tabs.sendMessage(tabId, msg, resp => {
      if (chrome.runtime.lastError) { resolve({ ok: false, error: chrome.runtime.lastError.message }); return; }
      resolve(resp);
    });
  });
}

// Manifest content scripts only run at page load; a tab opened before an extension reload has none, so inject on demand.
async function ensureContentScript(tabId) {
  const ping = await sendToTab(tabId, { type: "ping" });
  if (ping && ping.ok) return null;
  const files = chrome.runtime.getManifest().content_scripts[0].js;
  try { await chrome.scripting.executeScript({ target: { tabId }, files }); return null; }
  catch (e) { return e.message; }
}

function fileToBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result.split(",")[1]);
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });
}

async function checkServer() {
  const resp = await sendToBg({ type: "api", method: "GET", path: "/health" });
  const el = $("server-status");
  if (resp && resp.ok) el.textContent = "Server: online " + (resp.data.version || "");
  else el.textContent = "Server: offline, run python -m uvicorn server.app:app --port 8765";
}

function applySettings(settings) {
  $("provider").value = settings.name || "bedrock";
  $("api-key").value = settings.api_key || "";
  $("model-id").value = settings.model_id || "";
  $("region").value = settings.region || "";
  updateModelPlaceholder();
}

function updateModelPlaceholder() {
  $("model-id").placeholder = MODEL_DEFAULTS[$("provider").value] || "";
}

async function saveSettings() {
  const settings = { name: $("provider").value, api_key: $("api-key").value, model_id: $("model-id").value, region: $("region").value };
  await chrome.storage.local.set({ settings });
}

function collectProfile() {
  return {
    first_name: $("first-name").value, last_name: $("last-name").value, email: $("email").value,
    phone: $("phone").value, country: $("country").value, city: $("city").value, linkedin: $("linkedin").value,
    notes: $("notes").value
  };
}

function providerOf(settings) {
  return { name: settings.name || "bedrock", api_key: settings.api_key || "", model_id: settings.model_id || "", region: settings.region || "" };
}

function applyProfile(profile) {
  $("first-name").value = profile.first_name || "";
  $("last-name").value = profile.last_name || "";
  $("email").value = profile.email || "";
  $("phone").value = profile.phone || "";
  $("country").value = profile.country || "";
  $("city").value = profile.city || "";
  $("linkedin").value = profile.linkedin || "";
  $("notes").value = profile.notes || "";
}

async function saveProfile() {
  await chrome.storage.local.set({ profile: collectProfile() });
}

function updateCvInfo(text) {
  $("cv-info").textContent = text ? text.length + " characters loaded." : "No CV loaded.";
}

async function onCvFile(e) {
  clearStatus();
  const file = e.target.files[0];
  if (!file) return;
  const b64 = await fileToBase64(file);
  const resp = await sendToBg({ type: "cv_parse", b64, name: file.name });
  if (!resp.ok) { showStatus("CV parse failed: " + detailOf(resp)); return; }
  const text = resp.data.text || "";
  await chrome.storage.local.set({ cv_text: text, cv_file: { name: file.name, b64 } });
  updateCvInfo(text);
}

function updatePostingSummary() {
  const title = $("posting-title").value;
  const el = $("posting-summary");
  if (!title) { el.hidden = true; el.textContent = ""; return; }
  el.textContent = [title, $("posting-company").value, $("posting-location").value].filter(Boolean).join(" · ");
  el.hidden = false;
}

async function onReadPosting() {
  clearStatus();
  const tab = await getActiveTab();
  const injectError = await ensureContentScript(tab.id);
  if (injectError) { showStatus("Could not reach this page: " + injectError); return; }
  const resp = await sendToTab(tab.id, { type: "scrape" });
  if (!resp || !resp.ok) { showStatus("Could not read this page: " + detailOf(resp)); return; }
  const p = resp.posting || {};
  $("posting-title").value = p.title || "";
  $("posting-company").value = p.company || "";
  $("posting-location").value = p.location || "";
  $("posting-description").value = p.description || "";
  lastPostingUrl = p.url || tab.url || "";
  updatePostingSummary();
}

// One line when the agent is done. The per-check rows were noise to the applicant; the server still returns every round.
function renderRounds(rounds) {
  const container = $("rounds");
  container.textContent = "";
  if (!rounds || !rounds.length) return;
  const selfChecks = rounds.filter(r => r.source === "agent").length;
  const loops = rounds.filter(r => r.source === "loop");
  const left = loops.length ? loops[loops.length - 1].findings.length : 0;
  const checks = selfChecks + (selfChecks === 1 ? " self-check" : " self-checks");
  const line = document.createElement("div");
  line.className = "round";
  line.dataset.result = left ? "caught" : "clean";
  line.textContent = left
    ? "Finished with " + left + " findings left after " + loops.length + " rounds. Read the letter with care."
    : "Finished. " + checks + ", final pass clean.";
  container.appendChild(line);
}

function renderList(id, items) {
  const ul = $(id);
  ul.textContent = "";
  (items || []).forEach(item => {
    const li = document.createElement("li");
    li.textContent = item;
    ul.appendChild(li);
  });
}

const TAILOR_LABEL = "Tailor CV and write letter";
let tailorTicker = null;

function formatElapsed(seconds) {
  return Math.floor(seconds / 60) + ":" + String(seconds % 60).padStart(2, "0");
}

// One request and no progress events from the server, so the clock is the only honest live signal.
function startTailorProgress() {
  const el = $("tailor-progress");
  const started = Date.now();
  const tick = () => {
    const s = Math.floor((Date.now() - started) / 1000);
    el.textContent = formatElapsed(s) + " elapsed. Drafting the letter and CV, then checking both for AI-writing patterns.";
  };
  tick();
  el.hidden = false;
  tailorTicker = setInterval(tick, 1000);
}

function stopTailorProgress() {
  clearInterval(tailorTicker);
  tailorTicker = null;
  const el = $("tailor-progress");
  el.hidden = true;
  el.textContent = "";
}

// The previous run's output stays on screen otherwise, which reads as "the button did nothing".
async function clearTailorOutput() {
  renderRounds([]);
  $("cv-markdown").value = "";
  renderList("changes-list", []);
  renderList("gaps-list", []);
  applyTailored({});
  await chrome.storage.session.remove("tailored");
}

async function onTailor() {
  clearStatus();
  const store = await chrome.storage.local.get(["settings", "cv_text"]);
  if (!store.cv_text) {
    showStatus("No CV loaded. Upload your CV under 1 Set up once, then click Tailor again.");
    await openSetup();
    return false;
  }
  const settings = store.settings || {};
  const body = {
    posting: {
      title: $("posting-title").value, company: $("posting-company").value,
      location: $("posting-location").value, description: $("posting-description").value, url: lastPostingUrl
    },
    cv_text: store.cv_text,
    provider: providerOf(settings)
  };
  const btn = $("tailor-btn");
  btn.disabled = true;
  btn.classList.add("is-running");
  btn.textContent = "Tailoring, 30 to 90 seconds";
  await clearTailorOutput();
  startTailorProgress();
  setShaderSpeed(0.8);
  try {
    const resp = await sendToBg({ type: "api", method: "POST", path: "/tailor", body });
    if (!resp.ok) { showStatus("Tailor failed: " + detailOf(resp)); return false; }
    const data = resp.data;
    renderRounds(data.rounds);
    $("cv-markdown").value = data.cv_markdown || "";
    renderList("changes-list", data.changes);
    renderList("gaps-list", data.gaps);
    const tailored = { cv_pdf: data.cv_pdf || "", letter_pdf: data.letter_pdf || "", cover_letter: data.cover_letter || "", posting_url: lastPostingUrl };
    applyTailored(tailored);
    $("output-details").open = true;
    // session storage so the result survives the panel closing while the user signs in and clicks Apply
    await chrome.storage.session.set({ tailored });
    return true;
  } finally {
    stopTailorProgress();
    btn.disabled = false;
    btn.classList.remove("is-running");
    btn.textContent = TAILOR_LABEL;
    setShaderSpeed(0.25);
  }
}

function applyTailored(t) {
  lastCvPdfPath = t.cv_pdf || "";
  lastLetterPdfPath = t.letter_pdf || "";
  lastTailoredUrl = t.posting_url || "";
  lastPostingUrl = lastPostingUrl || lastTailoredUrl;
  $("letter-text").value = t.cover_letter || "";
  const cvLink = $("cv-pdf-link"), letterLink = $("letter-pdf-link");
  cvLink.href = SERVER + lastCvPdfPath; cvLink.hidden = !lastCvPdfPath;
  letterLink.href = SERVER + lastLetterPdfPath; letterLink.hidden = !lastLetterPdfPath;
}

function renderFillResults(filled, skipped) {
  const el = $("fill-results");
  el.textContent = "";
  const f = document.createElement("p"); f.textContent = "Filled: " + (filled || []).join(", ");
  const s = document.createElement("p"); s.textContent = "Skipped: " + (skipped || []).join(", ");
  el.appendChild(f); el.appendChild(s);
}

async function collectFillData() {
  const files = [];
  if (lastCvPdfPath && lastLetterPdfPath) {
    const cvPdf = await sendToBg({ type: "fetch_pdf", path: lastCvPdfPath });
    if (!cvPdf.ok) { showStatus("Could not fetch the CV PDF: " + detailOf(cvPdf)); return null; }
    const letterPdf = await sendToBg({ type: "fetch_pdf", path: lastLetterPdfPath });
    if (!letterPdf.ok) { showStatus("Could not fetch the letter PDF: " + detailOf(letterPdf)); return null; }
    files.push({ name: cvPdf.name, b64: cvPdf.b64 }, { name: letterPdf.name, b64: letterPdf.b64 });
  } else {
    showStatus("No tailored PDFs yet, filling profile fields only.");
  }
  return { profile: collectProfile(), cover_letter: $("letter-text").value, files };
}

async function onFill() {
  clearStatus();
  const data = await collectFillData();
  if (!data) return;
  const tab = await getActiveTab();
  const injectError = await ensureContentScript(tab.id);
  if (injectError) { showStatus("Could not reach this page: " + injectError); return; }
  const resp = await sendToTab(tab.id, { type: "fill", data });
  if (!resp || !resp.ok) { showStatus("Fill failed: " + detailOf(resp)); return; }
  renderFillResults(resp.filled, resp.skipped);
  const agent = await answerRemaining(tab);
  renderFillResults(resp.filled.concat(agent.filled), resp.skipped.concat(agent.skipped));
  if (agent.left.length) showStatus("Required fields still empty: " + agent.left.join("; ") + ". Answer these on the page yourself.");
}

function unansweredOn(info) {
  return (info && info.unanswered) || [];
}

// Required fields the profile fill left empty go to the agent, which answers from the profile, notes and CV or says why not.
async function answerRemaining(tab) {
  const none = { left: [], filled: [], skipped: [] };
  const left = unansweredOn(await pageInfo(tab.id));
  if (!left.length) return none;
  const store = await chrome.storage.local.get(["settings", "cv_text"]);
  const fields = await sendToTab(tab.id, { type: "form_fields" });
  if (!fields || !fields.ok) { logRun("Could not read the form fields: " + detailOf(fields)); return { ...none, left }; }
  logRun("Asking the agent about " + left.length + " required field" + (left.length === 1 ? "" : "s") + " (spends tokens)");
  const body = { fields: fields.fields, profile: collectProfile(), cv_text: store.cv_text || "", posting_title: $("posting-title").value,
                 company: $("posting-company").value, provider: providerOf(store.settings || {}) };
  const resp = await sendToBg({ type: "api", method: "POST", path: "/answer", body });
  if (!resp || !resp.ok) { logRun("The agent could not answer: " + detailOf(resp)); return { ...none, left }; }
  const answers = resp.data.answers || [];
  answers.filter(a => a.value === null && left.includes(fieldLabel(fields.fields, a.id))).forEach(a => logRun("Left blank " + fieldLabel(fields.fields, a.id) + ": " + a.reason));
  const applied = await sendToTab(tab.id, { type: "apply_answers", answers });
  if (!applied || !applied.ok) { logRun("Could not apply the answers: " + detailOf(applied)); return { ...none, left }; }
  if (applied.filled.length) logRun("Agent answered: " + applied.filled.join(", "));
  return { left: unansweredOn(await pageInfo(tab.id)), filled: applied.filled.map(f => f + " (agent)"), skipped: applied.skipped };
}

function fieldLabel(fields, id) {
  const field = fields.find(f => f.id === id);
  return field ? field.label : id;
}

async function pageInfo(tabId) {
  const injectError = await ensureContentScript(tabId);
  if (injectError) return null;
  const resp = await sendToTab(tabId, { type: "page_info" });
  return resp && resp.ok ? resp.info : null;
}

function pageSignature(info) { return [info.step, info.heading, info.url].join("|"); }

// Workday advances in place or with a full reload; either way the content script is re-reached through pageInfo.
async function waitForPageChange(tabId, before) {
  const end = Date.now() + PAGE_CHANGE_TIMEOUT_MS;
  while (Date.now() < end && !runStopped) {
    await new Promise(r => setTimeout(r, 500));
    const info = await pageInfo(tabId);
    if (!info) continue;
    if (info.errors.length) return { info, changed: false };
    if (pageSignature(info) !== pageSignature(before)) return { info, changed: true };
  }
  return { info: before, changed: false };
}

function logRun(text) {
  const li = document.createElement("li");
  li.textContent = text;
  $("run-log").appendChild(li);
}

// Fills known pages and presses Save and Continue until the Review page or a page that needs the user. Never Submit.
async function onRunToReview() {
  const btn = $("run-btn");
  btn.disabled = true;
  btn.classList.add("is-running");
  try { await runToReview(); }
  finally { btn.disabled = false; btn.classList.remove("is-running"); }
}

// Every exit below is an early return, so the button state lives in the wrapper above.
async function runToReview() {
  clearStatus();
  $("run-log").textContent = "";
  runStopped = false;
  setShaderSpeed(0.8);
  // a new posting was read since the last tailor: reuse nothing from the previous application
  if (!(lastCvPdfPath && lastLetterPdfPath) || lastTailoredUrl !== lastPostingUrl) {
    if (!$("posting-description").value) { showStatus("Open the posting and click Read this posting first, then Run to review."); setShaderSpeed(0.25); return; }
    logRun("Tailoring CV and letter for this posting (the only step that spends tokens)");
    if (!(await onTailor())) { setShaderSpeed(0.25); return; }
    logRun("Tailored.");
    setShaderSpeed(0.8); // resume run motion: onTailor() dropped it to rest speed on its own success
  }
  const data = await collectFillData();
  if (!data) { setShaderSpeed(0.25); return; }
  const tab = await getActiveTab();
  for (let page = 1; page <= MAX_PAGES; page++) {
    if (runStopped) { showStatus("Stopped."); setShaderSpeed(0.25); return; }
    const info = await pageInfo(tab.id);
    if (!info) { showStatus("Could not reach this page."); setShaderSpeed(0.25); return; }
    if (info.posting) { showStatus("This is the posting page. Click Apply, choose Apply Manually, sign in, then click Run to review on the My Information page."); setShaderSpeed(0.25); return; }
    if (info.step === "signIn") { showStatus("Sign in to this Workday account on the page, then click Run to review again."); setShaderSpeed(0.25); return; }
    if (info.step === "review") { logRun("Review page reached."); showStatus("Review page. Read it through and press Submit yourself."); setShaderSpeed(0); return; }
    if (info.step === "unknown" && page > 1) { showStatus("Stopped at a page I do not recognise. Fill it by hand, then click Run to review again."); setShaderSpeed(0.25); return; }
    if (info.step !== "unknown") {
      const fill = await sendToTab(tab.id, { type: "fill", data });
      if (!fill || !fill.ok) { showStatus("Fill failed: " + detailOf(fill)); setShaderSpeed(0.25); return; }
      logRun(info.step + ": filled " + fill.filled.length + ", skipped " + fill.skipped.length);
      renderFillResults(fill.filled, fill.skipped);
      const agent = await answerRemaining(tab);
      if (agent.filled.length || agent.skipped.length) renderFillResults(fill.filled.concat(agent.filled), fill.skipped.concat(agent.skipped));
      if (agent.left.length) { showStatus("Workday still needs: " + agent.left.join("; ") + ". Answer these on the page, then click Run to review again."); setShaderSpeed(0.25); return; }
    }
    const adv = await sendToTab(tab.id, { type: "advance" });
    if (!adv || !adv.ok) { showStatus("Stopped: " + (adv && adv.reason ? adv.reason : detailOf(adv))); setShaderSpeed(0.25); return; }
    logRun('Pressed "' + adv.clicked + '"');
    const next = await waitForPageChange(tab.id, info);
    if (runStopped) { showStatus("Stopped."); setShaderSpeed(0.25); return; }
    if (next.info.errors.length) { showStatus("Workday flagged: " + next.info.errors.join("; ") + ". Fix this by hand, then click Run to review again."); setShaderSpeed(0.25); return; }
    if (!next.changed) { showStatus("Stopped: the page did not move on after Save and Continue."); setShaderSpeed(0.25); return; }
  }
  showStatus("Stopped after " + MAX_PAGES + " pages without reaching Review.");
  setShaderSpeed(0.25);
}

// Every stage heading collapses/expands independently; state persists under stageOpen.
// Stage 1 starts closed (the folded one-line row) until the user opens it by hand.
const DEFAULT_STAGE_OPEN = { setup: false, posting: true, apply: true };

function getStageOpen(store) {
  return { ...DEFAULT_STAGE_OPEN, ...(store.stageOpen || {}) };
}

async function renderStages() {
  const store = await chrome.storage.local.get(["settings", "profile", "cv_text", "cv_file", "stageOpen"]);
  const state = getStageOpen(store);

  $("setup-folded").hidden = state.setup;
  $("setup-unfolded").hidden = !state.setup;
  $("setup-folded").setAttribute("aria-expanded", String(state.setup));
  $("setup-heading").setAttribute("aria-expanded", String(state.setup));
  const s = store.settings || {};
  const p = store.profile || {};
  const name = [p.first_name, p.last_name].filter(Boolean).join(" ");
  const cvName = (store.cv_file && store.cv_file.name) || "";
  const parts = [s.name, name, cvName].filter(Boolean);
  $("fold-summary").textContent = "1 Set up once" + (parts.length ? " · " + parts.join(" · ") : " · not set up yet");

  $("posting-body").hidden = !state.posting;
  $("posting-heading").setAttribute("aria-expanded", String(state.posting));
  $("apply-body").hidden = !state.apply;
  $("apply-heading").setAttribute("aria-expanded", String(state.apply));
}

async function toggleStage(name) {
  const store = await chrome.storage.local.get(["stageOpen"]);
  const state = getStageOpen(store);
  state[name] = !state[name];
  await chrome.storage.local.set({ stageOpen: state });
  await renderStages();
}

async function openSetup() {
  const store = await chrome.storage.local.get(["stageOpen"]);
  const state = getStageOpen(store);
  state.setup = true;
  await chrome.storage.local.set({ stageOpen: state });
  await renderStages();
}

// Auto-closes stage 1 once settings, profile and CV are all saved.
async function maybeCloseSetup() {
  const store = await chrome.storage.local.get(["settings", "profile", "cv_text", "stageOpen"]);
  if (store.settings && store.profile && store.cv_text) {
    const state = getStageOpen(store);
    state.setup = false;
    await chrome.storage.local.set({ stageOpen: state });
  }
  await renderStages();
}

function isActivationKey(e) { return e.key === "Enter" || e.key === " " || e.key === "Spacebar"; }

function bindToggle(el, handler) {
  el.addEventListener("click", handler);
  el.addEventListener("keydown", (e) => {
    if (isActivationKey(e)) { e.preventDefault(); handler(); }
  });
}

async function init() {
  const store = await chrome.storage.local.get(["settings", "profile", "cv_text", "cv_file"]);
  applySettings(store.settings || {});
  applyProfile(store.profile || {});
  updateCvInfo(store.cv_text || "");
  const session = await chrome.storage.session.get(["tailored"]);
  if (session.tailored) applyTailored(session.tailored);
  checkServer();
  await renderStages();

  $("provider").addEventListener("change", updateModelPlaceholder);
  $("save-settings").addEventListener("click", async () => { await saveSettings(); await maybeCloseSetup(); });
  $("save-profile").addEventListener("click", async () => { await saveProfile(); await maybeCloseSetup(); });
  $("cv-file").addEventListener("change", async (e) => { await onCvFile(e); await maybeCloseSetup(); });
  $("setup-edit").addEventListener("click", openSetup);
  bindToggle($("setup-folded"), openSetup);
  bindToggle($("setup-heading"), () => toggleStage("setup"));
  bindToggle($("posting-heading"), () => toggleStage("posting"));
  bindToggle($("apply-heading"), () => toggleStage("apply"));
  $("read-posting").addEventListener("click", onReadPosting);
  $("tailor-btn").addEventListener("click", onTailor);
  $("fill-btn").addEventListener("click", onFill);
  $("run-btn").addEventListener("click", onRunToReview);
  $("stop-btn").addEventListener("click", () => { runStopped = true; });
}

document.addEventListener("DOMContentLoaded", () => {
  init().catch(e => showStatus(String(e)));
});
