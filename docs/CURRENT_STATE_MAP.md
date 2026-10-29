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
   About a minute before the cap it gives a spoken heads-up and closes after one more
   exchange (`sessionEnd.ts`, VOICE-018); a learner can choose Tap to send, which holds
   each spoken turn until Send or 60 s (`tapToSend.ts`, VOICE-019).
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
| Tutor conduct in a session (eval, synthetic and dev records only) | `services/brain-playground/src/eval/sessionChecks.ts`; real transcripts wait on consent, see `docs/changes/session-eval.md` |

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

### Visual and accessibility rules (Stream E, 29 October 2026, UI-013)

- **Controls:** every input border, choice outline, tile, chip and empty state
  mark is drawn in `field` (3:1 or more on its ground, light and dark);
  `controls.test.ts` measures every control border (F921).
- **Keyboard (web):** Space chooses radios, checkboxes, tabs and switches
  (`keyActivation.ts`); every keyboard stop shows a two-tone ink and white
  ring on `:focus-visible` only; a disabled button with a reason
  (`disabledReason`, e.g. Create account) stays reachable and says why; a
  settings switch row is one control (F927).
- **Short and narrow screens:** the welcome stage scales to the screen;
  onboarding footers scroll below 700pt of usable height, latched while a
  text field has focus so a web keyboard cannot flip them (F921). Browser
  text size is not followed yet (F939, deferred to the Wave 3 device check).
- **Sign-out (F938):** Settings asks first (`settings/signOutConfirm.ts`),
  saves pending sync for at most 2 s while busy, and says only what is true
  of the account's sync state. A sign-in inside the running app lands on
  Today (`nav/landing.ts`); a cold load with a session keeps its address; on
  web sign-out resets the address to `/` and the auth fields sit in a real
  form (`auth/AuthForm.tsx`).
- **Seeds (F929):** a seed topic is `{ fr, en, brief? }`; only the short
  title is shown or spoken, the tutor-only `brief` carries instructions
  (free talk, Explore, daily scenes, real moments, the guest first scene).
  The legal-review sentence shows only outside production builds
  (`EXPO_PUBLIC_LUVANI_BUILD_PROFILE`).
- **Copy and art:** each tutor's own portrait (`tutor/TutorPortrait.tsx`);
  "{tutor} plays {part}." before a mission's narration; English under every
  reference phrase; start icons match their mode; Speak says "Next" for a
  path-order pick and "Uses live minutes" (F940 to F945, F856, F857).

### Direction B tabs (Phase B, 20 October 2026)

Each tab is layout over a plain view model (DESIGN.md composition rules,
DECISIONS.md UI-007):

