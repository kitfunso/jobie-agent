// extension/answer-bank.js
// Pure functions over the bank kept under chrome.storage.local.answers: no DOM and no chrome API, so a plain page can test them.
const AnswerBank = (() => {
  const STOPWORDS = new Set(["the", "and", "you", "your", "for", "are", "this", "that", "with", "have", "has", "does", "please",
    "what", "which", "any", "from", "our", "will", "can", "into", "about", "yes", "not"]);

  function keyOf(label) {
    return String(label || "").toLowerCase().replace(/[^\p{L}\p{N}\s]/gu, " ").replace(/\s+/g, " ").trim();
  }

  function words(text) {
    return keyOf(text).split(" ").filter(w => w.length > 2 && !STOPWORDS.has(w));
  }

  // Profile-owned fields and uploads never enter the bank; the profile and the PDFs already cover them.
  function askable(field) {
    return !field.profile && field.kind !== "file" && !!keyOf(field.label);
  }

  // A field Workday already filled from a saved draft was not asked of the user this time: it enters the bank only
  // once it was seen empty, so the waiting list never shows questions the user is not being asked.
  function recordAsked(bank, fields, company, now) {
    const out = { ...bank };
    for (const f of fields.filter(askable)) {
      const key = keyOf(f.label);
      if (f.value && !out[key]) continue;
      const prev = out[key] || { question: f.label, answer: "", source: "", asked: 0, first_seen: now };
      out[key] = { ...prev, kind: f.kind, options: f.options && f.options.length ? f.options : prev.options || [],
                   required: !!f.required || !!prev.required, company: company || prev.company || "",
                   asked: (prev.asked || 0) + 1, last_seen: now };
    }
    return out;
  }

  // company travels along because a page can grow a field after recordAsked ran (seen live: the privacy checkbox on
  // Voluntary Disclosures rendered late) and the entry made here is then the only one.
  function recordAnswers(bank, fields, answers, source, now, company = "") {
    const out = { ...bank };
    const byId = new Map(fields.map(f => [f.id, f]));
    for (const a of answers || []) {
      const f = byId.get(a.id);
      const value = a.value === null || a.value === undefined ? "" : String(a.value).trim();
      if (!f || !askable(f) || !value) continue;
      const key = keyOf(f.label);
      const prev = out[key] || { question: f.label, kind: f.kind, options: f.options || [], required: !!f.required, company, asked: 1, first_seen: now };
      out[key] = { ...prev, answer: value, source, last_used: now };
    }
    return out;
  }

  // A saved answer reaches a field with options only when it equals one of them: "No" must never pick "No, needs sponsorship".
  function optionFor(field, answer) {
    if (!field.options || !field.options.length) return answer;
    const lower = answer.toLowerCase();
    return field.options.find(o => o.toLowerCase() === lower) || null;
  }

  function matches(bank, fields) {
    const hits = [];
    const misses = [];
    for (const f of fields.filter(askable)) {
      if (f.value) continue;
      const entry = bank[keyOf(f.label)];
      if (!entry || !entry.answer) continue;
      const value = optionFor(f, entry.answer);
      if (value) hits.push({ id: f.id, value });
      else misses.push(`${f.label}: saved answer "${entry.answer}" is not one of ${f.options.join(", ")}`);
    }
    return { hits, misses };
  }

  // Only answers whose question shares a word with an open field go to the model: it needs the paraphrases, not the whole bank.
  function known(bank, fields) {
    const openWords = new Set(fields.filter(f => askable(f) && !f.value).flatMap(f => words(f.label)));
    return Object.values(bank)
      .filter(e => e.answer && words(e.question).some(w => openWords.has(w)))
      .map(e => ({ question: e.question, answer: e.answer }))
      .slice(0, 40);
  }

  function setAnswer(bank, key, answer, now) {
    const entry = bank[key];
    if (!entry) return bank;
    return { ...bank, [key]: { ...entry, answer: String(answer || "").trim(), source: "user", last_used: now } };
  }

  function waiting(bank) { return Object.values(bank).filter(e => !e.answer && e.required); }
  function answered(bank) { return Object.values(bank).filter(e => !!e.answer); }

  return { keyOf, askable, recordAsked, recordAnswers, matches, known, setAnswer, waiting, answered };
})();
