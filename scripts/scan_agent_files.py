"""Scan the files that instruct Claude for hidden or risky content.

Claude reads these files as instructions, so they are part of the supply chain: a hidden character,
an HTML comment or a "download and run" line can change what an agent does without a reviewer
noticing. Scanned: ``CLAUDE.md``, everything under ``.claude/`` and any folder in ``EXTRA_DIRS``
(add your app's prompt folder there). Run by the Security workflow; exits 1 when anything is found.
Standard library only. See docs/decisions/0003-agent-guardrails.md.
"""

from __future__ import annotations

import json
import re
import sys
from pathlib import Path
from typing import NamedTuple

REPO = Path(__file__).resolve().parents[1]
TEXT_SUFFIXES = {".md", ".json", ".txt", ".yml", ".yaml", ".py", ".sh"}
# Other folders whose files Claude is sent or follows, e.g. "src/prompts".
EXTRA_DIRS: tuple[str, ...] = ()

# Zero-width, bidi-control and other invisible format characters.
HIDDEN = re.compile("[­​-‏‪-‮⁠-⁤⁦-⁩﻿]")
HTML_COMMENT = re.compile(r"<!--")
ENCODED = re.compile(r"data:[a-z]+/[a-z0-9.+-]+;base64,|\bbase64\s+(-d|--decode)\b", re.IGNORECASE)
PIPE_TO_SHELL = re.compile(
    r"\b(curl|wget|iwr|irm)\b[^\n|]*\|\s*(ba|z)?sh\b|\|\s*iex\b", re.IGNORECASE
)
REMOTE_TOOL = re.compile(r"(^|[\s`(])(curl|wget|nc|ncat|scp|ssh)\s", re.IGNORECASE)
LOCAL_TARGET = re.compile(r"\b(localhost|127\.0\.0\.1)\b")

# The only hook command shapes allowed: a script inside this repository (.claude/hooks/ or
# scripts/), run through bash or python, with failures optionally ignored.
HOOK_COMMAND = re.compile(
    r'^(bash|python3?|uv run --no-project python) "\$CLAUDE_PROJECT_DIR/'
    r'(\.claude/hooks|scripts)/[\w-]+\.(sh|py)"( --[\w-]+)*( 2>/dev/null)?( \|\| exit 0)?$'
)
# Settings keys that widen what an agent can reach.
RISKY_SETTINGS = ("enableAllProjectMcpServers", "ANTHROPIC_BASE_URL", "bypassPermissions")
BROAD_ALLOW = re.compile(
    r"^(Bash|Read|Edit|Write|WebFetch)(\(\*\))?$|^Bash\((curl|wget|ssh|scp|nc)\b"
)


class Finding(NamedTuple):
    path: str
    line: int
    message: str

    def __str__(self) -> str:
        return f"{self.path}:{self.line}: {self.message}"


def files_to_scan(root: Path = REPO) -> list[Path]:
    paths = [root / "CLAUDE.md"]
    for folder in (root / ".claude", *(root / d for d in EXTRA_DIRS)):
        if folder.is_dir():
            paths += [p for p in folder.rglob("*") if p.is_file() and p.suffix in TEXT_SUFFIXES]
    return sorted(p for p in paths if p.is_file() and "settings.local" not in p.name)


def scan_text(rel: str, text: str) -> list[Finding]:
    found: list[Finding] = []
    is_settings = rel.endswith("settings.json")
    for number, line in enumerate(text.splitlines(), 1):
        if HIDDEN.search(line):
            found.append(Finding(rel, number, "hidden (zero-width or bidi) character"))
        if HTML_COMMENT.search(line):
            found.append(Finding(rel, number, "HTML comment (hidden from rendered view)"))
        if ENCODED.search(line):
            found.append(Finding(rel, number, "encoded payload (base64)"))
        # The settings deny list names these commands on purpose; settings get their own checks.
        if is_settings:
            continue
        if PIPE_TO_SHELL.search(line):
            found.append(Finding(rel, number, "download piped to a shell"))
        if REMOTE_TOOL.search(line) and not LOCAL_TARGET.search(line):
            found.append(Finding(rel, number, "network tool aimed at a non-local host"))
    if is_settings:
        found += scan_settings(rel, text)
    return found


def scan_settings(rel: str, text: str) -> list[Finding]:
    found = [
        Finding(rel, number, f"risky setting: {key}")
        for number, line in enumerate(text.splitlines(), 1)
        for key in RISKY_SETTINGS
        if key in line
    ]
    try:
        settings = json.loads(text)
    except json.JSONDecodeError as exc:
        return [*found, Finding(rel, exc.lineno, "not valid JSON")]
    for rule in settings.get("permissions", {}).get("allow", []):
        if BROAD_ALLOW.search(rule):
            found.append(Finding(rel, 0, f"broad allow rule: {rule}"))
    hooks = settings.get("hooks", {})
    groups = [g for v in hooks.values() for g in v] if isinstance(hooks, dict) else [hooks]
    for group in groups:
        entries = group.get("hooks") if isinstance(group, dict) else None
        if not isinstance(entries, list):
            found.append(Finding(rel, 0, f"hook entry isn't in the expected shape: {group!r}"))
            continue
        for hook in entries:
            command = hook.get("command", "") if isinstance(hook, dict) else repr(hook)
            if not HOOK_COMMAND.match(command):
                message = f"hook doesn't run a script from .claude/hooks/ or scripts/: {command}"
                found.append(Finding(rel, 0, message))
    return found


def scan(root: Path = REPO) -> list[Finding]:
    found: list[Finding] = []
    for path in files_to_scan(root):
        found += scan_text(path.relative_to(root).as_posix(), path.read_text(encoding="utf-8"))
    return found


def main() -> int:
    found = scan()
    for finding in found:
        print(f"::error file={finding.path},line={finding.line}::{finding.message}")
    print(f"Scanned {len(files_to_scan())} agent files: {len(found)} finding(s).")
    return 1 if found else 0


if __name__ == "__main__":
    sys.exit(main())
