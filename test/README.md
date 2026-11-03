# Tests

`index.html` is a single file with one inline `<script>` and no build step, so
the tests extract that script and run it against a hand-rolled DOM stub
(`harness.mjs`). No browser, no dependencies — `node:test` only.

```bash
npm test          # or: node --test
```

- `presets.test.mjs` — the preset chips: both languages, order, the fallback
  used by an empty Question.
- `prompt.test.mjs` — `buildPrompt()` and the **Original text** checkbox
  (prepended document, language of the heading, persistence, cache invalidation).
- `cards.test.mjs` — sidebar cards, chip clicks, the taller Summary field.
- `persistence.test.mjs` — draft autosave, tabs, history round-trip.
- `docs-and-build.test.mjs` — `golang/index.html` and `skill/text-review` are in
  sync with the UI, and `README.md` / `skill/SKILL.md` describe what it does.

`harness.mjs` reaches into the page's internals through an epilogue appended to
the extracted script, so renaming a top-level function there means updating it.
