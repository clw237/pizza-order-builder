# Acceptance criteria and test cases

Derived from "Pizza-Driven Development" (the take-home brief). Every test ID below is cited by the
automated test that covers it, so the README can list what is and isn't covered.

Legend: **[A]** automated (vitest) · **[M]** manual check in the running app.
All money is integer cents. "Half to even" means an exact 0.5 cent rounds to the even cent
(32.5 → 32, 45.5 → 46). `S/M/L` = Small/Medium/Large.

## Reference values

| Size   | Base | Basic topping (8%) | Premium topping (11%) |
| ------ | ---- | ------------------ | --------------------- |
| Small  | 500  | 40                 | 55                    |
| Medium | 700  | 56                 | 77                    |
| Large  | 1200 | 96                 | 132                   |

Order of operations: subtotal → promo discount → tax 6.5% on discounted subtotal → tip → total.
Each percentage is rounded once, half to even, at order level.

## Assumptions these criteria depend on (go to README "Assumptions")

1. Topping % is of that line's size price, charged per pizza, times quantity.
2. Tax is on the discounted subtotal; the tip is not taxed.
3. Rounding: discount, tax and % tip are each rounded half to even (banker's rounding) to the cent,
   once, on the order.
4. Tip % is of the post-discount, post-tax total.
5. SAVE5 needs subtotal (before tax and discount) strictly greater than $20.00.
6. SAVE5 on an order ≤ $20: code is valid but not applied; the customer sees why; submit allowed.
7. Unknown code: error, submit blocked until removed or fixed.
8. **Conflicting codes:** the customer may enter several codes. When codes conflict, the one with
   the larger discount is applied and the customer is told the other was not combined. Ties go
   to the code listed first in the promo registry (ILOVEPIZZA). Ineligible codes never win.
9. Each topping at most once per pizza. Quantity is an integer 1–99. Order needs ≥ 1 line item.
10. Tip dollars: 0 to $9,999.99, at most 2 decimals. Tip percent: 0–100, at most 2 decimals. Parsed from
    strings without floats. Empty tip means $0.
11. Promo codes are trimmed and case-insensitive; a code entered twice counts once.
12. Statuses: Not Started → Started → Ready for Pickup → Delivered, one step at a time.
    Cancelled is terminal and reachable only from Not Started.
13. An update replaces the whole order (items, codes, tip) and is repriced on the server.
14. Retries: clients send an `Idempotency-Key` on submit and update and reuse it on every retry.
15. One restaurant, one service process, in-memory storage. Restarting the service forgets orders.

---

## R1. Order builder

**Acceptance criteria**

- The customer can add a line item (size, quantity, toppings), remove it, and change its size,
  quantity and toppings.
- The customer can add and remove individual toppings on a line item.
- An order with zero line items cannot be submitted.

| ID   | Case                                                                 | Expected                                                   |        |
| ---- | -------------------------------------------------------------------- | ---------------------------------------------------------- | ------ |
| OB-1 | Add line, change size S→L, change qty 1→3, add then remove a topping | Model reflects each change                                 | [A]    |
| OB-2 | Remove the only line item                                            | Order empty; submit disabled with "Add at least one pizza" | [A][M] |
| OB-3 | Quantity 0, -1, 1.5, 100, "abc"                                      | Rejected with a clear message (client and server)          | [A]    |
| OB-4 | Same topping twice on one pizza                                      | Rejected by server (400); UI can't produce it              | [A]    |
| OB-5 | Unknown size or topping id sent to server                            | 400 naming the field                                       | [A]    |

## R2. Running total (one source of truth)

**Acceptance criteria**

- The total recomputes on every change: line items, sizes, quantities, toppings, tip amount, tip
  mode and promo codes.
- The UI and service compute the total with the same pricing function; the client never sends
  prices.
- The service rejects a submission whose `expectedTotalCents` differs from its own total (409,
  returns the server quote).

| ID  | Order                                    | Subtotal    | Discount | Tax        | Tip | Total    |     |
| --- | ---------------------------------------- | ----------- | -------- | ---------- | --- | -------- | --- |
| P-1 | 1 S plain                                | 500         | 0        | 32 (32.5↓) | 0   | **532**  | [A] |
| P-2 | 1 L plain                                | 1200        | 0        | 78         | 0   | **1278** | [A] |
| P-3 | 1 M plain                                | 700         | 0        | 46 (45.5↑) | 0   | **746**  | [A] |
| P-4 | Topping prices for every size × category | table above |          |            |     |          | [A] |
| P-5 | 1 L pepperoni + bacon                    | 1428        | 0        | 93         | 0   | **1521** | [A] |
| P-6 | 3 S onions                               | 1620        | 0        | 105        | 0   | **1725** | [A] |
| P-7 | 1 L plain + 2 M chicken                  | 2754        | 0        | 179        | 0   | **2933** | [A] |
| P-8 | 1 L with all 12 toppings                 | 2568        | 0        | 167        | 0   | **2735** | [A] |

| ID    | Case                                                                                                    | Expected                                      |     |
| ----- | ------------------------------------------------------------------------------------------------------- | --------------------------------------------- | --- |
| RT-1  | Server quote for an order equals `price(order)` from the shared package                                 | Equal, field by field                         | [A] |
| RT-2  | Submit with wrong `expectedTotalCents`                                                                  | 409 with server quote; no order created       | [A] |
| RT-3  | Every change listed above updates the displayed total                                                   | Total changes immediately                     | [A] |
| E2E-1 | In Chromium against the real service: 1 L pepperoni + ILOVEPIZZA, then send (`npm run e2e`, not vitest) | $12.42 shown, then charged; order Not Started | [A] |

**Invariants (property tests over random valid orders)**

| ID    | Invariant                                                                      |     |
| ----- | ------------------------------------------------------------------------------ | --- |
| INV-1 | subtotal = Σ line totals; total = subtotal − discount + tax + tip              | [A] |
| INV-2 | Every amount is an integer ≥ 0; discount ≤ subtotal                            | [A] |
| INV-3 | Reordering line items doesn't change the total                                 | [A] |
| INV-4 | Adding a pizza or a topping, or increasing quantity, never lowers the subtotal | [A] |
| INV-5 | Tip never changes tax                                                          | [A] |
| INV-6 | SAVE5 and ILOVEPIZZA are never both applied                                    | [A] |

## R3. Order description

**Acceptance criteria**

- On request, the builder shows each line's quantity, size and toppings in plain text.

| ID  | Order                        | Expected text                            |     |
| --- | ---------------------------- | ---------------------------------------- | --- |
| D-1 | 2 M pepperoni + bacon        | `2 × Medium pizza with pepperoni, bacon` | [A] |
| D-2 | 1 L plain                    | `1 × Large pizza, no toppings`           | [A] |
| D-3 | Several lines                | One line per item, in order              | [A] |
| D-4 | Toppings picked in any order | Listed in menu order (deterministic)     | [A] |

## R4. Tip and promo codes

**Acceptance criteria**

- Tip can be entered as dollars or as a percentage; switching mode recomputes the total.
- ILOVEPIZZA and SAVE5 work as written; they are never both applied.
- Invalid tip or code shows a clear message next to the field, and the order can't be submitted.

| ID    | Order                        | Codes / tip                                              | Discount                   | Tax | Tip          | Total    |     |
| ----- | ---------------------------- | -------------------------------------------------------- | -------------------------- | --- | ------------ | -------- | --- |
| PR-1  | 1 L plain                    | ILOVEPIZZA                                               | 120                        | 70  | 0            | **1150** | [A] |
| PR-2  | 2 M pepperoni + bacon (1666) | ILOVEPIZZA                                               | 167 (166.6↑)               | 97  | 0            | **1596** | [A] |
| PR-3  | 4 S plain (2000, boundary)   | SAVE5                                                    | 0, "needs over $20"        | 130 | 0            | **2130** | [A] |
| PR-4  | 3 S + 1 S onions (2040)      | SAVE5                                                    | 500                        | 100 | 0            | **1640** | [A] |
| PR-5  | 1 L plain                    | SAVE5                                                    | 0, "needs over $20"        | 78  | 0            | **1278** | [A] |
| PR-6  | 5 L plain (6000)             | ILOVEPIZZA + SAVE5                                       | 600 (ILOVEPIZZA wins)      | 351 | 0            | **5751** | [A] |
| PR-7  | 2 L plain (2400)             | ILOVEPIZZA + SAVE5                                       | 500 (SAVE5 wins)           | 124 | 0            | **2024** | [A] |
| PR-8  | 10 S plain (5000)            | ILOVEPIZZA + SAVE5                                       | 500 (tie → ILOVEPIZZA)     | 292 | 0            | **4792** | [A] |
| PR-9  | 1 L plain                    | ILOVEPIZZA + SAVE5                                       | 120 (SAVE5 ineligible)     | 70  | 0            | **1150** | [A] |
| PR-10 | 1 L plain                    | `PIZZA4EVER`                                             | error "Unknown promo code" |     |              | blocked  | [A] |
| PR-11 | 1 L plain                    | `ilovepizza`                                             | 120                        | 70  | 0            | **1150** | [A] |
| PR-12 | 1 L plain                    | ILOVEPIZZA twice                                         | 120 (once)                 | 70  | 0            | **1150** | [A] |
| T-1   | 1 L plain                    | tip $3.50                                                | 0                          | 78  | 350          | **1628** | [A] |
| T-2   | 1 L plain                    | tip 15%                                                  | 0                          | 78  | 192 (191.7↑) | **1470** | [A] |
| T-3   | PR-2 order                   | ILOVEPIZZA, tip 20%                                      | 167                        | 97  | 319          | **1915** | [A] |
| T-4   | any                          | tip empty or 0                                           |                            |     | 0            |          | [A] |
| T-5   | any                          | tip `-1`, `abc`, `3.505`, `1e3`, percent `101`           | clear message, blocked     |     |              |          | [A] |
| T-6   | 1 L plain                    | ILOVEPIZZA, tip 15%                                      | 120                        | 70  | 172 (172.5↓) | **1322** | [A] |
| PR-13 | Conflict case in UI          | Message says which code applied and why the other wasn't |                            |     |              |          | [M] |

## R5. Order service and lifecycle

**Acceptance criteria**

- The service runs as its own process; the builder talks to it over HTTP.
- Submit returns an order ID. Status can be queried: Not Started, Started, Ready for Pickup,
  Delivered (plus Cancelled).
- Update and cancel succeed only while Not Started; otherwise 409 with the current status.
- The service validates every request itself and prices the order itself.
- Retried requests after a timeout never create duplicates or apply a change twice.
- The restaurant advances status through a documented endpoint and CLI command.

| ID   | Case                                                                       | Expected                                               |     |
| ---- | -------------------------------------------------------------------------- | ------------------------------------------------------ | --- |
| S-1  | POST valid order with Idempotency-Key                                      | 201, id, status Not Started, version 1, quote          | [A] |
| S-2  | Retry POST, same key, same body                                            | Same response and id; still one order stored           | [A] |
| S-3  | Same key, different body                                                   | 422; no new order                                      | [A] |
| S-4  | POST without Idempotency-Key                                               | 400 explaining the header is required                  | [A] |
| S-5  | GET unknown id                                                             | 404                                                    | [A] |
| S-6  | PUT while Not Started, correct `If-Match` version                          | 200, version 2, repriced                               | [A] |
| S-7  | PUT with stale version                                                     | 409 with current order                                 | [A] |
| S-8  | Retried PUT, same Idempotency-Key                                          | Same response; change applied once                     | [A] |
| S-9  | PUT or cancel after Started                                                | 409 "already started"                                  | [A] |
| S-10 | Cancel while Not Started, then cancel again                                | Cancelled; second call 200, same state                 | [A] |
| S-11 | Advance: Not Started → Started → Ready → Delivered                         | Each step succeeds in order                            | [A] |
| S-12 | Advance from Delivered or Cancelled                                        | 409                                                    | [A] |
| S-13 | Cancel and advance sent concurrently (repeated 100×)                       | Exactly one wins; final state is Cancelled xor Started | [A] |
| S-14 | Update and advance sent concurrently                                       | Exactly one wins; no edit on a started order           | [A] |
| S-15 | Invalid body (bad size, qty, tip, code)                                    | 400 with field messages; nothing stored                | [A] |
| S-16 | Client sends price fields                                                  | Rejected by strict schema (400)                        | [A] |
| S-17 | UI submit times out and retries                                            | One order created, same id shown                       | [A] |
| S-18 | UI hides or disables Edit and Cancel unless Not Started; shows 409 clearly |                                                        | [M] |
| K-1  | `npm run kitchen -- advance <id>`                                          | Status moves one step                                  | [M] |
| K-2  | `KITCHEN_AUTO_ADVANCE_SECONDS=N`                                           | Orders unchanged for N seconds move one step           | [A] |

## R6. Extensibility

**Acceptance criteria**

- Pricing takes the menu and promo registry as data; adding a size, topping, category or promo
  doesn't change the pricing function.

| ID  | Case                                                                             | Expected                                      |     |
| --- | -------------------------------------------------------------------------------- | --------------------------------------------- | --- |
| E-1 | Test menu adds size XL $15, category "luxury" 15%, topping "truffle"             | Prices correctly with no engine change        | [A] |
| E-2 | Test registry adds a promo with its own condition that conflicts with ILOVEPIZZA | Conflict resolution picks the larger discount | [A] |

## Deliverables checklist

- [x] Hosted git repo, readable commit history
- [x] README: run builder, run service, run tests (one or two commands each)
- [x] README: API summary with example requests
- [x] README: Assumptions (the list above, kept in sync)
- [x] README: design write-up (money, extensibility, lifecycle walk-throughs, cuts and next steps)
- [x] README: AI usage note (tools, one rejected output, one invariant verified by hand)
- [x] README: which invariants are tested and why, which aren't
- [x] `bash scripts/check.sh` green
- [x] README has a requirement → code → test traceability table (IDs from this file)
- [x] Test names start with the ID they cover (e.g. `PR-7 SAVE5 wins when it saves more`)

## Mock AI evaluation (before submitting)

Assume the grader is an AI given the brief and the repo. Rehearse it:

1. **Clean-clone run.** Fresh clone into a temp dir, then run only the README's commands verbatim
   (install, start service, start builder, tests). Any command that fails or needs an unstated
   step is a finding.
2. **Cold grader.** A fresh subagent with no context except the brief and the repo URL. It scores
   each "What we evaluate" area 1–5 with file:line evidence, walks every Deliverables bullet and
   every requirement, and lists the five changes that would most raise the score.
3. **Spot-check claims.** It picks 5 rows from the pricing tables and 3 lifecycle claims from the
   README and checks them against the code and a live request.
4. **Fix only** correctness, missing deliverables and README claims that don't match the code.
   No new features in this phase.
