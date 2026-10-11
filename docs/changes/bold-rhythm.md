# C · Bold rhythm implementation

- Status: implementation present; integration acceptance incomplete
- Updated: 2026-10-11
- Checkout: `/Users/pravz_07/.codex/worktrees/346f/Luvani`, starting `21c8bb49`
- Owner: current Codex session, sequential implementation
- Design: [C · Bold rhythm](https://www.figma.com/design/sjAwoGinWQKvhGrWbgMO18?node-id=2-4)
- Landing: user authorised committing and pushing these changes to main on 2026-10-11;
  local landing gate passed. Production activation remains outside this change.

## Outcome and scope

C's typography, palette, six plan questions, plan editor, tutor selection, live
presentation, truthful results, account forms, saved-progress handoff, welcome,
Home and streak presentation use the existing Expo owners. The
[60-frame map](bold-rhythm-frames.md) distinguishes implementation from verification.

Interests persist in the existing draft and closed core first-practice brief.
Travel plus Food & cafés changes both the plan and actual worker scenario to a
restaurant visit during a trip. Level, confidence, focus, duration and voice keep
their existing teaching/voice owners. Plan editing commits all six answers.

There are 24 bundled Rive scenes and matching static vectors, including varied
cloud-led illustrations and the user's later soft-gradient sphere. Artwork loops
continuously while visible; reduced motion/background/hidden screens use stills.
Buttons have accepted-action haptics, press depth and glints. Progress, presses,
entrances and earned confetti follow events and do not reset with illustration loops.
See [asset provenance and rebuild](../../apps/mobile/assets/bold-rhythm/README.md).

Later user overrides are applied: remove the separate Voice preview block and
its rules, preserve each tutor's Listen action, colour the six tutor cards with
Luvani colours, and replace the ring/bar orb with state-coloured fluid motion.
Only actual input/output activity controls audio amplitude. Synthetic orb controls
are restricted to the development preview.

Loading, offline, empty, reconnect, failed save, provider cancellation and early
exit retain truthful state and recovery. Returning accounts do not replay earned
awards. Resume offers continuation or an explicit fresh plan. The reminder branch
uses the existing time/permission sheet. Hidden retained onboarding artwork stops.

Auth keeps Supabase, native Apple and browser OAuth/PKCE. Provider-approved assets
are used on both forms. Next is explicit, with no typing-triggered focus change.
Resend confirmation is guarded like other requests. Native email links use
`luvani://auth/email`, exact-destination PKCE code validation, the SDK flow slot,
deduplication and listener cleanup. Callback failure uses the existing sheet;
recovery establishes the identity required by the existing password-reset screen.
No callback tokens or provider error prose are logged or displayed.

## Tasks and ownership

| Task | Allowed files / owner | Dependencies | Acceptance and status |
|---|---|---|---|
| T1: design and assets | mobile art, build scripts, this plan / Codex | none | 60 states mapped; 54 design contexts inspected, 164 vector layers exported; six contexts and later motion calls blocked by Figma quota |
| T2: personalisation | core firstPractice, mobile draft/brief/plan / Codex | T1 | Closed interest validation, migration/repair, scenario and saved goals implemented; tests pass |
| T3: presentation | mobile onboarding/auth/Home/theme/assets / Codex | T1,T2 | C presentation and user overrides implemented; phone/tablet browser evidence; native accessibility/motion acceptance remains |
| T4: authentication/live | existing auth and live owners / Codex | T2,T3 | Real seams retained and callback gap fixed; local proofs pass; real guest-to-account provider and vendor sessions blocked below |
| T5: verification | tests, graph, domain docs, evidence / Codex | T4 | Full gate/typecheck/export and focused checks recorded below; no claim of production readiness |

## Verification record

- `npm ci` in this checkout: 902 locked packages installed. No borrowed dependency
  tree; prior untracked `.codex/` preserved.
- Full gate before final email-callback addition: green, 5,116 workspace tests,
  89 shared release/provider proofs, eight SQL verification scripts each replaying
  all 39 migrations. No floors lowered or suites skipped.
- Final gate after callback/plan-editor fixes: green, 5,122 workspace tests,
  89 shared release/provider proofs and all eight SQL scripts replaying 39 migrations.
  Unchanged test-count floors; no skipped suites.
- All six workspace TypeScript checks passed after callback changes. The final
  production web export passed. `git diff --check` and local documentation links pass.
- Focused native-email/parser/listener/settings/navigation checks: 30 passed.
  Plan/source-contract tests: four passed. New asset tests check 24 actual binaries,
  matching fallback vectors, state-machine presence and closed loop endpoints.
- Browser: actual onboarding components exercised with local synthetic service
  fixtures. Selected options, plan edits and travel+café scenario, six coloured
  tutor cards, separate sample playback, compact two-column grid, signup Next
  order, matching passwords, pending lock, failure/retry, confirmation and resend
  were checked. No real account was created in these checks.
- Viewports: 320 × 568, 390 × 844 and 768 × 1024. Tablet plan is centred with no
  horizontal overflow; compact forms scroll. Native keyboard and OS large-text
  scaling remain unverified.
- A 9.37-second browser recording covers the eight-second fluid-orb loop. State
  colours and Pause were checked; Pause removes the live canvas and shows its SVG.
  This is synthetic motion evidence, not a recording of a paid tutor session.
- Knowledge graph refreshed. SQL extraction is incomplete because `tree_sitter_sql`
  is not installed; 78 SQL files are absent. Semantic naming uses available hub
  fallback. Generated graph output is not a substitute for SQL gate proofs.

Earlier gate failures were resolved: initial sandbox socket restrictions; stale
presentation assertions; missing resend guard; complete plan-edit fields; and
callback failure presentation initially violating the existing no-native-alert
contract. The latter now uses the shared Sheet. A strict source contract also required keeping provider construction adjacent to
its prefetch call; the declaration order was restored without changing behavior.
Incoming email-link observation was added to the exact OS-access allowlist; other outbound/permission ownership
assertions remain unchanged.

## Evidence

Browser images and the orb recording are saved in the task's visualization folder;
these are local presentation evidence, not Figma pixel certification or service QA.

- [Tutor colours, 390px](/Users/pravz_07/.codex/visualizations/2026/10/11/01a12b3e-b02b-7e60-a41a-068777838e98/bold-rhythm/tutors-colour-390.jpg)
- [Compact tutor grid](/Users/pravz_07/.codex/visualizations/2026/10/11/01a12b3e-b02b-7e60-a41a-068777838e98/bold-rhythm/tutors-320.jpg)
- [Personalised plan, tablet](/Users/pravz_07/.codex/visualizations/2026/10/11/01a12b3e-b02b-7e60-a41a-068777838e98/bold-rhythm/plan-768.jpg)
- [Signup recovery, compact](/Users/pravz_07/.codex/visualizations/2026/10/11/01a12b3e-b02b-7e60-a41a-068777838e98/bold-rhythm/signup-error-320.jpg)
- [Verification/resend, compact](/Users/pravz_07/.codex/visualizations/2026/10/11/01a12b3e-b02b-7e60-a41a-068777838e98/bold-rhythm/signup-verification-320.jpg)
- [Continuous fluid-orb recording](/Users/pravz_07/.codex/visualizations/2026/10/11/01a12b3e-b02b-7e60-a41a-068777838e98/bold-rhythm/fluid-orb-loop.mp4)

 All 60 frame states are mapped,
but all-frame screenshot comparisons are **not complete**. Figma quota blocked
frames 54–59 and most follow-up motion calls; no plan/seat was upgraded.

## Exact remaining configuration and acceptance

Use an isolated staging Supabase project and local token-server/tutor-agent services.
The existing integration checkout points to the primary Parle project; read-only
checks found email, Google and Apple enabled, email auto-confirm enabled, and no
development branch. It was not used to create test accounts or change settings. Neither Docker nor the
Supabase CLI is available on this host’s PATH, so an isolated local Supabase stack is not
available as a fallback.

Staging setup progress (11 October): `wtexbzuyfersdtiekrvp` is the new
**Luvani Staging** project in `eu-west-1`. Read-only checks confirmed healthy
status, zero auth users and zero public tables. The user reports saving the
localhost and native callback redirects. This checkout now has a Git-ignored,
mode-0600 `apps/mobile/.env` containing the staging URL, its public publishable
key (under the existing `EXPO_PUBLIC_SUPABASE_ANON_KEY` name) and localhost:8787
API address. An HTTPS Auth settings request with that key returned 200: email
enabled, confirmation required, signup enabled. This is connectivity evidence,
not completed sign-in acceptance. The running presentation preview has not been
restarted for real authentication.

The Git-ignored, mode-0600 `.env.staging.local` now contains the user-provided
staging Session pooler URI and database password. Both were saved and verified
without displaying their values; database connectivity has not yet been tested.
Apply the existing 39 migration files through the official CLI to preserve their
original versions; no hosted migration has been applied yet. Afterward verify
history, schema permissions and RLS before exercising account persistence.

Main landing preparation: fetched `origin/main` and confirmed this checkout's
starting revision is its exact tip. Credentials, the editor swap file and local
Codex configuration are excluded from the commit. The existing main CI may publish
a gated iOS preview; no production channel or store release is authorised here.
The fresh pre-push gate passed with 5,122 workspace tests, 89 shared release/provider
tests and all eight database proofs replaying 39 migrations. The tracked-file
secret scan, known-password exclusion check, 36 local documentation links and
whitespace checks passed. Hosted CI and real staging acceptance remain separate.

Remaining non-production configuration (never paste secrets into chat):

1. Mobile public staging configuration is prepared; restart outside synthetic
   screen-preview mode when the database and local API are ready.
2. Token server: matching staging Supabase/service-role configuration, local/test
   Redis and LiveKit credentials using its existing `.env.example` contract.
3. Tutor agent: the same test LiveKit project plus its existing STT/model/TTS vendor
   configuration. Use the current vendor adapters and voice catalogue.

Staging must allow the web origin, `luvani://auth/callback` for provider OAuth and
`luvani://auth/email` for confirmation/reset. Enable email confirmation to test it;
provide a test inbox and Google/Apple test identities on the device. Do not expose
service-role/vendor secrets through Expo public variables. The app uses Supabase's
[PKCE exchange](https://supabase.com/docs/guides/auth/sessions/pkce-flow) and
[Expo SDK 57 link delivery](https://docs.expo.dev/versions/v57.0.0/sdk/linking/).

Real acceptance still includes: email/Google/Apple sign-in, cancellation and cold
restoration; confirmation/reset deep links; idempotent guest adoption and failure
retry; LiveKit admission, microphone, STT, personalised replies and chosen voice;
live typing/voice switch; interruption/reconnect; truthful completion and Home
arrival. A physical iOS/Android build is needed for haptics, permission dialogs,
keyboard, large text, reduced motion, screen reader and background/resume checks.

Production guest admission is deliberately refused by the existing server and
worker because the paid ledger requires an account principal. Enabling it requires
a reviewed guest-principal billing/admission contract, quotes/budgets and release
acceptance. This UI change does not bypass that contract or activate production.

Context: [first live practice](../FIRST_LIVE_PRACTICE.md),
[onboarding](../ONBOARDING.md), [design](../../DESIGN.md), [testing](../TESTING.md).
