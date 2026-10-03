# Home, Friends and offline daily packs — review handoff

Source branch: `codex/home-friends-daily-packs`. On 19 September 2026 the user
approved committing, merging and pushing this session to main, then approved
fixing two pre-existing security blockers before landing. Verdict: LAND after
the dependency follow-up below. The full 3,082-test gate, dependency audit and
tracked secret scan pass. Push approval does not deploy the production
migration, release the app to stores or purchase another audio batch.

### Security follow-up for landing

Both XML parser branches are patched: `@xmldom/xmldom` 0.8.15 and 0.9.12.
LiveKit Agents and all six provider plugins are deliberately pinned to 1.9.0,
with RTC Node 0.13.34, to obtain the upstream-pinned Sharp 0.35.4 fix. A root
override did not propagate through npm's workspace links; no ineffective
override remains. Expo and the live tutor's selected models/voices are unchanged.
The intentional Anthropic SDK split and all foreign-platform native assets
remain in the lockfile. No high-severity advisory acceptance was added.

All 446 tutor-agent tests pass on the updated SDK. Native Sharp image encoding
and both XML parse/serialize paths pass direct smoke checks. Three new lockfile
regression tests fail against the old lock and pass against the patched lock;
they also protect cross-platform Sharp assets and SDK/plugin alignment.
`npm ci --dry-run --ignore-scripts` accepts the lock. The audit reports zero
critical findings and only the existing documented high-risk acceptance
(`adm-zip`, install-only); moderate findings remain reported. Live paid voice
lifecycle measurements have not been repeated on 1.9.0: repeat that staging
check before deploying the tutor service. No paid API was called for this fix.

## What changed

### Home

1. Familiar greeting and a labelled profile avatar in the top-right corner.
2. One primary next step: first/resumed conversation, otherwise due review when
   there is something to recall, otherwise today's conversation.
3. “Your French in practice”: four compact tiles directly on Home for Days
   active, Retained phrases, Recall and Speaking time. The weekly activity rail
   is backed by real completed learning activity, not app launches. Days do not
   reset after a missed day; compact date history survives detailed-log pruning.
4. One compact daily card immediately under the four tiles. Swipe left/right
   or tap the Word/Phrase pills at the top-right. Both picks retain the existing
   hand-drawn scene illustrations, brief motion, translation and actions. The
   word example is visible; More expands notes, its translation and extra controls.
5. The separate Real progress route is removed. The weekly story and abilities
   expand inline on Home, only when there is evidence to show. Personal recall
   still appears when there are due phrases.
6. French with friends appears only for actionable updates, a current challenge
   or visible friend activity, and never draws an empty filler card. The separate
   pace card is gone (whole-app upgrade, Stage 3): the optional target opens only
   from the Practice time tile, and Review from the hero or the Recall tile.
7. The searchable daily collection remains reachable under the carousel.

Daily picks are deterministic and level-aware. A new date refreshes the cards
while Home is focused or when the app returns to the foreground. Saving or
listening does not claim that a word has been retained and does not earn points.

### Navigation, Profile and Settings

- Bottom tabs: Home, Speak, Practice, My French, Friends.
- The same accessible profile button appears in each root-tab header.
- Profile is a pushed screen, leaving room for Friends in the bottom navigation.
- Settings is the first labelled row inside Profile, not a floating cog over
  learning content. Existing account, plan, privacy and learning controls remain.
- New pushed screens have back navigation with a Home fallback for direct links.
- My French links to the saved daily collection; existing learning tools remain.

### Friends

- Explicit opt-in and a unique username; exact-username discovery only.
- Shareable app invitation link and locally generated QR code. No contact upload.
- Incoming/outgoing requests, accept, decline, cancel and mutually accepted friends.
- Friends-only weekly leaderboard. Points come from server aggregation of
  synced activity, capped at 100 per UTC day; ties share a rank. Resets Monday
  00:00 UTC. Offline practice appears after its activity syncs.
