# Today: A's morning sky over Today as it ships

- Status: built and verified on `claude/today-sky` (UI-015); lands after the founder sees the after shots
- Updated: 2026-10-31
- Checkout / starting revision: `main` at `d1b216c3` (the live room D merge, with the mascots and the `mascot` palette group). Worktree `Luvani-worktrees/today-sky`.
- Owner / integrator: Opus orchestrator session; builders as named per task
- Existing programme / contract: [DESIGN_PARTNERSHIP.md](../DESIGN_PARTNERSHIP.md) (screen 2); decision [UI-015](../../DECISIONS.md); board "A × Today (chosen)" on <https://claude.ai/artifact/8hQGYBiERChAzbtXjN82Dc> (`project/Mix.dc.html`, with the chunky stat tiles from the founder's comment of 2026-10-31)

## Outcome and scope

Today opens on a stack: a header, a white card of three stats, then cards. After this change it opens on a **sky** that follows the time of day, with the greeting, the profile button and **three chunky stat tiles** in it, and **one hero card** overlapping the sky's foot. The hero is the first stop of Today's path. Under it, the rest of the path is a flat list, then Today's three, Coming up and the week. The icon tab bar is unchanged.

| Removed | Why it can go | Where its job went |
|---|---|---|
| `TabHeader` on Today | The sky carries the greeting and the profile button | `home/SkyBand.tsx` |
| The white `StatRow` card of three `StatTile`s (`game/TodayHero.tsx`) | The tiles become chunky game-style tiles in the sky | `game/StatTiles.tsx` (`TodayStats` keeps every rule of `TodayHero`) |
| The fix card and the scene card as separate cards on the path | The first stop is the hero; the others are rows | `home/TodayHeroCard.tsx`, `RouteRow` |
| Cards inside cards (scene lead, plans, starter, phrase) | A card groups things; it is never a default container | One frame per block |
| "One word all day" (B5) | Direction A: the hour decides Bonjour or Bonsoir | `homeGreeting(firstName, now)` with `greetingWord` |

**Existing seams:**
- `tabs/HomeTab.tsx` owns Today's reads. `game/TodayHero.tsx` reads the game layer and is Home's only caller of `useGame().refresh()` (on focus, F766, and when the day turns): that call must survive in `TodayStats`.
- The lead: `practice/NextTaskCard.tsx` (vivid) picks it with `todayLead` and `sceneOrExplore` (`practice/nextTask.ts`): loading, plans, lapsed, outOfTime, starter, local (offline), scene (`home/MissionHero.tsx` then `today/TodayParts.tsx` `SceneLead`), explore. Tutor unreachable is MissionHero's `heldBack` state (`TUTOR_OFFLINE`).
- The path words: `home/todayView.ts` (`pathStep`, `reviewRow`, `oneFix`, `TODAY_COPY`, `TODAY_CARDS`), `practice/nextTask.ts` `leadStop`.
- Numbers: `game/todayHeroView.ts` (`todayHeroView`, `statTiles`), motion rules `home/homeDraw.ts` + `home/useHomeDraw.ts`, `motion/CountUp.tsx`, `motion/ProgressRing.tsx`.
- Frame: `ScrollScreen bleedTop` + `TopInset` (`layout.tsx`), as MyFrench does; HomeTab and `home/` may not read the safe area themselves.
- Tokens come from `useB()`; every hex lives in `palette.ts`.

**Non-goals:** no change to `LuvaniTabBar` or `tabBarModel`; no sideways rail, no text-only tabs, no mascots (the Cloud mascot is on main since D landed; putting it in the sky is a later follow-up); no change to what any lead does, to the game layer, the quests, Coming up's rules or the week's rules; no new dependency, no Rive.

**Risks:**
1. `TodayHero`'s refresh is load-bearing (QuestsCard goes stale without it).
2. 26 test files pin Today's markup or view models; each is re-pinned to the same behaviour, none dropped.
3. The live room D landed first (`d1b216c3`), so the `sky` group sits beside its `mascot` group, and the evening sun reuses `mascot.cheek` (`#EF8770`) rather than a second copy of the value.
4. `SceneLead`, `StarterContinuation`, `LocalPracticeCard` and `ProfileButton` are shared; changes keep their defaults and name the blast radius.

**Decisions:** UI-015.

## Screens and states

Top to bottom, at 375 (320 in brackets where it differs):

