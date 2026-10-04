---
description: Design it on Fable, build it on Opus, judge it on Fable — repeat until the gate is green and the judge says SHIP.
argument-hint: [what you want built]
---

Build `$ARGUMENTS` properly. The thinking happens on Fable, the building happens here, and
Fable checks the result before anyone calls it done.

Do not start editing. Step 2 is where the design comes from, and it is not you.

1. **Gather the brief.** Work out what the architect needs to know: the files in play, the
   existing pattern this would follow, anything already broken nearby. Use graphify to orient
   (`affected` and `explain` for named symbols, `query --context call` seeded on symbol
   names for how they connect, never a bare `query` and never a prose question — the
   first truncates and the second seeds on the wrong nodes). Keep it to a brief, not a dump.

2. **Dispatch the design-architect agent.** Give it the request verbatim and the brief. It
   runs on Fable and returns the contract. Write that to `.forge/<slug>/contract.md`, where
   `<slug>` is a few kebab-case words from the request.

   For a backend change, obtain the applicable specialist input before finalising the
   contract. `backend-architect` coordinates cross-service invariants; these reviewers
   advise the design-architect and never replace the territory builders or final judge.

   | Design decision | Architect |
   |---|---|
   | cross-service ownership, protocol and state transitions | **backend-architect** |
   | auth, RLS, grants, migrations, privacy, money storage | **database-security-architect** |
   | voice admission, media, typed commands, settlement and recovery | **voice-reliability-architect** |
   | hosting, CI enforcement, release compatibility and restore | **deployment-architect** |

   Select only roles touched by the change. `/backend-review` documents the shared
   evidence handoff. An unavailable pinned reviewer remains an explicit review gap.

3. **Get approval before any edit.** Show the contract. In plan mode that means
   `ExitPlanMode`; otherwise ask plainly and wait. Nothing is written to the repo until the
   contract is approved.

4. **File the ledger entries** from the contract into `docs/KNOWN_ISSUES.md`, verbatim.
   Continue the `F` numbering from the highest already there. This happens *before* the work,
   so the gate is watching while you build rather than after.

5. **Route it to whoever owns the files.** Read the contract's *Files to touch* and
   dispatch the engineer whose territory they fall in. Give it the contract and the ledger
   entries verbatim. Where an item is a **defect** rather than new work, dispatch
   **bug-hunter** instead — that is what it is for.

   | Files to touch | Engineer |
   |---|---|
   | programme roadmap, evidence matrix, ownership, risks | **product-orchestrator** |
   | repository inventory, duplicates, stale claims, deletion candidates | **repository-archaeologist** |
   | `apps/mobile/src/` screens, tabs, components, theme, nav | **frontend-engineer** |
   | welcome, auth handoff, consent, first useful French | **onboarding-ux-engineer** |
   | review, drills, saved phrases, attempt/reveal | **practice-ux-engineer** |
   | progress, goals, reminders, return cues | **progress-retention-engineer** |
   | theme tokens, components, motion, contrast, visual QA | **design-system-engineer** |
   | `apps/mobile/src/auth/`, `token-server/src/auth.ts` | **auth-engineer** |
   | any `store.ts`, `storage/scope.ts`, profile migrations | **data-engineer** |
   | Supabase learner sync, RLS, offline queue, conflicts | **data-sync-engineer** |
   | `server.ts` endpoints, `core/src/protocol/`, `brain/src/llm/` | **api-engineer** |
   | `services/tutor-agent/`, the rest of `token-server/` | **backend-engineer** |
   | LiveKit grants, participants, STT/TTS, reconnect, hard duration | **voice-platform-engineer** |
   | tutor persona, rescues, recasts, mode parity, safety behaviour | **tutor-behaviour-engineer** |
   | mastery, retrieval, spacing, scaffold fading, evidence validity | **learning-science-engineer** |
   | `core/src/metering/`, entitlement writes, anything priced | **revenue-engineer** |
   | `ttsCache.ts`, `warmCache.ts`, `timing.ts`, cache breakpoints | **performance-engineer** |
   | rate limits, secrets, CORS, headers, `agentAuth.ts` | **security-engineer** |
   | consent, retention, deletion, analytics privacy, safety policy | **privacy-safety-engineer** |
   | friends, leaderboards, sharing, competition | **social-systems-engineer** |
   | `usage.ts` logging, `live/failure.ts`, diagnostics | **observability-engineer** |
   | `app.json`, `eas.json`, CI, containers | **deploy-engineer** |
   | independent final gate, device/build matrix, rollback | **qa-release-engineer** |

   Two rules. **Core pedagogy has one specialist, `learning-science-engineer`**: it protects
   the canonical implementation rather than creating a second ladder. And **an engineer
   edits only its own territory** — where the contract spans several, dispatch each in turn
   on its own files rather than letting one reach across. Work outside every territory is a
   new ledger entry, not a quiet extra edit.

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
