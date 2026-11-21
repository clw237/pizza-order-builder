# 0004. Round money half to even

- Status: Accepted
- Date: 2026-11-20

## Context
The brief doesn't say how to round. Discount, tax and a percentage tip each produce fractions of a
cent, and with 6.5% tax exact half cents are common: tax on $5.00 is 32.5¢ and on $7.00 is 45.5¢.

The first pricing engine (#2) rounded half up. That choice had no record of its own. The owner's
decision review (`PLAN.md` §5.1 item 10) changed it before release, in #15. This record replaces
the half-up rule.

## Options
1. Half up: matches a hand check and many US sales-tax rules / every tie goes up, so over many
   orders the store collects slightly more tax and gives slightly smaller discounts than the true
   amounts.
2. Half to even (banker's rounding): ties split evenly, so rounding errors cancel out; it is IEEE
   754's default and what Python's `round()` and .NET's `Math.Round` do / a hand check with half up
   can differ by 1¢.
3. Truncate: simplest / always biased down.

## Decision
Half to even, applied once per amount at order level in `applyRate`, in integer arithmetic. The
reasons and worked examples are in `docs/DESIGN.md` ("Money and the order total") and the README's
assumption 3.

## Consequences
- Builder and service always agree to the cent, because both call the same `applyRate`.
- A tie can surprise someone checking by hand, so assumption 3 states the rule with examples.
- Tests P-1, P-3, PR-8 and T-6 pin the tie cases. When the change was made, breaking the rounding
  on purpose showed the tests notice: truncating failed 15 tests and half up failed 6.
- Revisit only if a real store's tax authority requires another rule. That is a one-line change in
  `applyRate`, made in a new record that supersedes this one.
