# claude-starter

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
[![Use this template](https://img.shields.io/badge/GitHub-Use%20this%20template-2ea44f?logo=github)](https://github.com/clw237/claude-starter/generate)

**A small, language-agnostic starter template for projects built with [Claude Code](https://code.claude.com/docs).**

AI coding sessions tend to drift. They guess commands, skip tests, bloat their context, and repeat
mistakes you already corrected. This template gives every new project the same set of guardrails:

- **Plan first.** Claude writes a short plan, and you approve it before any code changes.
- **Test as you go.** Work happens in small, tested slices, each one committed green.
- **One definition of done.** `scripts/check.sh` runs format, lint, types and tests. It's the same for Claude, for you and for CI.
- **Lean context.** Only essentials load every turn. Skills and rules load when they're needed.
- **Guardrails, not just guidelines.** Permissions and hooks enforce the rules that matter.

It works with any language. Python, TypeScript/JavaScript, Go, Rust, Java/Kotlin (Gradle) and C#/.NET
are detected automatically, and anything else takes a few lines in `scripts/check.sh`.

---

## Quick start

1. Click **[Use this template](https://github.com/clw237/claude-starter/generate)** to create your repository, then clone it.
2. In the project folder, start Claude Code:
   ```bash
   claude
   ```
3. Tell Claude what you're building and in which language, then run:
   ```text
   /bootstrap
   ```
   Claude scaffolds a minimal project, makes `bash scripts/check.sh` pass with a real test, and fills in
   `CLAUDE.md`. It also moves this guide to `docs/TEMPLATE.md` and writes your project's own `README.md`.
4. For every change after that:
   ```text
   /add-feature <what you want>
   ```
5. One-time GitHub setup (about two minutes):
   - Import the branch ruleset: Settings → Rules → Rulesets → Import → `.github/rulesets/main.json`.
   - Create the labels `needs-decision`, `blocked`, `ready` and `backlog`.
   - Turn on secret scanning, push protection and private vulnerability reporting.

   Details are in [`docs/PRACTICES.md`](docs/PRACTICES.md#one-time-setup).

**Requirements:** [Claude Code](https://code.claude.com/docs), git, bash (on Windows, Git Bash, which
Claude Code uses there), Python 3 for the guardrail scripts (standard library only), and your
language's toolchain. [`jq`](https://jqlang.org/) is optional.

## Practices at a glance

Each practice is here because of a real mistake. [`docs/PRACTICES.md`](docs/PRACTICES.md) explains
what each one does, why it's there, and where it's enforced.

| Area | Practices |
|---|---|
| **How Claude works** | Lean `CLAUDE.md`. Skills and path-scoped rules that load only when needed. Three narrow subagents. Plan before code. Corrections update the rule in place. Fresh sessions over long ones |
| **Quality** | One check script for everyone. Test-first slices with green commits. Never loosen a check (coverage floors only go up). Format on edit. Check in the running app. Evidence-gated review. CI green on the merged head |
| **Guardrails** | Committed permission rules. `main` ruleset kept as code. gitleaks secret scan. A scan of `CLAUDE.md` and `.claude/` for hidden or risky content. Fail-safe hooks. SHA-pinned actions with Dependabot. Pre-commit hooks |
| **Planning and issues** | Issues are the only work list. Status labels. Open questions with proposed answers. Definition of Ready and Done. Related issues grouped per pull request, with a size check |
| **Documents and releases** | One design doc. Decision records. No status in prose. Enforced, well-formed changelog. Frozen released sections. Releases only on request |

## How work flows

```mermaid
flowchart LR
    A[Request or issue] --> B[Plan<br/>you approve]
    B --> C[Write a failing test]
    C --> D[Code until green]
    D --> E{scripts/check.sh}
    E -- red --> F[build-fixer] --> E
    E -- green --> G[Commit]
    G -- next slice --> C
    G -- done --> H[code-reviewer] --> I[Pull request<br/>CI runs the same check]
```

## What's inside

| Path | Purpose | When it loads |
|---|---|---|
| [`CLAUDE.md`](CLAUDE.md) | Project memory: what this is, the commands, the rules that always apply | Every turn, so it stays short |
| [`.claude/rules/`](.claude/rules) | Coding style, security, testing (testing is scoped to test files with `paths:`) | Automatically, by path |
| [`.claude/skills/bootstrap`](.claude/skills/bootstrap/SKILL.md) | Choose a stack, scaffold it, wire up the check, fill in the placeholders | `/bootstrap` |
| [`.claude/skills/add-feature`](.claude/skills/add-feature/SKILL.md) | Plan, branch, test first, check, review, pull request | `/add-feature` |
| [`.claude/skills/code-challenge`](.claude/skills/code-challenge/SKILL.md) | *Optional:* a timeboxed workflow for take-homes and interviews ([kickoff prompt](docs/code-challenge-kickoff.md)) | `/code-challenge` |
| [`.claude/skills/handoff`](.claude/skills/handoff/SKILL.md) | When and how to start a fresh, cheaper session | `/handoff` |
| [`.claude/skills/log-issue`](.claude/skills/log-issue/SKILL.md) | File bugs and ideas as well-formed issues, settle their open questions, and plan what's next | `/log-issue` |
| [`.claude/agents/planner.md`](.claude/agents/planner.md) | Read-only implementation plan for larger changes | Delegated |
| [`.claude/agents/code-reviewer.md`](.claude/agents/code-reviewer.md) | Read-only review that reports only findings tied to a cited line and a concrete failure | Delegated |
| [`.claude/agents/build-fixer.md`](.claude/agents/build-fixer.md) | Smallest fix for a red check, and never loosens a test | Delegated |
| [`.claude/settings.json`](.claude/settings.json) | Allows the check and basic git; asks before installs, pushes and config edits; denies force-push, `rm -rf` and reading secrets | Always |
| [`.claude/hooks/format.sh`](.claude/hooks/format.sh) | Formats each file after Claude edits it, if a formatter is installed | After every edit |
| [`scripts/check.sh`](scripts/check.sh) | The definition of done: format check, lint, types, tests | You, Claude, CI |
| [`PLAN.md`](PLAN.md) | Design doc: goal, requirements, edge cases, approach, build order | |
| [`docs/decisions/`](docs/decisions) | Short records of significant choices | |
| [`docs/claude-code-cheatsheet.md`](docs/claude-code-cheatsheet.md) | Shortcuts, commands and habits that save tokens | |
| [`docs/PRACTICES.md`](docs/PRACTICES.md) | Every practice: what it does, why, and where it's enforced | |
| [`scripts/check_changelog.py`](scripts/check_changelog.py) | Fails a pull request (and prompts Claude at stop) when code changes without a changelog line | CI, Stop hook |
| [`scripts/scan_agent_files.py`](scripts/scan_agent_files.py) | Scans `CLAUDE.md` and `.claude/` for hidden characters, payloads, risky settings and foreign hooks | Security workflow |
| [`.github/workflows/`](.github/workflows) | `ci.yml` (check, guardrail tests, changelog) and `security.yml` (gitleaks, agent-file scan) | Every push and pull request |
| [`.github/rulesets/main.json`](.github/rulesets) | Branch protection for `main` as code: pull requests only, required checks, up-to-date branches | Imported once |
| [`.github/`](.github) | Dependabot, issue forms (Depends on / Open questions / Decided / Done when), pull request template with checklist | |
| [`CONTRIBUTING.md`](CONTRIBUTING.md) | Work flow, labels, planning, Definition of Ready and Done, documentation rules | |
| [`SECURITY.md`](SECURITY.md) · [`RELEASING.md`](RELEASING.md) | Private vulnerability reporting and what's in place; how to cut a release | |
| [`.pre-commit-config.yaml`](.pre-commit-config.yaml) | Fast checks before each commit: whitespace, syntax, merge markers, large files, private keys | Optional |

Personal overrides that stay out of git go in `CLAUDE.local.md` and `.claude/settings.local.json`. Both are gitignored.

## Customizing

- **Your stack:** after `/bootstrap`, `scripts/check.sh` holds the exact commands. Edit it freely. CI runs whatever it says.
- **Permissions:** add your test and lint commands to `permissions.allow` in `.claude/settings.json` so Claude stops asking about them.
- **Conventions:** put language-specific conventions in `.claude/rules/<language>.md` with a `paths:` scope.
- **Workflows:** add a skill under `.claude/skills/<name>/SKILL.md` once the same process has come up twice.
- **Corrections:** when you correct Claude and it should stick, have it edit `CLAUDE.md`, the rule or the skill in place.

## Principles

1. **Don't overcomplicate.** Configuration is fine-tuning, not architecture. Grow the setup only when a need repeats.
2. **Context is precious.** Keep always-loaded text minimal, and start fresh sessions between unrelated tasks.
3. **Verify, don't trust.** Nothing is done until the check is green and you've read the diff.
4. **Enforce what matters.** If a rule must never be broken, make it a permission or a hook, not a sentence.

## FAQ

**Does it work without GitHub?** Yes. Everything except `.github/` works locally with plain git.

**I use another language.** Run `/bootstrap`. If the check script doesn't detect your stack, Claude
writes the exact commands into `scripts/check.sh`.

**Why does `scripts/check.sh` fail on a fresh copy?** There's no project yet. It tells you to run
bootstrap. CI skips the check until a project manifest exists, so the template itself stays green.

**Can I use only part of it?** Yes. Each file stands alone. Copy the `.claude/` folder and
`scripts/check.sh` into an existing repository, then run `/bootstrap` to adapt them.

## Contributing

Issues and pull requests are welcome, especially stack recipes for `bootstrap` and `scripts/check.sh`,
and fixes that keep the template small. Please keep changes language-agnostic and explain the
problem they solve. Versions are tagged in the [releases](https://github.com/clw237/claude-starter/releases).

## Credits

Several patterns are adapted from [affaan-m/ECC](https://github.com/affaan-m/ECC) (MIT):
- A lean memory file, with modular rules alongside it.
- Subagents scoped to specific tasks, mostly read-only.
- The reviewer's confidence gate.
- Formatting hooks that run after each edit.
- Compacting at strategic moments.

This template keeps a deliberately small core instead of ECC's full catalogue.

## License

[MIT](LICENSE)
