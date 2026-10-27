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
| Missions scored on the handed-over line; convo quote prices scoring; recap focus sound | VOICE-004, F866 | done, on `main`; flag off |
| `live_session_finished` event (counts only) | migration 41, `apps/mobile/src/analytics/sessionFinished.ts` | done, on `main` |
| Support address and Contact row | `apps/mobile/src/legal/company.ts` | done, same branch |
| Beta metrics queries | [deployment/beta-metrics.sql](../../deployment/beta-metrics.sql) | done, same branch |
| Guest first scene: one scripted café exchange before sign-up, no model, 180 s, daily ceiling | UI-011, [guest-first-scene.md](guest-first-scene.md) | done, on `main`; off until `LUVANI_GUEST_SCENE=1` |
| Free plan: one ten-minute conversation every other day (600 s, refilled 44 h after first use); Core 300 and Max 600 minutes; prices in the margin model | REV-001, migration 43 `20261023220000_daily_free_allowance.sql` | done, on `main`; needs migration 43 and the matching token server together (step 1) |

## Founder steps, in order

Each step names its proof. Stop at the first step whose proof fails.

1. **Database (Supabase "Parle").** Confirm a usable recovery point. Then apply,
   in order, `supabase/migrations/20261020140000_weekly_free_taste.sql` (40),
   `20261022120000_live_session_finished_event.sql` (41) and
   `20261023220000_daily_free_allowance.sql` (43, REV-001) in the SQL editor.
   Never apply 42 (`speech_dataset_clips`); it is held. Proof:
   `npm run verify:supabase` against the project passes, and
   `supabase/staging-verification.json` is updated to match.

   Apply 40, 41 and 43 together, while tutor admission is still closed:
   - `select enabled from public.tutor_session_admission_config` returns
     false.
   - Before applying, record
     `select count(*) from public.entitlements where plan='trial' and weekly_taste and period_end > now()+interval '44 hours'`.
     A non-zero count means 40 was already live, and 43 will briefly block
     writes to `entitlements` while it runs.

   Then deploy the token server and app from step 3 before admission opens in
   step 5. The two halves must change together: a server on the old figures
   refuses the new 600-second answers, and the old database refuses the new
   server's paid grants. Proof, after the deploy: one session on a fresh free
   account reserves 600 seconds, and `/billing/status` shows 600.
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

   Beginners hear a slower voice (VOICE-016, speed 0.85), and each speed is
   its own cache. Warm both with `LUVANI_WARM_SPEED=both` (default `normal`;
   `slower` warms only the beginner copy). The slower copy is another 17,700
   characters, or 23,600 billed characters counting the two 2x voices, about
   $1.89 once. Lessons and A0 to A1 learners use the slower copy, so if you
   warm only one, warm `slower`.

   **Keyterms on lessons (optional, VOICE-017).** Production lessons send the
   lesson's lines to Deepgram as keyterms only once the bound `lesson` quote
   has a keyterm STT component (see
   [PAID_ADMISSION.md](../../deployment/PAID_ADMISSION.md)). Until then the
   tutor quietly sends no keyterms, exactly as today, and logs
   `[luvani] keyterms: stripped`.

   **Cheaper free-conversation voice (optional, off).** After a blind listening
   check, setting `LUVANI_CONVERSATION_TTS_MODEL=eleven_flash_v2_5` on `tutor`
   sends only free-conversation lines to ElevenLabs Flash at half the price per
   character. Scripted lines and this cache do not change. Before setting it in
   production, add an `eleven_flash_v2_5` TTS component to the `lesson` and
   `convo` quotes (see [PAID_ADMISSION.md](../../deployment/PAID_ADMISSION.md)),
   otherwise every conversation line is refused as quote-mismatch.
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
   use, and about $580 at a realistic 40%. On the free plan alone (REV-001, one
   10-minute conversation every other day) 100 testers cost about $724 to $789
   a month at full use and about $290 at 40%. The 1,200-second account daily
   cap still covers Max's 20 minutes a day.

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
6. **Beta minutes and prices (REV-001).** The free plan is now 10 minutes
   (one full conversation), refilled 44 hours after the first use of each
   window. Testers who need more still need a grant, for example the Core plan.
   That is a product decision, and no code assumes one.

   When the store accounts exist, set these prices in App Store Connect, Play
   and RevenueCat. The code holds them only for its margin model (`meter.ts`).

   | Product | Price | Allowance |
   |---|---|---|
   | Core monthly (`starter`) | $14.99 | 300 min per 30 days |
   | Core yearly | $99 | 300 min per 30-day window |
   | Max monthly (`regular`) | $24.99 | 600 min per 30 days |
   | Max yearly | $169 | 600 min per 30-day window |

   The introductory free trial stays 7 days, and the server grants a week of
   the plan's allowance (Core 70 min, Max 140 min). Update the App Review notes
   in [REVENUECAT_SETUP.md](../REVENUECAT_SETUP.md) when you submit. Store
   listings say "about 10 minutes a day" and "up to 20 minutes a day", never
   "unlimited". Proof: a sandbox purchase of each product shows its minutes on
   the Profile plan card.
