---
description: One pass of the bug loop — gate, fix the top open item, verify it adversarially, update the ledger.
---

Run one sweep against the bar. Designed to be looped: `/loop 15m /bug-sweep`.

1. Run `npm run gate`. If it is green, say so and stop — do not invent work.
2. Read `docs/KNOWN_ISSUES.md` and take the **highest-severity open item** (P0 before P1
   before P2). If the gate is failing for a reason with no ledger entry, add one first.
3. Dispatch the **bug-hunter** agent on that one item. Give it the gate's failure output
   verbatim and the ledger entry.
4. Dispatch the **fix-verifier** agent on what came back. If it reports REFUTED, hand its
   reasons back to bug-hunter and go round again — at most twice, then stop and report
   what is blocking.
5. Re-run `npm run gate`. Tick the ledger box only if it is green **and** the named test
   passes.
6. Report in three lines: what was wrong, what changed, and the gate's before/after
   numbers. If nothing improved, say that plainly rather than describing effort.

Never weaken a test, lower a floor, or tick a box the gate cannot confirm.