- Score visibility control. Hidden scores are excluded from rankings.
- Optional shared challenge: four conversations together, at most one qualifying
  conversation per person per UTC day after both accept. Decline, cancel and leave
  are supported. Unfinished challenges end at the weekly boundary without penalty.
- Completed challenges display a shareable text postcard, not a generated image.
- Optional milestone sharing, fixed encouragement reactions and a private
  previous-week summary. In-app update badges respect the relevant preferences.
- Remove, block, unblock, report-and-block and leave-Friends controls. Leaving
  removes relationships/challenges but does not erase personal learning progress.
- Private social tables, authenticated RPC authorization, account-export coverage
  and account-deletion cascades. No direct client access to social tables.

These are learning-activity points, not verified language ability. Client-synced
events are not cheat-proof, so this is not suitable for prizes or financial rewards.
Notification settings in this change control in-app updates, not remote push.
Reports are stored privately; an operational staff review process is still needed
before public social launch. There are no DMs or public/global leaderboards.

### Daily library and audio

- Exactly 1,000 distinct bilingual word items and 1,000 distinct bilingual phrases.
- Words include usage notes and examples. Phrases reuse authored situation lines.
- Hear and 0.75× slow replay for the voiced subset, plus Save and Say it.
  Word examples remain readable, not spoken in this budgeted batch.
- Saved/Words/Phrases filters, bilingual search and bounded 12-item pages.
- Say it provides local record/listen/compare practice, capped at 20 seconds per
  take, plus a route into spaced review. It does not claim AI pronunciation grading.
- Temporary recordings are not uploaded and are discarded on normal exit,
  backgrounding or re-recording. A force-killed app may leave OS-managed cache.
- 200 words and 200 phrases each have all six tutor voices: 2,400 bundled
  Flash v2.5 recordings, about 36 MB, at the approved quieter -4 dB level.
  Hear follows the stored tutor choice; missing clips never fall back to another
  tutor or the old generic voice. Home rotates only fully voiced picks, balanced
  across the three tiers (67/67/66 of each type). The other 1,600 text items keep
  saving and self-recording practice, with explicit coverage copy and no Hear.
- The earlier 2,957 Kokoro clips, unused manifest and generator were retired
  on 3 October after the active tutor pack's coverage and hashes were verified.
  Development provenance remains in Git history and licence notices remain.
- Native builds bundle the static assets. Web builds serve them as static app
  assets; offline web/service-worker caching was not added.
- The illustration catalogue contains 20 reusable decorative scenes, not 1,000
  unique animations. Both 1,000-item text packs use stable illustration choices.
  Motion settles after a brief introduction, respects reduced motion, and stops
  on navigation. Switching cards unmounts the previous player.

### Tutor-matched audio: first budgeted batch complete

The user approved Flash v2.5 at minus 4 dB, then authorised 200 words and
200 phrases in every tutor voice under a 25,000-credit cap. The completed batch
used **23,112 credits**, confirmed by response charges and the settled balance:
2,713 → 25,825 used, **7,382 credits remaining**. Six sample recordings were
reused without billing. Live tutoring's voice/model configuration is unchanged.
No subscription purchase, upgrade or runtime speech-generation call was added.

The cap guard initially stopped on a rounding detail after 48 credits, saving
all audio. Corrected billing rounds the base Flash charge before the voice
multiplier; the corrected 24,240 estimate remained under the same cap. Explicit
resumption reused all saved clips. The final measured cost was lower.

Batch provenance: `artifacts/daily-tutor-batch-1/manifest.json`. Raw PCM stays
locally for safe resumption; app AAC files and hashes are retained. All 2,400
files were decoded and measured. Thirty-four short AAC recordings needed local
level correction, using no credits. Final gains are within 0.25 dB of -4 dB,
with no decoded clipping. This is signal verification, not a full editorial
listening pass. The original 216-credit comparison remains under
`artifacts/voice-comparison-2026-09-19/` for reference.

