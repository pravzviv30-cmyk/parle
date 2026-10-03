# Deletion and supersession ledger

Nothing here is deleted until imports, navigation, persisted data, compatibility reads,
replacement tests, focused tests, and the full gate have been checked.

| Candidate | Status | Replacement/condition | Persisted-data concern |
|---|---|---|---|
| `theme.ts` `shadow.whisper` alias | Done (2026-09-27: focused tests pass, full gate 3,727 green; mobile tsc clean) | 2026-09-27 audit: no production importer or consumer of `shadow`; only the inert declaration remained. `the theme exports no shadow token or retired whisper alias` failed before removal. `the live glow is the only shadow and no source uses the retired whisper` strengthens the source check with no theme exemption; DESIGN.md updated. Neither renamed test was a KNOWN_ISSUES verified-by target. | Styling-only object; no routes, storage keys, persisted fields or compatibility reader. The live microphone glow is retained. |
| `nav/tabSurface.ts` | Done (2026-09-27: focused tests pass, full gate 3,727 green; mobile tsc clean) | 2026-09-27 audit: no production importer or caller of `ACTIVE_TAB_SURFACE` / `ACTIVE_TAB_OUTLINE`; the existing `the bar is flat on paper with a top hairline: no wash, no outline, no chartreuse, no motion` test passed. Navigation route names unchanged; the tab bar draws paper directly. | Pure presentation constants only; no storage keys, serialized fields, compatibility reads or migration. |
| `palette.ts` `accent.feature` alias | Done (2026-09-27: focused tests pass, full gate 3,727 green; mobile tsc clean) | 2026-09-27 audit: sole production consumer was the unused `nav/tabSurface.ts`, deleted above. The palette absence check and emptied source allowance failed before removal; their final tests `the retired feature alias is absent from the palette` and `no source uses the retired accent.feature alias` passed afterwards; DESIGN.md token table updated and palette documentation checks passed. No KNOWN_ISSUES verified-by references either replaced test name. | Pure palette constant; never a route or persisted field. No learner data or compatibility reader removed. |
| `splash/store.ts` and the `luvani.seenSplash.v1` flag | Done | Nothing replaces it: the flag recorded that this install had seen a screen that no longer exists | Audit re-run 2026-08-26 — written by `markSplashSeen`, read by `hasSeenSplash`, sole importer `App.tsx`, never user-scoped, never synced, no reader left. Swept by `RETIRED_DEVICE_KEYS` in `migrateLegacyStores`, ahead of the legacy marker so devices that already inherited still sweep. Proved by `the retired splash flag is removed by the storage sweep` |
| Duplicate pre-auth `SplashScreen.tsx` and retired `WelcomeScreen.tsx` | Unreachable after the five-page first-run flow | One front door, `onboarding/PreAccountOnboarding.tsx`, with the signed-in bypass the gate already had | The pre-account draft holds only the age confirmation and voice choice, then is cleared after profile creation |
| Old name/motivation/cake onboarding pages | Scheduled — the why page goes with F108 | `PAGES` becomes age, name, Meet Luc: age first because it is the gate, name second, one readiness page third | `motivation` stays in `StoredProfile`, in `upgradeStored` and in the sync merge policy — stored records carry it and the profile blob syncs whole; the flow writes `null`. `ageGate` and `needsOnboarding` are untouched, so no returning learner is re-onboarded |
| Four-page `TutorIntro` and seen state | Scheduled — not this phase, and the condition is written down | Two things must be true first: something else must teach the three orb colours, which `tutor/gate.test.ts` pins `TutorIntro` as the only current teacher of (`Amber, it is thinking`), and the `tutorIntro` namespace needs a retirement path | `tutorIntro` is a synced set-union namespace with a registered adopter and a name in the `learner_state` check constraint, so other devices keep pushing it after this one stops reading it. Removing it is a sync-compatibility job, not a screen deletion |
| `goalSteps` namespace | Not a candidate; retirement path recorded at creation | Retiring it is a sync-compatibility job: a synced set-union namespace with a registered adopter and a name in `learner_state_namespace_check`, so other devices keep pushing it after one build stops reading it | Server rows go only via `rollback/202609250001_down.sql` under its interlock; device copies survive until the key leaves `USER_KEY_SUFFIXES`. |
| `tabs/LeaderboardTab.tsx` and its sole `NobodyYet` illustration | Done locally (2 October; focused 116 checks and full gate 3,899 green) | No production importer, route or link remains. The five-tab navigator uses Friends, an unranked list and cooperative challenge. Shared-Monogram proof now follows live Profile; safe-area exemption removed. Unused pen runtime exports retired; empty-barrel proof requires no runtime importers, and the 29-flat-art reachability guard remains. | UI module only; no storage writes removed. Keep username, friends adapter, requests, privacy, challenges, internal XP evidence and compatibility keys for the live Friends product. |
| Duplicate practice presentation/mastery counters | Audit required | One scheduler and evidence model | Review/drill/topic/journal payloads must survive |
| Implicit production mock auth | Superseded | Explicit local-development flag | Local mock accounts remain dev-only fixtures |
| Plain AsyncStorage Supabase bearer | Superseded | Native chunked SecureStore adapter | Failed migration now removes plaintext and requires sign-in |
| File/memory production entitlement authority | Superseded | Atomic Supabase RPC | File store remains explicit local tooling only |
| Non-idempotent two-argument debit RPC | Superseded by migration | UUID session ledger RPC | Drop happens in ordered migration |
| Placeholder/fake payment UI | Do not build | Verified store purchase lifecycle first | No entitlement may originate on client |
| Placeholder legal text presented as policy | Blocked replacement | Reviewed Privacy and Terms | Current UI must continue saying policies are not written |

