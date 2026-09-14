// extension/content/fill.js
const Fill = (() => {
  // React caches the previous value on the element; resetting it forces the input event to register.
  function type(el, value) {
    const proto = el instanceof HTMLTextAreaElement ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype;
    if (el._valueTracker) el._valueTracker.setValue("");
    Object.getOwnPropertyDescriptor(proto, "value").set.call(el, value);
    el.dispatchEvent(new Event("input", { bubbles: true }));
  }

  // Search boxes keep their popup open only while focused, so they get type() alone and no blur.
  function setValue(el, value) {
    type(el, value);
    el.dispatchEvent(new Event("change", { bubbles: true }));
    el.dispatchEvent(new Event("blur", { bubbles: true }));
  }

  function pressEnter(el) {
    for (const kind of ["keydown", "keypress", "keyup"]) {
      el.dispatchEvent(new KeyboardEvent(kind, { key: "Enter", code: "Enter", keyCode: 13, which: 13, bubbles: true }));
    }
  }

  function b64ToFile(b64, name, type = "application/pdf") {
    const bin = atob(b64); const bytes = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
    return new File([bytes], name, { type });
  }

  function setFiles(input, files) {
    const dt = new DataTransfer();
    files.forEach(f => dt.items.add(f));
    input.files = dt.files;
    input.dispatchEvent(new Event("change", { bubbles: true }));
  }

  const sleep = ms => new Promise(r => setTimeout(r, ms));

  async function waitFor(selector, ms = 4000) {
    const end = Date.now() + ms;
    while (Date.now() < end) { const el = document.querySelector(selector); if (el) return el; await sleep(100); }
    return null;
  }

  function labelFor(el) {
    const id = el.getAttribute("id");
    const lab = id ? document.querySelector(`label[for="${CSS.escape(id)}"]`) : el.closest("label");
    return (lab?.textContent || el.getAttribute("aria-label") || el.getAttribute("placeholder") || "").trim().toLowerCase();
  }

  return { type, setValue, pressEnter, b64ToFile, setFiles, sleep, waitFor, labelFor };
})();