1. **Sky band.** Full-bleed under the status bar and to the screen edges, light status bar content.
   - **Ground, disc and chip** from `skyView(hour, mode)` (table below). Morning 05-12, afternoon 12-18, evening 18-22, night 22-05. A sun disc 05-18, a moon (crescent) 18-05, partly off the top right edge.
   - **Two clouds**, white at 0.35 and 0.25 opacity, still drawings (`art/sky/`), that drift in once on arrival (`motion/Drift.tsx`).
   - **Greeting**, two lines: "Bonjour," / "Léa." (or "Bonjour." alone with no name), `bType.greeting` in `onBrand`, still. Bonsoir 18:00 to 04:59 (`greetingWord`).
   - **ProfileButton** at the top right, a 44pt disc on the sky's chip with the `onBrand` glyph, same label and route.
   - **Three stat tiles** in a row, 8pt apart (below).
   - **Nudge** (only while a streak runs and today is open, `homeNudge`): one line in `body` `onBrand` under the tiles.
   - The sky's foot is padded so the hero overlaps it.
2. **Stat tiles** (founder, 2026-10-31). Each a `Press` (light haptic, one spoken label, `minHeight: HIT`):
   - `card` fill, `radius.stat` 18, a 4pt lip under it in the sky's `lip` colour (a View, not a shadow).
   - A 38pt coin and, beside it, a number in `bType.stat24` (ExtraBold 24/26) over a one-word label in `bold11`-size `muted` (existing token at that size; the build names it).
   - **Streak:** flame (`BArt flame`) on `butter`, dimmed while today is open. "3" / "days" ("1" / "day"). No run: "Start" / "today" (founder, 2026-10-31). Opens Streak. The flame pops once when today's streak ticks.
   - **Goal:** `ProgressRing` in `mint` over a `ring` track on `sage`, filling to the real minutes. "4" with a small "/10" / "minutes". Under a minute: "<1" with "/10" (founder, 2026-10-31). No goal: a clock and "6" / "minutes". Opens Streak.
   - **Level:** `StarMark` in `sun` with a `sunDeep` edge on `lavender`. "2" / "level". Opens MyFrench.
   - Spoken labels unchanged (`todayHeroView`).
   - **Layout** (`statTileLayout`): side by side at 375; coin above the number at 320, where "minutes" cannot sit beside the coin; three full-width rows at accessibility text sizes.
   - **Loading:** three sky-chip blocks of the tile size. **Unread:** no tiles, never a nought.
3. **Hero card**, overlapping the sky: `card`, radius 28 (`radius.feature`), padding 16/18, a 2pt `line` lift. Exactly one of:
   - **Fix** (when `oneFix` has one): "One fix to try" in `link`, "How would you say this in French?" `muted`, the English in `bold20`, the locked note when locked, and "Say it better, then compare" (primary, mic) through the lock seam.
   - **Scene** (`SceneLead` restyled): a 108x84 art tile on `butter`, "Next scene, 2 of 3" in `link`, the title in `stat24`-size bold, "About 3 minutes" `muted`, then Start speaking (primary, 54) and Type instead (underlined link, Speak instead for a typing learner). Checking and tutor unreachable (`heldBack`, with retry) keep their states.
   - **Plans, held (out of time, lapsed), starter, explore, offline (local):** the same words and actions as today, on the hero's ground instead of their own card.
   - **Failed read:** "Your next scene could not be loaded." with Practise today's phrase and Try loading my scenes again.
   - **Loading:** one hero-shaped sand block.
4. **Today's path**, a section title in 20 ExtraBold, then the remaining stops in UI-012 order (fix, scene, phrase, review) without the hero's stop, as flat rows: the rail (small ring stop, 2pt line, ink end dot), a 52pt art thumb on a pastel (radius 16), the words (eyebrow in `link` where there is one, title bold, line `muted`), and a trailing text action or chevron; hairlines between rows.
   - **Scene row** (when the fix is the hero): "Order at a café" / "Next scene, 2 of 3 · About 3 minutes" ›, starting the scene through the same tutor gate.
   - **Phrase row:** "Today's phrase" / the French (`lang="fr"`) / the English, "Say it".
   - **Review row** (only when Review would deal): "Review 4 phrases" / "About 2 minutes", "Practise".
5. **Today's three** (`QuestsCard`): title and "1 of 3 done" outside, one card of rows.
6. **Coming up** (only with an event): title outside, one `lavender` card with the line, Rehearse (primary) and Not now.
7. **Your week in French** (only with evidence): title outside, one `card` with the sentence and See your week.

**Dark mode** (board Tweaks, theme dark). Every value comes from `useB()` or the `sky` group.

