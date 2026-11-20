# Pizza Order Builder

A pizza order builder (web UI) and a separate order service, built for the "Pizza-Driven
Development" take-home (3-hour timebox). TypeScript end to end: one pricing package shared by the
browser and the service, a Fastify service, and a Vite + React builder.

## Run it

Prerequisite: Node.js 22.12 or later.

```bash
npm install
```

| What                                         | Command                                                                    |
| -------------------------------------------- | -------------------------------------------------------------------------- |
| Order service (port 3000)                    | `KITCHEN_TOKEN=dev-secret npm run service`                                 |
| Order builder (port 5173, needs the service) | `npm run web`, then open http://localhost:5173                             |
| All checks: format, lint, types, 126 tests   | `bash scripts/check.sh`                                                    |
| Tests only                                   | `npm test`                                                                 |
| Restaurant side: list orders / advance one   | `KITCHEN_TOKEN=dev-secret npm run kitchen -- list` and `… -- advance <id>` |

Run the service and the builder in two terminals. They are separate processes; the builder's dev
server forwards `/api/*` to the service over HTTP.

- **Kitchen token:** the restaurant routes (list all orders, advance one) need a `Kitchen-Token`
  header that matches the service's `KITCHEN_TOKEN`. Pick any value and give the same one to the
  service and the kitchen CLI (`dev-secret` above is only an example). Without it the service still
  runs, but those routes answer 401. The builder doesn't need it.

- **Kitchen timer (optional):** `KITCHEN_AUTO_ADVANCE_SECONDS=20 npm run service` moves each order
  one step after it has gone 20 seconds without a status change or an edit. Off by default.
- **Flaky-network demo:** open http://localhost:5173/?flaky. The first response is thrown away after
  the service has handled it, the builder retries with the same `Idempotency-Key`, and you still get
  exactly one order.
- Settings: `PORT`, `HOST` and `KITCHEN_TOKEN` for the service, `SERVICE_URL` for the builder and
  the kitchen CLI, `KITCHEN_TOKEN` for the CLI. Names are listed in `.env.example`.

## Layout

| Path                 | What                                                                                        |
| -------------------- | ------------------------------------------------------------------------------------------- |
| `packages/pricing`   | Pure domain code: menu data, promo registry, `priceOrder`, `describeOrder`, `validateOrder` |
| `apps/service`       | Order service: HTTP API, order state machine, in-memory store, kitchen timer and CLI        |
| `apps/web`           | Order builder UI                                                                            |
| `docs/ACCEPTANCE.md` | Acceptance criteria and test cases with IDs; most test names start with these IDs           |
| `PLAN.md`            | Plan and build order                                                                        |

## Order service API

All bodies are JSON. Money is integer cents. Errors are `{ "error": CODE, "message": "...", ... }`.

| Method and path            | Purpose                 | Notes                                                                          |
| -------------------------- | ----------------------- | ------------------------------------------------------------------------------ |
| `POST /orders`             | Submit an order         | Requires `Idempotency-Key`. 201 with the order                                 |
| `GET /orders/:id`          | Order and its status    | 404 if unknown                                                                 |
| `GET /orders`              | Restaurant: all orders  | Requires `Kitchen-Token`; 401 if missing or wrong. Used by the kitchen CLI     |
| `PUT /orders/:id`          | Replace the order       | Requires `Idempotency-Key` and `If-Match: <version>`. Only while Not Started   |
| `POST /orders/:id/cancel`  | Cancel                  | Only while Not Started. Cancelling a cancelled order returns 200 again         |
| `POST /orders/:id/advance` | Restaurant: next status | Requires `Kitchen-Token`. Not Started → Started → Ready for Pickup → Delivered |
| `GET /health`              | Liveness                |                                                                                |

Submit (`expectedTotalCents` is the total the customer was shown):

```bash
curl -s -X POST localhost:3000/orders \
  -H "content-type: application/json" -H "idempotency-key: 7f9c-demo" \
  -d '{"order":{"lines":[{"sizeId":"medium","quantity":2,"toppingIds":["pepperoni","bacon"]}],"promoCodes":["ILOVEPIZZA"],"tip":{"mode":"percent","value":"20"}},"expectedTotalCents":1915}'
```

Response (shortened):

