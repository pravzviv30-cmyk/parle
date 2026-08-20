---
description: Release readiness — run the guards over the current state and report what blocks a ship.
argument-hint: [optional: what you are about to ship]
---

Ask the team whether this is safe to release. Nothing is edited by this command: the guards
look, and you report. If they find work, it becomes ledger entries for `/forge` to route.

1. **Run `npm run gate`** from the repo root, never a worktree. Capture it with `--json` so
   the failure list can be compared rather than eyeballed. A red gate does not stop this
   command — knowing what is red is part of the answer — but it does mean the verdict is
   `HOLD` unless every failure is a P2.

2. **Dispatch the guards in parallel.** Give each one the gate output and `$ARGUMENTS` if
   any was given. Tell every one of them explicitly: **review only, change nothing.**

   - **security-engineer** — what an untrusted caller can reach, and what they gain.
   - **performance-engineer** — the latency budget and the cache, with numbers.
   - **release-engineer** — branch shape, commit hygiene, and the revert path. Returns
     `LAND` or `HOLD`.
   - **deploy-engineer** — which link in the hosting chain is missing.
   - **scaling-engineer** — returns `NOT YET` or `NOW`, with the metric that decides it.

3. **File what they found** into `docs/KNOWN_ISSUES.md`, continuing the `F` numbering from
   the highest already there, in the exact format the gate parses.

   **File as P2 unless a finding was demonstrated with a failing test.** P0 and P1 block the
   gate for the whole repo, so a guard that files them freely stops everyone's work on a
   hunch. A real exploit or a measured regression earns P1; an opinion does not. This is the
   same release valve `/forge`'s judge already relies on.

4. **Report in five lines**: the verdict, what the gate says, the one thing most likely to
   bite a real learner, what was filed, and what was deliberately not done. If the honest
   answer is "not ready, and here is the single reason", say that instead of listing effort.

Never weaken a test, lower a floor, tick a box the gate cannot confirm, or let a guard edit
the code it was asked to review.
