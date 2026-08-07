---
name: text-review
description: Collect structured human feedback on a plan, draft, or any text before proceeding. Opens a local browser UI where the user annotates passages (edit requests, questions, A/B/C option requests, rejected ideas) and returns a composed markdown feedback prompt. Use when the user should review or steer a plan/answer you produced. Defaults to reviewing the last assistant message if no text is specified.
---

# Text Review

This skill collects annotated human feedback on a text via a local browser UI.
The bundled `text-review` binary (in this skill's directory) starts a server on
127.0.0.1, opens the browser, blocks until the user finishes annotating, then
prints a markdown feedback prompt to **stdout** and exits.

## How to use

1. Determine the text to review. If the user did not specify one, **default to
   your most recent substantive assistant message** (the last plan, draft, or
   answer you produced in this conversation). Write that text to a temporary
   file.
2. Run the binary from this skill's directory. It blocks while the user
   annotates — always use the maximum Bash timeout (600000 ms), or
   `run_in_background` and collect the output when it finishes:

   ```bash
   feedback=$("$SKILL_DIR/text-review" /path/to/draft.md)
   ```

   Piping also works: `... | "$SKILL_DIR/text-review"`. Running with no
   argument opens an empty paste field in the UI — use that only as a
   fallback when the conversation has no suitable assistant message yet.
3. Exit codes: `0` — feedback collected (stdout holds the prompt);
   `130` — the user closed the session without submitting (Ctrl+C);
   treat it as "no feedback, do not proceed with assumptions".

## How to interpret the output

The output is a self-describing markdown prompt with numbered items, each
quoting a passage of your text. Process the items in order:

- **Edit** — apply the requested change to that passage.
- **Question** — briefly (2–4 sentences) explain what that passage means and
  how it works; an optional **Question** line narrows what to focus on.
- **3 options (A/B/C)** — propose three alternative solutions with a one-line
  rationale each, then wait for the user to pick a direction. An optional
  **Problem** line describes what bothers the user.
- **Reject** — the user rejects that idea: drop it and propose a different
  approach. The instruction may carry the reason why it does not work.

After addressing every item, produce the revised text (or the answers) and,
if substantial changes were made, offer to run another review round.
