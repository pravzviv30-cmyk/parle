---
description: Design it on Fable, build it on Opus, judge it on Fable — repeat until the gate is green and the judge says SHIP.
argument-hint: [what you want built]
---

Build `$ARGUMENTS` properly. The thinking happens on Fable, the building happens here, and
Fable checks the result before anyone calls it done.

Do not start editing. Step 2 is where the design comes from, and it is not you.

1. **Gather the brief.** Work out what the architect needs to know: the files in play, the
   existing pattern this would follow, anything already broken nearby. Use graphify to orient
   (`affected` and `explain` for named symbols, `query --context call` for a subsystem, never
   a bare `query` — it truncates here). Keep it to a brief, not a dump.

2. **Dispatch the design-architect agent.** Give it the request verbatim and the brief. It
   runs on Fable and returns the contract. Write that to `.forge/<slug>/contract.md`, where
   `<slug>` is a few kebab-case words from the request.

3. **Get approval before any edit.** Show the contract. In plan mode that means
   `ExitPlanMode`; otherwise ask plainly and wait. Nothing is written to the repo until the
   contract is approved.

4. **File the ledger entries** from the contract into `docs/KNOWN_ISSUES.md`, verbatim.
   Continue the `F` numbering from the highest already there. This happens *before* the work,
   so the gate is watching while you build rather than after.

5. **Build it.** You are the executor. Where an item is a defect rather than new work,
   dispatch **bug-hunter** instead — that is what it is for. Reproduce before you repair,
   fix the cause, and write the test named on the `verified-by:` line.

6. **Run `npm run gate`.** From the repo root, never a worktree.

7. **Dispatch the work-judge agent.** Give it the contract, the diff, and the gate output. It
   runs on Fable and answers `SHIP` or `REVISE`.

8. **On `REVISE`:** file its ledger entries verbatim, fix them, and go back to step 6. **At
   most three rounds.** If the third does not reach `SHIP`, stop and report what is blocking.
   Grinding past the cap is how a loop turns into a runaway.

9. **On `SHIP` with the gate green:** tick each ledger box whose named test actually passed,
   append the round log to `.forge/<slug>/contract.md`, and report in four lines — what was
   asked, what was built, the gate's before and after numbers, and how many rounds it took.
   If something was deferred, say so plainly rather than describing effort.

Never weaken a test, lower a floor, tick a box the gate cannot confirm, or let the judge grow
the job it was given.

Designed to be looped: `/loop /forge` to let it pace itself, or `/loop 30m /forge`.