**Done** here means the audit was re-run against the tree, not that it was run once
when the row was written. Every Done row names the evidence and the test that keeps it
true; a row whose reader is gone but whose key is still on the device is not Done,
because a device-level key survives both account reset and account deletion.

## Notebook final sweep, 2026-09-27

Audit scope: `apps/mobile/src/` imports and JSX consumers, `nav/types.ts` and the root
navigator, raster registry/maps, and the deleted modules' storage dependencies.
None of the objects below owns a persisted key, synced namespace or compatibility
reader. No storage key, route or saved learner record was removed. The `tint`
fields removed from `myfrench/model.ts` are explicitly non-persisted projections.
The welcome-path partition remains live and its four tests remain in
`wall/wallMap.test.ts`; purchase, entitlement and metering implementation is unchanged.

Evidence keys below name executable tests, not aliases:
- **Files**: `retired notebook files and artwork stay deleted` (source-file and all-density absence, production-reference and raw retired-colour scan).
- **Tints**: `no source retains a tint token, role table or tinted primitive`, `the palette exports no retired tint tokens or raw tint colours`, and `the retired tinted wrappers are not exported`.
- **Rows**: `a ledger row is one pressable at 56pt with an ink glyph and no disc, a title, a gloss, meta and a chevron, and it names itself once`; the migrated ContinuityCard, portfolio and weekly-reflection tests retain their routing, state and accessibility assertions.
- **Daily**: `daily cards and the library contain no pictures or scene selection`, `daily French retains all its text and its save and practice actions without a carousel`, and `daily audio leads the French on every card and stays still`.
- **Art**: `every raster scene is decorative and every asset the registry names exists on disk under budget` now pins exactly six place keys, and `every art key the registry names is drawn somewhere and nothing in the folder is unregistered` checks both directions.
- **Wall**: `the retired map and French wall pages have no source, renderer or analytics page`, `no door ever draws more than two pages, or the retired map and French pages`, and `WallPage and wall_page_seen name exactly the same pages`.
- **Motion**: the empty-PENDING motion allow-list test, `decorative scenes are static even when a mounted tab is not focused`, and the three static-header successor tests F418/F427/F428.
- **Momentum**: `nothing renders the retired momentum block, its inline details or the week rail, and no screen draws a days-active count — F440` (file absence, a source walk for every retired name and for a days count outside `progress/momentum.ts`), `the retired week rail is not exported and leaves no mark style behind`, `the Profile card is the one importer of the story, and the rhythm rail names no number` (story importers now exactly `tabs/HomeTab.tsx`), and `Today's one recall action opens the review deck, Practice opens the same deck, and the hero sits outside every count — F438`.
- **Template art**: `the app is built with the brand mark rather than the template artwork` in `app/deviceBuildContract.test.ts` (every app.json art slot reads `./assets/brand/`, the file exists, the store icon is 1024 square without alpha, the adaptive layers keep the safe zone).