**Pre-publication memory:** see [DAILY_AUDIO_ROLLOUT.md](DAILY_AUDIO_ROLLOUT.md).
After the next credit reset, prepare another 200 NEW words and 200 NEW phrases,
excluding batch 1, and recheck the budget. A thread reminder is set for 2 October
at 10:00 Europe/London. It does not automatically spend or publish.

The Supabase skill informed the migration/authorization work; the Firecrawl
search skills supported checking audio redistribution/licensing sources. No
macOS system-voice recordings are included in the delivered pack.

## Review sequence

The local mock-account preview is at `http://localhost:8081/home`. It does not
connect to production or spend tutor credits. Friends can be inspected in its
honest opt-in state; joining a real circle requires the staged backend below.

1. Home: check hierarchy, spacing, the four “Your French in practice” tiles
   and whether the main action feels clear.
2. Scroll to the daily carousel. Test both pills, both swipe directions and More.
   Hear and Slow replay now use the selected tutor's bundled Flash recording.
   Change the tutor in Profile, then return and compare; no new download or
   speech API is required on native builds.
3. Save an item, open Daily collection and confirm it is under Saved. Try both
   full packs and search. Say it opens local speaking practice.
4. Open the avatar from each tab. Profile opens; Settings is at the top. Back
   returns to the previous screen without leaving a floating settings overlay.
5. Open Friends and inspect setup/privacy language. Staging with two test users
   is needed to review populated rankings, invitations and shared challenges.

## Verification and release boundaries

- Full repository gate: typechecks and every workspace's test suite. See the
  task handoff for the final count; no test floors were lowered.
- Web production export succeeds with the offline audio manifest.
- Pack tests check exact sizes, unique IDs/text, tiers and whole-word contexts.
- Audio tests check all 2,400 tutor recordings against frozen text, voice/config
  and content hashes, plus coverage guards, day/tier selection and no runtime
  speech API. The legacy generic pack retains its separate integrity test.
- Real PostgreSQL/WASM migration checks cover authentication, ownership,
  opt-in relationships, private scores, event deduplication/caps, challenge
  consent, blocking, leaving, deletion and a guarded rollback that preserves
  personal progress. Run `scripts/verify-social-db.mjs` as documented in its header.
- Browser review of the first revision at 390×844 covered Home, saving, Saved collection, playback
  controls, Say it navigation, Profile/Settings and the Friends opt-in screen.
- The compact revision was inspected at 390×844 and 320×740. Both swipe
  directions, both pills and More/Less were exercised. Browser text selection
  initially interrupted swipes; embedded card text now avoids selection while
  full collection text stays selectable. Native touch still needs device testing.
- Final landing gate: 3,082 tests, all passing, with all workspace
  typechecks passing and no lowered floors. Three additional offline build-plan
  tests pass. The web export succeeds with exactly 2,400 tutor audio assets and
  zero legacy generic audio assets.
- Browser checks exercised local word/phrase Hear, Slow replay, tutor changes
  (Alexandre → Sarah → Alexandre), model playback in Say it, and text-only
  library/practice entries without misleading audio buttons. No microphone
  permission was requested during browser QA.

Before release: perform iOS/Android microphone, audio routing, interruption,
airplane-mode and install-size checks; conduct a fluent French listening/editorial
pass; test two real staging accounts, invitation links and concurrent social
actions under the deployed auth/RLS environment. Automated audio checks do not
mean every clip was individually listened to by a human.

Friends migration: `supabase/migrations/20260919120650_home_friends_daily.sql`.
It has NOT been applied to any live Supabase project. After review, apply it to
staging first, then deploy the updated account-export service with the app.
The guarded destructive rollback lives in `supabase/rollback/`; never run it
against user data without an export and explicit approval.

The user's unrelated `.mercury/` and `MERCURY.md` files were left untouched.
