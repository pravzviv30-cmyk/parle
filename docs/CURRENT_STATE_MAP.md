# Current-state map

## Runtime path

1. `apps/mobile/App.tsx` mounts the auth gate, user-scoped storage providers, and navigator.
2. `apps/mobile/src/auth/adapter.ts` selects Supabase or the explicit local mock. Native
   Supabase sessions use SecureStore; local learning stores use user-scoped AsyncStorage.
3. A lesson or conversation calls `services/token-server/src/server.ts` for a LiveKit grant.
4. The token server verifies the account, rate/installation budgets, one-time trial,
   entitlement, active-session lease, and signed room/session metadata.
5. `services/tutor-agent/src/agent.ts` binds the first participant, runs either
   `LuvaniTutor` or `LuvaniConversation`, and publishes the core protocol over LiveKit data.
6. Session finish reports the signed session ID and billable seconds to the token server.
   PostgreSQL records the ID once and atomically debits the entitlement.
7. The app stores recap/practice/profile artefacts locally. With Supabase configured,
   `App.tsx` starts the account's sync engine using the current auth bearer, `userKey`
   and `syncPolicy`, then reconciles `learner_state` before startup completes. The explicit
   local mock skips cloud sync. Hosted and two-device acceptance remain separate checks.

## Sources of truth

| Decision | Source |
|---|---|
| Ladder, grading, reports, plan allowances | `packages/core/src/` |
| Conversation engine and learner profile | `packages/brain/src/` |
| Client/agent wire | `packages/core/src/protocol/` |
| Auth identity | Supabase token `sub`; local mock only with explicit dev flag |
| Production entitlement and trial | Supabase RPCs in `supabase/migrations/` |
| Active session | Upstash lease keyed by deployment-salted user signal |
| Local learner scope | `apps/mobile/src/storage/scope.ts` |
| Learner sync | `apps/mobile/src/sync/engine.ts` and `policy.ts`; enabled when Supabase is configured |

## Current presentation and preview

`index.ts` registers `App.tsx`; `nav/RootNavigator.tsx` is the only app navigator.
The five tab routes are Home, Explore, Tutor, Practice and MyFrench, displayed as
Today, Explore, Speak, Practice and Journey (direction B, A3, 20 October 2026).
Explore (`tabs/ExploreTab.tsx`) is the catalogue front door ported from Codex
commit ce1fa976: topic tiles, conversation ideas from learning preferences,
skill and practical collections, search over scenarios, missions and phrases,
and rows to the word library and to Journey. Each collection or scenario opens
the `ExploreCollection` stack screen (`main/ExploreCollectionScreen.tsx`,
address `explore/:id`). Its avatar opens Profile; the Codex Display sheet was
not ported. Profile is a pushed screen reached from the profile
button; Friends is an optional stack route inside Profile. Revamp B and the
video UX implementation use this same navigator.

### Direction B tabs (Phase B, 20 October 2026)

Each tab is layout over a plain view model (DESIGN.md composition rules,
DECISIONS.md UI-007):

- **Today** (`tabs/HomeTab.tsx`, `home/todayView.ts`): "Bonjour, Name.", the
  stats row (`game/TodayHero.tsx`), the next scene (`home/MissionHero.tsx`; core `nextScene`, leaning towards
  the onboarding goal, eyebrow "Picked for ..." when the goal chose it),
  today's three quests (`game/QuestsCard.tsx`), one fix to try (`oneFix`),
  today's phrase, Coming up (`comingUp`, the latest remembered life event;
  no countdown or checklist until Phase C; Not now lasts the app session) and
  the week in French. Parts in `today/TodayParts.tsx`; dark-ready since
  2026-10-20 (UI-008, artboard B-Today).
- **Explore** (`tabs/ExploreTab.tsx`, `main/exploreView.ts`): four filter chips,
  Prepare for something real, topic tiles and situations; a situation opens
  the scene preview. Drawn from `explore/ExploreParts.tsx` with art and badges
  from `main/exploreArt.ts`; Explore and ScenePreview follow dark mode
  (`nav/darkReady.ts`, UI-008, 2026-10-20).
- **Speak** (`tabs/TutorTab.tsx`, `tutor/speakTabView.ts`): Recommended, the
  stage's starter scenes, "Same scene, a bit less help", Talk about anything
  (chips from remembered interests and life events, else the learner's
  suggestions, then "Your own topic"), the tutor row, three tiles and the
  minutes band. Rebuilt to B-Speak in light and dark (UI-008, 2026-10-20);
  Revisit a conversation left Speak (Conversations is on Journey and Settings).
- **Practice** (`tabs/PracticeTab.tsx`, `practice/practiceTabView.ts`,
  `practice/useLibraryData.ts`): the learner's conversations, saved phrases
  and the sound guide, with search and "Comes up often" (authored patterns
  only, never a count); Your fixes (`practice/FixesScreen.tsx`) also shows it.
  Both rebuilt to their artboards in light and dark (2026-10-21, UI-008).
