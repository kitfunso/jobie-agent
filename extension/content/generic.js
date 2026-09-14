// extension/content/generic.js
const Generic = (() => {
  const LABELS = {
    "first name": "first_name",
    "last name": "last_name",
    "email": "email",
    "phone": "phone",
    "linkedin": "linkedin",
    "city": "city",
    "cover letter": "cover_letter",
  };

  function _largestTextBlock() {
    const blocks = Array.from(document.querySelectorAll("body *"))
      .filter(el => el.children.length === 0 && el.innerText && el.innerText.trim().length > 0);
    let best = "";
    for (const el of blocks) if (el.innerText.length > best.length) best = el.innerText;
    return best.trim();
  }

  function _description() {
    const main = document.querySelector("main");
    const text = (main && main.innerText.trim()) || _largestTextBlock();
    return text.slice(0, 12000);
  }

  function scrape() {
    return { title: document.title, company: location.hostname, location: "", description: _description(), url: location.href };
  }

  function _isVisible(el) {
    const r = el.getBoundingClientRect();
    return r.width > 0 && r.height > 0 && getComputedStyle(el).visibility !== "hidden";
  }

  function _setSelectValue(el, value) {
    const lower = value.trim().toLowerCase();
    const options = Array.from(el.options);
    const option = options.find(o => o.textContent.trim().toLowerCase() === lower)
      || options.find(o => o.textContent.trim().toLowerCase().startsWith(lower));
    if (!option) return false;
    el.value = option.value;
    el.dispatchEvent(new Event("change", { bubbles: true }));
    return true;
  }

  function _setFieldValue(el, value) {
    if (el.tagName === "SELECT") return _setSelectValue(el, value);
    Fill.setValue(el, value);
    return true;
  }

  function _fillFileField(el, label, files, filled, skipped) {
    if (files && files.length && (label.includes("resume") || label.includes("cv"))) {
      Fill.setFiles(el, files.map(f => Fill.b64ToFile(f.b64, f.name)));
      filled.push(label || "file upload");
    } else {
      skipped.push(label || "file upload");
    }
  }

  function _fillField(el, values, files, filled, skipped) {
    if (!_isVisible(el)) return;
    const label = Fill.labelFor(el);
    if (el.type === "file") { _fillFileField(el, label, files, filled, skipped); return; }
    const key = Object.keys(LABELS).find(k => label.includes(k));
    if (!key) return;
    const value = values[LABELS[key]];
    if (!value || !_setFieldValue(el, value)) { skipped.push(label || LABELS[key]); return; }
    filled.push(label || LABELS[key]);
  }

  async function fill(data) {
    const filled = [];
    const skipped = [];
    const values = { ...(data.profile || {}), cover_letter: data.cover_letter };
    document.querySelectorAll("input, textarea, select").forEach(el => _fillField(el, values, data.files, filled, skipped));
    return { ok: true, filled, skipped };
  }

  return { scrape, fill };
})();
