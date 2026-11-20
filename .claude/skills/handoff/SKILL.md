---
name: handoff
description: Use when a fresh session would cost less than continuing this one - a pull request just merged and the next work is unrelated, the session was compacted, the owner is back after a long break, or exploration is done and a long build is next. Writes a short kickoff prompt for the new session.
---

# Handing off to a new session

**The goal is to save usage.** Every turn of a long session re-reads everything before it, and the
session gets less sharp after each compaction. A new session that starts from a short, exact prompt is
cheaper and more reliable. Claude judges the timing. The owner may also ask.

## 1. Decide
- **Good moments:** a merged pull request before unrelated work, a switch of topic, after a
  compaction, after a long break (the cache has expired anyway), exploration finished before a long build.
- **Not worth it:** a short session, or a next step that depends on something you just read that isn't
  written down yet. Write it down first.
- Suggest it once. If the owner says to carry on, carry on.

## 2. Make sure nothing lives only in this session
- Code is committed and pushed. The pull request says what's done and what's left.
- Decisions are recorded where they belong: `CLAUDE.md`, a skill, `.claude/rules/`, `docs/decisions/`, or an issue.

## 3. Write the kickoff prompt
Keep it short and standalone, and point at files rather than repeating them. No secrets.

```text
Goal: <one or two sentences>.
Start by: reading CLAUDE.md, loading <skill>, then <first concrete step>.
State: <branch / pull request / issue numbers, and what's left on each>.
Decided (recorded in <file>): <one line each>.
Open questions: <one line each, or "none">.
```

Give it to the owner in a `text` block to paste into a new session (`/clear` also works in the
same terminal) and say this session can be closed.
