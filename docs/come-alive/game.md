> Detailed draft spec, written 2026-10-04 and checked against `47fbc2ea`. Where it disagrees with
> [README.md](README.md) Parts 1, 6 or 7 (decisions, resolutions, gate traps), README wins. Read the
> matching review in [reviews/](reviews/) before building from it.

## Game layer

This part covers the daily streak, XP, levels, the daily goal, daily quests and badges: the data model, the pure logic, storage and sync, the screens, the reminders, and the product rules that have to be rewritten. Every claim about current code below was checked against the source on 2026-10-04. Paths starting `@/` are under `apps/mobile/src/`. Paths starting `core/` are under `packages/core/src/`.

### 1. What exists today (verified)

| Fact | Where | What it means for this work |
|---|---|---|
| XP rules: `lessonXp` 20 + 2 per word (up to 10 words) + 10 if mostly unaided, max 60. `conversationXp` 25 + 2 per kept phrase + 10, max 70. `drillXp` 2 per clean answer + 1 per corrected typo, max 30. `reviewXp` = cards recalled, max 20 | `core/levels/levels.ts:94-115` | Keep all four unchanged. They are honest and capped. |
| Daily cap of 100 XP, applied per local day | `core/levels/levels.ts:36`, `:133-142` | Today this cap is what pitches content difficulty (see next row). |
| Six named ranks (Beginner…Veteran) at 0/150/600/1500/3200/6000 XP | `levels.ts:20`, `:33`, `levelFor` `:47` | `levelFor(...).index` picks content difficulty: the daily phrase pool (`@/tabs/HomeTab.tsx:110-111`) and the scene choice (`@/practice/NextTaskCard.tsx:62`, `core/daily/tier.ts:58`). **It must not become the displayed level.** Changing it would silently change what content a learner gets. |
| XP is written and never shown | `recordActivity` `@/progress/activity.ts:240-249`, called from `@/ConvoScreen.tsx:571`, `@/nav/RootNavigator.tsx:200`, `@/DrillScreen.tsx:1162`, `@/ReviewScreen.tsx:116`, `@/practice/completion.ts:225` | Every one of these calls is `void` (fire and forget). A celebration needs to know the write landed, so it must await it. |
| A sitting with 0 XP is not recorded at all, so its day is not marked | `activity.ts:246` | "Any finished practice counts as a streak day" needs an extra day write for sittings that earned 0 XP. |
| Practice days: a sorted set of local day keys, only ever grows, merged across devices | `@/progress/activeDays.ts:4-11`, `activity.ts:338-345`; daily phrase practice writes via `recordActiveDay` `activity.ts:348-364` | This set is the source of truth for the streak. It is never pruned. |
| The day keys are recomputed in the device's current timezone on every write | `activeDays.ts:9`, `activity.ts:248` | After travel, a sitting near midnight can be counted on two dates. It can never remove a day. |
| Activity kinds are a closed list, validated strictly | `activity.ts:23`, `:131`; `@/sync/policy.ts:444` | **Never add a new kind.** An older build reads an unknown kind as "Activity history is unreadable" (`activity.ts:161`) and stops recording anything. |
| Activity entries are pruned after 400 days, from the newest entry | `activity.ts:116`, `policy.ts` `mergeActivity` | An XP total computed live from the log would *fall* once entries age out. The displayed total needs a monthly floor. |
| Daily goal: `dailyGoalMin` can be 5, 10, 15 or null; days-a-week is 3, 5, 7, 'none' or null | `@/profile/store.ts:148`, `:88`; `@/profile/dailyGoal.ts:23`, `:38-43` | A 20-minute tier needs profile version 9, plus `core`'s sibling `packages/brain/src/profile/preferenceClock.ts:24` and `@/profile/upgrade.ts:71-73`. |
| Today's minutes rule: sum `activeMs` over convo, lesson, drill and review, rounded down to whole minutes; an entry with no `activeMs` counts as "untimed", not zero | `@/progress/momentum.ts:328-360`; `GOAL_MET` at `:226` | Reuse this rule: move it to core and have momentum call it. |
| `momentumFrom`, `todayFrom` and `FrenchLifeCard` are not rendered anywhere | grep: no non-test importer of `momentumFrom` or `progress/today.ts` | `today.ts` is dead and can go. `momentum.ts` has 8 ledger-pinned test titles, so it stays. |
| Reminder: one fixed message, a DAILY or WEEKLY repeating trigger, the native module reads no clock | `@/reminders/reminder.ts:148`, `:158`, `:233`; `@/reminders/schedule.native.ts:229-246` | Both points are enforced by tests (see §9). |
| Navigation: `navigationRef` and the `luvani` URL scheme already exist | `App.tsx:291`, `:514`; `app.json` `"scheme": "luvani"` | Tapping a reminder can deep-link without adding a linking config. |

### 2. Pure logic in `packages/core`

#### 2.1 Day boundary, timezones and travel

- **A practice day** is the local calendar date (`localDayKey`, `levels.ts:145`) on which a sitting *finishes*. A conversation that starts at 23:50 and ends at 00:05 counts for the new day.
- **"Today"** is `localDayKey(now)` in the device's current timezone. All day arithmetic works on `YYYY-MM-DD` strings with UTC calendar maths, never by adding milliseconds, so daylight-saving changes cannot skip or repeat a date. This is the same reasoning as `momentum.ts:400-414`.
- **Travel never breaks a streak.**
  - Because keys are recomputed (see §1), a long-haul flight can at most credit one sitting to both of two dates. We accept that, and document it in STATE_AND_STORAGE.md.
  - A trip west across the date line can skip a whole local date. For that case, add a **travel cover**:
    - when the uncovered gap is exactly 1 day,
    - and the device's UTC offset at this practice differs by 180 minutes or more from the offset recorded at the previous practice,
    - that day is covered automatically and free, at most once every 7 days.
    - The offset is kept device-locally (§3.2).
- **Days in the future are ignored** (practice days after today). A clock that runs fast on another device must not tick off a day the learner has not lived yet. This is the `ahead` rule from `momentum.ts:503`.

#### 2.2 Streak

`core/streak/streak.ts`:

```ts
export type DayKey = string; // 'YYYY-MM-DD'
export type CoverKind = 'freeze' | 'earned' | 'travel';
export interface StreakCover { day: DayKey; kind: CoverKind; at: number }
export interface StreakState {
  current: number;          // practice days in the live run (covers bridge the run but add 0)
  today: 'practised' | 'open';
  runStart: DayKey | null;
  longest: number;          // across all practice days ever held
  lifetimeDays: number;     // practice days in all; covers never add to it
  lastPracticeDay: DayKey | null;
  gap: DayKey[];            // uncovered days between the last practised-or-covered day and today (today excluded)
  coveredInRun: { day: DayKey; kind: CoverKind }[];
}
export function streakFrom(i: { practiceDays: readonly DayKey[]; covers: readonly StreakCover[]; today: DayKey }): StreakState;
export const STREAK_MILESTONES = [7, 30, 100, 365] as const; // then every 365 after that
export function milestoneCrossed(before: number, after: number): number | null;
export function weekStripFrom(i: StreakInput): { day: DayKey; label: 'M'|'T'|'W'|'F'|'S'; state: 'practised'|'covered'|'today-open'|'open'|'ahead' }[]; // Monday first
export function monthFrom(i: StreakInput & { year: number; month: number }): MonthCell[];
```

Rules:
- A day **counts** if it is a practice day or it is covered.
- The run ends at today if today is practised, otherwise at yesterday.
- `current` = the number of practice days in that run. A covered day keeps the run alive but adds nothing to the count, which matches Duolingo's freeze.
- If yesterday neither counts nor is covered, `current` is 0. The UI never shows 0 (§4).

