> Detailed draft spec, written 2026-10-04 and checked against `47fbc2ea`. Where it disagrees with
> [README.md](README.md) Parts 1, 6 or 7 (decisions, resolutions, gate traps), README wins. Read the
> matching review in [reviews/](reviews/) before building from it.

## Core loop: reward moments after onboarding, and the living conversation orb

> **Superseded in part by founder decision D22 (6 October): there are no chests.** Every chest in this spec (the chest drawing, chest XP and claim, the quest-chest takeover and its seen key) is gone; finishing all three quests shows one quiet line, "All three quests done today.", with the quest sound. README Part 1 and Part 6 win.

This section covers every reward moment a learner meets after onboarding. That means drills, practice, review, daily phrase practice, guided lessons, live conversations, recap, saving a phrase, purchase, friends and reminders. It also covers the voice-reactive orb in live rooms. Every claim below was checked against the code at `47fbc2ea`. Paths are relative to `apps/mobile/src/` unless they start with `packages/`, `services/` or a repo-root file.

### 0. Verified current state, and where the code disagrees with the evidence

| Finding | Evidence |
|---|---|
| Drill verdicts are French interface praise. This breaks founder decision 14. | `packages/core/src/drill/session.ts:136-145` (`'Nickel.'`, `Presque. Ça s'écrit «x».`, `Pas tout à fait. On dit: «x».`). The exact strings are pinned by `packages/core/src/copy.test.ts:140-147` ("the three verdict lines are exactly these"). That title is not in the ledger, so it can be edited. |
| Guided-lesson praise is French too. The server publishes it, it is never spoken, and it shows as the flash line. | `packages/core/src/session/session.ts:390-391` (`excellent`, `good` families). Published at `services/tutor-agent/src/tutor.ts:659` and drawn at `SessionView.tsx:247-248`. |
| The verdict beat is a fixed 1,600 ms, with no haptic, sound or motion. The mark is a still 28 pt mint disc that is hidden on a miss. | `DrillScreen.tsx:102`, `:1315-1331`, `:1665-1685`, `:1745` |
| Sitting progress is words only. The test explicitly forbids a bar. | `DrillScreen.tsx:1446-1455`; `DrillScreen.test.ts:584-598` (unpinned) |
| The practice end card deliberately counts nothing. | `DrillScreen.tsx:1559-1596`; `DrillScreen.test.ts:522` asserts no `<Stat`, `s.resolved` or `Got right` (unpinned) |
| **Bug:** keeping an own-words phrase shows "saved" even when the write failed. | `DrillScreen.tsx:1301-1306` does `.then(() => setKept(true))` and ignores the `PersistAck`, although `addPhrases` returns one (`review/store.ts:219-222`) |
| Review XP is written only on unmount, so the end card cannot show it. Finished and empty share the "Nothing waiting." card. | `ReviewScreen.tsx:107-120`, `:172-188` |
| XP is written fire-and-forget and never returned. The daily cap means the XP a sitting computes is not always the XP it earns. | `progress/activity.ts:240-249` (`Promise<void>`); `packages/core/src/levels/levels.ts` (`DAILY_XP_CAP = 100`, `totalXp` caps per day) |
| The live room never mutes haptics while the mic is open. Only GuestRecording does. | `motion/hapticPreference.ts:7-18`; the only caller is `onboarding/GuestRecording.tsx:95` |
| The mic stays published after the recap arrives. | `live/useLiveSession.ts:1104-1124` (no `setMicrophoneEnabled(false)`) |
| The orb speaking bars run a fixed sine loop. The orb has no input level. | `tutor/VoiceOrb.tsx:163-213` |
| app-surfaces says there are no partial transcripts. The wire allows `final:false` (`packages/core/src/protocol/protocol.ts:227`), but the agent only ever publishes `final: true`, so app-surfaces is right in practice. | `services/tutor-agent/src/tutor.ts:451,600`; `convo.ts:2096,2153,2223,2228,2240` |
| Pinned orb structure tests constrain the VoiceOrb rewrite. | `tutor/orbRest.test.ts:159-215` (pinned title "the orb is two rings and a core…"). It asserts `<OrbGlyph color={look.colour} size={size} />`, `transform: [{ scale: breath }]`, no `borderWidth`, and `useNativeDriver: true` loops. |
| The friends challenge completion line is French chrome. | `tabs/FriendsTab.tsx:66` (`'Un peu de français, ensemble.'`) |

### 1. Contracts this section relies on and adds

#### 1.1 Motion vocabulary
The motion section defines the tokens. If its numbers differ from these, its numbers win.

`DUR.micro 120 / fast 180 / base 260 / slow 420 / celebrate 900`; `EASE.out = cubic-bezier(0.22,1,0.36,1)`; `EASE.inOut = (0.65,0,0.35,1)`; `SPRING.press` = 439 / 29.3 / 1 (unchanged); `SPRING.pop` = stiffness 322, damping 21.5 (ratio ≈0.6); `SPRING.snap` = 987 / 50. The primitives are `StaggerIn`, `CountUp`, `ProgressRing`, `LivingBar`, `Burst`, `Bloom`, `ChipFlight`, `Glint` and `MorphButton`, plus `AnimatedIcon`, `celebrate()` / `tick()` haptics and `sfx.play(id)`.

**Rule for every screen in this section:** screens never contain `Animated.`. All motion lives in `motion/`, `celebrate/` or the orb layer files, and screens compose those. This keeps three suites passing unchanged: `sessionScreens.test.ts:101` ("nothing in this pass moves" over ConvoScreen, RecapScreen, SummaryScreen, Transcript and others), `RecapScreen.test.ts:99-104` (bans `Animated` in RecapScreen) and `surfaceContract.test.ts:216-219` (DailyCard static).

#### 1.2 Real numbers: the XP receipt
1. **`packages/core/src/levels/levels.ts`** (learning-science-engineer): add
   `export function xpCreditedFor(entries: readonly DatedXp[], entry: DatedXp): number`, which returns `totalXp(entries) − totalXp(entries without that entry)`. That is the marginal XP after the daily cap.
2. **`progress/activity.ts`** (progress-retention-engineer):
   - `recordActivity` returns `Promise<ActivityReceipt | null>`, typed `{ xpRaw, xpCredited, totalBefore, totalAfter, at, kind, activeMs }`.
   - It returns `null` when `xp <= 0` or the write fails.
   - The fields are computed inside the existing serialized `mutate`.
   - `recordActivityOnce` returns the same receipt alongside its `PersistAck`.