The no-tint, no-pending-motion, daily, wall and momentum retirement checks were observed
failing before their corresponding migrations/deletions (the momentum successors were run
red against the tree on 2026-09-27 before the six files were removed). Known-issue
repoints carry dated notes explaining removal rather than pretending the old feature is
still tested. Every row below was verified on 2026-09-27 by the full gate (3,686 tests
green, mobile 1,893) and `npx tsc --noEmit -p apps/mobile` clean.

| Deleted item | Status | Import/navigation and replacement evidence | Persisted-data concern |
|---|---|---|---|
| `components.tsx` TintRow | Done (2026-09-27, gate 3,686 green) | Last consumers ContinuityCard, SituationsCard and HomeProgressDetails use LedgerRow; F569 tinted count is zero. Tints, Rows. | Prop-only wrapper; none. |
| `components.tsx` TintPanel | Done (2026-09-27, gate 3,686 green) | HomeProgressDetails uses Card; retired WallMapPage deleted. Tints, Rows. | Presentation only. |
| `components.tsx` TintDisc | Done (2026-09-27, gate 3,686 green) | No caller remained. Tints; component export slicing follows ProgressDots now. | Decorative only. |
| `palette.ts` tint tokens and TintName, theme re-exports | Done (2026-09-27, gate 3,686 green) | Role tables deleted; derived MyFrench row fields removed. Tints and palette documentation checks. | No serialized schema field. |
| `missions/missionTint.ts` | Done (2026-09-27, gate 3,686 green) | Situations/progress callers migrated; wall map removed. Files, Tints. | Pure mapping. |
| `missions/missionTint.test.ts` | Done (2026-09-27, gate 3,686 green) | Obsolete mapping test superseded by Tints; F362 repointed. | Tests only. |
| `tutor/doorTint.ts` | Done (2026-09-27, gate 3,686 green) | ContinuityCard reads no colour role. Files, Tints, Rows. | Pure mapping. |
| `tutor/doorTint.test.ts` | Done (2026-09-27, gate 3,686 green) | Table-existence assertions replaced by Tints. | Tests only. |
| `practice/madeFromTint.ts` | Done (2026-09-27, gate 3,686 green) | Only retired starterRows retained it; both removed. Files, Tints. | Pure mapping. |
| `practice/madeFromTint.test.ts` | Done (2026-09-27, gate 3,686 green) | Table-existence assertions replaced by Tints. | Tests only. |
| `profile/rhythmTint.ts` | Done (2026-09-27, gate 3,686 green) | No importer remained; FrenchLifeCard already uses a sentence. Files, Tints. | Pure constant. |
| `profile/rhythmTint.test.ts` | Done (2026-09-27, gate 3,686 green) | Palette-role existence replaced by Tints; rhythm sentence tests preserved. | Tests only. |
| `tutor/momentTint.ts` | Done (2026-09-27, gate 3,686 green) | Additional obsolete role table found by no-tint walk, with no importer. Files, Tints. | Pure mapping. |
| `surface/IconRowCard.tsx` | Done (2026-09-27, gate 3,686 green) | AbilitiesCard uses LedgerRow directly; other callers already migrated. Files, Rows. | Props only. |
| `surface/IconRowCard.test.ts` | Done (2026-09-27, gate 3,686 green) | Wrapper forwarding test removed; full LedgerRow semantics retained. Files, Rows. | Tests only. |
| `surface/HeroCard.tsx` | Done (2026-09-27, gate 3,686 green) | No production caller; SceneBrief is the direct replacement. Files and SceneBrief component tests. | Props only. |
| `surface/HeroCard.test.ts` | Done (2026-09-27, gate 3,686 green) | Retired wrapper tests removed; SceneBrief and MissionHero tests retained. | Tests only. |
| `practice/starterRows.ts` | Done (2026-09-27, gate 3,686 green) | No production importer remained; Practice already owns the current starter sound entry. Files and PracticeTab tests. | Derived sample rows only; no pack or deck data deleted. |
| `practice/starterRows.test.ts` | Done (2026-09-27, gate 3,686 green) | Tests of unreachable sample-row builder removed; PracticeTab starter-journey checks remain. Files. | Tests only. |
| `practice/PathNodeRow.tsx` | Done (2026-09-27, gate 3,686 green) | No screen imports it. Current practice rows/navigation remain. Files. | Read-only props; no stored path removed. |
| `daily/DailyCarousel.tsx` | Done (2026-09-27, gate 3,686 green) | No screen imports it; Home renders DailyCard directly, library lists cards. Files, Daily. | Local selection state only. |
| `daily/carousel.ts`, including sceneForDaily | Done (2026-09-27, gate 3,686 green) | Only old carousel and DailyCard art imported it; both dependencies gone. Files, Daily. | Pure tab/swipe/hash functions. |
| `progress/WordScene.tsx` | Done (2026-09-27, gate 3,686 green) | DailyCard no longer imports or draws it. Files, Daily. | Decorative chooser only. |
| `progress/WordOfDayCard.tsx` | Done (2026-09-27, gate 3,686 green) | No screen imports it; DailyCard retains all text/audio/save/practice. Files, Daily. | Read-only props. |
| `progress/wordScenes.ts` | Done (2026-09-27, gate 3,686 green) | Scene chooser and hash removed. Files, Daily. | Decorative key list, not learner data. |
| `progress/wordScenes.test.ts` | Done (2026-09-27, gate 3,686 green) | Rotation suite superseded by picture-free daily checks; F425 repointed. | Tests only. |
| `wall/WallMapPage.tsx` | Done (2026-09-27, gate 3,686 green) | WallScreen already renders only yours/plans. Files, Wall. | Interior page, not a route or store. |
| `wall/WallFrenchPage.tsx` | Done (2026-09-27, gate 3,686 green) | WallScreen already renders only yours/plans. Files, Wall. | Interior page, not a route or store. |
| `wall/wallMap.ts` | Done (2026-09-27, gate 3,686 green) | Only retired map page called it; live welcomePath invariants preserved. Files, Wall. | Read-only projection; saved phrases/completions unchanged. |
| `wall/wallFrench.ts` | Done (2026-09-27, gate 3,686 green) | Only retired French page called it. Files, Wall. | Read-only momentum projection. |
| `wallMap.test.ts` retired projection cases, `wallPages.test.ts` French-page cases | Done (2026-09-27, gate 3,686 green) | Genuine Wall retirement tests replace obsolete row projections; F516/F517/F520 dated repoints. Four live welcome-path cases preserved. | Tests only. |
| `wall_page_seen` map/french variants and WallPage variants | Done (2026-09-27, gate 3,686 green) | Both narrowed together to yours/plans; all doors and analytics agreement tested. Wall. | No historical analytics data rewritten. |
| `welcome-bubbles@2x.png` | Done (2026-09-27, gate 3,686 green) | Registry/map entry removed; onboarding no longer draws it. Files, Art. | Bundled art only. |
| `welcome-bubbles@3x.png` | Done (2026-09-27, gate 3,686 green) | Same audited retirement, both densities checked. Files, Art. | Bundled art only. |
| `onboard-cake@2x.png` | Done (2026-09-27, gate 3,686 green) | No remaining screen use; registry/map entry removed. Files, Art. | Bundled art only. |
| `onboard-cake@3x.png` | Done (2026-09-27, gate 3,686 green) | Same audited retirement, both densities checked. Files, Art. | Bundled art only. |
| `onboard-wave@2x.png` | Done (2026-09-27, gate 3,686 green) | No remaining screen use; registry/map entry removed. Files, Art. | Bundled art only. |
| `onboard-wave@3x.png` | Done (2026-09-27, gate 3,686 green) | Same audited retirement, both densities checked. Files, Art. | Bundled art only. |
| `empty-table@2x.png` | Done (2026-09-27, gate 3,686 green) | Removed last Drill/Review uses; explanation and footer tests preserved. Files, Art. | Bundled art only. |
| `empty-table@3x.png` | Done (2026-09-27, gate 3,686 green) | Same audited retirement, both densities checked. Files, Art. | Bundled art only. |
| `recap-postcard@2x.png` | Done (2026-09-27, gate 3,686 green) | No remaining screen use; registry/map entry removed. Files, Art. | Bundled art only. |
| `recap-postcard@3x.png` | Done (2026-09-27, gate 3,686 green) | Same audited retirement, both densities checked. Files, Art. | Bundled art only. |
| `phrasebook@2x.png` | Done (2026-09-27, gate 3,686 green) | Removed last PhrasebookScreen use; its retained text/audio tests pass. Files, Art. | Bundled art only. |
| `phrasebook@3x.png` | Done (2026-09-27, gate 3,686 green) | Same audited retirement, both densities checked. Files, Art. | Bundled art only. |
| `wall-map@2x.png` | Done (2026-09-27, gate 3,686 green) | Sole drawing was retired WallMapPage; no live screen still draws it. Files, Art, Wall. | Bundled art only. |
| `wall-map@3x.png` | Done (2026-09-27, gate 3,686 green) | Same audited retirement, both densities checked. Files, Art, Wall. | Bundled art only. |
| `art/maps.ts` SCREEN_ART and seven retired registry entries | Done (2026-09-27, gate 3,686 green) | Last three live screen references removed; HERO_ART and six place watercolours retained for plan/missions. Art, Files. | Presentation lookup only. |
| `assets/icon.png` (Expo template) | Done (2026-09-27, gate 3,686 green) | Removed by the lead. `grep` over apps/mobile, docs and scripts finds no reference outside the gitignored `dist/` bundle; `app.json` `expo.icon` reads `./assets/brand/luvani-app-icon-1024.png`. Template art. | Bundled art only; no learner data. |
| `assets/favicon.png` (Expo template) | Done (2026-09-27, gate 3,686 green) | Removed by the lead. No reference; `app.json` `web.favicon` reads `./assets/brand/luvani-app-icon-1024.png`. Template art. | Bundled art only. |
| `assets/splash-icon.png` (Expo template) | Done (2026-09-27, gate 3,686 green) | Removed by the lead. No reference; the `expo-splash-screen` plugin image reads `./assets/brand/luvani-mark-1024.png`. Template art. | Bundled art only. |
| `assets/android-icon-foreground.png` (Expo template) | Done (2026-09-27, gate 3,686 green) | Removed by the lead. No reference; `android.adaptiveIcon.foregroundImage` reads `./assets/brand/luvani-adaptive-foreground-1024.png`. Template art. | Bundled art only. |
| `assets/android-icon-background.png` (Expo template) | Done (2026-09-27, gate 3,686 green) | Removed by the lead. No reference; `android.adaptiveIcon.backgroundImage` is deliberately absent, so the ground colour is the background (the test refuses a background picture). Template art. | Bundled art only. |
| `assets/android-icon-monochrome.png` (Expo template) | Done (2026-09-27, gate 3,686 green) | Removed by the lead. No reference; `android.adaptiveIcon.monochromeImage` reads `./assets/brand/luvani-adaptive-monochrome-1024.png`. Template art. | Bundled art only. |
| SpeakBubbles (`illustrations/scenes/bubbles.tsx`) | Done (2026-09-27, gate 3,686 green) | Already absent from barrel and screens. Files, Motion. | Decorative only. |
| OnboardWave (`illustrations/scenes/onboarding.tsx`) | Done (2026-09-27, gate 3,686 green) | Already absent from barrel and screens. Files, Motion. | Decorative only. |
| OnboardSuitcase (same retired onboarding file) | Done (2026-09-27, gate 3,686 green) | No importer/exporter remained. Files, Motion. | Decorative only. |
| OnboardClock (same retired onboarding file) | Done (2026-09-27, gate 3,686 green) | No importer/exporter remained. Files, Motion. | Decorative only. |
| WordSprout (`scenes/sprout.tsx`) | Done (2026-09-27, gate 3,686 green) | Barrel, chooser and DailyCard art removed. Files, Daily, Motion. | Decorative only. |
| WordKettle (`scenes/daily/kitchen.tsx`) | Done (2026-09-27, gate 3,686 green) | Daily pack has no caller or barrel export. Files, Daily, Motion. | Decorative only. |
| WordCroissant (`scenes/daily/kitchen.tsx`) | Done (2026-09-27, gate 3,686 green) | Daily pack has no caller or barrel export. Files, Daily, Motion. | Decorative only. |
| WordCandle (`scenes/daily/kitchen.tsx`) | Done (2026-09-27, gate 3,686 green) | Daily pack has no caller or barrel export. Files, Daily, Motion. | Decorative only. |
| WordCasserole (`scenes/daily/kitchen.tsx`) | Done (2026-09-27, gate 3,686 green) | Daily pack has no caller or barrel export. Files, Daily, Motion. | Decorative only. |
| WordTeapot (`scenes/daily/kitchen.tsx`) | Done (2026-09-27, gate 3,686 green) | Daily pack has no caller or barrel export. Files, Daily, Motion. | Decorative only. |
| WordUmbrella (`scenes/daily/weather.tsx`) | Done (2026-09-27, gate 3,686 green) | Daily pack has no caller or barrel export. Files, Daily, Motion. | Decorative only. |
| WordCloud (`scenes/daily/weather.tsx`) | Done (2026-09-27, gate 3,686 green) | Daily pack has no caller or barrel export. Files, Daily, Motion. | Decorative only. |
| WordKite (`scenes/daily/weather.tsx`) | Done (2026-09-27, gate 3,686 green) | Daily pack has no caller or barrel export. Files, Daily, Motion. | Decorative only. |
| WordLeaves (`scenes/daily/weather.tsx`) | Done (2026-09-27, gate 3,686 green) | Daily pack has no caller or barrel export. Files, Daily, Motion. | Decorative only. |
| WordSnowflake (`scenes/daily/weather.tsx`) | Done (2026-09-27, gate 3,686 green) | Daily pack has no caller or barrel export. Files, Daily, Motion. | Decorative only. |
| WordPostbox (`scenes/daily/street.tsx`) | Done (2026-09-27, gate 3,686 green) | Daily pack has no caller or barrel export. Files, Daily, Motion. | Decorative only. |
| WordBicycle (`scenes/daily/street.tsx`) | Done (2026-09-27, gate 3,686 green) | Daily pack has no caller or barrel export. Files, Daily, Motion. | Decorative only. |
| WordFountain (`scenes/daily/street.tsx`) | Done (2026-09-27, gate 3,686 green) | Daily pack has no caller or barrel export. Files, Daily, Motion. | Decorative only. |
| WordPigeon (`scenes/daily/street.tsx`) | Done (2026-09-27, gate 3,686 green) | Daily pack has no caller or barrel export. Files, Daily, Motion. | Decorative only. |
| WordLantern (`scenes/daily/street.tsx`) | Done (2026-09-27, gate 3,686 green) | Daily pack has no caller or barrel export. Files, Daily, Motion. | Decorative only. |
| WordShutters (`scenes/daily/street.tsx`) | Done (2026-09-27, gate 3,686 green) | Daily pack has no caller or barrel export. Files, Daily, Motion. | Decorative only. |
| WordSnail (`scenes/daily/garden.tsx`) | Done (2026-09-27, gate 3,686 green) | Daily pack has no caller or barrel export. Files, Daily, Motion. | Decorative only. |
| WordCat (`scenes/daily/garden.tsx`) | Done (2026-09-27, gate 3,686 green) | Daily pack has no caller or barrel export. Files, Daily, Motion. | Decorative only. |
| WordSailboat (`scenes/daily/garden.tsx`) | Done (2026-09-27, gate 3,686 green) | Daily pack has no caller or barrel export. Files, Daily, Motion. | Decorative only. |
| LearnStack (`illustrations/scenes/stack.tsx`) | Done (2026-09-27, gate 3,686 green) | Unexported, unimported retired scene retained the obsolete motion hook. Files, Motion. | Decorative only. |
| StillWriting (`illustrations/scenes/empty.tsx`) | Done (2026-09-27, gate 3,686 green) | Last consumer was deleted PathNodeRow; barrel reachability check caught it. Files, Motion. | Decorative only. |
| `illustrations/useSceneMotion.ts` | Done (2026-09-27, gate 3,686 green) | Remaining NobodyYet mark made static; retired stack removed; no callers. Files, Motion. | Animation state only. |
| `pen.tsx` Moving and Scene layers | Done (2026-09-27, gate 3,686 green) | Static Frame draws retained marks; no moving layer caller. Motion. | Animation state only. |
| `layout.tsx` TitleSwap, TitleSwapRow, titleSwap prop and swapLine style | Done (2026-09-27, gate 3,686 green) | No caller passed a swap; plain accessible Text is the only heading. F418/F427/F428 successor tests and Motion. | Transient animation API, never persisted. |
| DailyCard picture/paused compatibility props | Done (2026-09-27, gate 3,686 green) | Sole picture caller Home now renders the same picture-free card as the library. Daily. | Props only; playback focus handling preserved. |
| `progress/MomentumCards.tsx` | Done (2026-09-27, gate 3,686 green) | `git grep` at HEAD aa29031 found only its definition; no route mounts it and `HomeTab.tsx` has refused `<MomentumCards` since Phase 3. Its four glyphs stay exported for the screens that still draw them. Momentum. | Read-only view of `momentumFrom`; no store, route or key. |
| `progress/ProgressScreen.tsx` (`HomeProgressDetails`) | Done (2026-09-27, gate 3,686 green) | Only export had no renderer: `RootNavigator.tsx` carries no `Progress` route and `HomeTab.tsx` refuses `<HomeProgressDetails`. It was the second permitted importer of `progress/story.ts`; the F233/F561 importer test now pins Home alone. Momentum. | Read-only props; the week story and reflection are still built on Today. |
| `progress/progressView.ts` | Done (2026-09-27, gate 3,686 green) | Sole importer was `ProgressScreen.tsx`; `CAN_DO_LABEL` only re-exported `home/abilities.ts`'s `ABILITIES_LABEL`, which stays. Momentum. | Pure copy and a stamp filter; no persisted field. |
| `components.tsx` WeekRail and its `markDone`/`markWaiting` styles | Done (2026-09-27, gate 3,686 green) | Last live caller was the retired `WallFrenchPage.tsx`; the only other caller was the unrendered `MomentumCards.tsx`. Profile says the week with `rhythmSentence`, Today with `weekLines`. `momentum.ts` keeps `weekRailFrom` for the days fold's own picture, with no drawer. Momentum, F577 repointed. | Presentation only. |
| `progress/momentumCards.test.ts` | Done (2026-09-27, gate 3,686 green) | The F391 test moved whole to `tabs/HomeTab.test.ts` under its own title; F438 has a successor there; F436's test is retired with a dated note on F398/F436/F437/F439. | Tests only. |
| `progress/ProgressScreen.test.ts` | Done (2026-09-27, gate 3,686 green) | F572 repointed to the Momentum ban; its DESIGN.md "Home: greeting" bullet check (Stage 1) went with it and is not re-pinned, leaving that bullet to the docs rewrite. | Tests only. |
| `progress/progressView.test.ts` | Done (2026-09-27, gate 3,686 green) | No ledger entry named any of its five tests; the module it tested is gone. | Tests only. |