- **Today** (`tabs/HomeTab.tsx`, `home/todayView.ts`): "Bonjour, Name.", the
  stats row (`game/TodayHero.tsx`), then "Today's path" (F934, UI-012; the
  route motif in `home/RoutePath.tsx`): retry your last fix (`oneFix`, about
  30 seconds), the next scene (`home/MissionHero.tsx`; core `nextScene`,
  leaning towards the onboarding goal, eyebrow "Picked for ..." when the goal
  chose it; the lead is `todayLead` in `practice/nextTask.ts`, held on the
  loading frame until billing answers (a failed read falls back to the scene),
  in this order: plans when a trial cannot start; "Your paid plan has ended."
  (lapsed, with See the plans); a paid plan's out-of-time words; each of these
  two followed by the starter card or local practice; the starter card; the
  offline or can't-reach card ("Something you can do now"); the scene; Explore
  when there is no next scene), say today's phrase (about 2 minutes), and "Review N phrases" when
  Review would deal cards (`reviewRow`). Under it: today's three quests
  (`game/QuestsCard.tsx`), Coming up (`comingUp`, the latest remembered life
  event; no countdown or checklist until Phase C; Not now lasts the app
  session) and the week in French. Live re-probes on `online`, on foreground
  and every 30 s while offline (`app/liveWatch.ts`, F924). Parts in
  `today/TodayParts.tsx`; dark-ready since 2026-10-20 (UI-008, artboard
  B-Today). The scene card measures itself: the café sits beside the words
  only from 400pt of card width, otherwise in a band above them, so on every
  phone it never covers the title or time (`sceneCardGeometry` in
  `responsiveLayout.ts`, F920, UI-013; Speak's card follows the same rule).
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
- **Journey** (`tabs/MyFrenchTab.tsx`, `journey/journeyView.ts`): the stage
  eyebrow, then the XP head ("XP level 3", "130 XP, 95 to the next", the same
  level and total as Today's tile; F918), the counts (saved phrases counted by
  `practice/savedPhrases.ts`, the rule Practice uses, and re-read after the
  packs refresh; minutes "Under 1" while under a minute was measured), Your French first (phrases used and held with one highlighted,
  lines that came back clear, scenes earned; each only with evidence),
  How it’s going right after it (Getting better at: quiet error patterns,
  by authored title; Needs another go: up to three due phrases missed or
  said with help, opening Review; LEARN-013),
  five stages (stages below an onboarding placement read as skipped, never
  earned; F917; Journey's empty state, the Home hero, the next-task card, Speak's Start
  and Walk mode, the Recap Next time and Next pill, and Week Wrapped pass the
  placement to core `nextScene` as `startAt` (`startAtOf`), so none suggests a scene below it), abilities, Then and now, help in words,
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
  the room, with no new storage. Turns earn credit (F904, 2026-10-28,
  `recap/sessionCredit.ts`): a recap whose `learnerReplies` is 0 settles
  nothing (no XP, no minutes, no active or streak day), banks no practice by any
  path (crash journal included: such a recap is never journalled and a stored
  envelope saying 0 replies is dropped on recovery), offers no saved conversation text, shows no "new phrases" tile and says
  "You made time for your French."; an older agent without the count keeps the
  old behaviour. Leaving after at least
  one learner reply (F905, `live/leaveKeepingWork.ts`) takes the Finish path:
  the room stays open, the recap is requested and awaited up to 8 s, so the
  lines are saved and the minutes counted; if none comes the minutes are
  written locally at the zero-phrase base XP and the ordinary teardown runs;
  exactly one of the two settles, so a late recap never settles twice.
  "Replied" means agent-confirmed scene replies (`sceneReplies` in the hook),
  never a topic pick or an unconfirmed typed line; with no reply Leave is instant. Starting a conversation (F903,
  `tutor/convoStart.ts`): the route's params are read once and coerced, so a
  reloaded address keeps its mode. A button that says Start speaking or Speak
  instead passes `textMode: false`, which closes the typing box and opens the
  microphone once the room is ready, whatever the onboarding typing answer (a
  refusal opens the box); a start with no stated intent opens closed as before.
  Speak in a typed-start room asks "Switch to speaking?", keeps the typed part
  (its lines recovered from the recap, no end card, not a sitting of its own:
  its replies and the clock carry into the voice room so the scene settles once)
  when the learner has replied, then releases the lease and rebuilds the
  session as voice (`live/switchToVoice.ts`). A safety stop during the switch
  cancels it with no rebuild, and Leave on the switch's wait follows the Leave
  rule above.
  The rebuild leaves through `leaveForRebuild` and, on the token server's 409 for its own closing lease,
  retries for about 20 s behind "Switching to speaking" (`live/ownLease.ts`);
  past that it says "Still closing your typed session" with Try again and Leave.
  An ordinary start's 409 still reads as another device. The topic of a
  conversation travels in the web address as validated JSON, so a reload keeps it.
  After a switch the address is set to `textMode=false`, so a reload restarts in
  voice; Start again after a reload waits out the cut-off session's lease the
  same way.
  A web reload of the conversation address (F923, `tutor/reloadGate.ts`) shows
  "Your last conversation ended." with Start again and never opens a session
  by itself. The Convo and Lesson routes follow the device
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
  first scene. Help and feedback (Profile's More group, Settings' Help group,
  shown only when `legal/company.ts` has an address) opens an in-app sheet
  (`settings/HelpSheet.tsx`, copy in `settings/helpSheet.ts`, F922). It holds five
  short answers built from existing copy: a blocked mic, typing, minutes, leaving a
  scene, and what Free includes. Write to us comes last, with the address as
  selectable text and an Open mail button. If the mail app won't open, the button
  shows `LINK_TROUBLE` and the address stays on screen.

Three stack routes were added in `nav/RootNavigator.tsx` and `nav/types.ts`:
`ScenePreview` (`scenes/ScenePreviewScreen.tsx`, by mission or daily scene id),
`Fixes` (`practice/FixesScreen.tsx`, attempt before reveal) and `ThenNow`
(`journey/ThenNowScreen.tsx`). Lock badges read `access/featureAccess.ts`,
which mirrors `purchases/featureLocks.ts`; `access/useFeatureAccess.ts` is the
reactive hook that opens the Wall.

### Free tier and locks (20 October 2026, D23 and D24; allowance REV-001, 23 October)

- **Free allowance:** `PLANS.trial` is 10 minutes (one conversation) refilled 44 hours after the first debit of each window (`TASTE_REFILL_HOURS`, REV-001; was 5 minutes a week) (`packages/core/src/metering/meter.ts`, `refillTaste`), refilled lazily by the database only for rows that passed the device claim (`entitlements.weekly_taste`). A lapsed plan falls back to it. `/billing/status` returns the refill time as `periodEnd`.
- **Locks:** `purchases/capabilities.ts` (`unlocks`) and `purchases/featureLocks.ts` answer the eight locked features; `LOCKED_ROUTES` sends a locked route to `Wall {entry:'locked', feature}` from `App.tsx`'s navigation listener, and a locked tap does the same through `open(feature)`. Each badge names the plan that opens it, Core or Max (`requiredPlan`, F910); the `locked` Wall preselects that plan's yearly offer and opens with the feature's brief (`LOCK_BRIEFS` in `wall/wallCopy.ts`). The feature survives a web address (`/plans?entry=locked&feature=…`, validated).
- **Paywall on open (founder decision 4, 2026-10-28, superseding D24's cadence; F907, 2026-10-29):** `Wall {entry:'launch'}` at most once a local day, on a cold launch that is not a web refresh or a return after 30+ minutes away, for learners with no plan or trial who have finished at least one conversation, only on a tab root and never over a sitting, a recap or onboarding, and never on the return from a scene left before its recap. The day and the finished conversation are a device-local record (`wall/launchWallSeen.ts`, key `launch-wall-seen`); the sign-up day's first-run offer counts as that day's showing. The limit and lock doors are unchanged. An unknown web address lands on Home, the Wall is one screen however it is reached (`nav/singleWall.ts`), and the plans page suggests a plan only once both the goal and the server's status have been read (no goal: Core yearly). The Wall shows "Not now".
- **Lock gaps closed (20 October 2026):** `Lesson` (the café pronunciation lesson) is locked as `sounds`; Review deals `reviewableFree` cards to a free learner and shows how many conversation phrases wait (`review/freeTier.ts`, `ReviewCard.sources` in `packages/core/src/review/sources.ts`); the token server signs `memoryLocked: true` for free, lapsed and guest sessions and the tutor then sends no saved memory, uses no remembered opener and extracts nothing.
- **Beginner conduct (VOICE-013 to 015, 25 October 2026, branch `claude/beginner-conduct`):** the opening question and the silence suggestion rotate on the session count, free sessions included, with no memory used; an A0 or A1 learner stuck twice on one exchange hears an authored English way back; each turn names the tutor's questions already asked this session; and a learner's sad news (a death, an illness) can never be the turn that ends the session.
- **Home's review card follows the free deal:** `NextTaskCard` offers only a card Review will deal (`reviewOffer`, `offeredReview` in `review/freeTier.ts`), so a free learner with only conversation phrases due sees the next free step instead. The recap's "Practise this phrase" drill stays free (founder, 2026-10-20): one drill in the moment is a taste, spaced review later is the trial feature.
- **Streak:** one free freeze, two plus repair on a plan.
- **Names:** the paid plans read Core and Max (ids `starter`, `regular`).
- **First-run exits (F915, F926, 29 October 2026, branch `claude/review-c-first-run`):** setup steps after the first show a Back chevron in the band's back disc, with web history entries so browser Back steps back; "Before we start" offers "Create an account first" (guest) or "Look around first" (signed in), and the signed-in first scene offers "Look around first", all landing on Home with no scene; the tutor step preselects the recommended tutor; the post-sign-up welcome is marked seen when drawn.
- **Guest first scene (UI-011, 23 October 2026, branch `claude/guest-first-scene`):** before sign-up, one five-turn scripted café exchange (`GUEST_CAFE_SCENE` in `packages/core/src/lessons/guestCafe.ts`) with no language model and a 180-second ceiling, off until `LUVANI_GUEST_SCENE=1` on the API and tutor roles. Admission is a Redis budget outside paid admission: one scene per installation per 30 days, three guest starts per address per day, and `LUVANI_GUEST_SCENE_DAILY` (default 24) booked at worker claim. The scene's lines go to the phrasebook on sign-up. The guest conversation stays closed in production.

### Paywall and account surfaces (19 October 2026)

The paywall uses the approved P2 Luvani design (Figma `sjAwoGinWQKvhGrWbgMO18`, boards `489:1710`/`489:3664`). `wall/WallScreen.tsx` renders it, `wall/trialPaywall.ts` decides what it shows, and `effectiveSelection` defaults to Core (id `starter`) yearly, or to the plan a lock named. Since 2026-10-29 (F912) trial copy shows only to a learner the server read as Free and not lapsed, with an eligible store offer; the plans page waits for that read. A current subscriber is offered the other plan, sees theirs marked "Your plan" and cannot buy it again; a lapsed one reads "Welcome back". The compare sheet says both plans in one template from the catalogue (F913).
- **Variants:** the trial paywall shows the Today / Before day 7 or Day 5 / Day 7 timeline. Unknown eligibility shows the standard paywall. Loading, offline, purchasing, failed, restore and success states are covered.
- **Trial-ending reminder:** a real reminder (`reminders/trialReminderSync.ts`), scheduled only after a confirmed trial with notification permission and the setting on.
- **Store facts:** `purchases/storeTrialFacts.ts` is read only to cancel the reminder; it never grants minutes or a plan.
- **Account screens:**
  - Profile: identity, Learning, Your French and Plan groups.
  - Learning preferences: includes Your goal, changing or clearing `onboardingGoal` through `withOnboardingGoal` (clocked, newest-edit-wins), and the Conversation starting point, editing `practicePreferences.level` with newest-edit-wins sync (written at account creation from the onboarding answer since F916; `practicePreferences.placement` holds the onboarding placement; changing the level here re-derives it, getby to Basics and confident to Everyday, none below, and re-choosing the same level keeps a Skip ahead; the merge keeps placement and level together). A "Slower voice" switch stores a device choice (`@luvani/voice-speed/v1`, `slower` or `normal`); `/session/start` carries `voiceSpeed` only when chosen, otherwise the tutor's default applies (slower for lessons and A0 to A1), and the switch shows that default.
  - Settings: six groups.
  - Subscription: never says "Free" when the plan is unknown. A paid plan shows when its minutes are fresh (from `/billing/status` `periodEnd`) and, once, in the Next renewal row, the store's renewal date and price (`purchases.heldPlan` joined to the offering by `renewalLines`, F909), or a pointer to the App Store or Google Play when the store does not answer. Profile and Settings plan rows keep the minutes line and make no store read. Web never has a store answer; `WALL_PREVIEW=store` uses preview fixtures.
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

### Learning loop honesty (LEARN-001 to LEARN-006, 26 October 2026, branch `claude/learning-loop`)

- **Evidence:** a use said with the hint or line showing raises `timesAssisted`, not
  `timesUsedWell` (profile.ts); error patterns are suspected until seen in two sessions,
  and `watchFor` is recurring-first; a drill answer right only after a miss comes back
  tomorrow at the same stage with no evidence (scheduler.ts, drill/session.ts).
- **Pipeline:** migration 44 (prepared, not applied) completes a practice job only on
  generated drills; `GET /conversation-packs` carries `practiceStatus` and the app shows
  preparing and failed calmly (`conversationPacks/practiceStatus.ts`); both drill paths
  share `groundedDrills`; deleting a conversation clears its name from review cards.
- **Next session:** review focus items carry an `ask` (unaided or new-situation) chosen
  from evidence (`tutorBrief.ts`), scene targets are weakest first (`frameTargets`), and
  wins earn up to two transfer exercises (`transferPhrasesFrom`).

### Cost and measurement (COST-001 to COST-004, 28 October 2026, branch `claude/phase-f-cost`)

- **Memory extraction eval:** `eval:extract` (brain-playground) scores the production
  extraction request on ten synthetic sessions; extraction still runs on `gpt-5.6-terra`
  at high effort with the full transcript. Baseline in
  `docs/cogs-evidence/extract-eval-2026-10-28.md`; no model switched.
- **Judge memo:** built but off (`LUVANI_JUDGE_MEMO=1` turns it on): `/drill/judge` and
  `/drill/fix-line` would memoise successful verdicts per user for 24 hours in process
  memory (`judgeMemo.ts`), before paid admission. The privacy notice must change first.
- **Numbers:** the practice worker's `practice_job` line carries counts, failure kind,
  generation and estimated session-end-to-ready ms and cost; the tutor prints
  `drill_validation` and `session_cost` JSON lines. `eval:cost-numbers` aggregates an
  exported log offline. Cost is not a product event (COST-004).

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
