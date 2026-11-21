# Pizza Order Builder

A pizza order builder (web UI) and a separate order service, built for the "Pizza-Driven
Development" take-home (3-hour timebox). TypeScript end to end: one pricing package shared by the
browser and the service, a Fastify service, and a Vite + React builder.

Time spent: about 2 hours building the core, then further rounds of review, security fixes and
docs.

**Quick start:** `KITCHEN_TOKEN=dev-secret docker compose up --build`, then open
http://localhost:5173. To see the guarantees in a minute, open http://localhost:5173/?flaky (a lost
response is retried and still makes one order), or place an order and watch the kitchen timer move
it along.

## Run it

Prerequisite: Node.js 22.12 or later.

```bash
npm install
```

| What                                         | Command                                                                    |
| -------------------------------------------- | -------------------------------------------------------------------------- |
| Order service (port 3000)                    | `KITCHEN_TOKEN=dev-secret npm run service`                                 |
| Order builder (port 5173, needs the service) | `npm run web`, then open http://localhost:5173                             |
| All checks: format, lint, types, all tests   | `bash scripts/check.sh`                                                    |
| Tests only                                   | `npm test`                                                                 |
| Browser smoke test (starts both apps itself) | `npm run e2e` (first time: `npx playwright install --with-deps chromium`)  |
| Restaurant side: list orders / advance one   | `KITCHEN_TOKEN=dev-secret npm run kitchen -- list` and `… -- advance <id>` |

Run the service and the builder in two terminals. They are separate processes; the builder's dev
server forwards `/api/*` to the service over HTTP.

**Or with Docker** (no local Node needed):

```bash
KITCHEN_TOKEN=dev-secret docker compose up --build
# open http://localhost:5173; in another terminal:
docker compose exec service npm run kitchen -- list
```

To check a running stack with `scripts/compose-smoke.sh`, start it with the timer off, since the
script moves the order itself:

```bash
KITCHEN_TOKEN=dev-secret KITCHEN_AUTO_ADVANCE_SECONDS=0 docker compose up --build --wait --detach
KITCHEN_TOKEN=dev-secret bash scripts/compose-smoke.sh
```

The same image runs both apps as separate containers; the builder's container forwards `/api/*`
to the `service` container. Ports are published on `127.0.0.1` only. `KITCHEN_TOKEN` and the
kitchen timer variables are read from your shell or a `.env` file (`.env.example` lists them).
Set the token when you run `up`: the containers keep the value they started with, and the kitchen
CLI inside the service container uses that same value. Started without one, the
restaurant routes and the CLI refuse every request until you run `up` again with a token.

- **Kitchen token:** the restaurant routes (list all orders, advance one) need a `Kitchen-Token`
  header that matches the service's `KITCHEN_TOKEN`. Pick any value and give the same one to the
  service and the kitchen CLI (`dev-secret` above is only an example). Without it the service still
  runs, but those routes answer 401. The builder doesn't need it.

- **Kitchen timer (on by default):** the service moves each order one step after it has spent 20
  seconds in a status without a change or an edit, so an order goes Not Started → Started → Ready
  for Pickup → Delivered on its own in about a minute. The builder counts down to the next step
  ("Started in about 12s"). Per step: `KITCHEN_SECONDS_TO_START`, `KITCHEN_SECONDS_TO_READY`,
  `KITCHEN_SECONDS_TO_DELIVER`; `KITCHEN_AUTO_ADVANCE_SECONDS` sets all three. `0` leaves a step
  to the kitchen CLI, so `KITCHEN_AUTO_ADVANCE_SECONDS=0` turns the timer off. An invalid value
  stops the service with a message saying which variable is wrong.
- **Track an order:** after sending, copy the order ID (or keep the link shown with it). Later,
  paste the ID or link into "Track an order" on the start screen, or open
  http://localhost:5173/?order=<id>, to see its status and change or cancel it while Not Started.
  The page's URL names the order on screen, so a reload keeps it.
- **Flaky-network demo:** open http://localhost:5173/?flaky. The first response is thrown away after
  the service has handled it, the builder retries with the same `Idempotency-Key`, and you still get
  exactly one order.
- Settings: `PORT` and `HOST` for the service, `SERVICE_URL` for the builder and the kitchen CLI,
  and `KITCHEN_TOKEN` for the service and the kitchen CLI. `.env.example` lists the names.

