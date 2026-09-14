// extension/background.js
const SERVER = "http://127.0.0.1:8765";

chrome.runtime.onInstalled.addListener(() => {
  chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: true });
});

async function api(method, path, body) {
  const init = { method, headers: {} };
  if (body instanceof FormData) init.body = body;
  else if (body !== undefined) { init.headers["Content-Type"] = "application/json"; init.body = JSON.stringify(body); }
  const res = await fetch(SERVER + path, init);
  const text = await res.text();
  let data; try { data = JSON.parse(text); } catch { data = { detail: text }; }
  return { ok: res.ok, status: res.status, data };
}

async function fetchPdf(path) {
  const res = await fetch(SERVER + path);
  if (!res.ok) return { ok: false, status: res.status, data: { detail: "server returned " + res.status } };
  const buf = await res.arrayBuffer();
  let bin = ""; new Uint8Array(buf).forEach(b => bin += String.fromCharCode(b));
  return { ok: true, name: path.split("/").pop(), b64: btoa(bin) };
}

// FormData cannot cross sendMessage, so the panel sends {b64, name} and this rebuilds it.
async function cvParse(b64, name) {
  const bin = atob(b64);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  const form = new FormData();
  form.append("file", new Blob([bytes], { type: "application/pdf" }), name);
  return api("POST", "/cv/parse", form);
}

function onError(sendResponse) {
  return e => sendResponse({ ok: false, status: 0, data: { detail: String(e) } });
}

chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
  if (msg.type === "api") { api(msg.method, msg.path, msg.body).then(sendResponse, onError(sendResponse)); return true; }
  if (msg.type === "fetch_pdf") { fetchPdf(msg.path).then(sendResponse, onError(sendResponse)); return true; }
  if (msg.type === "cv_parse") { cvParse(msg.b64, msg.name).then(sendResponse, onError(sendResponse)); return true; }
  return false;
});
