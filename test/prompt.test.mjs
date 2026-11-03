// buildPrompt() and the "Original text" checkbox that prepends the reviewed document.
import test from "node:test";
import assert from "node:assert/strict";
import { loadApp } from "./harness.mjs";

const DOC = "# Title\n\nFirst paragraph.\n\nSecond paragraph.";

function app(storage) {
  const h = loadApp({ storage });
  h.app.text = DOC;
  h.app.annotations = [
    { id: 1, start: 9, end: 25, quote: "First paragraph.", type: "feedback", comment: "no" },
    { id: 2, start: 27, end: 44, quote: "Second paragraph.", type: "question", comment: "" },
  ];
  return h;
}

test("off by default: the prompt is quote/remark pairs only", () => {
  const { app: a, $ } = app();
  assert.equal(a.includeOriginal, false);
  assert.equal($("include-original").checked, false);
  assert.equal(
    a.buildPrompt(),
    "> First paragraph.\n\nno\n\n\n> Second paragraph.\n\nExplain in a couple of sentences",
  );
});

test("on: the full document goes first under an Original text: heading", () => {
  const { app: a, $ } = app();
  $("include-original").dispatch("change", { target: { checked: true } });
  const out = a.buildPrompt();
  assert.ok(out.startsWith("Original text:\n\n" + DOC + "\n\n\n"), out.slice(0, 120));
  assert.ok(out.endsWith("> Second paragraph.\n\nExplain in a couple of sentences"));
});

test("the heading follows the preset language", () => {
  const { app: a, $ } = app();
  $("include-original").dispatch("change", { target: { checked: true } });
  a.presetLang = "ru";
  assert.ok(a.buildPrompt().startsWith("Исходный текст:\n\n" + DOC));
  a.presetLang = "en";
  assert.ok(a.buildPrompt().startsWith("Original text:\n\n" + DOC));
});

test("the original is verbatim: no 800-char truncation, unlike the quotes", () => {
  const { app: a, $ } = app();
  const long = "x".repeat(2000);
  a.text = long;
  a.annotations = [{ id: 1, start: 0, end: 2000, quote: long, type: "feedback", comment: "no" }];
  $("include-original").dispatch("change", { target: { checked: true } });
  const out = a.buildPrompt();
  assert.ok(out.includes("Original text:\n\n" + long), "the document must not be elided");
  assert.ok(out.includes("[...]"), "quoted passages are still elided at 800 chars");
});

test("an empty or whitespace-only document adds no heading", () => {
  for (const t of ["", "   \n\t "]) {
    const { app: a, $ } = app();
    a.text = t;
    a.annotations = [];
    a.summary = "looks fine";
    $("include-original").dispatch("change", { target: { checked: true } });
    assert.equal(a.buildPrompt(), "> (the whole document)\n\nlooks fine");
  }
});

test("with only a summary the original still comes first", () => {
  const { app: a, $ } = app();
  a.annotations = [];
  a.summary = "looks fine";
  $("include-original").dispatch("change", { target: { checked: true } });
  assert.equal(
    a.buildPrompt(),
    "Original text:\n\n" + DOC + "\n\n\n> (the whole document)\n\nlooks fine",
  );
});

test("the choice is persisted and restored like presetLang", () => {
  const { app: a, $, localStorage } = app();
  $("include-original").dispatch("change", { target: { checked: true } });
  assert.equal(localStorage.getItem("includeOriginal"), "1");

  const reloaded = app({ includeOriginal: "1" });
  assert.equal(reloaded.app.includeOriginal, true);
  assert.equal(reloaded.$("include-original").checked, true);
  assert.ok(reloaded.app.buildPrompt().startsWith("Original text:"));

  $("include-original").dispatch("change", { target: { checked: false } });
  assert.equal(localStorage.getItem("includeOriginal"), "0");
  assert.equal(app({ includeOriginal: "0" }).app.includeOriginal, false);
});

test("an absent or unexpected stored value means off", () => {
  for (const v of [undefined, "", "0", "true", "yes", "ru"]) {
    const store = v === undefined ? {} : { includeOriginal: v };
    assert.equal(app(store).app.includeOriginal, false, `stored ${JSON.stringify(v)}`);
  }
});

test("toggling drops the cached prompt so Compose rebuilds the preview", () => {
  const { app: a, $ } = app();
  $("compose").dispatch("click");
  const before = $("prompt-preview").value;
  assert.equal(before, a.lastGenerated);

  // a hand edit survives as long as nothing changed
  $("prompt-preview").value = before + "\n\nhand-written tail";
  $("compose").dispatch("click");
  assert.ok($("prompt-preview").value.endsWith("hand-written tail"));

  $("include-original").dispatch("change", { target: { checked: true } });
  assert.equal(a.lastGenerated, null);
  $("compose").dispatch("click");
  assert.ok($("prompt-preview").value.startsWith("Original text:\n\n" + DOC));
  assert.ok(!$("prompt-preview").value.includes("hand-written tail"));

  $("include-original").dispatch("change", { target: { checked: false } });
  $("compose").dispatch("click");
  assert.equal($("prompt-preview").value, before);
});
