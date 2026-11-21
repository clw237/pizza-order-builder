# Decision records

Records 0001–0003 cover the repository tooling. The pizza exercise's own decisions (money,
rounding, promo conflicts, the order lifecycle) are the numbered Assumptions and the Design
write-up in the main `README.md`, next to the code they describe.

One short file per significant choice: language, framework, data store, algorithm, a trade-off
someone will later ask "why?" about. Number them in order (`0002-use-sqlite.md`). Don't edit an accepted
record. Supersede it with a new one and change the old one's status to `Superseded by 00NN`.

## Template

```markdown
# 00NN. <Decision in a few words>

- Status: Accepted
- Date: YYYY-MM-DD

## Context
<The problem and the forces at play: constraints, time, what matters most.>

## Options
1. <option>: <pro> / <con>
2. <option>: <pro> / <con>

## Decision
<What we chose, in one or two sentences.>

## Consequences
<What gets easier, what gets harder, and what would make us revisit this.>
```
