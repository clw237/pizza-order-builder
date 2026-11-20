# Changelog

All notable changes to this project. Format: [Keep a Changelog](https://keepachangelog.com/en/1.1.0/).
Headings, in this order: Added, Changed, Fixed, Removed, Security, Development.

<!-- This file holds the claude-starter template's own history. The bootstrap skill replaces it with
     a fresh changelog when a new project is created from the template. -->

## [Unreleased]
### Added
- `docs/code-challenge-kickoff.md`: a ready-to-paste first message for timed code challenges.

### Changed
- The README no longer features the code challenge workflow; it's listed once as an optional skill.

## [1.0.0] - 2026-11-19
### Added
- `docs/PRACTICES.md`: every practice in the template, what it does and why.
- Branch rules for `main` as code (`.github/rulesets/`), with an import guide.
- Security workflow: gitleaks secret scan and a scan of `CLAUDE.md` and `.claude/` for hidden or risky content.
- Changelog check in CI and as a Stop hook (`scripts/check_changelog.py`), with `Changelog: none` as the opt-out.
- Tests for the guardrail scripts (`scripts/tests/`), run in CI.
- `log-issue` skill, issue forms with Depends on / Open questions / Decided / Done when, and status labels.
- Definition of Ready and Definition of Done, planning rules for grouping issues, and documentation rules in `CONTRIBUTING.md`.
- `SECURITY.md`, `RELEASING.md`, and generic pre-commit hooks.
- Decision records for the permission rules (0002) and the agent guardrails (0003).

### Changed
- `add-feature` now groups related issues, checks the change in the running app, and enforces green CI on the merged head.
- The pull request template has a checklist.
- A fuller blocked-command list: more `rm -rf` spellings, `:refs/heads/main` pushes, `ssh`/`scp`/`nc`; asks before `--force-with-lease`.

## [0.1.0] - 2026-11-19
### Added
- First public release: a lean `CLAUDE.md`, path-scoped rules, the `bootstrap`, `add-feature`,
  `code-challenge` and `handoff` skills, `planner`, `code-reviewer` and `build-fixer` subagents, a
  format-on-edit hook, safety permissions, `scripts/check.sh` shared with CI, `PLAN.md`, decision
  records, a Claude Code cheat sheet, Dependabot, and issue and pull request templates.

[Unreleased]: https://github.com/clw237/claude-starter/compare/v1.0.0...HEAD
[1.0.0]: https://github.com/clw237/claude-starter/compare/v0.1.0...v1.0.0
[0.1.0]: https://github.com/clw237/claude-starter/releases/tag/v0.1.0
