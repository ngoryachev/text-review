// Regression cover for what the new header checkbox sits next to: the draft
// autosave, the history entries and the tabs must still round-trip.
import test from "node:test";
import assert from "node:assert/strict";
import { loadApp } from "./harness.mjs";

const DOC = "# Title\n\nFirst paragraph.\n\nSecond paragraph.";
const ANNS = [
  { id: 1, start: 9, end: 25, quote: "First paragraph.", type: "feedback", comment: "no" },
  { id: 2, start: 27, end: 44, quote: "Second paragraph.", type: "question", comment: "why?" },
];

test("the draft survives a reload, with the original-text choice", () => {
  const first = loadApp();
  first.app.startReview(DOC);
  first.app.annotations = ANNS.map((a) => ({ ...a }));
  first.app.summary = "overall fine";
  first.$("include-original").dispatch("change", { target: { checked: true } });
  first.app.saveDraft();

  const draft = JSON.parse(first.localStorage.getItem("reviewDraft"));
  assert.equal(draft.v, 2);
  assert.equal(draft.tabs.length, 1);

  const seed = Object.fromEntries(first.localStorage._map);
  const second = loadApp({ storage: seed });
  assert.equal(second.app.text, DOC);
  assert.deepEqual(second.app.annotations, ANNS);
  assert.equal(second.app.summary, "overall fine");
  assert.equal(second.app.includeOriginal, true);
  assert.ok(second.app.buildPrompt().startsWith("Original text:\n\n" + DOC));
});

test("a draft from before the checkbox existed still loads", () => {
  const legacy = JSON.stringify({
    v: 2,
    active: "t1",
    tabs: [{ id: "t1", name: "", custom: false, stage: "review", text: DOC,
             annotations: ANNS, summary: "", nextId: 3, localEntryId: null }],
  });
  const { app } = loadApp({ storage: { reviewDraft: legacy } });
  assert.equal(app.text, DOC);
  assert.deepEqual(app.annotations, ANNS);
  assert.equal(app.includeOriginal, false);
});

test("a second tab keeps its own text and annotations", () => {
  const h = loadApp();
  h.app.startReview(DOC);
  h.app.annotations = ANNS.map((a) => ({ ...a }));
  h.$("tab-add").dispatch("click");
  assert.equal(h.app.text, "");
  assert.deepEqual(h.app.annotations, []);

  const draft = JSON.parse(h.localStorage.getItem("reviewDraft"));
  assert.equal(draft.tabs.length, 2);
  assert.equal(draft.tabs[0].text, DOC);
  assert.equal(draft.tabs[0].annotations.length, 2);

  const back = loadApp({ storage: Object.fromEntries(h.localStorage._map) });
  const restored = JSON.parse(back.localStorage.getItem("reviewDraft"));
  assert.equal(restored.tabs.length, 2);
});

test("Copy stores a history entry holding the composed prompt", async () => {
  const h = loadApp();
  h.app.startReview(DOC);
  h.app.annotations = ANNS.map((a) => ({ ...a }));
  h.$("include-original").dispatch("change", { target: { checked: true } });
  h.$("compose").dispatch("click");
  h.$("copy-btn").dispatch("click");
  await new Promise((r) => setImmediate(r));

  const entries = JSON.parse(h.localStorage.getItem("reviewHistory"));
  assert.equal(entries.length, 1);
  assert.equal(entries[0].title, "Title");
  assert.equal(entries[0].count, 2);
  assert.equal(entries[0].text, DOC);
  assert.ok(entries[0].prompt.startsWith("Original text:\n\n" + DOC),
    "the stored prompt is what the user saw in the preview");
});

test("a history entry opens read-only, with the Summary shown as text", async () => {
  const h = loadApp();
  h.app.startReview(DOC);
  h.app.annotations = ANNS.map((a) => ({ ...a }));
  h.app.summary = "overall fine";
  h.$("compose").dispatch("click");
  h.$("copy-btn").dispatch("click");
  await new Promise((r) => setImmediate(r));

  const entries = JSON.parse(h.localStorage.getItem("reviewHistory") || "[]");
  assert.equal(entries.length, 1);
  h.$("history-btn").dispatch("click");
  const items = h.$("history-list").querySelectorAll(".hist-item");
  assert.equal(items.length, 1);
  assert.ok(items[0].textContent.includes("Title"));
});
