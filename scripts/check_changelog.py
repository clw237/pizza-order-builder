"""Check that a branch which changes code also adds a CHANGELOG.md line.

Two ways to run it:

- CI: ``check_changelog.py --base origin/main --head <sha>`` fails when the pull request changes
  code but not ``CHANGELOG.md``.
- Claude Code Stop hook: ``check_changelog.py --hook`` reads the hook input on stdin and, once the
  branch has commits that change code, asks Claude (at most once per stop) to add the line or say
  why none is needed. It never fails the session: any error means "say nothing".

"Code" is every changed file except the ones ``EXEMPT`` matches (docs, tests, CI and agent config).
A change that needs no line (a pure refactor, test-only work) says so with a ``Changelog: none``
line in any commit message on the branch.

Both also check the ``## [Unreleased]`` headings: each of Added, Changed, Fixed, Removed, Security
and Development at most once, in that order, and no other ``###`` heading. Merging ``main`` into a
branch otherwise leaves repeated headings behind. Standard library only.
See docs/decisions/0003-agent-guardrails.md.
"""

from __future__ import annotations

import argparse
import json
import os
import re
import shutil
import subprocess
import sys
from collections.abc import Iterable

# Changed files that never need a changelog line. Edit to suit the project.
EXEMPT = re.compile(
    r"(^|/)(tests?|__tests__|spec|docs)/"
    r"|\.(test|spec)\.[a-z]+$|(^|/)test_[^/]+$|_test\.[a-z]+$"
    r"|\.md$|^\.github/|^\.claude/|^\.gitignore$|^\.gitattributes$|^\.editorconfig$"
    r"|^\.pre-commit-config\.yaml$|^\.env\.example$|(^|/)__pycache__/"
)
OPT_OUT = re.compile(r"^\s*Changelog:\s*none\b", re.IGNORECASE | re.MULTILINE)
CHANGELOG = "CHANGELOG.md"
DEFAULT_BRANCH = "main"
# The [Unreleased] headings, in the order the CHANGELOG.md header lists them.
HEADINGS = ("Added", "Changed", "Fixed", "Removed", "Security", "Development")
UNRELEASED = re.compile(r"^## \[Unreleased\][ \t]*$", re.MULTILINE)
SECTION = re.compile(r"^## ", re.MULTILINE)
SUBHEADING = re.compile(r"^###[ \t]+(.*?)[ \t]*$", re.MULTILINE)


def code_files(changed: Iterable[str]) -> list[str]:
    """The changed files that call for a changelog line."""
    return sorted({path for path in changed if not EXEMPT.search(path)})


def problem(changed: Iterable[str], messages: str) -> str | None:
    """Why the branch needs a changelog line, or None when it's fine."""
    changed = list(changed)
    if CHANGELOG in changed or OPT_OUT.search(messages):
        return None
    files = code_files(changed)
    if not files:
        return None
    shown = ", ".join(files[:5]) + (f" and {len(files) - 5} more" if len(files) > 5 else "")
    return (
        f"This branch changes code ({shown}) but not {CHANGELOG}. Add a line under "
        "## [Unreleased] (Added / Changed / Fixed / Removed / Security / Development), or, if "
        "nothing changes that a user would notice (a pure refactor or test-only change), put "
        "'Changelog: none' on its own line in a commit message on this branch."
    )


def heading_problem(changelog: str) -> str | None:
    """What's wrong with the [Unreleased] headings, or None when they're fine."""
    start = UNRELEASED.search(changelog)
    if not start:
        return None
    end = SECTION.search(changelog, start.end())
    section = changelog[start.end() : end.start() if end else len(changelog)]
    found = [match.group(1) for match in SUBHEADING.finditer(section)]
    issues = [
        f"'### {name}' isn't one of the six headings" for name in found if name not in HEADINGS
    ]
    known = [name for name in found if name in HEADINGS]
    issues += [
        f"'### {name}' appears {known.count(name)} times"
        for name in HEADINGS
        if known.count(name) > 1
    ]
    if not issues and known != sorted(known, key=HEADINGS.index):
        issues.append(f"the headings are out of order ({', '.join(known)})")
    if not issues:
        return None
    return (
        f"{CHANGELOG} [Unreleased]: {'; '.join(issues)}. Use each of "
        f"{', '.join(HEADINGS)} at most once, in that order, and move the lines under the "
        "existing heading (merging main into a branch often leaves a second one)."
    )


