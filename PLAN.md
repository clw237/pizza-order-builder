# Plan

The design source of truth. Update it in the same change when the design changes.
Keep section numbers stable so commits and issues can cite them (e.g. §3.2).
Acceptance criteria and test IDs: `docs/ACCEPTANCE.md`.

## 1. Goal

A pizza order builder (web UI) and a separate order service (HTTP). The customer builds an order
with a live total, submits it, checks its status, and can change or cancel it until the kitchen
starts it. Timebox: 3 hours. Priorities: exact pricing and a defensible lifecycle over breadth.

## 2. Requirements

### 2.1 Must

- R1 order builder: line items with size, quantity, toppings; add, remove, modify.
- R2 running total that matches what the service charges.
- R3 written order description.
- R4 tip (dollars or %) and promo codes (ILOVEPIZZA, SAVE5) with clear errors.
- R5 order service as a separate process: submit → id, status, update and cancel only while
  Not Started, restaurant advances status, safe retries.
- R6 new size, topping, category or promo without changing the pricing function.

### 2.2 Should

- Property tests of pricing invariants.
- Optional auto-advance timer for the kitchen.
- TMNT look with Magic: The Gathering easter eggs (styling only, never pricing).
- `docker compose up`.

### 2.3 Won't (for now)

Auth, accounts, payments, real kitchen or delivery, menu admin UI, multiple locations,
persistent storage.

## 3. Inputs, outputs and edge cases

- Input (client → service): line items `{sizeId, quantity, toppingIds[]}`, `promoCodes[]`,
  `tip {mode: "dollars"|"percent", value: string}`, `expectedTotalCents`. Never prices.
- Output: a quote `{lines[], subtotal, discount, appliedPromo, promoNotices[], tax, tip, total}`
  in integer cents, plus order `{id, status, version}`.
- Edge cases: see Assumptions in `docs/ACCEPTANCE.md` (rounding, SAVE5 boundary, conflicting
  codes, unknown codes, duplicate toppings, quantity limits, tip parsing, retries, races).

## 4. Approach

- **Monorepo (npm workspaces), TypeScript end to end.**
  - `packages/pricing`: pure. Menu data, promo registry, `priceOrder()`, `describeOrder()`,
    zod schemas. Used by both the UI and the service, so there is one pricing function.
  - `apps/service`: Fastify. In-memory store, pure state machine, idempotency keys,
    optimistic versioning. Reprices every order; rejects a mismatched `expectedTotalCents`.
  - `apps/web`: Vite + React. Calls `priceOrder()` on every change.
- **Money:** integer cents; rates in basis points; `applyRate` rounds half-up with integer math.
  Each percentage is applied once at order level.
- **Extensibility:** sizes, categories (with rate) and toppings are data. A promo is
  `{code, conflictsWith[], evaluate({subtotal, pizzaCount}) → {eligible, discount | reason}}` in a registry.
  Conflicts are resolved by keeping the larger discount (ties: registry order).
- **Lifecycle:** `NOT_STARTED → STARTED → READY_FOR_PICKUP → DELIVERED`, plus
  `NOT_STARTED → CANCELLED`. Transitions are checked and applied in one synchronous step, so a
  cancel and a kitchen start can't both succeed.
- **Retries:** `Idempotency-Key` on POST and PUT replays the stored response. PUT also needs
  `If-Match: <version>`. Cancel is idempotent.
- Complexity: pricing is O(lines × toppings + promos²); trivial at this size.

## 5. Build order

Each slice is runnable and tested on its own.

1. Walking skeleton: workspace, check green, one pricing test. ✅
2. Pricing engine: menu, toppings, promos with conflicts, tax, tips, invariants. (must) ✅
3. Description and input validation. (must)
4. Service: endpoints, state machine, idempotency, versioning, race tests. (must)
5. Web UI: builder, live total, submit with retry, status, edit and cancel. (must)
6. Kitchen CLI and optional timer. (must: CLI; cut first: timer)
7. TMNT / Magic theme. (cuttable)
8. `docker compose up`. (cuttable)
9. README, then mock AI evaluation (`docs/ACCEPTANCE.md`), then fixes. (must)

## 6. Open questions

All ambiguities are resolved as numbered assumptions in `docs/ACCEPTANCE.md` and copied into
the README.
