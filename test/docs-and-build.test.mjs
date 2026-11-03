// The UI is shipped three times over (index.html, golang/index.html embedded in
// the binary, skill/text-review) and described in two docs. Keep them in step.
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { loadApp, indexHtml } from "./harness.mjs";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const read = (p) => readFileSync(join(ROOT, p), "utf8");
const html = indexHtml();
const { app } = loadApp();

test("golang/index.html is the same file the UI is developed in", () => {
  assert.equal(read("golang/index.html"), html,
    "run: cp index.html golang/index.html && rebuild the Go binary");
});

test("the binary in skill/ is the one built from golang/", () => {
  assert.ok(readFileSync(join(ROOT, "golang/text-review")).equals(
    readFileSync(join(ROOT, "skill/text-review"))),
    "run: cp golang/text-review skill/text-review");
});

test("the Original text checkbox sits in the header legend next to RU presets", () => {
  const legend = html.match(/<div class="legend">([\s\S]*?)<\/div>/)[1];
  assert.ok(legend.includes('id="preset-ru"'));
  assert.ok(legend.includes('id="include-original"'));
  assert.ok(legend.indexOf('id="preset-ru"') < legend.indexOf('id="include-original"'),
    "it should follow the RU presets checkbox");
  assert.ok(/<label class="lang"[^>]*>\s*<input type="checkbox" id="include-original">\s*[^<]*\S/
    .test(legend), "the checkbox needs a visible label");
});

test("SKILL.md tells the reading AI how to interpret every new chip", () => {
  const skill = read("skill/SKILL.md").toLowerCase().replace(/\s+/g, " ");
  const added = [
    ...app.PRESETS.feedback.slice(13),
    ...app.PRESETS.question.slice(12),
  ];
  for (const p of added) {
    for (const lang of ["en", "ru"]) {
      assert.ok(skill.includes(p[lang].toLowerCase()),
        `SKILL.md does not document ${lang} chip "${p[lang]}"`);
    }
  }
});

test("SKILL.md warns that the prompt may start with the reviewed document", () => {
  const skill = read("skill/SKILL.md");
  assert.ok(/Original text:/.test(skill));
  assert.ok(/Исходный текст:/.test(skill));
  assert.ok(/context, not a remark/i.test(skill),
    "the heading block must be marked as context rather than an instruction");
});

test("README describes the checkbox and the taller Summary field", () => {
  const readme = read("README.md");
  assert.ok(/Original text/.test(readme));
  assert.ok(/off by default/i.test(readme));
  assert.ok(/remembered in the browser/i.test(readme));
  assert.ok(/Summary/.test(readme));
  for (const e of ["👌", "🌚", "🤔"]) assert.ok(readme.includes(e), `README omits ${e}`);
});
