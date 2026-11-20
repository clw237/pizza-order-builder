---
paths:
  - "**/test*/**"
  - "**/*test*.*"
  - "**/*spec*.*"
---

# Testing

- Test behavior through the public interface, not implementation details.
- Use Arrange, Act, Assert, and one behavior per test. Name a test for what it proves (`returns_empty_for_no_orders`).
- Cover the edge cases: empty, one, many, boundary values, invalid input, duplicates.
- Make tests deterministic. Don't use the real network, real clock or random seeds without control.
  Use fakes and fixtures.
- When a test fails, fix the code unless the test is wrong. Never delete or skip a test to get green.
- A bug fix starts with a test that reproduces the bug.