## Layout

| Path                 | What                                                                                        |
| -------------------- | ------------------------------------------------------------------------------------------- |
| `packages/pricing`   | Pure domain code: menu data, promo registry, `priceOrder`, `describeOrder`, `validateOrder` |
| `apps/service`       | Order service: HTTP API, order state machine, in-memory store, kitchen timer and CLI        |
| `apps/web`           | Order builder UI                                                                            |
| `docs/ACCEPTANCE.md` | Acceptance criteria and test cases with IDs; most test names start with these IDs           |
| `docs/API.md`        | The order service's endpoints, examples and error codes                                     |
| `PLAN.md`            | Plan and build order                                                                        |

**Repository tooling, not part of the exercise.** These come from my `claude-starter` template and
are how the AI's work was kept in check: they set its working rules and fail a change that breaks
them. None of it is needed to run or review the exercise.

If you open the repo in Claude Code and trust the folder, two project hooks run on your machine
(`.claude/settings.json`): `.claude/hooks/format.sh` formats a file after Claude edits it, and
`scripts/check_changelog.py --hook` reminds about a changelog line when Claude stops. Neither
blocks or touches the network. Your Claude session will also load `CLAUDE.md` and `.claude/` as
instructions: they are the working rules I used while building, not instructions for reviewing
the work.

| Path                                                                  | What                                                                                                                    |
| --------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------- |
| `CLAUDE.md`, `.claude/`                                               | Claude Code's working rules, skills, review subagents and edit hooks                                                    |
| `scripts/check.sh`                                                    | The one check (format, lint, types, tests) that CI and every change run                                                 |
| `scripts/check_changelog.py`, `scripts/scan_agent_files.py`           | CI guardrails: a changelog line per change; no hidden instructions in agent files                                       |
| `.github/`, `.pre-commit-config.yaml`                                 | CI workflows, the `main` branch ruleset, PR template                                                                    |
| `CONTRIBUTING.md`, `RELEASING.md`, `SECURITY.md`, `docs/PRACTICES.md` | The process: issues, branches, pull requests, releases                                                                  |
| `docs/decisions/`                                                     | Records for the tooling choices (0001–0003); the exercise's decisions are the Assumptions and the Design write-up below |

## Order service API

Seven JSON endpoints: submit, get, update and cancel an order, plus the restaurant's list and
advance routes and a health check. Money is integer cents. Submit, update and cancel need an
`Idempotency-Key`, and an update needs `If-Match: <version>`. Endpoints, curl examples and every
error code: [`docs/API.md`](docs/API.md).

## Assumptions

Where the brief left something open, this is what I decided. Each one is implemented and tested
(IDs in `docs/ACCEPTANCE.md`).

1. **Topping price** is the category's percentage of that pizza's size price, charged per pizza and
   multiplied by quantity. With this menu every topping price is a whole number of cents.
2. **Order of operations:** subtotal → promo discount → tax on the discounted subtotal → tip →
   total. "Tax on the total order" is read as the discounted food total, before tip.
3. **Rounding:** money is integer cents. Discount, tax and a percentage tip are each rounded once,
   half to even (banker's rounding), at the order level (never per line). An exact half cent goes
   to the even cent, so ties don't always round up (why: Design write-up, Money). Example: tax on $5.00 is 32.5¢ → 32¢, and tax
   on $7.00 is 45.5¢ → 46¢.
4. **Tip percentage** is of the bill after discount and tax. The tip is not taxed.
5. **SAVE5** needs a subtotal strictly over $20.00, measured before tax and before any discount.
   At exactly $20.00 it does not apply.
6. **A code that doesn't qualify** (SAVE5 at $20 or less) is accepted but not applied, and the
   customer sees why. The order can still be sent.
7. **An unknown code** is an error; the order can't be sent until it is fixed or removed.
8. **Conflicting codes:** the customer may enter several codes. When codes conflict, the one that
   saves more is applied and the customer is told the other wasn't combined. On a tie (a $50.00
   subtotal, where both save $5) the code listed first in the registry, ILOVEPIZZA, wins. A code that
   doesn't qualify never wins.
9. **Line items:** at least one per order, quantity a whole number from 1 to 99, each topping at
   most once per pizza ("extra cheese" is the way to double up). Up to 50 line items per order.
