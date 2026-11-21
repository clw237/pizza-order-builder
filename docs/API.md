# Order service API

The HTTP API of `apps/service`. Run it with `KITCHEN_TOKEN=dev-secret npm run service` (port 3000).

All bodies are JSON. Money is integer cents. Errors are `{ "error": CODE, "message": "...", ... }`.

| Method and path            | Purpose                 | Notes                                                                            |
| -------------------------- | ----------------------- | -------------------------------------------------------------------------------- |
| `POST /orders`             | Submit an order         | Requires `Idempotency-Key`. 201 with the order                                   |
| `GET /orders/:id`          | Order and its status    | 404 if unknown                                                                   |
| `GET /orders`              | Restaurant: all orders  | Requires `Kitchen-Token`; 401 if missing or wrong. Used by the kitchen CLI       |
| `PUT /orders/:id`          | Replace the order       | Requires `Idempotency-Key` and `If-Match: <version>`. Only while Not Started     |
| `POST /orders/:id/cancel`  | Cancel                  | Requires `Idempotency-Key`. Only while Not Started. Cancelling again returns 200 |
| `POST /orders/:id/advance` | Restaurant: next status | Requires `Kitchen-Token`. Not Started → Started → Ready for Pickup → Delivered   |
| `GET /health`              | Liveness                |                                                                                  |

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
  "quote": { "subtotal": 1666, "appliedPromos": ["ILOVEPIZZA"], "promoNotices": [], "discount": 167, "tax": 97, "tip": 319, "total": 1915, "lines": [ … ] },
  "nextStatus": "STARTED",
  "nextStatusAt": "2026-11-21T00:20:20.000Z"
}
```

`nextStatus` and `nextStatusAt` say when the kitchen timer will move the order on; both are `null`
when that step is left to the kitchen or the order is Delivered or Cancelled.

Update and cancel:

```bash
curl -s -X PUT localhost:3000/orders/<id> \
  -H "content-type: application/json" -H "idempotency-key: 2a41-demo" -H "if-match: 1" \
  -d '{"order":{"lines":[{"sizeId":"large","quantity":1,"toppingIds":[]}],"promoCodes":[],"tip":{"mode":"dollars","value":""}},"expectedTotalCents":1278}'
curl -s -X POST localhost:3000/orders/<id>/cancel -H "idempotency-key: 5c2e-demo"
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
