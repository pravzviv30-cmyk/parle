# docs

Read the one file that answers your question. That is the whole point of this
folder: a session should be able to load a single page and start work, instead of
re-deriving the architecture from source every time.

Every file and folder directly under `docs/` has a row below.
`scripts/repoStructure.test.mjs` fails when one is missing, so add the row when
you add the file.

## Living reference

Kept current. Read these first.

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
| Where the learner's data lives and what shape it is in | [STATE_AND_STORAGE.md](STATE_AND_STORAGE.md) |
| What Luvani collects, how long it keeps it, and what the tutor does with a safety concern | [PRIVACY_AND_SAFETY.md](PRIVACY_AND_SAFETY.md) |
| How to run and write tests, and the trap that eats whole suites | [TESTING.md](TESTING.md) |
| The gate, local planned changes, bug repair and resume | [LOOP.md](LOOP.md) |
| Building something new: Fable designs, Opus builds, Fable judges | [FORGE.md](FORGE.md) |
| Who owns which part of the codebase, and which agent to call | [TEAM.md](TEAM.md) |
| What is known to be broken right now | [KNOWN_ISSUES.md](KNOWN_ISSUES.md) |
| What is implemented, local-only, missing, or externally blocked | [IMPLEMENTATION_EVIDENCE.md](IMPLEMENTATION_EVIDENCE.md) |
| How the founder and Claude redesign screens together, the founder's taste log and the screen queue | [DESIGN_PARTNERSHIP.md](DESIGN_PARTNERSHIP.md) |
| The current runtime path and replacement dependency graph | [CURRENT_STATE_MAP.md](CURRENT_STATE_MAP.md) |
| The controlled product/security/release phases | [DELIVERY_ROADMAP.md](DELIVERY_ROADMAP.md) |
| The risks that block users, payments, or release | [RISK_REGISTER.md](RISK_REGISTER.md) |
| What old code may be removed, and only after which checks | [DELETION_LEDGER.md](DELETION_LEDGER.md) |
| The illustration and icon sets | [design-assets/](design-assets/) |
| The design research behind direction B: app audit, design DNA, delivery plan | [design-research/](design-research/) |

## Setup and runbooks

How to set something up, release it or check it.

| If you need to | Read |
|---|---|
| Set up social sign-in | [OAUTH_SETUP.md](OAUTH_SETUP.md) |
| Set up RevenueCat (deferred until the Apple membership) | [REVENUECAT_SETUP.md](REVENUECAT_SETUP.md) |
| Host the privacy and support pages, and see what App Store Connect needs | [LEGAL_HOSTING.md](LEGAL_HOSTING.md) |
| Publish iPhone previews from main without Metro or USB, and the remaining setup | [REMOTE_UPDATES.md](REMOTE_UPDATES.md) |
| Release and recover the backend | [BACKEND_RELEASE_RUNBOOK.md](BACKEND_RELEASE_RUNBOOK.md) |
| Know what a green local gate does not prove before release | [RELEASE_GATE.md](RELEASE_GATE.md) |
| Capture and validate voice and learning acceptance evidence | [VOICE_ACCEPTANCE_TOOLKIT.md](VOICE_ACCEPTANCE_TOOLKIT.md) |
| Run the tutor-audio batches, the credit-reset reminder and the pre-publication checklist | [DAILY_AUDIO_ROLLOUT.md](DAILY_AUDIO_ROLLOUT.md) |

## Dated reports

Records of one piece of work on one date. They are not kept current; check the
living reference before acting on one.

| Date | Report |
|---|---|
| 19 Sep 2026 | [HOME_FRIENDS_REVIEW.md](HOME_FRIENDS_REVIEW.md): Home, Friends and offline daily packs review handoff |
| 20 Sep 2026 | [TUTOR_INTELLIGENCE_PLAN.md](TUTOR_INTELLIGENCE_PLAN.md): tutor intelligence and availability |
| 20 Sep 2026 | [TUTOR_REVIEW.md](TUTOR_REVIEW.md): tutor experience revision |
| 3 Oct 2026 | [BACKEND_PRODUCTION_AUDIT.md](BACKEND_PRODUCTION_AUDIT.md): backend production audit, evidence limits and implementation priorities |
| 3 Oct 2026 | [BACKEND_INDUSTRY_BENCHMARK.md](BACKEND_INDUSTRY_BENCHMARK.md): primary-source backend practices comparison and 100-app/service evidence register |
| 3 Oct 2026 | [REVAMP_B_DESIGN_REVIEW.md](REVAMP_B_DESIGN_REVIEW.md): the recommendations from the 100-app design review, with its app list in [REVAMP_B_100_APP_REFERENCES.csv](REVAMP_B_100_APP_REFERENCES.csv) |
| 3 Oct 2026 | [REVAMP_B_CONTINUATION.md](REVAMP_B_CONTINUATION.md): Report 2 implementation disposition and remaining acceptance holds |
| 3 Oct 2026 | [UX_ACCEPTANCE_REVIEW.md](UX_ACCEPTANCE_REVIEW.md): iPhone and French UX acceptance review kit |
| 3 Oct 2026 | [UX_REPORT_IMPLEMENTATION.md](UX_REPORT_IMPLEMENTATION.md): implementing the two UX reviews |
| 4 Oct 2026 | [BACKEND_IMPLEMENTATION.md](BACKEND_IMPLEMENTATION.md): backend production implementation and release disposition |
| 4 Oct 2026 | [VIDEO_UX_PRODUCTION_REVIEW.md](VIDEO_UX_PRODUCTION_REVIEW.md): the five-video UX production review |
| 4 Oct 2026 | [VIDEO_UX_IMPLEMENTATION.md](VIDEO_UX_IMPLEMENTATION.md): implementing the five-video review |
| 7 Oct 2026 | [DEVICE_VERIFICATION.md](DEVICE_VERIFICATION.md): auth, session storage, deletion and first-run device checks |
| 10 Oct 2026 | [FIRST_LIVE_PRACTICE.md](FIRST_LIVE_PRACTICE.md): first live practice implementation |
| 11 Oct 2026 | [HEADSPACE_UX_REVIEW.md](HEADSPACE_UX_REVIEW.md): the Headspace interface review that informed the direction B redesign |
| Oct 2026 | [come-alive/README.md](come-alive/README.md): the "come alive" programme (motion, sound, streak, XP, icons, first run and paywall), with its founder decisions and build order |

## Evidence folders

Measurements, captures and verification output that the documents above cite.
Measure scripts write into some of them, so they keep their paths.

| Folder | Holds |
|---|---|
| [backend-audit-evidence/](backend-audit-evidence/README.md) | Source registers and method for the backend audit and benchmark |
| [backend-implementation-evidence/](backend-implementation-evidence/) | The backend implementation's local verification record |
| [cogs-evidence/](cogs-evidence/) | Cost per live minute: rates, spend, model evals and voice checks |
| [daily-allowance-evidence/](daily-allowance-evidence/) | Daily allowance screenshots |
| [first-live-evidence/](first-live-evidence/) | First live practice screenshots |
| [guest-scene-evidence/](guest-scene-evidence/) | Guest first scene screenshots |
| [live-latency-evidence/](live-latency-evidence/) | Live voice latency measurements |
| [revamp-evidence/](revamp-evidence/) | Revamp smokes, extractions and the 100-app reference panels |

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
