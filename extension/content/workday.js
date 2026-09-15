// extension/content/workday.js
const Workday = (() => {
  const ADVANCE_TEXT = /^(save and continue|next|continue)$/i;
  const FIELD_PREFIX = "formField-";
  // Fields the My Information filler owns from the profile; the answer bank leaves these alone.
  const PROFILE_IDS = new Set(["legalName--firstName", "legalName--lastName", "email", "country", "city", "addressLine1",
    "postalCode", "phoneType", "countryPhoneCode", "phoneNumber", "extension", "linkedInAccount"]);
  const STEP_NAMES = [
    // seen live 15-Sep: an expired session shows "Create Account/Sign In" in the progress bar with no signInContent container
    [/sign in|create account/i, "signIn"],
    [/my information|contact information/i, "myInformation"],
    [/experience/i, "myExperience"],
    [/question/i, "questions"],
    [/voluntary/i, "voluntaryDisclosures"],
    [/self.?identif/i, "selfIdentification"],
    [/review/i, "review"],
  ];

  // The active progress bar item reads "current step 1 of 5My Information": the count runs straight into the name.
  function _progressStepName() {
    const item = document.querySelector(WD.pages.progressStep);
    return item ? item.textContent.replace(/^\s*(current\s+)?step\s+\d+\s+of\s+\d+/i, "").trim() : "";
  }

  function _stepFromName(name) {
    const hit = STEP_NAMES.find(([pattern]) => pattern.test(name));
    return hit ? hit[1] : "";
  }

  function _step() {
    if (document.querySelector(WD.pages.signIn)) return "signIn";
    const named = _stepFromName(_progressStepName());
    if (named) return named;
    if (document.querySelector(WD.pages.myInformation)) return "myInformation";
    if (document.querySelector(WD.pages.myExperience)) return "myExperience";
    if (document.querySelector(WD.pages.voluntaryDisclosures)) return "voluntaryDisclosures";
    if (document.querySelector(WD.pages.selfIdentification)) return "selfIdentification";
    if (_reviewHeading()) return "review";
    return "unknown";
  }

  // Apply pages keep the posting's /job/ URL, so the progress bar is what separates them from the posting.
  function isApplication() {
    return _step() !== "unknown" || !!document.querySelector(WD.pages.progressStep);
  }

  function isPosting() {
    if (isApplication()) return false;
    return WD.pages.postingUrlPattern.test(location.href) || !!document.querySelector(WD.pages.applyButton);
  }

  function _reviewHeading() {
    const headings = Array.from(document.querySelectorAll(WD.pages.reviewHeading));
    return headings.find(h => h.textContent.toLowerCase().includes("review")) || null;
  }

  // Workday renders labelled facts as <dl><dt>locations</dt><dd>London</dd></dl>; textContent glues the label on.
  function _fieldText(el) {
    const dds = Array.from(el.querySelectorAll("dd"));
    if (dds.length) return dds.map(d => d.textContent.trim()).filter(Boolean).join(", ");
    return el.textContent.trim();
  }

  function _fieldFromPair(pair) {
    const first = document.querySelector(pair.tryFirst);
    const text = first ? _fieldText(first) : "";
    if (text) return text;
    if (!pair.fallback) return "";
    const el = document.querySelector(pair.fallback);
    return el ? _fieldText(el) : "";
  }

  function _description() {
    const first = document.querySelector(WD.posting.description.tryFirst);
    const text = first ? first.innerText.trim() : "";
    if (text) return text.slice(0, 12000);
    const main = document.querySelector(WD.posting.description.fallback);
    const body = (main && main.innerText.trim()) || document.body.innerText.trim();
    return body.slice(0, 12000);
  }

  // The tab title is the job title on edftrading.wd1 and "job title - logo alt text" on shell.wd3 (seen 15-Sep), so on a
  // Workday host the tenant path segment (EDFTrading, ShellCareers) is the source; the title serves other hosts.
  function companyOf({ hostname, pathname, title }) {
    if (/myworkdayjobs\.com$/i.test(hostname)) {
      const site = pathname.split("/").filter(Boolean).find(s => !/^[a-z]{2}(-[A-Z]{2})?$/.test(s)) || hostname.split(".")[0];
      return site.replace(/([a-z])([A-Z])/g, "$1 $2").replace(/([A-Z]+)([A-Z][a-z])/g, "$1 $2").replace(/(\s+(careers?|jobs|page|site|portal|external))+$/i, "").trim();
    }
    const cut = [title.indexOf(" - "), title.indexOf(" | ")].filter(i => i !== -1);
    return (cut.length ? title.slice(0, Math.min(...cut)) : title).trim();
  }

  function scrape() {
    return {
      title: _fieldFromPair(WD.posting.title),
      company: companyOf({ hostname: location.hostname, pathname: location.pathname, title: document.title }),
      location: _fieldFromPair(WD.posting.location),
      description: _description(),
      url: location.href,
    };
  }

  function _label(wrapper) {
    const lab = wrapper.querySelector("label, legend");
    return (lab ? lab.textContent : wrapper.textContent).replace(/\*/g, "").trim();
  }

  function _answered(wrapper) {
    if (wrapper.querySelector('input[type="file"]')) return !!wrapper.querySelector(WD.fields.fileUploadSuccess);
    if (wrapper.querySelector(WD.widgets.selectedItem)) return true;
    const radios = Array.from(wrapper.querySelectorAll('input[type="radio"]'));
    if (radios.length) return radios.some(r => r.checked);
    const box = wrapper.querySelector('input[type="checkbox"]');
    if (box) return box.checked;
    const button = wrapper.querySelector(WD.widgets.dropdownButton);
    if (button) return !/^(select one)?$/i.test(button.textContent.trim());
    const input = wrapper.querySelector("input, textarea");
    return input ? !!input.value.trim() : true;
  }

  // Labels of required fields still empty: the panel shows this list when it stops instead of pressing Save and Continue.
  function unansweredRequired() {
    return Array.from(document.querySelectorAll(WD.widgets.formField))
      .filter(w => w.querySelector(WD.widgets.required) && !_answered(w))
      .map(_label);
  }

  function _resolve(target) {
    return typeof target === "string" ? document.querySelector(target) : target;
  }

  // Workday's controlled inputs drop a value their handler rejects (seen live 15-Sep: text in a salary box), so an
  // empty box after the set is a rejection, not a fill.
  function _setIfPresent(target, value, label, filled, skipped) {
    const el = _resolve(target);
    if (!el || !value) { skipped.push(label); return; }
    Fill.setValue(el, value);
    if (!el.value) { skipped.push(`${label}: value "${value}" not accepted by the page`); return; }
    filled.push(label);
  }

  function _optionLabel(radio) {
    const byFor = radio.id ? document.querySelector(`label[for="${CSS.escape(radio.id)}"]`) : null;
    const lab = byFor || radio.closest("label");
    const text = (lab ? lab.textContent : radio.parentElement.textContent).trim();
    return text || { true: "Yes", false: "No" }[radio.value] || radio.value;
  }

  async function _readOptions(button) {
    const list = await _openList(button);
    if (!list) return [];
    const texts = Array.from(list.querySelectorAll(WD.widgets.dropdownOption)).map(o => o.textContent.trim());
    await _closeList(button, list);
    return texts.filter(t => t && !/^select one$/i.test(t));
  }

  // Verified on edftrading.wd1: a second click toggles the list once React has settled; Escape on the focused element closes a stray one.
  async function _closeList(button, list) {
    button.click();
    await Fill.sleep(300);
    if (!list.isConnected) return;
    document.activeElement.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", code: "Escape", keyCode: 27, which: 27, bubbles: true }));
    await Fill.sleep(100);
  }

  async function _describe(wrapper) {
    if (wrapper.querySelector('input[type="file"]')) return null;
    const id = wrapper.getAttribute("data-automation-id").slice(FIELD_PREFIX.length);
    const base = { id, label: _label(wrapper), required: !!wrapper.querySelector(WD.widgets.required), profile: PROFILE_IDS.has(id) };
    const radios = Array.from(wrapper.querySelectorAll('input[type="radio"]'));
    if (radios.length) {
      const on = radios.find(r => r.checked);
      return { ...base, kind: "radio", options: radios.map(_optionLabel), value: on ? _optionLabel(on) : "" };
    }
    const box = wrapper.querySelector('input[type="checkbox"]');
    if (box) return { ...base, kind: "checkbox", options: ["Yes", "No"], value: box.checked ? "Yes" : "" };
    const button = wrapper.querySelector(WD.widgets.dropdownButton);
    if (button) {
      const text = button.textContent.trim();
      const value = /^select one$/i.test(text) ? "" : text;
      return { ...base, kind: "dropdown", options: value ? [] : await _readOptions(button), value };
    }
    const chip = wrapper.querySelector(WD.widgets.selectedItem);
    const input = wrapper.querySelector("input, textarea");
    if (!input) return null;
    if (chip || input.getAttribute("placeholder") === "Search") return { ...base, kind: "prompt", options: [], value: chip ? chip.textContent.trim() : "" };
    return { ...base, kind: input.tagName === "TEXTAREA" ? "textarea" : "text", options: [], value: input.value.trim() };
  }

  // Every field on the page as the agent sees it; the wrapper id is what applyAnswers keys on.
  async function formFields() {
    const out = [];
    for (const wrapper of document.querySelectorAll(WD.widgets.formField)) {
      const field = await _describe(wrapper);
      if (field) out.push(field);
    }
    return out;
  }

  function _pickRadio(wrapper, value) {
    const lower = value.trim().toLowerCase();
    const radios = Array.from(wrapper.querySelectorAll('input[type="radio"]'));
    return radios.find(r => _optionLabel(r).toLowerCase() === lower) || radios.find(r => r.value.toLowerCase() === lower) || null;
  }

  async function _applyOne(wrapper, value, filled, skipped) {
    const label = _label(wrapper);
    if (wrapper.querySelector('input[type="radio"]')) {
      const radio = _pickRadio(wrapper, value);
      if (!radio) { skipped.push(`${label}: no option "${value}"`); return; }
      radio.click();
      filled.push(label);
      return;
    }
    const box = wrapper.querySelector('input[type="checkbox"]');
    if (box) {
      if (box.checked !== /^(yes|true)$/i.test(value.trim())) box.click();
      filled.push(label);
      return;
    }
    const button = wrapper.querySelector(WD.widgets.dropdownButton);
    if (button) { await _fillDropdown(button, value, label, filled, skipped); return; }
    const input = wrapper.querySelector("input, textarea");
    if (!input) { skipped.push(`${label}: no control to fill`); return; }
    if (input.getAttribute("placeholder") === "Search") { await _fillPrompt(input, value, label, filled, skipped); return; }
    _setIfPresent(input, value, label, filled, skipped);
  }

  async function applyAnswers(answers) {
    const filled = [];
    const filledIds = [];
    const skipped = [];
    for (const a of answers || []) {
      if (a.value === null || a.value === undefined || !String(a.value).trim()) continue;
      const wrapper = document.querySelector(`[data-automation-id="${CSS.escape(FIELD_PREFIX + a.id)}"]`);
      if (!wrapper) { skipped.push(`${a.id}: no such field on this page`); continue; }
      const before = filled.length;
      await _applyOne(wrapper, String(a.value), filled, skipped);
      if (filled.length > before) filledIds.push(a.id);
    }
    return { ok: true, filled, filledIds, skipped };
  }

  function _matchOption(list, value) {
    const options = Array.from(list.querySelectorAll(WD.widgets.dropdownOption));
    const lower = value.trim().toLowerCase();
    return options.find(o => o.textContent.trim().toLowerCase() === lower)
      || options.find(o => o.textContent.trim().toLowerCase().startsWith(lower));
  }

  // The previous dropdown's list lingers after its option is clicked, and a click on the next button while it is there
  // closes it instead of opening the new list (seen on shell.wd3, 15-Sep: the agent's valid pick came back "no option").
  async function _settleLists() {
    const open = () => Array.from(document.querySelectorAll(WD.widgets.dropdownList)).some(l => !l.matches(WD.widgets.selectedItemList));
    const end = Date.now() + 1500;
    while (Date.now() < end && open()) await Fill.sleep(100);
  }

  // edftrading.wd1's buttons carry no aria-controls; the list is appended to the body once the button is clicked.
  async function _openList(button) {
    const listId = button.getAttribute("aria-controls");
    await _settleLists();
    button.click();
    if (listId) return Fill.waitFor(`#${CSS.escape(listId)}`, 3000);
    const end = Date.now() + 3000;
    while (Date.now() < end) {
      const lists = Array.from(document.querySelectorAll(WD.widgets.dropdownList))
        .filter(l => !l.matches(WD.widgets.selectedItemList) && l.querySelector(WD.widgets.dropdownOption));
      if (lists.length) return lists[lists.length - 1];
      await Fill.sleep(100);
    }
    return null;
  }

  async function _fillDropdown(target, value, label, filled, skipped) {
    const button = _resolve(target);
    if (!button || !value) { skipped.push(label); return; }
    if (button.textContent.trim().toLowerCase() === value.trim().toLowerCase()) { filled.push(`${label} (already set)`); return; }
    const list = await _openList(button);
    const option = list && _matchOption(list, value);
    if (option) { option.click(); filled.push(label); return; }
    if (list) await _closeList(button, list);
    skipped.push(`${label}: no option "${value}"`);
  }

  function _promptText(option) {
    return (option.getAttribute("data-automation-label") || option.textContent).trim().toLowerCase();
  }

  // A chosen item is itself a promptOption inside its selectedItem, so only the open list's options count.
  function _matchPrompt(value) {
    const lower = value.trim().toLowerCase();
    const options = Array.from(document.querySelectorAll(WD.widgets.promptOption)).filter(o => !o.closest(WD.widgets.selectedItem));
    return options.find(o => _promptText(o).startsWith(lower)) || options.find(o => _promptText(o).includes(lower)) || null;
  }

  // Search boxes run the search on Enter. An exact match becomes a selectedItem on its own (seen on edftrading.wd1);
  // otherwise the matches list as promptOptions and the first fit is clicked. The search can take a few seconds.
  async function _fillPrompt(target, value, label, filled, skipped) {
    const input = _resolve(target);
    if (!input || !value) { skipped.push(label); return; }
    const wrapper = input.closest(WD.widgets.formField);
    const chosen = () => wrapper && wrapper.querySelector(WD.widgets.selectedItem);
    if (chosen()) { filled.push(`${label} (already set)`); return; }
    Fill.type(input, value);
    Fill.pressEnter(input);
    const end = Date.now() + 8000;
    while (Date.now() < end) {
      if (chosen()) { filled.push(label); return; }
      const option = _matchPrompt(value);
      if (option) { option.click(); filled.push(label); return; }
      await Fill.sleep(100);
    }
    skipped.push(`${label}: no match for "${value}"`);
  }

  async function _fillMyInformation(data) {
    const filled = [];
    const skipped = [];
    const p = data.profile || {};
    _setIfPresent(WD.fields.firstName, p.first_name, "first name", filled, skipped);
    _setIfPresent(WD.fields.lastName, p.last_name, "last name", filled, skipped);
    _setIfPresent(WD.fields.email, p.email, "email", filled, skipped);
    _setIfPresent(WD.fields.addressLine1, p.address1, "address line 1", filled, skipped);
    _setIfPresent(WD.fields.city, p.city, "city", filled, skipped);
    _setIfPresent(WD.fields.postalCode, p.postcode, "postal code", filled, skipped);
    await _fillDropdown(WD.fields.country, p.country, "country", filled, skipped);
    await _fillDropdown(WD.fields.phoneType, p.phone ? "Mobile" : "", "phone type", filled, skipped);
    await _fillPrompt(WD.fields.countryPhoneCode, p.country, "country phone code", filled, skipped);
    _setIfPresent(WD.fields.phoneNumber, p.phone, "phone", filled, skipped);
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
    // verified on edftrading.wd1: the success badge lands several seconds after the input change
    const success = await Fill.waitFor(WD.fields.fileUploadSuccess, 8000);
    if (success) return { ok: true, path: "native input" };
    return _dropZoneFallback(files);
  }

  async function _fillMyExperience(data) {
    const filled = [];
    const skipped = [];
    const files = (data.files || []).map(f => Fill.b64ToFile(f.b64, f.name));
    if (document.querySelector(WD.fields.fileUploadSuccess)) {
      skipped.push("resume upload: already attached");
    } else if (files.length) {
      const result = await _uploadFiles(files);
      (result.ok ? filled : skipped).push(`resume upload (${result.path})`);
    } else {
      skipped.push("resume upload: no files supplied");
    }
    const letterEl = document.querySelector(WD.fields.coverLetterTextarea);
    if (letterEl && data.cover_letter) { Fill.setValue(letterEl, data.cover_letter); filled.push("cover letter"); }
    else { skipped.push("cover letter: no field on this page"); }
    // seen live 15-Sep: Workday rejects any other link here, so a GitHub URL in the profile box stays out of the form
    const linkedin = (data.profile || {}).linkedin || "";
    if (linkedin && !/linkedin\.com\//i.test(linkedin)) skipped.push("linkedin: profile value is not a linkedin.com URL");
    else _setIfPresent(WD.fields.linkedin, linkedin, "linkedin", filled, skipped);
    skipped.push("work experience: use Autofill with Resume or fill by hand");
    return { ok: true, filled, skipped };
  }

  async function fill(data) {
    const step = _step();
    if (step === "signIn") return { ok: true, filled: [], skipped: ["sign in: yours to do"] };
    if (step === "myInformation") return _fillMyInformation(data);
    if (step === "myExperience") return _fillMyExperience(data);
    if (step === "questions") return { ok: true, filled: [], skipped: ["application questions: answer by hand"] };
    if (step === "voluntaryDisclosures") return { ok: true, filled: [], skipped: ["voluntary disclosures: answer by hand"] };
    if (step === "selfIdentification") return { ok: true, filled: [], skipped: ["self identify: answer by hand"] };
    if (step === "review") return { ok: true, filled: [], skipped: ["review page: press Submit yourself"] };
    return { ok: true, filled: [], skipped: ["unrecognized step: no known Workday page container found"] };
  }

  function _errors() {
    return Array.from(document.querySelectorAll(WD.pages.errorMessage)).map(e => e.textContent.trim()).filter(Boolean);
  }

  function _nextButton() {
    const byId = document.querySelector(WD.pages.nextButton);
    if (byId) return byId;
    return Array.from(document.querySelectorAll("button")).find(b => ADVANCE_TEXT.test(b.textContent.trim())) || null;
  }

  function pageInfo() {
    const h2 = document.querySelector("h2");
    const button = _nextButton();
    return { step: _step(), stepName: _progressStepName(), posting: isPosting(), url: location.href,
             heading: h2 ? h2.textContent.trim() : "", errors: _errors(), unanswered: unansweredRequired(),
             fieldCount: document.querySelectorAll(WD.widgets.formField).length,
             nextButton: button ? button.textContent.trim() : "" };
  }

  // The Review page's footer button is Submit under the same automation id; the text check is what keeps it unclicked.
  function advance() {
    if (_step() === "review") return { ok: false, reason: "review page: press Submit yourself" };
    const button = _nextButton();
    if (!button) return { ok: false, reason: "no Save and Continue button on this page" };
    const text = button.textContent.trim();
    if (/submit/i.test(text) || !ADVANCE_TEXT.test(text)) return { ok: false, reason: `the button reads "${text}", not clicking it` };
    button.click();
    return { ok: true, clicked: text };
  }

  return { isPosting, isApplication, scrape, companyOf, fill, pageInfo, advance, unansweredRequired, formFields, applyAnswers };
})();
