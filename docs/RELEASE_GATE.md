# Release gate

Phase 8 is not a coding checklist. A green local gate proves the repository;
it does not prove a legal notice, a store purchase, a physical phone or a
deployment that nobody has run. The release owner records each item below with
the date, environment and evidence location. A blank item is a release block.

**3 October 2026 status.** The repository has 26 ordered migrations. Ledger
F263–F270 are closed for their local code fixes, with named tests and, where
stated there, disposable database proofs. Those closures do not attest hosted
migrations, real RevenueCat delivery, native export cleanup, provider sign-in,
or a signed store transaction. F271 and F272 remain open. The checklist below
asks for those missing release proofs rather than reopening the fixed defects.

## Engineering checks

- [ ] Run `npm run gate`, `npm run build:web`, `npm run scan:secrets` and
  `npm run audit:ci` from the exact release commit; attach their exit-zero logs.
- [ ] Build and walk iOS and Android development/release candidates: first run,
  accessibility text, microphone, secure storage, export and account deletion.
- [ ] On both platforms, complete one Tutor session, force-close immediately,
  reopen while online, and verify exactly one server-owned Conversation Pack
  becomes ready with review, continuation and delete-one/delete-all Pack
  controls. Verify that deleting history leaves earned phrases and review cards.
- [ ] Reconcile and apply the 26-migration inventory in `supabase/README.md` to the target Supabase project, reload its API
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
- [ ] Confirm LiveKit, Deepgram, ElevenLabs, Speechace, TonePerfect, TypeSafe and the
  language model vendor's retention and deletion terms; amend the learner-facing
  policy to match, not to assume.
  TypeSafe reads own-words drill answers whenever `TYPESAFE_API_KEY` is set on the
  token server (F625); nothing here has read its terms.
  TonePerfect says it deletes audio after scoring and keeps the assessment JSON
  for at most 24 hours; that is the vendor's statement, not yet verified.
- [ ] Record release-owner acceptance of the F80 credential retirement evidence:
  the founder reports revocation of the older Groq, Deepgram, ElevenLabs and
  LiveKit keys at their dashboards, and replacement credentials authenticated
  read-only. The historical secret objects were pruned, so direct HTTP refusal
  of the old values was not measured. Attach dashboard/operational evidence and
  the exact-release secret scan; do not describe the old-key refusal as tested.
- [ ] Name the support and privacy-contact route, incident owner and rollback
  decision-maker.

## Billing code fixes and launch evidence

F263–F267 have closed local fixes: transactional webhook event completion,
refresh/debit ordering, an honest no-grant refresh response, paired client/server
readiness, and a webhook rate limit. The original defect descriptions remain in
`KNOWN_ISSUES.md`. Payment activation still requires these independent proofs:

- [ ] **F263/F264** — on the deployed schema, prove a failed webhook effect can
  retry and simultaneous refresh/debit transactions preserve paid usage.
- [ ] **F265/F266** — with the actual client build, server configuration and
  products, prove no-grant refresh messaging and mismatched-readiness refusal
  before any purchase action.
- [ ] **F267** — verify the deployed webhook limit against ordinary signed
  RevenueCat retries and the actual rate-limit backing service.
- [ ] Complete the signed iOS and Android purchase/restore matrix above before
  enabling payments for learners.

## Export, deletion and Phase 8 evidence

F268–F270 have closed local fixes: recent real-authentication proof for export,
bounded native export-file cleanup and honest pseudonymous-marker copy. The
following release work remains:

- [ ] **F268** — verify recent-sign-in and token-refresh behavior through real
  provider journeys on devices.
- [ ] **F269** — verify sharing refusal, file removal, restart recovery and
  account deletion on physical iOS and Android storage/share sheets.
- [ ] **F270** — include the corrected pseudonymous-marker explanation in the
  professionally reviewed and published policy/export copy.
- [ ] **F271 (open)** — pin the Phase 8 roadmap claim to the ledger and a test,
  then record the same standard of evidence used for Phase 7.
- [ ] **F272 (open)** — reconcile the development export failure caused by
  unapplied billing tables; make a missing dependency report unconfigured
  instead of an unexplained 500, then run a real owned account export against
  the fully migrated target project. Never return a partial export.

Until every item has dated evidence, Phase 8 is locally implemented where code
can implement it, but **not release-complete**.