#### 2.3 Freezes (paid plans only)

`core/streak/freeze.ts`:
- `FREEZE_CAP = 2`.
- `FREEZE_RETURN_DAYS = 7`: a used freeze comes back 7 days after the day it covered.
- `freezesHeld({covers, practiceDays, today, entitled})` returns 0 when not entitled. Otherwise it is `FREEZE_CAP` minus the number of freeze covers whose day is within the last 7 days **and was not practised**. If a sync later shows the learner did practise that day, the freeze is refunded.
- `freezesToApply({practiceDays, covers, today, entitled, paidSince})` returns the gap days to cover, or `[]`. It covers only when all of these hold:
  - the run before the gap is at least 1 day long;
  - every gap day is on or after `paidSince`;
  - the gap length is no more than the freezes held.
  - It never spends freezes it cannot use to save the streak, and it never covers today.
- **Billing truth:**
  - `entitled` comes from the server's billing answer: `plan ∈ {starter, regular}` and `!lapsed` (`@/purchases/billingStatus.ts`, `capabilitiesFor` `@/purchases/capabilities.ts:36`).
  - If the plan status is unknown, nothing is applied yet and the gap stays pending.
  - `paidSince` stops anyone buying a plan to repair a streak that has already ended. **No screen may offer a plan as a way to save a streak.**

#### 2.4 Earn-back (recommended; needs founder approval, §13)

`core/streak/cover.ts` `earnBackOffer({practiceDays, covers, today, sittingsToday})` offers to bring a streak back when:
- exactly one uncovered day was missed and it is yesterday;
- the run before it was at least 3 days;
- no `earned` cover exists in the last 30 days.

The requirement is `EARN_BACK_PRACTICES = 2` finished practices today. On the second one, yesterday gets `{kind:'earned'}`. It is open to everyone, because it is earned by practice and not paid for. The learner's first practice that day still shows truthfully as "1-day streak" until the second one lands, then fires `streak-extended` with "Your 13-day streak is back". `travelCover(...)` follows the same pattern (§2.1).

#### 2.5 XP shown and levels

- **The existing `levelFor` and `DAILY_XP_CAP = 100` stay exactly as they are**, as the content-difficulty standing. The HomeTab test asserts the literal `const standing = levelFor(totalXp(activity))`.
- **Remove `LEVEL_NAMES` and `LevelStanding.name`.** They are dead and could leak a rank name onto a screen.
- **New display level** (numbers only, never names), in `core/levels/levels.ts`:

```ts
export const LEVEL_XP_DAILY_CAP = 150;            // display total: a marathon still buys nothing; a 20-min "Intense" day fits
export function levelThreshold(level: number): number; // L1=0; step(n→n+1) = min(500, 50 + 25(n−1))
export function xpLevelFor(totalXp: number): { level: number; intoLevel: number; levelSpan: number; toNext: number };
export function totalXp(entries, dayKey = localDayKey, cap = DAILY_XP_CAP): number; // add the cap parameter
```

| Level | 2 | 3 | 4 | 5 | 6 | 8 | 10 | 15 | 20 | 21 | 25 | 30 |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| XP to start it | 50 | 125 | 225 | 350 | 500 | 875 | 1,350 | 2,975 | 5,225 | 5,725 | 7,725 | 10,225 |

- A typical learner earns about 70 XP a day including quests. They reach Level 2 on day one, Level 10 in about 3 weeks, Level 20 in about 11 weeks, and then level up roughly weekly forever.
- **Displayed total XP** = Σ over months of `max(xpMonths[m], live capped activity XP for m)` + Σ over months of `max(questMonths[m].xp, live quest claims XP for m)` (§3.1).
  - Taking the larger of the stored rollup and the live figure means the total **never falls** when old activity entries are pruned.
- **When XP is shown:**
  - Only at the end of a finished sitting, as "+N XP".
  - N = the *counted* change, i.e. the total after minus the total before.
  - Never during a session; DESIGN.md's no-mid-session-score rule stays.
  - If N is less than what the sitting earned, add this line: "Today's XP limit is reached. This practice still counts for your streak, goal and quests."
  - If N = 0 (daily phrase practice), the XP line is not drawn.
- **Guest practice from onboarding earns no XP**, keeping `firstRun.test.ts` and the F703 bans. When the learner chooses "Keep this practice" (`@/onboarding/GuestAccountHandoff.tsx:118`) and the claim succeeds, call `recordActiveDay(firstAcceptedAttempt.at)`. The first reply then becomes **day 1 of the streak**, a real persisted practice, and the flame lights on the "Your phrase is saved." screen.

#### 2.6 Daily goal

`core/goal/goal.ts`:
- `DAILY_GOAL_TIERS`:
  - `casual` 5, "Casual", "A quick moment of French"
  - `regular` 10, "Regular", "Room for a full scene"
  - `serious` 15, "Serious", "A longer conversation"
  - `intense` 20, "Intense", "Conversation plus practice"
- `goalProgressFrom({ sittings: {at; activeMs?}[]; target: 5|10|15|20|null; today })` returns `{activeMs, minutes, target, met, untimed}`.
  - This is the rule from `momentum.ts:328-360`, moved to core. Minutes are rounded down; an entry with no `activeMs` counts as untimed, never as 0.
  - `momentum.ts`'s `goalFrom` delegates to it, so the unpinned "Phase 1B" tests prove there is still one rule.
- The sittings it sums are activity entries (convo, lesson, drill, review) plus zero-XP sittings from `game.sittings` (§3.1). Daily phrase practice gains a clock: add `useActiveClock` to `@/daily/DailyPracticeScreen.tsx`.
- Profile keeps a "No daily goal" option. Onboarding offers only the four tiers (owned by the onboarding section).

#### 2.7 Daily quests

`core/quests/`:
- `QUEST_XP = 10` per quest, `CHEST_XP = 15` when all three are done, `MONTHLY_QUEST_TARGET = 30`.
- `questsForDay({day, seed, eligibility, goalTarget}) → [QuestId, QuestId, QuestId]`:
  - Deterministic: seeded random (mulberry32) over an FNV-1a hash of `${seed}|${day}`. `seed` is the account uid, so two devices get the same three without storing anything.
  - One quest per slot (easy, core, stretch), never two from the same family.
  - On day one (no practice days yet), the set is fixed: `finish-practice`, `phrase-of-day`, `minutes`.
  - The day's selection is saved the first time it is computed (`game.questDays`), so a change in eligibility later that day never reshuffles it.
- **Never offered:** a quest that needs speaking aloud (every spoken path has a quiet alternative) or one that needs live minutes when none remain.

