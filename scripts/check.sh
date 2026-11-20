#!/usr/bin/env bash
# The one command that means "done": format check, lint, types, tests.
# Claude, the owner and CI all run this. The bootstrap skill may replace the
# auto-detection below with the exact commands for this project.
set -euo pipefail
cd "$(dirname "$0")/.."

ran=0
step() { echo; echo "==> $*"; "$@"; ran=1; }
has() { command -v "$1" >/dev/null 2>&1; }

# Python (uv)
if [ -f pyproject.toml ]; then
  if has uv; then r="uv run"; else r=""; fi
  step $r ruff format --check .
  step $r ruff check .
  if grep -q mypy pyproject.toml 2>/dev/null; then step $r mypy .; fi
  step $r pytest -q
fi

# JavaScript / TypeScript (npm scripts, when defined)
if [ -f package.json ]; then
  for s in format:check lint typecheck test; do
    if node -e "process.exit(require('./package.json').scripts?.['$s'] ? 0 : 1)" 2>/dev/null; then
      if [ "$s" = test ]; then step npm test --silent; else step npm run --silent "$s"; fi
    fi
  done
fi

# Go
if [ -f go.mod ]; then
  echo; echo "==> gofmt -l ."
  unformatted=$(gofmt -l .); [ -z "$unformatted" ] || { echo "Not formatted:"; echo "$unformatted"; exit 1; }
  step go vet ./...
  step go test ./...
fi

# Rust
if [ -f Cargo.toml ]; then
  step cargo fmt --check
  step cargo clippy --all-targets -- -D warnings
  step cargo test
fi

# Java / Kotlin (Gradle wrapper)
if [ -x gradlew ]; then step ./gradlew check; fi

# C# / .NET
if ls ./*.sln >/dev/null 2>&1 || ls ./*.csproj >/dev/null 2>&1; then
  step dotnet format --verify-no-changes
  step dotnet test
fi

if [ "$ran" -eq 0 ]; then
  echo "No project detected yet. Run the bootstrap skill (or edit scripts/check.sh)."
  exit 1
fi
echo; echo "All checks passed."
