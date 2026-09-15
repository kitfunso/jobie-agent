// extension/sidepanel.js
const SERVER = "http://127.0.0.1:8765";
const MODEL_DEFAULTS = {
  bedrock: "global.anthropic.claude-sonnet-4-6",
  anthropic: "claude-sonnet-5",
  openai: "gpt-4o",
  nebius: "nvidia/nemotron-3-super-120b-a12b"
};

let lastCvPdfPath = "";
let lastLetterPdfPath = "";
let lastPostingUrl = "";
let lastTailoredUrl = "";
let runStopped = false;
let busy = false;
let askResolve = null;
const MAX_PAGES = 8;
const FORM_SETTLE_TIMEOUT_MS = 8000;
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

// Opened as its own window or a plain tab, the panel still targets the Workday tab: the one active in its window
// over an older one, so two open postings do not send the run to the first tab Chrome lists.
async function getActiveTab() {
  const [active] = await chrome.tabs.query({ active: true, currentWindow: true });
  const url = (active && active.url) || "";
  if (url.includes(".myworkdayjobs.com/") || url.includes(".myworkdaysite.com/")) return active;
  const workday = await chrome.tabs.query({ url: ["https://*.myworkdayjobs.com/*", "https://*.myworkdaysite.com/*"] });
  return workday.find(t => t.active) || workday[0] || active;
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
    phone: $("phone").value, country: $("country").value, address1: $("address1").value, city: $("city").value,
    postcode: $("postcode").value, linkedin: $("linkedin").value, notes: $("notes").value
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
  $("address1").value = profile.address1 || "";
  $("city").value = profile.city || "";
  $("postcode").value = profile.postcode || "";
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
  applyPosting({ ...p, url: p.url || tab.url || "" });
  // session storage so the posting survives the panel closing while the user clicks Apply and signs in
  await chrome.storage.session.set({ posting: { title: p.title || "", company: p.company || "", location: p.location || "",
                                                description: p.description || "", url: lastPostingUrl } });
}

