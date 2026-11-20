# 0003. Agent guardrails: CI enforces, two light hooks, an agent-file scan

- Status: Accepted
- Date: 2026-11-19

## Context
Large Claude Code harness frameworks (e.g. ECC: dozens of agents, hundreds of skills, many hooks)
make one strong point: the safety boundary is the policy between the model and the action, not the
prompt. Installing such a framework wholesale loads every skill and agent description each session,
runs third-party code on nearly every tool call, and brings rules that conflict with the project's.

## Decision
- **Adopt the ideas in a small, reviewed form**, not a framework.
- **CI is the enforcement point.** `ci.yml` runs `scripts/check.sh` and a `changelog` job that fails a
  pull request which changes code without a `CHANGELOG.md` line (unless a commit says
  `Changelog: none`) or leaves the `[Unreleased]` headings repeated or out of order.
- **Two project hooks, both fail-safe.** A PostToolUse hook formats the edited file. A Stop hook runs
  the same changelog check and asks Claude, at most once per stop, to add the line. It only looks at
  committed work and never fails a session (`|| exit 0`).
- **Agent files are supply chain.** The Security workflow's `agent-files` job
  (`scripts/scan_agent_files.py`) checks `CLAUDE.md` and `.claude/` for hidden Unicode, HTML comments,
  encoded payloads, download-and-run lines, network tools aimed at other hosts, risky settings,
  broad allow rules, and any hook that isn't a script inside this repository.
- **The `main` ruleset is kept as code** (`.github/rulesets/main.json`) and imported once.

## Consequences
- Guardrail scripts use only the Python standard library, so they run anywhere `python3` exists.
  They have their own tests (`scripts/tests/`), which run in CI.
- Not adopted: auto-learning memory (auto-written rules can be poisoned; lasting rules are approved
  by the owner), many specialised agents and model routing (each description costs context every
  session), gates on every edit (token cost with thin evidence), and kill switches or telemetry
  (there are no unattended loops to stop).
