# C2 onboarding and M2/M3 main app implementation

- Status: subscription, Explore and account-surface revision implemented and locally verified; external store/live release acceptance remains
- Updated: 2026-10-18
- Checkout / starting revision: attached worktree `3957/Luvani`, `21c8bb49`
- Owner / integrator: root Codex session
- Existing programme: [design](../../DESIGN.md), [runtime map](../CURRENT_STATE_MAP.md), [onboarding](../ONBOARDING.md)

## Outcome and scope

Implement the approved C2 onboarding and M2/M3 main app structure, varied cloud-family artwork, matching light/dark surfaces, native layered motion and Remotion onboarding review studies. User authorised implementation and several independent agents on 18 October. M4 is rejected and is not a design source.

Extend RootNavigator, existing conversation packs/saved text, practice scheduling, profile and motion engine. Preserve server admission, billing, consent, data scope, pedagogy and earned evidence. Prototype fictional history and billing fixtures are not production data. Remotion is the timing/design authoring surface; native interaction stays in the existing animation engine.

## Screens and states

Five main destinations: Home, Explore, Speak, My French and Progress. Existing focused learning routes remain above the tabs; legacy Practice and MyFrench route identities remain compatible. Explore searches actual authored content, opens existing working activities, and adapts suggestions without awarding a level. My French separates conversation history, practice and saved material, with explicit source links and repeat conversations. Onboarding retains draft, identity, age/consent and preference handoff. New/returning, loading, empty, unread/error, offline, denied microphone and reduced motion states remain distinguishable. Dark mode follows the device with an explicit display choice. Safe areas, keyboard, large text and 44-point controls govern responsive layout.

## Tasks in dependency order

| ID | Outcome | Owner | Depends on | Allowed files | Status |
|---|---|---|---|---|---|
| T1 | Shared main appearance and UI, five-tab navigation | root | none | palette/theme, main/, nav/, App.tsx, docs | complete |
| T2 | Exact native illustration geometry and bounded motion | native_art_motion | T1 palette interface | illustrations/, motion/Illustration*, assets/main-illustrations/ | complete |
| T3 | C2 onboarding presentation and motion | onboarding_implementation | T2 where reused | onboarding/, assets/onboarding-art/, existing profile/name preference owners | complete |
| T4 | My French, source and conversation practice | conversation_library | T1 UI interface | practice/, conversationPacks/, MyFrenchLibraryTab | complete |
| T5 | Home, Explore, Speak and Progress | root | T1/T2/T4 interfaces | tabs except T4 ownership, main/, nav/ | complete |
| T6 | Onboarding Remotion study | root | T3 exact art | artifacts/m2-m3-motion-2026-10-18/motion-studio/ | complete |
| T7 | Independent review and integrated app verification | fresh reviewing agents + root | T1–T6 | focused corrections within owners, docs | local/native fixture acceptance complete; physical/live/store release checks open |
| T8 | Build attached checkout's native iOS dev client and install on compact simulator | ios_build | T1–T7 | ignored generated ios/, temporary build outputs only | done |
| T9 | Native onboarding/main walkthrough, keyboard, themes, motion and responsive fixes | native_flow_audit + ios_consumer_qa + root | T8 | affected existing mobile presentation owners, focused tests, this plan | done within documented fixture boundaries |
| T10 | Research useful Explore collections/modules and implementation order | explore_research | current content inventory | research evidence only; no speculative feature implementation | done |
| T11 | Seven-day monthly/yearly store offers, genuine annual comparison, configuration checklist | paywall_scope + root UI | user answers and official store rules | purchases/contract + native adapter, wall/, docs/REVENUECAT_SETUP.md | done locally; store configuration/sandbox external |
| T12 | Real Explore collections, ability-appropriate free samples and clear paid access | explore_scope + root access/navigation | existing content IDs and T11 access seam | main/explore*, tabs/ExploreTab, purchases/exploreAccess*, nav/ | done |
| T13 | Profile, Settings, tutor memory and sheets match M2/M3 | profile_settings_scope | existing appearance owner | profile/, settings/, ProfileTab and narrow shared display/header seams | done |
| T14 | Integrated flow, access, native layout and regression verification | root + independent agent review | T11–T13 | focused owner repairs, this plan and domain docs | done within stated native/fixture boundaries |

