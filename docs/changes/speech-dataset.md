# Speech dataset: consented, teacher-rated beginner French

- Status: groundwork built and inert; collection blocked on legal review
- Updated: 2026-10-22
- Checkout / starting revision: `Luvani-worktrees/speech-dataset` on `claude/speech-dataset`, from main at 717655fb
- Owner / integrator: founder (activation); speech-dataset session (groundwork)
- Existing programme / contract: PRODUCT.md "Positioning"; market review of 2026-10-22

## Outcome and scope

The market review found that Luvani has a wedge but no moat. The most credible moat
is a dataset that grows with use and that multi-language competitors will not build.
It would be a consented set of recordings of English speakers saying known French
lines, each rated by French teachers. It would calibrate pronunciation scoring and
accented speech recognition where vendors are weakest: nasal vowels, liaison, the
French /ʁ/ and /y/.

**This change builds only what is safe while nothing is collected.** Today
[PRIVACY_AND_SAFETY.md](../PRIVACY_AND_SAFETY.md) and the in-app notice
(`apps/mobile/src/legal/policy.ts`) promise that live conversation audio is not stored
by Luvani, and `policy.test.ts` pins those sentences. That promise stays true. The
same doc says a feature that keeps a recording is a new consent, a new retention
period and a new disclosure, escalated before it is built. This doc is that
escalation, and the code below is the groundwork it would switch on.

- Existing seam: VOICE-004's background scoring in `services/tutor-agent/src/tutor.ts`
  (`saidTheReferenceLine`, `scoreInBackground`) and the in-process 16 kHz conversion
  in `services/shared/liveScoringAudio.ts`.
- Context: [LIVE_VOICE.md](../LIVE_VOICE.md), [PEDAGOGY.md](../PEDAGOGY.md),
  [STATE_AND_STORAGE.md](../STATE_AND_STORAGE.md), `supabase/README.md`.
- Non-goals:
  - No collection, upload, bucket or uploader.
  - No change to the policy text.
  - The migration is not applied live.
  - No recordings from conversations or missions.
  - No model training.
- Risks / unresolved choices: lawful basis and wording need counsel (below). Vendor
  retention for Speechace and TonePerfect is still unverified.
- Decisions: VOICE-007 in [DECISIONS.md](../../DECISIONS.md).
- Defects: none filed. Nothing is broken; the work is blocked on an external review.

## What qualifies as a clip

Only a spoken turn in a scripted or cued lesson where the learner said the lesson's
reference line. This is exactly VOICE-004's gate: `saidTheReferenceLine` accepts an
exact, filler or typo match of `turn.reference` and nothing looser. It excludes:

- free conversation and missions. F866 (on `claude/mission-scoring`, not yet on
  main) scores a mission's handed-over full line, which is a cued reference line,
  but `convo.ts` has no clip seam. Adding one is a later, separate step, made by
  whoever owns `convo.ts`;
- typed and tapped answers;
- answers with extra words (they are graded, but not scored or kept);
- turns where the scorer returned nothing.

A clip is offered where the score settles, so the vendor's phoneme scores travel with
it. Capture therefore needs `LUVANI_AUDIO_SCORING=1` as well as the dataset flag.

## Consent

- **Separate.** It is its own switch and its own record, distinct from "Share usage
  data". Neither implies the other.
- **Never a condition of use.** Every lesson, score and feature works the same with
  it off. The copy says so.
- **Off by default, explicit.** Only a stored literal `true` at the current consent
  version counts. An older version, a missing record or anything malformed reads as
  no. A new version of the wording asks again.
- **Revocable at any time, as easily as it was given.** It is the same switch in
  Settings. Off takes effect at once on the device, even if the write fails (the
  withdrawal fence copied from analytics consent). On the server, withdrawal deletes
  every clip and its metadata. It does not unpick ratings already folded into an
  aggregate calibration, and the disclosure has to say so.
- **Adults only.** Luvani's age stop already blocks under-18s. The consent row is
  never shown to anyone the age stop has not cleared.
- **Demonstrable.** Today's consent store is device-local, like analytics. That is
  enough for an inert switch, but not for activation. Activation needs a server
  consent record (user, consent version, granted at, withdrawn at). The token server
  reads it and signs `speechDataset: true` into the join metadata, the way
  `memoryLocked` is signed (`services/token-server/src/tokens.ts`). The agent then
  sets `LuvaniTutor.datasetConsent` from it. Today nothing signs it, `agent.ts` does
  not parse it, and `datasetConsent` stays `false`.

## Where clips would be stored

- **Audio:** a private Supabase Storage bucket, `speech-dataset`.
  - Service role only, no public URLs, encrypted at rest by the platform.
  - Object path `<user_id>/<clip_id>.wav`, 16 kHz mono PCM, at most 30 s: the same
    audio already sent to the scorer.
  - The dev path sends the raw room WAV to the scorer, so the uploader must convert
    with `toSpeechaceWav` whatever the route.
  - No bucket exists today. Creating it is an activation step, because the storage
    schema is managed and needs its own acceptance (`scripts/releaseSchemaManifest.mjs`).