```json
{
  "id": "0b6c…",
  "status": "NOT_STARTED",
  "statusLabel": "Not Started",
  "version": 1,
  "description": "2 × Medium pizza with pepperoni, bacon",
  "order": { "lines": [ … ], "promoCodes": ["ILOVEPIZZA"], "tip": { "mode": "percent", "value": "20" } },
  "quote": { "subtotal": 1666, "appliedPromos": ["ILOVEPIZZA"], "promoNotices": [], "discount": 167, "tax": 97, "tip": 319, "total": 1915, "lines": [ … ] }
}
```

Update and cancel:

```bash
curl -s -X PUT localhost:3000/orders/<id> \
  -H "content-type: application/json" -H "idempotency-key: 2a41-demo" -H "if-match: 1" \
  -d '{"order":{"lines":[{"sizeId":"large","quantity":1,"toppingIds":[]}],"promoCodes":[],"tip":{"mode":"dollars","value":""}},"expectedTotalCents":1278}'
curl -s -X POST localhost:3000/orders/<id>/cancel
```

| Status                                                            | When                                                                                    |
| ----------------------------------------------------------------- | --------------------------------------------------------------------------------------- |
| 400 `INVALID_ORDER`, `INVALID_REQUEST`, `MISSING_IDEMPOTENCY_KEY` | Bad input; `errors[]` lists field paths and messages                                    |
| 404 `ORDER_NOT_FOUND`                                             | Unknown id                                                                              |
| 409 `PRICE_MISMATCH`                                              | The service's total differs from `expectedTotalCents`; the body has the service's quote |
| 409 `ORDER_ALREADY_STARTED`, `ORDER_CANCELLED`, `ORDER_COMPLETE`  | Transition not allowed; the body has the current order                                  |
| 409 `VERSION_CONFLICT`                                            | `If-Match` is stale; the body has the current order                                     |
| 422 `IDEMPOTENCY_KEY_REUSED`                                      | Same key, different request                                                             |
| 428 `PRECONDITION_REQUIRED`                                       | `PUT` without `If-Match`                                                                |

## Assumptions

Where the brief left something open, this is what I decided. Each one is implemented and tested
(IDs in `docs/ACCEPTANCE.md`).

1. **Topping price** is the category's percentage of that pizza's size price, charged per pizza and
   multiplied by quantity. With this menu every topping price is a whole number of cents.
2. **Order of operations:** subtotal → promo discount → tax on the discounted subtotal → tip →
   total. "Tax on the total order" is read as the discounted food total, before tip.