### Subscription and collection revision contract

User confirmed seven days, Starter/Max, a limited free experience and no existing
store/provider setup. Reuse server entitlements and metering. The non-purchase
introduction remains thirty minutes once; a confirmed store trial retains the
existing week-of-plan allowance (Starter forty-two minutes, Max seventy).
Prices remain store facts; pricing comparisons and margin research inform the
setup checklist, not hardcoded production offers or unprovisioned prices.

Explore remains browsable. New conversation collections have permanent free
samples across all three authored pitches, with remaining scenario starts
included in either active paid tier and its store trial. Existing local phrase,
word and guided mission practice, saved personal learning and earned progress
stay available. This catalogue presentation gate never grants server time or
claims to secure bundled content against extraction. Every generated tutor
session still passes the existing server admission and metering owners.

New users finish onboarding onto Home; the existing first-run wall may then
open once when Home is visible, store offers exist and the server confirms no
paid plan. The wall is dismissible. Unread billing and unavailable store are
explicit recovery states, never a guessed subscription or fictional checkout.
Paid, returning, account-change and stale async responses must be checked.

Profile/Settings cover loading, empty, error, cancelled edits, denied permissions,
billing unavailable, keyboard and sheet exits in both themes. Existing account,
privacy and deletion operations keep their callbacks and confirmations.

Acceptance: real user data drives suggestions/history/progress; every visible action reaches a working destination; original conversation sources and replay/practice paths remain connected; no new policy store or navigator; animations stop on blur/background/reduced motion; light/dark main layouts and onboarding journey inspected in the running app; focused tests, typecheck, production web build and full repository gate pass. Native live audio and paid store checks are reported separately if their external prerequisites are unavailable.

## Execution log

