# Decision records

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
