# Design detail

The README's Design write-up is the one-page summary. This file has the full reasoning behind
it: rounding, extensibility, the order lifecycle walk-throughs and the security notes.

## Money and the order total

Money is an integer number of cents everywhere; percentages are basis points (8% = 800).
`applyRate(amount, rate)` splits `amount × rate` into whole cents and a remainder out of 10000,
and sends a remainder of exactly 5000 to the even cent: half-to-even rounding in integer
arithmetic, so no floating-point value ever represents money. Tips arrive as text and are parsed
straight into cents or basis points.

**Why half to even rather than half up.** The rounding rule is assumption 3, chosen on
purpose:

- **No bias.** Half up sends every exact half cent up, so over many orders the store collects a
  little more tax and discounts a little less than the true amounts. Half to even sends half the
  ties up and half down, so the rounding errors cancel out instead of adding up.
- **Ties really happen here.** With 6.5% tax, ordinary prices land on exact half cents: tax on
  $5.00 is 32.5¢ and on $7.00 is 45.5¢. The rule shows on a plain small or medium pizza, not only in
  edge cases.
- **It's the standard default for ties.** It's IEEE 754's default rounding mode and what Python's
  `round()` and .NET's `Math.Round` do; it's also known as banker's rounding.
- **It's one rule, applied once.** Discount, tax and a percentage tip each round once at order
  level, all through `applyRate`, so the builder and the service always agree to the cent.

The trade-off: someone checking a tie by hand with the school rule (round half up) can get 1¢ more
(32.5¢ → 33¢),
and many US states' sales-tax rules say to round a half cent up. That's why assumption 3 spells
out the rule with a worked example. A real store would follow its tax authority, and that is a
one-line change in `applyRate`, with the tie cases pinned by tests (P-1, P-3, PR-8, T-6) so the
change would be test-guided.

All pricing lives in one pure function, `priceOrder(order, menu, promos)` in `packages/pricing`.
**It runs in both places, and the service is the authority.** The builder calls it on every change
to show the running total; the service calls the same function on every submit and update and
stores its own result. The client never sends prices (the schema rejects unknown fields such as
`total`). Instead it sends `expectedTotalCents`, the total it displayed, and the service rejects a
mismatch with 409 and its own quote. Sharing one function gives an instant total with no network
round trip on a flaky connection; the server check turns "what you see is what you're charged"
into an enforced rule even if the two ever run different versions.

## Adding sizes, toppings, categories and promos

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

## Order lifecycle

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

## Security

- **Restaurant routes are protected** by a shared secret: `GET /orders` and
  `POST /orders/:id/advance` need a `Kitchen-Token` header equal to the service's `KITCHEN_TOKEN`,
  compared in constant time. If `KITCHEN_TOKEN` isn't set, those routes refuse every request rather
  than open up. The kitchen timer runs inside the service and needs no token.
- **Customer routes are open by design** (no accounts, per the brief). An order is reached by its
  random UUID, which acts as the customer's capability to view, change or cancel it. The builder
  shows the ID and a `?order=<id>` link so the customer can come back to it, so anyone the ID or
  link is shared with has the same access. The builder only sends text shaped like a UUID.
- **Cross-site requests are refused.** Every POST and PUT needs a header a plain HTML form or
  `text/plain` fetch can't send (`Idempotency-Key` or `Kitchen-Token`), so another site's page
  would need a CORS preflight, which the service never answers. POST and PUT whose `Origin` isn't
  the builder's (`ALLOWED_ORIGINS`, default `http://localhost:5173` and `http://127.0.0.1:5173`)
  get 403 before any handler runs.
- **Input is bounded:** 16 KB bodies, at most 50 line items, quantities 1–99, strict schemas.
- **Known limit: memory grows without bound.** Orders and idempotency keys stay in memory until the
  service restarts, and nothing limits request rates, so a flood of submissions grows the process
  until it is restarted. A database with a TTL on keys and a rate limit would fix it.