| Date / task | Attempt and changed paths | Check / result | Next action or blocker |
|---|---|---|---|
| 2026-10-18 / discovery | Established attached checkout and pre-existing edits; read scoped instructions, runtime map and exact Expo v57 reference. Read approved Figma main pages with screenshots. | Existing navigator has four tabs; conversation packs and consented saved text are separate owners. | Extend existing seams; no M4. |
| 2026-10-18 / parallel ownership | Dispatched onboarding, native illustration and conversation-library agents with disjoint writes. Root owns shared interfaces and integration. | Interface agreement in agent messages. | Implement dependency order, then independent reviews. |
| 2026-10-18 / integration | Implemented shared appearance, five-tab structure, exact cloud-family art, C2 onboarding, source-linked conversation library/practice, real catalogue Explore, level-dependent conversation support and store-owned paywall. | Focused owner suites passed. Mobile typecheck and web export passed. | Independent consumer and race-condition review. |
| 2026-10-18 / independent critique | Fresh consumer walkthrough and integration review found stale async start/appearance races, obsolete Settings copy, Explore punctuation and a fixed beginner offline fallback. Corrected existing owners; deferred-promise race tests and mutation proof confirmed request fencing. | Actual 390 × 844 and 320 × 740 walkthrough passed, including leave/resume at exact phrase two. | Final name and paywall inspection. |
| 2026-10-18 / durable name | Persisted optional pending-name field in existing profile for cold verification/first OAuth profile loads. Name writer clears it with the winning causal clock; legacy accounts skip. | 307 onboarding/profile/component tests; 17 brain merge tests; independent 69-test review all passed. | Full gate. |
| 2026-10-18 / final visual review | Phone-sized dark paywall trial and comparison inspected; corrected primary CTA, step indicator and comparison close contrast. Profile and Settings inspected in both themes. | Screenshots in runtime-qa; no purchase/deletion or real account action performed. | Native/store release acceptance remains external. |
| 2026-10-18 / native acceptance request | User requested actual iOS simulator testing and fixes plus Explore module research. Native build agent generated ignored iOS project from this checkout; onboarding agent owns first native walkthrough, root owns main flow and integration; research agent is independent. | Xcode 26.6, iOS 26.5 simulator runtime and CocoaPods available. Compact device is iPhone 13 mini. | Build/install, inspect before editing, repair verified defects and recheck affected paths. |
| 2026-10-18 / native build | Fresh generated-workspace Debug build installed as com.luvani.app on iPhone 13 mini, UDID 5201F85D-5FEC-44EB-BACA-7F3D3E57988A. This checkout supplies Metro on 8085. | Native build succeeded; no tracked package/config changes. Build log /tmp/luvani-c2-ios-build.log. | Native UI checks. |
| 2026-10-18 / Explore discovery | Research inventoried 500 existing authored conversation starters across ten themes. Corrected misleading collection-to-friends routes; real collections remain a proposal. | F787 named route contract failed before repair; 25 focused tests passed after. Research: artifacts/explore-native-qa-2026-10-18/explore-research.txt. | Verify native doors and discuss collection proposal. |
| 2026-10-18 / native signing | Unsigned simulator build surfaced an Expo notification keychain entitlement error. Rebuilt the same generated project with Xcode ad-hoc simulator signing, verified its embedded application identifier and signature, reinstalled and cold-launched. | Signed native build succeeded; fresh launch has no notification entitlement toast. No tracked native/config/dependency change. | Continue native QA on this signed client. |
| 2026-10-18 / native owner fixes | Native paywall constant read now comes directly from the neutral contract; existing billing implementation and money hashes retained. Repaired draft-aware Back, account-name keyboard footer and authored artwork clipping. | 123 startup/billing/paywall tests, 65 onboarding tests; native name/Back/art confirmation captured. | Exact final source reload and remaining native motion/main confirmation. |
| 2026-10-18 / main native fixes | Main consumer reproduced topic-grid frame ownership, dark conversation guidance, recovery and utility-theme gaps, section scroll retention and focused form keyboard issues. Disjoint presentation owners repaired them without changing grading, consent, admission or entitlements. | Domain suites passing; focused keyboard-group implementation and native recheck in progress. | Native final pass, full gate and final all-platform export. |
| 2026-10-18 / integrated attempt | First native-QA gate ran all 5,204 tests, 89 shared proofs and all eight SQL replays. One legacy assertion prohibited the newly approved shared cloud recovery art, and F805 correctly remained open pending native keyboard confirmation. Exact allowed artwork owner/conditional motif/theme assertions replace only that obsolete prohibition; no purchase hash, test floor, skip or unrelated guard changed. | Six focused shared-art/recovery checks pass. Production all-platform export passes. Native completion reached the actual five-phrase result and queued streak takeover. | Compact prompt reflow and celebration status glyphs found by final native pass are being fixed before the final gate. |

## Native acceptance boundaries

This pass executes the actual Expo iOS client built from this checkout on iPhone 13 mini / iOS 26.5, using the isolated developer learner and inert onboarding account forms. Real components, native layout, software keyboard, device voice samples, local conversation practice and offline failure recovery are exercised. The sample account is labelled and cannot transact or create an account. The absent local tutor server deliberately exercises recovery; it does not prove live microphone/LiveKit conversation success. Store sample offers prove layout, selection, comparison and failed restore handling, not a real purchase or successful restore. Native pointer scrolling is currently unavailable through the host automation surface; accessible controls can be exercised, but native swipe gestures require separate acceptance. These boundaries must remain visible in the final handoff.

## Previous native acceptance, before the subscription and collection revision

- Final full gate is **green** on the final source: **5,207 workspace tests**,
  **89 shared release/provider proofs** and **eight SQL replay checks** over all
  **39 migrations**. Log: `/tmp/luvani-native-qa-gate-landing.log`. No tests were
  skipped, assertions weakened, floors lowered or purchase hashes re-pinned.
  Earlier attempts correctly retained the open keyboard defect until native
  confirmation. The obsolete no-cloud recovery assertion now strictly names the
  approved shared owner, conditional motif and selected theme.