function applyPosting(p) {
  $("posting-title").value = p.title || "";
  $("posting-company").value = p.company || "";
  $("posting-location").value = p.location || "";
  $("posting-description").value = p.description || "";
  lastPostingUrl = p.url || "";
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

// Fill this page and Run to review share one flag: two runs on the same tab would race for the same fields.
async function withBusy(fn) {
  if (busy) return;
  busy = true;
  runStopped = false;
  const buttons = [$("fill-btn"), $("run-btn")];
  buttons.forEach(b => { b.disabled = true; });
  try { await fn(); }
  finally { busy = false; buttons.forEach(b => { b.disabled = false; }); }
}

async function onFill() {
  await withBusy(async () => {
    clearStatus();
    $("run-log").textContent = "";
    const data = await collectFillData();
    if (!data) return;
    const tab = await getActiveTab();
    const injectError = await ensureContentScript(tab.id);
    if (injectError) { showStatus("Could not reach this page: " + injectError); return; }
    const resp = await sendToTab(tab.id, { type: "fill", data });
    if (!resp || !resp.ok) { showStatus("Fill failed: " + detailOf(resp)); return; }
    renderFillResults(resp.filled, resp.skipped);
    const left = await answerPage(tab);
    if (left.length) showStatus("Required fields still empty: " + left.join("; ") + ". Answer these on the page yourself.");
  });
}

function unansweredOn(info) {
  return (info && info.unanswered) || [];
}

function nowIso() { return new Date().toISOString(); }

async function loadBank() {
  return (await chrome.storage.local.get(["answers"])).answers || {};
}

async function saveBank(bank) {
  await chrome.storage.local.set({ answers: bank });
  renderBank(bank);
}

async function readFields(tab) {
  const resp = await sendToTab(tab.id, { type: "form_fields" });
  if (!resp || !resp.ok) { logRun("Could not read the form fields: " + detailOf(resp), "warn"); return null; }
  return resp.fields;
}

async function applyOnPage(tab, answers, prefix) {
  const applied = await sendToTab(tab.id, { type: "apply_answers", answers });
  if (!applied || !applied.ok) { logRun("Could not apply the answers: " + detailOf(applied), "warn"); return []; }
  if (applied.filled.length) logRun(prefix + applied.filled.map(brief).join("; "), "answer");
  applied.skipped.forEach(s => logRun("Could not apply " + briefLine(s), "warn"));
  return applied.filledIds || [];
}

// Per page: saved answers first (free), the agent for what is still empty, then the user for the rest.
// Every question the page asks is recorded, so the bank grows into the list the user answers once.
async function answerPage(tab) {
  const company = $("posting-company").value;
  let fields = await readFields(tab);
  if (!fields) return unansweredOn(await pageInfo(tab.id));
  let bank = AnswerBank.recordAsked(await loadBank(), fields, company, nowIso());
  const { hits, misses } = AnswerBank.matches(bank, fields);
  misses.forEach(m => logRun(briefLine(m), "warn"));
  if (hits.length) await applyOnPage(tab, hits, "From your answers: ");
  await saveBank(bank);
  let left = unansweredOn(await pageInfo(tab.id));
  if (left.length) {
    fields = (await readFields(tab)) || fields;
    bank = await askAgent(tab, fields, bank, company);
    left = unansweredOn(await pageInfo(tab.id));
  }
  while (left.length && !runStopped) {
    fields = (await readFields(tab)) || fields;
    // an answer can reveal more fields (a preferred name adds a second Prefix): reuse saved answers before asking
    const known = AnswerBank.matches(bank, fields).hits;
    if (known.length && (await applyOnPage(tab, known, "From your answers: ")).length) { left = unansweredOn(await pageInfo(tab.id)); continue; }
    const open = fields.filter(f => f.required && !f.value && AnswerBank.askable(f));
    if (!open.length) break;
    const answers = await askUser(open);
    if (answers === "refresh") {
      fields = (await readFields(tab)) || fields;
      bank = await askAgent(tab, fields, bank, company);
      left = unansweredOn(await pageInfo(tab.id));
      continue;
    }
    if (!answers || !answers.length) break;
    const filledIds = await applyOnPage(tab, answers, "You answered: ");
    bank = AnswerBank.recordAnswers(bank, fields, answers.filter(a => filledIds.includes(a.id)), "user", nowIso(), company);
    await saveBank(bank);
    // nothing took (the page dropped every value): asking the same questions again would loop for ever
    if (!filledIds.length) break;
    left = unansweredOn(await pageInfo(tab.id));
  }
  return left;
}

// The agent answers from the profile, notes, CV and earlier answers, or says why it cannot.
async function askAgent(tab, fields, bank, company) {
  const open = fields.filter(f => f.required && !f.value);
  if (!open.length) return bank;
  const store = await chrome.storage.local.get(["settings", "cv_text"]);
  logRun("Asking the agent about " + open.length + " required field" + (open.length === 1 ? "" : "s") + " (spends tokens)", "spend");
  const body = { fields, profile: collectProfile(), cv_text: store.cv_text || "", posting_title: $("posting-title").value,
                 company, provider: providerOf(store.settings || {}), known_answers: AnswerBank.known(bank, fields) };
  const resp = await sendToBg({ type: "api", method: "POST", path: "/answer", body });
  if (!resp || !resp.ok) { logRun("The agent could not answer: " + detailOf(resp), "warn"); return bank; }
  const answers = resp.data.answers || [];
  const openIds = new Set(open.map(f => f.id));
  answers.filter(a => a.value === null && openIds.has(a.id)).forEach(a => logRun("Left blank " + brief(fieldLabel(fields, a.id)) + ": " + a.reason, "warn"));
  const filledIds = await applyOnPage(tab, answers, "Agent answered: ");
  const next = AnswerBank.recordAnswers(bank, fields, answers.filter(a => filledIds.includes(a.id)), "agent", nowIso(), company);
  await saveBank(next);
  return next;
}

// Shows the open questions in the panel and waits for Save and continue; Refresh settles it with "refresh", Stop with null.
function askUser(open) {
  const list = $("asks-list");
  list.textContent = "";
  open.forEach(f => list.appendChild(askRow(f)));
  $("asks-save").hidden = false;
  $("asks").hidden = false;
  showStatus("Workday asks " + open.length + " question" + (open.length === 1 ? "" : "s") + " your profile, notes and CV do not answer. Type each once; the answers are kept for later applications.");
  setShaderSpeed(0.25);
  return new Promise(resolve => {
    askResolve = answers => { askResolve = null; $("asks").hidden = true; clearStatus(); setShaderSpeed(0.8); resolve(answers); };
  });
}

// The run stopped on fields nobody could fill: the box stays up with Refresh, so the next attempt is one click away.
function showStuck(left) {
  const list = $("asks-list");
  list.textContent = "";
  left.forEach(label => { const p = document.createElement("p"); p.className = "note"; p.textContent = label; list.appendChild(p); });
  $("asks-save").hidden = true;
  $("asks").hidden = false;
  showStatus("Workday still needs: " + left.join("; ") + ". Add them to your profile or notes, or answer them on the page, then click Refresh.");
}

function askRow(f) {
  const row = document.createElement("div");
  row.className = "field";
  const label = document.createElement("label");
  label.htmlFor = "ask-" + f.id;
  label.textContent = f.label;
  row.appendChild(label);
  row.appendChild(askControl(f, "ask-" + f.id));
  return row;
}

function askControl(f, id) {
  let el;
  if (f.options && f.options.length) {
    el = document.createElement("select");
    const blank = document.createElement("option");
    blank.value = "";
    blank.textContent = "Choose";
    el.appendChild(blank);
    f.options.forEach(o => { const opt = document.createElement("option"); opt.value = o; opt.textContent = o; el.appendChild(opt); });
  } else if (f.kind === "textarea") {
    el = document.createElement("textarea");
    el.rows = 3;
  } else {
    el = document.createElement("input");
    el.type = "text";
  }
  el.id = id;
  el.dataset.fieldId = f.id;
  return el;
}

function collectAsks() {
  return [...$("asks-list").querySelectorAll("[data-field-id]")]
    .map(el => ({ id: el.dataset.fieldId, value: el.value.trim() }))
    .filter(a => a.value);
}

// Stage 1 list: required questions still waiting come first, then the answered ones; every row is editable.
function renderBank(bank) {
  const waiting = AnswerBank.waiting(bank);
  const answered = AnswerBank.answered(bank);
  $("bank-summary").textContent = !waiting.length && !answered.length
    ? "No application questions recorded yet. They are collected as you apply."
    : answered.length + " answered, " + waiting.length + " waiting for your answer.";
  const list = $("bank-list");
  list.textContent = "";
  waiting.concat(answered).forEach(e => list.appendChild(bankRow(e)));
}

function bankRow(e) {
  const key = AnswerBank.keyOf(e.question);
  const row = document.createElement("div");
  row.className = "field bank-row";
  const label = document.createElement("label");
  label.htmlFor = "bank-" + key.replace(/\s+/g, "-");
  label.textContent = e.question + (e.required ? "" : " (optional)");
  const meta = document.createElement("span");
  meta.className = "bank-meta";
  meta.textContent = [e.company, e.source ? "from " + e.source : "waiting"].filter(Boolean).join(" · ");
  const control = askControl({ id: key, kind: e.kind, options: e.options }, label.htmlFor);
  control.value = e.answer || "";
  row.appendChild(label);
  row.appendChild(meta);
  row.appendChild(control);
  return row;
}

async function saveBankEdits() {
  let bank = await loadBank();
  for (const el of $("bank-list").querySelectorAll("[data-field-id]")) {
    const key = el.dataset.fieldId;
    if (bank[key] && (bank[key].answer || "") !== el.value.trim()) bank = AnswerBank.setAnswer(bank, key, el.value, nowIso());
  }
  await saveBank(bank);
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

// two Application Questions pages in a row share step, heading and url (hkex.wd3, 15-Sep): the progress text tells them apart
function pageSignature(info) { return [info.step, info.stepName, info.heading, info.url].join("|"); }

// Workday paints a new step's fields a beat after the step changes: fill only once the field count stops moving.
async function waitForFormSettle(tabId) {
  let last = -1;
  const end = Date.now() + FORM_SETTLE_TIMEOUT_MS;
  while (Date.now() < end && !runStopped) {
    await new Promise(r => setTimeout(r, 700));
    const info = await pageInfo(tabId);
    const count = info ? info.fieldCount || 0 : -1;
    if (count > 0 && count === last) return;
    last = count;
  }
}

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

// kind: page | spend | answer | warn | done; anything else is a plain muted line
function logRun(text, kind = "") {
  const li = document.createElement("li");
  if (kind) li.className = "log-" + kind;
  li.textContent = text;
  $("run-log").appendChild(li);
}

function logPage(name, summary) {
  const li = document.createElement("li");
  li.className = "log-page";
  const strong = document.createElement("strong");
  strong.textContent = name;
  const span = document.createElement("span");
  span.textContent = summary;
  li.append(strong, span);
  $("run-log").appendChild(li);
}

// Workday questions run to whole paragraphs; the log keeps the start of the label and the reason after its last colon.
function brief(label) {
  return label.length > 72 ? label.slice(0, 70).trimEnd() + "…" : label;
}

function briefLine(line) {
  const i = line.lastIndexOf(": ");
  return i > 0 ? brief(line.slice(0, i)) + line.slice(i) : brief(line);
}

// Fills known pages and presses Save and Continue until the Review page or a page that needs the user. Never Submit.
async function onRunToReview() {
  await withBusy(async () => {
    const btn = $("run-btn");
    btn.classList.add("is-running");
    try { await runToReview(); }
    finally { btn.classList.remove("is-running"); }
  });
}

// Posting and sign-in pages end the run before any token goes on tailoring.
function notAnApplyPage(info) {
  if (info.posting) { showStatus("This is the posting page. Click Apply, choose Apply Manually, sign in, then click Run to review on the My Information page."); return true; }
  if (info.step === "signIn") { showStatus("Sign in to this Workday account on the page, then click Run to review again."); return true; }
  return false;
}

// Every exit below is an early return, so the button state lives in the wrapper above.
async function runToReview() {
  clearStatus();
  $("asks").hidden = true;
  $("run-log").textContent = "";
  runStopped = false;
  setShaderSpeed(0.8);
  const tab = await getActiveTab();
  const first = await pageInfo(tab.id);
  if (first && notAnApplyPage(first)) { setShaderSpeed(0.25); return; }
  // a new posting was read since the last tailor: reuse nothing from the previous application
  if (!(lastCvPdfPath && lastLetterPdfPath) || lastTailoredUrl !== lastPostingUrl) {
    if (!$("posting-description").value) { showStatus("Open the posting and click Read this posting first, then Run to review."); setShaderSpeed(0.25); return; }
    logRun("Tailoring CV and letter for this posting (spends tokens)", "spend");
    if (!(await onTailor())) { setShaderSpeed(0.25); return; }
    logRun("Tailored.");
    setShaderSpeed(0.8); // resume run motion: onTailor() dropped it to rest speed on its own success
  }
  const data = await collectFillData();
  if (!data) { setShaderSpeed(0.25); return; }
  for (let page = 1; page <= MAX_PAGES; page++) {
    if (runStopped) { showStatus("Stopped."); setShaderSpeed(0.25); return; }
    const info = await pageInfo(tab.id);
    if (!info) { showStatus("Could not reach this page."); setShaderSpeed(0.25); return; }
    if (notAnApplyPage(info)) { setShaderSpeed(0.25); return; }
    if (info.step === "review") { logRun("Review page reached.", "done"); showStatus("Review page. Read it through and press Submit yourself."); setShaderSpeed(0); return; }
    if (info.step === "unknown" && page > 1) { showStatus("Stopped at a page I do not recognise. Fill it by hand, then click Run to review again."); setShaderSpeed(0.25); return; }
    if (info.step !== "unknown") {
      const fill = await sendToTab(tab.id, { type: "fill", data });
      if (!fill || !fill.ok) { showStatus("Fill failed: " + detailOf(fill)); setShaderSpeed(0.25); return; }
      logPage(info.stepName || info.step, "filled " + fill.filled.length + ", skipped " + fill.skipped.length);
      renderFillResults(fill.filled, fill.skipped);
      const left = await answerPage(tab);
      if (runStopped) { showStatus("Stopped."); setShaderSpeed(0.25); return; }
      if (left.length) { showStuck(left); setShaderSpeed(0.25); return; }
    }
    const adv = await sendToTab(tab.id, { type: "advance" });
    if (!adv || !adv.ok) { showStatus("Stopped: " + (adv && adv.reason ? adv.reason : detailOf(adv))); setShaderSpeed(0.25); return; }
    logRun('Pressed "' + adv.clicked + '"');
    const next = await waitForPageChange(tab.id, info);
    if (runStopped) { showStatus("Stopped."); setShaderSpeed(0.25); return; }
    if (next.info.errors.length) { showStatus("Workday flagged: " + next.info.errors.join("; ") + ". Fix this by hand, then click Run to review again."); setShaderSpeed(0.25); return; }
    if (!next.changed) { showStatus("Stopped: the page did not move on after Save and Continue."); setShaderSpeed(0.25); return; }
    await waitForFormSettle(tab.id);
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

const DATA_KEYS = ["profile", "answers", "cv_text", "cv_file"];

// Settings stay out of the data file so the API key never leaves this browser.
function seedFrom(data) {
  const out = {};
  DATA_KEYS.filter(k => data && data[k]).forEach(k => { out[k] = data[k]; });
  return out;
}

// A fresh install with seed.json beside the extension files starts with that data.
async function seedIfEmpty() {
  const store = await chrome.storage.local.get(["profile", "answers"]);
  if (store.profile || store.answers) return;
  const resp = await fetch(chrome.runtime.getURL("seed.json")).catch(() => null);
  if (!resp || !resp.ok) return;
  await chrome.storage.local.set(seedFrom(await resp.json()));
}

async function exportData() {
  const store = await chrome.storage.local.get(DATA_KEYS);
  const url = URL.createObjectURL(new Blob([JSON.stringify(store, null, 1)], { type: "application/json" }));
  const a = document.createElement("a");
  a.href = url;
  a.download = "seed.json";
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

async function onImportData(e) {
  const file = e.target.files[0];
  if (!file) return;
  const data = seedFrom(JSON.parse(await file.text()));
  if (!Object.keys(data).length) { showStatus("That file holds no profile, answers or CV."); return; }
  await chrome.storage.local.set(data);
  const store = await chrome.storage.local.get(["profile", "cv_text"]);
  applyProfile(store.profile || {});
  updateCvInfo(store.cv_text || "");
  renderBank(await loadBank());
  showStatus("Imported " + Object.keys(data).join(", ") + ".");
}

async function init() {
  await seedIfEmpty();
  const store = await chrome.storage.local.get(["settings", "profile", "cv_text", "cv_file"]);
  applySettings(store.settings || {});
  applyProfile(store.profile || {});
  updateCvInfo(store.cv_text || "");
  const session = await chrome.storage.session.get(["tailored", "posting"]);
  if (session.posting) applyPosting(session.posting);
  if (session.tailored) applyTailored(session.tailored);
  checkServer();
  await renderStages();
  renderBank(await loadBank());

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
  $("stop-btn").addEventListener("click", () => { runStopped = true; if (askResolve) askResolve(null); });
  $("asks-save").addEventListener("click", () => { if (askResolve) askResolve(collectAsks()); });
  $("asks-refresh").addEventListener("click", () => { if (askResolve) askResolve("refresh"); else runToReview(); });
  $("bank-save").addEventListener("click", saveBankEdits);
  $("data-export").addEventListener("click", exportData);
  $("data-import").addEventListener("change", onImportData);
}

document.addEventListener("DOMContentLoaded", () => {
  init().catch(e => showStatus(String(e)));
});
