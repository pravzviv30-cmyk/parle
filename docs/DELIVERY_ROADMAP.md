# Delivery roadmap

Statuses use: implemented and tested locally; integration implemented but live verification
pending; database migration created but not deployed; blocked; designed but intentionally
deferred.

| Phase | Owner | Exit criteria | Current status |
|---|---|---|---|
| 0. Audit | product-orchestrator, repository-archaeologist | Baseline, map, evidence, fleet, ownership, risks, deletion ledger | Implemented and tested locally |
| 1. Security P0 | security, privacy-safety, voice, revenue, qa | Live RLS, secure auth, safe config, limits, session lifecycle, reauth, safety foundation | Safety foundation and local integrations implemented; live/external verification pending |
| 2. Data/infrastructure | data-sync, observability, security | Versioned sync, conflicts, offline retry, privacy-safe analytics, cost alerts | Database schema partial; client sync missing |
| 3. Onboarding | onboarding UX, design system, privacy-safety | One welcome, useful choices, readiness, contextual mic, returning-user migration | Partially implemented; duplicate/stale flows remain |
| 4. Practice | practice UX, learning science, data-sync | Retrieval before reveal, one mastery source, durable batches, transfer | Partially implemented |
| 5. Tutor | tutor behaviour, voice, learning science, privacy-safety | Three modes, correction policy, recovery, safety, durable curation | Partially implemented; safety/modes incomplete |
| 6. Retention | progress-retention, learning science, design system | Passport, delayed test, less-help replay, honest reminders/story | Designed but intentionally deferred until sync/evidence stabilise |
| 7. Revenue | revenue, security, privacy-safety | One paid tier, verified receipts/webhooks, restore/lifecycle, fair-use economics | Blocked by product/store credentials; implementation missing |
| 8. Privacy/release | privacy-safety, qa-release, deploy | Reviewed policies, export/deletion, full device/live/build gate and rollback | Blocked; policies, devices and deployment evidence missing |

No later phase may be called complete against an unstable security or data contract.
Cross-territory files are changed sequentially, with a single owner at a time.
