---
name: bootstrap
description: Use when a project made from this template has no code yet, or when the owner names the language or stack for a new project. Scaffolds the minimal project, makes scripts/check.sh pass, and fills in CLAUDE.md, permissions, CI and the first decision record.
---

# Bootstrapping a new project

Goal: the smallest project in the chosen stack where `bash scripts/check.sh` runs the formatter
check, linter, type checker (if the language has one) and tests, and passes with one real test.

**Modes.** *Fast* (timed challenge): steps 1–4 and 7 only, with no CI changes and no extra tooling.
If the owner hasn't said which mode, use full mode unless the `code-challenge` skill is running.
*Full* (a project that will last): all steps.

## 1. Choose the stack
If the owner hasn't named one, recommend one in a line and wait. Use the ecosystem's standard tools
and the current stable versions. Don't pin versions from memory. Check them with the package manager.

| Language | Project / deps | Tests | Lint / format / types |
|---|---|---|---|
| Python | `uv init`, `uv add --dev pytest ruff mypy` | `uv run pytest` | `ruff check`, `ruff format --check`, `mypy` |
| TypeScript | `npm init -y`, `npm i -D typescript vitest eslint prettier` | `npx vitest run` | `eslint .`, `prettier --check .`, `tsc --noEmit` |
| Go | `go mod init <module>` | `go test ./...` | `gofmt -l .` (must print nothing), `go vet ./...` |
| Rust | `cargo init` | `cargo test` | `cargo fmt --check`, `cargo clippy -- -D warnings` |
| Java / Kotlin | Gradle wrapper (`gradle init`) | `./gradlew test` | Spotless + the compiler's warnings |
| C# | `dotnet new sln` + `classlib` + `xunit` | `dotnet test` | `dotnet format --verify-no-changes` |

Ask before installing anything globally. Package installs prompt for permission by design.

## 2. Scaffold
- Keep the layout minimal: `src/` (or the language's convention) and `tests/`. Write one module with one
  function and one test that exercises it, ideally the first example from the problem.
- Add the stack's build output and caches to `.gitignore`.

## 3. Wire up the check
`scripts/check.sh` auto-detects the common stacks above. Run it. If it doesn't detect the project,
or runs the wrong thing, replace the detection with the exact commands for this project, in the
order format → lint → types → tests. Keep it failing fast (`set -e`).

## 4. Fill in `CLAUDE.md` and the README
- Replace every `<placeholder>` in `CLAUDE.md`: the project line, the stack, the run command and the
  one-test command. Keep it short. Anything longer than a line belongs in a skill or in `.claude/rules/`.
- If `README.md` is still the template's guide (it starts with `# claude-starter`), run
  `git mv README.md docs/TEMPLATE.md`. Then write a short project `README.md` with the project name,
  a one-line description, prerequisites, and the commands to install, run and check
  (`bash scripts/check.sh`), followed by "Built from the claude-starter template (see `docs/TEMPLATE.md`)."
  In fast mode, write the README stub now; the `code-challenge` skill fills it in at the end.
- If `CHANGELOG.md` still holds the template's own release history, replace it with the template's
  fresh header and a single `## [Unreleased]` → `### Added` → "Project created from the claude-starter
  template." line.

## 5. Permissions (full mode)
In `.claude/settings.json`, add the stack's read-only and test commands to `permissions.allow`
(e.g. `"Bash(uv run pytest *)"`) so Claude doesn't prompt for every test run. Leave installs under `ask`.

## 6. CI, security and decisions (full mode)
- `.github/workflows/ci.yml` runs `scripts/check.sh`. Add the setup step for the language (commented
  examples are in the file). Pin each action to a full commit SHA with the version in a comment.
  If you rename or add a CI job, update `required_status_checks` in `.github/rulesets/main.json`.
- Add the language's package ecosystem to `.github/dependabot.yml` (weekly, minor and patch grouped).
- Add a dependency-audit job for the language to `.github/workflows/security.yml` (`pip-audit`,
  `npm audit --audit-level=high`, `cargo audit`, `govulncheck`, `dotnet list package --vulnerable`).
- If the app sends prompts to an LLM, add the prompt folder to `EXTRA_DIRS` in `scripts/scan_agent_files.py`.
- If `scripts/check_changelog.py`'s `EXEMPT` pattern doesn't fit the layout (e.g. generated files), adjust it.
- Write `docs/decisions/0004-<language-and-stack>.md` explaining why this stack.
- Add a language rule file, `.claude/rules/<language>.md`, scoped with `paths:` to that language's files.
  It should hold only the conventions Claude would otherwise get wrong. Keep it short.

## 7. Commit
`bash scripts/check.sh` must be green. Commit as `Bootstrap <language> project`, and tell the owner
the commands in two lines. In full mode, also remind them of the one-time GitHub setup in
`docs/PRACTICES.md` ("One-time setup"): import the ruleset, create the labels, turn on secret scanning.