7. **App.** Set `EXPO_PUBLIC_TOKEN_SERVER_URL` to the API's HTTPS URL in the EAS
   `preview` environment. Publish with `.github/workflows/mobile-preview.yml`, or
   build the Android staging APK.

   iOS TestFlight waits for the Apple Developer membership. When you have it, add
   the `submit` block and team settings to `apps/mobile/eas.json`, enable Sign in
   with Apple and push, then ship internal, then external.
8. **Guest first scene (optional, after steps 3 to 5).** This lets people try one
   short scripted café exchange before they make an account (UI-011). It stays
   off until you switch it on. Worst case is about $0.50 a scene, so the default
   ceiling of 24 scenes a day costs at most about $12 a day (about $360 a
   month). With the voice cache warm, a scene costs about $0.03, or about $0.80
   a day at 24. The full numbers are in the runbook's "Guest first scene"
   section.
   - Read the scene's lines (`packages/core/src/lessons/guestCafe.ts`). They
     are five of the café lesson's reviewed turns plus a new English premise.
     Say yes or ask for changes.
   - Confirm the LiveKit per-minute rate on your plan. The cost uses an
     estimate of about $0.002 a minute.
   - Confirm that Railway's ingress overwrites `X-Forwarded-For` before you set
     `LUVANI_TRUST_PROXY=1`. The per-address limit depends on it.
   - Make sure the `TTS_CACHE_DIR` volume from step 4 is mounted. The cost
     assumes it.
   - On staging, set `LUVANI_GUEST_SCENE=1` on both `api` and `tutor`, and
     `LUVANI_GUEST_SCENE_DAILY=3` on `api`. Then prove:
     - one scene completes on a real iPhone and on a real Android phone;
     - the fourth claim that day is refused, and the app offers the account
       handoff;
     - a second scene from the same phone is refused;
     - the Redis counters carry a TTL;
     - after sign-up, the scene's lines appear in the new account's
       phrasebook.
   - Then raise `LUVANI_GUEST_SCENE_DAILY` to 24, or to the number you
     choose.
   - Off switch: unset `LUVANI_GUEST_SCENE` on `api` and redeploy. This needs
     no migration and no drain.
9. **First real session.** Run one café lesson and one mission yourself on a
   phone. Proof:
   - `[luvani:live] reply-latency` lines appear in the app logs;
   - one `session_usage` row and, with analytics on, one `live_session_finished`
     row appear;
   - query 4 in `beta-metrics.sql` returns it.
10. **Recruit.** Use expat, relocation and TCF/TEF communities, not r/learnfrench.

## Reading the results

Run [deployment/beta-metrics.sql](../../deployment/beta-metrics.sql) weekly.

| Signal | Rough bar to be encouraged by |
|---|---|
| D7 retention by cohort | above 25% |
| D30 retention by cohort | above 12% |
| Median reply wait (query 4) | under 2.5 s in conversations |
| Unaided share, 1st to 5th conversation (query 5) | rising |
| Median time to first unaided turn (query 6, minutes and sessions) | falling across cohorts |

These are rules of thumb from consumer apps, not benchmarks for this category.

Query 6 is a proxy (a turn in a session with no rescue) over consented learners only; its comment block lists the limits. Quote it with the count of learners not yet unaided beside it.

## Not in this plan

