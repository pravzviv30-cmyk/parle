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
The four tab routes are Home, Tutor, Practice and MyFrench, displayed as Home,
Speak, Practice and Progress. Profile is a pushed screen reached from the profile
button; Friends is an optional stack route inside Profile. Revamp B and the
video UX implementation use this same navigator.

### Free tier and locks (20 October 2026, D23 and D24)

- **Weekly taste:** `PLANS.trial` is 5 minutes on a rolling 7 days from first use (`packages/core/src/metering/meter.ts`, `refillTaste`), refilled lazily by the database only for rows that passed the device claim (`entitlements.weekly_taste`). A lapsed plan falls back to it. `/billing/status` returns the refill time as `periodEnd`.
- **Locks:** `purchases/capabilities.ts` (`unlocks`) and `purchases/featureLocks.ts` answer the eight locked features; `LOCKED_ROUTES` sends a locked route to `Wall {entry:'locked'}` from `App.tsx`'s navigation listener.
- **Paywall on open:** `Wall {entry:'launch'}` on each cold launch and on return after 30+ minutes away, for learners with no plan or trial, only on a tab root and never over a sitting, a recap or onboarding. The Wall shows "Not now".
- **Lock gaps closed (20 October 2026):** `Lesson` (the café pronunciation lesson) is locked as `sounds`; Review deals `reviewableFree` cards to a free learner and shows how many conversation phrases wait (`review/freeTier.ts`, `ReviewCard.sources` in `packages/core/src/review/sources.ts`); the token server signs `memoryLocked: true` for free, lapsed and guest sessions and the tutor then sends no saved memory, uses no remembered opener and extracts nothing.
- **Streak:** one free freeze, two plus repair on a plan.
- **Names:** the paid plans read Core and Max (ids `starter`, `regular`).

### Paywall and account surfaces (19 October 2026)

The paywall uses the approved P2 Luvani design (Figma `sjAwoGinWQKvhGrWbgMO18`, boards `489:1710`/`489:3664`). `wall/WallScreen.tsx` renders it, `wall/trialPaywall.ts` decides what it shows, and `effectiveSelection` defaults to Core (id `starter`) yearly.
- **Variants:** the trial paywall shows the Today / Before day 7 or Day 5 / Day 7 timeline. Unknown eligibility shows the standard paywall. Loading, offline, purchasing, failed, restore and success states are covered.
- **Trial-ending reminder:** a real reminder (`reminders/trialReminderSync.ts`), scheduled only after a confirmed trial with notification permission and the setting on.
- **Store facts:** `purchases/storeTrialFacts.ts` is read only to cancel the reminder; it never grants minutes or a plan.
- **Account screens:**
  - Profile: identity, Learning, Your French and Plan groups.
  - Learning preferences: includes the Conversation starting point, editing `practicePreferences.level` with newest-edit-wins sync.
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