3. **`game/settleWin.ts`** (the game layer; it wraps the game section's stores): `settleWin(kind, receipt | null, key): Promise<WinReceipt>`. It adds:
   - `levelBefore` / `levelAfter` (from `levelFor`)
   - `streak { count, extendedNow, milestone, lifetimeDays }` (lifetime days from `loadActiveDays().length`, `activity.ts:338`)
   - `goal { minutesToday, goalMin, metNow }`
   - `questsDoneNow[]` and `badgesNow[]`
   - It is idempotent per `key`.

   Every number on an end card comes from a `WinReceipt`. The screens never compute `drillXp(`, `conversationXp(` or similar for display.

Display rules:
- If `xpRaw === 0`, there is no XP tile.
- If `xpCredited === 0 && xpRaw > 0`, the tile reads "Today's XP limit reached" with no number.
- Otherwise it shows `+{xpCredited} XP`.

#### 1.3 When sound and haptics are allowed
- `sfx.play` and every haptic go through `audioQuiet()` = sound/haptic preference ∧ no live mic ∧ no tutor audio.
- `useLiveSession` must hold `silenceRecordingHaptics()` for as long as `micOpen` is true. It acquires it when the mic opens and releases it on close or leave. The sound seam reads the same counter, plus a `tutorAudio` counter raised while `tutorSpeaking`.
- The drill recorder (`DrillScreen.tsx:609-610`), `drill/SpokenAttempt.tsx:60-66` and `daily/DailyPracticeScreen.tsx:114-117` acquire the same mute while recording.
- Result: **in voice mode a live room plays no sound and no haptic.** Rooms are visual only, and the fanfare is saved for the recap.

#### 1.4 Celebration tiers

| Tier | Moments | Visual | Sound | Haptic | Settles by |
|---|---|---|---|---|---|
| S (in place) | correct answer, goal tick, phrase saved, reminder on | pop / fill / flight; no Burst | `correct` / `nearly` / `select` / `save` | `arrived` / `soft` / `tapSettled` | ≤ 600 ms |
| M (end card) | drill, practice, review, daily phrase, lesson, recap without a scene, challenge complete | Bloom + StaggerIn + CountUp + Burst(16) + Glint | `complete` (+ ≤ 6 `count-tick`) | `celebrate()` + `tick()` | ≤ 1.6 s |
| L (big) | scene won (recap), postcard stamp, purchase confirmed | Bloom + art rise + Burst(32) + stamp | `complete` / `badge` | `celebrate()` | ≤ 2.2 s |

How every tier behaves:
- Nothing ever blocks. Overlays use `pointerEvents="none"`, and the primary action works from t = 0. Tapping it while an animation runs jumps to the final frame.
- Under Reduce Motion (`useReduceMotion(true)`, watched live) the final frame shows immediately. Sound and haptic still fire, because they are not motion and their own toggles govern them. Tier L uses `<Illustration name="celebrate-confetti" />` as its still final frame, which also keeps that drawing reached for J14 (`surfaceContract.test.ts:408`) once `OnceConfetti` retires.
- After the learner leaves an end card (Done, Finish), the CelebrationHost plays at most three interstitials from the `WinReceipt`, in this order: `streak-extended` or `streak-milestone` (the milestone replaces the extension), then `level-up`, then `badge-earned`. `goal-met` and `quest-complete` are never interstitials. They appear as rows on the end card, with the `quest` sound queued once.

#### 1.5 What remains banned mid-session, and why

| Allowed mid-session (new) | Still banned mid-session (KEEP) | Why |
|---|---|---|
| A LivingBar showing **position** (phrases settled ÷ phrases in the sitting), with no digits | Any digit: XP, "2 of 3", accuracy, %, counters for runs of correct answers, minutes left | PRODUCT.md:134-136 and DESIGN.md:690-691 ("End cards may count; a session may not score"). A number turns the room into a test. |
| Praise sheets in words, only for code-judged verdicts | Praise for self-reported or unjudged attempts; any pronunciation score | Truthfulness. `repeat-this` is a self-report (`DrillScreen.tsx:1189-1206`). |
| A combo glow on the bar (no number, no text count) | "N in a row" text, or a "streak lost" or "combo broken" message | Anti-guilt. The glow simply fades. |
| Goal ticks animate. The orb ripples once. Bubbles slide in. | Sound or haptic while the mic is live or the tutor is speaking. Interstitials (level, streak, quests) inside a room or a sitting. | Founder decision 8; DESIGN.md "no vibration while recording". An interstitial could cover the safety banner (`ConvoScreen.tsx:1171`). |
| The scene-won card with Bloom and Burst | Red, shake, "wrong", "failed" | `copy/guilt.ts:33-46`; DESIGN.md:692-693 |

### 2. Moment-by-moment specs

#### 2.1 Drill answer verdict: `drill/AnswerSheet.tsx` (new) and `drill/answerSheet.ts` (new, pure)

**Hook.** `answer` at `DrillScreen.tsx:1170-1185` sets `feedback`. The footer at `:1663-1686` is replaced by `<AnswerSheet>`. The beat effect at `:1315-1331` becomes `advance()`, called by the sheet's Continue or by its timer.

**Data.**
- `feedback.verdict`, `closest` and `advanced` come from core (`session.ts:120-128`). `focusLine` comes from the scorer (`:1200-1201`). The exercise kind comes from `session.queue[0].kind`.
- `answerSheet.ts` is `sheetFor({ verdict, closest, advanced, kind, combo, turn })`. It returns `{ tone, headline, detail, french, sound, haptic, autoAdvanceMs }`.
- Variants rotate by `turn = session.answered.length`, so they are deterministic and testable.

| Verdict | Ground / text | Mark | Headline (exact copy) | Detail | Sound | Haptic | Advance |
|---|---|---|---|---|---|---|---|
| `good` (choice and production kinds) | `colour.mint` / `paper.ink` | white disc with ink check, `AnimatedIcon check` draw | rotates `Nicely done.` · `That's right.` · `Spot on.` · `Exactly.` · `Yes, that's it.` · `Good one.`; with combo ≥ 3: `On a roll.` · `You're in the flow.` · `Smooth.` | `focusLine` if present | `correct` | `arrived()` | auto at 1,400 ms; a tap advances sooner |
| `good` on `repeat-this` (self-report) | mint | check | `You said it.` (never praise for accuracy) | `focusLine` | `correct` | `arrived()` | 1,400 ms |
| `typo` (accepted; the near miss) | `colour.sun` / ink | check | `Nearly.` | `It's spelt «{closest}». That one counts.` | `nearly` | `soft()` | 2,200 ms |
| `miss`, `advanced:false` | `paper.card` with top hairline `paper.line` / ink | **none** (keeps the rule at `:1668-1671`) | `Here's how it goes.` | French `«{closest}»` on its own line, then `You'll see this one again in a moment.` | **none** | **none** | waits for Continue |
| `miss`, `advanced:true` (the two-miss mercy) | paper | none | `Here's how it goes.` | `«{closest}»`, then `It'll come back in your review.` | none | none | waits |
| `miss`, `closest === null` | paper | none | `This one comes round again.` | none | none | none | waits |

With a screen reader on (`AccessibilityInfo.isScreenReaderEnabled` plus its change listener), no verdict auto-advances.

Core strings also change, because they feed the live region and own-words: `GOOD_FEEDBACK = 'Nicely done.'`, `typoFeedback(x) = "Nearly. It's spelt «x»."`, `missFeedback(x) = x === null ? 'This one comes round again.' : "Here's how it goes: «x»."`.

**Timeline**, from t = 0 when `setFeedback` fires:

| t (ms) | What happens |
|---|---|
| 0 | Sheet `translateY` 100 % → 0 over `DUR.fast` with `EASE.out`. Sound and haptic fire. The chosen chip (choice kinds) pops on `good`/`typo`: scale 1 → 1.04 → 1, `SPRING.pop`, fill `colour.mint`. On `miss` the chosen chip dims to opacity 0.6, and the correct option gets a 2 pt `paper.ink` outline, never red. |
| 60 | Headline opacity 0 → 1 (`DUR.micro`) |
| 120 | Mark scale 0 → 1.15 → 1 (`SPRING.pop`); the check stroke draws over 180 ms |
| 80 | LivingBar fills to its new value (2.2) |
| 180 | Detail line and French: `StaggerIn`, 60 ms stagger, translateY 6 → 0 |
| exit | Sheet translateY → 100 % over `DUR.fast` (ease-in). The next exercise card enters with translateX 24 → 0 and opacity over `DUR.base`. |

- The sheet spans the content column (ScrollScreen's width on iPad, not the full window) and sits above the safe-area inset.
- Continue is a full-width ink pill inside `AnswerSheet.tsx`, labelled `Continue`. It lives in that file, so the `<PillButton` count in `DrillScreen.tsx` stays 4 (`DrillScreen.test.ts:599`).
- The sheet is `accessibilityLiveRegion="polite"`. On iOS it also calls `AccessibilityInfo.announceForAccessibility(headline + ' ' + detail)`. When it waits, focus moves to Continue.
- **Reduce Motion:** the sheet and mark appear in place; sound and haptic are unchanged.
- **Must not happen:** a mark on a miss; any sound or haptic on a miss; red; `SCOLD` words (`copy.test.ts:130`); digits (`:131`); praise on `repeat-this` beyond "You said it."; a sound while the drill recorder is live (§1.3).

**Own-words outcome** (`DrillScreen.tsx:724-812`, `checkOwnWords :1227-1275`): the outcome card takes the same tones.
- good: mint, `That works.`, sound `correct`, `arrived()`.
- retry: sun, `Nearly there.` plus `verdict.note`, sound `nearly`, `soft()`.
- reveal: paper, `Here's one way to say it.` plus the reveal line, no sound.
- A `null` verdict (judge unreachable) keeps the current ink copy with no sound or haptic.
- **Fix the bug first:** `keepPhrase` must do `.then(ack => { if (ack === 'durable') setKept(true); })`. File it as the next free ledger ID (F716 when this was written; coordinate with the other sections) with a failing test.

#### 2.2 In-sitting progress: LivingBar and combo glow

**Hook.** Header at `DrillScreen.tsx:1446-1455`. The word strip stays as the bar's `accessibilityLabel` and the header's live region text.

**Data.** `practice/sittingProgress.ts` gains `fill: number`, computed as distinct settled phrase keys ÷ `total`. It keeps returning `{step,total,label}` and adds `sittingFill(state, targets)`, which returns the fill even when the sitting is finished. During the beat it reads the post-answer state (`pendingRef.current ?? session`). For ordinary review-bank sittings, add `queueFill(state)`: total = distinct `phraseKey` across `answered ∪ queue` (`packages/core/src/drill/session.ts:85-89`, `:39`).

**Combo.** `drill/combo.ts` (pure): `comboAfter(prev, verdict, kind)`.
- `good` and `typo` add 1.
- `miss` resets to 0.
- `repeat-this` and own-words `retry` leave it unchanged ("only real passes").

**Visual.**
- Bar: a 10 pt track in `paper.line` with a `colour.mint` fill, as `scaleX` from the left over `DUR.base` / `EASE.out`. On `good` a `Glint` sweeps once along the fill (200 ms linear, starting at +120 ms).
- Combo ≥ 3: a halo layer behind the fill (`colour.sun`, 6 pt taller, radius pill, opacity 0 → 0.6 → 0.35 over 420 ms). This is an opacity layer, not a shadow, to satisfy F569 (`surfaceContract.test.ts:170`).
- At combo 5 and 8: a mini `Burst` of 8 particles from the fill's end.
- When the combo resets, the halo fades to 0 over 260 ms with no copy.
- No sound for the bar.
- Reduce Motion: the fill jumps and the halo is static at 0.35.

**Must not happen:** a number, "of", or % next to the bar; the bar moving backwards; drawing it when `total > SITTING_PROGRESS_MAX` (`sittingProgress.ts:24`), in which case the bar is hidden.

#### 2.3 Drill and practice end card: `celebrate/PracticeComplete.tsx` (new template)

Props: `{ ground, art, kicker, title, body, tiles: Tile[≤3], rows, primary, actions?: IconAction[] }`. The tiles use `CountUp` with tabular figures.

| Sitting | Hook | Kicker / title / body (exact) | Tiles: data source | Rows |
|---|---|---|---|---|
| Review-bank drill | `DrillScreen.tsx:1619-1652`; receipt from `persistGrades :1162-1167` (now awaited into `receiptRef`); `tapSettled` at `:1349` removed | `Practice complete.` / `Your review deck takes it from here.` | XP (`WinReceipt.xpCredited`); `Got right` (`summariseDrill(s).resolved`); `Time` (`clock.read()` → "3 min" / "45 sec"). Below the tiles: `{typos} spelling slips · {unresolved} coming back` (only the non-zero parts) | streak, goal, quests from the receipt |
| Practice sitting | `:1559-1596`; `finishPractice :1044-1063` keeps the `PracticeCompletionResult` (`practice/completion.ts:73-90`) in a ref; `tapSettled` at `:1371` removed | kicker `Practice complete.`; title `practiceEndCard(...).title` (existing `PRACTICE_END` statements, `practice/copy.ts:117-131`); body unchanged | XP only when the save state is `saved`; `Phrases` (distinct answered `phraseKey`s; deliberately not a correctness count, which keeps `DrillScreen.test.ts:522` true); `Time` | as above |

**Ground:** `colour.mint` (palette: "a can-do earned, a done tick"). **Art:** `celebrate-first-line`, inside the existing `Illustration` registry.

**Timeline:**

| t (ms) | What happens |
|---|---|
| 0 | `Bloom` (mint radial, scale 0.6 → 1.4, opacity 0 → 0.5 → 0.25, `DUR.slow`, `EASE.out`); sound `complete` |
| 80 | Art translateY 24 → 0, scale 0.92 → 1, `SPRING.pop`; `celebrate()` haptic |
| 200 | Title words stagger: 130 ms each, 38 ms apart, translateY 6 → 0 |
| 380 | Tiles `StaggerIn`: `DUR.base`, 90 ms apart, translateY 12 → 0 |
| 420 | XP `CountUp`: 0 → xpCredited over `DUR.celebrate` (`EASE.out`), at most 30 integer steps. `count-tick` sound and `tick()` haptic at most 6 times, ≥ 90 ms apart. |
| 520 | `Burst`, 16 particles (`colour.sun`, `colour.blue`, `paper.card`, `colour.coral`), 900 ms with gravity |
| 1,320 | Rows `StaggerIn`, 80 ms apart |
| 1,500 | One `Glint` on the Done pill |

**Accessibility:** each tile's `accessibilityLabel` carries the final value only ("35 XP earned").

**Idempotency keys:** `drill:${session.startedAt}` and `practice:${held.sittingId}`. A status of `already-completed` replays silently.

**Must not happen:**
- Any celebration on an empty sitting (`:1546-1555`), "Nothing to review." (`:1600-1615`), `not-saved` (the retry card stays calm), `cannotResume`, `invalid` or `unread`.
- An XP tile on `saved-locally` (activity pending) or `saved-outside-history`.
- Any number before `practiceSaved !== 'waiting'`.

#### 2.4 Review sitting finished: separate from "Nothing waiting"

**Hook.** `ReviewScreen.tsx:172-188` splits into two states:
- `queue.length === 0`: keeps "Nothing waiting." with no celebration.
- `index >= queue.length && queue.length > 0`: the finished end card.

Banking moves from the unmount cleanup (`:107-120`) to an effect on finishing, guarded by the existing `banked` ref (`:82`). The unmount bank stays as the fallback for leaving mid-sitting.

**Data:**
- `recalled.current` (`:145`)
- `reviewXp` via the receipt
- `clock.read()`
- the next due time: the minimum `due` among the cards graded `good`/`easy` in this sitting, read from the deck returned by the last `gradeCard` promise (`review/store.ts:262-264`). This is computed in the new pure module `review/sittingEnd.ts`.

**Copy:**
- `recalled > 0`: kicker `Review complete.`, tiles XP, `Remembered` (recalled) and `Time`; line `They come back {later today | tomorrow | in {n} days}.`
- `recalled === 0`: title `Review done.`, body `These come round again soon.` No XP tile and no Burst (tier S: `select`, `tapSettled`).

Template, timeline, sound and haptic are as in §2.3.

**Constraint:** the pinned stage3 test requires ReviewScreen to lack `/score/`, so no identifier or copy may contain "score".

#### 2.5 Daily phrase practice done

**Hook.** `completePractice` at `daily/DailyPracticeScreen.tsx:145-155`. After `ack === 'durable'` (kept, because stage3 pins `ack === 'durable'`, `setDaySaved(true)` and `recordActiveDay()`), call `settleWin('daily-phrase', null, 'daily:'+item.id+':'+dayKey)`.

**Data:** `recordActiveDay` writes no XP and no minutes (`activity.ts:347`). So there is no XP tile and no goal change, only the streak and lifetime days.

**In place:** the `Feedback` text at `:166` becomes a compact panel with `AnimatedIcon flame` (flicker 2 cycles, 600 ms) and these lines:
- `streak.extendedNow`: `Practised. That's day {count} of your streak.` (the streak section owns this wording).
- Otherwise: `Practised. Today is already counted.`
- Always: `Your take is temporary and ungraded.`

Sound `complete`, `arrived()`. Tier S+, no Burst. Interstitials (`streak-extended`) play on `Done` (`:168`), not on the panel.

**Must not happen:** firing while `recording`; firing on a non-durable ack; claiming XP; removing the strings stage3 pins (`Nothing is graded`, `Record my take`, `Hear my take`, `Try again`).

#### 2.6 Guided lesson: turn flash and SummaryScreen

**Turn flash** (`SessionView.tsx:247-248`, from `LiveSessionScreen.tsx:296`): driven by `live.feedback.quality` (`core/session/session.ts:108-119`).
- `good`: a mint pill behind the flash text, scale 0.96 → 1 with `SPRING.pop`.
- `partial`: sun.
- `poor` or rescued: plain ink as today.
- No sound or haptic, because the room mic is live.
- `pronunciationScore` is never shown.
- Change the `excellent`/`good` families (`session.ts:390-391`) to plain English: `Exactly right.` · `Spot on.` · `That was it, exactly.` / `Well said.` · `Yes, that's it.` · `Nicely put.` This needs a tutor-agent redeploy (see Risks).

**SummaryScreen** (rendered at `nav/RootNavigator.tsx:251`; data from `finish :185-217`): `recordActivity` at `:200-209` returns the receipt into state and passes it as a prop. The hero at `SummaryScreen.tsx:86-104` gets `Bloom` (`colour.blue`, 0.25 max opacity) and a title word stagger. The tiles are the existing `Stat`s "Words used" and "Longest turn" (`:101-102`), plus a new XP `Stat` fed by the receipt.

**Must not happen:** anything after a stop. F137 is preserved by `if (live.summary && !stopped && …) onFinish` (asserted by pinned `safetyView.test.ts` "a stop is the whole screen…").

#### 2.7 Scene goal ticks mid-conversation: `tutor/MissionTaskList.tsx`

**Hook.** Rendered at `ConvoScreen.tsx:1164`; the component is `MissionTaskList.tsx:8-24`. Add `tutor/taskTicks.ts` (pure): `newlyAchieved(prevAchievedIds, items)`. Items already achieved on first render (reconnect or resume) never animate.

**On the false → true transition:**
- The 20 pt circle fills `colour.mint` and scales 0.6 → 1.2 → 1 (`SPRING.pop`).
- `AnimatedIcon check` draws over 180 ms.
- `Glint` sweeps the row once (200 ms).
- The ScrollView (`maxHeight: 104`) scrolls the row into view (animated unless Reduce Motion is on).
- The orb plays one celebrate ripple (§3.3).
- `AccessibilityInfo.announceForAccessibility('Goal reached: ' + goalEn)`.
- Sound `select` and `tapSettled()` **only when `!live.micOpen && !live.tutorSpeaking`**, which means typed mode only.

**Must not happen:** a counter like "2 of 3" (rejected: it is a mid-session number); ticks fabricated from an unknown mission (`missionTasks.test.ts:22` stays authoritative); any tick animation after `stopped`.

#### 2.8 Scene won in the room: `MissionWin` (`ConvoScreen.tsx:204-234`, rendered at `:1185-1194`)

**Truth gate (unchanged):** `winAfterTurn` returns a non-null record only on the flip, with every task achieved and `!stopped` (`:634-657`, `tutor/missionWin.ts:71-92`).

**Founder 9/29 metering decision kept:** the pill stays `Keep talking` with `Carrying on uses your minutes.` under it, and `Finish and see your recap` stays as the second door.

**The win becomes celebratory without blocking.**

| t (ms) | Element |
|---|---|
| 0 | The card enters in the support area (translateY 24 → 0, opacity, `SPRING.pop`). `Bloom` in `colour.mint` behind the card (scale 0.6 → 1.3, opacity 0 → 0.55 → 0, 840 ms). The orb celebrate ripple. |
| 120 | New kicker `Scene complete` (type.label, ink) fades in |
| 200 | `<Illustration name={sceneIllustration(mission.id)} fit="small" />` rises 20 → 0 and scales 0.9 → 1 (`DUR.slow`, `EASE.out`). This form is allowed by `sessionScreens.test.ts:108`. |
| 260 | `mission.winEn` word stagger (38 ms apart) |
| 300 | `Burst` of 24 particles from the card's top edge; the MissionTaskList ticks re-pop in sequence, 80 ms apart |
| 420 | If `firstEarned`: the line `Your first time doing this on your own.` |

- Sound `complete` and `celebrate()` only when the room is quiet (§1.3). In voice mode it is visual only, and the full fanfare plays at the recap.
- The header End, the transcript and the orb stay live underneath.
- `winCard` gains `kicker: 'Scene complete'`.
- Reduce Motion: the card appears in place with a static check and no confetti drawing.
- Must not happen: the card over a safety banner or a stop (the stop branch at `:846-848` returns first); a second card in the session (`seen` stays sticky); praise words, which `missionWin.test.ts:91-100` still forbids; a number.

#### 2.9 Recap: `RecapScreen.tsx`

`ConvoScreen.tsx:570-571` now awaits `recordActivity` into a `convoReceipt` state, then calls `settleWin('convo', receipt, 'convo:'+live.sessionId)`. Both `receipt` and the new `earnedNow` are passed as props. `earnedNow` comes from the new `recap/evidence.ts` function `earnedFinish(finish)`, which is the second clause of `firstEarnedFinish` (`evidence.ts:5-10`).

**Result page** (`:259-273`, coral ground):
- If `completedMissionId` and `earnedNow`: **Tier L `scene-won`**. A sun radial Bloom rises from the bottom (opacity, 600 ms). The scene art rises 30 → 0 and scales 0.9 → 1 over 650 ms. `Burst(32)`. The headline words stagger. Sound `complete`, `celebrate()`.
- Otherwise, if `won` (`:167`): Tier M with no Burst.
- A new "progress strip" under `recapLine` shows chips: `+{xpCredited} XP` (CountUp), a flame with `Day {count}`, and a goal mini `ProgressRing`.
- The strip lives outside the `const savableText =` … `const pageIndex =` slice, so the pinned `recap/pages.test.ts` (F700/F707) bindings are unaffected.
- **Audio precondition:** recap sounds play only once `!live.micOpen`. Voice-platform work: close the mic on `case 'recap'` when the session is not stopped.

**Kept phrase saved** (`:185-202`, haptic at `:176`): when `saveState === 'saved'`, `celebrate({type:'phrase-saved', key:'phrase:'+keptPhrase.key, origin: measured KeptPhraseCard, target: the in-screen save line})` (§2.10). The existing `arrived()` stays deduplicated by `savedHaptics`.

**Lines page** (`:317`): `OnceCount` is replaced by `<CountUp value={lines.length} unit=… ground="coral" />`, keeping the final-value accessibility label and `no-hide-descendants`.

**Ability page** (`:346-356`): `OnceConfetti` (`:257`) is replaced by `<PostcardStamp play={currentPage==='ability' && earnedNow && canDo!==null} first={firstEarned} />`. **Every independent finish this session** gets the stamp, not only the first.

| Phase | Motion |
|---|---|
| Postcard drop | rotation −8° → −3°, scale 1.3 → 1, `SPRING.snap` |
| 260 ms | An ink stamp ring (static Svg circle, transform only) slams in, scale 1.6 → 1 and opacity 0 → 1 over 180 ms |
| 380 ms | `Burst` (16, or 32 when first) |

Sound `badge` for the first earn, `correct` for a repeat. Haptic `celebrate()` for the first, `arrived()` for a repeat. Copy: first, `Your first independent finish here.` (existing); repeat independent, `You did it on your own again.`; an earlier earn with an assisted finish this time keeps `A can-do you have earned.` with a still postcard and **no stamp**.

**Next page** (`:358-391`): see §2.13 for the reminder. Interstitials flush on `onDone` (`:241, :247-249`) after the room has closed.

**Must not happen:** any of this after a stop (the recap branch is unreachable, `:846` before `:850`); a stamp for an assisted finish; XP from the screen's own `conversationXp(`; sounds while the mic is published.

#### 2.10 Phrase saved anywhere

**Shared:** `celebrate({ type:'phrase-saved', key:'phrase:'+phraseKey, phrase:{fr}, origin: rect|null, target: rect|null })`, fired only after a durable acknowledgement.

**The host's flight:**
- A white chip with ink French and a bookmark icon lifts (scale 1 → 1.08 over 120 ms).
- `ChipFlight` follows a curve: tx over 480 ms `EASE.inOut`, ty over 360 ms `EASE.out`. It shrinks to 0.4 and fades on landing.
- On a tab route, the target is the Progress tab icon anchor. `nav/LuvaniTabBar.tsx` only registers anchors with `onLayout` + `measureInWindow` into `celebrate/anchors.ts`. **The bar itself never animates**, so `tabBar.test.ts:138` (pinned F600) and `motion.test.ts:304` stay true. The host draws an overlay over the icon: a mint dot pops (0 → 1.25 → 1, `SPRING.pop`) and a ring ripples (scale 1 → 1.8, opacity 0.5 → 0, 420 ms). The dot stays until Progress is focused.
- On a pushed screen (Drill, Review, DailyPractice, Recap) the tab bar is hidden. The chip flies to `target`, or to a bottom toast `Saved to Progress` with `AnimatedIcon bookmark` fill, and a tab pulse is queued in memory for when the tab bar is next visible.
- Sound `save`, haptic `arrived()`. Reduce Motion: no flight, toast and dot only.

| Site | Hook | Gate |
|---|---|---|
| Recap kept phrase | `RecapScreen.tsx:176` / `:185-202` | `saveState==='saved'` |
| Daily card bookmark | `daily/DailyCard.tsx:78-98` (stays free of `Animated`, J7) | `actual === true` after read-back |
| Drill keep | `DrillScreen.tsx:1297-1309` | `ack === 'durable'` (after the bug fix) |
| Starter keep | `onboarding/StarterContinuation.tsx:76-98` | `saved === 'durable'` |
| Daily add-to-review | `daily/DailyPracticeScreen.tsx:136-144` | `ack === 'durable'`; the flight runs over the navigation to Review |

#### 2.11 Purchase confirmed: `wall/WallScreen.tsx:323-334`

**Gate (unchanged):** `wallSuccess(confirmedGrant, latestCatalogue())` is non-null only on a refreshed server grant (`wall/wallSuccess.ts:6-12`).

**Tier L:**
- mint `Bloom`
- `HeroNumber` replaced by `CountUp` 0 → `success.minutes` over 900 ms
- `Burst(32)`
- sound `complete`, `celebrate()`
- `Glint` on `Start speaking`
- Key: `purchase:${plan}:${grant period start}`.

If the streak section confirms freezes for this plan, add one line from its own `freezeAllowanceLine(plan)`. No number is invented here.

**Must not happen:** anything before entitlement; countdowns or "limited" copy (`wall/moneyUntouched.test.ts`, `purchases/*.test.ts` untouched); celebrating the `granted && success === null` branch (`:338+`).

#### 2.12 Friends challenge complete: `tabs/FriendsTab.tsx:66-67`

- Replace `'Un peu de français, ensemble.'` with `You finished it together.`
- On the first render where `c.count >= c.target` for an ID not yet in the persisted celebration ledger: Tier M in place on the card. That is Bloom, `Burst(16)`, sound `complete`, `arrived()`.
- `Share our postcard` becomes an `IconAction` (share icon, `accessibilityLabel="Share our postcard"`).
- This needs `social-systems-engineer` approval, and a `challenge-complete` event added to the CelebrationHost union.

#### 2.13 Reminder set

- Recap (`RecapScreen.tsx:386-388`, answer `'on'` from `live/keepsake.ts:166-170`), Settings (`settings/SettingsScreen.tsx:508-568`) and StarterContinuation all follow the same pattern.
- `AnimatedIcon bell` rings (rotate ±14° three times over 600 ms) beside `reminderAnswerLine`. Sound `select`, `tapSettled()`.
- `'refused'` and `'failed'` get nothing.
- Copy stays as is. The default tutor name in `reminders/reminder.ts:158` belongs to the reminders section.

#### 2.14 Sound and haptic per moment (master list)

| Moment | Sound | Haptic |
|---|---|---|
| Good answer / typo / miss | `correct` / `nearly` / none | `arrived` / `soft` / none |
| Combo halo | none | none |
| End cards (drill, practice, review, daily, lesson) | `complete` + `count-tick` ≤ 6 | `celebrate` + `tick` |
| Goal tick (typed mode only) | `select` | `tapSettled` |
| Scene won in room (quiet only) / at recap | `complete` / `complete` | `celebrate` |
| Postcard stamp, first / repeat | `badge` / `correct` | `celebrate` / `arrived` |
| Phrase saved | `save` | `arrived` |
| Purchase | `complete` | `celebrate` |
| Reminder on | `select` | `tapSettled` |
| Sheet in/out, flights | (`whoosh` reserved for interstitials, owned by the host) | — |

### 3. The living orb (conversation rooms only)

#### 3.1 What the installed SDKs expose (checked in `/Users/pravz_07/.codex/worktrees/adac/Luvani/node_modules`)

| Source | API | Platform | Notes |
|---|---|---|---|
| `@livekit/react-native` 2.12.0 | `useTrackVolume(track)` returns 0–1 RMS; `useMultibandTrackVolume(track, {bands, minFrequency, maxFrequency, updateInterval})` returns `number[]` (`src/hooks/useTrackVolume.ts`, `useMultibandTrackVolume.ts`) | native only (`LiveKitModule.createVolumeProcessor`) | 40 ms interval (`ios/LiveKitReactNativeModule.swift:206`). Local tracks are supported: `pcId == -1` → `LKAudioProcessingManager.addLocalAudioRenderer` (`ios/audio/AudioRendererManager.swift:30-41`). **Trap:** `if (event.volume && …)` never writes 0, so the value sticks at its last non-zero reading. |
| `livekit-client` 2.21.0 | `createAudioAnalyser(track, {fftSize, smoothingTimeConstant, cloneTrack})` returns `{calculateVolume, analyser, cleanup}` (`dist/src/room/utils.d.ts:119-123`); `Participant.audioLevel`, `isSpeaking`; `RoomEvent.ActiveSpeakersChanged`; `ParticipantEvent.IsSpeakingChanged` | web (Web Audio); `audioLevel` everywhere (server-computed, coarse) | The app already uses `Room` directly (`live/useLiveSession.ts:20, :928`). |
| `expo-audio` 57.0.4 | `isMeteringEnabled` recorder option; `RecorderState.metering` in dBFS (−160 = silence); `recorder.getStatus()` | iOS and web (`AudioRecorder.web.js:214-230`) | `RecordingPresets.HIGH_QUALITY` does **not** enable metering. Spread it with `isMeteringEnabled: true`. |

#### 3.2 Plumbing

1. **`live/useLiveSession.ts`** (voice-platform-engineer):
   - Add state `audioTracks: { mic: LocalAudioTrack | null; tutor: RemoteAudioTrack | null }`.
   - Set `tutor` in the `TrackSubscribed` handler (`:939-952`) **before** the `typeof document === 'undefined'` early return.
   - Set `mic` on `RoomEvent.LocalTrackPublished` (source `Track.Source.Microphone`).
   - Clear both on unpublish, unsubscribe and disconnect.
   - Hold `silenceRecordingHaptics()` while `micOpen`.
   - On `case 'recap'` when not stopped, `setMicrophoneEnabled(false)`.
2. **`live/OrbAudio.tsx`** (new): a React context `{ input: SharedValue<number>; bands: SharedValue<number[]>; output: SharedValue<number>; inputLive: SharedValue<boolean> } | null`. It defaults to `null`, so TutorIntro and RoomWait keep today's loops.
3. **`live/RoomLevels.native.tsx`** (new leaf, renders `null`):
   - `useTrackVolume(mic)` and `useMultibandTrackVolume(tutor, {bands: 7, minFrequency: 150, maxFrequency: 4000, updateInterval: 40})`.
   - Writes shared values in effects, so only the leaf re-renders at 25 Hz.
   - Mounted only while the room screen is focused and AppState is active. Unmounting deletes the native processors.
4. **`live/RoomLevels.tsx`** (web): `createAudioAnalyser(track, {fftSize: 512, smoothingTimeConstant: 0.5})`, sampled in a `requestAnimationFrame` loop throttled to 25 Hz, with 7 log bands (150–4000 Hz) from `getByteFrequencyData`, and `cleanup()` on unmount. The Metro platform split works per `metro.platform.cjs:17-23`.
5. **`live/levels.ts`** (new, pure, tested):
   - `normaliseRms(r) = clamp((r − 0.01) / 0.20, 0, 1) ** 0.6`
   - `normaliseDb(db) = clamp((db + 50) / 40, 0, 1) ** 0.8`
   - `envelope(prev, next)`: attack 0.6, release 0.15 per 40 ms sample
   - `decayIfStale(lastAt, now)` → 0 after 120 ms with no event. This fixes the zero-volume trap.
   - Bands normalised by a running max (decay 0.995 per frame, floor 0.05).
   - Input is gated to 0 unless `micOpen && !tutorSpeaking`.
   - All constants are tuned on device and recorded in docs/LIVE_VOICE.md.
6. **ConvoScreen** wraps the room (`:1125` onward) in `<OrbAudio.Provider>` and mounts `<RoomLevels mic tutor into={…}/>`. The `<VoiceOrb state={orbState} size={SCENE_ORB} announce={false} />` JSX stays byte-identical, so `RecapScreen.test.ts:142-147` passes unchanged. WalkRoom (`walk/WalkRoom.tsx:16`) does the same. TutorIntro passes `paused`, so the only living orb is in rooms (founder decision 1).

#### 3.3 State table (colours unchanged, still taught by TutorIntro; `palette.ts:107-131`)

| State | Fact that drives it (`ConvoScreen.tsx:1111-1123`) | Colour / mark | With levels | Without levels (fallback) | Caption |
|---|---|---|---|---|---|
| ready | `controls.showOpenMic` | ink / mic | breath ±2.5 % over 3,000 ms (existing) | same | `Tap to talk` |
| listening | mic open, tutor silent | mint / mic | breath ±3.5 % over 1,120 ms plus **LevelRing**: two ring layers behind the glyph, scale `1 + 0.22·L` and opacity `0.25 + 0.6·L`; the second follows with `withTiming(140 ms)` | breath only | `Speak`, switching to `Hearing you` once L > 0.12 for ≥ 250 ms, and back after 600 ms below |
| speaking | `live.tutorSpeaking` (the agent's `speaking` message) | coral / 7 bars | **LiveBars**: bar i `scaleY = 0.45 + 0.85·bands[i]`, smoothed; core scale `1 + 0.04·output` | the existing sine loop (780 ms) | `Listen` |
| thinking | `live.thinking` (`live/thinking.ts`) | sun / 3 dots | dim shimmer 900 ms (existing) plus **ThinkingArc**: a sun arc segment rotating 360° every 1,200 ms, linear | same | `Thinking` |
| idle / error | typing / failure | inkSoft / mic | still | still | `Ready` / `Unavailable` |
| celebrate (one-shot overlay, not a state) | goal tick, scene won | current state colour | two ripples (scale 1 → 1.6, opacity 0.5 → 0, 700 ms, 180 ms apart) plus 8 particles | none | unchanged |

**Implementation within the pinned orb tests.** `VoiceOrb.tsx` keeps its core-`Animated` loops, `<OrbGlyph color={look.colour} size={size} />`, `transform: [{ scale: breath }]`, the dot sizes, `BAR_HEIGHTS` and the `{look.mark === 'bars' ? (` branch (`orbRest.test.ts:159-275`). It adds:
- `const audio = useContext(OrbAudio)`
- `audio ? <LiveBars …/> : (<View …>{BAR_HEIGHTS.map(…)}</View>)` inside the bars branch
- sibling layers `<OrbLevelRing>`, `<OrbThinkingArc>` and `<OrbRipple>` in new files under `tutor/`, built with Reanimated: a static Svg circle, transform and opacity only, with no `borderWidth` in `VoiceOrb.tsx`

Every layer receives `rest = orbRests({...})` and holds still when paused or reduced.

#### 3.4 Honest thinking
- `thinking` appears at the final transcript and ends at the next answer (`live/thinking.ts`). There is no artificial minimum and no "analysing" copy.
- Add `thinkingLine(ms)` in `live/thinking.ts`. It returns `null` under 6,000 ms, and otherwise `Still thinking. This can take a few seconds.`
- That line renders in the header status slot (`ConvoScreen.tsx:1140-1149`) only when `connectionLine` is empty.

#### 3.5 Transcript bubbles: `tutor/Transcript.tsx:218-229`
- Each `Line` is wrapped in `motion/BubbleIn.tsx`, and only bubbles added after mount animate.
- Learner bubbles: translateY 16 → 0, scale 0.96 → 1, opacity over `DUR.base` / `EASE.out`, entering from the orb side.
- Tutor bubbles: translateY 8 → 0 and opacity, `DUR.base`.
- The newest recast's `Highlight` runs the existing `drawIn` (520 ms, `motion.ts:88-102`) 120 ms after its bubble lands.
- Reduce Motion: in place, and the scroll jumps (as today, `:211`).
- Interim transcript bubbles are out of scope for this phase. They would need the agent to publish `final:false` (backend-engineer and voice-platform-engineer).

#### 3.6 Level rings outside the orb
- **Guided lesson:** `<LevelRing source={audio.input}>` is placed behind `SpeakCircle` in `SessionView.tsx:271-277`. SpeakCircle itself is unchanged (append-only `components.tsx`).
- **Recorders:** a `speech/useRecorderLevel(recorder)` leaf polls `recorder.getStatus().metering` every 50 ms into a SharedValue (no React state). It drives a mint `LevelRing` around:
  - the GuestRecording button (`onboarding/GuestRecording.tsx:119-131`; the onboarding owner signs off)
  - the drill `RepeatThisView` / `SpokenAttempt`
  - DailyPractice's record pill
- Under Reduce Motion the ring shows three opacity steps (0.3, 0.6 or 1 at L ≥ 0.15, 0.45 or 0.75) with no scale.

#### 3.7 Lifecycle and performance
- Processors run only while focused and active.
- On iPhone 12-class hardware the target is JS work under 2 ms per 40 ms sample, measured with the Hermes profiler. Record the result in DEVICE_VERIFICATION.md (by eye, plus the profiler number).

### 4. Acceptance checks
1. A good drill answer shows the mint sheet with `correct` and a success haptic. A typo shows the sun sheet, `It's spelt «x». That one counts.`, `nearly` and a soft haptic. A miss shows the white sheet with the French answer, no mark, no sound, no haptic, and waits for Continue. The `Continue` pill is reachable at the largest Dynamic Type size on iPhone SE and iPad.
2. The practice bar fills on settled phrases only, never shows a digit, and grows a glow after three code-judged passes in a row. `repeat-this` never extends the glow.
3. End-card XP equals `xpCreditedFor` for the logged entry. Seed 95 XP for today, finish a 20 XP drill: the tile shows `+5 XP`. At 100: `Today's XP limit reached`.
4. Review: a sitting with recalls shows the `Review complete.` card. An empty deck still shows `Nothing waiting.` with no sound.
5. A safety stop in either room produces no sound, haptic, overlay, XP or interstitial, and the host queue is empty after the stop. Verify with the dev stop fixture.
6. In voice mode, a goal tick and the scene win make no sound and no vibration (mic live). In typed mode the goal tick plays `select`.
7. The orb ring visibly tracks the learner's voice within 80 ms and settles to rest within 300 ms of silence. The bars track the tutor's voice. With the processors forced off, the orb falls back to today's loops. On web (Chrome and Safari), `build:web` passes and the analyser path works after the start tap.
8. With Reduce Motion on, every moment lands on its final frame, the Tier L still is `celebrate-confetti`, and sound and haptic follow their own toggles.
9. A replayed recap or end card (back navigation, remount) never re-celebrates. The idempotency keys are persisted.
10. The gate passes with the mobile floor raised by the new tests. No ledger-pinned title is renamed.

### Files touched

**Create**
- `drill/AnswerSheet.tsx`, `drill/answerSheet.ts`, `drill/combo.ts`
- `celebrate/PracticeComplete.tsx`, `celebrate/PostcardStamp.tsx`, `celebrate/ConfettiStill.tsx`, `celebrate/anchors.ts`
- `game/settleWin.ts` (if the game section does not already name it)
- `review/sittingEnd.ts`, `tutor/taskTicks.ts`
- `tutor/OrbLevelRing.tsx`, `tutor/LiveBars.tsx`, `tutor/OrbThinkingArc.tsx`, `tutor/OrbRipple.tsx`
- `live/OrbAudio.tsx`, `live/RoomLevels.native.tsx`, `live/RoomLevels.tsx`, `live/levels.ts`
- `motion/LevelRing.tsx`, `motion/BubbleIn.tsx`
- `speech/useRecorderLevel.ts`
- tests: `drill/answerSheet.test.ts`, `drill/combo.test.ts`, `review/sittingEnd.test.ts`, `tutor/taskTicks.test.ts`, `live/levels.test.ts`

**Edit**
- `packages/core/src/drill/session.ts:136-145`
- `packages/core/src/session/session.ts:390-391`
- `packages/core/src/levels/levels.ts` (+ `levels.test.ts`)
- `progress/activity.ts:240-249` and `recordActivityOnce`
- `practice/sittingProgress.ts`, `practice/completion.ts` (return the receipt)
- `DrillScreen.tsx` (1044-1063, 1162-1167, 1170-1185, 1297-1309, 1315-1374, 1446-1455, 1559-1652, 1663-1686)
- `ReviewScreen.tsx:107-188`
- `daily/DailyPracticeScreen.tsx:136-168`, `daily/DailyCard.tsx:78-98` (fires the event only)
- `ConvoScreen.tsx:555-576, 634-657, 846-865, 1107-1194, 1280-1286`
- `RecapScreen.tsx:176, 257-356, 386-388`
- `recap/evidence.ts`
- `tutor/missionWin.ts`, `tutor/MissionTaskList.tsx`, `tutor/VoiceOrb.tsx`, `tutor/Transcript.tsx:218-229`, `tutor/TutorIntro.tsx:72` (`paused`)
- `live/useLiveSession.ts:939-960, 1104-1124`, `live/thinking.ts`
- `SessionView.tsx:247-277`, `SummaryScreen.tsx:86-104`, `nav/RootNavigator.tsx:185-217, 251`
- `nav/LuvaniTabBar.tsx` (anchors only)
- `wall/WallScreen.tsx:323-334`, `tabs/FriendsTab.tsx:66-67`
- `drill/SpokenAttempt.tsx`, `onboarding/GuestRecording.tsx`, `onboarding/StarterContinuation.tsx:76-98`
- `walk/WalkRoom.tsx`

**Delete**
- `recap/OnceConfetti.tsx`, `recap/OnceCount.tsx` (replaced by `PostcardStamp` and `CountUp`)

### Tests and docs to change
**Never rename a pinned title. Edit assertions only.**

- `packages/core/src/copy.test.ts:140-147`: assert the new English strings. The `SCOLD` and `DIGIT` checks stay.
- `packages/core/src/levels/levels.test.ts`: add `xpCreditedFor` cases (under the cap, crossing it, already capped).
- `DrillScreen.test.ts`:
  - :584-598 (unpinned): allow `<LivingBar fraction={…fill}` with `accessibilityLabel={progress.label}`, and keep the ban on `{progress.step}`, `{progress.total}` and `percent`. The pill count stays 4.
  - :511-526: assert `<PracticeComplete` renders only after `practiceSaved !== 'waiting'` and that XP comes from the receipt; keep the `<Stat|s.resolved|Got right` ban.
  - :528-538: also ban `celebrate\(|PracticeComplete` in the empty branch.
  - New: "a kept own-words phrase is called saved only on a durable acknowledgement".
  - New: "a miss draws no mark, plays no sound and fires no haptic".
- `practice/sittingProgress.test.ts`: `fill` and `queueFill` cases.
- `revamp/stage3.test.ts`: the "recap stories…" test (unpinned) requires `<PostcardStamp` and `<CountUp` instead of `<OnceConfetti` and `<OnceCount`, and moves the reduce-motion, once and `pointerEvents` checks to those files. Pinned tests keep holding: DrillScreen keeps `CheckGlyph` and `colour.mint` (own-words mark); ReviewScreen avoids `score`; DailyPracticeScreen keeps its pinned strings; RoomWait is untouched.
- `RecapScreen.test.ts`: keep the `Animated` ban. Add "recap XP is the credited receipt, never computed on the screen" and "the stamp plays for every independent finish this session, never for an assisted replay".
- `recap/pages.test.ts` (F700/F707): no edit if nothing new enters the `savableText…pageIndex` slice. Assert that in review.
- `tutor/safetyView.test.ts`: extend the unpinned "nothing the app adds to a safety decision scolds…" ban list with `celebrate`, `PracticeComplete`, `Burst` and `sfx`. Add "a stop cancels queued celebrations and blocks new ones" (ConvoScreen and LiveSessionScreen call `cancelCelebrations()` when `stopped`).
- `live/liveRoomChrome.test.ts`: the header still does not animate. Add "the room plays no sound while the mic is live or the tutor speaks".
- `sessionScreens.test.ts:101`: no edit (screens stay free of `Animated.`). Optionally reword the assertion message.
- `tutor/missionWin.test.ts`: assert `kicker === 'Scene complete'` with no digit and no praise.
- `tutor/orbRest.test.ts`: none needed with the layered approach. Add one asserting the layers rest via `orbRests`.
- `live/thinking.test.ts`: `thinkingLine`.
- `motion.test.ts:295`, `:117`: the new animating files go on the allow-list (motion section).
- `surfaceContract.test.ts:2138` (F407 pins a DESIGN.md sentence): updated alongside DESIGN.md (motion section).
- Docs:
  - DESIGN.md: the completion moment (:648-653, "No confetti…") becomes the §2.8 spec; the Motion section (:694-712); "No mid-session message contains a number" stays.
  - PRODUCT.md:121-136: XP is shown on end cards; the cap and the mid-session rule stay.
  - docs/LIVE_VOICE.md: audio levels, mic close on recap, mic-live haptic mute.
  - docs/DEVICE_VERIFICATION.md: the orb and level checks.
  - KNOWN_ISSUES.md: entries from F716 for the drill keep ack, room haptics while the mic is live, the mic left open after the recap, and the useTrackVolume zero trap, each with `verified-by` before work starts.

### Owner agent
- Answer sheet, LivingBar wiring, drill, practice and review end cards, daily phrase: **practice-ux-engineer**
- Core drill copy, lesson praise families, `xpCreditedFor`: **learning-science-engineer**
- Receipt in `progress/activity.ts`, `settleWin`, reminders: **progress-retention-engineer**
- ConvoScreen, RecapScreen, SummaryScreen, RootNavigator, FriendsTab and WallScreen rendering; cross-cutting tests (one integrator): **frontend-engineer**
- VoiceOrb and orb layers, `motion/` primitives, `celebrate/` templates, tab anchors: **design-system-engineer**
- `useLiveSession` tracks, RoomLevels, mic close, mic-live mute: **voice-platform-engineer** (voice-reliability-architect reviews)
- Purchase moment truth: **revenue-engineer** decides, frontend renders
- Friends: **social-systems-engineer** approval
- F137 suppression: **privacy-safety-engineer** review
- Lesson praise redeploy: **backend-engineer**
- GuestRecording ring: **onboarding-ux-engineer**

### Risks
1. **Silent switch.** Drill, daily and voice screens set `playsInSilentMode: true` (`DrillScreen.tsx:598`, `daily/DailyCard.tsx:73`, `practice/recordedPlayer.ts:94`). After that, SFX ignore the silent switch, which contradicts founder decision 8. The sound section must reset the mode or skip SFX in that state. Verify on device.
2. **expo-audio inside a live LiveKit AudioSession** (the recap is still in the room) may reroute or duck audio. If the device test shows that, defer recap sounds until `live.leave()` resolves.
3. **`useTrackVolume` never writes 0.** The stale-decay in `live/levels.ts` is mandatory.
4. **Lesson praise is produced server-side** (`tutor.ts:659`). The English lines appear only after a tutor-agent deploy, so old builds and servers keep the French lines until then.
5. **Reanimated is a native dependency.** Everything here ships only in the new binary. The founder's dev binary expires on 11 Oct 2026 (`docs/REMOTE_UPDATES.md:77-80`).
6. **Interstitial fatigue.** Hold the cap at three, and check it on day 1 versus day 30 cohorts.
7. **Waiting for Continue after a miss** adds a tap per miss. The default is a deliberate pacing choice (see the first open question).
8. **iPad rotation** invalidates tab anchors. Re-measure on `onLayout` and `Dimensions` change events, not on a cached value.

### Open questions for the founder
1. Should finishing a daily phrase practice earn XP? Today it records a day but no XP, by design (`progress/activity.ts:347`). My default keeps it XP-free, because XP counts only French that code has judged.
2. After a missed answer, should the sheet wait for Continue (my default: time to read the right French), or auto-advance like today's 1.6 s beat?
3. Guided lessons (`LiveSessionScreen`) are live voice rooms too. Should they get the full living orb, or only the level ring around their Speak circle (my default)?

### Critical files for implementation
- /Users/pravz_07/Documents/StartUps/Luvani/.claude/worktrees/app-engagement-animations-de9910/apps/mobile/src/DrillScreen.tsx
- /Users/pravz_07/Documents/StartUps/Luvani/.claude/worktrees/app-engagement-animations-de9910/apps/mobile/src/ConvoScreen.tsx
- /Users/pravz_07/Documents/StartUps/Luvani/.claude/worktrees/app-engagement-animations-de9910/apps/mobile/src/RecapScreen.tsx
- /Users/pravz_07/Documents/StartUps/Luvani/.claude/worktrees/app-engagement-animations-de9910/apps/mobile/src/live/useLiveSession.ts
- /Users/pravz_07/Documents/StartUps/Luvani/.claude/worktrees/app-engagement-animations-de9910/apps/mobile/src/tutor/VoiceOrb.tsx