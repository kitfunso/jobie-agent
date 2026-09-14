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

function $(id) { return document.getElementById(id); }

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
    phone: $("phone").value, country: $("country").value, city: $("city").value, linkedin: $("linkedin").value
  };
}

function applyProfile(profile) {
  $("first-name").value = profile.first_name || "";
  $("last-name").value = profile.last_name || "";
  $("email").value = profile.email || "";
  $("phone").value = profile.phone || "";
  $("country").value = profile.country || "";
  $("city").value = profile.city || "";
  $("linkedin").value = profile.linkedin || "";
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

async function onReadPosting() {
  clearStatus();
  const tab = await getActiveTab();
  const resp = await sendToTab(tab.id, { type: "scrape" });
  if (!resp || !resp.ok) { showStatus("Could not read this page: " + detailOf(resp)); return; }
  const p = resp.posting || {};
  $("posting-title").value = p.title || "";
  $("posting-company").value = p.company || "";
  $("posting-location").value = p.location || "";
  $("posting-description").value = p.description || "";
  lastPostingUrl = p.url || tab.url || "";
}

function renderRounds(rounds) {
  const container = $("rounds");
  container.textContent = "";
  (rounds || []).forEach(r => {
    const details = document.createElement("details");
    details.className = "round";
    const summary = document.createElement("summary");
    summary.textContent = "Round " + r.round + ": " + r.findings.length + " findings";
    details.appendChild(summary);
    r.findings.forEach(f => {
      const div = document.createElement("div");
      div.className = "finding";
      div.textContent = f.rule + ': "' + f.quote + '"';
      details.appendChild(div);
    });
    container.appendChild(details);
  });
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

async function onTailor() {
  clearStatus();
  const store = await chrome.storage.local.get(["settings", "cv_text"]);
  const settings = store.settings || {};
  const body = {
    posting: {
      title: $("posting-title").value, company: $("posting-company").value,
      location: $("posting-location").value, description: $("posting-description").value, url: lastPostingUrl
    },
    cv_text: store.cv_text || "",
    provider: { name: settings.name || "bedrock", api_key: settings.api_key || "", model_id: settings.model_id || "", region: settings.region || "" }
  };
  const resp = await sendToBg({ type: "api", method: "POST", path: "/tailor", body });
  if (!resp.ok) { showStatus("Tailor failed: " + detailOf(resp)); return; }
  const data = resp.data;
  renderRounds(data.rounds);
  $("letter-text").value = data.cover_letter || "";
  $("cv-markdown").value = data.cv_markdown || "";
  renderList("changes-list", data.changes);
  renderList("gaps-list", data.gaps);
  lastCvPdfPath = data.cv_pdf || "";
  lastLetterPdfPath = data.letter_pdf || "";
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

async function onFill() {
  clearStatus();
  if (!lastCvPdfPath || !lastLetterPdfPath) { showStatus("Tailor first to generate the CV and letter PDFs."); return; }
  const cvPdf = await sendToBg({ type: "fetch_pdf", path: lastCvPdfPath });
  if (!cvPdf.ok) { showStatus("Could not fetch the CV PDF: " + detailOf(cvPdf)); return; }
  const letterPdf = await sendToBg({ type: "fetch_pdf", path: lastLetterPdfPath });
  if (!letterPdf.ok) { showStatus("Could not fetch the letter PDF: " + detailOf(letterPdf)); return; }
  const data = {
    profile: collectProfile(),
    cover_letter: $("letter-text").value,
    files: [{ name: cvPdf.name, b64: cvPdf.b64 }, { name: letterPdf.name, b64: letterPdf.b64 }]
  };
  const tab = await getActiveTab();
  const resp = await sendToTab(tab.id, { type: "fill", data });
  if (!resp || !resp.ok) { showStatus("Fill failed: " + detailOf(resp)); return; }
  renderFillResults(resp.filled, resp.skipped);
}

async function init() {
  const store = await chrome.storage.local.get(["settings", "profile", "cv_text", "cv_file"]);
  applySettings(store.settings || {});
  applyProfile(store.profile || {});
  updateCvInfo(store.cv_text || "");
  checkServer();

  $("provider").addEventListener("change", updateModelPlaceholder);
  $("save-settings").addEventListener("click", saveSettings);
  $("save-profile").addEventListener("click", saveProfile);
  $("cv-file").addEventListener("change", onCvFile);
  $("read-posting").addEventListener("click", onReadPosting);
  $("tailor-btn").addEventListener("click", onTailor);
  $("fill-btn").addEventListener("click", onFill);
}

document.addEventListener("DOMContentLoaded", () => {
  init().catch(e => showStatus(String(e)));
});
