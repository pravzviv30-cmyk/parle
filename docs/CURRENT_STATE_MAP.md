# Current-state map

## Runtime path

1. `apps/mobile/App.tsx` mounts the auth gate, user-scoped storage providers, and navigator.
2. `apps/mobile/src/auth/adapter.ts` selects Supabase or the explicit local mock. Native
   Supabase sessions use SecureStore; local learning stores use user-scoped AsyncStorage.
3. A lesson or conversation calls `services/token-server/src/server.ts` for a LiveKit grant.
4. The token server verifies the account, rate/installation budgets, one-time trial,
   entitlement, active-session lease, and signed room/session metadata.
5. `services/tutor-agent/src/agent.ts` binds the first participant, runs either
   `ParleTutor` or `ParleConversation`, and publishes the core protocol over LiveKit data.
6. Session finish reports the signed session ID and billable seconds to the token server.
   PostgreSQL records the ID once and atomically debits the entitlement.
7. The app stores recap/practice/profile artefacts locally. The Supabase `learner_state`
   table is not yet connected to a client sync transport.

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
| Production learner sync | Not implemented |

## Replacement/dependency graph

- Splash removal affects `App.tsx`, `splash/SplashScreen.tsx`, `splash/store.ts`, splash
  tests, illustrations, and first-run routing.
- Onboarding replacement affects stored profile versions and repair logic; optional legacy
  nulls must not re-onboard returning learners.
- TutorIntro replacement affects profile links, tutor gates, seen flags, storage suffixes,
  art, and surface-contract tests.
- Practice consolidation must preserve the scheduler, review grades, drill bank, topics,
  journal recovery, and post-session protocol before presentation code is deleted.
- Leaderboard/friend removal requires a persisted-key check before deleting the friends
  namespace or local adapter.
- Pricing changes cross core constants, SQL plan checks, token responses, UI, purchase
  webhooks, and compatibility migration together.

