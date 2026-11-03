---
name: text-review
description: Collect structured human feedback on a plan, draft, or any text before proceeding. Opens a local browser UI where the user annotates passages with feedback (verdicts, change requests) or questions (explanation requests, with quick presets) and returns a composed markdown feedback prompt. Use when the user should review or steer a plan/answer you produced. Defaults to reviewing the last assistant message if no text is specified.
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

The output is a plain sequence of items separated by blank lines: a passage of
your text quoted with `>`, then the user's remark about it. If the user enabled
the **Original text** option, the prompt begins with an `Original text:` (or
`Исходный текст:`) heading followed by the whole reviewed document verbatim,
before the first quoted passage — that block is context, not a remark; the
items to act on start after it. The user may have
edited the prompt by hand before sending, so read it as a whole, not as a fixed
template. Remarks may be in English or Russian — answer each one in its own
language. Process the items in order and read each remark literally — it is what
the user wants for that passage:

- **Feedback** — a verdict or an instruction:
  - "yes" / "approved" / "agreed" (or "да" / "подтверждаю" / "согласен") — the
    user approves that passage; keep it as it is;
  - "no" / "rejected" / "disagreed" (or "нет" / "отклоняю" / "не согласен") —
    the user rejects or objects to that idea; drop it or rethink it;
  - "delete this passage" (or "удали этот участок") — remove that passage from
    the text;
  - "I'll do this myself" (or "сделаю") — the user takes that item on
    themselves; leave the passage as it is and do not act on it;
  - "this is unacceptable" (or "это неприемлемо") — a hard rejection: that
    passage must not stay in any form; drop it and propose something else;
  - "this is inappropriate" (or "это неуместно") — the idea may be fine, but not
    here; remove it from this place (or move it where it belongs);
  - "this is not our area of responsibility" (or "это не наша зона
    ответственности") — out of scope for us: take it out of the plan and, if it
    still matters, note it as someone else's to own;
  - "on hold for now" (or "пока пауза") — do not work on that item yet; leave
    the passage and mark it as paused;
  - "the first one" / "the second one" (or "первое" / "второе") — the user picks
    that option from the alternatives offered in that passage; proceed with it
    and drop the others;
  - 👍 / 🔥 / 👌 — approval of that passage (🔥 enthusiastic, 👌 "fine as is");
    👎 — rejection, same as "no"; 🤔 — doubt rather than a verdict: explain or
    rethink that passage and check back; 🌚 — skeptical / unimpressed, treat it
    as a soft "no" and ask what bothers them if it is not obvious;
  - anything else ("rename this to X", "add a fallback here") — apply it to that
    passage.
- **Question** — a request to explain the passage; follow the requested form
  exactly:
  - "explain in a couple of sentences" — 2–4 sentences;
  - "1. explain and 2. propose a solution" — a short explanation, then a concrete
    proposal;
  - "explain with a metaphor" / "explain it like I'm five" — use that style;
  - "explain this with a mermaid diagram, pack the diagram into a clickable link"
    — write the mermaid source and provide it as a clickable link (for example a
    mermaid.live or mermaid.ink URL with the encoded diagram), so the user can
    open it on any device.
  - "propose three options (A/B/C) to choose from" — three alternatives with a
    one-line rationale each, then wait for the user to pick one;
  - "what are the downsides?" / "how?" / "why?" / "rationale?" (or "какие
    минусы?" / "как?" / "почему?" / "обоснование?") — answer that exact
    question about the passage in 2–4 sentences;
  - "what are the options? (briefly)" (or "какие варианты? (кратко)") — list the
    alternatives for that passage, one short line each, no deep dive;
  - "what for? (briefly)" / "what is this? (briefly)" (or "зачем? (кратко)" /
    "что это? (кратко)") — the purpose of, or what that passage is, in one or
    two sentences; "(briefly)" is a hard constraint — do not expand;
  - "pros / cons?" (or "плюсы / минусы?") — two short lists, pros and cons of
    what that passage proposes.

After addressing every item, produce the revised text (or the answers) and,
if substantial changes were made, offer to run another review round.
