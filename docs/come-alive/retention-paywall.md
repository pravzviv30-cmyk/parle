> Detailed draft spec, written 2026-10-04 and checked against `47fbc2ea`. Where it disagrees with
> [README.md](README.md) Parts 1, 6 or 7 (decisions, resolutions, gate traps), README wins. Read the
> matching review in [reviews/](reviews/) before building from it.
>
> **Superseded in part (2026-10-20, D23 and D24):** the one-off 30 free minutes are now a 5-minute weekly taste, the wall opens on each launch and on return after 30+ minutes away (`wall/launchWall.ts`, which replaced `onboarding/firstRunWall.ts`), and a free learner holds one streak freeze. See README Part 1.

## Retention surfaces

> **Superseded in part by founder decision D22 (6 October): there are no chests.** Every chest in this spec (the chest drawing, chest XP and claim, the quest-chest takeover and its seen key) is gone; finishing all three quests shows one quiet line, "All three quests done today.", with the quest sound. README Part 1 and Part 6 win.

This section covers Home, the Progress tab, Profile, reminders and notifications, the paywall, and widgets. Everything here reads from the game layer (`useStreak`, `useQuests`, `useXp`, `useLevel`, `useBadges`). It draws through the motion primitives, `icons/`, `celebrate/` and `sound/`. None of the screen files below import Reanimated directly. A screen arranges primitives; only the primitives animate. That keeps the motion allowlist (`motion.test.ts:295`) growing by primitives only, and keeps `HomeTab.tsx` free of the word `Animated`, which a ledger-pinned test still forbids (`tabs/HomeTab.test.ts:121`).

### 0. Things the code says that change the plan (checked against source)

| # | Finding | Evidence | Consequence |
|---|---|---|---|
| 0.1 | Home re-reads all its storage **every 60 s** while focused, and each re-read sets `hero` to null, which flashes the skeleton | `home/useHomeRefresh.ts:9` bumps `revision` every 60 s; `tabs/HomeTab.tsx:100,130` (`setHero(null)`, deps `[profile, revision, readAttempt]`) | Fix this before adding any motion, or Home will re-run its entrance animations every minute. Change `useHomeRefresh` to bump only when `localDayKey(Date.now())` changes, and keep the `AppState` foreground bump. No test pins it. |
| 0.2 | A finished drill with nothing clean, or a review with nothing recalled, records **no practice day** | `progress/activity.ts:246` returns when `xp <= 0`; `drillXp` and `reviewXp` can be 0 (`packages/core/src/levels/levels.ts:108-115`) | This breaks founder decision 3. The game layer has to record a day for every finished sitting, whatever the XP. Home's flame must read that record, not `activeDays` alone. |
| 0.3 | Daily phrase practice records a **date only**, with no `activeMs` | `progress/activity.ts:348-364` (`recordActiveDay`) | The goal ring would not move after a daily phrase practice. The game layer must log that practice's active time. Until it does, the ring is honest but feels broken. |
| 0.4 | The "no suppression" rule is held by **three** pinned tests, not one | F226 `reminders/reminder.test.ts:135` (zero-argument content, no digits, no clock); F227 `:228` (reminders/ may not import progress/ etc.); F230 `reminders/schedule.test.ts:220` (bans `DATE` triggers, `new Date`, and any trigger that is not a daily repeat) | All three are superseded in §4.1. `F241` (open P2, `KNOWN_ISSUES.md:3775`) closes as superseded. |
| 0.5 | The default-tutor bug | `reminders/reminder.ts:62,158` builds `REMINDER_BODY` from `TUTOR_NAME`; `tutor/tutorName.test.ts:83` allowlists `reminders/reminder.ts` and says the list "may only ever shrink" | Fixing it empties `NO_LEARNER_IN_HAND`, and the stale-allowance check then requires the list to be empty. |
| 0.6 | Nothing handles a notification tap; a navigation ref and a queued-route pattern already exist | `App.tsx:291` `useNavigationContainerRef`, `:293-298` `openPendingInvite`, `:514-517` `onReady`. Only `reminders/schedule.native.ts:92` imports expo-notifications, and the test requires that | The tap listener goes in `schedule.native.ts` and is consumed in `App.tsx`. |
| 0.7 | The free "trial" is 30 metered minutes, not a store trial | `packages/core/src/metering/meter.ts:48`; `purchases/contract.ts:21-26` (`StoreProduct` has no intro-offer field); `services/token-server/src/billing/revenuecat.ts` handles no trial or `period_type` (grep finds nothing) | A store free trial would need money-pinned client **and** server changes. §5.4 keeps it dormant. |
| 0.8 | Plans are never pre-selected today | `wall/WallScreen.tsx:68` `useState<PaidPlan \| null>(null)`; `:91` resets it to null | The pre-selection rule in §5.3 is new. |
| 0.9 | The wall door `path-complete` exists and app code never navigates to it | `wall/wallPages.ts:43`; `nav/RootNavigator.tsx:733` (only `initialParams`) | Reuse it for the first-run wall. A new door would need a new SQL migration, because `wall_shown.entry` is enforced in `supabase/migrations/20261002192210_consented_product_funnel.sql:71-83,139`, which is money-pinned. |
| 0.10 | Purchases are dark until RevenueCat keys exist | `wall/WallScreen.tsx:39-44`; `purchases/adapter.native.ts` reads `EXPO_PUBLIC_REVENUECAT_IOS_API_KEY`, `..._STARTER_PRODUCT_ID`, `..._REGULAR_PRODUCT_ID`; the server needs all five keys or none (`revenuecat.ts:31-36`) | The founder actions are listed in §5.7. |
| 0.11 | `capabilities.ts` is the one place that says what a plan opens, and it is money-pinned | `purchases/capabilities.ts` (`capabilitiesFor`, `INCLUSIONS`); pinned in `wall/moneyUntouched.test.ts` FILES | Freezes go here as `streakFreezes`. **No separate RevenueCat entitlement** (see §5.7). |

---

### 1. Home (`tabs/HomeTab.tsx`, `home/*`)

#### 1.1 Current state
- **Header.** A still greeting with `ProfileButton` trailing (`HomeTab.tsx:140`).
- **Lead.** `StarterContinuation` when a starter exists and there are no sessions yet, otherwise `NextTaskCard` (`:157-159`).
- **Day count.** A lone grey `DayCount` line (`:161`, `progress/DayCount.tsx:31`).
- **Below the lead.** The day-one "Where you're starting" card (`:165-176`) or up to two loose week sentences (`:177-181`).
- **Today's phrase.** `DailyCard` with a right-aligned underlined "Practise it" (`:183`, `daily/DailyCard.tsx:134`).
- **Friends and the end of the page.** The friends card with an underlined link (`:185`), then a bare trailing "Explore my daily collection" (`:186`).
- **Scene brief.** `MissionHero` carries a disclaimer note (`home/MissionHero.tsx:139`). On day one, Home, Speak and Practice all lead with the same blue hero.

#### 1.2 Target order (returning learner)

