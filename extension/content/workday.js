// extension/content/workday.js
const Workday = (() => {
  function isApplication() {
    return !!(document.querySelector(WD.pages.myInformation) ||
      document.querySelector(WD.pages.myExperience) ||
      document.querySelector(WD.pages.voluntaryDisclosures) ||
      document.querySelector(WD.pages.selfIdentification) ||
      _reviewHeading());
  }

  function isPosting() {
    return !isApplication() && location.href.includes(WD.pages.postingUrlPattern);
  }

  function _reviewHeading() {
    const headings = Array.from(document.querySelectorAll(WD.pages.reviewHeading));
    return headings.find(h => h.textContent.toLowerCase().includes("review")) || null;
  }

  function _fieldFromPair(pair) {
    const first = document.querySelector(pair.tryFirst);
    const text = first ? first.textContent.trim() : "";
    if (text) return text;
    if (!pair.fallback) return "";
    const el = document.querySelector(pair.fallback);
    return el ? el.textContent.trim() : "";
  }

  function _description() {
    const first = document.querySelector(WD.posting.description.tryFirst);
    const text = first ? first.innerText.trim() : "";
    if (text) return text.slice(0, 12000);
    const main = document.querySelector(WD.posting.description.fallback);
    const body = (main && main.innerText.trim()) || document.body.innerText.trim();
    return body.slice(0, 12000);
  }

  // Appendix A: company is the tab title before the first separator, else the site subdomain.
  function _company() {
    const title = document.title;
    const dash = title.indexOf(" - ");
    const pipe = title.indexOf(" | ");
    const candidates = [dash, pipe].filter(i => i !== -1);
    if (candidates.length) return title.slice(0, Math.min(...candidates)).trim();
    return (location.hostname.split(".")[0] || "").trim();
  }

  function scrape() {
    return {
      title: _fieldFromPair(WD.posting.title),
      company: _company(),
      location: _fieldFromPair(WD.posting.location),
      description: _description(),
      url: location.href,
    };
  }

  function _setIfPresent(selector, value, label, filled, skipped) {
    const el = document.querySelector(selector);
    if (!el || !value) { skipped.push(label); return; }
    Fill.setValue(el, value);
    filled.push(label);
  }

  function _matchOption(list, value) {
    const options = Array.from(list.querySelectorAll(WD.widgets.dropdownOption));
    const lower = value.trim().toLowerCase();
    return options.find(o => o.textContent.trim().toLowerCase() === lower)
      || options.find(o => o.textContent.trim().toLowerCase().startsWith(lower));
  }

  async function _fillDropdown(buttonSelector, value, label, filled, skipped) {
    const button = document.querySelector(buttonSelector);
    if (!button || !value) { skipped.push(label); return; }
    button.click();
    const listId = button.getAttribute("aria-controls");
    const list = listId ? await Fill.waitFor(`#${CSS.escape(listId)}`, 3000) : null;
    const option = list && _matchOption(list, value);
    if (option) { option.click(); filled.push(label); return; }
    skipped.push(label);
  }

  async function _fillMyInformation(data) {
    const filled = [];
    const skipped = [];
    const p = data.profile || {};
    _setIfPresent(WD.fields.firstName, p.first_name, "first name", filled, skipped);
    _setIfPresent(WD.fields.lastName, p.last_name, "last name", filled, skipped);
    _setIfPresent(WD.fields.email, p.email, "email", filled, skipped);
    _setIfPresent(WD.fields.phoneNumber, p.phone, "phone", filled, skipped);
    _setIfPresent(WD.fields.city, p.city, "city", filled, skipped);
    await _fillDropdown(WD.fields.country, p.country, "country", filled, skipped);
    skipped.push("how did you hear about us: left alone");
    return { ok: true, filled, skipped };
  }

  function _dropZoneFallback(files) {
    const zone = document.querySelector(WD.fields.fileUploadDropZone);
    if (!zone) return { ok: false, path: "no drop zone found" };
    const propsKey = Object.keys(zone).find(k => k.startsWith("__reactProps$"));
    const onDrop = propsKey && zone[propsKey].onDrop;
    if (!onDrop) return { ok: false, path: "drop zone has no onDrop handler" };
    onDrop({ preventDefault() {}, stopPropagation() {}, dataTransfer: { files, types: ["Files"] } });
    return { ok: true, path: "drop zone fallback" };
  }

  async function _uploadFiles(files) {
    const input = document.querySelector(WD.fields.fileUploadInput);
    if (!input) return { ok: false, path: "no file input found" };
    Fill.setFiles(input, files);
    const success = await Fill.waitFor(WD.fields.fileUploadSuccess, 2000);
    if (success) return { ok: true, path: "native input" };
    return _dropZoneFallback(files);
  }

  async function _fillMyExperience(data) {
    const filled = [];
    const skipped = [];
    const files = (data.files || []).map(f => Fill.b64ToFile(f.b64, f.name));
    if (files.length) {
      const result = await _uploadFiles(files);
      (result.ok ? filled : skipped).push(`resume upload (${result.path})`);
    } else {
      skipped.push("resume upload: no files supplied");
    }
    const letterEl = document.querySelector(WD.fields.coverLetterTextarea);
    if (letterEl && data.cover_letter) { Fill.setValue(letterEl, data.cover_letter); filled.push("cover letter"); }
    else { skipped.push("cover letter: no field on this page"); }
    skipped.push("work experience: use Autofill with Resume or fill by hand");
    return { ok: true, filled, skipped };
  }

  async function fill(data) {
    if (document.querySelector(WD.pages.myInformation)) return _fillMyInformation(data);
    if (document.querySelector(WD.pages.myExperience)) return _fillMyExperience(data);
    if (document.querySelector(WD.pages.voluntaryDisclosures)) return { ok: true, filled: [], skipped: ["voluntary disclosures: answer by hand"] };
    if (document.querySelector(WD.pages.selfIdentification)) return { ok: true, filled: [], skipped: ["self identify: answer by hand"] };
    if (_reviewHeading()) return { ok: true, filled: [], skipped: ["review page: press Submit yourself"] };
    return { ok: true, filled: [], skipped: ["unrecognized step: no known Workday page container found"] };
  }

  return { isPosting, isApplication, scrape, fill };
})();