Retained deliberately: all six place-watercolour pairs and HERO_ART (the plan and
missions still draw them), the static NobodyYet mark still referenced by social UI,
RewardMark, the live orb, the highlighter and live microphone glow. No TutorIntro
namespace, learner store, authentication path or payment implementation was removed.
`progress/momentum.ts` is kept whole, `momentumFrom` and the four folds included, even
though nothing renders them: PRODUCT.md:108-117 records the days-active rule as still
"held by name in `progress/momentum.ts` and its suite", and F396, F412, F432, F433,
F434 and F441 name that suite. Retiring the model is a product decision for the docs
rewrite, not a sweep.

## Main and preview audit 3 October 2026

The remote and local `main` both started this audit at `2cbea86`, including the
completed Revamp B and UX report work. Older branch names do not select code in
that checkout. `apps/mobile/index.ts` registers one `App.tsx`, and the active root
navigator selects the current tab and screen implementations, including lazy live
screens and native platform variants.

There are also older checkouts on this machine. At audit time the permanent
`Documents/StartUps/Luvani` checkout was on `redesign/notebook`, 22 commits behind
`main`, with unrelated unfinished brain/server/documentation edits. The preview on
8095 served the older `unruffled-brahmagupta` worktree. The open Chrome preview on
8142 served the current `main` worktree, while its old 8089 tab had no listener.
This establishes several possible stale-preview sources; it does not establish
which earlier screen the founder saw. No other session's work, server or branch
was removed. The fresh audit preview on 8173 serves this audit's current checkout
with Metro's cache cleared and visibly renders the six-step Hear it first flow and
its authored teaching example.

