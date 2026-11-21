# Changelog

All notable changes to this project. Format: [Keep a Changelog](https://keepachangelog.com/en/1.1.0/).
Headings, in this order: Added, Changed, Fixed, Removed, Security, Development.

## [Unreleased]

### Added

- Project created from the claude-starter template.
- Plan (`PLAN.md`) and acceptance criteria with test IDs (`docs/ACCEPTANCE.md`).
- npm workspace with the `pricing` package and a walking-skeleton test.
- Pricing engine: menu and promo registry as data, integer-cent money with half-to-even rounding,
  conflicting promo codes resolved to the larger discount, dollar and percent tips. Example tests
  for every pricing row in `docs/ACCEPTANCE.md` and property tests for the pricing invariants.
- Order description (`describeOrder`) and input validation shared by the web app and service:
  zod schema that rejects price fields, menu id checks, duplicate toppings, unknown promo codes,
  and exact tip parsing from text.
- Order service (`apps/service`, Fastify): submit, get, list, update, cancel and advance.
  Explicit state machine, `Idempotency-Key` replay on submit and update, `If-Match` versions,
  server-side repricing with an `expectedTotalCents` check. Race tests for cancel and update
  against the kitchen starting the order.
- Web app (`apps/web`, Vite + React): order builder with a live total and breakdown, order
  description, submit and update with automatic retries under one `Idempotency-Key`, status
  polling, change and cancel while Not Started. `?flaky` in the URL drops the first response to
  demonstrate a safe retry.
- Restaurant side: `npm run kitchen -- list | advance <id>`, and an optional timer
  (`KITCHEN_AUTO_ADVANCE_SECONDS`) that moves orders along. Status changes now go through one
  `OrderStore.transition` method shared by the routes and the timer.
- README: run commands, API reference, assumptions, design write-up, tested invariants and AI
  usage.
- Per-step kitchen timings (`KITCHEN_SECONDS_TO_START`, `_TO_READY`, `_TO_DELIVER`; 0 = by hand).
  Orders report `nextStatus` and `nextStatusAt`, and the builder counts down to the next step.
- `docker compose up --build` runs the service and the builder in two containers from one
  image, with health checks; `scripts/compose-smoke.sh` checks the running stack, and CI runs both.
- Track an order by its ID: the confirmation screen shows a Copy ID button and a `?order=<id>`
  link, and the start screen has a "Track an order" box. An unknown ID says "No order with that ID."

### Changed

- The kitchen timer is on by default: each order moves one step after 20 seconds in a status.
  `KITCHEN_AUTO_ADVANCE_SECONDS=0` turns it off, as before.
- Discount, tax and percentage tips round half to even (banker's rounding) instead of half-up,
  so a small plain pizza now costs $5.32 (tax 32.5¢ → 32¢).
- The web app has a TMNT look with card-game touches: a sewer-brick background, comic panels,
  bandana colours per pizza, and toppings as cards that tilt when picked. Styling only; prices,
  labels and behaviour are unchanged. Copy stays plain ("Order sent.").

### Fixed

- The builder now keeps the `Idempotency-Key` when the last retry ends in a server error, so
  pressing Send again can't create a second order.
- The tax label is built from the menu's tax rate instead of a hard-coded "6.5%".
- The promo code field's hint says "Enter a promo code" instead of showing a working code (#16).
- When the kitchen starts an order while the customer is changing it, the builder closes the
  editor and says so, instead of waiting for Save to be refused (#30).
- When the service is down, the builder shows the "couldn't reach the restaurant" message
  instead of "Unexpected end of JSON input".
- A retry whose JSON lists the same fields in a different order now counts as the same request,
  instead of being rejected as a reused `Idempotency-Key`.

### Security

- `GET /orders` and `POST /orders/:id/advance` now require a `Kitchen-Token` header matching the
  service's `KITCHEN_TOKEN` (401 otherwise, and always 401 when it isn't set). The kitchen CLI
  sends it.
- Another website can no longer cancel a customer's order: cancel now requires an
  `Idempotency-Key` (the builder sends one), and POST and PUT from an `Origin` outside
  `ALLOWED_ORIGINS` get 403 (#39).

### Development

- Browser smoke test (E2E-1, Playwright `1.63.0`): starts the service and the builder, builds an
  order and places it. E2E-2 tracks a placed order by its ID after a reload. `npm run e2e`; CI installs Chromium and runs it.
- When the browser test fails in CI, its trace, screenshot and HTML report are uploaded as the
  `playwright-traces` artifact (kept 7 days).
