# Code challenge kickoff prompt

A ready-to-paste first message for a timed coding challenge, take-home or live interview. It starts
the `code-challenge` skill with everything the session needs, so you don't spend challenge minutes
explaining the setup.

## Before you start
1. Click **Use this template** on claude-starter and create a new repository (e.g.
   `code-challenge-<company>`; private is fine). Clone it, open the folder, and run `claude`.
2. Fill in the `<placeholders>` in the prompt below and paste the challenge text at the end.
3. Skim `.claude/skills/code-challenge/SKILL.md` beforehand so you know the phases.

**Given a starter repository instead?** Skip the template. Copy `.claude/`, `CLAUDE.md` and
`scripts/check.sh` into the repository you were given, and change the "State" line to
"existing repository provided by the interviewer".

## The prompt

```text
Goal: Timed code challenge. I'm being evaluated on my judgment, communication and understanding of
the code, and I'm encouraged to use AI. I want a working, tested, explainable solution over a
feature-complete one.

Start by:
1. Reading CLAUDE.md and loading the code-challenge skill. Follow it phase by phase.
2. Restating the problem and listing inputs, outputs, edge cases and questions for the interviewer
   (each with the assumption you'll use if it goes unanswered). Wait for my answers.
3. Recommending a language (I'm strongest in <your languages>) with one alternative.
   I decide. Then run bootstrap in fast mode.

State: fresh repository from the claude-starter template. No code yet.
Time limit: <N> minutes. Started at <HH:MM>. Announce elapsed time at each phase boundary.
Evaluation criteria I was told: <criteria, or "none given">.
Working rules for this challenge: commit straight to main with small, clear commits (waiving the
branch/PR rule for this timed project). Keep the code plain enough that I can explain every line,
and explain each slice to me in two sentences after you commit it.
Open questions: none.

The challenge:
<paste the challenge here>
```

## Tips
- **If the time limit is short (under about 45 minutes),** add "Keep the plan to five lines" to the prompt.
- **Keep the session lean:** one session for the whole challenge, plan mode during the first three
  phases, and no subagents except `code-reviewer` at wrap-up.
- **For the final talk,** the skill ends with a five-point talk track: problem, approach, a decision
  you made, a trade-off, what's next. Read it before you present.
