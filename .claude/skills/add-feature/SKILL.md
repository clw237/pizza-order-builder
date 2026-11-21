---
name: add-feature
description: Use when starting, building or finishing any code change (feature, fix, refactor), including work on GitHub issues. Covers planning and grouping issues, branching, tests, the check, checking in the running app, review, changelog and the pull request.
---

# Adding a feature or fix

## 1. Understand and plan
- Read each issue in full, including comments. If an issue is unclear, too big, or conflicts with
  `PLAN.md`, say so and ask. Don't silently narrow it. Check it meets the Definition of Ready in
  `CONTRIBUTING.md`.
- For several issues, follow "Planning the work" in `CONTRIBUTING.md`: group the ones that touch the same
  code into one pull request, apply the size check, and put the groups in build order.
- For anything beyond a one-file change, write a short plan (use plan mode, or the `planner` subagent
  when the codebase is large): files to touch, tests to add, risks. **Wait for the owner's approval.**
- If the work changes the design, update `PLAN.md` in the same branch. For a significant choice, add a
  record in `docs/decisions/`.
- Ideas outside the scope go in the pull request's "Follow-ups" section, not into extra code.

## 2. Branch
`git checkout main && git pull`, then `feature/<name>`, `fix/<name>` or `chore/<name>`. Start the name with the
issue number when there is one (`fix/42-empty-input`). If the session assigns a branch, use it as given
and put the issue numbers in the pull request title.

## 3. Build: test first, small steps
1. Write a failing test that describes the behaviour (Arrange, Act, Assert). A bug fix starts with a
   test that reproduces the bug.
2. Write the simplest code that passes it.
3. Refactor while green.
4. Run `bash scripts/check.sh`, then commit. Repeat for each slice.
- Fix the code, not the test, unless the test is wrong. Never skip, disable or loosen a check. Coverage
  floors only go up, and ignore lists only shrink.
- Don't let tests touch the network. Use fakes and fixtures.

## 4. Check it for real
- Run the app (the run command in `CLAUDE.md`) and exercise the change the way a user would: the
  command, the page, the API call. Note what you checked for the pull request's "How it was tested".
- Run the `code-reviewer` subagent (or `/code-review`) on the branch diff and fix what it finds.
- Re-read the diff yourself: no debug output, no commented-out code, no unrelated changes.

## 5. Finish
- Add a line under `## [Unreleased]` in `CHANGELOG.md` (Added / Changed / Fixed / Removed / Security /
  Development) for anything a user would notice, with the issue number. Use each heading once, in that
  order. When nothing visible changed, put `Changelog: none` on its own line in a commit message instead.
  The `changelog` CI job and the Stop hook check this. Never edit a released section.
- Push with `git push -u origin <branch>` and open a pull request against `main`, never against another
  branch (a stacked pull request merges into the branch below it, not `main`). Fill in every section of the template,
  with `Closes #N` (one line per issue), or `Refs #N` for partial work, saying what's left.
- Wait for CI to go green on the current head. If it fails, reproduce it with `bash scripts/check.sh`,
  fix it and push. After merging `main` into the branch, wait for CI again.
- Never merge your own pull request unless the owner says to.
