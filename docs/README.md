# docs

Read the one file that answers your question. That is the whole point of this
folder: a session should be able to load a single page and start work, instead of
re-deriving the architecture from source every time.

| If you need to know | Read |
|---|---|
| Where an agent should start, and how to work in this checkout | [../AGENTS.md](../AGENTS.md), [../CONTEXT.md](../CONTEXT.md) |
| How to scope changes, order tasks and leave a handoff log | [changes/README.md](changes/README.md) |
| Why a new lasting architecture or workflow choice was made | [../DECISIONS.md](../DECISIONS.md) |
| What the six workspaces are and which one owns a decision | [ARCHITECTURE.md](ARCHITECTURE.md) |
| How a live session actually works, end to end | [LIVE_VOICE.md](LIVE_VOICE.md) |
| How the free tutor behaves, which model to use, and what it costs | [TUTOR_BRAIN.md](TUTOR_BRAIN.md) |
| The ladder, the rescue, and what counts as a right answer | [PEDAGOGY.md](PEDAGOGY.md) |
| Every screen a new learner crosses before the first French word | [ONBOARDING.md](ONBOARDING.md) |
| How main pushes can publish iPhone previews without Metro or USB, and remaining setup | [REMOTE_UPDATES.md](REMOTE_UPDATES.md) |
| Where the learner's data lives and what shape it is in | [STATE_AND_STORAGE.md](STATE_AND_STORAGE.md) |
| How to run and write tests, and the trap that eats whole suites | [TESTING.md](TESTING.md) |
| The gate, local planned changes, bug repair and resume | [LOOP.md](LOOP.md) |
| Building something new: Fable designs, Opus builds, Fable judges | [FORGE.md](FORGE.md) |
| Who owns which part of the codebase, and which agent to call | [TEAM.md](TEAM.md) |
| What is known to be broken right now | [KNOWN_ISSUES.md](KNOWN_ISSUES.md) |
| The 3 October backend production audit, evidence limits and implementation priorities | [BACKEND_PRODUCTION_AUDIT.md](BACKEND_PRODUCTION_AUDIT.md) |
| The primary-source backend practices comparison and 100-app/service evidence register | [BACKEND_INDUSTRY_BENCHMARK.md](BACKEND_INDUSTRY_BENCHMARK.md) |
| How the privacy and support pages get hosted, and what App Store Connect needs | [LEGAL_HOSTING.md](LEGAL_HOSTING.md) |
| What is implemented, local-only, missing, or externally blocked | [IMPLEMENTATION_EVIDENCE.md](IMPLEMENTATION_EVIDENCE.md) |
| Report 2 implementation disposition and remaining acceptance holds | [REVAMP_B_CONTINUATION.md](REVAMP_B_CONTINUATION.md) |
| The recommendations from the 100-app design review | [REVAMP_B_DESIGN_REVIEW.md](REVAMP_B_DESIGN_REVIEW.md) |
| The current runtime path and replacement dependency graph | [CURRENT_STATE_MAP.md](CURRENT_STATE_MAP.md) |
| The controlled product/security/release phases | [DELIVERY_ROADMAP.md](DELIVERY_ROADMAP.md) |
| The agreed tutor-audio batches, credit-reset reminder and pre-publication checklist | [DAILY_AUDIO_ROLLOUT.md](DAILY_AUDIO_ROLLOUT.md) |
| The risks that block users, payments, or release | [RISK_REGISTER.md](RISK_REGISTER.md) |
| What old code may be removed, and only after which checks | [DELETION_LEDGER.md](DELETION_LEDGER.md) |
| The Headspace interface review (11 October 2026) that informed the direction B redesign | [HEADSPACE_UX_REVIEW.md](HEADSPACE_UX_REVIEW.md) |
| The October 2026 "come alive" programme: motion, sound, streak, XP, icons, first run and paywall, with its founder decisions and build order | [come-alive/README.md](come-alive/README.md) |

These deliberately do not repeat what already exists:

- **[../README.md](../README.md)** — how to run it, which keys buy what, the wiring inventory.
- **[../PRODUCT.md](../PRODUCT.md)** — who this is for and why it exists. The source of truth
  for any question that starts "should we".
- **[../DESIGN.md](../DESIGN.md)** — colour, type, motion, copy tone. Recorded from the
  built artifact, not from intentions.
- **[../CLAUDE.md](../CLAUDE.md)** — the operating rules for working in this repo.

If you are about to write a fourth document explaining the ladder, stop: it is in
PEDAGOGY.md, and the code is in `packages/core/src/ladder/ladder.ts`. One
explanation per idea is the rule that keeps this folder worth reading.