The supervisor previously reused any HTTP 200 as its app. F713 now refuses occupied
app ports because neither HTML nor packager status identifies the source checkout.
Its own spawned app still becomes ready on HTTP 200; LiveKit and token-server reuse
keep their existing service checks. The supervisor prints its checkout and revision
and starts Metro with `--clear`.

F715 also fixes the refusal shutdown path: failure status is set immediately,
the three-second SIGKILL fallback remains active, and child handles drain before
exit. Real local child-process tests prove both resistant-service cleanup and a
fatal timeout reporting failure. They failed against the previous supervisor.

### Retired in this audit

| Item | Production and replacement evidence | Data and verification |
|---|---|---|
| `home/AbilitiesCard.tsx` | No production importer or route. Current Home and Progress use the active evidence views; Home already forbids rendering AbilitiesCard. | Presentation only. Keep `home/abilities.ts` and its product tests. F714 retirement regression first failed against the old file. |
| `myfrench/LedgerLane.tsx` | No production importer or route. Progress renders LevelCard and retains its Phrasebook route. | Presentation only. Keep `myfrench/ledger.ts`, review data and the active phrasebook. Same retirement regression. |
| `daily/audioManifest.ts`, 2,957 `daily-kokoro` clips and their README | No production importer. DailyCard and DailyPracticeScreen exclusively resolve the selected tutor through `tutorAudioManifest.ts`. | 42,826,954 bytes of unused pack/README removed. All 2,400 current recordings retained and verified for frozen text, voice, configuration, hash, container and full selected-item coverage. All 2,000 text items remain. |
| `scripts/build-daily-audio.mjs`, `scripts/daily-audio-worker.py` | Only generate the retired generic pack; no other caller. Current paid tutor generation and verification tools remain. | Keep provenance in Git history and existing licence notices. The absence/reference test failed before retirement; the old generic-pack test now verifies actual six-tutor playback coverage. |

