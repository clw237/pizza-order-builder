# 0001. Start from the claude-starter template

- Status: Accepted
- Date: <YYYY-MM-DD>

## Context
New projects are built mostly by Claude Code with an owner reviewing. Without guardrails, sessions
drift: they guess commands, skip tests, bloat context and repeat the same corrections.

## Decision
Start from claude-starter. It provides a lean `CLAUDE.md`, on-demand skills (bootstrap, add-feature,
code-challenge, handoff), read-only review and plan subagents, path-scoped rules, a format hook,
safety permissions and a single check entry point (`scripts/check.sh`) shared by Claude and CI.

## Consequences
- Every session runs the same check, so "done" means the same thing to Claude, CI and the owner.
- The template is deliberately small. Add a skill, agent or rule only after the same correction or
  process has come up twice.
