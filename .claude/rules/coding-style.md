# Coding style (all languages)

- Prefer readable over clever. Use names from the problem's domain. Keep functions small with one job.
- Keep logic pure where you can and push I/O to the edges. That makes it easy to test.
- Validate input at boundaries. Fail with a clear message. Never swallow an error silently.
- Prefer immutable data and early returns. Avoid deep nesting.
- No dead code, no commented-out code, no debug prints in commits.
- Don't add abstraction, configurability or dependencies for needs that don't exist yet.
- Comments explain *why*, not *what*.
- Follow the formatter. Don't hand-format against it.
