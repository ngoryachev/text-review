# text-review

A minimal "code review for text" tool: paste or pipe in a text (an AI-generated
plan, an answer), annotate passages in a local browser UI, and get back a
composed markdown feedback prompt readable by both humans and AI. Designed to
speed up the feedback loop in AI systems.

Annotation types:

- **Feedback** — your verdict on a passage or what to change (comment required)
- **Question** — ask to explain a passage (optional; an empty question defaults to
  "Explain in a couple of sentences")

Both types come with one-click presets under the comment field (Feedback: yes / no /
approved / rejected / agreed / disagreed; Question: brief explanation, explanation + solution,
metaphor, "like I'm five", mermaid diagram packed into a clickable link). A preset
replaces the field content and can be edited further. The **RU presets** checkbox in
the header switches the presets to Russian (English by default; the choice is
remembered in the browser). The type of an existing annotation can be changed from
its card without re-selecting the passage, and the composed prompt can be edited
directly before copying or sending.

The CLI blocks until you click **Send to CLI & finish** in the browser, then
prints the prompt to stdout — so `feedback=$(...)` works; all logs go to stderr.

## Layout

| Path | What it is |
|---|---|
| `review.py` + `index.html` | Python variant (stdlib only); `review.py` serves `index.html` from its own directory |
| `golang/` | Go variant: `go:embed`s its own copy of `index.html` into a single static binary |
| `skill/` | Claude Code skill (`SKILL.md` + the Go binary) |
| `sample.md` | Sample text to play with |

`index.html` also works fully standalone: open it directly in a browser
(file://), paste a text, annotate, and copy the prompt from the Compose dialog
(the "Send to CLI" button is hidden when there is no server).

## Usage

```bash
./review.py plan.md                  # or: golang/text-review plan.md
cat plan.md | ./review.py            # stdin
./review.py                          # empty paste field in the UI
./review.py plan.md --port 8377 --no-open
golang/text-review --port 8377 --no-open plan.md   # Go: flags go before the file
```

Exit codes: `0` — prompt printed to stdout; `1` — input error; `130` — cancelled (Ctrl+C).

## Building the Go binary

```bash
cd golang
cp ../index.html index.html          # sync the embedded UI copy
CGO_ENABLED=0 go build -ldflags "-s -w" -o text-review .
```

## Installing the skill

```bash
cp -r skill ~/.claude/skills/text-review
```

The skill runs the bundled binary with a long timeout and interprets the
returned feedback prompt (see `skill/SKILL.md`).
