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
7. The app stores recap/practice/profile artefacts locally. The Supabase `learner_state`
   table is connected through the account-scoped client sync engine in App.tsx. Physical two-device convergence remains a release acceptance check.

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
| Production learner sync | Client transport implemented; physical two-device acceptance pending |

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
