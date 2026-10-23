# Beta launch: 100 real beginners on the staging stack

## Outcome

Put Luvani in front of 50–100 absolute beginners: a mix of deadline learners
(moving, partner's family, TCF/TEF) and hobby learners. Measure whether they
come back and get more independent. This is a closed beta on the existing
**staging** stack (the "Parle" Supabase project and the prepared Railway staging
project), not a production promotion. The full promotion gates in
[BACKEND_RELEASE_RUNBOOK.md](../BACKEND_RELEASE_RUNBOOK.md) still apply before
any public launch.

Decided 2026-10-22: the founder runs every step that touches an account. The
code side is prepared on `main`. The support address is `hello@luvani.app`.

## What is already done in code

| Piece | Where | Status |
|---|---|---|
| Fast live turns, quiet first rescue, streaming replies | VOICE-002, VOICE-003 | done, on `main` |
| Pronunciation beside the turn; paid lesson quote prices scoring | VOICE-004, F863 | done, on `main`; flag `LUVANI_AUDIO_SCORING` off |
| Missions scored on the handed-over line; convo quote prices scoring; recap focus sound | VOICE-004, F866 | on `claude/mission-scoring`, not merged; flag off |
| `live_session_finished` event (counts only) | migration 41, `apps/mobile/src/analytics/sessionFinished.ts` | done, on branch `claude/beta-instrumentation` |
| Support address and Contact row | `apps/mobile/src/legal/company.ts` | done, same branch |
| Beta metrics queries | [deployment/beta-metrics.sql](../../deployment/beta-metrics.sql) | done, same branch |

## Founder steps, in order

Each step names its proof. Stop at the first step whose proof fails.

1. **Database (Supabase "Parle").** Confirm a usable recovery point. Then apply,
   in order, `supabase/migrations/20261020140000_weekly_free_taste.sql` (40) and
   `20261022120000_live_session_finished_event.sql` (41) in the SQL editor. Proof:
   `npm run verify:supabase` against the project passes, and
   `supabase/staging-verification.json` is updated to 41.
2. **Turn on leaked-password protection** in Supabase Auth (an open release item).
3. **Railway.** Install the CLI (`npm i -g @railway/cli`), then `railway login`,
   then `railway link` to Luvani Staging. Create the `api`, `tutor` and
   `maintenance` services from the root `Dockerfile`, each with its file in
   `deployment/railway/`. Inject only the secrets and configuration each role
   lists in `deployment/environment-contract.json`. Proof:
   `node deployment/validateEnvironment.mjs` passes for each role, `/health`
   returns 200 and `/ready` returns 200.
4. **TTS cache (optional).** `TTS_CACHE_DIR` defaults to `/tmp`, which empties on
   every deploy. Scripted lines then pay one ElevenLabs first byte (about 350 ms)
   the first time each is said after a deploy, which is acceptable for the beta.
   To keep the cache across deploys, attach a Railway volume to `tutor`, set
   `TTS_CACHE_DIR` to a path on it, and confirm the `node` user can write there.

   **Keeping the authored voice cache warm (launch blocker for the cost model).**
   `DEFAULT_COST_MODEL` (VOICE-008) prices lessons as replaying authored lines
   from this cache. Without the volume a lesson minute costs about $0.075, not
   $0.048, and full-use Max nets only about $2 a month. The Dockerfile sets
   `TTS_CACHE_DIR=/tmp/luvani-authored-cache`, so every new container starts
   cold. To fix that:
   - Mount a Railway volume on `tutor`, for example at `/data`.
   - Set `TTS_CACHE_DIR=/data/luvani-authored-cache` on the service. This
     overrides the Dockerfile default, so the Dockerfile does not change.
   - The volume then fills itself: each authored line is paid for once per
     voice the first time a learner hears it, and replays free after every
     later deploy.
   - To pay that up front, run the warm once per voice from a non-production
     shell: `LUVANI_WARM_VOICES=all npm run warm-cache -w @luvani/tutor-agent`.
     It refuses under `NODE_ENV=production` and prints its plan before it
     spends anything. It writes to that shell's `TTS_CACHE_DIR`, so the files
     then have to be copied into the volume. That copy step is not yet
     scripted or verified.

   Today's plan is 110 lines and 2,950 characters per voice, so all six
   voices cost up to 17,700 ElevenLabs characters, once. Entries no longer
   expire, so this only needs repeating when lesson text or a voice setting
   changes. Changing a voice setting makes the whole cache cold again.
5. **Spending ceilings (your decision).** Admission stays closed until you set
   finite numbers:
   - `tutor_session_admission_config`: `enabled`, `max_active_sessions`,
     `max_daily_issued_seconds`.
   - `deployment/paid-budget-contract.json`: reviewed vendor quotes and per-account
     caps, applied by the SQL owner (see [PAID_ADMISSION.md](../../deployment/PAID_ADMISSION.md)).

   Cost model: about $0.048 per live minute (`meter.ts`, measured rates 2026-10-23, VOICE-008). Starting points:

   | Setting | Suggested | Why |
   |---|---|---|
   | `max_active_sessions` | 10 | 100 testers rarely overlap more than this |
   | `max_daily_issued_seconds` | 30,000 (500 min) | caps the worst day at about $24 |
   | account daily seconds | 1,200 (20 min) | the beta's generous ceiling |

   At 100 testers averaging 10 minutes a day, a month costs about $1,450 at full
   use, and about $580 at a realistic 40%.

   **Drills model (2026-10-23, VOICE-008).** Post-session drills now go to
   `gpt-6-luna` (`OPENAI_DRILLS_MODEL`), not `gpt-5.6-terra`; memory extraction
   stays on Terra. Paid admission binds the model into each quote component, so
   before deploying this change the SQL owner must re-bind the drills `llm`
   component of the practice quote (and of any session quote that carries a
   drills component) to model `gpt-6-luna`, then refresh the matching
   `LUVANI_PAID_QUOTE_BINDINGS` entry. Otherwise practice jobs are refused as
   `quote-mismatch`. If you set `OPENAI_DRILLS_MODEL`, bind that model instead.
   Proof: `node deployment/validatePaidBudget.mjs` passes and one practice job
   completes on staging.
6. **Beta minutes.** The free tier is 5 minutes a week, which is too little to
   learn from. Decide how testers get more (for example a beta grant of the Core
   plan). Product decision; no code assumes one.
7. **App.** Set `EXPO_PUBLIC_TOKEN_SERVER_URL` to the API's HTTPS URL in the EAS
   `preview` environment. Publish with `.github/workflows/mobile-preview.yml`, or
   build the Android staging APK.

   iOS TestFlight waits for the Apple Developer membership. When you have it, add
   the `submit` block and team settings to `apps/mobile/eas.json`, enable Sign in
   with Apple and push, then ship internal, then external.
8. **First real session.** Run one café lesson and one mission yourself on a
   phone. Proof:
   - `[luvani:live] reply-latency` lines appear in the app logs;
   - one `session_usage` row and, with analytics on, one `live_session_finished`
     row appear;
   - query 4 in `beta-metrics.sql` returns it.
9. **Recruit.** Use expat, relocation and TCF/TEF communities, not r/learnfrench.

## Reading the results

Run [deployment/beta-metrics.sql](../../deployment/beta-metrics.sql) weekly.

| Signal | Rough bar to be encouraged by |
|---|---|
| D7 retention by cohort | above 25% |
| D30 retention by cohort | above 12% |
| Median reply wait (query 4) | under 2.5 s in conversations |
| Unaided share, 1st to 5th conversation (query 5) | rising |

These are rules of thumb from consumer apps, not benchmarks for this category.

## Not in this plan

- Guest live before sign-up.
- Moving the free tier to a daily allowance (decide from beta minutes data).
- Live pronunciation scoring for learners (`LUVANI_AUDIO_SCORING`), which needs
  one hosted lesson proving a Speechace 200 and a `scored` card, and one hosted
  mission showing a recap focus sound.
- An in-session "report this turn" control: for now the Contact row opens mail
  to `hello@luvani.app`.

## Execution log

| Date | Step | Result |
|---|---|---|
| 2026-10-22 | Code preparation (event, migration 41, support address, metrics queries) | Gate green, 5,939 tests, all 41 migrations replayed locally |
| 2026-10-22 | `beta-metrics.sql` against all 41 migrations replayed in PGlite with synthetic rows | All five statements run; D1/D7/D30, minutes and event aggregates match hand-computed values; the trigger refuses a `live_session_finished` carrying `goal` |