- **Journey** (`tabs/MyFrenchTab.tsx`, `journey/journeyView.ts`): the level
  head, Your French first (phrases used and held with one highlighted,
  lines that came back clear, scenes earned; each only with evidence),
  five stages, abilities, Then and now, help in words,
  sounds, the week and the collection tiles. Parts in `journey/JourneyParts.tsx`
  (shared with Then and now); Journey and Then and now are dark-ready since
  2026-10-21 (UI-008), with the Badges sheet pinned light.
- **Review and Drill** (`ReviewScreen.tsx`, `DrillScreen.tsx`): rebuilt to
  B-Review, B-ReviewReveal and B-Drill in light and dark (2026-10-21, UI-008).
  Review names the source conversation (`review/context.ts`) and shows "Also
  fine:" from the drill bank's accepted French (`review/alsoFine.ts`); its
  count and grade intervals stay held. Empty states share
  `empty/EmptyStateCard.tsx`; Speak draws the away and out-of-time cards
  (`empty/emptyStates.ts`).
- **Live room and the end of a conversation** (`live/C2LiveRoom.tsx`,
  `RecapScreen.tsx`): rebuilt to B-Live, B-LiveHelp, B-AfterSession,
  B-Celebrate and B-Recap (2026-10-21, UI-008). The room shows the scene's own
  pace, the goals strip from `visibleMissionTasks` and the help ladder over the
  live rung (`live/liveRoomView.ts`); the recap pages run After a session, the
  Celebration, the Recap, then sound and next (`recap/pages.ts`,
  `recap/afterSessionView.ts`). The goals reach the Recap passed through from
  the room, with no new storage. The Convo and Lesson routes follow the device
  since 2026-10-21 (UI-008 step 12b): their waiting, error, safety, recap and
  lesson screens read the tokens, and the room keeps its blue in both themes.
