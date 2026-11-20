# Pizza Order Builder

Take-home exercise: a pizza order builder (web UI) and a separate order service, for interview graders.
Stack: TypeScript, npm workspaces, Fastify (service), Vite + React (web), zod, vitest.

- **Design:** `PLAN.md`. **Decisions:** `docs/decisions/`. **Process:** `CONTRIBUTING.md`.
- **Commands.** Keep these current. Claude runs them; it doesn't guess them.
  - Check everything (format, lint, types, tests): `bash scripts/check.sh`
  - Run the app: `npm run service` and `npm run web` (two terminals), then open http://localhost:5173
  - Run one test: `npx vitest run <file> -t "<test name>"`
- **Skills.** New project or empty repo: `bootstrap`. Any code change: `add-feature`.
  Logging bugs and ideas as issues: `log-issue`. Timed interview or code challenge: `code-challenge`.
  Switching to unrelated work or a long break: `handoff`.
- **Subagents** (`.claude/agents/`): `planner` (read-only plan), `code-reviewer` (read-only review),
  `build-fixer` (smallest fix for a red check).

## Rules that always apply

- Before writing code for anything larger than a one-file change, write a plan. If the owner is present, wait for them to approve it.
- Write tests first or with the code. A change is done only when `bash scripts/check.sh` passes.
- Never skip, disable or loosen a test, lint rule or check to get green. Fix the cause. Coverage
  floors only go up and ignore lists only shrink.
- Keep diffs small and on topic. Don't refactor unrelated code. Before adding a dependency, say why.
- Never guess an API, a flag or a fact. Read the code or docs, or ask.
- Tests never call the real network. Use fakes and fixtures.
- Keep secrets out of git (`.env` is ignored; `.env.example` lists the names). Never read `.env`.
- Never edit a released `CHANGELOG.md` section. Tag a release only when the owner asks (`RELEASING.md`).
- Never commit to `main` or force-push. Work on a branch and open a pull request. The owner may waive this for a throwaway or timed project.
- When the owner corrects you and the correction should stick, update the existing text in place
  (this file, a skill, a rule or a decision record) rather than appending a second version.
