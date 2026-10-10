# Luvani context index

This is a routing page. Detailed facts belong in the linked documents; runtime
truth belongs in the current checkout. Read [AGENTS.md](AGENTS.md) for working
rules and [docs/README.md](docs/README.md) for the full topic index.

## Load the context for the change

| Change | Read first | Start looking in |
|---|---|---|
| Product direction | [PRODUCT.md](PRODUCT.md) | Existing feature and roadmap documents |
| Workspace or shared interface | [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) | `packages/core/src/`, then the consumers |
| Existing runtime or replacement | [docs/CURRENT_STATE_MAP.md](docs/CURRENT_STATE_MAP.md) | The entry points named in that map |
| Screen, copy, motion or navigation | [DESIGN.md](DESIGN.md) | `apps/mobile/src/nav/`, `tabs/`, root screen `.tsx` files and `components.tsx` |
| Onboarding | [docs/ONBOARDING.md](docs/ONBOARDING.md) | `apps/mobile/src/onboarding/` |
| Live voice | [docs/LIVE_VOICE.md](docs/LIVE_VOICE.md) | `services/tutor-agent/src/`, `apps/mobile/src/live/` |
| Tutor intelligence | [docs/TUTOR_BRAIN.md](docs/TUTOR_BRAIN.md) | `packages/brain/src/` |
| Learning or grading | [docs/PEDAGOGY.md](docs/PEDAGOGY.md) | `packages/core/src/` |
| Storage, account scope or sync | [docs/STATE_AND_STORAGE.md](docs/STATE_AND_STORAGE.md) | `apps/mobile/src/storage/`, `sync/`, server adapters |
| Testing or a missing suite | [docs/TESTING.md](docs/TESTING.md) | The affected workspace and `scripts/gate.mjs` |
| Dependencies, tasks and handoff | [docs/changes/README.md](docs/changes/README.md) | The existing plan or `docs/changes/<slug>.md` |
| Claude Code design/build loop | [docs/FORGE.md](docs/FORGE.md) | `.claude/commands/`, `.claude/agents/` |
| Release readiness | [docs/DELIVERY_ROADMAP.md](docs/DELIVERY_ROADMAP.md) | [docs/IMPLEMENTATION_EVIDENCE.md](docs/IMPLEMENTATION_EVIDENCE.md), [docs/RISK_REGISTER.md](docs/RISK_REGISTER.md) |
| New durable decision | [DECISIONS.md](DECISIONS.md) | The decision's linked source and change plan |

## Establish what is current

Read `git status` and the revision in this checkout before treating a plan as
implemented. Release and hosted acceptance claims come from their existing
evidence records, not from this index or a completed task label.

Use [README.md](README.md) for setup and [package.json](package.json) for the
available commands. A preview's server directory determines which checkout it
shows; an HTTP success or a merge elsewhere does not establish that identity.

Keep secrets, transcripts and learner records out of context documents and task
logs. Link to existing evidence instead of copying large captures into prompts.
