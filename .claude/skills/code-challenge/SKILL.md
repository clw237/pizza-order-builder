---
name: code-challenge
description: Use for a timed coding challenge, take-home or live interview exercise where the owner is being evaluated, from reading the prompt to the final README. Covers clarifying, choosing the language, timeboxing, building in tested slices, and presenting the work and how AI was used.
---

# Timed code challenge

The evaluator is judging the **owner**: their judgment, their communication and whether they understand
the code. Optimize for a working, tested, explainable solution over a feature-complete one. The owner
must be able to explain every line, so keep code plain and ask before doing anything clever.

Ask the owner for the **time limit** and for anything they've been told about **evaluation criteria**,
then budget the time (shown here for 60 min):

| Phase | Share | 60 min |
|---|---|---|
| 1. Understand | 10% | 6 |
| 2. Set up | 5–10% | 5 |
| 3. Plan | 5–10% | 5 |
| 4. Build in slices | 55–60% | 34 |
| 5. Wrap up | 15% | 10 |

At each phase boundary, give the elapsed time and what's next in one line. If a phase overruns,
say so and propose a cut, not more scope.

## 1. Understand
- Restate the problem in three or four sentences. List inputs, outputs, constraints and **edge cases**
  (empty input, duplicates, very large input, invalid data, ties, ordering).
- List the ambiguities as **questions for the interviewer**, each with the assumption you'll use if it
  goes unanswered. The owner asks; record the answers or assumptions in `PLAN.md` §3 and §6.
- Pin down what "done" looks like: the examples given in the prompt become the first tests.

## 2. Set up
- **Language:** the one the owner is fastest and most fluent in, unless the problem or the evaluator
  clearly favors another. Give your recommendation and one alternative in a single line. The owner decides.
- Run the `bootstrap` skill in its **fast** mode: the minimal project, a test runner, one passing test,
  `bash scripts/check.sh` green, first commit. Don't polish the setup.
- If the owner allows it, work straight on `main` with small commits for the challenge (the commit history
  is part of the submission).

## 3. Plan
- Fill in `PLAN.md` §1–§5 tersely. §5 is a list of **slices** in order: first a walking skeleton
  (input → output end to end), then core logic, then edge cases, then extras.
- State the core algorithm or data structure and its time and space complexity in one line.
- Mark which slices are "must" and which you'll cut if time runs short. Get the owner's OK and start.

## 4. Build in slices
For each slice:
1. Write the test(s) first, from the prompt's examples and the edge cases.
2. Write the simplest code that passes. No speculative abstraction, no unused configurability.
3. Run `bash scripts/check.sh`.
4. Commit with a clear message (`Add parser for order lines`, `Handle empty input`).
5. In two sentences, tell the owner what changed and why, so they can narrate it.

Guidelines while building:
- Handle errors explicitly at boundaries (input parsing, I/O). Fail with a clear message, not a stack trace.
- Name things for the domain in the prompt. Keep functions small and pure where possible.
- If the check goes red and the fix isn't obvious within a couple of minutes, use the `build-fixer` subagent.
- If a slice is taking twice its budget, stop and offer the owner a simpler approach or a cut.

## 5. Wrap up (start on time, even mid-slice)
- Stop adding features. Make sure the last commit is green and runs from a clean clone.
- Run the `code-reviewer` subagent on the whole diff. Fix only correctness and clarity findings.
- Write `README.md` with these sections, each short:
  - **Run it:** install, run and test commands, copy-pasteable.
  - **Approach:** the design in a few sentences, the key data structure or algorithm, complexity.
  - **Assumptions:** from `PLAN.md` §6.
  - **Trade-offs and what I'd do next:** what was cut and why, what you'd improve with more time
    (scale, persistence, validation, more tests).
  - **How I used AI:** what Claude did (scaffolding, tests, review) and what the owner decided
    or checked (requirements, design, reading every diff). Be honest and specific. Evaluators value
    judgment about AI more than avoidance of it.
- Give the owner a five-point talk track: problem, approach, a decision they made, a trade-off,
  what's next.

## Keeping token use low during the challenge
- Plan mode for phases 1–3. Normal mode for building.
- Keep files short. Don't re-read what's already in context. Run the narrowest test while iterating
  and the full check before each commit.
- Don't spawn subagents for small things. They start cold and re-read everything.