| Element | Light | Dark | Contrast |
|---|---|---|---|
| Sky ground: morning, afternoon, evening, night | `#3B2FE0` (brand), `#4B3FF0`, `#2A2390`, `#16123A` (ink) | day `#363064` (heroGround), night `#0D0A1A` | greeting and nudge `onBrand`: 7.9, 6.4, 12.1, 17.8 / 11.9, 19.5 |
| Sky disc | sun `#FFC93C`, `#FFE08A`, `#EF8770`; moon `#EEE8FF` | `#EEE8FF` | decorative |
| Clouds | white at 0.35 / 0.25 | same | decorative |
| Profile chip | `#5A50EA` (violet2), `#6A61F0`, `#433BB0`, `#2E2860` | `#4A4170` (heroChip) | `onBrand` glyph: 5.6, 4.6, 8.4, 13.2 / 9.2 |
| Tile fill | `card` `#FFFFFF` | `card` `#25203D` | number `text` 17.8 / 14.5; label `muted` 6.2 / 9.1 |
| Tile lip | `#2A20B0`, `#2A20B0`, `#16123A`, `#0D0A1A` | `#0D0A1A` | decorative |
| Coins: flame, goal, level | `butter`, `sage`, `lavender` | `heroChip`, `sage` `#233F41`, `lavender` `#322B50` | decorative; the label names the stat |
| Goal ring | `mint` on `ring` | `mint` on `ring` | decorative; the number carries it |
| Hero, rows, cards | `card` on `ground` | `card` on `ground` | existing pairs |
| Status bar | light content | light content | on the sky in both |

The build checks every pair above in `palette.test.ts`; a value that fails is changed and the change logged here.

**Reduced motion** (read live): numbers land on their final value, the ring is drawn full to its fraction, the flame does not pop, the clouds sit at their final place. Nothing else on Today moves.

**Large text:** the greeting wraps, tiles go to three rows at accessibility sizes, the hero's actions stack, rows wrap and never clip. Targets stay at least 44pt.

**Screen readers:** greeting (header), profile, the three tiles (one label each), the nudge, the hero (its header, then its action), the path title, rows, the three, Coming up, the week. Decorative art carries `decorative`.

**Preview keys** (`?preview=today-*`, `ModeScope`): `today-scene`, `today-fix`, `today-plans`, `today-starter`, `today-offline`, `today-tutor-unreachable`, `today-explore`, `today-loading`, `today-failed`, `today-evening`, `today-night`.

## Tasks in dependency order

| ID | Outcome | Owner | Depends on | Allowed files | Status |
|---|---|---|---|---|---|
| T0 | Worktree, baseline, before shots, this spec, UI-015 | orchestrator | none | this file, `DECISIONS.md` | done |
| T1 | `sky` palette group, contrast pairs, `radius.stat`, `bType.stat24`, `art/sky/`, `motion/Drift.tsx`, the pop | `design-system-engineer` | T0 | `palette.ts`, `palette.test.ts`, `theme.ts`, `theme.test.ts`, `art/sky/*`, `motion/*`, `motion/primitives.test.ts`, `DESIGN.md` colour, type and motion rows | done |
| T2 | `skyView`, `homeGreeting(firstName, now)`, `statTiles` reworked, `statTileLayout`, `todayStops`, `TODAY_CARDS` | `frontend-engineer` | T0 | `home/skyView.ts`, `home/greeting.ts`, `game/todayHeroView.ts`, `home/todayView.ts`, their tests | done |
| T3 | Presentational parts: `SkyBand`, `StatTiles` + `TodayStats`, `TodayHeroCard`, `TodayLayout`, `RouteRow`, `SceneLead` restyle, bare lead bodies, `useSceneStart`, phrase row, flattened Coming up and week, `ProfileButton` ground | `frontend-engineer` | T1, T2 | `home/*`, `game/StatTiles.tsx`, `today/TodayParts.tsx`, `home/MissionHero.tsx`, `practice/*` lead bodies, `onboarding/StarterContinuation.tsx`, `daily/DailyCard.tsx`, `profile/ProfileButton.tsx` | done |
| T4 | Compose HomeTab; delete the replaced code; re-pin the 26 test files | `frontend-engineer` | T3 | `tabs/HomeTab.tsx`, `practice/NextTaskCard.tsx`, deletions, tests | done |
| T5 | Preview keys | `frontend-engineer` | T4 | `dev/TodayPreview.tsx`, `dev/OnboardingPreview.tsx` | done |
| T6 | Docs | orchestrator | T4 | `DESIGN.md`, `docs/DESIGN_PARTNERSHIP.md`, this log, `docs/IMPLEMENTATION_EVIDENCE.md` | done |
| T7 | Gate, shots, simulator, fix-verifier, `/push-check`, push, land, handoff | orchestrator | T5, T6 | none | verified; push and landing next |