| # | Block | File (create/edit) | Data source | When it is absent |
|---|---|---|---|---|
| 1 | Greeting `TabHeader` + `ProfileButton` (unchanged, pinned) | `tabs/HomeTab.tsx` | `homeGreeting` | never |
| 2 | **`HomeStatusBar`**: flame + day number, goal ring, level chip | **create** `home/HomeStatusBar.tsx` | `useStreak()` (current, practisedToday, lifetimeDays); `useDailyGoal()` (today's measured minutes, target); `useLevel()` (`levelFor(totalXp(activity))`) | Its own read failed: render nothing, never a 0 |
| 3 | **`StreakNudge`**: one warm line, conditional | **create** `home/StreakNudge.tsx`; copy in `game/streakCopy.ts` (game section's module; this section adds the Home strings) | `useStreak()`, local clock, `useLive()`, billing kind | No condition matches (most of the time) |
| 4 | Lead card: `StarterContinuation` / `NextTaskCard` | edit `onboarding/StarterContinuation.tsx:111-113`, `practice/NextTaskCard.tsx:70,89`, `home/MissionHero.tsx:133-139` | unchanged | — |
| 5 | `<DayCount />` lifetime line (pinned slot), restyled: `calendar-tick` bulk icon (20 pt) + `type.bodyStrong` ink, copy unchanged | edit `progress/DayCount.tsx:31` | `loadActiveDays()` | count 0 shows "Your first day of French starts with practice." (`dayCount.ts:5`) |
| 6 | Day-one "Where you're starting" **or** week sentences (unchanged) | — | unchanged | quiet week |
| 7 | **`QuestsCard`**: today's 3 quests | **create** `home/QuestsCard.tsx` | `useQuests()` (game section) | quests read failed: hidden |
| 8 | `DailyCard variant="today"` with an **icon action row** | edit `daily/DailyCard.tsx:131-137` | `todayItems(standing.index, now)` | — |
| 9 | Friends card, with its link turned into an `IconAction` | edit `HomeTab.tsx:185` | `usefulFriends(social)` | no friends |
| — | ~~"Explore my daily collection"~~ removed; now the `book` action inside `DailyCard` | edit `HomeTab.tsx:186` | — | — |

**`HomeStatusBar` elements.** All three are `Press` controls at least `HIT` tall, in a row with `flexWrap: 'wrap'` and `gap: space(2)`, so Dynamic Type wraps rather than clips. The style uses tokens only, which satisfies the F409 scan of `home/*`: no `width: <digit>` and no `fontSize:`. Every `flex: 1` gets `minWidth: 0`.

| Element | Visual | Accessibility label (exact) | Tap |
|---|---|---|---|
| Flame | `AnimatedIcon name="flame"`, 24 pt, flame fill when `practisedToday`, outline in `paper.inkSoft` when not; number in `type.bodyStrong`. If streak is 0 and lifetime is 0, there is no number. | `"${n}-day streak, practised today"` / `"${n}-day streak, not practised yet today"` / `"Your streak starts with your first practice"` | `nav.navigate('Streak')` |
| Goal ring | `ProgressRing size={HIT - space(2)} stroke={4}` plus `"${m} of ${goal} min"`; with no goal set, the ring is hidden and the label reads `"${m} min today"` | `"Daily goal: ${m} minutes practised, goal ${goal} minutes"` | `nav.navigate('Streak', { focus: 'goal' })` |
| Level chip | `Icon name="star" variant="bulk"` + `"Level ${index+1}"`. **No rank names** (`LEVEL_NAMES` stays unshown, which keeps the pinned "no rank anywhere" true, `MyFrenchTab.test.ts:86`) | `"Level ${n}, ${xp} XP, ${away} XP to Level ${n+1}"` (top level: `"Level ${n}, ${xp} XP"`) | `nav.navigate('MyFrench')` |

**Minutes on the ring** come from the dormant but honest rule in `progress/momentum.ts:727-755` (`goalFrom`): only measured `activeMs` over `PRACTICE_KINDS`, floored, and untimed entries add nothing. Move that rule into the game layer's `useDailyGoal` rather than importing `momentumFrom`, which F440 bans (`surfaceContract.test.ts:2165`). The target comes from `dailyGoalOf(profile)`; the daily-goal tiers 5/10/15/20 come from the onboarding/game section.

#### 1.3 Home states

| State | Status bar | Nudge (exact copy) | Lead | Quests |
|---|---|---|---|---|
| **Day one, no practice yet** | Outline flame with no number; empty ring showing `"0 of 10 min"`; `"Level 1"` | none | `StarterContinuation` (sun) if a guest starter was saved, otherwise `MissionHero` | The game section's three day-one quests |
| **Day one, first reply adopted at account handoff** (if the onboarding/streak section records that day) | Lit flame, `1` | none | as above | as above |
| **Returning, practised today** | Lit flame, ring at its true fraction | none (or the freeze line below, before the first practice of the day) | `NextTaskCard` | live |
| **Returning, not yet today, before 17:00 local and before the habit window** | Outline flame showing `n` | none | `NextTaskCard` | live |
| **At risk**: streak ≥ 1, not practised today, local time ≥ max(17:00, habit window start from §4.2) | Outline flame showing `n` | `"Your ${n}-day streak is waiting. A short practice today makes it ${n+1}."`; on the eve of a milestone (7/30/100/365): `"One practice today reaches your ${n+1}-day milestone."` | `NextTaskCard` | live |
| **Freeze used yesterday** (subscriber) | Lit or outline as above | `"A streak freeze covered yesterday. Your streak is ${n} days."` (once, until the first practice today) | — | — |
| **Fresh start** (streak was reset, lifetime ≥ 1) | Outline flame showing `0`, with the lifetime line visible in block 5 on the same screen | `"A fresh start today. You have practised French on ${L} days so far."` | — | — |
| **Offline** (`useLive().live === false`) | Normal; all of it is read locally | Replaces the at-risk line: `"Your ${n}-day streak is waiting. Today's phrase works offline and counts."` | Review card or `LocalPracticeCard` (`NextTaskCard.tsx:82-90`) | Rows that need a connection show the `cloud-off` icon and `"Needs a connection"`; they stay tappable and open the explanation |
| **Trial used up** (`nextTaskKind === 'plans'`, `practice/nextTask.ts:6`) | Normal | At-risk copy uses the offline variant above | Sun plans card. Add a line `PLANS_LEAD.streak = "Free practice and review still count for your streak."` (edit `home/nextAction.ts:47-52`). "Try the offline café line" becomes `IconAction icon="headphones"` with the same label (`NextTaskCard.tsx:89`) | The quest generator must draw only free-practice quests when `billing.canStart === false` (game-section contract) |
| **Read failure** | Hidden (claims nothing) | none | Existing card (`HomeTab.tsx:147-152`, no "error" wording, test `:566`). "Try loading my scenes again" becomes `IconAction icon="refresh"` with the same label | hidden |
| **Loading** | Three sand capsules (`Skeleton`, `HIT` high), outside the pinned loading branch | none | Pinned skeleton, updated literal (see Tests) | inside the skeleton |

#### 1.4 Lead-card changes
- **Scene art.** `MissionHero` adds the scene's place drawing: `art={<SceneArt mission={hero.mission.id} />}`, only when `hero.kind === 'scene'`. Create `home/SceneArt.tsx`: `<Illustration name={sceneIllustration(id)} fit="small" />` (`art/flat/scenes.ts:34`) wrapped in `StaggerIn`. It is decorative and drawn above the meta line. `SceneBrief` (`components.tsx`) gains an optional `art` node rendered before `{meta}`. That is an edit inside an existing export; append-only still holds.
- **Note.** `MissionHero.tsx:139` becomes `note="Uses live minutes while the room is open."`.
- **StarterContinuation.** Its three underlined links (`onboarding/StarterContinuation.tsx:111-113`) become one `IconAction` row: `refresh` "Retry my last line", `microphone` "Speak with my tutor", `star` "See plans" (only when the store has plans). The `label="Retry my last line"` prop keeps `uxControls.test.ts` (F696, `/Retry/`) passing.
- **Failure state.** `NextTaskCard.tsx:70` "Retry next task" becomes `IconAction icon="refresh"`.
- **Pill counts unchanged.** NextTaskCard 3, MissionHero 1, LocalPracticeCard 1 (`surfaceContract.test.ts:1776-1779`).

#### 1.5 Today's phrase and quests
- **`DailyCard` today variant** (`daily/DailyCard.tsx:131-137`). `FrenchBlock` with the play disc. While `status.playing`, the disc shows `AnimatedIcon name="speaker"` waves. Then a row of three `IconAction`s, left to right:
  - `microphone` "Practise it" → `sayIt`
  - `bookmark` "Save" / "Saved" → the existing `save()` at `:78`. On success, `AnimatedIcon` fills the bookmark and `celebrate('phrase-saved', { key: \`phrase-saved:${item.id}\` })` fires; the host plays sound `save` and haptic `soft()`.
  - `book` "More phrases" → `nav.navigate('DailyLibrary')`

  Accessibility labels: `"Practise today's phrase"`, `"Save today's phrase"` / `"Today's phrase is saved"`, `"Open the daily collection"`.
- **`QuestsCard`.** One white `Card`.
  - Header: `AnimatedIcon name="chest"` (from the art section's chest) + `"Today's quests"` (`type.heading`, `accessibilityRole="header"`) + trailing `"${done} of 3"`.
  - Three `QuestRow`s: each a `Press` with `minHeight: HIT + space(4)`, a leading bulk icon for the quest kind in a 36 pt disc, the title, and a 6 pt `LivingBar` showing progress/target. Trailing: a check when done, otherwise a chevron. Tap goes to `quest.route`.
  - When all three are done, the subline reads `"All three done. New quests arrive tomorrow."`.
  - Quest progress, rewards and the chest-open moment belong to the game section. Home only displays.

#### 1.6 Motion and feedback on Home

Data reads stay in `useFocusEffect` (`HomeTab.tsx:91`, and each new component's own focus read). A device-local snapshot, `home/homeSeen.ts` (`userKey('home-seen')`, not synced), holds `{ dayKey, streak, minutes, xp, level, questsDone: string[], lifetimeDays }`. The rules:
- Each block animates **from the snapshot to the fresh value**, then the snapshot is written.
- On a new `dayKey`, the baseline for minutes and quests resets to 0 **without animating down**.
- Nothing ever animates down. A reset shows the fresh-start nudge instead.
- If `useCelebrate().busy` is true (the host is playing the session's celebrations), the increments wait until it becomes false.

| Moment | Element | Motion (tokens / ms) | Sound | Haptic |
|---|---|---|---|---|
| First time the loaded branch replaces the skeleton in an app session (module flag, not on every focus or refresh) | Blocks 2–9 | `StaggerIn`, 50 ms stagger, each `DUR.base` 260, `EASE.out`, opacity 0→1, translateY 8→0 | none | none |
| Same | `SceneArt` | scale 0.94→1 + opacity, `SPRING.settle`, starts with its block | none | none |
| Same, once per local day, after the hero settles | Start pill | `Glint` once, 200 ms linear, 770 ms after settle | none | none |
| Return, streak increased | Flame | t0: `AnimatedIcon flame` ignite (scale 0.7→1.15→1, `SPRING.pop`), outline→fill crossfade `DUR.fast` 180; number `CountUp` old→new `DUR.slow` 420 `EASE.out` | none (the host already played `streak`) | `soft()` once at the end |
| Return, minutes increased | Goal ring | t0+120: `ProgressRing` from the old to the new fraction, `DUR.slow` 420 (600 ms if the change is above 0.5), `EASE.out`. Reaching 1: stroke turns mint (`DUR.fast`), centre check draws (`AnimatedIcon check`, 260), `Bloom` behind the ring 420 ms (opacity 0→0.35→0). `goal-met` itself is fired by the activity write path; Home never emits it | none | `soft()` on reaching 1 |
| Return, XP or level changed | Level chip | t0+240: if the level changed, the number swaps with `SPRING.pop` (1→1.15→1) and a `Glint` crosses the chip, 200 ms | none | `tick()` once |
| Return, quests completed | Quest rows | t0+360: each newly done row gets a check draw 260 and a mint tint fill 180, 80 ms stagger; `"${done} of 3"` `CountUp` 260 | none | none |
| Return, lifetime days increased | `DayCount` line | t0+480: `CountUp` 260 | none | none |
| Tap flame / ring / chip / quest row / IconAction | — | `Press` (`SPRING.press` 439/29.3) | per the sound section's tap policy | `tapSettled()` |
| **Reduce Motion** (`useReduceMotion` from `motion.ts`, watched live) | all | final values set instantly; no `Bloom`, `Glint` or stagger | unchanged | unchanged (haptics follow the haptics toggle) |

The changed value is announced politely by the component that changed: `accessibilityLiveRegion="polite"` in `HomeStatusBar` and `QuestsCard` only. It must never appear in `HomeTab.tsx`; the pinned test bans it at `HomeTab.test.ts:121`.

---

### 2. Progress tab (`tabs/MyFrenchTab.tsx`)

#### 2.1 Current state
- **Loading** is the text "Finding your French." (`:156`).
- **Content.** A mint proof card or the blue `LevelCard` (CEFR path, `myfrench/LevelCard.tsx:7-25`), then the weekly `DayCount` (`:195`).
- **Ledger rows.** All use `DocumentGlyph`: week story and postcards (`:196-199`), plus the progress rows (`:200-221`).
- **First visit.** `"Your first useful phrase"` + `LocalPracticeCard` (`:191-193`).
- XP, level, streak and badges are never shown.

#### 2.2 Target layout

| # | Block | File | Data source |
|---|---|---|---|
| 1 | `TabHeader` (unchanged) | — | — |
| 2 | **First visit only** (`isFirstVisit`, `myfrench/notebook.ts:169-176`): heading `"Your first useful phrase"` (kept) + new line `"One practice starts your streak, your level and your phrase bank."` + `LocalPracticeCard` (free, offline, counts for the streak). Nothing else is drawn, which keeps the pinned "nothing empty". | edit `MyFrenchTab.tsx:191-193` | — |
| 3 | **`LevelXpCard`**: `"Level ${n}"` (`type.display`), `LivingBar` (XP within the level), `"${xp} XP"`, `"${away} XP to Level ${n+1}"` or `"Top level reached. XP still adds up."`. When today's XP hit the cap: `"Today's XP is complete. Practice still counts for your streak and goal."` | **create** `progress/LevelXpCard.tsx` | `useLevel()` = `levelFor(totalXp(activity))`; XP today = that day's sum capped at `DAILY_XP_CAP` (`levels.ts:36`) |
| 4 | **`StreakSummaryCard`**: flame + `"${n}-day streak"`, `"Longest streak: ${m} days"`, the Monday–Sunday row from the game section's `StreakCalendar` (week variant), then the existing `<DayCount weekly />` line inside. Tap → `Streak` | **create** `progress/StreakSummaryCard.tsx`; keep `<DayCount weekly` (stage3 `has`) | `useStreak()` |
| 5 | **`CountsGrid`** (2×2 tiles, each a `Press` ≥ `HIT`): "Phrases kept" → Phrasebook; "Conversations" → Conversations; "Minutes practised" → Streak; "Practice days" → Streak. Name it `CountsGrid`, not `Stat*`; `MyFrenchTab.test.ts:131` bans `<Stat` | **create** `myfrench/CountsGrid.tsx` | phrases: the existing `new Set(deck…phraseKeyOf)` (`:202`); conversations: `allConversations({packs, events}).length` (`:204`); minutes: floored sum of `activeMs` over the retained log (see Risks); days: `loadActiveDays().length` |
| 6 | **`BadgeShelf`**: earned medals in colour, plus at most 3 next-to-earn as outlines with their how-to line. No full catalogue grid, and no "collect all", "locked" or "remaining" wording (the spirit of the stage3 Postcards `lacks`). Tap a medal → `BottomSheet` with its name, the true event and the earned date. Empty state: `"Badges you earn show here."` | **create** `myfrench/BadgeShelf.tsx` | `useBadges()` |
| 7 | Proof card (mint) / `LevelCard` (CEFR path), unchanged; the only `PillButton` stays here (pinned count 1) | — | unchanged |
| 8 | **`PostcardShelf`** replaces the "Place postcards" ledger row: a horizontal row of earned `postcard-*` drawings (still, decorative), with the header row `"Place postcards"` → Postcards | **create** `progress/PostcardShelf.tsx`; edit `MyFrenchTab.tsx:198` | `earnedPostcards(missions)` |
| 9 | Remaining ledger rows; glyphs swapped to `Icon` (bulk): `book` for the week story, `quote` for phrases, `sound` for sounds, `chat` for conversations, `target` for goals, `bookmark` for saved | edit `MyFrenchTab.tsx:197, 210` | unchanged |
| — | Loading: sand `Skeleton` shaped like blocks 3–5 instead of "Finding your French." | edit `:156` | — |

#### 2.3 Progress motion
Uses the same snapshot module as Home, key `'progress'`.

| Moment | Motion | Sound / haptic |
|---|---|---|
| First render in the session | `StaggerIn` blocks 3–9, 60 ms stagger, `DUR.base`, translateY 8→0 | — |
| XP increased | `LivingBar` from the old to the new fill, 600 ms `EASE.out`; `"${xp} XP"` `CountUp` 600 | `tick()` once |
| Level crossed | bar fills to 100% (420), the level number pops (`SPRING.pop`), the bar resets to 0 and fills to the remainder (420) | none (the host plays `levelup`) |
| Counts increased | `CountUp` 600, 60 ms stagger | — |
| New badge since the snapshot | medal scale 0.6→1 `SPRING.pop` + one `Glint`, 80 ms stagger | none (the host plays `badge`) |
| Reduce Motion | final frame | — |

---

### 3. Profile (`tabs/ProfileTab.tsx`)

- **Add `ProfileStats`** (**create** `profile/ProfileStats.tsx`) directly under `TutorMemoryCard` and before `<DayCount />` (`ProfileTab.tsx:257-259`). It is its own file with its own focus reads, because ProfileTab may not contain `useFocusEffect`; the pinned test `ProfileTab.test.ts:175` bans it.
  - Two tiles: flame + `"${n}-day streak"` (→ Streak) and star + `"Level ${n}"` (→ MyFrench).
  - Freeze row, **subscribers only** (`capabilitiesFor(billing.plan, billing.lapsed).streakFreezes`): `Icon name="freeze"` ×`max`, filled for held and outline for empty, and `"${held} streak freezes ready"`. The refill rule line comes from the streak section's copy.
  - Free users, only when the store has plans: one quiet `IconAction` `"Streak freezes come with a plan"` → `nav.navigate('Wall', { entry: 'settings' })`. Without a store it is absent. (See open question 2.)
- **Lifetime.** `<DayCount />` stays (stage3 `has`) and remains the lifetime total.
- **Daily goal row.** The "Days a week" `ChoiceRow` (`ProfileTab.tsx:276-283`) is removed, and "Flexible practice routine" becomes the four-tier daily goal. The onboarding/game section defines the tiers; Profile only renders them.
- **No new `<Label>`.** The pinned count of 2 stays (`ProfileTab.test.ts`, "profile opens centred…"). The stats copy lives in **create** `profile/statsCopy.ts`, not `FRENCH_LIFE_COPY`, whose test bans digits.
- **Motion.** `StaggerIn` on the tiles at mount only (60 ms). No count-ups on Profile.

---

### 4. Reminders and notifications (`reminders/*`)

#### 4.1 The reversal, done in the open
- **New ledger entry** (next free id from the shared counter, F716 or later): **"The daily reminder knows today: it skips a practised day, names the chosen tutor, varies a warm factual line, and pauses itself after four unanswered days (founder decision 2026-10-04 reverses F226/F227/F230)"**.
- Add a `- superseded:` line to **F226, F227 and F230**, using the precedent at `KNOWN_ISSUES.md:5159`, naming the successor test titles below.
- Their old tests are **rewritten in place with their titles kept** where a title stays true. Where it cannot, the test is retired and the ledger's `verified-by` line moves to the successor in the same commit with the `superseded:` note, never silently:
  - F226 `the reminder says the same words every day…` becomes false → retire it and point to the successor `every reminder line is warm, factual and clean, names the chosen tutor, and states only the learner's own counts`.
  - F227 `nothing under reminders can read whether the learner practised` becomes false → successor `the reminder reads practice only through the streak summary, in one planner, and the content builder is pure`.
  - F230 `…its trigger repeats unchanged` becomes false → successor `only the native schedule module touches expo-notifications; it schedules one dated reminder per day from the plan and never reads a clock`.
- **F241** (open P2): close as superseded by the new entry.
- **Doc to rewrite in the same change:** the "## The rule this module exists to hold" header at `reminders/reminder.ts:4-43`. The founder has decided the opposite, so the new header states the new rule and its limits: max 1 a day, no shame, no badge, auto-pause.

#### 4.2 Planner (pure, `node`-testable)
**Create** `reminders/plan.ts`. No imports from stores, and `now` is injected.

```ts
export interface PlanInput {
  now: number;
  choice: { enabled: boolean; time: 'smart' | ReminderTimeId; days?: number[] };
  finishes: readonly number[];          // epoch ms of finished practices, last 14 days
  streak: (dayKey: string) => { length: number; frozen: boolean }; // core projection assuming no practice after now
  practisedToday: boolean;
  lifetimeDays: number;
  tutorName: string;
  history: { sent: string[]; answered: string[] }; // day keys
  blocked: readonly string[];           // day keys reserved by a billing notice (§5.4)
}
export interface ReminderSlot { id: `practice:${string}`; at: number; title: string; body: string; open: 'home' | 'daily-phrase' | 'settings'; }
export function planReminders(input: PlanInput): ReminderSlot[];
```

1. **Time.**
   - If `choice.time` is a preset, use it (an existing learner's choice is kept).
   - If it is `'smart'` (the new default):
     - Take the **first** finish of each local day in `finishes`.
     - With 3 or more distinct days, use the median minute-of-day minus 30 min, rounded down to 15 min and clamped to 08:00–21:30.
     - Otherwise fall back to 18:00 (`EARLY_EVENING`, `reminder.ts:98`).
2. **Days.** Local dates from today up to `K` days ahead, filtered by `choice.days`. Today is **skipped if `practisedToday`** or if today's fire time has passed. At most **one slot per day key** (identifier `practice:${dayKey}`), and none on a `blocked` day.
3. **Unanswered run.** `run` = the most recent consecutive `sent` days with no practice, no tap and no app foreground after the fire time.
4. **Window and auto-pause.**
   - `K = 7 − ...` is replaced by: `slots = min(7, 5 − run)`. The **last slot in a window that reaches 5 unanswered is the pause note**, and nothing follows it.
   - A learner who never opens the app gets 4 reminders plus a kind note, then silence.
   - Any practice or app open re-plans, which resets `run`.
   - After the pause note fires, the store sets `paused: true` and the planner returns `[]` until the switch is turned back on.
5. **Content.** Per slot, from `reminderMessage()` in `reminder.ts`:
   - With projected streak ≥ 1, the streak set; otherwise the routine set.
   - The variant index is `hash(dayKey) % set.length`, never the same index as the previous day's slot.
   - The **projected** streak for that day assumes no practice in between. That is truthful because every practice re-plans.
6. **Re-plan triggers.** Create `reminders/ReminderPlanner.tsx`, mounted once in `SignedInRoot` inside `App.tsx`. It re-plans on:
   - `AppState` → active, which also records `opened` for today;
   - the game layer's practice-recorded event (a finished practice must re-plan before its screen navigates away);
   - a Settings change;
   - a change of tutor voice (`profile.tutorVoice`).

   It reads `useStreak()`, `useProfile()` (`tutorNameOf`, `tutor/tutorName.ts:79`) and finish times. This file is the **only** module under `reminders/` allowed to import from `game/`, and the successor F227 test pins exactly that.
7. **Scope.** `onUserScopeReset(() => void cancelReminder())`. Personalised lock-screen lines must not fire for the previous account on a shared phone. Nothing does this today.

#### 4.3 Copy (in `reminders/reminder.ts`, flattened into `REMINDER_COPY` builders for the scans)
`{n}` = projected streak for that day, `{L}` = lifetime days, `{t}` = the chosen tutor's name. All lines must pass `guiltIn` (once the streak section allows the word "streak") and the no-em-dash rule. Avoid hidden hits such as "close", "breakfast", "however" and "showed".

| Set | # | Title | Body | Opens |
|---|---|---|---|---|
| Streak (n ≥ 1) | 1 | `Your {n}-day streak is waiting` | `{t} has a short practice ready whenever you are.` | home |
| | 2 | `{n} days of French in a row` | `One short practice today makes it {n+1}.` | home |
| | 3 | `Today's phrase is ready` | `Practise it with {t} and your streak reaches {n+1} days.` | daily-phrase |
| | 4 | `{t} saved you a seat` | `A quick practice adds day {n+1} to your streak.` | home |
| | 5 | `Ready when you are` | `Your {n}-day streak is waiting, and so is {t}.` | home |
| | 6 | `Day {n+1} starts with one phrase` | `Hear it, say it, done. {t} is here.` | daily-phrase |
| | 7 | `Your French habit` | `{n} days so far. A short review counts too.` | home |
| | 8 (milestone eve, overrides) | `One practice from your {n+1}-day milestone` | `{t} is here when you are.` | home |
| Routine (no streak) | 9 | `A moment of French` | `{t} is here whenever you want to talk.` | home |
| | 10 | `Today's phrase is ready` | `Hear it and say it with {t}. It takes a minute.` | daily-phrase |
| | 11 (L ≥ 1, after a reset) | `Start a fresh streak today` | `You have practised on {L} days so far. A new streak is one practice away.` | daily-phrase |
| Pause note | 12 | `Pausing your reminders` | `They haven't been landing at a good time, so we'll stop for now. Turn them back on in Settings whenever you like.` | settings |

These lines are replaced in `reminder.ts`:
- `REMINDER_EXPLAIN` (`:185`) → `"Your phone will ask to allow notifications. Luvani sends at most one a day, around when you usually practise, and skips days you have already practised."` (keeps `/will ask/`).
- New `REMINDER_PAUSED` → `"Paused after a few quiet days. Turn it back on whenever you like."`.
- New `REMINDER_SMART_LABEL` → `"When I usually practise"`, with the gloss built as `"About ${gloss}"`, or `"6:00 pm until your rhythm shows"` while there is not enough history.

#### 4.4 Native scheduling (`reminders/schedule.native.ts` + web twin `schedule.ts`)
- **Replace** `scheduleReminder(time, days)` (`:229-245`) with `schedulePlan(slots)`:
  - Cancel only identifiers starting `practice:`, found through `getAllScheduledNotificationsAsync()`; a billing notice may coexist.
  - Then make **one** `scheduleNotificationAsync(` call site in a loop, with `{ identifier: slot.id, content: { title: slot.title, body: slot.body, data: { open: slot.open } }, trigger: { type: SchedulableTriggerInputTypes.DATE, date: slot.at, channelId: REMINDER_CHANNEL_ID } }`.
- `cancelReminder()` cancels `practice:*` only.
- **No clock** in this file. Times arrive in the plan.
- Keep `showBadge: false` (`:210`) and alert+sound-only permission (`:172`).
- **Do not add `setNotificationHandler`.** With no handler, a reminder that arrives in the foreground is not presented, which is what is wanted while someone is practising. A handler would also need `shouldSetBadge`, which the pinned badge guard rejects (`schedule.test.ts:326`).
- Add `onReminderTapped(handler: (open: string, id: string) => void): () => void`:
  - wraps `Notifications.addNotificationResponseReceivedListener`;
  - on first subscription, checks `getLastNotificationResponseAsync()` for a cold-start tap (confirm the names in the Expo SDK 57 versioned docs per `apps/mobile/AGENTS.md`);
  - de-duplicates by notification identifier.
- The web twin exports the same names: `schedulePlan` → `'unavailable'`, and `onReminderTapped` → a no-op that returns a no-op.
- `reminders/store.ts` moves to **v2**:
  - `{ version: 2, enabled, time: ReminderTimeId | 'smart', days?, sent: string[], answered: string[], opened: string[], paused: boolean }`;
  - each list is capped to the last 14 day keys;
  - v1 migrates with its `time` kept and the lists empty.
  - It stays out of sync (`sync/policy.ts` already excludes `reminder`); update its header (`store.ts:12-18`).

#### 4.5 Tap handling
`App.tsx` (`SignedInRoot`) subscribes through `onReminderTapped` and queues a route the same way `openPendingInvite` does (`:293-298`), flushing on `onReady` (`:516`). The resolver is **create** `reminders/openTarget.ts` (pure):

| `open` | Navigation |
|---|---|
| `home` | `navigationRef.navigate('Tabs', { screen: 'Home' })`; Home plays the one-shot `Glint` on Start |
| `daily-phrase` | `navigate('DailyPractice', { id: todayItems(levelFor(totalXp(await loadActivity())).index, Date.now()).phrase.id })` |
| `settings` | `navigate('Settings')` |

Each tap appends today to `answered`. No analytics event is added: the event union is SQL-enforced and money-pinned, so that is a follow-up for `data-sync-engineer`.

#### 4.6 Where permission is asked (after the first win, one line of why)
**Create** `reminders/ReminderAsk.tsx`, used by:
- the conversation recap's next page, replacing the inline offer at `RecapScreen.tsx:372-391`, still gated by `reminderOffer` (`live/keepsake.ts:107-126`, `won` required);
- the onboarding section's post-first-reply step (founder decision 13: plan → first reply + celebration → reminder ask → save progress → paywall). That screen is owned by onboarding; this component and its copy are shared.

| Part | Copy |
|---|---|
| Title | `A daily nudge from {t}?` |
| Why (one line) | `One a day at about {time}, and never on a day you have already practised.` |
| Only if permission is undetermined | `Your phone will ask to allow notifications.` |
| Actions | `OutlineButton` "Remind me" · `GhostButton` "Not now" |
| After accepting | `AnimatedIcon bell` ring (±12°, 3 swings, 420 ms; final frame under Reduce Motion), haptic `arrived()`, sound `select`, live line `Your reminder is on for about {time}. Change it any time in Settings.` |
| Refused | the existing `REMINDER_REFUSED` (`reminder.ts:197`) |

`keepsake.ts:120` body changes to the "why" line above. The offer's default time becomes `'smart'`.

#### 4.7 Settings controls (`settings/SettingsScreen.tsx:819-858`)
- **Phone group.**
  - Switch `REMINDER_ROW` "Daily reminder". Its sub is `"About 6:30 pm, skipped on days you practise"`, `"Off"`, or `"Paused"`.
  - The note line shows `REMINDER_EXPLAIN`, `REMINDER_REFUSED` or `REMINDER_PAUSED`. Turning the switch on clears `paused` and re-plans.
  - Row `REMINDER_TIME_TITLE` → the existing sheet (keep `<BottomSheet visible={sheet === 'reminderTime' && reminderOwned}` and `<OptionRow`, both stage3 `has`). The first option is `REMINDER_SMART_LABEL`, then the 4 presets. `REMINDER_TIMES` stays at 4, which keeps the preset test true.
  - The days chooser stays.
- **Interaction group.** The sound and haptics toggles belong to the sound section.
- The switch now calls the planner rather than `scheduleReminder` (`:525, :568`).

---

### 5. Paywall (`wall/*`, `purchases/*`, `packages/core/src/metering/meter.ts`)

#### 5.1 Current state
- **Two pages** (`wall/wallPages.ts:48-56`):
  - "yours" on sun: `WallYoursPage`, `YOURS_ROWS`/`ADDS_ROWS` (`wallCopy.ts:88-123`), with no visible decline;
  - "plans": `WallPlansPage.tsx:43-140`, selectable rows, "Maybe later" (`WALL_LEAVE`, `wallCopy.ts:230`), and three underlined links (Privacy, Terms, Restore).
- **Footer.** Pill `"${name}, ${price}"` plus renewal and trust lines (`WallScreen.tsx:300-308`, `WallPlansPage.tsx:150-157`).
- **Success.** A mint screen with a static `HeroNumber` (`WallScreen.tsx:323-335`).
- **Money pins.** `settle`, `buy`, `restore` and `checkAcceptedPurchase` are hash-pinned (`moneyUntouched.test.ts` FUNCTIONS), as are `meter.ts`, `contract.ts`, `adapter*.ts` and `capabilities.ts` (FILES). **None of the work below touches a pinned function.** Only `capabilities.ts` changes, and it is re-pinned deliberately.

#### 5.2 First-run placement
- After `GuestAccountHandoff` completes (`App.tsx:510`, `onDone`), the onboarding section's flow calls `navigationRef.navigate('Wall', { entry: 'path-complete' })`, **only if** all of these hold:
  1. `purchases.offering(user.id)` answered `available` (no wall on web or with no keys);
  2. `fetchBillingStatus` says `plan === 'trial'`;
  3. the learner reached the handoff with an accepted first reply.
- No flag is needed: the handoff happens once per account.
- "Not now" or the back chevron returns to Home. **The wall is never re-shown automatically**; the only later doors are the existing ones (used-up trial, refused room, Settings, StarterContinuation).

#### 5.3 Plans page, phase A (ships now)

| Element | Spec | File |
|---|---|---|
| Page "yours" | Add `YOURS_STREAK = "Your streak, daily goal and badges"` to `YOURS_ROWS` (true: they stay free under decision 3), and `ADDS_FREEZES = "Streak freezes, for the days life gets busy"` to `ADDS_ROWS`. **Add a visible decline** under the content: `GhostButton label={YOURS_DECLINE}` with `YOURS_DECLINE = "Keep practising free"` → `leave()` | `wall/wallCopy.ts`, `wall/WallYoursPage.tsx`, `wall/WallScreen.tsx:409` (`onLeave` prop) |
| Plan row | Unchanged fields plus a new line `goalFitLine(goal, daily)`, drawn when the profile has a goal and the catalogue has the plan. `daily = Math.floor(minutes / periodDays)` via **new** `dailyMinutes(minutes, periodDays)` in `wall/wallPlans.ts`, off the wire. Copy (template, `wallCopy.ts`): `daily >= goal` → `` `Fits your ${goal}-minute daily goal` ``; otherwise `` `About ${daily} minutes of conversation a day. Free practice covers the rest of your ${goal}-minute goal.` ``. Today's catalogue gives Starter 6 and Max 10, so Max says "Fits your 10-minute daily goal" | `wallPlans.ts`, `wallCopy.ts`, `WallPlansPage.tsx:109-114` |
| Pre-selection | **New** pure `preselectedPlan(rows, goal, standing): PaidPlan \| null` in `wallPlans.ts`: the **cheapest** row with `dailyMinutes >= goal`; `null` when there is no goal, no row covers it, or the row is the learner's current unlapsed plan. Applied in a new `useEffect` in `WallScreen.tsx` that runs only while `selected === null`. **It does not fire `plan_selected`**, so the funnel still means "the learner chose" | `wallPlans.ts`, `WallScreen.tsx` (outside the pinned functions) |
| Perk line | Under the rows: `Icon freeze` + `PLANS_FREEZES = "Every plan includes streak freezes."` (no word "badge" in this file; `wallPlans.test.ts:121`) | `wallCopy.ts`, `WallPlansPage.tsx` |
| Decline | `WALL_LEAVE` → `"Not now"` | `wallCopy.ts:230` |
| Links | Privacy / Terms / Restore become an `IconAction` row with the same labels: `shield` `PLANS_PRIVACY`, `document` `PLANS_TERMS`, `refresh` `PLANS_RESTORE` | `WallPlansPage.tsx:131-135` |
| Pill | Unchanged label. `MorphButton`: pill → spinner while `busy` (200 ms `EASE` in-out collapse), back to pill on a cancel or failure (200 ms, no shake); **check only when `success !== null`** | `WallScreen.tsx:398-404` |
| Motion | Rows `StaggerIn`, 67 ms stagger, 250 ms `EASE.out`, +8 pt rise, no overshoot. A pre-selected row lands already filled, with no flourish. Tapping a row fills it blue in 150 ms with a 1.01 pop (`SPRING.snap`); `CheckGlyph` drawn with `AnimatedIcon check` 120 ms; existing `haptic="selection"`; sound `select`. `Glint` on the pill once, 770 ms after the page settles, only when a row is selected | — |

#### 5.4 Trial timeline, phase B (dormant until the founder configures an intro offer)
- **Contract.**
  - `StoreProduct.intro?: { kind: 'free' | 'paid'; days: number; priceString: string } | null`, read from RevenueCat `product.introPrice` (`periodUnit` and `periodNumberOfUnits` converted to days).
  - `StoreProduct.introEligible: boolean` from `Purchases.checkTrialOrIntroductoryPriceEligibility`.
  - These live in `purchases/contract.ts` and `adapter.native.ts`, both money-pinned. That needs `revenue-engineer` ownership, independent review and new hashes with a dated reason.
- **Server first.** `revenuecat.ts`/`state.ts` must grant a **trial-sized** allowance while RevenueCat reports `period_type: TRIAL`. Today an active entitlement would grant the full 180/300 minutes before any payment, which is the freeloader cost `meter.ts:32-36` warns about.
- **Render** (`wall/TrialTimeline.tsx`, create) only when `intro?.kind === 'free' && introEligible`. Three nodes with `Icon`s:

| Node | Title | Line |
|---|---|---|
| `unlock` | `Today` | `` `${plan} starts free. Nothing is charged today.` `` |
| `bell` | `` `Day ${days - 2}` `` | permission granted: `We will remind you two days before your trial ends.`; otherwise: `` `Cancel in your App Store settings before day ${days} and you pay nothing.` `` |
| `card` | `` `Day ${days}` `` | `` `${plan} continues at ${price} a month.` `` |

  - Pill: `` `Start ${days}-day free trial` ``.
  - Under it: `` `Free for ${days} days, then ${price} a month. Renews monthly until you cancel.` ``
  - Motion: nodes 200 ms stagger, slide 12 pt from the right, 200 ms `EASE.out`; connectors draw 270 ms.
- **Reminder.** The "remind you" promise is scheduled as `trial:${productId}`, and only after the server confirms the trial with its end date. Its day key goes into the planner's `blocked` list (max 1 per day). Copy: `Your free trial ends in two days` / `` `After that, ${plan} is ${price} a month. You can cancel in your App Store settings.` ``

#### 5.5 Purchase confirmed
- In the `success !== null` branch only (`WallScreen.tsx:324`, which already requires `confirmedGrant` from `fetchBillingStatus`), a `useEffect` on mount calls `celebrate('purchase-confirmed', { key: \`purchase-confirmed:${user.id}:${confirmedGrant.periodEnd}\`, minutes })` when `purchaseAccepted` is true. The host plays `Burst` (`DUR.celebrate` 900), sound `complete` and haptic `celebrate()`.
- A **restore** lands on the same screen without `purchaseAccepted`: quiet `arrived()` only.
- `HeroNumber` → `CountUp` 0→minutes, 1000 ms `EASE.out`.
- Add the line `"Streak freezes are on."` with `Icon freeze`.
- The `granted`-but-unread and pending branches (`:339-360`) get **no** celebration.

#### 5.6 App Store 3.1.2 checklist (all on the plans page or its footer)

| Requirement | Where it is met |
|---|---|
| Subscription name | row `name` |
| Length and renewal | `PLANS_RENEWAL` (`wallCopy.ts:157`, pinned `/renew/`, `/month/`, `/cancel/`) at the button |
| Price per period | store `priceString` + "per month" (row and a11y label, `wallPlans.test.ts:255`) |
| Trial terms (phase B) | timeline and the under-pill line |
| Privacy and Terms links | functional `IconAction`s |
| Restore | `IconAction` + existing `restore()` |
| Manage or cancel | the existing Settings text "Cancel an App Store or Google Play subscription in the store" (stage3 `has`) |
| No countdown, no fake anchors | `wallCopy.test.ts` urgency/social-proof regexes; `wallPlans.test.ts:121` |

#### 5.7 Founder actions
1. **App Store Connect.**
   - Paid Apps agreement, tax and banking; enrol in the Small Business Program (`meter.ts:56-63`).
   - One subscription group with two **monthly (P1M)** auto-renewing products: Starter ($19) and Max ($29), with localized names and a review screenshot.
   - A sandbox tester.
2. **RevenueCat.**
   - Project and iOS app with the in-app purchase key.
   - Import both products; **one** entitlement attached to both, its id going into `REVENUECAT_ENTITLEMENT_ID`.
   - A current offering with two monthly packages.
   - A webhook to the token server's `/billing/webhook` with the secret.
3. **Keys.**
   - EAS env: `EXPO_PUBLIC_REVENUECAT_IOS_API_KEY`, `EXPO_PUBLIC_REVENUECAT_STARTER_PRODUCT_ID`, `EXPO_PUBLIC_REVENUECAT_REGULAR_PRODUCT_ID`.
   - Token server: all five `REVENUECAT_*`/`LUVANI_REVENUECAT_WEBHOOK_SECRET` keys (`revenuecat.ts:22-28`), all five or none.
4. **No RevenueCat entitlement for freezes.** Freezes follow `capabilitiesFor(plan, lapsed)`, which follows the server's `/billing/status`, which already comes from RevenueCat. A second entitlement would be a second source of truth.
5. **Intro offer: do not configure one at launch** unless the server's trial-allowance work in §5.4 lands first. See open question 1.

---

### 6. Widgets and app-icon variants: **out of scope for this pass; recommend phase 2**
- **Widgets.** They need a WidgetKit extension in SwiftUI, added through a config plugin (for example `@bacons/apple-targets`), plus an App Group entitlement and a native bridge to write shared `UserDefaults`.
  - That is a second native surface to verify on iPhone and iPad.
  - The node gate cannot see any of it.
  - It adds to the fingerprint/OTA break the Reanimated rebuild already causes.
- **Duolingo evidence** (`duolingo.md:132`): widgets pay off once the streak is already the habit. Ship the streak first and measure four weeks of streak adoption.
- **Phase 2 sketch.** Small widget: flame + number. Medium: today's phrase + goal ring. Lock-screen circular: flame + number. The same no-shame copy rules apply, and a widget is never "sad" art.
- **Alternate app icons** (milestone icons at 100/365) need a config plugin and an App Store review note. They are low value until milestones exist. Phase 2, together with the widgets.

---

### Files touched

**Create**
- `home/HomeStatusBar.tsx`, `home/StreakNudge.tsx`, `home/QuestsCard.tsx`, `home/SceneArt.tsx`, `home/homeSeen.ts` (snapshot store, also used for `'progress'`)
- `progress/LevelXpCard.tsx`, `progress/StreakSummaryCard.tsx`, `progress/PostcardShelf.tsx`, `myfrench/CountsGrid.tsx`, `myfrench/BadgeShelf.tsx`
- `profile/ProfileStats.tsx`, `profile/statsCopy.ts`
- `reminders/plan.ts`, `reminders/ReminderPlanner.tsx`, `reminders/ReminderAsk.tsx`, `reminders/openTarget.ts`
- `wall/TrialTimeline.tsx` (phase B, dormant)
- Tests: `home/HomeStatusBar.test.ts`, `home/QuestsCard.test.ts`, `reminders/plan.test.ts`, `reminders/openTarget.test.ts`, `wall/preselect.test.ts`, `progress/LevelXpCard.test.ts`

**Edit**
- `tabs/HomeTab.tsx`
- `home/useHomeRefresh.ts`, `home/MissionHero.tsx`, `home/nextAction.ts`
- `practice/NextTaskCard.tsx`
- `onboarding/StarterContinuation.tsx` (links → `IconAction`; coordinate with the onboarding owner)
- `daily/DailyCard.tsx`, `progress/DayCount.tsx`
- `components.tsx` (`SceneBrief` gets an `art` slot)
- `tabs/MyFrenchTab.tsx`, `tabs/ProfileTab.tsx`
- `reminders/reminder.ts`, `reminders/schedule.native.ts`, `reminders/schedule.ts`, `reminders/store.ts`
- `live/keepsake.ts`, `RecapScreen.tsx` (reminder block → `ReminderAsk`)
- `settings/SettingsScreen.tsx`
- `App.tsx` (tap listener, `ReminderPlanner`, scope-reset cancel)
- `storage/scope.ts` (new key suffix `home-seen`), `sync/policy.ts` (`SYNC_EXCLUSIONS` entry for `home-seen`, with its reason)
- `wall/WallScreen.tsx` (pre-select effect, `MorphButton`, celebration, yours-page decline)
- `wall/WallPlansPage.tsx`, `wall/WallYoursPage.tsx`, `wall/wallPlans.ts`, `wall/wallCopy.ts`
- `purchases/capabilities.ts` (`streakFreezes`, re-pinned)
- Phase B only: `purchases/contract.ts`, `purchases/adapter.native.ts`, `services/token-server/src/billing/revenuecat.ts`/`state.ts`

### Tests and docs to change
**No ledger-pinned title is renamed.** Where a reversed decision makes a pinned title false, the ledger gets a `- superseded:` line and the successor test in the same commit (precedent `KNOWN_ISSUES.md:5159`).

**`tabs/HomeTab.test.ts`**
- `:428` "a Home that has not read its storage yet…" (pinned F602):
  - the skeleton literal becomes `[{ height: 328, radius: radius.feature }, { height: 24, width: '60%', radius: radius.field }, { height: 176, radius: radius.card }, { height: 132, radius: radius.card }]`;
  - in the after-branch list (`:445`), replace `'Explore my daily collection'` with `'<QuestsCard'`.
- `:458` "today's phrase is a white card…" (pinned):
  - `:472-473` → assert `<IconAction icon="microphone" label="Practise it" onPress={sayIt}`;
  - drop the `alignItems: 'flex-end'` assertion;
  - `:478` drop `'Save'` and `'save()'` from the banned list;
  - add bookmark and `book` action assertions.
- `:146` "the hero is the spine's next scene…" (pinned): `:192` remove `'art='` and `'heroArt'` from the gone list; add a positive check for `art={<SceneArt mission={hero.mission.id}` and that `SceneArt` is decorative.
- `:486` "Home names no weekday…" (pinned): **unchanged**. Its scope stays `HomeTab.tsx` + `MissionHero.tsx`. Add a dated comment at `HOME_SURFACE` (`:60`) saying the status bar, nudge and quests carry the founder-decided streak, goal rate and level under their own test.
- `:608` F409: extend the touch-floor walk to `tags(body, 'Press')`. That closes **F631** with its verified-by `every tappable row on Home declares the touch floor, whether it presses through Pressable or Press`.
- `:325` (unpinned): no change needed, provided `HomeTab.tsx` never spells lowercase `streak` or `loadActiveDays`.
- **New tests** (new ledger entry, "Home leads with the habit"):
  - `Home's status bar shows the streak, today's measured goal minutes and the level from real records, and claims nothing it could not read`
  - `Home's increments animate from the last shown value and never replay or count down`
  - `the at-risk line is warm, factual and appears only when the streak is real and today is unpractised`

**`surfaceContract.test.ts`**
- `:1759` SURFACES:
  - Home: add `home/HomeStatusBar.tsx`, `home/StreakNudge.tsx`, `home/QuestsCard.tsx`, `daily/DailyCard.tsx`;
  - MyFrench: add `progress/LevelXpCard.tsx`, `progress/StreakSummaryCard.tsx`, `myfrench/CountsGrid.tsx`, `myfrench/BadgeShelf.tsx`, `progress/PostcardShelf.tsx`;
  - Profile: add `profile/ProfileStats.tsx`;
  - all with 0 pills.
- `:2134` F407: `/daily library and Today\s+show no pictures/` → `/daily library and today's phrase\s+show no pictures/`. The title, "picture-free daily French", stays true.

**`tabs/MyFrenchTab.tsx` tests and stage3**
- `MyFrenchTab.test.ts`:
  - `:127` (pinned "the page is ledger rows and nothing louder…"): keep pill = 1, no `<Stat`, no tint; update the `Ledger` count; add a `superseded:` note pointing to the successor `Progress leads with the level, the streak and real counts, each from its own record`.
  - `:136` (unpinned): update the `LedgerRow` count.
  - `:86` (pinned): unchanged; level names are never shown.
- `revamp/stage3.test.ts:49-51`: keep every `has` (`<LevelCard`, `<DayCount weekly`, `nav.navigate('Postcards')`, …). `:56` ProfileTab keeps `<DayCount \/>`.

**Profile**
- `tabs/ProfileTab.test.ts`: pinned tests unchanged (2 `<Label>`, no `useFocusEffect`, no `levelName`).

**Reminders, recap and Settings**
- `reminders/reminder.test.ts:135,228` and `reminders/schedule.test.ts:220`: successors per §4.1.
  - `forbiddenIn` now allows `game/` from `ReminderPlanner.tsx` only.
  - The `DATE` trigger is required; `scheduleNotificationAsync(` occurs exactly once; no clock in `schedule.native.ts`; `showBadge: false` kept (`:326`, pinned, unchanged).
- `reminders/store.test.ts`: v2 shape and v1 migration.
- `reminders/weekdaySchedule.test.ts`: the weekday filter now applies through the plan.
- `tutor/tutorName.test.ts:83`: `NO_LEARNER_IN_HAND = []`.
- `live/keepsake.test.ts`: offer body copy; default `'smart'`.
- `RecapScreen.test.ts`: reminder block → `<ReminderAsk`.
- `settings/SettingsScreen.test.ts` and stage3 `:63`: keep the reminder sheet `has`.
- New: `reminders/plan.test.ts` covering:
  - skip today when practised;
  - max 1 per day;
  - pause note in the 5th unanswered slot;
  - habit median and clamp;
  - fallback to 18:00 with under 3 days;
  - the projected streak in copy;
  - no repeated variant on consecutive days;
  - chosen tutor name for all 8 voices;
  - every line through `guiltIn` and the em-dash check.

**Wall**
- `wall/wallPlans.test.ts:130` (pinned "declining is a visible choice…"): `assert.equal(WALL_LEAVE, 'Not now')`.
- `:121` unchanged; the new copy avoids "badge" and "recommended".
- New `wall/preselect.test.ts`:
  - cheapest covering plan;
  - `null` with no goal or no fit;
  - never the current plan;
  - preselection fires no `plan_selected`.
- `wall/wallCopy.test.ts`: new strings join `WALL_COPY`; `goalFitLine` added to the "sentences with a number" describe.
- A test that `celebrate('purchase-confirmed'` appears only inside the `success !== null` branch of `WallScreen.tsx`.
- `wall/moneyUntouched.test.ts`: re-pin `capabilities.ts` with a dated reason and revenue-engineer agreement. Phase B re-pins `contract.ts`, `adapter.native.ts` and the server files.

**`sync/policy.test.ts`** (pinned F229 title): add the `home-seen` exclusion with its reason.

**Docs**
- `DESIGN.md:505`.
- DESIGN.md Structure rows for Home, Progress and Profile.
- `reminders/reminder.ts` header.
- `docs/STATE_AND_STORAGE.md:531` (reminder v2, `home-seen`).
- `docs/DEVICE_VERIFICATION.md`, new rows:
  - reminder skipped after practice;
  - tap opens each target, cold and warm start;
  - pause note after 5 days;
  - tutor name after a voice change;
  - Home increments;
  - Reduce Motion toggled mid-animation;
  - iPad layout;
  - sandbox purchase celebration;
  - restore stays quiet.
- `docs/KNOWN_ISSUES.md`: new entries; supersede F226/F227/F230; close F241 and F631; re-check F651 against `practice/nextTask.ts:6`, which already routes `insufficient-for-session` to plans.
- `docs/IMPLEMENTATION_EVIDENCE.md` if `gate:bless` is run.

### Owner agent

| Part | Owner | Also involves |
|---|---|---|
| Home surface, Progress, Profile, `App.tsx` wiring, `surfaceContract.test.ts` | `frontend-engineer` | `progress-retention-engineer` (nudge, quests surfacing, return cues) |
| `SceneBrief` art slot, `SceneArt`, icons, DESIGN.md Illustrations | `design-system-engineer` | — |
| Reminders planner, copy, tap targets, `ReminderAsk` | `progress-retention-engineer` | `data-engineer` (`reminders/store.ts` v2, `home-seen`, `storage/scope.ts`, `sync/policy.ts`) |
| `StarterContinuation` and the first-run wall trigger | `onboarding-ux-engineer` | — |
| Paywall truth (pre-select rule, goal fit, `capabilities.ts`, phase B contract) | `revenue-engineer` | `frontend-engineer` renders; `backend-engineer` for server trial allowance (phase B) |
| Ledger entries and supersessions | the round's single integrator (TEAM.md:71-72) | — |
| Widgets (phase 2) | `deploy-engineer` | — |

### Acceptance checks
1. A learner who finishes a drill with zero correct answers, a review with zero recalled, or only today's phrase sees the flame lit and the streak +1 on returning to Home. The `HomeStatusBar` number matches the Streak screen.
2. After a 7-minute conversation with a 10-minute goal, the ring reads "7 of 10 min" and animates from its previous value once. Re-focusing Home does not replay it. Waiting 2 minutes on Home causes no skeleton flash.
3. Home shows no rank name anywhere. The lifetime "N days you have practised" line is visible whenever the streak shows 0.
4. With practice done today, no reminder is pending for today (`getAllScheduledNotificationsAsync` shows the first `practice:` slot dated tomorrow). With no practice, exactly one slot exists for today, at the habit time.
5. Changing the tutor to Céline re-plans, and pending notification bodies name Céline.
6. With 4 consecutive unanswered days, the next slot is the pause note and nothing is scheduled after it. Settings then shows "Paused".
7. Tapping a "Today's phrase is ready" reminder from a killed app opens DailyPractice on today's phrase. Tapping the pause note opens Settings.
8. Signing out leaves no `practice:` notifications scheduled.
9. On the plans page with a 10-minute goal, Max is pre-selected and reads "Fits your 10-minute daily goal". With a 15-minute goal, nothing is pre-selected and both rows explain the remainder. "Not now" and "Keep practising free" are visible without scrolling at default text size on iPhone SE and iPad.
10. A sandbox purchase shows the spinner, then the check and the celebration, only after `fetchBillingStatus` confirms. A cancelled purchase returns to the pill with no shake. A restore shows no confetti.
11. Web: `build:web` passes, Home renders, there is no reminder UI, no wall at first run, and haptics are no-ops.
12. Reduce Motion: every animation in this section lands on its final frame, including when toggled mid-animation.
13. VoiceOver reads every icon-only control by its label, and the status bar wraps at the largest text size.

### Risks
- **The reversal is a guilt vector.** It is mitigated by the copy rules, max one a day, no badge, auto-pause, and the lifetime total. Any copy edit must pass `guiltIn`, and the streak section must narrow the ban list rather than delete it.
- **Projected streak on the lock screen is stale** if practice happens on another device and this phone is not opened. It is corrected on the next foreground. Document it.
- **Lock-screen privacy.** Streak counts appear in previews on a shared device. They are cancelled on sign-out, and no French content is ever included.
- **The rolling window means a phone left unopened goes quiet** after 5 days by design. Tell the founder this is intended.
- **Activity is pruned at 400 days** (`activity.ts:113-116`), so lifetime "Minutes practised" undercounts after a year. Lifetime days are safe because `activeDays` is kept separately. If it matters, `data-engineer` should add a durable running total.
- **Money pins.** The `capabilities.ts` edit needs revenue review. Phase B touches pinned client and server billing code and carries real cost exposure until the trial allowance exists.
- **Dependencies on other sections** (game layer: any finished practice records a day, daily practice logs `activeMs`, a streak projection function, free-only quests when the trial is used up; motion primitives; `celebrate` busy flag). Without them Home shows true but disappointing numbers.
- **iPad.** No screen has a maximum reading width today, so the status bar and cards stretch. The layout owner should add one to `ScrollScreen`.
- **The `useHomeRefresh` fix** changes refresh frequency; the midnight rollover must still be verified on a device.

### Open questions for the founder
1. **Store free trial at launch?** I recommend **no**: keep the 30 free minutes as the trial and ship the plan comparison. A store free trial would currently grant a full month's minutes before any payment, and fixing that means changing billing code that is locked by tests on both phone and server. If you want "Start my free week", the server work comes first.
2. **Should free users see a quiet "Streak freezes come with a plan" row on Profile and the Streak screen?** It is truthful and has no urgency, but it is a sales prompt outside the paywall. My default is yes, shown only when the store has plans.