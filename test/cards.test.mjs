// Sidebar cards, the chips they carry, and the sizing of the Summary field.
import test from "node:test";
import assert from "node:assert/strict";
import { loadApp, cssDecl, cssRule, indexHtml } from "./harness.mjs";

const DOC = "# Title\n\nFirst paragraph.\n\nSecond paragraph.";

function reviewing(storage) {
  const h = loadApp({ storage });
  h.app.text = DOC;
  h.app.annotations = [
    { id: 1, start: 9, end: 25, quote: "First paragraph.", type: "feedback", comment: "" },
    { id: 2, start: 27, end: 44, quote: "Second paragraph.", type: "question", comment: "" },
  ];
  return h;
}

test("the Summary card gets its own taller field; passage cards keep 34px", () => {
  // specificity: .card.summary textarea (0,2,1) beats .card textarea (0,1,1)
  const summaryMin = cssDecl(".card.summary textarea", "min-height");
  const cardMin = cssDecl(".card textarea", "min-height");
  assert.equal(cardMin, "34px", "the shared one-line height must not change");
  assert.ok(summaryMin, ".card.summary textarea has no min-height rule");
  assert.ok(/^(\d+)px$/.test(summaryMin), `unexpected value ${summaryMin}`);
  const px = parseInt(summaryMin, 10);
  assert.ok(px >= 70 && px <= 100, `~4 lines expected, got ${summaryMin}`);
  assert.ok(px > parseInt(cardMin, 10));
});

test("the taller rule does not re-declare resize, so drag-to-resize still works", () => {
  assert.equal(cssDecl(".card textarea", "resize"), "vertical");
  const overrides = cssRule(".card.summary textarea").join(";");
  assert.ok(!/resize\s*:/.test(overrides), "must not override resize");
  assert.ok(!/(^|;|\s)height\s*:/.test(overrides), "a fixed height would break resize/autogrow");
  assert.ok(!/max-height\s*:/.test(overrides), "a max-height would cap the drag");
});

test("the Summary card really carries both classes the CSS targets", () => {
  const { app } = reviewing();
  app.summary = "";
  const card = app.renderSummaryCard();
  assert.ok(card.classList.contains("card"));
  assert.ok(card.classList.contains("summary"));
  assert.equal(card.querySelectorAll("textarea").length, 1);
});

test("passage cards are plain .card <type>, so they keep the compact field", () => {
  const { app, $ } = reviewing();
  app.renderCards();
  const cards = $("cards").children.filter((c) => c.nodeType === 1);
  assert.equal(cards.length, 3); // summary + two annotations
  for (const c of cards.slice(1)) {
    assert.ok(!c.classList.contains("summary"), "a passage card must not match the taller rule");
    assert.equal(c.querySelectorAll("textarea").length, 1);
  }
});

test("every chip of every type is offered, and a click fills the field", () => {
  for (const lang of ["en", "ru"]) {
    const { app } = reviewing(lang === "ru" ? { presetLang: "ru" } : {});
    assert.equal(app.presetLang, lang);
    for (const type of ["feedback", "question", "summary"]) {
      const ta = { value: "", focus() {} };
      let changes = 0;
      const row = app.buildPresetRow(type, ta, () => changes++);
      const chips = row.querySelectorAll(".preset");
      assert.equal(chips.length, app.PRESETS[type].length, `${type}/${lang} chip count`);
      app.PRESETS[type].forEach((p, i) => {
        assert.equal(chips[i].textContent, p[lang], `${type}/${lang} chip ${i} label`);
        ta.value = "something the user typed";
        chips[i].click();
        assert.equal(ta.value, p[lang], `${type}/${lang} chip ${i} did not fill the field`);
      });
      assert.equal(changes, app.PRESETS[type].length, "each click must notify the card");
    }
  }
});

test("the cards and the floating toolbar are fed by the same chip builder", () => {
  // renderToolbarPresets() and renderSummaryCard()/renderCards() both call
  // buildPresetRow(), so new presets cannot appear in one place only.
  const src = loadApp().app.buildPresetRow.toString();
  assert.ok(src.includes("PRESETS[type]"));
  const html = indexHtml();
  const calls = html.match(/buildPresetRow\(/g) || [];
  assert.ok(calls.length >= 4, `expected the builder to be shared, found ${calls.length} uses`);
});
