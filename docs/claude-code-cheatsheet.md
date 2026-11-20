# Claude Code cheat sheet

## Keys and commands
| Do this | How |
|---|---|
| Plan without editing | **Shift+Tab** cycles modes (normal → auto-accept edits → plan) |
| Stop Claude mid-turn | **Esc** |
| Rewind to an earlier point (code and/or chat) | **Esc Esc**, or `/rewind` |
| Run a shell command yourself, output into context | start the line with `!` (e.g. `!bash scripts/check.sh`) |
| Point at a file | `@path/to/file` |
| Run a skill | `/bootstrap`, `/add-feature`, `/code-challenge`, `/handoff` |
| See or edit subagents | `/agents` |
| See what's using context | `/context` |
| Usage this session | `/cost` (API) or `/usage` (plan) |
| Fresh start, same terminal | `/clear` |
| Summarize and keep going | `/compact <what to keep>` |
| Switch model | `/model` |
| Review the diff | `/code-review` or ask for the `code-reviewer` subagent |
| Edit memory files | `/memory` |

## Spending fewer tokens
- **Plan first.** A five-line plan you approve is cheaper than a wrong implementation and its undo.
- **Keep sessions short and on topic.** After a merged pull request or a topic change, `/clear` (or `/handoff`).
  Every turn re-reads the whole conversation.
- **Compact at boundaries, not mid-task:** after exploration and before building, or after a milestone.
  Say what to keep: `/compact keep the plan and the failing test names`.
- **Be specific.** "Fix the off-by-one in `pager.py:42`" beats "something's wrong with paging".
  Name files with `@` so Claude doesn't search for them.
- **Narrow test runs** while iterating (one file or one test). Run the full check before each commit.
- **Keep `CLAUDE.md` lean.** It loads every turn. Skills load only when used, and path-scoped rules
  only when matching files are touched.
- **Use subagents sparingly.** They keep noisy output out of your context but start cold. They're worth it for
  broad searches and reviews, not for small lookups.
- **Pick the model to match the work.** The strongest model is for planning and tricky bugs. A faster one is for routine edits.
- **Disable MCP servers and plugins you aren't using.** Their tool definitions take up context.

## When it goes wrong
- Claude is looping on a failure: **Esc**, then ask it to stop and explain the root cause before changing anything.
- Wrong direction: **Esc Esc** to rewind rather than arguing forward.
- Repeating the same correction: put it in `CLAUDE.md`, a rule or a skill, so it sticks.
