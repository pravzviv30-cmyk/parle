# C · Bold rhythm implementation

- Status: implementation present; integration acceptance incomplete
- Updated: 2026-10-11
- Checkout: `/Users/pravz_07/.codex/worktrees/346f/Luvani`, starting `21c8bb49`
- Owner: current Codex session, sequential implementation
- Design: [C · Bold rhythm](https://www.figma.com/design/sjAwoGinWQKvhGrWbgMO18?node-id=2-4)
- Landing: implementation pushed to main as `281c5f97`. Staging verification follow-up
  is in progress locally. Production activation remains outside this change.

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
status and an initially empty database. The localhost and native callback
redirects were subsequently verified in the dashboard. This checkout has a Git-ignored,
mode-0600 `apps/mobile/.env` containing the staging URL, its public publishable
key (under the existing `EXPO_PUBLIC_SUPABASE_ANON_KEY` name) and localhost:8792
API address. An HTTPS Auth settings request with that key returned 200: email
enabled, confirmation required, signup enabled. This is connectivity evidence,
not completed sign-in acceptance. The app has since been restarted for real
authentication, with synthetic preview disabled.

The Git-ignored, mode-0600 `.env.staging.local` now contains the user-provided
staging Session pooler URI and database password. Both were saved and verified
without displaying their values; successful deployment verified connectivity.
All 39 migration files were applied through official Supabase CLI 2.120.0 after a
successful dry run, preserving the original versions. The authenticated connector
captured the complete hosted SQL catalog; the existing strict comparison matched
all migration versions, policies, functions, grants, defaults, indexes and constraints.
Security advisors reported no errors: the 43 service/private policy-less RLS tables
and two authenticated definer RPC warnings match the reviewed existing design.

Live verification initially refused the REST preflight despite that exact SQL
catalog match. F797 reproduces and fixes the search-path rendering mismatch without
ignoring schema fields or weakening ACL checks. All 12 disposable-account Supabase
proofs then passed, including real password sign-in/JWTs, RLS isolation, forged-owner
refusal, anonymous refusal, protected RPCs, concurrency, replay, trial races and
fixture deletion. These do not replace the user's signup/email-link UI acceptance.

The local app is restarted outside synthetic preview on port 8108, with the staging
API on 8792. The staging service-role key is saved only in its ignored server env.
The user approved the existing speech/AI credentials for one short test. A foreign
tutor worker was found, so a separate loopback LiveKit server (7892) and tutor worker
isolate this run. Unlimited development minutes were not copied. The user created
the account through the real Chrome signup form and followed the confirmation email.
Supabase records a confirmed email and one authenticated session after the user signed in.
The user then found a web sign-in focus defect (F798): the native background keyboard-dismiss wrapper immediately blurred clicked inputs. Restricting the wrapper to native platforms restores normal Chrome email typing and password pointer focus. The corrected form accepted real sign-in and the app reached the first coffee scene. The first tutor attempt exposed F799 (local verification discarded the signed session ID); its red/green regression now passes and the real browser obtained a durable 120-second reservation claimed by the isolated worker. The live session then settled with seven learner turns, 102 charged seconds (120 reserved), no checkpoint failure and one durable conversation pack. Chrome displayed the real completion screen with a saved phrase, XP and streak. The user confirmed audible playback. Returning Home and reloading restored the authenticated account and saved practice.

The verifier follow-up passes the full gate: 5,122 workspace tests, 90 shared
release/provider proofs and all eight database proofs replaying 39 migrations.

Main landing preparation: fetched `origin/main` and confirmed this checkout's
starting revision is its exact tip. Credentials, the editor swap file and local
Codex configuration are excluded from the commit. The existing main CI may publish
a gated iOS preview; no production channel or store release is authorised here.
The fresh pre-push gate passed with 5,122 workspace tests, 89 shared release/provider
tests and all eight database proofs replaying 39 migrations. The tracked-file
secret scan, known-password exclusion check, 36 local documentation links and
whitespace checks passed. Hosted CI and real staging acceptance remain separate.

Local staging app, token-server and isolated LiveKit/tutor-agent configuration is
prepared. Hosted Google/Apple providers remain unconfigured. The bounded staging tutor test is complete and all admission limits were restored
to their original disabled values. Production paid admission remains disabled.

Staging must allow the web origin, `luvani://auth/callback` for provider OAuth and
`luvani://auth/email` for confirmation/reset. Enable email confirmation to test it;
provide a test inbox and Google/Apple test identities on the device. Do not expose
service-role/vendor secrets through Expo public variables. The app uses Supabase's
[PKCE exchange](https://supabase.com/docs/guides/auth/sessions/pkce-flow) and
[Expo SDK 57 link delivery](https://docs.expo.dev/versions/v57.0.0/sdk/linking/).

Verified on staging web: email signup/confirmation/sign-in, authenticated reload,
LiveKit admission, microphone, STT, spoken replies in the chosen voice, durable
settlement, completion and returning Home. Remaining external acceptance includes
Google/Apple sign-in, native cold restoration and deep links, password reset,
guest-adoption failure retry, live typing/voice switching and interruption/reconnect. A physical iOS/Android build is needed for haptics, permission dialogs,
keyboard, large text, reduced motion, screen reader and background/resume checks.

Production guest admission is deliberately refused by the existing server and
worker because the paid ledger requires an account principal. Enabling it requires
a reviewed guest-principal billing/admission contract, quotes/budgets and release
acceptance. This UI change does not bypass that contract or activate production.

Context: [first live practice](../FIRST_LIVE_PRACTICE.md),
[onboarding](../ONBOARDING.md), [design](../../DESIGN.md), [testing](../TESTING.md).

Follow-up checks: 12 focused auth-flow tests and mobile typecheck passed. The first post-focus-fix gate attempt was sandboxed and failed the local-listener provider tests; the earlier full gate was green. The subsequent gate with loopback permissions passed after F799. The speech-refinement gate then passed 5,127 workspace tests, 90 shared proofs and eight database proofs, but refused the stale F39 named-test reference; this is being corrected before landing.

The isolated LiveKit server caused cloud turn/interruption detectors to reject local credentials (401); the SDK fell back to local turn detection and VAD. The test therefore verifies STT/model/TTS and durable settlement, not cloud adaptive-interruption acceptance.

## Live speech refinement — 11 October

The user confirmed audible speech, then requested faster replies and better
recognition of beginner French, explicitly keeping GPT-6 Luna on the OpenAI key.
The existing worker already uses `gpt-6-luna`; the observed eight model calls
spent 2,406 output tokens on reasoning. Improve the current path sequentially:

| Owner / allowed files | Dependency | Observable acceptance |
|---|---|---|
| Core recognition helper and tests | none | Context-bound near-sound French repair; unrelated speech, negation, numbers and ambiguous alternatives unchanged |
| Tutor worker conversation and recognition wiring | helper | Same interpreted text reaches screen and brain; current-scene vocabulary reaches recognizer; typed/topic inputs unchanged |
| Brain OpenAI routing and tests | none | Luna live turns omit reasoning work; explicit effort overrides and background activities remain supported; bounded real API probe reports latency and schema validity |
| Mobile transcript/protocol | worker | Interpreted speech is labelled, ordinary turns retain their presentation; browser checks and full gate |

The helper is recognition repair, not an audio pronunciation score or a shortcut
to lesson success. Existing grading, safety and progression owners still decide.


### Authorised parallel review and landing criteria

The user authorised a bounded review/fix loop with routine decisions delegated to
agents, followed by a normal push to main once the implementation checks pass.
The root agent owns shared interfaces, browser integration, this log, the final
gate and landing. Independent reviewers own mobile presentation, token-server
and schema verification, and speech/core recognition plus brain routing. They
must preserve existing changes and cannot authorise themselves to bypass a
credential, paid-service or release control.

Landing requires all reviewer findings resolved with focused proofs, a fresh full
gate, typecheck, web export, checked documentation links and whitespace, secret
scan, browser returning-account/error recovery checks, and a normal fast-forward
push from the current main tip. Production rollout and native/provider acceptance
remain separate; staging admission stays disabled after the bounded test.

The approved synthetic Luna comparison completed two valid requests after the
first four-request script failed during local result integration. The corrected
pair measured 4,696 ms at low effort versus 2,777 ms at none (about 41% lower);
both responses passed the real strict turn schema. This single pair is model
response timing, not phone-audible latency or a broad teaching-quality evaluation.
No additional paid comparison requests were sent in this review loop.


Review findings: mobile F800 resets the readiness shine on each question. The
mobile runtime harness also verifies that only interpreted spoken final messages
receive the interpretation caption, duplicates do not append and partial/typed
messages remain distinct. Backend review found no additional defect: 442 server
tests and 30 focused auth/reservation/catalog tests passed. Browser review checked
selected/disabled states across consecutive onboarding questions, returning Home,
tutor-unavailable recovery, saved practice, typing focus and resumable drill exit.
The speech reviewer rejected broad edit-distance substitution after demonstrating
that it could change valid words; repair now requires conservative sound-fold equivalence or a known current-context confusion.


Final review also replaced Rive’s deprecated plural state-machine option with the
installed runtime’s supported singular option. A transient development Fast
Refresh error (`useAuth outside AuthProvider`) occurred while two Metro previews
and an export were active. Source review found one shared context and a correctly
wrapped Gate; a full reload restored the signed-in account and saved practice.
The exact refresh cause is unproven; no speculative context workaround was added.
The clean reload is the browser acceptance evidence, not the stale hot-update state.


The installed SDK proof now passes against a local fake WebSocket vendor: the
same recognizer reconnects with language `fr`, then sends the current keyterms.
The fixture supplies synthetic silence and cleans up its session and sockets;
initial roomless/no-input and open-event race attempts were repaired before the
passing proof. No provider request or real recording is used by that test.
The active-language callback contains asynchronous failures and offers typing.
A clean final Chrome reload restored authenticated Home and resumable practice.
The final web export and workspace typecheck pass; all 29 changed-document local
links resolve. The final integrated gate is green: 5,135 workspace tests, 90 shared release/provider
proofs and all eight database proofs replaying 39 migrations. Tracked-file secret
scan and staged whitespace checks pass. Graph refresh completed with 15,937 nodes
and 42,819 edges; SQL parser support is unavailable (78 SQL files), so migration
proofs provide the SQL evidence.


All three reviewers have completed and frozen source changes. Speech has 193
focused passing tests, including the installed-SDK WebSocket proof in parallel;
frontend has 42 passing focused tests and a passing mobile typecheck; backend has
442 passing server tests plus 30 focused auth/catalog/admission proofs. Broad
mobile review initially caught a JSX prop-order contract assertion after the
shine fix; preserving the existing prop order fixed it without weakening the
assertion. No additional paid request or new human accent test was run. The
recognition changes have deterministic and SDK transport evidence; real accent
quality and phone-audible timing remain explicit follow-up acceptance.


Landing disposition: all implementation review findings F797–F803 are resolved
with named passing proofs. The user authorised a normal main push after checks;
only explicit reviewed source, tests, docs and generated graph files are staged.
Ignored credentials, the pre-existing editor swap and local Codex files are excluded.
The main pre-push hook will run the full gate again. Hosted CI, production rollout,
Google/Apple configuration and physical-device acceptance are separate outcomes;
none is represented as completed by this commit.


## Remaining acceptance preparation — 12 October

The user requested the remaining work, connected Railway and explicitly chose
“Prepare everything without paid hosting yet”. This authorises preparation and
verification; do not start hosted workloads or buy a plan. Root owns infrastructure
and evidence, the native reviewer owns only generated ignored iOS files and the
isolated build, and the backend reviewer owns the Docker/build workflow seam.

| Task / owner | Status | Acceptance |
|---|---|---|
| Railway project / root | prepared | Private empty Luvani Staging project, staging environment, no deployed service or consumed hosting credit |
| Immutable OCI build / backend and root | in progress | Actual pinned public image inputs, decoder hash, Linux nonroot/network-disabled decoder/native/model checks, provenance and SBOM; no registry publication |
| Native signing / mobile | prepared | This checkout's build succeeds and strict signature verification passes; renewed profile and current native fingerprint recorded |
| Native install and UI / root and human | pending | Install preserves app data; Rive/haptics, reduced motion, permissions and restoration observed on device |
| Updated speech / root and human | pending | Bounded current-worker session; accurate displayed meaning/interpretation, audible reply and truthful completion; admission restored off |
| Hosted API/OTA | held by user choice | Approved paid infrastructure, isolated service dependencies and quote/budget bindings, readiness acceptance, then Expo staging endpoints and native compatible update |

The Railway trial workspace was verified with no projects and $5 trial credit.
An empty private project and a staging environment are prepared; no service,
database, image deployment, public domain or secret upload was started.
The native build includes the installed Rive/Nitro/LiveKit/Haptics/Updates pods.
Automatic signing renewed the Personal Team profile through 19 October 15:11 UTC.
The arm64 Debug binary is signed at `/tmp/luvani-native-derived-346f/Build/Products/Debug-iphoneos/Luvani.app`,
fingerprint `37c2ea50d7d91f8aff5748893a11c8a3e6d18937`. It is a Metro development
build; Apple/push capabilities are omitted only in generated ignored entitlements.

Hosted readiness requires Redis, fresh tutor/practice/maintenance heartbeats and
both tutor and paid admission under production-mode configuration even for staging.
Loopback local env files cannot be published. Exact provider quotes, isolated
LiveKit/Redis/deletion journal, host secret injection, image/ingress acceptance
and native voice proof remain prerequisites; no readiness protection is relaxed.
The static decoder's documented source path is `/ffmpeg`, so the portable build
is being made executable with that layout while retaining digest/checksum checks.


The fresh signed binary installed without erasing app data. Initial launch was
refused by iOS; a second independent comparison found matching app/profile/device
and certificate/entitlements. After the user verified developer trust, launch
succeeded. The user signed in on the iPhone and confirmed that a forced process
restart restored signed-in Home without another password. This accepts native
password sign-in and returning-session restoration, not Google/Apple OAuth.

All five Railway startup configs passed the current official JSON schema using
an isolated pinned CLI validator; no root dependency/lockfile changed. Actual
public-registry Linux/amd64 manifests and the streamed decoder binary/layer hashes
are verified in the local evidence. Decoder executable bytes were inspected but
not executed on macOS. Linux execution remains the required OCI build check.


Preparation verification: full gate passed 5,135 workspace tests, 91 shared proofs
and eight database proofs replaying all 39 migrations. Thirteen changed-document
local links and whitespace checks pass. Graph refresh completed (15,982 nodes,
42,859 edges); SQL parser remains unavailable for 78 files, covered by the database
proofs. The next artifact is an OCI-only GitHub build on the exact review-branch
commit with the reviewed immutable inputs; it does not publish/deploy an image.
Native motion/haptic observation is pending the user's device report.