def _join(*problems: str | None) -> str | None:
    found = [p for p in problems if p]
    return " ".join(found) or None


GIT = shutil.which("git") or "git"


def _git(*args: str, cwd: str | None = None) -> str:
    # Fixed git subcommands built here; the only inputs are commit names and paths.
    return subprocess.run(  # noqa: S603
        [GIT, *args], cwd=cwd, check=True, capture_output=True, text=True, timeout=20
    ).stdout


def _lines(text: str) -> list[str]:
    return [line for line in text.splitlines() if line.strip()]


def check_range(base: str, head: str, cwd: str | None = None) -> str | None:
    """The problem for the commits on head that aren't on base (as in a pull request).

    Pass the base *branch* (``origin/main``), not the pull request's recorded base commit, so that
    commits merged in from main don't count as the branch's own.
    """
    changed = _lines(_git("diff", "--name-only", f"{base}...{head}", cwd=cwd))
    messages = _git("log", "--format=%B", f"{base}..{head}", cwd=cwd)
    try:
        changelog = _git("show", f"{head}:{CHANGELOG}", cwd=cwd)
    except subprocess.CalledProcessError:  # no CHANGELOG.md on head
        changelog = ""
    return _join(problem(changed, messages), heading_problem(changelog))


def check_worktree(cwd: str | None = None, main: str = f"origin/{DEFAULT_BRANCH}") -> str | None:
    """The problem for the current branch's commits.

    Only committed code changes count, so the hook stays quiet while work is still in progress; a
    changelog edit counts whether it's committed or not.
    """
    if _git("rev-parse", "--abbrev-ref", "HEAD", cwd=cwd).strip() in {DEFAULT_BRANCH, "HEAD"}:
        return None
    base = _git("merge-base", "HEAD", main, cwd=cwd).strip()
    committed = _lines(_git("diff", "--name-only", base, "HEAD", cwd=cwd))
    if CHANGELOG in _lines(_git("diff", "--name-only", base, cwd=cwd)):
        committed.append(CHANGELOG)
    messages = _git("log", "--format=%B", f"{base}..HEAD", cwd=cwd)
    path = os.path.join(_git("rev-parse", "--show-toplevel", cwd=cwd).strip(), CHANGELOG)
    try:
        with open(path, encoding="utf-8") as file:
            changelog = file.read()
    except OSError:
        changelog = ""
    return _join(problem(committed, messages), heading_problem(changelog))


def run_hook(stdin_text: str) -> str:
    """Stop hook output: a JSON 'block' decision with the reason, or '' to say nothing."""
    try:
        data = json.loads(stdin_text or "{}")
        # Claude is already continuing because of a stop hook: never ask twice in a row.
        if data.get("stop_hook_active"):
            return ""
        cwd = os.environ.get("CLAUDE_PROJECT_DIR") or data.get("cwd") or None
        reason = check_worktree(cwd=cwd)
    except Exception:  # noqa: BLE001 - a reminder must never break the session
        return ""
    if not reason:
        return ""
    return json.dumps({"decision": "block", "reason": reason})


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description=(__doc__ or "").splitlines()[0])
    parser.add_argument("--hook", action="store_true", help="run as a Claude Code Stop hook")
    parser.add_argument("--base", help="base branch, e.g. origin/main (CI)")
    parser.add_argument("--head", help="head commit (CI)")
    args = parser.parse_args(argv)

    if args.hook:
        output = run_hook(sys.stdin.read())
        if output:
            print(output)
        return 0

    if not (args.base and args.head):
        parser.error("--base and --head are required unless --hook is given")
    reason = check_range(args.base, args.head)
    if reason:
        print(f"::error file={CHANGELOG}::{reason}")
        return 1
    print("Changelog check passed.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
