# Delivery roadmap

Statuses use: implemented and tested locally; integration implemented but live verification
pending; database migration created but not deployed; blocked; designed but intentionally
deferred.

| Phase | Owner | Exit criteria | Current status |
|---|---|---|---|
| 0. Audit | product-orchestrator, repository-archaeologist | Baseline, map, evidence, fleet, ownership, risks, deletion ledger | Implemented and tested locally |
| 1. Security P0 | security, privacy-safety, voice, revenue, qa | Live RLS, secure auth, safe config, limits, session lifecycle, reauth, safety foundation | Safety foundation and local integrations implemented; live/external verification pending |
| 2. Data/infrastructure | data-sync, observability, security | Versioned sync, conflicts, offline retry, privacy-safe analytics, cost alerts | Implemented and tested locally; revision migration measured on a disposable project; live two-device/release verification pending |
| 3. Onboarding | onboarding UX, design system, privacy-safety | One welcome, useful choices, readiness, contextual mic, returning-user migration | Implemented and tested on `phase-3-onboarding`; local web route proof complete, native/five-viewport QA and migration deployment remain external |
| 4. Practice | practice UX, learning science, data-sync | Retrieval before reveal, one mastery source, durable batches, transfer | Existing review, drill and curation paths are partial; the Phase 4 unification is not started |
| 5. Tutor | tutor behaviour, voice, learning science, privacy-safety | Three modes, correction policy, recovery, safety, durable curation | Partially implemented; safety/modes incomplete |
| 6. Retention | progress-retention, learning science, design system | Passport, delayed test, less-help replay, honest reminders/story | Designed but intentionally deferred until sync/evidence stabilise |
| 7. Revenue | revenue, security, privacy-safety | One paid tier, verified receipts/webhooks, restore/lifecycle, fair-use economics | Blocked by product/store credentials; implementation missing |
| 8. Privacy/release | privacy-safety, qa-release, deploy | Reviewed policies, export/deletion, full device/live/build gate and rollback | Blocked; policies, devices and deployment evidence missing |

No later phase may be called complete against an unstable security or data contract.
Cross-territory files are changed sequentially, with a single owner at a time.

## Phase boundary: land Phase 3 before starting Phase 4

`main` does not yet contain the Phase 3 onboarding floor. Phase 4 must therefore
**not** branch from today's `main`. The required sequence is:

1. finish the Phase 3 landing gate and resolve any unrelated dirty worktree that
   blocks a merge;
2. merge `phase-3-onboarding` into `main` without rebasing the pushed branch;
3. update the main checkout and confirm the merged commit passes `npm run gate`;
4. create `phase-4-practice` from that merged Phase 3 commit.

Branching earlier would make Phase 4 reintroduce the deleted onboarding surfaces,
miss the new migration and accessibility contracts, or spend its first merge
reconciling work that was already finished.

## Phase 4 execution order

1. **Retrieval before reveal.** Previously learned, due production items require
   an attempt before the answer and help appear. Genuinely new material keeps its
   scaffolded introduction; listening exercises remain listening exercises.
2. **One phrase-evidence source.** Define explicit evidence states such as
   introduced, recalled, used in conversation and transferred. Reconcile the
   brain's three-use mastery flag, the review scheduler, phrasebook `steady`, path
   completion and field-wise cross-device profile merging as projections of that
   source rather than competing verdicts.
3. **Durable practice batches.** Journal/outbox first with a stable batch id;
   idempotent phrase, topic and drill writes; explicit durability acknowledgements;
   clear only after the full batch is acknowledged. Test crash boundaries, storage
   full, retry and duplicate delivery.
4. **Transfer evidence.** Keep the existing generated-drill transfer policy, add
   acceptance tests across changed situations, and feed the result into the same
   phrase-evidence model rather than a parallel score.
5. **Exit evidence.** Full gate with newly blessed floors, web first-run, storage-
   failure recovery, live two-device convergence where credentials exist, and the
   roadmap/evidence snapshot updated to the measured results only.