10. **Tip input:** dollars from 0 to $9,999.99, or a percentage from 0 to 100, each with at most 2
    decimals. Parsed from text without floating point. An empty tip is $0.
11. **Promo codes** are trimmed and case-insensitive; a code entered twice counts once.
12. **Statuses** go Not Started → Started → Ready for Pickup → Delivered, one step at a time.
    "Delivered" follows "Ready for Pickup" (the customer has the pizza). **Cancelled** is a fifth,
    terminal status, reachable only from Not Started.
13. **An update replaces the whole order** (items, codes, tip) and is repriced; it is allowed only
    while Not Started.
14. **Retries:** clients send an `Idempotency-Key` on submit and update and reuse it on every retry
    of the same request. Cancel requires one too, so another site can't send it as a simple
    request, but doesn't replay it: cancelling twice already has the same result.
15. **One restaurant, one service process,** in-memory storage (the brief allows it). Restarting
    the service forgets orders.

## Design write-up

Full reasoning and walk-throughs: [`docs/DESIGN.md`](docs/DESIGN.md).

### Money and the order total

Money is integer cents everywhere and rates are basis points, so no floating-point value ever
represents money. `applyRate` rounds each discount, tax and percentage tip once, half to even, at
order level. Half to even avoids the upward bias of half up, and ties are common at 6.5% tax ($5.00
→ 32.5¢). The trade-off is that a hand check with half up can differ by 1¢. A store bound by a
half-up tax rule changes one line, and tests P-1, P-3, PR-8 and T-6 pin the ties.

All pricing is one pure function, `priceOrder`, in `packages/pricing`. **It runs in both places,
and the service is the authority.** The builder calls it on every change for an instant total;
the service recomputes it on every submit and update. Clients never send prices. They send
`expectedTotalCents`, the total they showed, and a mismatch gets 409 with the service's quote, so
"what you see is what you're charged" is enforced, not hoped for.

### Adding sizes, toppings, categories and promos

The menu is data (`menu.ts`), and the engine never names a specific size or topping, so adding one
is adding an entry (test E-1). A promo is a registry entry (`promos.ts`) with its own
`evaluate(context)` and a `conflictsWith` list. The engine resolves conflicts generically by
keeping the largest eligible discounts that don't conflict (test E-2 adds a new conflicting promo).
Limit: a promo that needs more than the subtotal and pizza count needs one more context field.

### Order lifecycle

Statuses are a small pure state machine (`lifecycle.ts`). Every change, from a request or the
kitchen timer, goes through one synchronous read-check-write, so nothing can slip in between.

- **Retry after a timeout:** the builder sends an `Idempotency-Key` and reuses it on every retry.
  The service replays the stored response, so there is one order per key. Updates also carry
  `If-Match: <version>`, so a stale edit gets 409 instead of overwriting.
- **Cancel at the moment the kitchen starts:** whichever runs first wins and the other gets 409, so
  a cancelled order is never cooked. Test S-13 races them 100 times; adding one `await` makes it
  fail.

With a database, the same logic becomes a conditional `UPDATE … WHERE status = ? AND version = ?`
and a unique key table.

### Security

