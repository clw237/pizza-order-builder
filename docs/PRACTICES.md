# Practices

Each practice in this template: what it does, why it's there, and where it lives or is enforced.
Most came from building a real project with Claude Code, where each rule was learned from a mistake.
Several ideas are adapted from [affaan-m/ECC](https://github.com/affaan-m/ECC) (MIT).

**Contents:** [How Claude works](#1-how-claude-works) · [Quality](#2-quality) ·
[Guardrails](#3-guardrails) · [Planning and issues](#4-planning-and-issues) ·
[Documents](#5-documents) · [Releases](#6-releases) · [One-time setup](#one-time-setup)

## 1. How Claude works

| Practice | What it does | Why | Where |
|---|---|---|---|
| **Lean memory** | `CLAUDE.md` holds only the commands and the rules that always apply | It's re-read every turn, so every line costs tokens and dilutes attention | `CLAUDE.md` |
| **Skills on demand** | Workflows (bootstrap, add-feature, log-issue, code-challenge, handoff) live in skills | Only a one-line description loads until a skill is used | `.claude/skills/` |
| **Rules scoped by path** | Coding style, security, testing. Testing rules load only when test files are touched | Detail without paying for it on every turn | `.claude/rules/` |
| **Few, scoped subagents** | `planner` and `code-reviewer` are read-only; `build-fixer` can only fix a red check | Narrow tools give focused results. Each agent description costs context, so there are only three | `.claude/agents/` |
| **Plan before code** | Anything beyond a one-file change gets a short plan the owner approves | A five-line plan is cheaper than a wrong implementation and its undo | `CLAUDE.md`, `add-feature` |
| **Corrections stick** | When the owner corrects Claude, the existing rule, skill or doc is updated in place | The same correction never has to be given twice, and there's never two versions of a rule | `CLAUDE.md` |
| **Fresh sessions** | Start a new session from a short prompt after merges, topic switches, compactions or breaks | Long sessions re-read everything each turn and get less sharp after compaction | `handoff` skill |

## 2. Quality

| Practice | What it does | Why | Where |
|---|---|---|---|
| **One definition of done** | `scripts/check.sh` runs format, lint, types and tests | Claude, you and CI agree on what "done" means. Nobody guesses commands | `scripts/check.sh`, `ci.yml` |
| **Test first, small slices** | Write a failing test, make it pass, run the check, commit | Every commit is green and reviewable, so a bad step is easy to undo | `add-feature`, `.claude/rules/testing.md` |
| **Never loosen a check** | No skipped tests or weakened rules. Coverage floors only go up and ignore lists only shrink | Under pressure, an agent will "fix" a red build by weakening the check | `CLAUDE.md`, `build-fixer` |
| **Format on edit** | A hook formats each file right after Claude edits it | Formatting noise never reaches review or CI | `.claude/hooks/format.sh` |
| **Check in the running app** | Exercise the change the way a user would before the pull request | Passing tests don't prove the feature works end to end | `add-feature` §4, pull request checklist |
| **Evidence-gated review** | The reviewer reports only findings with a cited line and a concrete failure | Noisy reviews get ignored, and inflated severity erodes trust | `.claude/agents/code-reviewer.md` |
| **Green on the merged head** | After merging `main` into a branch, wait for CI on the new head | A branch merged before CI ran on the result once turned `main` red | `CONTRIBUTING.md`, the ruleset |

## 3. Guardrails

| Practice | What it does | Why | Where |
|---|---|---|---|
| **Permission rules** | Deny force-push, pushes to `main`, `rm -rf`, reading `.env` and keys. Ask before installs and pushes | Rules in prose are requests. Permissions stop the action before it happens | `.claude/settings.json`, decision 0002 |
| **`main` ruleset as code** | Pull requests only, required CI, up-to-date branches, resolved threads | The server-side gate that holds even if local rules are bypassed. Versioned so it's reviewed like code | `.github/rulesets/` |
| **Secret scan** | gitleaks scans every push and pull request | A leaked key has to be rotated, and history keeps it forever | `security.yml`, `SECURITY.md` |
| **Agent files are supply chain** | Scans `CLAUDE.md` and `.claude/` for hidden Unicode, HTML comments, encoded payloads, download-and-run lines, broad permissions and foreign hooks | Claude follows these files. A hidden instruction changes what it does without a reviewer noticing | `scripts/scan_agent_files.py`, decision 0003 |
| **Fail-safe hooks** | Hooks never block a session on error (`\|\| exit 0`), and only run scripts inside the repository | A broken or malicious hook shouldn't be able to stop or hijack work | `.claude/settings.json` |
| **Pinned actions and Dependabot** | Every GitHub Action is pinned to a commit SHA, and Dependabot proposes updates weekly | A moved tag can't swap in different code, and pins don't go stale | `.github/workflows/`, `dependabot.yml` |
| **Pre-commit hooks** | Whitespace, syntax, merge markers, large files and private keys, checked before each commit | Cheap mistakes are caught before they cost a CI run | `.pre-commit-config.yaml` |

## 4. Planning and issues

| Practice | What it does | Why | Where |
|---|---|---|---|
| **Issues are the work list** | GitHub issues and labels are the only record of what's open. No to-do lists in files | Lists in files go stale and disagree with the tracker | `CONTRIBUTING.md` |
| **Status labels** | `needs-decision` → `ready` / `blocked`, plus `backlog` | You can see at a glance what can be built now | `CONTRIBUTING.md`, issue forms |
| **Open questions with proposed answers** | Each question carries a *Proposed:* answer. Answers move to a **Decided** section | Decisions are made once, on the record, and the issue stays readable | `log-issue`, issue forms |
| **Definition of Ready / Done** | Explicit entry and exit criteria for every issue | Half-specified work stalls mid-build, and "done" otherwise means different things to different people | `CONTRIBUTING.md` |
| **Group related issues** | Issues that touch the same code share a pull request, with a size check (about 4 issues or 600 lines) | Fewer conflicts and reviews, without pull requests too big to read | `CONTRIBUTING.md` "Planning the work" |

## 5. Documents

| Practice | What it does | Why | Where |
|---|---|---|---|
| **One design doc** | `PLAN.md` is the source of truth, updated in the same change as the design | The design can't drift from the code | `PLAN.md` |
| **Decision records** | One short, never-rewritten record per significant choice | Answers "why is it like this?" months later, for people and for Claude | `docs/decisions/` |
| **No status in prose** | No "built", "merged" or "in progress" in documents | Prose status always goes stale. Issues and releases hold it | `CONTRIBUTING.md` |
| **Stable section numbers** | `PLAN.md` sections keep their numbers, and moved content leaves a pointer | Issues and commits cite them (`§4.2`) | `PLAN.md`, `CONTRIBUTING.md` |

## 6. Releases

| Practice | What it does | Why | Where |
|---|---|---|---|
| **Enforced changelog** | Code changes need a line under `[Unreleased]` or a `Changelog: none` commit line. Headings are checked for repeats and order | Release notes write themselves, and merges don't leave the changelog in a mess | `scripts/check_changelog.py`, CI, Stop hook |
| **Released sections are frozen** | Never edit a released `CHANGELOG.md` section, and never move a tag | Release notes have to match what was released | `RELEASING.md`, `CLAUDE.md` |
| **Releases on request** | A release pull request, then a tag and GitHub release, only when the owner asks | Releasing is the owner's decision, not the agent's | `RELEASING.md` |

## One-time setup
After creating a repository from this template (bootstrap reminds you):
1. **Import the ruleset:** Settings → Rules → Rulesets → Import → `.github/rulesets/main.json`.
2. **Create the labels:** `needs-decision`, `blocked`, `ready`, `backlog` (`bug` and `enhancement` exist by default).
3. **Turn on security features:** Settings → Code security → secret scanning, push protection,
   Dependabot alerts and private vulnerability reporting.
4. *(Optional)* **Install pre-commit:** `uvx pre-commit install` (or `pipx run pre-commit install`).
