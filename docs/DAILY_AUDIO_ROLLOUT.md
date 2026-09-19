# Tutor daily audio: pre-publication memory

Decision confirmed by the user on 19 September 2026. Do not lose this checklist
when reviewing, merging or publishing the Home/Friends work.

## Batch 1, approved now

**Complete locally:** 2,400 recordings generated and integrated. Settled cost:
23,112 credits (account usage 2,713 → 25,825), leaving 7,382 credits. Six approved
sample clips were reused. Final AAC assets total 36,174,858 bytes (about 36 MB).
All files decoded successfully; measured energy gain is within 0.25 dB of the
approved -4 dB level, with no decoded clipping. Thirty-four short AAC clips
needed a local encoding-level correction; no extra synthesis was purchased.
Evidence: `audio-verification.json` beside the batch manifest. This does not
claim that every recording has been individually listened to by a human.
Final verification: full gate green at 3,082 tests, plus three build-plan tests;
web export succeeds with 2,400 tutor clips and no legacy generic clips. Native
airplane-mode, routing/interruption and fluent-speaker listening QA remain open.

- 200 words and 200 phrases, each in all six existing tutor voices: 2,400 clips.
- ElevenLabs Flash v2.5, French, existing tutor voice settings, minus 4 dB gain.
- Hard generation cap: 25,000 credits. Starting balance: 30,494 credits.
- Corrected rounded estimate: 24,240 credits before reusing approved samples.
  The initial 23,838 estimate rounded after the voice multiplier; actual billing
  rounds the base Flash charge first. The guard stopped after 48 credits, all
  clips saved; resumption reuses those clips under the unchanged 25,000 cap.
- Spoken words/phrases only. Usage examples remain readable, not spoken.
- Bundle every voice locally. Hear and Slow replay use the selected tutor,
  with no playback API call and no generic or other-tutor fallback.
- Home selects from the fully voiced, level-appropriate subset. The complete
  1,000-word and 1,000-phrase text library stays available; unvoiced entries keep
  Save and local speaking practice, without misleading Hear controls.
- Generation evidence, frozen selection, response costs and content hashes:
  `artifacts/daily-tutor-batch-1/manifest.json`. This is the completion authority,
  not this plan. A stopped/partial pack must not be presented as complete.

## Next reset: another 200 NEW words and 200 NEW phrases

- [ ] Confirm the account reset and fresh available credits. The API reported
  1 October 2026 at 21:54:12 UTC (22:54:12 Europe/London) as the next reset.
- [ ] Select 200 additional words and 200 additional phrases, excluding ALL
  IDs in previously completed batch manifests. Do not regenerate the first batch.
- [ ] Recalculate cost for the new text and all six voice multipliers. Preserve
  a credit reserve; agree the cap if it differs from the current 25,000-credit cap.
- [ ] Generate with the same accepted Flash voice/settings and minus 4 dB level;
  preserve paid PCM and request checkpoints to avoid accidental repeat billing.
- [ ] Append the new recordings and IDs to the existing bundle and Home pools.
  Do not replace batch 1. Expected cumulative coverage: 400 words + 400 phrases.
- [ ] Validate all six voices, file hashes/decoding, playback level, native
  airplane-mode playback, tutor changes, slow replay and bundle size.
- [ ] Run the full gate and ask the user to review before any push/publication.

A Codex thread reminder is scheduled for 2 October at 10:00 Europe/London
(monthly follow-up, quiet after the first confirmed-reset reminder). It checks
and reminds only; it does not automatically spend credits or publish. The local
app/computer must be available for local scheduled work. Reminder ID:
`next-tutor-audio-batch-before-launch`.

## Release hold

- [ ] Review this audio rollout checklist before publishing the app.
- [x] User approved committing, merging and pushing this session to main on
  19 September 2026. This does not authorise publishing the app, deploying the
  database, upgrading the subscription or purchasing further audio generation.
- [ ] Native device QA and the separate Home/Friends staging/release checks in
  `HOME_FRIENDS_REVIEW.md` remain required. Automated tests do not replace listening.