### Retained after audit

| Item | Reason it remains |
|---|---|
| Core and brain packages, protocol, graders, metering, services and SQL migrations/rollbacks | Load-bearing runtime and migration history. Age does not determine whether code is obsolete. No runtime change here. |
| Auth, storage keys, compatibility reads, sync merge policies, journal recovery and native/web adapters | Returning learners and other devices still depend on their schemas and platform resolution. The current-state map now correctly records implemented Supabase sync. |
| Signed-in OnboardingFlow, TutorIntro and demo SessionScreen | Reachable fallback/returning-learner paths. They are not duplicate front doors. |
| All 29 flat vector drawings; current tutor/onboarding audio and licence notices | Reachable registrations, manifests or attribution. No current art or voice removed. |
| Old AddFriendsScreen and its UI, ConversationPackCard, PhraseBank, SoundsMap, SituationsCard, FrenchLifeCard and old pen illustrations | Unmounted presentation, with direct source-contract checks and historical issue anchors. Controlled retirement must repoint those checks to live successors before deletion. The old Friends adapter also carries persisted sample data; its storage suffix and sync exclusion need a retirement path. These are not causing the current navigator to select older screens. |
| `purchases/Paywall.tsx` and purchase/restore contracts | Unmounted presentation remains covered by source contracts and a frozen billing-byte guard. The active wall is already central; do not weaken the billing guard as a cleanup shortcut. |
| Pure old projections such as momentum/today/abilities/ledger and welcome-path helpers | Existing named product, issue or compatibility contracts. Remove only with an explicit replacement for those obligations. |
| Documentation, review evidence and Git history | Evidence and recovery, rather than alternative executable app versions. No history rewrite, reset, branch purge or worktree deletion. |

