# Changelog

All notable changes to this project. Format: [Keep a Changelog](https://keepachangelog.com/en/1.1.0/).
Headings, in this order: Added, Changed, Fixed, Removed, Security, Development.

## [Unreleased]

### Added

- Project created from the claude-starter template.
- Plan (`PLAN.md`) and acceptance criteria with test IDs (`docs/ACCEPTANCE.md`).
- npm workspace with the `pricing` package and a walking-skeleton test.
- Pricing engine: menu and promo registry as data, integer-cent money with half-up rounding,
  conflicting promo codes resolved to the larger discount, dollar and percent tips. Example tests
  for every pricing row in `docs/ACCEPTANCE.md` and property tests for the pricing invariants.
- Order description (`describeOrder`) and input validation shared by the web app and service:
  zod schema that rejects price fields, menu id checks, duplicate toppings, unknown promo codes,
  and exact tip parsing from text.
- Order service (`apps/service`, Fastify): submit, get, list, update, cancel and advance.
  Explicit state machine, `Idempotency-Key` replay on submit and update, `If-Match` versions,
  server-side repricing with an `expectedTotalCents` check. Race tests for cancel and update
  against the kitchen starting the order.