3. **Rounding:** money is integer cents. Discount, tax and a percentage tip are each rounded once,
   half to even (banker's rounding), at the order level (never per line). An exact half cent goes
   to the even cent, so ties don't always round up. Example: tax on $5.00 is 32.5¢ → 32¢, and tax
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
    of the same request. Cancel needs no key because cancelling twice has the same result.
15. **One restaurant, one service process,** in-memory storage (the brief allows it). Restarting
    the service forgets orders.

## Design write-up

### Money and the order total

Money is an integer number of cents everywhere; percentages are basis points (8% = 800).
`applyRate(amount, rate)` splits `amount × rate` into whole cents and a remainder out of 10000,
and sends a remainder of exactly 5000 to the even cent: half-to-even rounding in integer
arithmetic, so no floating-point value ever represents money. Tips arrive as text and are parsed
straight into cents or basis points.

All pricing lives in one pure function, `priceOrder(order, menu, promos)` in `packages/pricing`.
**It runs in both places, and the service is the authority.** The builder calls it on every change
to show the running total; the service calls the same function on every submit and update and
stores its own result. The client never sends prices (the schema rejects unknown fields such as
`total`). Instead it sends `expectedTotalCents`, the total it displayed, and the service rejects a
mismatch with 409 and its own quote. Sharing one function gives an instant total with no network
round trip on a flaky connection; the server check turns "what you see is what you're charged"
into an enforced rule even if the two ever run different versions.

### Adding sizes, toppings, categories and promos

The menu is data (`menu.ts`): sizes with a price, topping categories with a rate, and toppings that
point to a category. Adding any of them is adding an entry; `priceOrder` looks prices up and never
names a specific size or topping. Test E-1 prices a new size, category and topping without
touching the engine.

A promo is an entry in a registry (`promos.ts`): `{ code, conflictsWith, evaluate(context) }`.
`evaluate` receives `{ subtotal, pizzaCount }` and returns either a discount or the reason it
doesn't apply, so each promo carries its own conditions. Conflicts are declared on either side.
The engine resolves them generically: evaluate every entered code, sort the eligible ones by
discount (ties by registry order), and keep each one that doesn't conflict with one already kept.
Test E-2 adds a "$8 off 3 or more pizzas" promo that conflicts with ILOVEPIZZA and is resolved by
the same rule. Limits: the greedy pick is best for pairwise conflicts like these but not for every
possible conflict graph, and a promo that needs information beyond the subtotal and pizza count
(e.g. "free garlic on Tuesdays") needs one more field in the promo context.

### Order lifecycle

The statuses and allowed moves are a small pure state machine (`lifecycle.ts`). Every status
change, from an HTTP request or the kitchen timer, goes through `OrderStore.transition()`, which
reads the order, checks the move and saves the result in one synchronous step. Node runs one
JavaScript task at a time and the handlers never `await` in that step, so no other request can
slip in between the check and the write.

**A customer retries a submission after a timeout.** The builder sends `POST /orders` with an
`Idempotency-Key` generated when the customer pressed Send. The service creates the order and
stores its response under that key, but the response is lost. The builder retries (timeouts,
network errors and 5xx, with backoff) using the same key and body; the service finds the key and
returns the stored response, with the same order id. If the customer gives up and presses Send
again for the same order, the builder reuses the key too. The same key with a different body is
rejected with 422. Updates work the same way, and also carry `If-Match: <version>`, so an edit
based on a stale copy is rejected (409) rather than overwriting a newer one. Guarantee: one order
per key, and one application per update key, for as long as the service runs.

**The customer cancels at the moment the kitchen starts the order.** Both requests reach the same
process and each runs its check-and-set without interruption. Whichever runs first wins. If the
cancel wins, the kitchen's start gets 409 `ORDER_CANCELLED`; if the start wins, the cancel gets 409
`ORDER_ALREADY_STARTED` with the current order, and the builder shows that the kitchen has started.
There is never a cancelled order the kitchen is cooking or a started order that got cancelled. Test
S-13 sends both at once 100 times and checks exactly one succeeds; adding a single `await` between
the read and the write makes it fail, which is how I know the test can catch the bug. S-14 does
the same for an edit against the start.

These guarantees rely on one process with in-memory state. With a database, the same logic becomes
a conditional `UPDATE … WHERE id = ? AND status = 'NOT_STARTED' AND version = ?` plus a table of
idempotency keys with a unique constraint.

### Security

- **Restaurant routes are protected** by a shared secret: `GET /orders` and
  `POST /orders/:id/advance` need a `Kitchen-Token` header equal to the service's `KITCHEN_TOKEN`,
  compared in constant time. If `KITCHEN_TOKEN` isn't set, those routes refuse every request rather
  than open up. The kitchen timer runs inside the service and needs no token.
- **Customer routes are open by design** (no accounts, per the brief). An order is reached by its
  random UUID, which acts as the customer's capability to view, change or cancel it.
- **Input is bounded:** 16 KB bodies, at most 50 line items, quantities 1–99, strict schemas.
- **Known limit: memory grows without bound.** Orders and idempotency keys stay in memory until the
  service restarts, and nothing limits request rates, so a flood of submissions grows the process
  until it is restarted. A database with a TTL on keys and a rate limit would fix it.

### What I cut or faked, and what I'd build next

- **Storage is in memory** and idempotency keys never expire. Next: SQLite with the conditional
  update above and a TTL on keys.
- **The restaurant is simulated** by an endpoint, a CLI and an optional timer.
- **No UI component or browser tests in CI.** The UI's logic is in pure, unit-tested functions
  (`draft.ts`, `api.ts`); the screens were checked by hand and with a scripted browser run.
- **No docker compose** and no production build served by the service; run with the two commands
  above.
- **The menu is compiled into both apps.** Changing it means redeploying both; a version skew is
  caught by the `expectedTotalCents` check rather than prevented. Next: serve the menu from the
  service.
- **A replayed response is the original one,** so a retry after the order moved on shows the old
  status until the next poll.
- **Not built (per the brief):** customer accounts and login, payments, menu admin, multiple locations. A TMNT-themed skin
  is parked on the `feature/theme` branch.

## Tests

`bash scripts/check.sh` runs formatting, lint, type checking and 126 tests. Most test names start
with the ID of the case they cover in `docs/ACCEPTANCE.md`, so `npx vitest run -t "S-13"` runs one.

**Invariants I chose to test, and why**

| Invariant                                                                                                                                                                              | Why                                                                                         | Tests                                                   |
| -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------- | ------------------------------------------------------- |
| Every worked price matches the cent, including half-cent cases                                                                                                                         | Pricing correctness is the top priority                                                     | P-1…P-8, PR-1…PR-12, T-1…T-3, T-6                       |
| The breakdown adds up; every amount is a non-negative integer; discount ≤ subtotal; line order doesn't matter; tip never changes tax; the two conflicting codes are never both applied | Must hold for every order, not just examples, so they are property tests over random orders | INV-1…INV-6                                             |
| The service charges exactly what the shared function computes, and rejects a different expected total                                                                                  | "The total the customer sees must match the total charged"                                  | RT-1, RT-2                                              |
| A retried submit or update is applied once; a reused key with a different body is rejected                                                                                             | Customers on mobile will retry                                                              | S-2, S-3, S-8, S-17 (including a 5xx on the last retry) |
| Cancel and edit are refused once the kitchen starts, including when they race                                                                                                          | The lifecycle guarantee                                                                     | S-9, S-13, S-14                                         |
| Only the restaurant, holding the kitchen token, can list all orders or advance one                                                                                                     | Customers mustn't see each other's orders or move their own along                           |
| Status moves only along the allowed path                                                                                                                                               | Explicit state transitions                                                                  | S-10…S-12, K-2                                          |
| Bad input gets a clear message, and clients can't send prices                                                                                                                          | Server-side validation                                                                      | OB-2…OB-5, T-5, PR-10, S-15, S-16                       |
| New menu entries and promos need no engine change                                                                                                                                      | Requirement 6                                                                               | E-1, E-2                                                |

**Not covered, for lack of time:** UI component and end-to-end browser tests in CI. The builder's
logic is unit tested (OB-1, RT-3, S-17); the screens themselves and PR-13, S-18 and K-1 were
checked by hand; concurrency across several service processes
(not possible with in-memory storage); behaviour across a service restart; load.

**Requirement → code → tests**

| Requirement             | Code                                                     | Tests            |
| ----------------------- | -------------------------------------------------------- | ---------------- |
| 1 Order builder         | `apps/web/src/draft.ts`, `Builder.tsx`                   | OB-1…OB-5        |
| 2 Running total         | `packages/pricing/src/price.ts`, `apps/web/src/draft.ts` | P-_, INV-_, RT-* |
| 3 Description           | `packages/pricing/src/describe.ts`                       | D-1…D-4          |
| 4 Tip and promo codes   | `promos.ts`, `price.ts`, `validate.ts`                   | PR-_, T-_        |
| 5 Service and lifecycle | `apps/service/src/*`                                     | S-*, K-2         |
| 6 Extensibility         | `menu.ts`, `promos.ts`                                   | E-1, E-2         |

## How I used AI

I used Claude Code (in a cloud session, starting from my own `claude-starter` template, which
carries the working rules, review subagents and CI). Claude drafted the plan, the acceptance
criteria with exact expected cents, the code, the tests and the pull-request descriptions; I
decided the requirements interpretation, the scope and the process, and merged each pull request
myself.

- **Decisions I made:** the conflicting-codes rule (assumption 8: apply the code that saves more);
  keeping the branch-and-pull-request process with CI on every change; rehearsing an AI-style
  evaluation of the repo before submitting; and cutting the themed skin and joke toppings to stay
  within the brief, which says to implement the menu as written.
- **AI output that was rejected or fixed:** stacked pull requests merged into the wrong base
  branch, so `main` was missing the pricing engine until a follow-up PR; the formatter rewrote
  unrelated template documents and that change was reverted; a test for the builder assumed an
  empty starting order and was corrected; a proposed TMNT topping list would have changed the
  restaurant's menu, so it was moved out of scope.
- **Verified rather than trusted:** every expected total in `docs/ACCEPTANCE.md` was recomputed
  with a separate script before it became a test, and the two most important tests were checked by
  breaking the code on purpose: switching rounding to truncation fails 15 tests, and adding one
  `await` inside a status change makes the cancel-versus-kitchen race test fail.

Built from the claude-starter template (see `docs/TEMPLATE.md`).