- **Metadata:** `public.speech_dataset_clips` (migration 42, prepared, not applied).
  - Service role only, with RLS on and every client role revoked.
- **Retention:** at most 24 months from capture, enforced by a check on `expires_at`.
  Expired clips are deleted by a scheduled sweep (row and object), which is an
  activation step.
- **Deletion:**
  - on withdrawal: an immediate sweep of the learner's rows and objects;
  - on account erasure: rows cascade from `auth.users`, and the erasure job
    (`privacyJobs.ts`) must also delete the objects under `<user_id>/` before the
    identity goes;
  - on expiry.
- **Export:** clip metadata and a list of clips join the account export
  (`prepare_account_export_v2`) before activation.

## What metadata is kept

Kept:
- reference line (curriculum text);
- lesson id and turn id;
- expected phonemes;
- vendor name and its per-phoneme scores;
- CEFR band (A0, A1 or A2);
- duration and sample rate;
- consent version;
- capture and expiry times.

Never kept:
- the learner's transcript, or any free text;
- the learner's goal or name;
- device or installation ids;
- session ids;
- location.

The table has no column that could hold any of them.

## How French teachers rate a sample

- **Who:** at least three native or C2 French teachers, contracted under a data
  processing agreement. They see a pseudonymous clip id, the reference line and the
  band. They never see an account, a name or a learner id.
- **What they get:** a founder-run export copies a sample into an encrypted local
  folder with a `manifest.json` (no identity, no transcript). Teachers rate offline
  with `npm run rate:speech -- <dir> --rater <pseudonym>` (`scripts/rateSpeechClips.mjs`).
  The folder is never emailed or uploaded, and is deleted after rating.
- **The rating:**
  - one 1 to 5 score for how close the whole line is to an intelligible native
    target;
  - for each expected focus sound, "fine" or "off".
- **Sample:** stratified by band and focus sound. Every clip is rated by two
  teachers, and 10% by all of them to measure agreement.
- **Agreement:** pairwise quadratic-weighted Cohen's kappa on the overall score. The
  labels are usable when the mean pairwise kappa is at least 0.6, counting only rater
  pairs that share at least 30 clips. Below that, the
  rubric is revised and re-rated before any calibration.
- **Calibration:** Spearman correlation between the teacher consensus and the vendor
  score, overall and per focus sound (reported only with at least 5 clips). Where a
  sound's correlation is weak, the vendor score for that sound is not shown as a
  verdict. Thresholds change only with an eval on these real ratings, never by
  guesswork. `npm run rate:speech -- <dir> --report` prints both.

## Policy and legal changes needed before activation

Nothing below is done. Each item needs the founder, and the legal ones need counsel.

1. **Legal review.** Confirm the lawful basis:
   - explicit, separate consent under UK and EU GDPR Article 6(1)(a);
   - whether voice recordings used to calibrate a scorer touch Article 9 or US
     biometric and voice laws: Illinois BIPA (including its written retention and
     destruction schedule), Texas CUBI, Washington's biometric law and My Health My
     Data Act, and the Colorado and California rules on voice recordings. The design
     never derives a voiceprint or identifies speakers, but counsel must say so;
   - the EU AI Act, if calibration feeds an automated assessment of learners;
   - a DPIA (Article 35), treated as required;
   - consent records kept with the exact wording shown, not only its version
     (Article 7(1));
   - withdrawal as easy as giving (Article 7(3));
   - the stance on aggregate calibration after withdrawal;
   - whether rater copies may leave the UK or EU, and the transfer mechanism if so;
   - the right of access (Article 15): the export probably has to carry the audio
     itself, not only clip metadata.
2. **`apps/mobile/src/legal/policy.ts`:**
   - "Your speech" changes from "Live conversation audio is not stored by Luvani" to
     an accurate sentence: not stored unless you turn on sharing lesson recordings,
     then what, why, who rates, how long, and how to stop;
   - "Who else sees it" adds contracted French teachers and Supabase Storage;
   - "How long we keep things" adds the 24-month limit and the backup window;
   - "Your rights" changes "No learner audio is stored or included" (the export
     sentence) to say what the export carries;
   - the scorer is named correctly. Today the notice names Speechace, while
     PRIVACY_AND_SAFETY.md says TonePerfect is the default scorer. That gap exists on
     main already and needs the founder's decision whether or not this lands. A
     dataset clip is exactly the audio that vendor heard.
