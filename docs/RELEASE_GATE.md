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
- [ ] Apply all ten migrations to the target Supabase project, reload its API
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

Until every item has dated evidence, Phase 8 is locally implemented where code
can implement it, but **not release-complete**.