- **Streak, Profile and Settings** (`game/StreakScreen.tsx`,
  `tabs/ProfileTab.tsx`, `settings/SettingsScreen.tsx`): rebuilt to B-Streak,
  B-Profile and B-Settings in light and dark (2026-10-21, UI-008). Streak shows
  the freeze card ("Free with every account" on the free plan, the trial pill
  for a second freeze and repair), the next milestone with "n of 7 days" (no
  reward line), the month, and the Evening nudge: the daily reminder's switch
  (`settings/useEveningNudge.ts`, `settings/streakNudge.ts`). Profile has the
  stats card, the plan card (what Free includes, See plans to the Wall), the
  Learning, Your French and More groups, and the tab bar with no tab selected
  (`DetachedTabBar` in `nav/LuvaniTabBar.tsx`). Settings follows the artboard's
  groups, adds Practice (speaking target, correction style, the simpler-speech
  and Prefer typing switches over Learning preferences' stores), the free band
  row, and the Appearance row opening the Display choice. The shared grouped
  rows draw the B row only under `<SettingsAppearance b>`; Learning
  preferences and Subscription keep the P2 row and follow the device since
  2026-10-21 (UI-008 step 12b), with every other signed-in route except the
  first scene.

Three stack routes were added in `nav/RootNavigator.tsx` and `nav/types.ts`:
`ScenePreview` (`scenes/ScenePreviewScreen.tsx`, by mission or daily scene id),
`Fixes` (`practice/FixesScreen.tsx`, attempt before reveal) and `ThenNow`
(`journey/ThenNowScreen.tsx`). Lock badges read `access/featureAccess.ts`,
which mirrors `purchases/featureLocks.ts`; `access/useFeatureAccess.ts` is the
reactive hook that opens the Wall.

### Free tier and locks (20 October 2026, D23 and D24)

- **Weekly taste:** `PLANS.trial` is 5 minutes on a rolling 7 days from first use (`packages/core/src/metering/meter.ts`, `refillTaste`), refilled lazily by the database only for rows that passed the device claim (`entitlements.weekly_taste`). A lapsed plan falls back to it. `/billing/status` returns the refill time as `periodEnd`.
- **Locks:** `purchases/capabilities.ts` (`unlocks`) and `purchases/featureLocks.ts` answer the eight locked features; `LOCKED_ROUTES` sends a locked route to `Wall {entry:'locked'}` from `App.tsx`'s navigation listener.
- **Paywall on open:** `Wall {entry:'launch'}` on each cold launch and on return after 30+ minutes away, for learners with no plan or trial, only on a tab root and never over a sitting, a recap or onboarding. The Wall shows "Not now".
- **Lock gaps closed (20 October 2026):** `Lesson` (the café pronunciation lesson) is locked as `sounds`; Review deals `reviewableFree` cards to a free learner and shows how many conversation phrases wait (`review/freeTier.ts`, `ReviewCard.sources` in `packages/core/src/review/sources.ts`); the token server signs `memoryLocked: true` for free, lapsed and guest sessions and the tutor then sends no saved memory, uses no remembered opener and extracts nothing.
- **Home's review card follows the free deal:** `NextTaskCard` offers only a card Review will deal (`reviewOffer`, `offeredReview` in `review/freeTier.ts`), so a free learner with only conversation phrases due sees the next free step instead. The recap's "Practise this phrase" drill stays free (founder, 2026-10-20): one drill in the moment is a taste, spaced review later is the trial feature.
- **Streak:** one free freeze, two plus repair on a plan.
- **Names:** the paid plans read Core and Max (ids `starter`, `regular`).
- **Guest first scene (UI-011, 23 October 2026, branch `claude/guest-first-scene`):** before sign-up, one five-turn scripted café exchange (`GUEST_CAFE_SCENE` in `packages/core/src/lessons/guestCafe.ts`) with no language model and a 180-second ceiling, off until `LUVANI_GUEST_SCENE=1` on the API and tutor roles. Admission is a Redis budget outside paid admission: one scene per installation per 30 days, three guest starts per address per day, and `LUVANI_GUEST_SCENE_DAILY` (default 24) booked at worker claim. The scene's lines go to the phrasebook on sign-up. The guest conversation stays closed in production.

### Paywall and account surfaces (19 October 2026)

The paywall uses the approved P2 Luvani design (Figma `sjAwoGinWQKvhGrWbgMO18`, boards `489:1710`/`489:3664`). `wall/WallScreen.tsx` renders it, `wall/trialPaywall.ts` decides what it shows, and `effectiveSelection` defaults to Core (id `starter`) yearly.
- **Variants:** the trial paywall shows the Today / Before day 7 or Day 5 / Day 7 timeline. Unknown eligibility shows the standard paywall. Loading, offline, purchasing, failed, restore and success states are covered.
- **Trial-ending reminder:** a real reminder (`reminders/trialReminderSync.ts`), scheduled only after a confirmed trial with notification permission and the setting on.
- **Store facts:** `purchases/storeTrialFacts.ts` is read only to cancel the reminder; it never grants minutes or a plan.
- **Account screens:**
  - Profile: identity, Learning, Your French and Plan groups.
  - Learning preferences: includes Your goal, changing or clearing `onboardingGoal` through `withOnboardingGoal` (clocked, newest-edit-wins), and the Conversation starting point, editing `practicePreferences.level` with newest-edit-wins sync.
  - Settings: six groups.
  - Subscription: never says "Free" when the plan is unknown.
- **Real purchases:** unverified until the App Store and RevenueCat setup in `REVENUECAT_SETUP.md` is done and sandbox-tested. That setup is deferred (2026-10-19) until the founder has an Apple Developer Program membership; prices are undecided.
- **Appearance:** `main/MainAppearance.tsx` gives these screens an account-scoped appearance, and `main/appearanceModel.ts` pins it to light (`DARK_MODE_ENABLED`). Their dark palettes are defined but unused, and Settings shows no display choice (KNOWN_ISSUES F847).
- **Branch status:** this work is on branch `paywall-on-c2`, replayed on top of `main`'s C2 redesign, and is not yet on `main`.

Daily playback uses `daily/tutorAudioManifest.ts`: 400 items with six tutor voices,
2,400 recordings. The full 2,000-item text library remains available. Missing tutor
recordings have no generic-voice fallback. The unused Kokoro pack and generator were
retired on 3 October; their provenance remains in Git history and licence notices.

`npm run dev` prints its checkout and revision, clears Metro's bundler cache when
starting its app, and refuses an existing preview on its app port. An HTTP 200 does
not identify a checkout. The running server's directory determines its source;
merging `main` elsewhere cannot update a server on an older branch.

## Replacement/dependency graph

- Splash removal affects `App.tsx`, `splash/SplashScreen.tsx`, `splash/store.ts`, splash
  tests, illustrations, and first-run routing.
- Onboarding replacement affects stored profile versions and repair logic; optional legacy
  nulls must not re-onboard returning learners.
- TutorIntro replacement affects profile links, tutor gates, seen flags, storage suffixes,
  art, and surface-contract tests.
- Practice consolidation must preserve the scheduler, review grades, drill bank, topics,
  journal recovery, and post-session protocol before presentation code is deleted.
- The unreachable Leaderboard UI is retired. The live unranked Friends product
  retains its namespace, identity, adapter, challenges and compatibility data.
- Pricing changes cross core constants, SQL plan checks, token responses, UI, purchase
  webhooks, and compatibility migration together.


4 October 2026: four primary tabs with Friends in Profile. Home, Speak and empty
Practice share the owned next-task selector (resume, personal practice, next
scene) and the same genuine bundled café fallback. The navigator never mounts
the simulated lesson. Correction drafts have no countdown; individual requests
still time out and exit/background/account changes cancel them. See
`VIDEO_UX_IMPLEMENTATION.md` for the video-review dispositions and verification.
