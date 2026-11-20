# 0002. Claude Code permission rules are committed in `.claude/settings.json`

- Status: Accepted
- Date: 2026-11-19

## Context
Without project-level rules, what Claude Code may run depends only on each session's permission
mode. Rules written in `CLAUDE.md` ("never push to `main`", "never read `.env`") are instructions, not
enforced checks. GitHub's ruleset on `main` is the server-side gate; a local layer stops the action
before it happens.

## Decision
Commit allow / ask / deny rules in `.claude/settings.json`:
- **Deny:** force pushes (`--force`, `-f`), pushes that name `main` as the target (including
  `:refs/heads/main`), `git reset --hard`, recursive force deletes (`rm -rf` and its spellings),
  reading secret or key files (`.env` variants, `*.pem`, `*.key`, SSH keys, `~/.ssh`, `~/.aws`),
  download-and-run pipes, and `ssh` / `scp` / `nc`. `.env.example` stays readable.
- **Ask:** any `git push`, `--force-with-lease` (needed after a rebase, but a history rewrite), adding or
  removing dependencies, and edits to `.claude/`, `CLAUDE.md`, CI workflows, the ruleset and the
  guardrail scripts.
- **Allow:** the check command, the guardrail tests and the read-only git commands, so they never prompt.

## Consequences
- Rules match command text and paths, not intent. Claude Code parses `bash -c "..."` and applies `Read`
  denies to `cat`, but an interpreter (`python3 -c "open('.env')"`) isn't seen by any rule. The
  rules are a seatbelt, not a sandbox: CI and the `main` ruleset remain the real enforcement.
- New spellings of a dangerous command need a new rule. Keep the deny list next to its tests in mind
  when editing.
