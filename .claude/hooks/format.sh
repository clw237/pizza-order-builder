#!/usr/bin/env bash
# PostToolUse hook: format the file Claude just edited, if a formatter for it is installed.
# Never blocks: any failure here exits 0 so a missing tool can't stop work.
# Reads the hook JSON on stdin and pulls out tool_input.file_path.

input=$(cat)
if command -v jq >/dev/null 2>&1; then
  file=$(printf '%s' "$input" | jq -r '.tool_input.file_path // empty' 2>/dev/null)
else
  file=$(printf '%s' "$input" | sed -n 's/.*"file_path"[[:space:]]*:[[:space:]]*"\([^"]*\)".*/\1/p' | head -n1)
fi
[ -n "$file" ] && [ -f "$file" ] || exit 0

has() { command -v "$1" >/dev/null 2>&1; }

case "$file" in
  *.py)
    if has ruff; then ruff format -q "$file"; ruff check -q --fix "$file"
    elif has uv && [ -f "$CLAUDE_PROJECT_DIR/pyproject.toml" ]; then uv run --quiet ruff format -q "$file" 2>/dev/null
    elif has black; then black -q "$file"; fi ;;
  *.ts|*.tsx|*.js|*.jsx|*.mjs|*.cjs|*.json|*.css|*.scss|*.html|*.md|*.yml|*.yaml)
    if [ -x "$CLAUDE_PROJECT_DIR/node_modules/.bin/prettier" ]; then
      "$CLAUDE_PROJECT_DIR/node_modules/.bin/prettier" --write --log-level warn "$file"
    fi ;;
  *.go)   has gofmt && gofmt -w "$file" ;;
  *.rs)   has rustfmt && rustfmt --edition 2021 "$file" ;;
  *.cs)   : ;;  # dotnet format works per project; run by scripts/check.sh instead
  *.java|*.kt) : ;;  # Gradle/Spotless runs from scripts/check.sh
esac
exit 0