- Mobile TypeScript and final production exports for **web, iOS Hermes and
  Android Hermes** pass in this checkout. Export:
  `/tmp/luvani-native-qa-export-landing`; log:
  `/tmp/luvani-native-qa-export-landing.log`. Own locked dependencies were
  installed with `npm ci`. The earlier Remotion lint/typecheck remains valid;
  its source was unchanged in this native QA pass.
- A fresh signed Debug native client was built and installed from this checkout.
  Actual iPhone 13 mini native walkthrough covered onboarding, plan edits,
  tutor sample playback, name and inert account form states, all five main tabs,
  search, source-linked practice, exact phrase-two leave/resume, all five phrase
  completions, real local earned result/celebration, offline gates, Profile,
  Settings and store-fixture plans/trial/comparison/failed restore.
- Native fixes are tracked in the one ledger, F787 and F797–F807. Final native
  confirmation includes full question/help/answer/Check above the software
  keyboard, full custom rehearsal input and counter, Done preserving the draft,
  uncropped cloud art, retained answers on Back, a 2×2 Explore grid, dark guidance,
  section header reset, selected-dark pre-room recovery and reachable utility
  canvas states. Root created an ordinary example goal through the isolated learner’s own
  tutor-memory form, then confirmed the populated Goal Step in native Progress.
  This adds only a test learner preference, never earned goal evidence.
- Actual iOS Reduce Motion on/off and background/return were exercised. Native
  normal/reduced motion clips were captured and decoded. Larger phone reading
  size reflowed, then the exact original size was restored. The signed client
  also ran on iPad Pro 11-inch (M5); onboarding and main Explore fit correctly.
  The test tablet was returned to shutdown. The original iPhone remains running
  at **Dark Explore**, default reading size, portrait and Reduce Motion off.
- The already-consumed first-day takeover was additionally verified using a
  temporary visual-only driver of the **actual Takeover modal** over Dark.
  Dark status icons on paper and restoration of light icons after closing were
  observed without publishing a celebration or writing XP/history/seen facts.
  The driver was removed; MainAppPreview was restored byte-for-byte to SHA-256
  `876f78ba63b41e24a9494801cfadd5e6b21807bdb8f532789421a40a308b05be`, and the standard
  source reloaded. No temporary driver remains in the final source.
- Evidence/report: [native acceptance](../../artifacts/explore-native-qa-2026-10-18/native-acceptance.txt),
  [Explore research](../../artifacts/explore-native-qa-2026-10-18/explore-research.txt).
  Actual native images and videos are in their `native-main/` and
  `native-onboarding/` sibling folders. Developer fixture overlays are identified
  in the report and do not exist in production.
- Final documentation links: 18 local targets resolved. Final `git diff --check`
  passes, and the temporary native status probe is absent from the source.
- Graph refreshed on the final source: **16,571 nodes, 43,828 edges, 692
  communities**. Log: `/tmp/luvani-native-qa-graph-landing.log`. The tool still
  omits 78 SQL files because `tree_sitter_sql` is unavailable, and 714 files yield
  no nodes. Existing labels are retained where matched; renamed communities use
  hub names. Passing SQL replays and link checks provide separate coverage.
- Remaining release acceptance: real verified auth/OAuth, live microphone/LiveKit
  tutor success, successful native purchase/restore, physical-device animation
  performance, VoiceOver/TalkBack, native touch gestures and a broader device
  matrix. Host pointer gestures are unavailable; native accessible controls and
  UIKit auto-scrolling were exercised. Store/account fixtures remain explicit.
- Landing disposition: reviewable implementation and native evidence remain in
  this attached checkout, **uncommitted**. No merge, purchase, publication or
  deployment was performed. Pre-existing edits and research artifacts preserved.
  At this checkpoint the new Explore collections were still a proposal; T12
  subsequently implements the reviewed first set as recorded below.

## Subscription, collection and account-surface handoff

- User confirmed seven days, retained Starter/Max and requested a lasting free
  experience plus exact store setup. A further design correction explicitly
  requested a Headspace-like segmented toggle and a more spacious timeline.
  Updated owners: `wall/WallPlansPage`, new `WallPeriodSwitch`, store contract
  and adapter, Home-first App/firstRunWall seam, collection catalogue/detail and
  Explore, scoped Settings/Profile/Tutor Memory appearance and shared display
  editor, navigation and narrowly scoped header colours. Existing product IDs,
  grants, metering, personal review and account operations retain their owners.
