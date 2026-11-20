# Plan

The design source of truth. Update it in the same change when the design changes.
Keep section numbers stable so commits and issues can cite them (e.g. §3.2).

## 1. Goal
<What problem this solves, for whom, in two or three sentences.>

## 2. Requirements
### 2.1 Must
- <the smallest set that makes it useful / passes the challenge>
### 2.2 Should
- <next most valuable>
### 2.3 Won't (for now)
- <explicitly out of scope, so nobody builds it by accident>

## 3. Inputs, outputs and edge cases
- Input: <format, size, validity>
- Output: <format>
- Edge cases: <empty input, duplicates, huge input, bad data, ties, unicode, time zones...>

## 4. Approach
<Data model, main components, algorithm and its complexity, why this over the alternatives.
Link decision records for the significant choices.>

## 5. Build order
Each slice is runnable and tested on its own.
1. <walking skeleton: input → output end to end, one test>
2. <core logic>
3. <edge cases and errors>
4. <nice-to-haves from 2.2>

## 6. Open questions
- <question> → <answer, once known>
