# Risk register

| Risk | Severity | Owner | Control now | Remaining action |
|---|---|---|---|---|
| Local migration is mistaken for deployed RLS | P0 | data-sync, qa | Evidence labels migration as undeployed | Run live A/B/anon/service tests |
| Voice usage exceeds or double-spends allowance | P0 | voice, revenue, security | Lease, hard stop, signed ID, unique ledger | Live Upstash/LiveKit/Postgres concurrency |
| Failed room charges learner | P0 | voice, revenue | Zero-second unusable report and idempotent release | End-to-end vendor failure tests |
| Unsafe tutor response | P0 | tutor behaviour, privacy-safety | Deterministic pre-model high-risk boundary plus prompt rules | Professional policy review, broader multilingual adversarial suite, reporting |
| Stolen old session deletes account | P0 | auth, privacy-safety | Server checks last real sign-in within five minutes | Live password/Google journeys |
| Trial farming creates unbounded vendor spend | P0 | revenue, security | Pseudonymous one-install/one-user claim | Auth CAPTCHA/email controls, reset analysis, alerts |
| Dependency advisory is exploitable | P0 unknown | security, qa | No forced update; install summary recorded | Approved authoritative audit and chain review |
| Learner loses local-only progress | P1 | data-sync | Crash-safe local stores/journal | Versioned cross-device sync and backup |
| Direct analytics write stores content | P1 | privacy-safety, security | Exact PostgreSQL validation trigger | Live bypass test, retention and opt-out |
| CSP/CORS differs from final domains | P1 | security, deploy | Exact allowlists in code | Replace placeholder domains and capture live headers |
| Paid status can be forged or lost | P0 before payments | revenue | No purchase UI is presented as working | Receipts, webhooks, replay safety, restore/lifecycle |
| Duplicate legacy flows create contradictory UX | P1 | onboarding, practice, design | Deletion candidates mapped | Switch callers, migrate, delete, dead-code scan |
| Auth forms are not programmatically labelled | P1 | design, onboarding, qa | Visible labels and 44px targets exist | Bind labels/headings, keyboard and screen-reader device QA |
| Antifraud identifier retention is undisclosed | P0 before users | privacy-safety | Pseudonymous HMAC only | Define retention and disclose purpose/control |
