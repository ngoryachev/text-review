// The preset chips feeding both the floating selection toolbar and the cards.
import test from "node:test";
import assert from "node:assert/strict";
import { loadApp } from "./harness.mjs";

const { app } = loadApp();
const { PRESETS } = app;

const OLD_FEEDBACK_EN = [
  "Yes", "No", "Approved", "Rejected", "Agreed", "Disagreed",
  "Delete this passage", "I'll do this myself", "Ignore",
  "Pending confirmation later", "👎", "👍", "🔥",
];

const NEW_FEEDBACK = [
  { en: "👌", ru: "👌" },
  { en: "🌚", ru: "🌚" },
  { en: "🤔", ru: "🤔" },
  { en: "This is unacceptable", ru: "это неприемлемо" },
  { en: "This is inappropriate", ru: "это неуместно" },
  { en: "This is not our area of responsibility", ru: "это не наша зона ответственности" },
  { en: "On hold for now", ru: "пока пауза" },
  { en: "The first one", ru: "первое" },
  { en: "The second one", ru: "второе" },
];

const NEW_QUESTION = [
  { en: "What are the options? (briefly)", ru: "Какие варианты? (кратко)" },
  { en: "What for? (briefly)", ru: "Зачем? (кратко)" },
  { en: "What is this? (briefly)", ru: "Что это? (кратко)" },
  { en: "Pros / cons?", ru: "плюсы / минусы?" },
];

test("every preset has non-empty en and ru text", () => {
  for (const [group, list] of Object.entries(PRESETS)) {
    for (const [i, p] of list.entries()) {
      assert.equal(typeof p.en, "string", `${group}[${i}].en`);
      assert.equal(typeof p.ru, "string", `${group}[${i}].ru`);
      assert.ok(p.en.trim(), `${group}[${i}].en is empty`);
      assert.ok(p.ru.trim(), `${group}[${i}].ru is empty`);
    }
  }
});

test("existing feedback presets keep their order and are not replaced", () => {
  assert.deepEqual(
    PRESETS.feedback.slice(0, OLD_FEEDBACK_EN.length).map((p) => p.en),
    OLD_FEEDBACK_EN,
  );
});

test("the new feedback presets are appended in the requested order", () => {
  assert.deepEqual(PRESETS.feedback.slice(OLD_FEEDBACK_EN.length), NEW_FEEDBACK);
});

test("the three new chips are emoji, same string in both languages", () => {
  for (const e of ["👌", "🌚", "🤔"]) {
    const p = PRESETS.feedback.find((x) => x.en === e);
    assert.ok(p, `${e} chip missing`);
    assert.equal(p.ru, p.en, `${e} should use the same string in RU, like 👍 👎 🔥`);
  }
});

test("an empty question still falls back to the first question preset", () => {
  // buildPrompt() uses PRESETS.question[0]; nothing may be inserted before it.
  assert.deepEqual(PRESETS.question[0], {
    en: "Explain in a couple of sentences",
    ru: "В паре предложений объясни",
  });
});

test("the new question presets are appended at the end, in order", () => {
  assert.deepEqual(PRESETS.question.slice(-NEW_QUESTION.length), NEW_QUESTION);
});

test("no duplicate chip labels inside a group (en and ru)", () => {
  for (const [group, list] of Object.entries(PRESETS)) {
    for (const lang of ["en", "ru"]) {
      const seen = list.map((p) => p[lang]);
      assert.equal(new Set(seen).size, seen.length,
        `${group}/${lang} has duplicate chips: ${seen.filter((v, i) => seen.indexOf(v) !== i)}`);
    }
  }
});

test("presetText follows the current language", () => {
  const p = PRESETS.feedback.find((x) => x.en === "On hold for now");
  app.presetLang = "en";
  assert.equal(app.presetText(p), "On hold for now");
  app.presetLang = "ru";
  assert.equal(app.presetText(p), "пока пауза");
  app.presetLang = "en";
});