Restaurant routes need a `Kitchen-Token` (compared in constant time; closed when unset). Customer
routes are open by design, with no accounts per the brief: the order's random UUID is the
customer's capability. POST and PUT need a custom header and a builder `Origin`, so another site
can't cancel an order. Input is bounded. Known limit: memory and request rates are unbounded.
Production hardening (rate limits and memory bounds, security headers, a production build:
issues #41 to #44) and hardening this repo's own Claude workflow (#40) are outside the brief, so
they are logged as backlog rather than done.

### What I cut or faked, and what I'd build next

- **Storage is in memory** and idempotency keys never expire. Next: SQLite with the conditional
  update above and a TTL on keys.
- **The restaurant is simulated** by an endpoint, a CLI and a timer (on by default).
- **Only three browser tests** (E2E-1 to E2E-3); the rest of the UI is covered by unit tests of
  its pure logic, not component tests.
- **No production build.** Both `npm run web` and `docker compose up` run the Vite dev server;
  the service doesn't serve a built builder.
- **The menu is compiled into both apps;** a version skew is caught by the `expectedTotalCents`
  check rather than prevented. Next: serve the menu from the service.
- **Status is polled** every 3 seconds. Next: push it with Server-Sent Events, polling as fallback.
- **Each topping at most once per pizza** (assumption 9). Next: double toppings.
- **Not built (per the brief):** customer accounts and login, payments, menu admin, multiple locations.

## Tests

`bash scripts/check.sh` runs formatting, lint, type checking and every unit test. Most test names start
with the ID of the case they cover in `docs/ACCEPTANCE.md`, so `npx vitest run -t "S-13"` runs one.

**Invariants I chose to test, and why**

| Invariant                                                                                                                                                                              | Why                                                                                         | Tests                                                   |
| -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------- | ------------------------------------------------------- |
| Every worked price matches the cent, including half-cent cases                                                                                                                         | Pricing correctness is the top priority                                                     | P-1…P-8, PR-1…PR-12, T-1…T-3, T-6                       |
| The breakdown adds up; every amount is a non-negative integer; discount ≤ subtotal; line order doesn't matter; tip never changes tax; the two conflicting codes are never both applied | Must hold for every order, not just examples, so they are property tests over random orders | INV-1…INV-6                                             |
| The service charges exactly what the shared function computes, and rejects a different expected total                                                                                  | "The total the customer sees must match the total charged"                                  | RT-1, RT-2                                              |
| A retried submit or update is applied once; a reused key with a different body is rejected                                                                                             | Customers on mobile will retry                                                              | S-2, S-3, S-8, S-17 (including a 5xx on the last retry) |
| Cancel and edit are refused once the kitchen starts, including when they race                                                                                                          | The lifecycle guarantee                                                                     | S-9, S-13, S-14                                         |
| Only the restaurant, holding the kitchen token, can list all orders or advance one                                                                                                     | Customers mustn't see each other's orders or move their own along                           | K-3                                                     |
| Status moves only along the allowed path                                                                                                                                               | Explicit state transitions                                                                  | S-10…S-12, K-2                                          |
| Bad input gets a clear message, and clients can't send prices                                                                                                                          | Server-side validation                                                                      | OB-2…OB-5, T-5, PR-10, S-15, S-16                       |
| New menu entries and promos need no engine change                                                                                                                                      | Requirement 6                                                                               | E-1, E-2                                                |

**Not covered, for lack of time:** UI component tests, and browser tests beyond the three smoke
tests (E2E-1 to E2E-3). The builder's logic is unit tested (OB-1, RT-3, S-17); the screens themselves and PR-13, S-18 and K-1 were
checked by hand; concurrency across several service processes
(not possible with in-memory storage); behaviour across a service restart; load.

Each requirement's code and tests are mapped in [`docs/ACCEPTANCE.md`](docs/ACCEPTANCE.md#requirement--code--tests).

## How I used AI

I used Claude Code, starting from my own `claude-starter` template (see "Repository tooling" under
Layout). Claude drafted the plan, the acceptance criteria, the code, the tests and the pull
requests; I decided the requirements interpretation, the scope and the process, and merged each
pull request myself.

- **Decisions I made:** the conflicting-codes rule (assumption 8: apply the code that saves more);
  keeping the branch-and-pull-request process with CI on every change; and keeping the theme to
  styling, since the brief says to implement the menu as written.
- **AI output that was rejected or fixed:** stacked pull requests merged into the wrong base
  branch, so `main` was missing the pricing engine until a follow-up PR; a proposed TMNT topping
  list would have changed the restaurant's menu, so it was rejected.
- **A cold-grader rehearsal found a real bug:** the builder dropped its `Idempotency-Key` after a
  failed last retry, so pressing Send again could create a second order. Fixed in PR #11 with a
  unit test (`docs/ACCEPTANCE.md`, "Mock AI evaluation").
- **Separate Claude sessions, each with one job:** a persona-based evaluation (only the repo and
  the brief, judging as an evaluator for the role), a session that turned my feedback into
  prioritized GitHub issues for the build sessions, and a penetration test that logged its
  findings as prioritized `security` issues (#39 to #47).
- **Verified rather than trusted:** every expected total was recomputed with a separate script
  before it became a test, and I broke the rounding on purpose to see the tests fail (at
  submission, truncating fails 15 and half-up fails 6). One added `await` makes the
  cancel-versus-kitchen race test fail.