- A guest conversation before sign-up (only the scripted guest first scene
  is built; see step 8).
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
| 2026-10-23 | REV-001 daily free allowance and repackaging (branch `claude/daily-allowance`) | All 43 migrations replayed in PGlite, including 43 without the held 42; read-only database review applied (rollout order, rollback refusal); web check on a local token server: Profile shows the new free line, a spent free row shows "Your next free conversation is ready on Sunday at 12:58 am" in the phone's time zone ([screenshots](../daily-allowance-evidence/)) |
| 2026-10-24 | Query 6 (time to first unaided turn) in `beta-metrics.sql`, branch `claude/unaided-metric` | `scripts/betaMetrics.test.mjs` replays all 43 migrations in PGlite, runs the file as written on synthetic rows and matches hand-computed values (deadline median 6.8 min / 2 sessions, p75 8.9 min / 2.5; hobby 13.0 min at session 2 with one learner not yet unaided; unknown 1.5 min at session 1). With the 60 s tolerance set to 0 the test fails, so it discriminates. It runs in the gate |
| 2026-10-26 | Step 1 on Supabase "Luvani Staging" (`wtexbzuyfersdtiekrvp`, free plan, was paused and restored) | Admission confirmed closed (`enabled` false, limits 0). Free plan has no downloadable backup, so the recovery point is a row and function-hash snapshot (`output/staging-snapshots/2026-10-26-before-migrations-40-41-43-44.json`) plus the paired rollbacks. Pre-check: `weekly_taste` absent, so 40 had never been live. Applied 40, 41, 43 and 44 through the Supabase connector, each recorded under its original version; 42 not applied. After each one, a function, trigger, column and grant fingerprint matched a disposable PGlite replay of the same migrations exactly (final functions md5 `71c1f012…`, 88 functions); the same fingerprint matched the 39-migration replay before any change. The one trial row became a weekly taste and its refill was cut to 44 hours with its usage epoch kept. Security advisor: no errors; the 43 policy-less private tables and two definer warnings match the reviewed design; leaked-password protection still off (step 2). `npm run verify:supabase` not run (needs the staging service-role key locally) |
| 2026-10-26 | Step 3 prepared on Railway "Luvani Staging", environment `staging` | Created empty services `api`, `tutor` and `maintenance` (no source, no deployment). Staged, not committed: the root `Dockerfile`, each role's start command, restart and health settings from `deployment/railway/*.json` (Railway now refuses config files, so the values are set on the services), the fixed production variables, `TUTOR_LLM=openai`, `SUPABASE_URL` for `wtexbzuyfersdtiekrvp`, `NODE_IMAGE=node:24.16.0-bookworm-slim@sha256:2c87ef9b…a203` (resolved from Docker Hub) and `GIT_SHA=${{RAILWAY_GIT_COMMIT_SHA}}`; the tutor's `TOKEN_SERVER_URL` follows the API domain `api-staging-1e0b.up.railway.app` (generated, nothing serves it yet). Not done: the GitHub source (Railway's GitHub app cannot see `pravzviv30-cmyk/parle`), every secret, LiveKit and Upstash URLs (they pair with their keys), paid quote bindings (no reviewed quotes in `paid_quotes`), the deletion journal for `maintenance`, and the audio decoder image (F805: no reviewed decoder fits the 128 MiB bound, so the image build refuses). Services sit in `iad` while the database is in `eu-west-1` |
| 2026-10-26 | Step 3 continued on Railway | After the founder installed Railway's GitHub app on `pravzviv30-cmyk/parle`: staged `main` as the source of `api`, `tutor` and `maintenance`; staged all services in Amsterdam (`europe-west4-drams3a`, one replica), near the database in `eu-west-1`; created `practice` (the durable drill worker that `LUVANI_DURABLE_PRACTICE=1` relies on) with its start command, restart settings, fixed production variables, `TUTOR_LLM=openai`, `SUPABASE_URL`, `NODE_IMAGE` and `GIT_SHA`, also staged. Still nothing deployed (`latestDeployment` null on all four). Founder has the Supabase, LiveKit, Upstash and provider keys and the three random secrets; Supabase minimum password length set to 8 (leaked-password protection needs the Pro plan) |
| 2026-10-26 | Steps 5 and 7, founder decisions | Railway on the Hobby plan; founder asked to stay near what Hobby allows. Four always-on services are estimated at about $12 to $20 a month (mostly memory at $10 per GB-month) against Hobby's $5 included usage, so the founder sets a $10 hard usage limit in Railway and per-service caps are staged (api, practice, maintenance 0.5 GB and 1 vCPU; tutor 1.5 GB and 2 vCPU); real usage to be measured in the first days. Staging caps (smaller than step 5's suggestion, about $3 a day of AI spend at $0.048 a minute): 3 sessions at once, 3,600 issued seconds a day across all learners, 1,200 seconds a day per account. Founder confirmed every required secret is in Railway; names checked on all four services, values not read |
| 2026-10-27 | Step 5 on Supabase "Luvani Staging" | `scripts/paidQuotes.mjs` generated nine quotes (lesson, lesson-text, convo, convo-text, practice, api-judge, api-fix-judge, api-transcribe, phrase-audio; all six voices; expiry 2026-11-02 00:30 UTC), paid admission config ($21/day global and $6.70/day per account bookings, operation and call caps) and vendor rows for OpenAI, ElevenLabs and Deepgram, and set tutor admission caps (3 at once, 3,600 s a day, 1,200 s and 3 sessions per account, 600 s per session) with `enabled` still false. Applied through the Supabase connector; quotes, config, vendor and admission fingerprints matched a PGlite replay of the same SQL exactly. `LUVANI_PAID_QUOTE_BINDINGS` staged on Railway `api`, `tutor` and `practice`. A Monday and Thursday reminder (scheduled task `luvani-staging-quote-renewal`) renews quotes before they expire |
| 2026-10-27 | Step 3, first staging deploy | Railway's first staging build failed at Dockerfile validation, before any step ran: `flag '--network=none' is not supported`. Fix per DEPLOY-004: the Dockerfile keeps the same three checks as the runtime user without the flag, and `deployment/captureContainerRuntime.mjs` now also loads Silero with no network, so the offline proof runs before production release |
| 2026-10-27 | Step 3, second staging build | The Dockerfile passed validation, but every service failed at `RUN node deployment/validateBuild.mjs`: `GIT_SHA=${{RAILWAY_GIT_COMMIT_SHA}}` did not render to a commit hash. Fix: the Dockerfile declares `ARG RAILWAY_GIT_COMMIT_SHA`, which Railway injects, and uses it before `GIT_SHA` for the guard and the revision label. The release workflow still passes `GIT_SHA`. On Railway, `GIT_SHA` can be removed; it is ignored when Railway's SHA is present (DEPLOY-004) |
| 2026-10-27 | Step 3, staging running | Third build at `6da98d94` built all four services. maintenance failed once at `npm ci` (onnxruntime-node timed out fetching its native library) and api once at Railway's own image pull; both redeployed clean. api then refused `LUVANI_ALLOWED_ORIGINS` (never set): set to `https://api-staging-1e0b.up.railway.app`, which admits no other web origin; the phone apps send no Origin. Result: `/health` 200; `/ready` 503 only on `admission: false`, with schema, redis, tutor, practice and maintenance all true. tutor registered with LiveKit Cloud (Germany 2), decoder self-check passed on every role with no paid calls, maintenance idle. Admission stays closed. Next: acceptance (a fresh free account reserves 600 s), then open admission with the founder's OK. The leftover `GIT_SHA` variable on each service is ignored and can be deleted |
| 2026-10-27 | Acceptance and admission opened (founder approved) | Throwaway account `luvani-accept-3c07a380@example.com` (`662336e8…`, created in the staging database, no email sent; credentials only in the founder's private secrets folder) signed in through Supabase password auth. With admission closed, `/session/start` answered 503 "not ready" as designed. Founder approved opening: `tutor_session_admission_config.enabled = true` at 23:44 UTC, `/ready` 200 with every component true. One `lesson-text` start answered 200 with `secondsRemaining: 600`; the grant was `reserved` for 600 s; `/billing/status` showed trial, 600 s, `canStart: true`. The room was never joined, so no tutor was dispatched: the reconciler expired the grant 5 s after its 120 s join deadline (`not-charged`, 600 s released, 0 charged), and paid admission booked one worst-case $0.004 call with 0 effects (no vendor call). Admission left open. Found: F886 (a fresh account's `/billing/status` is 500 until its first session) and F887 (2 of 9 Railway builds failed fetching onnxruntime's native library) |