| id | Slot | Title (exact) | Target | Real data source | Where that data is written (hook) | Eligible when |
|---|---|---|---|---|---|---|
| `finish-practice` | easy | "Finish a practice" | 1 | finished sittings today (activity + `game.sittings`) | `settleSitting` (§3.3) | always |
| `phrase-of-day` | easy | "Say today's phrase" | 1 | `game.sittings` with source `phrase` today | `@/daily/DailyPracticeScreen.tsx:145-155` | always |
| `practise-twice` | easy | "Practise twice today" | 2 | finished sittings today | `settleSitting` | at least 1 practice day |
| `review-recall` | easy | "Remember 5 phrases in review" | 5 | Σ `xp` of today's `review` entries (= cards recalled, `levels.ts:113`) | `@/ReviewScreen.tsx:109-120` | at least 5 phrase cards in the deck |
| `conversation` | core | "Finish a conversation with {tutor}" | 1 | today's `convo` entries | `@/ConvoScreen.tsx:557-572` | live seconds > 0 (`BillingStatus.secondsRemaining`) |
| `practice-set` | core | "Finish a short practice set" | 1 | today's `drill` entries + `game.sittings` with source `drill` | `@/DrillScreen.tsx:1162`, `@/practice/completion.ts:225` | always |
| `xp` | stretch | "Earn {30/40/50/60} XP" (by goal tier) | n | counted activity XP today (quest XP excluded) | all activity writes | always |
| `minutes` | stretch | "Practise for 5 minutes" | 5 | `goalProgressFrom(...).minutes` | screens' `ActiveClock` | always |
| `new-phrases` | stretch | "Add 3 new phrases to your deck" | 3 | non-sound deck cards with `addedAt` today (`core/review/scheduler.ts:45`) | `addPhrases` `@/review/store.ts:219` | always |
| `scene-on-own` | stretch | "Finish a scene on your own" | 1 | a mission completion today with `independence === 'on-your-own'` (`core/missions/missions.ts:180`) | `recordMissionCompletion` `@/missions/store.ts:127` | at least 1 conversation ever and live seconds > 0 |
| `sound-check` | stretch | "Try a sound check" | 1 | a `soundChecks` attempt today | `@/soundcheck/SoundCheckScreen.tsx:113-170` | always |
| `goal` | stretch | "Meet your daily goal" | 1 | `goalProgressFrom(...).met` | — | a goal is set |

- `questProgress(id, facts: DayFacts) → {done, target, complete}`. Progress is capped at the target.
- Completing a quest writes a claim `{day, questId, xp: 10, at}`. Completing all three writes `{day, questId:'chest', xp: 15}`.
- **Monthly badge:** `quests-YYYY-MM` once the month's claims (chest excluded) reach 30.

#### 2.8 Milestone badges

`core/badges/catalogue.ts`: `BADGES: {id, title, line, art, test(f: BadgeFacts): boolean}[]` and `newBadges(facts, awarded) → id[]`. Once a badge is awarded it is saved permanently (§3.1), so pruned data can never take it back.

| id | Title | Exact trigger | Vector art built in code (flat, palette tokens, no faces or gradients) |
|---|---|---|---|
| `streak-7` | "One week" | `streak.current` reaches 7 | Round sun medal; coral flame with a sun core; "7" in the flame's base |
| `streak-30` | "One month" | reaches 30 | Mint medal; flame with two side sparks |
| `streak-100` | "100 days" | reaches 100 | Blue medal with 12 tick marks; three-layer flame |
| `streak-365` | "One year" | reaches 365 | Flame inside a laurel of 12 leaves |
| `days-50` / `days-200` | "50 practice days" / "200 practice days" | `lifetimeDays` reaches 50 / 200 | A stack of three notebook pages with a ribbon tab |
| `first-conversation` | "First conversation" | first `convo` activity entry | Overlapping white and ink speech bubbles |
| `scene-own` | "On your own" | first mission earned (`isEarned`) | Postcard stamp with a perforated edge and a check |
| `path-a0` | "All beginner scenes" | every A0 scene earned (`spineFrom`, `core/missions/spine.ts:43`) | Seven small stamps in an arc |
| `phrases-25` / `phrases-100` | "25 phrases kept" / "100 phrases kept" | non-sound deck cards reach 25 / 100 | Bookmark ribbon with the number |
| `recall-100` | "100 recalls" | Σ(reps − 1) over phrase cards reaches 100 (the same `right` as `momentum.ts` `masteryFrom`) | Two circular arrows around a card |
| `goal-7` | "Goal met 7 times" | `game.goalDays` reaches 7 | A closed mint ring with a check |
| `level-10` / `level-25` | "Level 10" / "Level 25" | `xpLevelFor(total).level` reaches the number | Star medal with the number |
| `sound-first` | "First sound check" | first `soundChecks` attempt | Waveform medal |
| `quests-YYYY-MM` | "{Month} quests" | 30 quest claims in that calendar month | Chest medal with a banner |

### 3. Storage, writes and sync

#### 3.1 New synced namespace `game`: `userKey('game')`, inner version 1

```ts
{ version: 1,
  sittings:   { at: number; source: 'phrase'|'drill'|'review'|'guest'; activeMs?: number }[]; // finished sittings with 0 XP; union by `${at}|${source}`; prefer the copy with activeMs; keep 60 days from newest
  covers:     StreakCover[];                    // union by day; keep the earliest `at`, then kind order travel<earned<freeze; never pruned (cap 2000)
  goalDays:   DayKey[];                         // sorted set union
  questDays:  { day; ids: [QuestId,QuestId,QuestId]; at }[]; // union by day; earliest `at` wins; keep 60
  claims:     { day; questId: QuestId|'chest'; xp; at }[];   // union by `${day}|${questId}`; earliest; keep 62 days, then roll into questMonths
  questMonths:{ month: 'YYYY-MM'; count; xp }[]; // per month: the side with the higher count wins whole (max: commutative, idempotent)
  xpMonths:   { month; xp }[];                  // capped activity XP per month; max per month
  badges:     { id; at }[];                     // union by id; earliest `at`
  seen:       { key; at }[];                    // celebration keys; union; day-scoped keys kept 60 days
}
```

- Every rule here is a set union or a max, so it is **commutative and idempotent**, which is what `policy.test.ts` "every merge policy is commutative and idempotent over generated blobs" property-tests.
- Size grows by about 4 KB a year, well inside the envelope limit.
- `seen` is synced so a celebration already played on iPad never replays on iPhone.
- The store follows `activity.ts`'s structure:
  - one serialised write chain;
  - `writeInUserScope` with `scopeGeneration` bound when the work is queued;
  - `markDirty('game')` only for local writes;
  - an adopter registered at load and again on `onUserScopeReset`;
  - strict reads that refuse unknown bytes.
- Owner: `data-engineer`.

#### 3.2 Device-local namespace `gameLocal` (add to `SYNC_EXCLUSIONS` with a reason)

Contents:
- `lastPracticeOffsetMin`, used by travel cover;
- `paidSince: DayKey | null`, reset when a non-paid plan is observed;
- `nudges: {day, fireAt, variant, opened?}[]`, last 30;
- `nudgesPausedAt`;
- `introducedAt`;
- `pending`: a persisted celebration queue, so a crash replays it.

Reason to write in `SYNC_EXCLUSIONS`: "The OS schedule, timezone and the plan observed are facts about this phone; syncing them would nudge one learner twice and let one device's billing read decide another's." This matches the existing `reminder` exclusion (`policy.ts` exclusions).

#### 3.3 The write pipeline: `@/game/settle.ts`

```ts
export type SittingSource = 'convo'|'lesson'|'drill'|'review'|'phrase'|'guest';
export interface GameDelta { key: string;
  xp: { earned: number; counted: number; capped: boolean; totalBefore: number; totalAfter: number };
  goal: { target: number|null; minutesBefore: number; minutesAfter: number; metNow: boolean };
  streak: { before: StreakState; after: StreakState; extendedNow: boolean; milestone: number|null; restoredBy: CoverKind|null };
  quests: { completedNow: QuestId[]; chestNow: boolean; bonusXp: number };
  level: { before: number; after: number }; badges: string[] }
export function beginSettle(): Promise<SettleToken>;   // snapshot before the write
export function finishSettle(t: SettleToken, s: { source: SittingSource; at: number; xpEarned: number; activeMs?: number }): Promise<GameDelta|null>;
export function settleSitting(s: {...; write: () => Promise<PersistAck>}): Promise<GameDelta|null>; // begin + write + finish
```

