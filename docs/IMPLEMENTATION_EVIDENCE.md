# Implementation evidence

Snapshot date: 2026-08-23. This document distinguishes repository evidence from deployed
evidence. A passing local test is not proof that a migration, header, credential, provider,
or store configuration is live.

## Baseline

- The inherited dirty worktree contained 85 modified files plus untracked product work.
  Those changes were treated as user-owned and were not reset, discarded, staged, or
  rewritten wholesale.
- The pre-change full gate passed 1,437 tests: core 500, brain 306, tutor agent 286,
  token server 48, playground 13, and mobile 284.
- Typechecks and the web export passed at baseline. The export produced ignored
  `apps/mobile/dist/` output.
- There is no lint script, no Supabase CLI, no CI workflow, and no production deployment
  manifest in the repository. Those checks cannot be presented as passing.
- The dependency install reported 16 advisories (11 moderate, 5 high). An offline audit
  later returned no cached advisories, which is not authoritative. Exact advisory chains
  and remediation remain blocked until registry audit access is approved.
- A filename and tracked-content scan found ignored local `.env` files and no tracked
  service-role/key pattern. A 23-file production export scan found no configured server
  secret value and no server-only variable name; the only non-local HTTP host was the W3C
  namespace. Git-history, CI and secret-manager checks have not been performed.

## Feature matrix

| Capability | Status | Repository evidence | Missing release evidence |
|---|---|---|---|
| Supabase identity | Implemented and tested locally | HS256 local compatibility, asymmetric JWKS preference, forged/expired/malformed-token tests | Live project JWKS, two-user HTTP tests |
| Production fail-closed mode | Implemented and tested locally | Explicit local-dev flags; server `start` pins production; mobile refuses implicit mock auth | Actual store/web production build and deployment env |
| Native auth storage | Implemented and tested locally | Chunked A/B SecureStore adapter, encrypted readback migration, orphan cleanup, plaintext failure refusal | iOS Keychain and Android Keystore device tests; bundle inspection |
| Learner-state RLS | Database migration created but not deployed | Own-row CRUD policies and static SQL contract tests | Disposable Supabase A/B-user, anon, forged-id, and service-role tests |
| Atomic entitlements | Integration implemented but live verification pending | Service-role RPC, SQL/TypeScript cap contract, roll-on-read | Deployed concurrent RPC test and migration verification |
| Idempotent usage debit | Integration implemented but live verification pending | Random signed session ID, `session_usage` unique ledger, retry test, zero-use reporting | Deployed retry/concurrency test and reconciliation monitoring |
| One active session | Integration implemented but live verification pending | Upstash lease adapter, matching release, 409 callsite contract | Live Upstash and LiveKit concurrent-start/reconnect test |
| Hard voice duration | Implemented and tested locally at code-contract level | Agent stops and disconnects at the lesser of 15 minutes or remaining allowance | Live room timing and vendor shutdown evidence |
| Failed-session billing | Implemented and tested locally | A session with no completed learner turn reports zero seconds and still releases its lease | End-to-end vendor-failure and abandoned-room tests |
| Trial abuse boundary | Partially implemented | One pseudonymous installation/user claim in SQL; raw identifiers never stored | CAPTCHA/email controls, device reset analysis, live concurrency and retention policy |
| CORS and security headers | Implemented and tested locally | Exact-origin API policy, CSP/HSTS/no-store headers, web `_headers` | Final domains, hosting proof, live preflight/header capture |
| Distributed rate limits | Integration implemented but live verification pending | Upstash atomic counter adapter; HMAC user/IP/install signals; provider-shape tests | Upstash credentials, reverse-proxy/IP validation, multi-instance test |
| LiveKit least privilege | Implemented and tested locally | Per-room token, five-minute join TTL, microphone-only publish source, participant cap | Production WSS project, replay/reconnect/room-cap test |
| Account deletion | Integration implemented but live verification pending | Verified subject, five-minute real-sign-in check, admin delete, cascade migration, non-swallowed device wipe | Password/Google device journeys and live cascade proof |
| Analytics privacy | Database migration created but not deployed | Exact event schemas in API and PostgreSQL trigger; content/type rejection tests | Consent/opt-out, retention, live direct-REST bypass test |
| Secret handling | Partially implemented | Server-only keys, ignored envs, `.firecrawl/` ignored, no tracked key-pattern hit, production export value/name scan | History scan, CI scanner, secret manager, native bundle scans |
| Dependency security | Blocked by external registry access | Install summary only; no forced fixes or blanket downgrades | Authoritative audit JSON and chain-by-chain remediation |
| Cross-device learner sync | Missing | `learner_state` table is only a server contract | Client transport, envelopes, revisions, conflict policy, offline queue |
| Purchase lifecycle | Missing | Plan economics and entitlement enforcement only | Store products, receipts, webhooks, restore, renew, cancel, refund/revoke |
| Tutor safety policy | Partially implemented | Deterministic pre-model boundary covers age, minor sexual content, crisis, dangerous instructions, hate/harassment, regulated advice, prompt injection and dependency; 14 focused tests | Professional policy review, broader multilingual red-team evals, report workflow and live UI journeys |
| Onboarding redesign | Partially implemented in inherited work | Missions, coach marks, sound check and current onboarding tests exist | Duplicate welcome removal, age/readiness/AI disclosure and full visual QA |
| Practice redesign | Partially implemented in inherited work | Review/drill/topic flows and curation exist | Retrieval-before-reveal across surfaces, durable batch/outbox, transfer flow |
| Retention system | Partially implemented in inherited work | My French, daily goal/activity and mission evidence exist | Passport, Tomorrow Test, reduced-help replay, weekly story, notifications |
| Social systems | Superseded and scheduled for deletion | Fake/stale leaderboard/friend code identified | Removal after reference and persisted-data audit; no launch social backend |
| Privacy/legal surfaces | Missing for release | Honest placeholder copy says policies are not written | Reviewed privacy/terms, vendor/AI/antifraud disclosure, export and memory controls |

## Current focused verification

- Token server: 79/79 tests passed; typecheck passed.
- Tutor agent: the changed workspace test run passed; typecheck passed.
- Mobile: 295/295 tests passed; typecheck passed.
- Full repository gate: 1,495 tests passed (core 500, brain 306, tutor agent 302,
  token server 79, playground 13, mobile 295).
- Web export passed. Browser QA covered first-run and auth at 320, 390 and 1,280 pixel
  widths: no horizontal overflow, compact-screen actions were at least 44px high, and the
  release export failed closed without Supabase configuration. Auth fields had no
  programmatic labels and auth screens exposed no heading roles; this is a P1 accessibility
  release blocker. Authenticated screens were not traversed because no browser account was
  created.
- Database: static migration contracts pass; no live database was available.
- Offline `npm audit`: returned zero because no advisory data was available offline; it does
  not supersede the install-time report of 16 advisories.

## External access required

- Disposable Supabase project, two test users, service-role access, database/migration
  access, Auth security settings, backup/PITR and restore access.
- Upstash REST URL/token, deployment-specific HMAC salt, and trusted proxy configuration.
- Secure LiveKit WSS project plus matching tutor-agent credentials.
- iOS and Android devices/builds for SecureStore, OAuth, microphone, deletion, and bundle QA.
- Final web domain/hosting configuration for CSP, HSTS, TLS, and CORS.
- Store sandbox credentials and product decisions for purchases.
- Approval for an authoritative registry dependency audit and CI/history secret scanning.
