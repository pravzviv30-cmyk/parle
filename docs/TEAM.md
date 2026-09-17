# The team

The fleet combines loop roles, subsystem engineers, and product specialists. The
difference matters when deciding who may build, who coordinates, and who must remain an
independent reviewer.

The loop roles are about *when*: `design-architect` decides the shape before anything is
written, `bug-hunter` repairs a defect, `fix-verifier` tries to refute the repair,
`work-judge` says SHIP or REVISE. They are documented in [LOOP.md](LOOP.md) and
[FORGE.md](FORGE.md).

The engineers are about *where*. Each one owns a set of paths the way a senior dev owns a
subsystem, and knows the things about those paths that a generalist gets wrong.

## Who owns what

| Engineer | Model | Edits? | Territory |
|---|---|---|---|
| `frontend-engineer` | opus | yes | `apps/mobile/src/` screens, tabs, components, theme, nav |
| `backend-engineer` | opus | yes | `services/tutor-agent/`, `services/token-server/` |
| `data-engineer` | opus | yes | every `store.ts`, `storage/scope.ts`, profile migrations, `EntitlementStore` |
| `auth-engineer` | opus | yes | `apps/mobile/src/auth/`, `token-server/src/auth.ts` |
| `api-engineer` | opus | yes | token-server endpoints, `core/src/protocol/`, `brain/src/llm/` |
| `revenue-engineer` | opus | yes | `core/src/metering/`, entitlement writes, anything priced |
| `performance-engineer` | opus | yes | `ttsCache.ts`, `warmCache.ts`, `timing.ts`, prompt-cache breakpoints |
| `security-engineer` | opus | yes | rate limits, secrets, CORS, headers, `agentAuth.ts` |
| `observability-engineer` | opus | yes | `usage.ts` logging, `live/failure.ts`, diagnostics |
| `deploy-engineer` | opus | yes | `app.json`, `eas.json`, CI, containers |
| `release-engineer` | opus | **no** | git: branch shape, commit shaping, revert paths |
| `scaling-engineer` | fable | **no** | nothing. It answers "should we", and usually says no |
| `product-orchestrator` | opus | yes | phased plan, evidence matrix, ownership, risk and release gates |
| `repository-archaeologist` | fable | **no** | current-state inventory, duplicates, stale claims, deletion candidates |
| `data-sync-engineer` | opus | yes | Supabase sync, RLS, offline queue, conflicts, migrations |
| `voice-platform-engineer` | opus | yes | LiveKit, STT/TTS, reconnects, duration and voice cost ceilings |
| `tutor-behaviour-engineer` | opus | yes | persona, rescues, recasts, safety and voice/text parity |
| `learning-science-engineer` | opus | yes | mastery evidence, retrieval, spacing and scaffold fading |
| `onboarding-ux-engineer` | opus | yes | welcome through first useful French, consent and readiness |
| `practice-ux-engineer` | opus | yes | review, drills, saved phrases and attempt-before-reveal |
| `progress-retention-engineer` | opus | yes | honest progress, goals, reminders and return cues |
| `design-system-engineer` | opus | yes | tokens, components, motion, accessibility and visual QA |
| `privacy-safety-engineer` | opus | yes | minimisation, consent, retention, deletion and safety policy |
| `social-systems-engineer` | fable | **no** | approval gate for social, moderation and abuse systems |
| `qa-release-engineer` | opus | **no** | independent product/security/learning/build release evidence |

`packages/core` pedagogy — the ladder, lesson matching, and session summary — is owned by
`learning-science-engineer`. [ARCHITECTURE.md](ARCHITECTURE.md) still gives each decision
one implementation; the specialist protects that single source rather than creating a
second ladder.

## Territory is the point

An engineer edits inside its own paths and **files** work outside them. That is not
bureaucracy, it is the thing that stops three agents editing `ttsCache.ts` in the same
round and stops a screen quietly re-deciding what counts as a right answer.

Where a contract spans several territories, `/forge` dispatches each engineer in turn on
its own files rather than letting one reach across.

Revamp A (2026-09) split `apps/mobile/src/` between two of them, because the table above
gives the whole folder to `frontend-engineer` and also names `design-system-engineer` for
components. The split that held: `design-system-engineer` owns `palette.ts`, `theme.ts`,
`components.tsx` (append-only, since `components.test.ts` slices it between adjacent
exports), `glyphs.tsx`, `surface/`, `art/`, `assets/art/`, `layout.tsx`, `nav/icons.tsx`,
`nav/LuvaniTabBar.tsx`, the orb files under `tutor/`, and DESIGN.md's Colour, Type,
Surfaces, Illustrations and Motion sections. `frontend-engineer` owns the tabs, the
screens, `nav/` wiring, `surfaceContract.test.ts`, `labels.test.ts` and DESIGN.md's
Structure. `practice-ux-engineer` owns the drill and review screens, the made-from rows,
the one-line card and the judge client. When a round runs several engineers at once, the
cross-cutting test files belong to one integrator and nobody else edits them.

## The independent reviewers

`release-engineer`, `scaling-engineer`, `repository-archaeologist`,
`social-systems-engineer`, and `qa-release-engineer` have no `Edit` and no `Write`, for the
same reason `design-architect` and `work-judge` do not: an agent that can quietly fix what
it found has stopped being a second opinion.

- `release-engineer` returns `LAND` or `HOLD`, with the revert path and what it would not
  undo.
- `scaling-engineer` returns `NOT YET` or `NOW`, and for `NOT YET` the trigger metric is
  mandatory. An answer without a number is not an answer.

## Three of them are ahead of the code

`deploy-engineer`, `observability-engineer` and `scaling-engineer` own territories that
barely exist yet. There is no `eas.json`, no CI, no error-tracking SDK, no second instance
of anything, and at zero users none of that is a mistake.

They ship with instructions rather than infrastructure, and their first answer is usually
the seam plus the condition that would justify filling it. That is deliberate. Premature
infrastructure is a bug you cannot test and a bill you pay monthly.

Note what `scaling-engineer` will tell you first: production's Supabase/Upstash concurrency
controls require live multi-instance proof; the memory/file implementations are local-only
fixtures and cannot be treated as a deployable fallback.

## Calling them

**`/forge <what you want built>`** is the normal path. The architect designs, step 5 routes
to whoever owns the files, the gate runs, the judge decides. See [FORGE.md](FORGE.md).

**`/ship`** runs the guards over the current state and reports what blocks a release. It
edits nothing. Findings are filed as **P2 unless demonstrated with a failing test** —
P0 and P1 block the gate for the whole repo, and a guard that files them on a hunch stops
everyone's work.

**By name**, when you already know who you want: "have `performance-engineer` look at the
cache hit rate".

## The gate defends the fleet

`scripts/gate.mjs` scans `.claude/agents/` and fails on any agent that is not pinned to a
model in its `AGENT_MODELS` map. That check exists because the failure it prevents is
silent: an agent with no `model:` line still dispatches, still answers, and runs on
whatever model the session happened to be using.

`services/tutor-agent/src/agentFleet.test.ts` covers what a regex in the gate cannot: the
frontmatter field order, the name matching the file it is dispatched by, the guards staying
unable to edit, and `/forge` routing only to engineers that exist.

Adding an agent means: the file, the pin in `gate.mjs`, and a row in the routing table or a
mention in `/ship`. Miss any of the three and a test tells you which.