Acceptance per task is in the approved plan and repeated in each builder's brief: tests for every pure rule (the mobile floor rises), no hex or `rgba(` outside `palette.ts`, Reanimated only in `motion/`, no `fontSize:`, literal widths, safe-area reads or `ScrollView` in `home/` or HomeTab, every re-pinned assertion named in its commit message.

## Execution log

| Date / task | Attempt and changed paths | Check / result | Next action or blocker |
|---|---|---|---|
| 2026-10-30 / design | Board "A × Today (chosen)" drawn; founder picked the mix | Browser pane, light and dark | Build session |
| 2026-10-31 / design | Founder comment: chunky game-style stat tiles (board version 18); this session's answers: "Start" over "today" with no streak, "<1" with "/10" under a minute, the nudge in the sky | Board read at version 1793454188-20ef | T0 |
| 2026-10-31 / T0 | Worktree from `d1b216c3` (D had landed when it was cut), `npm ci`; this spec; UI-015; before shots in `reviews/2026-10-30-today-sky/before/` (4, real Today, offline lead) | Same base gate green at 7,319 (D's landing evidence) | T1 |
| 2026-10-31 / T1 | `sky` palette group (six new values, the rest referenced), `radius.stat`, `bType.stat24`, `art/sky/` (SkyDisc, SkyCloud), `motion/Drift.tsx`, `motion/PopOnce.tsx` (design-system-engineer) | White on every sky ground and chip at least 4.58; mobile 3,901 | T2 |
| 2026-10-31 / T2 | `skyView`, `homeGreeting(firstName, now)`, `statTileView`, `statTileLayout`, `todayStops` (frontend-engineer) | All 24 hours agree with Bonsoir; mobile 3,910 | T3 |
| 2026-10-31 / T3 | Shared `LipTile` (agreed with the drill B v2 session, plus `mintWash`), `TodayStatTiles`, `TodayStats`, `SkyBand`, `TodayHeroCard`, `TodayLayout`, `RouteRow`, `useSceneStart`, SceneLead restyle, flat Coming up and week, `bare` lead bodies | mobile 3,921 | T4 |
| 2026-10-31 / T4 | HomeTab recomposed; NextTaskCard `placement`; TodayHero, StatRow/StatTile, statSm, statTiles, RouteNode/RoutePath deleted; tests re-pinned | mobile 3,923 | T5 |
| 2026-10-31 / T5 | `?preview=today-*` (11 keys) through the same parts; FixHero, TodayFailedHero, TodayLoadingHero extracted; DailyCard's today look and PhraseCard deleted | mobile 3,929; gate green 7,348 | Verify |
| 2026-10-31 / verify | Verifier round 1 REFUTED (scene row dropped the tutor gate's answer; whole cards in rows; one art for every row) and shots showed the clock in place of the ring and clouds behind the tiles; simulator showed "Star/t" breaking. Round 2 HOLDS. Simulator: the status bar unreadable after scrolling, rows squeezed at large text (fixed). Round 3 HOLDS | 45 web shots, no console errors; native at normal, accessibility-large and reduced motion | /push-check |
| 2026-10-31 / push-check | Playwright plugin pass (preview keys and real taps on the canvas build), two push-reviewers and /code-review: PopOnce lost its first pop, the sky went stale across hours, row labels dropped the eyebrow and read French in the English voice, unpressable LipTile labels, untested focus refresh, a synthetic touch-floor count, and dead exports; all fixed. Rounds 4 to 6 found the greeting cap split words, then a flat width estimate failing wide names; replaced by sliding the disc from the measured greeting box, with a vertical-offset test. Round 7 HOLDS. F946 and F947 filed (both predate this change). F934's test title restored | Gate green after bless: 7,360 tests, 0 failing (mobile 3,941) | Push, founder review, land |

## Integrated verification and handoff

- Focused checks: every rule above has tests (mobile 3,941)
- Full gate: green after `gate:bless`, 7,360 tests, 0 failing
- UI / device checks: 45 web shots of the 11 preview keys; real Today on the canvas build; iPhone 17 Pro simulator at normal and accessibility-large text and with reduced motion (shots in `reviews/2026-10-30-today-sky/after/`). Not verified: VoiceOver on device, a physical iPhone, a live tutor session from Today
- Landing disposition: lands on main after every Done-when item passes and the founder has seen the after shots (founder, 2026-10-31)