`finishSettle` runs these steps on one serialised chain:
1. If `xpEarned <= 0`: call `recordActiveDay(at)` and append to `game.sittings`.
2. Apply covers from `freezesToApply`, `earnBackOffer` and `travelCover`.
3. Add today to `goalDays` if the goal was just met.
4. Write quest claims.
5. Write badge awards.
6. Update the `xpMonths` and `questMonths` rollups.
7. Diff the before and after snapshots into events, skipping any key already in `seen`.
8. Mark those keys seen and enqueue them with `useCelebrate()`.
9. Re-plan reminders, cancelling today's.

It returns `null` and does nothing if the account scope changed. `recordActivity` changes from returning `Promise<void>` to returning `Promise<PersistAck>`, so it reports whether the write landed, as `recordActiveDay` already does.

| Practice | Hook | Change |
|---|---|---|
| Live conversation | `@/ConvoScreen.tsx:557-572` | Replace `void recordActivity('convo',…)` with `void settleSitting({source:'convo', write: () => recordActivity(...)})`, **inside the existing `!stopped` guard**. A safety stop settles nothing (F137). |
| Guided lesson | `@/nav/RootNavigator.tsx:185-210` (`finish`) | The same, with source `lesson`. |
| Drill bank sitting | `@/DrillScreen.tsx:1162-1167` | `settleSitting`, source `drill`. A finished sitting with 0 XP still counts. |
| Practice sitting | `@/DrillScreen.tsx:1356-1374` around `completePracticeSitting` (`@/practice/completion.ts:276`) | `beginSettle()` before the call; `finishSettle()` only when `status === 'completed'`. The durable plan stays the only writer. |
| Review | `@/ReviewScreen.tsx:109-120` | Settle when the queue empties (the finished state at `:176-188`). Keep the unmount bank as the fallback for leaving early. A finished sitting with at least 1 grade and 0 recalled counts as source `review`. |
| Daily phrase / free offline practice | `@/daily/DailyPracticeScreen.tsx:145-155` | After `recordActiveDay` reports `durable`: `finishSettle({source:'phrase', xpEarned:0, activeMs})`. |
| Guest first practice | `@/onboarding/GuestAccountHandoff.tsx:118-135` | After `adoptGuestUsage`: `recordActiveDay(attempt.at)` then `finishSettle({source:'guest'})`. |
| App foreground / Home focus | `GameProvider` | Recompute and diff against `seen` **quietly**, with no takeovers. This catches crashes and sync arrivals, and applies covers. |

#### 3.4 Supabase and sync

- **`sync/policy.ts`:**
  - Add `{namespace:'game', merges:'set-union', writes:1, rule:'sittings, covers, goal days, quest days and claims, badges and seen keys union by identity with the earliest record; monthly XP and quest rollups take the max'}`.
  - Add the `gameLocal` exclusion.
  - Update the header count: twenty-five namespaces become twenty-seven, fifteen synced and twelve excluded.
- **New migration** `supabase/migrations/<timestamp>_learner_state_game.sql`:
  - Copy the shape of `202609250001_learner_state_goal_steps.sql`: drop `learner_state_namespace_check` if it exists, then re-add it as a superset with `'game'`.
  - Add the rollback `supabase/rollback/<timestamp>_down.sql`.
  - **It must be applied before the build ships.** Otherwise every push of `game` is refused with a 400 and retried forever (the F411 failure).
- **No server-side streak logic.** Everything is derived on the device from synced facts.

#### 3.5 Profile version 9 (Intense, 20 minutes)

Changes needed:
- `GoalMinutes = 5|10|15|20` in `@/profile/dailyGoal.ts:23` and `StoredProfile.dailyGoalMin` in `@/profile/store.ts:148`;
- `storedGoal` in `@/profile/upgrade.ts:71`;
- `validValue` in `preferenceClock.ts:24`;
- `version: 9`;
- `policy.ts` profile `writes: 9`;
- STATE_AND_STORAGE.md ("returns a version-9 profile").

Version 9 is required. Without it, an older build would reduce 20 to `null` and push that back to every device. With it, older builds go quiet on profile sync until they update (sync rule 2). Stop writing `practiceDaysPerWeek`, but keep reading it so nothing breaks.

#### 3.6 Existing learners (decided honestly)