- Research checked current primary Headspace/Apple/RevenueCat sources and UK
  competitor catalogue listings. Firecrawl credit exhaustion required the
  official web fallback. The current Headspace English page does not establish
  a permanent free in-app Basics tier. Luvani's thirty lasting samples across
  themes/pitches are an explicit product decision. Competitive price proposals,
  modelled annual exposure and exact four-product/provider setup live in
  [REVENUECAT_SETUP](../REVENUECAT_SETUP.md); no store price was published.
- Disjoint agents delivered content, account surfaces and billing, then reviewed
  one another. F808/F809 capture the repaired annual-window interpretation and
  lifecycle/navigation races. The actual extracted App callback proves two Home
  frames and no stale wall after Home → Explore → Home. Collection checkout
  returns to its source scene rather than starting generic conversation.
- The first full attempts found obsolete UI assertions for the old billing
  cards, fixed light headers, automatic first-scene entry and retired art.
  Assertions now retain durable writes, real price authority, accessible checked
  states and recovery while testing the approved design. Punctuation allowlist
  shrank; money hashes changed only for the three intentionally reviewed files,
  with exact independent acceptances and dated rationale in the guard.
- A later complete run passed all workspace tests but exposed a pre-existing
  calendar-minute assumption in `verifyDataBoundaries.mjs`. The unchanged SQL
  diagnostic demonstrated correct 48→49 same-minute versus 48→1 new-minute
  admission, and no rejected-write consumption. The proof now captures the full
  accepted quota row after the valid write, restores authenticated role and
  verifies that every rejected write leaves the full row unchanged. Existing
  burst/CAS, byte, RLS and quota limits remain; production SQL is untouched.
- **Final full gate is green:** 5,237 workspace tests, 89 shared release/provider
  proofs and all eight SQL checks replaying 39 migrations. Log:
  `/tmp/luvani-subscription-complete-gate.log`. No skips, lowered floors or
  weakened purchase/entitlement assertions. Mobile TypeScript passes. Final
  web/iOS Hermes/Android Hermes export passes at
  `/tmp/luvani-subscription-landing-export`.
- Actual iPhone 13 mini confirmation: expanded Explore, ten-theme details and a
  relevant free sample, dark Profile/Settings, shared Display changing to Light
  and back, and final monthly/yearly trial selection/price/annual saving/dismissal.
  Initial oversized paywall art hid the switch below the compact viewport;
  final compact art/title/overview places the selector visibly above the fixed
  footer. The live web preview additionally displays the complete premium
  three-row connected timeline. Current screenshots and acceptance boundary:
  [acceptance](../../artifacts/subscription-explore-2026-10-18/acceptance.txt).
  Pointer scrolling remains unavailable on the native automation host; native
  accessible controls and web scrolling were checked. No successful purchase,
  restore, live tutor or real identity operation is implied by these fixtures.
- MainAppPreview remains byte-identical to its pre-revision fixture, SHA-256
  `876f78ba63b41e24a9494801cfadd5e6b21807bdb8f532789421a40a308b05be`.
  No temporary visual driver or additional earned evidence was introduced.
- Final graph refresh: 16,659 nodes, 44,223 edges, 672 communities; log
  `/tmp/luvani-subscription-complete-graph.log`. SQL parser remains unavailable
  for 78 files and 714 sources yield no nodes; executable SQL proofs supply
  separate coverage. Documentation local links and diff hygiene pass.
- Landing: reviewable and uncommitted in this attached checkout. No staging,
  merge, deployment, store configuration or transaction occurred. App Store and
  RevenueCat setup, real verified auth/live tutor, sandbox purchase/restore,
  physical performance, native swipe/assistive technology and broader device
  acceptance remain before production release. The automatic production offer
  requires real purchasable products and known server standing; it remains
  closed while these external prerequisites are absent.
