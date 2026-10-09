# Implementation plan · Direction B approved

The user approved Direction B and the research implementation on 9 October 2026. The design review checkpoint is satisfied; implementation may proceed. Existing native edits from the earlier session remain intact. Approving a visual direction does not approve proposed price points or publish subscriptions.

## Sequence and dependencies

1. **Freeze approved direction and copy.** Review A/B, select B with calm utility screens, approve Weekly restoration and resolve monthly/annual/trial proposals. Record source Figma IDs and the screen inventory. Do not rewrite the whole app at once.
2. **Shared layout/tokens.** Reconcile `palette.ts`, `theme.ts`, `layout.tsx`, `responsiveLayout.ts`, `components.tsx`; preserve existing reading/footer/navigation max widths. Add semantic component properties for compact choices and screen actions. Align Figma style roles with native type scaling. Validate one representative long form and one paywall before rollout.
3. **Billing contract before Weekly UI activation.** Extend `packages/core/src/metering/meter.ts`, `apps/mobile/src/purchases/contract.ts`, adapter/product mapping, `services/token-server/src/billing/state.ts`, `renewals.ts`, `revenuecat.ts`, and `billingStatus.ts`. Check downstream schemas, migrations and tests before editing. Configure store/RevenueCat products separately using approved prices. Feature-detect verified Weekly availability.
4. **Onboarding vertical slice.** `PreAccountOnboarding.tsx`, `preAccountDraft.ts`, `story.ts`, firstRun components/copy and `OnboardingFlow.tsx`. Keep resumption, editable answers, skip/back, age/consent, permission denial, account adoption and honest first-practice feedback. Existing startup branding only.
5. **Four tabs + secondary screens.** Apply route-specific instructions below without replacing data/state hooks. Preserve navigation deep links and serialisable params.
6. **Paywall + lifecycle.** `WallScreen.tsx`, `WallPlansPage.tsx`, `WallYoursPage.tsx`, `wallPlans.ts`, `wallCopy.ts`, purchases state/settlement/restore modules. Bind selected product, trial eligibility, allowance and recurring price as one coherent view model. Pending confirmation must not trigger duplicate payment or optimistic grants.
7. **Motion and accessibility.** `VoiceOrb.tsx`, `OrbSurface.tsx`, illustration shell, focus/VoiceOver announcements and Reduce Motion. Profile actual-device frame times; avoid animation churn on every meter update.
8. **Release evidence.** Typecheck, focused unit/integration suites, native sandbox billing, simulator/device UI checks, accessibility, screenshot comparison, offline/recovery and performance. Broaden tests after meaningful changes, not after documentation-only edits.

## Route-by-route implementation

| Screen(s) | Planned change | Preserve / acceptance |
|---|---|---|
| Home | One next scene + compact evidence | Cold load, offline, unread, return continuity, profile entry |
| Tutor / TutorIntro | Soft orb preview, concise voice/scene options | Preview stops on blur; AI identity; access/connection check before session |
| Practice | Three prioritised practice paths | Due/mix/own-words route origins, empty alternatives, saved data |
| MyFrench | Earned phrase hero and short progress links | Actual counts; no fabricated zero on failed read |
| Profile | Calm identity/voice/settings/friends groups | Name and voice sheet save/cancel, keyboard and dirty draft |
| Friends / AddFriends / SocialSettings | Optional friendly invitation, quieter list | AddFriends actually mounts InviteFriendsScreen; requests, search, privacy, block/report; native share only on tap |
| DailyLibrary / DailyPractice | Saved-first collection, focused phrase | Filter/query/page persistence; unread vs empty; audio and bookmark state |
| Missions / FirstScene | Contextual scene choices and primer | Authored catalogue; selected mission ID; denied microphone → type option |
| Lesson / Convo | Focused live shell | Session lifecycle, pause/resume, help/type, reconnect, metering, leave confirmation, real recap |
| Drill / Review | One card/job, concise correction | Own-words/mix/pack origins; earned results; retry and saved progress |
| SoundCheck / SoundJourney | Hear/try/result hierarchy | Reference-based evaluation; unmeasured/failed/offline/no-history distinct |
| GoalStep / TutorMemory | Next goal task; editable remembered facts | Deleted goal, unread, account scope, forget confirmation; no mastery promises |
| RealMoment | Entitlement before effort, optional detail | Max-only; draft preserved; checking/error not treated as upgrade |
| Phrasebook | Clear saved-phrase list/detail | Filter/search/no match/empty; no paywall on earned French |
| Conversations / SavedConversationText / ConversationPractice | Resume/review/practise separation | Missing pack, scoped ownership, local unsynced/delete/export outcomes |
| Postcards / WeekWrapped / Streak | Vivid evidence-led milestones | Real source values, empty/unread, calendar/freezes/repair; no pressure copy |
| Settings | Clear task groups; calm forms | Reminder/system permission, export, sign-out, delete reauth, acknowledgements |
| Wall | Compact durations and lifecycle surfaces | Weekly explicit; Max separate; localised price; no trial on Weekly/Monthly |
| Policy / Terms | Readable document shell | Full accurate content, working links and back; no removal of required terms |
| Auth / bootstrap / reset / erased-account | Shared calm form and clear progress/error | No account-scope leakage; validation; keyboard/focus; user-controlled submission |

## Weekly engineering acceptance

- Product period `week` round-trips through app/server/store mappings; unsupported periods are rejected.
- US target 5.49 is not a hardcoded global price; store product/localisation supplies displayed amount and recurrence.
- Exactly 45 minutes are granted for a verified seven-day window; no monthly grant, no rollover, no duplicate grant on replayed event.
- Renewals, expiry, grace, cancellation, refund/revocation, restore, account change and late notifications reconcile correctly.
- Eligibility unknown/ineligible shows no trial; Weekly and Monthly charge immediately under the adopted policy.
- Price changes, unavailable product and partial catalogue fail safely with a retry/free-practice path.
- Sandbox purchase → authoritative entitlement → live access is tested end to end before production configuration is enabled.

## Responsive and interaction acceptance

375×812, 390×844, 430×932, narrow 320pt stress case, tablet 834pt and desktop 1440pt; safe areas, portrait/landscape, keyboard and large text. Text is not clipped or shrunk to fit. Critical billing terms stay adjacent to the action; allow accessible scrolling when necessary. Native VoiceOver traverses visual order, announces selection and errors, traps/restores sheet focus and gives separate labelled actions. Every visual affordance must be wired to the intended action; decorative art is excluded from accessibility.

Read the installed Expo 57 documentation before implementing native code, as `apps/mobile/AGENTS.md` requires. Do not infer compatibility with hypothetical device dimensions from model names.

## Performance acceptance after implementation

Measure release builds on the oldest supported physical device and a current device. Target smooth 60fps interaction where the device supports it; compare frame drops, memory and input latency against the existing build. Investigate main-thread stalls above 50ms during navigation/orb updates. Defer nonessential illustration work; avoid blocking the first usable action on decorative assets. Network/AI response latency is measured separately from UI responsiveness. These are acceptance targets, not performance results from this design phase.