Baseline verification: exact-lockfile isolated `npm ci`, complete gate **4,232 tests**,
and a real web export passed before changes. Focused final checks **31 tests** passed,
including preview refusal, retirement and unchanged current-audio hash evidence.
Final full-gate, export, online dependency-audit and independent review results are
recorded below. This audit does not certify live vendor voice,
store transactions, hosted sync or physical iOS/Android behaviour; existing acceptance
holds remain in `UX_ACCEPTANCE_REVIEW.md`.

Final verification: **4,237 tests, zero failures**, with all six workspace count
floors intact and typecheck, secret scan, ledger and agent-pin checks green. The web
export succeeds; both main and lazy live-screen bundle hashes match the baseline,
consistent with removal of unimported app source and assets. A driven fresh preview
renders the current onboarding and teaching example with no console errors. The
online dependency audit passes under the existing recorded decisions: zero critical,
21 high and 12 moderate inherited advisories, with accepted roots recorded in
`package.json`; this is not a zero-vulnerability claim. No dependency version changed.
Fresh independent GPT-6 Sol review returned LAND after the shutdown correction.
The code graph was refreshed and its wiki exported; AST-only graph tooling reported
missing SQL extraction support, so import/route inspection and executable checks,
rather than the graph alone, establish the deletion evidence.
