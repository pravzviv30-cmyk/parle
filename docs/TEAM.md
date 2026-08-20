# The team

Sixteen agents work on this repo. Four of them are **roles in a loop** and twelve are
**engineers who own a territory**, and the difference matters when you are deciding who to
call.

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
| `api-engineer` | opus | yes | the four endpoints, `core/src/protocol/`, `brain/src/llm/` |
| `revenue-engineer` | opus | yes | `core/src/metering/`, entitlement writes, anything priced |
| `performance-engineer` | opus | yes | `ttsCache.ts`, `warmCache.ts`, `timing.ts`, prompt-cache breakpoints |
| `security-engineer` | opus | yes | rate limits, secrets, CORS, headers, `agentAuth.ts` |
| `observability-engineer` | opus | yes | `usage.ts` logging, `live/failure.ts`, diagnostics |
| `deploy-engineer` | opus | yes | `app.json`, `eas.json`, CI, containers |
| `release-engineer` | opus | **no** | git: branch shape, commit shaping, revert paths |
| `scaling-engineer` | fable | **no** | nothing. It answers "should we", and usually says no |

`packages/core` pedagogy — the ladder, lesson matching, the session summary — has **no
specialist on purpose**. [ARCHITECTURE.md](ARCHITECTURE.md) gives each of those decisions
exactly one owner, and a second opinion about them is how a repo grows two ladders. That
work stays with whoever is driving, reading [PEDAGOGY.md](PEDAGOGY.md).

## Territory is the point

An engineer edits inside its own paths and **files** work outside them. That is not
bureaucracy, it is the thing that stops three agents editing `ttsCache.ts` in the same
round and stops a screen quietly re-deciding what counts as a right answer.

Where a contract spans several territories, `/forge` dispatches each engineer in turn on
its own files rather than letting one reach across.

## The two that answer rather than build

`release-engineer` and `scaling-engineer` have no `Edit` and no `Write`, for the same
reason `design-architect` and `work-judge` do not: an agent that can quietly fix what it
found has stopped being a second opinion.

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

Note what `scaling-engineer` will tell you first, because it is real today:
`InMemoryEntitlementStore` and the per-process score budget are **correctness bugs under
concurrency**, not capacity problems. They bite at two instances, not at scale.

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
