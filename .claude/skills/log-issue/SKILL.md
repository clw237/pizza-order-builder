---
name: log-issue
description: Use when the owner describes a bug or feature idea to log as a GitHub issue, answers an issue's open questions, or asks what's ready to build next. Covers duplicate checks, the issue layout, labels, asking or deferring open questions, and the build plan. Not for writing code.
---

# Logging bugs and feature requests as GitHub issues

This skill files and updates issues only. Don't write code, don't edit `PLAN.md`, and don't open pull
requests, close issues or comment unless the owner asks. GitHub issues and their labels are the only
list of work. Read `PLAN.md` and the Definition of Ready in `CONTRIBUTING.md` first.

## 1. For each bug or idea (often described roughly)
1. **Check for duplicates.** If it belongs on an existing issue, propose updating that one instead.
2. **Check it against the requirements** (`PLAN.md` §2 and the assumptions in `docs/ACCEPTANCE.md`)
   before filing, and tell the owner the result: which requirement it serves (R1–R6 or a Should),
   or that it is outside them. If it falls under §2.3 Won't or contradicts a numbered assumption,
   it isn't allowed as written: say which item it hits and don't file it unless the owner decides to
   change the design. Then the issue names the `PLAN.md` section it changes.
3. **Look at the relevant code** so the issue names real files and functions. Point out anything that
   conflicts with current behaviour or with `PLAN.md`.
4. **File the issue** with these sections (the forms in `.github/ISSUE_TEMPLATE/` match):
   Summary · Depends on: #N or "none" · What exists today · ⚠️ Open questions (checkboxes, each
   with a *Proposed:* answer), or ✅ Decided when there's nothing to settle · Rough design (only
   when useful) · Done when.
5. **Labels:** one type (`bug` or `enhancement`) and exactly one status: `needs-decision`, `blocked`,
   `ready` or `backlog` (`CONTRIBUTING.md`). If the labels don't exist yet, create them first.
6. **Report back briefly:** the link, the labels, the requirement check and the open questions in plain language.

## 2. Ask now or defer the open questions
End the report with a choice, asked with the AskUserQuestion tool: **Answer now** or **Defer**.
- **Answer now:** ask the questions, at most 4 per round. The first option is the issue's *Proposed:*
  answer marked "(Recommended)", followed by 1–3 real alternatives. Make each question self-contained
  by naming the issue. Never offer an "accept all proposed" shortcut: the owner reviews each answer.
- **Defer:** change nothing. The questions stay on the issue.

## 3. When the owner answers
Move each answer into the "✅ Decided" section, written as a decision rather than a question, and
update the sections it affects (Rough design, Done when). Once nothing is open, change the label
to `ready`, or to `blocked` if a dependency is still open.

## 4. When the owner asks what's next
List the open issues (leave out `backlog`) sorted into ✅ ready, ⛔ blocked (with what each waits on)
and ❓ needs a decision (with the open questions). Group the ready ones into proposed pull requests
in build order, following "Planning the work" in `CONTRIBUTING.md`, and ask the owner to approve or
regroup. Building the plan is a separate `add-feature` session.