3. **`docs/PRIVACY_AND_SAFETY.md`:**
   - the "Learner utterance audio" row (line 52);
   - "Raw live speech is never stored" (lines 86 to 91), and the speech sentences
     `policy.test.ts` pins against it (including "Live conversation audio is not
     stored by Luvani."), change in the same commit as `policy.ts`;
   - a new retention row, with the backup window;
   - the analytics section stays untouched.
4. **Disclosure copy reviewed by counsel.** The Settings row and its explainer in
   `apps/mobile/src/speechDataset/consent.ts` get a new `SPEECH_CONSENT_VERSION`
   whenever the wording changes. Today's explainer says "your recordings are
   removed" when you turn it off. Before it is shown it must say exactly what
   happens:
   - removed from Luvani's servers, and how quickly;
   - copies given to teachers removed by a stated time;
   - results already computed from them are kept;
   - which vendor scored the clip, the 24-month limit, that teachers are contracted
     third parties, and where the audio is kept.
5. **Age.** Confirm that no account that skipped the age stop (a guest, or one not
   yet age-checked) can reach the consent row or the signed consent bit. The age stop
   is UK and EU centred, so the consent should not rely on it alone.
6. **Contracts and handling:**
   - a DPA with each rater;
   - a written procedure for rater copies: how many exist, how the laptop is wiped,
     and how destruction is confirmed;
   - confirmed retention with both scoring vendors, Speechace and TonePerfect.
7. **Code to switch it on**, in order:
   1. server consent record (user, version, wording shown, granted at, withdrawn at)
      and its endpoints;
   2. clip insert through a `security definer` function in `luvani_private` that
      refuses unless a live consent at the current version exists, so a token-server
      bug cannot write a clip for someone who said no, plus a per-learner volume cap
      on the `data_write_quotas` pattern;
   3. token server signs `speechDataset`;
   4. `agent.ts` passes it as the `datasetConsent` option;
   5. a real `ClipSink` that converts to 16 kHz and uploads through the token server
      (the agent holds no database credential);
   6. the bucket;
   7. sweeps, each deleting the object before the row:
      - expiry, in `run_data_retention_v1`;
      - withdrawal;
      - erasure, a new stage in `advance_account_erasure_v1` that runs before
        `deleteSupabaseUser` and retries on failure;
   8. a rater-export record (clip id, rater pseudonym, exported at, destroyed at), so
      a withdrawal can be shown to have reached rater copies;
   9. export: a schema migration adding the clips to `prepare_account_export_v2`,
      with a `verifyAccountExport.mjs` case;
   10. migration 42 applied live with the runbook. Until then it is held: apply 40
       and 41 only;
   11. `SPEECH_DATASET_ENABLED` set to true;
   12. `LUVANI_SPEECH_DATASET=1` on the tutor agent.

## Screens and states

One Settings row, a switch in the Data and privacy group, under "Share usage data".
It is drawn only when `SPEECH_DATASET_ENABLED` is true, and that constant is false, so
no learner sees it. When it is shown:

- loading reads the stored consent and shows off until it is read;
- a failed save shows its own trouble line and snaps back;
- signing out or erasing the account removes the stored choice.

The row needs a device check when the constant is first flipped.

## Tasks in dependency order

| ID | Outcome | Owner | Depends on | Allowed files | Status |
|---|---|---|---|---|---|
| T1 | This design, VOICE-007, privacy doc note | orchestrator | none | `docs/changes/speech-dataset.md`, `DECISIONS.md`, `docs/PRIVACY_AND_SAFETY.md` | done |
| T2 | Migration 42, rollback, runbook, evidence, PGlite proof | data-sync-engineer | none | `supabase/`, `docs/IMPLEMENTATION_EVIDENCE.md`, `docs/RISK_REGISTER.md`, `scripts/verifyDataBoundaries.mjs` | done |
| T3 | Inert capture seam in the lesson path | backend-engineer | none | `services/tutor-agent/src/speechClips.ts`, `tutor.ts`, tests, `.env.example`, `docs/LIVE_VOICE.md` | done |
| T4 | Consent model, copy, hidden Settings row | implementer | none | `apps/mobile/src/speechDataset/`, `settings/`, `storage/scope.ts`, `sync/policy.ts` | done |
| T5 | Local teacher rating tool | implementer | none | `scripts/speechRatings.mjs`, `scripts/rateSpeechClips.mjs`, test, `scripts/gate.mjs`, `package.json` | done |
| T6 | Activation (item 7 above) | founder, after legal review | T1 to T5, legal sign-off | not yet scoped | blocked |

Acceptance for T2 to T5: with the flag off, or with consent off, nothing is
captured, offered or sent. The tests are `speechClips.test.ts`, the "speech dataset
capture stays inert" block in `tutor.test.ts`, and `speechDataset/*.test.ts`.
`policy.test.ts` passes unchanged. `npm run gate` is green.

## Execution log

| Date / task | Attempt and changed paths | Check / result | Next action or blocker |
|---|---|---|---|
| 2026-10-22 / T1 to T5 | Built in `Luvani-worktrees/speech-dataset` | see the integrated verification below | founder: legal review |

## Integrated verification and handoff

- Focused checks: recorded in the session handoff.
- Full gate: recorded at the top of `docs/IMPLEMENTATION_EVIDENCE.md`.
- UI / hosted / device / paid checks: none. The row is hidden and nothing is live.
- Documentation and decisions: VOICE-007, `PRIVACY_AND_SAFETY.md` (groundwork note),
  `LIVE_VOICE.md`, `supabase/README.md`.
- Landing disposition: HOLD on `claude/speech-dataset` for founder review. It is safe
  to land inert, but the founder decides.
- Next task: T6, after legal review.
