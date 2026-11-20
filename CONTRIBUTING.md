# Contributing

Most changes here are made by Claude Code sessions for the owner. The same rules are in `CLAUDE.md`
and the skills under `.claude/skills/`. This file is the human-readable overview. `docs/PRACTICES.md`
explains why each practice exists.

| Question | Where the answer lives |
|---|---|
| What should it do and how is it built? | `PLAN.md` |
| Why was it built that way? | `docs/decisions/` (one short record per significant choice) |
| What's open, ready or blocked? | GitHub issues and their labels (below) |
| What changed, and in which version? | `CHANGELOG.md` and the GitHub releases (`RELEASING.md`) |

## How work flows
1. **An issue** describes the bug or feature (the issue forms fill in the layout; the `log-issue`
   skill files issues for the owner). Its open questions are decided, and it becomes `ready`.
2. **The work is planned** ("Planning the work" below) and the owner approves the plan.
3. **A branch and a pull request** build it (`add-feature` skill): `feature/<name>`, `fix/<name>` or
   `chore/<name>`, never `main`. For each slice, write a test, make it pass, run
   `bash scripts/check.sh`, then commit.
4. **Review:** the `code-reviewer` subagent (or `/code-review`) on the diff, then a check in the
   running app.
5. **CI passes** (`check`, `changelog`; the Security workflow reports too) and the owner merges.
   Nobody merges their own pull request unless the owner says so.

## Issue labels
Each issue has one type label (`bug` or `enhancement`) and exactly one status label:

| Label | Meaning |
|---|---|
| `needs-decision` | Has unresolved open questions. Not ready |
| `blocked` | Questions settled, but it waits on another open issue (its "Depends on" line) |
| `ready` | Questions settled and dependencies closed. Can be built |
| `backlog` | Wanted someday, not in the next round. Skipped until relabeled |

- **Dependencies** go in a "Depends on: #N" line near the top. An issue is ready only once every
  issue it depends on is closed.
- When open questions are answered, move them into the issue's **Decided** section and change the label.
- Milestones are optional. Use one per release if you want to see how far it has got.
- Create the labels once per repository (GitHub UI → Issues → Labels, or `gh label create <name>`).

## Planning the work
When the owner asks for "what's next" or a set of issues, Claude plans before writing any code:
1. **Collect** the open issues, leaving out `backlog`, and sort them into ready, blocked (with what
   each waits on) and needs a decision (with the open questions). Only the ready ones are planned.
2. **Group** the ready issues. Issues that touch the same code or depend on each other share one pull
   request. Grouping is the default; an issue that shares nothing is a group of one.
3. **Size check:** split a group into a short chain of pull requests when it would pass roughly
   4 issues or about 600 changed lines (tests excluded), or when it mixes parts that are easier to
   review separately (a schema change and a UI change, say).
4. **Order** the groups so dependencies come first.
5. **The owner approves** or regroups the plan before any code is written. Each pull request closes its
   issues (`Closes #N`, one line per issue).

## Definition of Ready
An issue can be built when:
- It says what's wanted and why, and has a **Done when** that can be checked.
- It has no open questions left (they're in its **Decided** section), and it's labeled `ready`.
- Every issue in its "Depends on" line is closed.
- It fits in one pull request (or its group's), or it says how it splits.
- It fits `PLAN.md`, or it says which part of the design it changes.

## Definition of Done
A change is done when:
- Its issue's **Done when** is met, and it has been checked in the running app, not just in tests.
- Tests cover it. Coverage floors only go up and lint or type-check ignore lists only shrink: never
  lower or extend them to get green.
- `bash scripts/check.sh` passes locally, and every CI check is green on the pull request's **current
  head**, with the branch up to date with `main`.
- The `code-reviewer` subagent (or `/code-review`) was run on the diff, and its findings were fixed or answered.
- `CHANGELOG.md` has a line under `[Unreleased]` for anything a user would notice. The `changelog`
  check enforces this; a commit line `Changelog: none` marks a change with nothing to notice.
- `PLAN.md` and `docs/decisions/` are updated if the design or a significant choice changed.
- The owner merged the pull request, and it closed its issues.

**Green on the merged head.** After merging `main` into a pull request, wait for CI on that new head
before calling it ready. When one pull request merges, re-check the other open ones against the new
`main`. The ruleset in `.github/rulesets/` enforces this once it's imported.

## Writing documents
- **Design changes** go in `PLAN.md`, in the section they belong to. Keep section numbers stable, since
  issues and commits cite them (`§4.2`). When content moves, leave the heading with a pointer.
- **Decisions** get a record in `docs/decisions/`. Records aren't rewritten; a new one supersedes an old one.
- **Status doesn't go in documents.** Don't write "built", "merged" or "in progress" in `PLAN.md` or the
  README. Issues, releases and the changelog hold status. Prose status always goes stale.
- **Batch doc edits:** one commit for a set of related changes, not one per line.

## Commit messages
A short imperative title (`Add CSV parser`, `Fix off-by-one in pager`), then what changed and why.
Optional trailer lines: `Changelog: none` when nothing visible changed.

## Working with Claude Code
- Keep `CLAUDE.md` short. Detail belongs in skills (loaded on demand) and `.claude/rules/` (scoped by path).
- Use plan mode (Shift+Tab) for anything non-trivial, and approve the plan before any edits.
- Start a fresh session (the `handoff` skill) instead of dragging a long one into unrelated work.
- Read every line Claude writes before it's merged. If you can't explain it, ask Claude to explain or simplify it.
