# Backend audit evidence

Audit baseline: `2cbea8655b90c22fcac00412d008d4540e69954d`, 3 October 2026. The [report](../BACKEND_PRODUCTION_AUDIT.md) distinguishes executed proofs, source inspection, historical records and inaccessible live controls. These retained scripts are audit reproductions, not application fixes or production tests. Independent draft reviews retain their original corrections; those corrections were applied before publication.

The proofs use fake identities, synthetic text, injected signing keys and mocked vendors. Database work uses a disposable PGlite instance with simulated Supabase roles/default grants. API checks deliberately start an isolated development-mode server with explicit fake environment values; they demonstrate request handling, not an authentication bypass. No production account, migration or paid vendor call is required. Run only in a disposable local checkout. The two API reproductions intentionally terminate their own API child and need unused ports 58672 and 58673; run them sequentially and ensure nothing else is using those ports.

## Reproduction commands

Use the supported Node runtime and install the repository's locked dependencies. Run from the repository root:

```sh
node --experimental-strip-types docs/backend-audit-evidence/voice-repro.mjs
node --experimental-strip-types docs/backend-audit-evidence/auth-deletion-repro.mjs
node --experimental-strip-types docs/backend-audit-evidence/sync-hang-repro.mjs
node --experimental-strip-types docs/backend-audit-evidence/api-host-repro.mjs
node --experimental-strip-types docs/backend-audit-evidence/api-boundary-repro.mjs
```

For the complete disposable-schema proof, install `@electric-sql/pglite` in a separate temporary directory and set `LUVANI_AUDIT_PGLITE_MODULE` to the module's absolute `file:` URL, ending in `/dist/index.js`. This is an audit-only dependency, not an addition to Luvani's dependency manifest.

```sh
node --experimental-strip-types docs/backend-audit-evidence/database-repro.mjs
```

The pre-existing SQL proof scripts were also executed: `scripts/verify-social-db.mjs`, `verifyBillingProjection.mjs`, `verifySessionRefunds.mjs`, `verifyPracticeQueue.mjs`, `verifyConversationText.mjs`, `verifyProductEvents.mjs` and `verifyPhraseAudioBudget.mjs`. Each documents its PGlite module environment variable. All seven passed. Sequential WASM execution does not prove simultaneous independent PostgreSQL transactions or a deployed Supabase gateway/Auth configuration.

## Verification and metadata

- Full local `npm run gate`: 4,232 tests and all workspace typechecks pass. Focused runs overlap this count.
- The dependency-policy check passes, while registry audit reports 0 critical, 21 high and 12 moderate affected-package rows. Acceptance is currently package-based, not advisory-specific.
- Tracked-file secret scanning passes. Reachable-history scanning failed through buffer exhaustion; no clean-history assertion is made. Its raw error/diff was deliberately excluded from this package.
- GitHub [run 37149648954](https://github.com/pravzviv30-cmyk/parle/actions/runs/37149648954) succeeds for the baseline commit. Main branch API metadata reports `protected=false` and required-check enforcement off. Rulesets lookup returns a plan-restriction 403; no effective ruleset is independently attested.
- Connected Supabase metadata identifies the canonical configured Parle project as `INACTIVE`. Migration-list and aggregate read-only catalog calls time out. Empty security-advisor output is not evidence of a verified healthy schema.
- Production endpoints, privileged dashboard settings, active agent deployment, device audio, invoice reconciliation, backups and restoration were not tested. The audit did not restore the inactive project or run the hosted mutation-based verification commands.

Only sanitized results and synthetic proof source are retained here. Canonical environment contents, raw history diffs, copied third-party pages and real learner data are excluded. Agent definitions are prompt-level read-only roles; their available Bash tool is not an operating-system write prohibition.
