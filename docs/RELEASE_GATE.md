# Release gate

Phase 8 is not a coding checklist. A green local gate proves the repository;
it does not prove a legal notice, a store purchase, a physical phone or a
deployment that nobody has run. The release owner records each item below with
the date, environment and evidence location. A blank item is a release block.

## Engineering checks

- [ ] Run `npm run gate`, `npm run build:web`, `npm run scan:secrets` and
  `npm run audit:ci` from the exact release commit; attach their exit-zero logs.
- [ ] Build and walk iOS and Android development/release candidates: first run,
  accessibility text, microphone, secure storage, export and account deletion.
- [ ] Apply all eleven migrations to the target Supabase project, reload its API
  schema cache and run `npm run verify:supabase` against it.
- [ ] Execute the rollback evidence procedure in `supabase/README.md` on a
  disposable project, including a backup/restore and re-application.
- [ ] Run RevenueCat sandbox purchase, renewal, cancellation, refund/revoke and
  restore on both stores; record the webhook id and the projected entitlement.
- [ ] Confirm live HTTPS, CORS, CSP/HSTS and the trusted-proxy hop count on the
  actual domains, then run the GitHub Actions workflow once.

## Policy and operational checks

- [ ] Professional review approves the privacy policy and terms after the
  controller identity, contact route, governing law, vendor terms and retention
  schedule have been confirmed. Publish the reviewed versions before inviting
  learners.
- [ ] Confirm LiveKit, Deepgram, ElevenLabs and Speechace retention and
  deletion terms; amend the learner-facing policy to match, not to assume.
- [ ] Rotate the four credentials recorded in the historical secret incident and
  verify the old credentials no longer work.
- [ ] Name the support and privacy-contact route, incident owner and rollback
  decision-maker.

## Before the first RevenueCat key is set

These are open ledger items, not checklist wishes. Every one of them is harmless
today for exactly one reason: RevenueCat is unconfigured, so both billing routes
answer 503 and the paywall stays shut. Setting the first `REVENUECAT_*` value is
what arms them, and the severities in the ledger say so entry by entry. Nobody
should switch payments on and fix these afterwards — the failure modes are a
learner charged for nothing and a paying subscriber quietly lapsed.

- [ ] **F263** — a webhook whose projection throws consumes the event id anyway,
  so RevenueCat's retry answers `replay: true` and grants nothing, for ever.
  Raise to P0 before configuring.
- [ ] **F266** — nothing checks the client's RevenueCat keys against the
  server's. A build with one and not the other takes a real charge and grants
  nothing. Raise to P0 before configuring.
- [ ] **F264** — entitlement refresh reads and writes without holding anything,
  so a concurrent debit is silently reverted. Raise to P1 before configuring.
- [ ] **F265** — `/billing/refresh` reports success even when it granted
  nothing, and the paywall then hides the buy button. Raise to P1 before
  configuring.
- [ ] **F267** — `/billing/webhook` is the only write endpoint with no rate
  limit.

## Privacy items already live

Unlike the billing items above, these are reachable today, because export and
deletion are wired and running.

- [ ] **F268** — `/account/export` is not gated on recent authentication while
  `/account/delete` is.
- [ ] **F269** — the exported JSON is left in a shared cache directory for ever,
  and is a silent no-op when sharing is unavailable.
- [ ] **F270** — the export tells the learner the antifraud marker is unlinkable.
  It is a keyed HMAC the server can recompute, so it is pseudonymous. Fix the
  sentence before it is relied on in an answer to a data-subject request.
- [ ] **F271** — the Phase 8 roadmap row is pinned by no test, unlike Phase 7's.

Until every item has dated evidence, Phase 8 is locally implemented where code
can implement it, but **not release-complete**.