On first launch with this layer, when `gameLocal.introducedAt` is absent:
- **Seed the streak from the existing practice days.** They are durable records of real practice, so the number is true, not invented.
- Award every badge that can be derived now, dated from the data (for example the first `convo` entry's `at`), or dated now when it can't be.
- Write the `xpMonths` rollups.
- Mark every current streak, level, milestone, badge and today's quest key as **seen**, so there is no burst of level-ups or badges.
- Show one sheet:
  - title "Your streak and level";
  - body: `You are on a ${n}-day streak and at Level ${L}, counted from the practice already saved on your account.`;
  - when n = 0: "Your next practice starts a streak. You are at Level {L}, counted from the practice already saved on your account.";
  - one "Continue" pill.
- Existing goals 5, 10 and 15 map to Casual, Regular and Serious; null stays "No daily goal".
- Paid subscribers start with 2 freezes, and `paidSince` is set to today.
- Known undercount: practice days that older releases pruned before activity version 2 cannot be recovered (`docs/STATE_AND_STORAGE.md:8-11`). The words "already saved" are chosen so the copy stays true.

### 4. Surfaces

All copy lives in `@/game/copy.ts`, as exported constants and builder functions, so tests can read it.

**Home** (`@/tabs/HomeTab.tsx:140-189`). New order:
1. `TabHeader`
2. **`<TodayHero />`**
3. `NextTaskCard` / `StarterContinuation`
4. **`<QuestsCard />`**
5. day-one start card / week lines
6. `DailyCard`
7. friends
8. library link

Remove `<DayCount />` (`:161`); its lifetime line moves into the hero.

`game/TodayHero.tsx` is a white `Card` with two pressable halves. Each half is at least 44 pt, has a role and has an `accessibilityLabel`. The halves sit side by side and wrap to a stack when Dynamic Type makes them too wide. There is no `numberOfLines` and no literal width; the ring size comes from a theme constant, as the F409 scan requires.

| State | Left half (opens the Streak screen) | Right half (opens the Goal sheet) |
|---|---|---|
| Never practised | Unlit outline flame (56 pt). "Start your streak today". "Your first day of French starts with practice." (`lifetimeDayLine`, `@/progress/dayCount.ts:3-7`, reused) | Empty ring (64 pt, 8 pt stroke). Centre "{target} min goal", or "Set a daily goal" when no goal is set |
| Streak alive, not yet today | Dim flame. "{n}-day streak". "Practise today to reach {n+1}" | Ring at minutes ÷ target. Centre "{m} min" or "Under a minute" |
| Practised today | Lit flame with a flicker loop. "{n}-day streak". "Today counts" | Same ring; when met: full mint ring with a drawn check and "Daily goal met" |
| Reset, but has a lifetime total | Unlit flame. "Start a new streak today". "{N} days you have practised" | — |
| A freeze was just applied | Lit or dim flame plus a snow mark. Sub-line "A freeze covered yesterday" | — |
| Earn-back open | Flame with a dashed outline. "Bring back your {n}-day streak". "Finish two practices today" plus two dots (accessibility label "One of two practices done") | — |

- Accessibility labels: `"${n}-day streak. ${lifetime}. Opens your streak."` and `"${m} of ${target} minutes practised today. Opens your daily goal."`
- The flicker loop runs only while the screen is focused and the app is in the foreground (J7). With Reduce Motion it is a still image.

**`game/QuestsCard.tsx`** (white Card):
- Header: "Daily quests", with the chest `AnimatedIcon` on the right.
- Three rows, each with:
  - a Bulk icon (28 pt);
  - the title (`type.body`);
  - a `LivingBar` (8 pt tall);
  - a progress label in `type.small`: "1 of 2", or a check once done.
- Footer: "New quests tomorrow". **There is no countdown.**
- Tapping it opens `QuestsSheet` in the shared `BottomSheet`. The sheet shows the rows with "+10 XP"; a chest row reading "Finish all three to open the chest" / "Chest opened: +15 XP"; and the month: "{Month} quests", `${count} of 30 this month`, a `LivingBar` and the medal preview. Explainer text: "Quests are picked each day from things you can do today. They count only practice you finish."

**Streak screen.** New route `Streak` (`@/nav/types.ts`, `RootNavigator.tsx` stack), file `@/game/StreakScreen.tsx`, header "Your streak". From top to bottom:
1. **Hero.** Large flame (120 pt); `CountUp` numeral; "day streak"; lifetime line; "Longest streak: {L} days".
2. **Today line.** "Today counts. See you tomorrow." or "Practise today to reach {n+1}."
3. **Week strip** (Mon–Sun). Each day is a practised flame dot, a covered snow mark, an open circle, a pulsing outline for today-open, or a faint future dot.
4. **Month calendar** (`game/PracticeCalendar.tsx`).
   - Practised days are filled sun circles. Covered days are outlined with a freeze, earn-back or travel mark. Days in one run are joined by a continuous bar. Today has a ring.
   - Previous and next arrows go back as far as the first practice month.
   - Each cell's accessibility label reads like "3 October, practised", "…, covered by a freeze", "…, no practice". There is no "missed".
5. **Freezes card.**
   - For subscribers: "Streak freezes", "{k} ready" with k freeze icons, and "If a day gets away from you, a freeze covers it automatically. A used freeze comes back a week later." With none left: "Both freezes are in use. One comes back on {weekday d month}."
   - For free users: "Streak freezes come with a plan. A freeze covers a day automatically when life gets busy." plus an `IconAction` "See plans" leading to `Wall`.
   - **The "See plans" action is hidden while `gap.length > 0` or earn-back is open.**
6. **Milestones row.** Medals for 7, 30, 100 and 365. Reached ones are coloured and show their date. The next one says `${target − current} days to your ${target}-day milestone`.
7. **Earn-back card** when it is open, with the same copy as the Home hero plus a 2-step `LivingBar`.

**Progress tab** (`@/tabs/MyFrenchTab.tsx:153-221`). After the header:
1. **`StreakLevelRow`**: two compact tiles. One is the flame with "{n}-day streak"; the other is **`XpLevelCard`** with "Level {L}", a `LivingBar` showing `intoLevel/levelSpan`, "{toNext} XP to Level {L+1}" and "{total} XP in all".
2. The existing can-do proof or `LevelCard`. The CEFR "A0" stays separate and is never called a "level number".
3. **`BadgeShelf`**: a horizontal row of earned medals, newest first, followed by "Next up": three upcoming badges as outlined shapes with their trigger line, for example "Reach a 30-day streak". The word "locked" is never used.
4. **`PracticeCalendar`** (the current month only) with `weeklyDayLine` as its caption (`dayCount.ts:9-17`, reused), linking to the Streak screen. This replaces `<DayCount weekly />` (`:195`).
5. The existing ledgers.

**Profile** (`@/tabs/ProfileTab.tsx:244-283`):
- `<DayCount />` (`:259`) becomes **`<StreakSummary />`**: flame, "{n}-day streak", the lifetime line, "Level {L} · {total} XP" and a "Badges" row leading to Progress.
- The goal row becomes "Daily goal", with Casual, Regular, Serious, Intense and No daily goal.
- **Remove "Days a week"** (`:276-283`).

**Settings** (`@/settings/SettingsScreen.tsx:821-845`):
- Add a "Mention my streak" switch under the reminder (on by default).
- Add a time preset "When I usually practise" with a computed hint, for example "around 7:30 pm" (§6).

### 5. What plays after a session

The finished-session screen shows `practice-complete` straight away. When its XP count-up finishes, wait `DUR.base` (260 ms), then `CelebrationHost` plays the queue in this order: `goal-met` → `streak-extended` / `streak-milestone` → `quest-complete` → `level-up` → `badge-earned`.

- **At most three full-screen takeovers.**
  - Goal and streak combine into one "Today" takeover (the ring closes, then the flame lights).
  - Level-up and badges combine when both happen.
  - Anything left over shows a small "New" glint on the Home hero.
- Every takeover needs a "Continue" tap; nothing advances by itself.
- Celebrations that arrive by sync or on app foreground are quiet: no takeover.
- With Reduce Motion, every takeover shows its final frame. Sound and haptics follow their own Settings switches.

| Event (idempotency key) | When it fires | What it shows (data) | Motion (shared tokens) | Sound / haptic |
|---|---|---|---|---|
| `practice-complete` (`sitting:${source}:${at}`) | every settled sitting | End card: `XpEarned` "+{counted} XP", plus the cap line if any | `CountUp` from 0 to counted over `DUR.celebrate` 900, `EASE.out`; card `StaggerIn` 40 ms | `complete` + `celebrate()`; `count-tick` throttled to at least 70 ms and `tick()` at most 8 times |
| `goal-met` (`goal:${day}`) | minutes cross the target for the first time that day | "Daily goal met", plus `GOAL_MET` reused from `momentum.ts:226`: "Your practice target is complete. Anything else is a bonus." | `ProgressRing` from old to 1 over 900 ms `EASE.out`; mint `Bloom` 420 ms; check drawn 260 ms | `correct` + `arrived()` |
| `streak-extended` (`streak:${day}`) | first finished practice of the day, or an earn-back completed | Title "{n}-day streak". Body "Your streak starts today." (n = 1), "Another day of French." or "Your {n}-day streak is back". Week strip. Lifetime line | Flame scale 0.4 → 1, `SPRING.pop`; `Burst` of 8 sun particles at +180 ms; numeral flips (translateY −12 + fade, 260 ms); today's strip cell `Bloom` at +120 ms | `streak` + `celebrate()` |
| `streak-milestone` (`milestone:${runStart}:${n}`) | `milestoneCrossed` (replaces extended) | 7: "One week of French". 30: "A month of French". 100: "100 days of French". 365: "A year of French". Each with body "You have practised {n} days in a row." | As above, plus a medal drop (`SPRING.settle`) and a `Glint` on Continue | `streak` + `celebrate()` (two light pulses) |
| `quest-complete` (`quest:${day}:${id}`; chest `chest:${day}`) | a claim is written | Bottom sheet: done rows "+10 XP"; if it is the chest, "All three quests done" "+15 XP" | Row check `SPRING.pop`; chest bounces twice (scale 1 → 1.06, `SPRING.pop`), lid rotates 0 → −28° over 260 ms, `Burst` of 10 particles, "+15 XP" rises 24 pt | `quest` + `arrived()` |
| `level-up` (`level:${L}`) | the display level goes up | Blue takeover: "Level {L}", "Earned from the French you produced.", a bar refilling to the new progress | Numeral scale 0.4 → 1 `SPRING.pop`; `Burst` of 14; `Glint` | `levelup` + `celebrate()` |
| `badge-earned` (`badge:${id}`) | `newBadges` returns something | Medal, title, line, for example "You practised 7 days in a row." | Medal drops from −40 pt with `SPRING.settle`; `Glint` 420 ms | `badge` + `arrived()` |

- **Never celebrated:** a safety stop (no settle at all, F137), an abandoned sitting, a freeze being applied (shown only as a quiet sub-line), a sync arrival, or the migration seed.
- **Sound timing:** sounds play only after the room has closed. The recap and end screens have no open microphone and no tutor audio playing.

### 6. Streak reminder

**Architecture.** `reminders/` becomes a scheduler that knows nothing about practice.
- `@/reminders/schedule.native.ts` gains:
  - `scheduleNudges(plan: readonly Nudge[])` (DATE triggers; fire times arrive already computed in the plan, so the module still reads no clock);
  - `cancelNudge(day)`;
  - `onNudgeOpened(cb)`, wrapping `addNotificationResponseReceivedListener`;
  - `lastNudgeOpened()`, wrapping `getLastNotificationResponseAsync`.
  - Check these against the Expo 57 versioned docs first (`apps/mobile/AGENTS.md`).
  - The web twin in `schedule.ts` returns `unavailable`.
- The decisions live in `core/streak/nudge.ts` and `@/game/nudges.ts`:

```ts
export function planNudges(i: { today; nowMs; practisedToday: boolean; streak: StreakState; time: {hour;minute};
  weekdays: number[]|null; paused: boolean; horizon: 7; at: (day, h, m) => number }): { day; fireAt; variant: 'streak'|'milestone-eve'|'routine'; count: number }[];
export function habitTimeFrom(practiceAts: readonly number[], tzOffsetMin: number): { hour; minute } | null; // median local minute of each day's first finished practice, last 14 practice days, minus 30 min, floored to :00/:30, clamped 09:00–21:30; null with fewer than 3 days
export function ignoredRun(log, practiceDays, nowMs): number; export const NUDGE_IGNORE_LIMIT = 5;
```

**Rules:**
- **At most one per day.** Each identifier is `luvani-nudge-${day}`.
- **Skipped on any day the learner has already practised.** `settleSitting` cancels today's nudge, then re-plans.
- Planned 7 days ahead, and re-planned on every app foreground and every settle. It only runs when reminders are enabled and permission is granted, and only on the chosen weekdays.
- **Today:** included only if not yet practised and the fire time is still ahead.
- **Tomorrow:** if the learner practised today and the streak is at least 1, variant `streak` with count n. Otherwise `routine`.
- **Day 2 onward:** `routine`. Its copy cannot depend on the future.
- **Fire time:** the chosen preset, or `habit`. `habit` becomes the default for new setups once there are at least 3 practice days; until then the default stays 18:00.
- **Auto-stop:** when `ignoredRun` reaches 5 (fired, not opened, and no practice that day), set `nudgesPausedAt`, schedule nothing, and show once on Home and as the Settings row value: "Reminders are paused, since they did not seem to help lately. You can turn them on again in Settings." Reminders resume on the next finished practice or the Settings switch.
- **In the foreground:** the notification handler returns `shouldShowBanner: false` while the app is open.

**Copy.** The variant is picked deterministically by `hash(day) % 3`, the tutor name comes from the learner's profile, and the number is always n:

| Variant | Title | Body |
|---|---|---|
| streak A | `Your ${n}-day streak is waiting` | `Today's phrase takes about a minute.` |
| streak B | `Day ${n+1} is ready when you are` | `${tutor} has a phrase for you.` |
| streak C | `A moment of French?` | `One short practice continues your ${n}-day streak.` |
| milestone eve (n + 1 ∈ milestones) | `Day ${n+1} is one practice away` | 7: "A full week of French is within reach." 30: "A whole month of French is within reach." 100: "100 days of French is within reach." 365: "A year of French is within reach." |
| routine | `REMINDER_TITLE` (`reminder.ts:148`) | `REMINDER_BODY` (`:158`), unchanged |

With "Mention my streak" off, every day uses the routine copy. Freezes and plans are never mentioned in a notification.

**Deep link.** Notification data: `{kind:'nudge', day, open:'phrase'|'home'}`.
- `App.tsx` registers `onNudgeOpened`.
- For a streak or milestone-eve variant on a day not yet practised, it calls `navigationRef.navigate('DailyPractice', { id: todayItems(...).phrase.id })`. That is a free, offline practice of about a minute that counts for the streak.
- Otherwise it opens `Tabs` (Home).
- Either way it marks `opened: true` in the nudge log.
- A cold start uses `lastNudgeOpened()` once the account scope has resolved.

### 7. Product rules rewritten

**PRODUCT.md:92-133.** Replace both bullets with the text below. It keeps every phrase F414 checks for.

> **No streak guilt.** Luvani counts a daily streak, and it is built so that it never shames or threatens. The founder reversed the earlier refusal on 2026-10-04. A streak day is any finished practice on the learner's local calendar day: a live conversation, a guided lesson, a practice set, a review, today's phrase, or free offline practice. Running out of live minutes never breaks a streak, because the free practices count. The number is the practice days in the current run. A day covered by a freeze, an earn-back or a travel day keeps the run and adds nothing to it. Freezes come with a paid plan and are applied automatically. Nothing is ever offered for sale as a way to repair a streak that has ended. Streak copy states facts ("Your 12-day streak is waiting") and never shames or threatens: no "lose", "at risk", "last chance", countdowns or sad faces. A reset never shows a nought on its own: the lifetime count of practice days sits beside the streak wherever it appears, and that lifetime count only ever rises. History: the Days active tile (2026-09-05 to 2026-09-27) was not the streak refused twice before it. It only ever rises, yesterday is never read, there is no state a loss could be written into, it was present from the first day and worded as a start. Those properties now belong to the lifetime count.
>
> **XP, levels, quests and badges are shown, and stay honest.** The level path still shows evidence: a CEFR level (A0, then A1) and one can-do line per scene, earned only on independence evidence (`isEarned`, `spineFrom`). Separately, the learner sees numbered levels (Level 1, 2, 3…), never rank names. XP counts only French the learner produced (words said, turns composed unaided, phrases resolved, cards recalled), plus fixed bonuses for daily quests that are themselves completed by finished practice. Never minutes elapsed, sessions started or app opens. Practice XP is capped at 150 a day for the displayed total, and the content difficulty keeps its own 100 cap, so a marathon buys nothing. XP is shown at the end of a finished practice and never during one. Every celebration names a persisted event; a safety stop earns and celebrates nothing. There are no leagues, leaderboards, paid currency or random rewards.

**`@/copy/guilt.ts`:**
- Remove `'streak'` from `BANNED_IN_COPY` (`:33`) and add `RETIRED_FROM_BAN = [{ word: 'streak', by: 'founder decision 2026-10-04: a full daily streak' }]`.
- Keep every shaming word.
- Add `BANNED_IN_STREAK_COPY = [...BANNED_IN_COPY, 'at risk', 'last chance', 'hurry', 'ends tonight', 'midnight', 'before it ends', 'save your streak', 'disappear', 'miss you', 'ignor', 'disappoint', 'shame', 'sad', 'hours left', 'minutes left']`. It applies only to `game/copy.ts` and the nudge copy. It is kept separate so that words like "protect" in privacy copy are not swept up.

**`@/progress/today.ts` and its test: delete.** It has no importer and no pinned titles. Its single job, sittings today, becomes the `practise-twice` quest. Update the comment citations in `@/progress/evidence.ts:7`, `@/myfrench/copy.ts:20`, `momentum.ts:133`, `guilt.ts:30` and `reminder.ts:55`.

**`momentum.ts`: keep.** It has 8 pinned titles, and `isRetained`, `retainedOrder`, `calendarWeekFrom` and `rhythmSentence` are still in use. `goalFrom` delegates to core `goalProgressFrom`. F440 still bans `momentumFrom`, `DAYS_LABEL` and `days.count` on every screen, so the new code must not use the name `days.count`.

**DESIGN.md:**
- `:15`: remove "decorative badges, streaks, XP".
- `:22-24`: Home now offers "the streak and today's goal, the next action, daily quests…".
- `:40-43`: "Its calendar shows practice days and covered days; Profile carries the streak and lifetime count." Remove "Neither becomes a streak, deadline or target".

### 8. Files touched

**Create:**
- In core: `streak/{dayKey,streak,freeze,cover,nudge,index}.ts`, `goal/{goal,index}.ts`, `quests/{catalogue,select,progress,index}.ts`, `badges/{catalogue,award,index}.ts`, each with a `*.test.ts`.
- In the app: `@/game/{model,events,store,localStore,settle,nudges,copy,hooks}.ts`, each with a `*.test.ts`.
- `@/game/{GameProvider,TodayHero,QuestsCard,QuestsSheet,GoalSheet,StreakScreen,PracticeCalendar,XpLevelCard,StreakLevelRow,BadgeShelf,StreakSummary,XpEarned,LevelIntroSheet}.tsx`.
- `@/game/art/{Flame,Chest,Medal,FreezeMark}.tsx`. These sit outside `art/flat`, so the 29-drawing pin is not affected.
- `supabase/migrations/<timestamp>_learner_state_game.sql` and its `supabase/rollback/*_down.sql`.

**Edit:**
- In core: `levels/levels.ts`, `levels/index.ts`, `index.ts`.
- In the app:
  - `progress/activity.ts` (`recordActivity` returns `PersistAck`)
  - `progress/momentum.ts`, `copy/guilt.ts`, `profile/{dailyGoal,store,upgrade}.ts`, `purchases/capabilities.ts` (`streakFreezes: 0|2`, plus `INCLUSIONS.freezes` "Streak freezes for the days life gets busy", with revenue-engineer sign-off)
  - `reminders/{schedule.native,schedule,reminder,store}.ts`, `sync/policy.ts`
  - `tabs/{HomeTab,MyFrenchTab,ProfileTab}.tsx`, `settings/SettingsScreen.tsx`
  - `ConvoScreen.tsx`, `RecapScreen.tsx`, `SummaryScreen.tsx`, `DrillScreen.tsx`, `ReviewScreen.tsx`, `daily/DailyPracticeScreen.tsx`, `onboarding/GuestAccountHandoff.tsx`
  - `nav/{RootNavigator.tsx,types.ts}`, `App.tsx`
- `packages/brain/src/profile/preferenceClock.ts`.
- `PRODUCT.md`, `DESIGN.md`, `docs/STATE_AND_STORAGE.md`, `docs/KNOWN_ISSUES.md`, `docs/DEVICE_VERIFICATION.md`.

**Delete:** `@/progress/today.ts` and `today.test.ts`.

### 9. Tests and docs to change

No ledger-pinned title is renamed. Only assertions change.

| Test (file › title) | Pinned | New assertion |
|---|---|---|
| `copy/guilt.test.ts` › "the shared ban list still carries every word each surface ever banned" | F216 | Check `ONCE_BANNED` minus `RETIRED_FROM_BAN`, **and** assert that `RETIRED_FROM_BAN` contains exactly the word `streak`, so the retired list cannot grow quietly. |
| › "PRODUCT.md records why days active is not the streak it refused — F414" | F414 | Keep all the PRODUCT regexes (the history paragraph keeps them true). Replace `BANNED_IN_COPY.includes('streak')` with the `RETIRED_FROM_BAN` record. Add `/never shames or threatens/`, `/lifetime count of practice days/` and `/any finished practice/`. |
| New: "streak, quest and reminder copy states facts and never threatens" | — | Every string in `GAME_COPY`, `NUDGE_COPY` and the builders at n ∈ {1, 2, 7, 12, 30, 365} passes `BANNED_IN_STREAK_COPY`; no output contains `0-day` or a lone `0`; no em dash. |
| `tabs/HomeTab.test.ts:274` › "day one lists … a slot for the lifetime count" | yes | `<TodayHero />` replaces `<DayCount />`. Order: `TabHeader < TodayHero < NextTaskCard < {start !== null`. `game/TodayHero.tsx` calls `lifetimeDayLine(`. |
| `:325` › "the four tiles, the rail, the old details and every rank name are gone" | no | Take `'streak'` and `'loadActiveDays'` off the gone list and keep `Beginner`, `Veteran`, `standing.name`, `levelName`, `momentumFrom`. Assert `<QuestsCard` comes after `<NextTaskCard`. |
| `:486` › "Home names no weekday, counts no days this week, shows no rate and draws no tag" | yes | Add `TodayHero.tsx` and `QuestsCard.tsx` to `HOME_SURFACE`. Allow `day` only in the outputs of `streakLabel`, `lifetimeDayLine` and `reachLine`. Allow `\d+ of \d+` only in the outputs of `questProgressLabel` and `goalA11y`. Weekday names, "this week", `%`, middot and dash, tags and capsules stay banned. Keep `calendarWeekFrom`, `weekRail` and `DAYS_LABEL` banned. |
| `:607` (F409 scan) | yes | Extend the scan to `game/TodayHero.tsx` and `game/QuestsCard.tsx`. |
| `surfaceContract.test.ts:2165` F440 | yes | Assertion unchanged. Update the comment: the streak is `core/streak`, not momentum. |
| `progress/evidence.test.ts` › "no rank name appears in the stats at any amount of XP — F367" | yes | `rankNames` becomes the literal list of the six retired names (because `levelFor().name` is removed). Also assert that no stat value matches `/^Level \d+$/`. The other two tests are unchanged. |
| `reminders/reminder.test.ts` › "nothing under reminders can read whether the learner practised" | yes | Body unchanged. In `PRACTICE_SYMBOLS`, remove `todayFrom` and `hasToday` (deleted) and add `streakFrom`, `settleSitting` and `loadGame`. Rewrite the header to record the reversal: `game/nudges.ts` now decides, and `reminders/` only schedules. |
| `reminders/schedule.test.ts` › "only the native schedule module touches expo-notifications and its trigger repeats unchanged" | yes | Still exactly one importer and still no clock in the native module. Now allow `SchedulableTriggerInputTypes.DATE` only inside `scheduleNudges`. Drop the DAILY/WEEKLY requirement and the "no DATE" ban (`:254`). |
| New core tests | — | See the next table. |
| `sync/policy.test.ts`: "every synced namespace…", "…database will accept — F411", "the profile row writes the version the store writes", "the storage doc lists…", the commutativity property test | F411 + yes | `game` policy (with a generator for game blobs), `gameLocal` exclusion, the new migration, profile 9, doc counts. |
| `revamp/stage3.test.ts` (pinned titles) | yes | `MyFrenchTab` must contain `<PracticeCalendar`, `<XpLevelCard` and `<BadgeShelf` instead of `<DayCount weekly`. `ProfileTab` must contain `<StreakSummary` instead of `<DayCount />`. |
| `onboarding/answers.test.ts` › "the speaking target is asked in profile and nowhere in onboarding" | yes | The onboarding section owns this one. `DAILY_GOAL_ROW` becomes `'Daily goal'`. |
| `core/levels/levels.test.ts` | — | Existing `levelFor` tests unchanged. Add `xpLevelFor` thresholds: 49 → L1, 50 → L2, 1350 → L10, 5225 → L20, 5725 → L21. Steps never shrink. The `totalXp` cap parameter works. |
| `brain/.../merge.test.ts`, `profile/upgrade.test.ts` | — | 20 is accepted; version 8 upgrades to 9 and keeps 5, 10 and 15. |

**Core test cases:**

| Module | Cases |
|---|---|
| dayKey | daylight-saving days (2026-03-29 and 2026-10-25 in Europe/Paris); 2028-02-29; year rollover; an invalid key is rejected |
| streak | 23:59 vs 00:01; today-open keeps yesterday's run; a covered day bridges but adds 0; a future day is ignored; longest across two runs; lifetime is never less than current |
| freeze | gap 2 with 2 held is covered; gap 3 with 2 held covers nothing; a day before `paidSince` is not covered; not entitled is 0; a freeze on a later-practised day is refunded; the freeze comes back on day + 7 |
| earn-back | a 30-day cooldown; only a 1-day gap; a run under 3 is refused; the second practice applies the cover |
| travel | an offset change of 180 minutes or more with a 1-day gap; once per 7 days |
| quests | the same seed and day give the same three; different days vary; ineligible quests are never picked (no `conversation` at 0 seconds); no duplicate family; the day-one fixed set; progress capped; the monthly count by local month |
| badges | each trigger at its threshold minus 1 and at the threshold; already-awarded badges are never repeated |
| nudge | no nudge for a practised day; a streak variant only for tomorrow after practising today; no nudge after a pause; the habit time median, clamp and fewer-than-3 fallback; `ignoredRun` |

**Docs:**
- STATE_AND_STORAGE.md: the `game` and `gameLocal` stores, the namespace counts, profile version 9, the travel note.
- KNOWN_ISSUES.md:
  - new entries (provisional G-1…G-9: streak model, freezes, earn-back, quests, badges, display level, the game namespace with its migration, reminders, rule rewrite), mapped to the next free F-ids at landing time; F716 is the first one free, and other sections will claim some too;
  - a note on F227 recording the reversal;
  - F241 superseded: its "only Profile can turn the reminder off" guard is replaced by "only `game/nudges.ts` plans or cancels nudges", with the new test as its verified-by line.
- DEVICE_VERIFICATION.md: rows for the nudge being skipped after practice, the deep link, the iPad layout, and silent-switch behaviour.
- IMPLEMENTATION_EVIDENCE.md: add a new gate bullet after running `gate:bless`.

### 10. Owner agent

| Part | Owner | Must sign off |
|---|---|---|
| `core/streak`, `core/quests`, `core/badges`, `core/goal`, `game/model`, copy, reminders, PRODUCT.md rewrite | `progress-retention-engineer` | `learning-science-engineer` (XP, levels, cap, recall badge) |
| `core/levels` changes | `learning-science-engineer` | — |
| `game/store.ts`, `localStore.ts`, profile version 9, `activity.ts` return type | `data-engineer` | — |
| `sync/policy.ts`, Supabase migration and rollback | `data-sync-engineer` | — |
| Freeze entitlement, `capabilities.ts`, plan inclusions, the no-pay-to-repair rule | `revenue-engineer` | — |
| Screens, tabs, navigation, `App.tsx` wiring, Convo/Recap/Summary hooks | `frontend-engineer` | — |
| Drill, Review and DailyPractice hooks | `practice-ux-engineer` | — |
| GuestAccountHandoff day 1 | `onboarding-ux-engineer` | `auth-engineer` |
| Flame, chest and medal art; ring and calendar components; motion | `design-system-engineer` | — |
| F137 (no settle on a safety stop) | — | `privacy-safety-engineer` reviews |
| Release proof | `qa-release-engineer` | — |

### 11. Acceptance checks

1. Finishing a review with 0 recalled extends the streak (it writes a practice day), shows no "+0 XP", and still fires `streak-extended` on the first practice of the day.
2. When a conversation ends in a safety stop: no practice day, no XP, no `seen` key, no celebration (test plus device check).
3. Out of live minutes: Home offers no conversation quest, and today's phrase still extends the streak.
4. A subscriber misses one day and opens the app: "A freeze covered yesterday", freezes go from 2 to 1, the streak number is unchanged. A free user in the same situation sees "Start a new streak today" next to the lifetime count, and **no** plan offer while the gap is pending.
5. Two devices practise offline on the same day: after sync there is one streak day and one set of quest claims, with no double XP, and the second device plays no celebration.
6. An existing learner with 40 practice days in the log sees the intro sheet once, gets no burst of level-ups or badges, and their streak equals the run in their practice days.
7. The displayed total XP never falls after old activity entries are pruned (simulated in a test).
8. The 18:00 nudge does not fire after a 17:30 practice. Five ignored nudges pause reminders and show the note. Tapping a streak nudge opens today's phrase.
9. With Reduce Motion on, every takeover shows its final frame. VoiceOver reads each calendar cell and each ring. Every new control is at least 44 pt. Dynamic Type at the largest size has no clipping. `build:web` passes: the calendar and streak work on web, while notifications and haptics do nothing.
10. Ring sizes and copy on Home pass the F409 scan, and the pill counts are unchanged.

### 12. Risks

- **The title of the pinned reminder test will be partly out of date.** "…and its trigger repeats unchanged" no longer describes one-shot nudges. Under the no-rename rule the title stays and the ledger note records why. Renaming it would need the integrator to update the ledger's verified-by line in the same commit.
- **Profile version 9 and the new `game` namespace go quiet on older binaries.** The Reanimated rebuild means the fingerprint changes anyway, so older binaries never receive this JavaScript; their profile sync pauses until they update. **Apply the whitelist migration before shipping the build.**
- **Adding an activity kind would break older devices.** It is forbidden here; sittings with 0 XP go to `game.sittings` instead.
- **The content-difficulty standing and the displayed level are separate.** Mixing them up silently changes which phrases and scenes a learner gets. A test pins `levelFor(totalXp(activity))` on Home.
- **Moving the device clock forward can fake practice days.** Storage is local-first, so this is accepted; it only affects the learner's own display, and no money is involved.
- **Too many celebrations.** Mitigated by the three-takeover cap and quiet foreground diffs.
- **Two words for "level".** CEFR "A0" and "Level 7" side by side could confuse; the copy keeps them apart ("Where your French is" against "Level").
- **The iOS limit of 64 pending notifications.** The 7-day horizon stays well inside it.

### 13. Open questions for the founder

1. **Earn-back:** should every learner be able to bring a streak back once every 30 days by finishing two practices the day after missing exactly one, free users included? This is my recommendation. Or should streak protection of any kind be limited to paid freezes?
2. **Freeze allowance:** is "2 held, each one back a week after use" the generosity you want for subscribers? The alternative is 2 a month.
3. **Habit-time default:** may new reminders default to "When I usually practise", meaning about 30 minutes before the learner's usual time, kept between 9:00 and 21:30? The alternative is to keep 6 pm as the fixed default.

### Critical files for implementation
- /Users/pravz_07/Documents/StartUps/Luvani/.claude/worktrees/app-engagement-animations-de9910/apps/mobile/src/progress/activity.ts
- /Users/pravz_07/Documents/StartUps/Luvani/.claude/worktrees/app-engagement-animations-de9910/packages/core/src/levels/levels.ts
- /Users/pravz_07/Documents/StartUps/Luvani/.claude/worktrees/app-engagement-animations-de9910/apps/mobile/src/sync/policy.ts
- /Users/pravz_07/Documents/StartUps/Luvani/.claude/worktrees/app-engagement-animations-de9910/apps/mobile/src/reminders/schedule.native.ts
- /Users/pravz_07/Documents/StartUps/Luvani/.claude/worktrees/app-engagement-animations-de9910/apps/mobile/src/tabs/HomeTab.tsx