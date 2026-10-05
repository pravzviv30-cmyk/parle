> Detailed draft spec, written 2026-10-04 and checked against `47fbc2ea`. Where it disagrees with
> [README.md](README.md) Parts 1, 6 or 7 (decisions, resolutions, gate traps), README wins. Read the
> matching review in [reviews/](reviews/) before building from it.

## First run

**Path keys** (all absolute):
- `P` = `/Users/pravz_07/Documents/StartUps/Luvani/.claude/worktrees/app-engagement-animations-de9910/apps/mobile/src/onboarding/PreAccountOnboarding.tsx`
- `S/` = `/Users/pravz_07/Documents/StartUps/Luvani/.claude/worktrees/app-engagement-animations-de9910/apps/mobile/src/`
- `C/` = `/Users/pravz_07/Documents/StartUps/Luvani/.claude/worktrees/app-engagement-animations-de9910/packages/core/src/`
- `R/` = `/Users/pravz_07/Documents/StartUps/Luvani/.claude/worktrees/app-engagement-animations-de9910/`

I checked every file:line below against HEAD `47fbc2ea` on 2026-10-04. Where the evidence files and the code disagreed, the code wins, and I say so where it matters.

### 1. Outcome: the new order and the decisions that shape it

| # | Draft `page` / surface | Ground | Beat (founder video) | What the learner does |
|---|---|---|---|---|
| 1 | `hear-it` (Promise) | `colour.blue` | Promise | Picks a drink, sees and hears the first French line, taps **Make my plan** |
| 2 | `reason` | `paper.ground` + sun plan card | Quiz | Where they will use French |
| 3 | `start-level` | same | Quiz | What they can do today |
| 4 | `time` (now the **daily goal**) | same | Quiz | Casual 5 / Regular 10 / Serious 15 / Intense 20 |
| 5 | `plan` | `colour.sun` | Plan | Plan reveal: ring, count-up, three real tiles, **Try this practice** |
| 6 | surface `start` (sheet) | white sheet | Show exactly what happens | Disclosure, 13+, opt-ins, **Start practice** |
| 7 | `practice` | `paper.ground` | Win (attempt) | Types (or speaks, where speech is available) one reply |
| 8 | `recap` | `colour.coral` if accepted, paper if not | Win | Big celebration; their line next to the natural line |
| 9 | `remind` (**new**) | `paper.ground` | Remind | The streak flame lights at Day 1, then the reminder pre-prompt |
| 10 | `keep` (**new**) | `paper.ground` | Save | A save-progress card listing real investment, then the SignUp sheet |
| 11 | `home` (guest; only after **Not now**) | `paper.ground` | Continue | Continue practice plus a 2×2 icon grid |
| 12 | `GuestAccountHandoff` | `colour.mint` | Saved | Keep this practice; XP is recorded and counted up |
| 13 | `Wall {entry:'first-run'}` | `colour.sun` | Paywall | Honest free-minutes timeline, plans, visible **Not now** |
| 14 | Home tab | paper | — | First Home: streak 1, quests, starter card |

**Binding decisions for this section**

1. **Keep an explicit Continue; do not auto-advance.**
   - The ledger-pinned title `illustrated full-width choices carry radio state and never advance on selection` (F601, `KNOWN_ISSUES.md:8966`) must stay true.
   - Duolingo's own goal screens use a CONTINUE button.
   - VoiceOver users need the explicit step.
   - The video's motion is kept: selecting an option fires the chip flight. Continue then advances.
2. **Keep the level question.** It changes real behaviour:
   - the translation is hidden for `getby` (`P:846`);
   - the sentence starter is shown for `zero` (`P:856`);
   - it feeds `firstSceneFor` and `startEstimate` (`S/onboarding/plan.ts:67-88`).
3. **The daily goal replaces time and days.**
   - The `frequency` page leaves `FULL_SETUP`. The `frequency` field stays on the draft because the field list is pinned by `S/legal/policy.test.ts:825-829`.
   - Onboarding loses one screen: 5 setup pages become 4 answers plus the plan.
4. **No XP number before an account exists.**
   - `S/revamp/uxControls.test.ts:53` (pinned) forbids `recordActivity` in `P`.
   - No XP rule exists for starter replies (`C/levels/levels.ts:94-115`).
   - XP is recorded and shown at the hand-off, under the account.
5. **Day 1 lights only after `finish()` has persisted `completed: true`** (`P:470-475`).
   - That makes it a real finished practice (decision 3).
   - It is derived from the guest record, not from any tracking.
6. **The paywall comes after the account.**
   - `PurchasesAdapter.offering(userId)` needs a user (`S/purchases/contract.ts:47`).
   - Purchase success already waits for a confirmed entitlement in `WallScreen`.
7. **"Start practice" replaces "Start speaking / Type instead".**
   - Production guest speech is off (`R/docs/ONBOARDING.md:38`).
   - So every production learner who taps **Start speaking** today lands on "Speaking is unavailable right now. Type your reply below." (`P:381`, `P:386-387`).
   - The practice page offers the mic only when `guest.speechAvailable === true`.
8. **No "Building your plan…" text and no shimmer.**
   - `R/DESIGN.md:791-792` bans "fake progress … or artificial processing delay".
   - The founder's "honest ≤600 ms build" becomes the plan card physically assembling the learner's own answers. It never claims computation.

### 2. Current defects this section fixes (verified)

| Defect | Source |
|---|---|
| **An echo of the tutor's question is accepted as an answer.** "Salut ! Ca Va" is normalised to "salut ca va"; `concise()` strips the leading "salut", leaving "ca va", which matches the `family-hello` variant `'ça va'`. The prompt itself is `'Salut ! Ça va ?'` | `C/onboarding.ts:90`, `:250-254`, `:266`, `:298-318`; server echoes the raw reply at `R/services/token-server/src/server.ts:407` |
| Unchecked spelling spreads to every surface: shown on recap and home, saved to the phrasebook and to Home replay | `P:916`, `P:974`; `S/onboarding/GuestAccountHandoff.tsx:71`, `:146-148`; `S/onboarding/StarterContinuation.tsx:80` |
| Selected ring invisible on blue (`borderColor` is `colour.blue` on a blue page) | `S/onboarding/ChoiceCard.tsx:63` |
| One icon repeated for every option | `P:745/751` (drink), `:791` (ability), `:802` (time), `:813` (days); `S/onboarding/ChoiceArt.tsx:4-85` |
| Disabled Next looks live (slate pill with white text) | `S/onboarding/NextButton.tsx:41` |
| Heavy grey progress track | `S/onboarding/OnboardingMotion.tsx:152` (`paper.field`) |
| Text "Back" link; round back unused | `P:692`; `RoundButton` at `S/components.tsx:1611-1647` |
| Promise card looks clipped; "Hear" is a 44 pt link at the card's foot; no scroll cue | `P:754-767`; `S/layout.tsx:205` (`showsVerticalScrollIndicator={false}`) |
| Empty middle on the plan page; edits are bare links | `P:820-839` |
| Off switches nearly invisible on iOS (no `ios_backgroundColor`) | `S/settings/SwitchRow.tsx:57` |
| Start sheet content hidden under the footer rule, with no scroll cue | `S/components.tsx:1818`; footer rule at `P:654` |
| Four stacked links on recap and on home | `P:921-966`, `P:979-1009` |
| Reminder sheet is 7 day rows plus 4 time rows | `P:1316-1373` |
| Celebration is a 3.5% art bump plus one haptic | `P:436-437`; `S/onboarding/OnboardingMotion.tsx:31-51` |

### 3. Structure, state machine and data changes

**3.1 Flow** (`S/onboarding/flow.ts:3-26`)
- `FULL_SETUP = ['hear-it','reason','start-level','time','plan']`.
- `FIVE_SETUP` keeps its name for the env flag `EXPO_PUBLIC_ONBOARDING_VARIANT=five` and becomes `['hear-it','reason','time','plan']`.
- `earnedChoices` counts `drink, reason, startLevel, minutes`: 4 in full, 3 in the short variant.
- `P:694` becomes `total={questionOrder === FIVE_SETUP ? 3 : 4}`.

**3.2 Draft** (`S/onboarding/preAccountDraft.ts`)
- Append `'remind', 'keep'` to `PRE_ACCOUNT_PAGES` (`:49`). Append at the end so `pageSource()` in `S/onboarding/firstRun.test.ts:64-71` still slices correctly.
- `PLAN_MINUTES = [5, 10, 15, 20, 'none']` (`:58`). `repaired()` then keeps 20 (`:172`).
- Add no new draft fields. `S/legal/policy.test.ts:825-829` pins the field list, and `reminderEnabled/reminderDays/reminderTime` already exist.

**3.3 Resume** (`P:125-129`)
- Map `'frequency'` to `'time'`.
- Add `'remind'` and `'keep'` to the guest-required list at `P:238` and `P:250`, so a missing guest record falls back to `plan`.

**3.4 Back** (`P:275-294`)
- `remind` → `recap`; `keep` → `remind`; `home` → `keep`.
- `recap` → `plan` (unchanged).

**3.5 Forward**
- `finish()` (`P:470-475`) calls `go('remind')`, not `go('home')`.
- Remind leads to `keep`.
- On `keep`, **Not now** calls `go('home')`.

**3.6 A twenty-minute goal**
- `C/onboarding.ts:241`: slice to `minutes === 15 || minutes === 20 ? 3 : minutes === 10 ? 2 : 1`, and widen the parameter type to include 20.
- `S/onboarding/guestPractice.ts:71` sends `minutes: starterMinutes(plan.minutes)` (maps 20 to 15). The server validates `[5,10,15,'none']` (`server.ts:349`), so this avoids a server change.
- Profile: widen `dailyGoalMin` to include 20 (`S/profile/store.ts:148`, `:173`, `:490`).
- `S/profile/dailyGoal.ts:23`, `:38-43`: add `{ key: 'twenty', minutes: 20, label: 'Twenty', gloss: 'A long conversation' }`.
- `S/onboarding/createFromDraft.ts:36` then carries 20 through unchanged.

**3.7 Where code goes** (a hard rule)
- Every literal a test pins stays in `P`. That covers labels, handlers, `page === 'plan' ? colour.sun`, `STARTER_*`, and the consent sheet.
- New presentational components live in `S/onboarding/firstRun/` and take values by props:
  - `PlanCard.tsx`, `DrinkTiles.tsx`, `GoalTile.tsx`, `PlanReveal.tsx`, `ConsentFacts.tsx`;
  - `MicMeter.tsx`, `WinCard.tsx`, `ReminderAsk.tsx`, `InvestmentList.tsx`, `firstRunCopy.ts` (all new copy, tested).
- Pure data helpers go in `S/onboarding/guestProgress.ts`:
  - `guestDays(guest)`: local day keys of guest records with `completed === true`, using the streak section's `dayKey()` from `C/streak/`;
  - `guestInvestment(guest, draft)`;
  - `starterMinutes(m)`.
- None of these files may add `accessibilityRole="header"`. `P` must keep exactly 2 (`S/surfaceContract.test.ts:640`).

**3.8 Celebration wiring**
- `CelebrationHost` must be mounted in `R/apps/mobile/App.tsx` **above** `Gate`, so signed-out first-run events play.
- First-run pages draw their own choreography in-page, because the page *is* the moment.
- They call `useCelebrate().play(event, { inline: true })` so the host only sequences sound and haptics and deduplicates by key.

### 4. Shared first-run chrome

| Element | Spec |
|---|---|
| **Header** (question, plan, practice, remind and keep pages) | Row, `minHeight: 44`, gap 12. Left: `IconButton name="arrow-left" variant="linear" label="Back"` (44 pt round, white disc, ink arrow; on coral a white disc). Replaces `GhostButton` at `P:692`; `label="Back"` keeps `practiceDisclosure.test.ts:26` passing. Right, on question pages only: `<SetupProgress>` |
| **SetupProgress → LivingBar** (`S/onboarding/OnboardingMotion.tsx:126-166`) | Height 8, radius 4, track `paper.skeleton` (replaces `paper.field`), fill `colour.blue` with a 2 pt top highlight stripe (white at 0.35). On increment: scaleX `withTiming` 270 ms `EASE.inOut`, then one sheen sweep 300 ms linear. Keeps `accessibilityRole="progressbar"` and the `accessibilityValue` text "2 of 4 plan answers chosen". Reduce Motion: set instantly, no sheen |
| **PlanCard** ("Your French plan") | Lives in the `ScrollScreen` `header` slot under the Back row, so it persists across question pages and never remounts. Sun card, radius 20, padding 12/14. Label "Your French plan" in `type.small` ink. One wrapping row of 4 slots: empty slot = dashed pill 32 pt, 1.5 pt `paper.field` dashes. Filled token = white pill with a Bulk 16 pt icon and a short label (§5.2). Not tappable, so no 44 pt rule. `accessible` with label "Your French plan: Coffee, Food and drinks. 2 of 4 chosen."; on each new token, `AccessibilityInfo.announceForAccessibility("Added to your plan: Food and drinks")`. Must not be named `Chip` or `Label` (`practiceDisclosure.test.ts:26` bans `<Chip|<Label`) |
| **Continue** (`S/onboarding/NextButton.tsx`) | Text becomes "Continue" (`NextButton.tsx:48`); `accessibilityLabel="Continue"`. Disabled: `paper.skeleton` fill, `paper.inkSoft` text and arrow, `accessibilityHint="Choose an answer first"` (replaces the live-looking slate at `:41`). Becoming enabled: fill cross-fades to `paper.ink` over `DUR.fast` (180), then one `Glint` at +220 ms. Keeps the 100/140 ms arrow nudge |
| **Page title** | One `<Text ref={heading} accessibilityRole="header">` (`P:722-729`), animated as a block: opacity 0→1 plus translateY 6→0 over `DUR.base` (260), `EASE.out`. I did not split it word by word: the heading must stay one focusable Text with correct Dynamic Type wrapping, and iOS has no per-word blur. Reduce Motion: shown at once |
| **Page change** | `PageArrival` keeps a 16 pt slide, now `DUR.base` (260). Forward: old content fades over `DUR.micro` (120); new rows use `StaggerIn` |
| **Sound/haptic gating** | Every `sfx.play` is muted when the mic is live (`hapticPreference.ts:7` `microphoneMutes`) and when the onboarding `player` is playing (`P:193-195`). Nothing plays on page arrival except the celebration moments below, so there is no autoplay (`firstRun.test.ts:95`) |
| **iPad column** | First-run body, header and footer sit in a centred `READING_COLUMN` (560) constant from `S/responsiveLayout.ts`, applied by a new `ScrollScreen column="reading"` prop in `S/layout.tsx`. No literal widths in first-run files (`surfaceContract.test.ts:786-799`) |

### 5. Screen by screen

#### 5.1 Promise (`hear-it`, blue)

| Item | Spec |
|---|---|
| Purpose | One promise and one decision. The learner sees and hears real French before any question |
| Layout (top to bottom) | Art `place-cafe-counter` (`OnboardingArtwork`, small 262×165; large 350×220 on regular width) → title "Try a little French." (`type.display`, white) → "First, pick a drink." (`type.bodyStrong`, white) → `DrinkTiles`: 2 side-by-side tiles, `accessibilityRole="radiogroup"`, each `Choice variant="tile"`, min height 112 (88 on `useCompactPhone()`) → phrase card |
| What fills the old blank space | Before a drink is picked, a **dashed placeholder card** reads "Your first French line appears here." Once the phrase card mounts, the art shrinks to 0.72 and its box collapses (layout transition 300 ms `EASE.inOut`). That frees about 46 pt, and the scroll calls `scrollToEnd({ animated: !reduced })` so the card and its speaker are fully visible. This fixes the "clipped card" look |
| Phrase card | White `Card`. FR `Bonjour, je vais prendre un café.` / `…un thé.` (`type.frenchLg`) and EN `Hello, I will have a coffee.` (strings stay at `P:756-759`, pinned by `firstRun.test.ts:95`). The speaker moves to the card's top-right: `IconButton name="volume-high" label={playing ? 'Stop' : 'Hear'}` with `AnimatedIcon` speaker waves while `playing`. Coffee only (`P:760`): there is no bundled tea clip (`clipFor` reads only the coffee reply, `S/onboarding/exchangeAudio.ts:17-19`), so no dead button |
| Icons (Iconsax Bulk) | Coffee: `coffee`. Tea: Iconsax free has no teacup, so build `icons/custom/TeaCup.tsx` (Bulk style, cup with a tag string) per decision 10. "Try a practice now": `flash` (Linear, white) |
| Footer | `PillButton tone="white" label="Make my plan" disabled={!draft.drink}` (`P:545-550`, keep literal), then `IconAction icon="flash" label="Try a practice now"` (replaces `P:551-565`) |
| Selection motion | Tile fill white → `colour.sun` over 150 ms `EASE.out`, scale 1 → 1.01 → 1 (`SPRING.snap`). Check badge pops 0 → 1 (`SPRING.pop`, about 16% overshoot). Icon pops 1 → 1.12 → 1. The selected state is a **fill**, which fixes the invisible ring (`ChoiceCard.tsx:63`). First selection: phrase card `StaggerIn` (opacity, +10 pt, 280 ms `EASE.out`). Switching drink: FR/EN cross-fade over `DUR.micro`. **Make my plan** enables: fill cross-fade 180 ms, `Glint` once at +700 ms (200 ms linear, white band at 0.35) |
| Transition to Q1 (video beat 1) | Press `SPRING.press` (0.97). Content fades 200 ms. Ground cross-fades blue → cream over 200 ms `EASE.inOut`. Art "sets": translateY +240, scale 1 → 0.9, 600 ms `EASE.in`. PlanCard fades in (200 ms) with 4 dashed slots. **ChipFlight** from the drink tile (measured with `measureInWindow` before `go`) to slot 1: Y 360 ms `EASE.out`, X 480 ms `EASE.inOut`, scale 0.76 → 1.12 (200 ms) then `SPRING.settle` (stiffness 322, damping 21.5). Then LivingBar segment 1, 270 ms. Q1 rows become tappable as they appear (non-blocking) |
| Sound / haptic | Tile: `select` / `tapSettled` (via `Press haptic="selection"`). Make my plan: `whoosh` / `pressed()`. Chip lands: `count-tick` at low gain, no haptic (no duplicate tick, `DESIGN.md:807`) |
| Persisted | `draft.drink` and `page`, through `patch` → `onDraftChange` (`P:200-206`) → `@luvani/pre-account-onboarding/v1` |
| Reduce Motion | No wash, drop or flight. Instant ground swap; token appears in its slot with a 120 ms opacity fade; bar set instantly; art collapse instant |
| Tests pinning | `firstRun.test.ts:95`, `:97` (F601 pinned; keep `const blue = page === 'hear-it'`, `colour.blue`, `type.display`, `label="Make my plan"`, `footer={footer}`), `preAccountDraft.test.ts:177`, `:179` |

#### 5.2 Goal (`reason`) and Level (`start-level`)

| Item | Goal | Level |
|---|---|---|
| Title (unchanged, `P:98-99`) | "Where will you use French first?" | "What can you do in French today?" |
| Why line under the title (true) | "This picks your first practice." (true: `firstSceneFor`, `starterTasks` routes) | "This sets how much help you get." (true: `P:846`, `P:856`) |
| Rows (`REASONS`, `START_LEVELS`, `plan.ts:29-45`) | 6 rows; **"I’m exploring" becomes a 6th row** instead of a skip link (`P:774` filter removed) | 3 rows |
| Bulk icon per row (through `<ChoiceArt kind=…>`, which now renders the Iconsax Bulk icon, keeping `<ChoiceArt` per `firstRun.test.ts:118`) | food `reserve` · trip `airplane` · family `people` · moving `house-2` · work `briefcase` · because `discover` | zero `message` · few `message-text` · getby `messages-2` |
| Token label in PlanCard | Food and drinks · Trips · Friends and family · After a move · Work · Exploring | New to French · Hello and a drink · Short conversations |
| Skip | — | `IconAction icon="message-question" label="I’m not sure"` under Continue; sets `zero` and advances (explicit tap, `P:580-592` logic kept) |

| Item | Spec (both pages) |
|---|---|
| Layout | Header → PlanCard → title → why line (`type.body`, `paper.inkSoft`) → radiogroup of `Choice` rows (min 72, gap 10, Bulk icon tile 44) → footer `<NextButton disabled={answer == null} onPress={nextQuestion} />` (keep literal, `P:569`) |
| Selection | `onPress={() => choose({ reason: v.key })}` (keep literal, pinned). `choose` (`P:302-305`) still never calls `go`/`setPage`. Row fill white → `colour.blue` over 150 ms `EASE.out`, title ink → white, Bulk icon recoloured (primary white, secondary sun), scale pop 1.01. Previous row reverses. At +170 ms, ChipFlight from the row's trailing edge to the slot (same numbers as §5.1). Changing an answer: slot content cross-fades over 120 ms, no second flight |
| Row arrival | `StaggerIn` 67 ms apart, each 250 ms `EASE.out` from +10 pt, no overshoot |
| Sound / haptic | `select` + `tapSettled`; Continue `tap` + `pressed()`; land `count-tick` |
| Persisted | `reason`, `startLevel` |
| Reduce Motion | Rows present; instant fill swap; token fades in over 120 ms |
| Tests | `firstRun.test.ts:114` (unpinned, edited), `:118` (pinned, unchanged), `plan.test.ts:139-142` (titles unchanged) |

#### 5.3 Daily goal (`time`, merged)

| Item | Spec |
|---|---|
| Title (replaces `P:100-101`) | "What’s your daily goal?" |
| Sub | "You can change it any time." (true: Profile row `DAILY_GOAL_ROW`) |
| Tiles (4 `GoalTile` rows, radiogroup) | **Casual**, "5 minutes a day" · **Regular**, "10 minutes a day" · **Serious**, "15 minutes a day" · **Intense**, "20 minutes a day" |
| Icons | Casual `clock`, Regular `timer-1`, Serious `flash`, Intense `speedometer` (Bulk). Each also gets a mini `ProgressRing` (16 pt) filled to minutes/20, an honest proportion |
| "Suggested" tag | Text "Suggested" in `type.small`, blue on white (white when selected), on the tier equal to `presetMinutes(levelOf(draft), draft.reason)` (`plan.ts:76-79`: work/moving 15, zero 5, otherwise 10). It is a true derivation from earlier answers, never "most common". Doc comment says so. Nothing is preselected |
| Skip | `IconAction icon="edit-2" label="Choose each time"` sets `minutes: 'none'` (copy kept from `P:577`) |
| a11y label | "Regular, 10 minutes a day, suggested" |
| Token label | "10 min a day" / "Each day" |
| Motion / sound / haptic | As §5.2. The selected tile's mini ring refills 0 → its value over 400 ms `EASE.out` |
| Persisted | `minutes` (5/10/15/20/'none'). `frequency` is no longer written |
| Remove | `frequencies` (`P:84`), the frequency radiogroup (`P:807-817`), the `No schedule` label (`P:578`) |

#### 5.4 Plan reveal (`plan`, sun)

| Item | Spec |
|---|---|
| Purpose | Value before any ask: the learner's plan, built from their own answers |
| Ground | Keep the literal ternary `page === 'plan' ? colour.sun` (`P:511-512`, pinned `firstRun.test.ts:116`) |
| Layout | Header (Back) → **PlanCard expanded** (white on sun): label "Your French plan", the 4 tokens pinned at top, `IconButton name="edit-2" label="Change plan"` top-right (opens `open('plan')`). Then title `${task.title}.` (e.g. "Greet someone you know.", `P:524-525`). Then **ProgressRing** (132 pt, 8 pt stroke, ink arc on a `paper.skeleton` track) with `CountUp` centre `{minutes}` over "minutes a day" (`'none'` shows a full ring and "Each day"). Then line "Any finished practice counts for your streak, even offline." Then **3 StatTiles** (stagger 140 ms). Then the "Your first exchange" card. Then the AI row |
| Tiles (all real data) | (1) `messages-2`: "{n} exchange(s)" / "in your first practice". n = `tasks.length` (`P:224-228`). (2) Scene art thumbnail via `sceneIllustration(planFor(draft).scenes[0].id)`: "{scenes[0].titleEn}" / "your first scene" (`plan.ts:189-207`). (3) Tutor: `Press label="Choose tutor"` showing `tutorVoice(draft.tutorVoice).persona.name` / "your AI tutor", opens `open('voice')`. Names come from persona functions (`tutor/tutorName.test.ts:263`) |
| First exchange card | `task.prompt` (`type.frenchLg`) and the line `{task.translation} Start with one reply.` (keep, pinned) |
| AI row | `cpu` icon plus `{STARTER_AI}` ("Your tutor is AI."), always visible, never animated away (`P:823`) |
| Quick route | When `draft.quickStart`, every token carries "Suggested" and the line "A suggested beginner café practice." stays (`P:825-827`) |
| Footer | `<PillButton label="Try this practice" onPress={() => open('start')} />`. Exact literal pinned by `disclosure.test.ts:446` |
| Build (≤ 600 ms, no text, no shimmer) | t0: ground cream → sun over 200 ms `EASE.inOut`; PlanCard fill sun → white over 200 ms; card expands with `LinearTransition` 300 ms `EASE.inOut`, tokens pinned. t300: label cross-fade over 70 ms. t330: title block rise (260 ms) |
| Reveal (founder beat 3) | t380: ring draws over 650 ms `EASE.inOut` (`useAnimatedProps` `strokeDashoffset`) with CountUp over 1000 ms `EASE.out`. t520: tiles stagger 140 ms (220 ms, +7 pt); the minutes ring gets a blue outline flash at +130 ms ("your answer"). t≈1100: CTA fade-rise 8 pt over 280 ms `EASE.out`. +220 ms: `Glint` once. The CTA is pressable from mount (non-blocking) |
| Event | `play({ type:'plan-ready', key:\`plan:${generation}\`, data:{ minutes, exchanges } })` fires only when arriving from Q3 Continue or a plan-sheet Done. Back from the start sheet shows the final frame |
| Sound / haptic | `whoosh` at expand. `count-tick` at most 4 times (≥120 ms apart). `tick()` at 1/3, 2/3 and final. `soft()` at the end. Never `arrived()`: a plan is not earned |
| Change plan sheet (`P:1082-1162`) | Rows: Goal, French today, **Daily goal** (renamed from "Practice length"). The **Routine** row is removed (`P:1106-1110`). Options use the same Bulk icons. Done → `pulse('ready')` → CountUp from the old value to the new over 600 ms |
| Choose tutor sheet (`P:1168-1193`) | Unchanged logic. "Hear {name}" becomes `IconButton name="volume-high" label={playing ? 'Stop' : \`Hear ${name}\`}`. The `hear(voiceSample(v.value))` literal is kept (`preAccountDraft.test.ts:183`) |
| Reduce Motion | Final frame: full ring, final number, tiles and CTA visible; one `soft()` haptic; no ticks |
| Persisted | `page`; edits through `patch` (`P:639-645`) |
| Tests | `firstRun.test.ts:116` (pinned; bans `scene.canDoEn`, `METHOD_STEPS`, `HeroNumber`, `ROUTINE_NOTE`, so use `CountUp`, never `HeroNumber`), `disclosure.test.ts:446`, `preAccountDraft.test.ts:173`, `:181`, `:183` |

#### 5.5 Start sheet (surface `start`): fewer controls, same legal facts, same order

**Order kept:** AI → processing (Deepgram) → local storage → 13+ → opt-ins → start. The disclosure text constants are unchanged (`S/onboarding/disclosure.ts:376-378`).

| Item | Spec |
|---|---|
| Title | "Start your practice" (unchanged, `P:1065-1066`) |
| `ConsentFacts` (3 icon rows, full text, not collapsible) | `cpu` + `{STARTER_AI}` · `microphone-2` + `{STARTER_PROCESSING}` (the full Deepgram sentence) · `mobile` + `{STARTER_LOCAL}`, then `IconAction icon="info-circle" label="Privacy details"` (keep literal, `preAccountDraft.test.ts:185`). In `P` the source order must keep `STARTER_AI` before `STARTER_PROCESSING` before `'I am 13 or older'` before `'Optional usage data'` (`disclosure.test.ts:293`, `:440`) |
| Age | `Choice title="I am 13 or older"` (unticked until tapped), then `GhostButton label="I am younger than that"`. The refusal handler (`P:1206-1219`) is unchanged; it stays a text link because it is a rare, consequential path |
| Opt-ins | Both `SwitchRow`s stay visible and off (`answers.test.ts:482` pinned: one `title="Optional usage data"`, "Your words and audio are excluded"). **iOS fix** in `S/settings/SwitchRow.tsx:57`: add `ios_backgroundColor={paper.field}`. `paper.field` on white is at least 3:1, which meets the floor for marks |
| Footer (one row) | `PillButton label="Start practice" disabled={busy \|\| !draft.eligibilityConfirmed}` (flex 1) as a `MorphButton`, beside `IconAction icon="cloud-cross" label="Practise offline" disabled={busy \|\| !draft.eligibilityConfirmed}` (64 wide). **Remove** `Type instead` from the sheet (`P:660-664`); typing is the practice page's default or its alternative. Remove the inline `borderTopWidth` (`P:631`, `P:654`) |
| Clipping fix (design-system, in `Sheet` `S/components.tsx:1759-1825`) | Sheet header `Close` becomes `IconButton name="close" label="Close"` (`:1816`). The ScrollView (`:1818`) measures content against layout. When it overflows, it draws a 16 pt bottom fade (react-native-svg `LinearGradient`, decorative, `pointerEvents="none"`), shows a hairline above the footer, and calls `flashScrollIndicators()` once 400 ms after opening. iPad: panel centred, `maxWidth: READING_COLUMN`. Keep `maxHeight: '94%'` and the 0.4 scrim (`stage3.test.ts:30`) |
| Facts motion | Opacity only, 200 ms, staggered 120 ms; connector lines scaleY 270 ms, then a glow fade 150 ms (video beat 4, softened for legal text). Text is never offset or hidden |
| Start morph | Pill → 56 pt circle over 200 ms `EASE.inOut`, then a spinner arc at 800 ms per revolution, linear, while `busy` (`accessibilityState={{ busy: true }}`, announce "Connecting"). Success: check draws over 100 ms, sheet closes (250 ms), practice arrives. Error: morphs back to the pill over 200 ms and the existing issue text shows (`P:392-396`). No shake |
| Sound / haptic | No sound effects in this sheet (consent stays calm). 13+ → `tapSettled` (exists); Start → `pressed()` |
| Persisted | `eligibilityConfirmed`, `analyticsConsent`, `rememberLearning` (draft). On start, guest record `@luvani/guest-practice/v2` |
| Reduce Motion | Facts shown at once; morph replaced by the label swap "Connecting…" (`P:656` copy) |
| Tests | `disclosure.test.ts:435-447` (unpinned: replace the `Type instead` assertion with the two new literals), `:293`, `:449`; `answers.test.ts:482` (pinned, unchanged); `preAccountDraft.test.ts:185`; `firstRun.test.ts:120` (pinned, unchanged); `S/settings/rowFeedback.test.ts:39` (still matches; add the `ios_backgroundColor` assertion) |

#### 5.6 Practice (`practice`, cream)

| Item | Spec |
|---|---|
| Layout | Header (Back + `ExchangeSteps`: segmented LivingBar, one segment per real task, label "Exchange 1 of 2") → prompt card (`task.prompt` and `task.translation`, `P:842-849`) → starter hint for `zero` (`P:856-860`) → input area → `IconAction icon="lifebuoy" label="Help"` (replaces the hand-underlined `Press` at `P:894-909`; keep `soft()`) |
| Typed (default; the only mode in production today) | `TextInput` as at `P:862-882`. Line under it, only when `guest.speechAvailable !== true`: "Here you type your reply. You can speak with your tutor in your first conversation." (true: authenticated rooms have speech) |
| Waiting states (honest; there is one real network call, 12 s timeout at `guestPractice.ts:49`) | Send `MorphButton` "Send reply" → spinner, label "Checking your reply…" (`P:600`). At ≥4 s, add a polite live line: "Still checking. A slow connection can take a few seconds." At timeout the existing error appears, with `IconAction`s **Practise this offline** (`cloud-cross`) and **Try again** (`refresh`), labels kept (`uxControls.test.ts:10` pinned). No fake "analysing" |
| Spoken (only if `guest.speechAvailable`) | `GuestRecording` (`S/onboarding/GuestRecording.tsx`): recorder built with `{ ...RecordingPresets.HIGH_QUALITY, isMeteringEnabled: true }` (`:20`) and `useAudioRecorderState(recorder, 50)` (expo-audio 57.0.4). **MicMeter**: 5 bars, scaleY = 0.25 + 0.75 × level × [0.6, 0.85, 1, 0.85, 0.6], level = clamp((metering + 50) / 50, 0, 1), smoothed with `withTiming` 80 ms linear. Around the 96 pt disc, a thin ring fills linearly over the real 20 s cap (`:100-102`). After 2 s below −45 dB: "We can’t hear you yet. Try moving closer to the microphone." Mic permission is still asked only on the tap (`:77`, `disclosure.test.ts:449`). "Type instead" becomes `IconAction icon="keyboard" label="Type instead"` |
| Sound / haptic | No sound effects and no haptics while recording (existing `silenceRecordingHaptics`, `:95`; the sound seam checks the same counter). Send: `tap` / `pressed()` |
| Persisted | Attempts on submit (`P:423-429`, `saveGuestPractice(next)` kept) |
| Reduce Motion | MicMeter becomes a static mic plus a text state that swaps "Hearing you" / "Waiting for your voice"; the cap ring becomes "12 seconds left"-style text updated once a second; morph becomes a label swap |
| Tests | `firstRun.test.ts:110` (pinned, unchanged: `sendGuestAttempt(guest, task, reply.trim()`), `disclosure.test.ts:449`, `uxControls.test.ts:10`, `:53` |

#### 5.7 Win (`recap`)

**Truthfulness fix first (§6).** Celebration fires only when `result.feedback.accepted && result.feedback.evidence !== 'model'`, the existing gate at `P:437`.

| Item | Accepted (coral) | Not accepted (paper, calm) |
|---|---|---|
| Ground | `colour.coral` (keep the literal). `const coral = page === 'recap' && last?.feedback.accepted === true` | `paper.ground` |
| Art | `celebrate-first-line`, explicit `fit="large"` (it has no small size; `S/art/flat/index.ts:65`) | `state-notebook` |
| Title (`P:528-531`) | "That reply works." | "Try this small change." |
| `WinCard` (white) | **"You said"** (`type.small`, soft ink) plus `last.reply` exactly as typed or transcribed (`type.frenchLg`). Divider. **"A natural way to say it"** plus `task.model`, with `IconButton name="volume-high" label="Hear"` when `tutorAudioForFrench(TUTOR_DAILY_AUDIO, DAILY_ITEMS, task.model, draft.tutorVoice)` resolves. If `last.reply.trim()` equals `task.model` exactly, show one row with a mint check and "Exactly the natural way." Then `last.feedback.text` | "You said" plus the reply; **"Try it like this"** plus `<Highlight text={last.feedback.model} />` (`P:919`); then the correction text |
| Secondary `IconAction` row (replaces the 5 stacked links, `P:921-966`) | `archive-add` (AnimatedIcon bookmark fill) "Keep this phrase" / "Phrase kept"; `arrow-right` "Next exchange" (only if `taskIndex < tasks.length - 1`); `refresh` "Retry this line" (same condition as `P:921`); `info-circle` "Feedback details". **Save progress moves to the Save page** | same, with "Keep the example" |
| Footer | `PillButton tone="white" label="Continue"` → `finish()` (was "Finish", `P:608`) | ink `PillButton label="Continue"` |
| Choreography | t0: **Bloom**, three radial layers (sun → coral) animating opacity bottom-up at delays 0/200/300 ms, 500–600 ms each, `EASE.out`. t150: art rises 30 pt and scales 0.9 → 1 over 650 ms `EASE.out`. t300: **Burst**, 24 particles from the art centre using the confetti vocabulary (14×6 bars, dots, triangles, rings) in `colour.sun`, `colour.mint`, `paper.card` and `colour.blue`; gravity arc, `DUR.celebrate` (900); one-shot, removed after. Title block. t450: WinCard rises 8 pt over 280 ms, rows staggered 120 ms. t700: icon actions staggered 60 ms. t900: `Glint` on Continue. Everything is pressable immediately (non-blocking) | Art pulse (`OnboardingArtwork` `help`), card rise 260 ms |
| Event / sound / haptic | `play({ type:'reply-accepted', key:\`guest:${last.taskId}:${last.at}\` })` → `correct` + `celebrate()` (success, then two light impacts 80 ms apart). Replaces the lone `arrived()` at `P:437`. Back-navigation return shows the final frame | `nearly` + `soft()` |
| Keep phrase | On `if (saved)` (`P:485`): bookmark fills, `play({ type:'phrase-saved', key:\`kept:${last.at}\` })` → `save` + `tapSettled`. Note "Phrase kept on this device." (`P:487`, kept) | same |
| Persisted | `kept`, attempt `kept`; Continue persists `completed: true` | same |
| Reduce Motion | Final frame (bloom at full opacity, no particles); sound and haptic still play once | instant |
| Tests | `firstRun.test.ts:97` (pinned, keeps `colour.coral`), `:110` (pinned), `uxControls.test.ts:10` (pinned: `label="Try again"`/`Retry` and `if (saved)` kept), `S/revamp/uxControls.test.ts:53`, `S/sessionScreens.test.ts:110`, `S/art/registry.test.ts:41`, `:86` | |

#### 5.8 Day 1 and reminder (`remind`, new)

| Item | Spec |
|---|---|
| Entry | Only through `finish()` after `persist({ ...guest, completed: true })` succeeds (`P:472`). A resume or Back arrival shows the final frame |
| Data | `streak = streakFrom(guestDays(guest), today)` from the streak section's pure `C/streak/` module; normally 1. A learner who practised as a guest on two days sees the real number |
| Layout | Header (Back) → **StreakFlame** (code-built flat art from the streak section, 140 pt) with "1" (`type.hero`) and "day" beneath → title "Your streak has started." → **WeekStrip** (7 localised day circles: today filled sun with a check, earlier days neutral outlines) → line "Any finished practice counts, even offline. Live minutes are not needed." (decision 3) → **ReminderAsk** card (only if `REMINDERS_AVAILABLE`, `S/reminders/schedule.ts:61`) |
| ReminderAsk | `AnimatedIcon` bell `notification-bing` → "Want a daily reminder?" → "One nudge a day at the time you choose. It helps you come back for day 2. You can turn it off in Settings." → time radiogroup of 4 compact tokens from `REMINDER_TIMES` (`S/reminders/reminder.ts:116-121`), with `DEFAULT_REMINDER_TIME` preselected (a time default, never a permission default). Days are fixed to `[1..7]` for a daily streak; the 7-row day list is removed from first run (`P:1319-1332`) |
| Footer | `PillButton label={\`Remind me at ${gloss}\`}` → `askReminderPermission()`, then `scheduleReminder(time, [1,2,3,4,5,6,7])`, then `patch({ reminderTime, reminderDays:[1..7], reminderEnabled:true })` (logic from `P:1344-1368`). Then the bell ring plus check, then `go('keep')`. `IconAction label="Not now"` → `go('keep')`. Denied: "Reminders are off. You can turn them on later in Settings." and the button becomes "Continue". Web: no card, button "Continue" |
| Choreography | t0: flame ignite (streak section's `StreakIgnite`: ember `SPRING.pop`, flame grows 420 ms, 3 flicker cycles then still); CountUp 0 → 1; WeekStrip today fills over 260 ms with a check draw of 120 ms. t600: ReminderAsk rises over 280 ms. t900: bell rings ±12° ×3 over 600 ms |
| Event / sound / haptic | `play({ type:'streak-extended', key:\`guest-day:${dayKey}\`, data:{ days, source:'guest' } })` → `streak` + `celebrate()`. Reminder set: `save` + `tapSettled` |
| Persisted | Reminder fields in the draft (carried to the account by `reminderFromDraft`, `S/onboarding/createFromDraft.ts:52-54`); OS schedule |
| Reduce Motion | Static lit flame, number, filled strip; haptic and sound once |

#### 5.9 Save progress (`keep`, new)

| Item | Spec |
|---|---|
| Title | "Save your progress." |
| `InvestmentList` card ("On this phone only", icon `mobile`; rows stagger 60 ms, each with a check draw) | Each row only if true. From `guestInvestment()`: `flash`-free flame icon "Day {n} of your streak" · `message-text` "{a} French repl{y/ies} that work{s}" (accepted, `evidence !== 'model'`) · `archive-tick` "1 phrase kept" (`guest.kept`) · `map` "{task.title}, {minutes} minutes a day" · tutor icon "Your AI tutor: {persona.name}" · `notification-bing` "Reminder at {gloss}" (`reminderEnabled`) |
| Line | Signed out: "This is saved on this phone only. A free account keeps it safe and works on your other devices." Signed in (`signedIn`, App.tsx:444-462): "Save this to your account." |
| Footer | `PillButton label="Save my progress"` → `saveAccount()` (`P:454-469`) → `AuthFlow` SignUp sheet (`S/auth/AuthFlow.tsx:63-68`; Apple / Google / email). `IconAction icon="login" label="Sign in"` (signed out only; `onSignIn`). `IconAction label="Not now"` → `go('home')` |
| Sound / haptic | Arrival silent; Save `tap` / `pressed()` |
| Reduce Motion | Rows present |

#### 5.10 Guest home (`home`)

Title "Keep going with your French." (`P:532`), then:
- a streak card (flame, "Day {n}", WeekStrip);
- a phrase card (You said / natural line, as §5.7; fixes `P:974`);
- a primary **Continue practice** (logic `P:609-627`);
- a **2×2 `IconAction` grid** replacing the four stacked links (`P:979-1009`):
  - `refresh` "Retry this line";
  - `cloud-add` "Save progress" (keeps `label="Save progress"`, `preAccountDraft.test.ts:173`);
  - `login` "Sign in" (signed out only);
  - `notification-bing` "Set a reminder" (only when `REMINDERS_AVAILABLE && !draft.reminderEnabled`; opens the slim reminder sheet, which now holds only the 4 time tokens).

#### 5.11 Hand-off (`S/onboarding/GuestAccountHandoff.tsx`, plus the bootstrap review at `R/apps/mobile/App.tsx:217-231`)

| Item | Spec |
|---|---|
| Bootstrap review (auth-engineer; logic unchanged) | Restyle to the same `InvestmentList` card. Copy: "Use this phone’s plan?" with the existing account line. Keep `function PreAccountProfileBootstrap`, `if (!confirmed \|\| delivered.current) return`, `const built = profileFromDraft(draft)`, `done(built)`, `onConsumed()` (pinned `preAccountDraft.test.ts` "turns the draft…") |
| Before keep | Mint ground; header "Keep this practice?" (`:132`). Card: `InvestmentList` and the header phrase shows `task.model` (fixes `:146-148`). Primary "Keep this practice" (MorphButton). `IconAction`s "Start fresh" and "Sign out" (strings kept, `preAccountDraft.test.ts:161`) |
| Keep | Existing `keep()` (`:46-109`) with three changes. (a) Phrase `fr: a.feedback.model` always (fixes `:71`, so no unchecked spelling enters the phrasebook). (b) After `addPhrases` succeeds, call the game layer's `recordStarterActivity(guest)`. That records today's guest days into the streak store with the guest timestamps (idempotency key `guest:${guest.id ?? 'offline'}:${dayKey}`) and XP under a new core rule `starterXp({ accepted })` (proposed 5 per accepted non-model reply, cap 15; `learning-science-engineer` approves). (c) Remaining minutes from `adoptGuestUsage` (`:53`) |
| After keep (celebration) | Title "Your practice is saved."; rows tick; **"+{xp} XP"** `CountUp` (`count-tick` + `tick()`), shown only if xp > 0; level bar if the game-layer section ships it; "{m} free minutes left with your AI tutor" (replaces `:155-159` seconds). `play({ type:'practice-complete', key:\`handoff:${guest.id}\` })` → `save` + `arrived()`. Any `badge-earned` / `quest-complete` events from the conversion queue in the host and play after this one |
| Continue | `finish()` (`:110-129`) → `onDone(kept)`. `App.tsx` sets an in-memory `offerFirstRun = storeHasPlans && !entitled`; `openFirstRun()` (`App.tsx:407-414`) then resets to `[Tabs, Wall {entry:'first-run'}]`. The `FirstScene` primer stays reserved for learners who did not practise (`App.tsx:439`) |
| Reduce Motion | Final values, haptic once |

#### 5.12 First-run offer (paywall, `S/wall/WallScreen.tsx` with `entry:'first-run'`)

| Item | Spec |
|---|---|
| When | Only after account and hand-off; only when `wallPages` has plans (`S/wall/wallPages.ts:48-56`); never on web (adapter `{available:false}`, `S/purchases/adapter.ts:6-8`); never if already entitled. Once per launch (in memory) |
| Union changes | `WallEntry` (`S/wall/wallPages.ts:43`) and `RootStackParamList.Wall` (`S/nav/types.ts:164`) gain `'first-run'`; the analytics `wall_shown` entry enumeration and its agreement test change in the same commit. Page id reuses `'yours'` with an entry-specific body, so the `wall_page_seen` union does not move |
| Default body (no store introductory offer; true today: `StoreProduct` carries no intro data, `S/purchases/contract.ts:21-26`, `adapter.native.ts:90-99`) | Title `Keep talking with ${persona.name}.` Honest **timeline**, 3 nodes: (1) mint `timer-1` "Now: {m} free minutes with your AI tutor", with m from plan status `secondsRemaining`, real. (2) sun `archive-tick` "Always free: offline practice, review and your phrases" (`wallCopy.ts:90` truth). (3) blue `microphone-2` "When you want more: a plan adds speaking time every month". Then the plan rows from `WallPlansPage` (Starter 180 / Max 300 minutes, `localizedPrice` from the store; `C/metering/meter.ts:48-50`), the renewal line (`wallCopy.ts:157`), and **Restore / Terms / Privacy** as `IconAction`s (App Store 3.1.2). No "trial" word, no countdown, no "recommended" (`stage3.test` WallPlansPage lacks `recommended`) |
| Intro-offer body (only if real) | Extend `StoreProduct` with `intro: { priceString, periodUnit, periodNumberOfUnits } \| null` from RevenueCat `product.introPrice` (`@revenuecat/purchases-typescript-internal` `offerings.d.ts:145`, fields `:277-297`). Show it only when `Purchases.checkTrialOrIntroductoryPriceEligibility` returns eligible. Timeline: "Today: everything unlocked" → "Day {N−2}: we remind you" (**only** if reminder permission is granted **and** a local notification is actually scheduled for that date; otherwise omit the node) → "Day {N}: {price} a month starts. Cancel any time in the App Store." CTA wording comes from store data |
| Not now | `IconButton name="close" label="Not now"` top-right **and** a text button "Not now" under the CTA → Home tab (`leave()` path, `uxControls.test.ts` pinned test unchanged) |
| Motion | Nodes stagger 200 ms (200 ms `EASE.out`, slide 12 pt) with travelling connectors (scaleY 270 ms, glow 150 ms). CTA reveal 280 ms plus one `Glint` |
| Purchase | `MorphButton` pill → spinner during the store flow and the entitlement check → check **only after confirmed entitlement** (existing WallScreen success path, `wallSuccess.ts`). Then `play({ type:'purchase-confirmed', key:\`purchase:${productId}:${periodEnd}\` })` → `complete` + `arrived()`. Cancel or failure morphs back, with no celebration |
| Reduce Motion | Static timeline; label swaps |

#### 5.13 First Home visit (`S/tabs/HomeTab.tsx:157-161`)

- `StarterContinuation` (shown while `sessions===0`) keeps its sun card and the "Continue practice" pill.
- Its 3 links (`S/onboarding/StarterContinuation.tsx:111-113`) become `IconAction`s:
  - `refresh` "Retry my last line";
  - `microphone-2` "Speak with my tutor";
  - `crown` "See plans".
- `keep()` saves `task.model` (fixes `:80`).
- Streak widget and quests come from their sections and read the converted activity. A quest already satisfied by the guest practice shows as done with **no replayed celebration**: the host's keys were consumed at hand-off.
- `DayCount` (`:161`) keeps the lifetime total visible (decision 2).

#### 5.14 Unchanged paths

- **Refusal** (`P:521-522`, `P:730-734`) keeps no sound, no celebration and paper ground.
- **Exit sheet** (`P:1374-1388`) keeps its copy; "Leave practice" becomes an `IconAction`.

### 6. Truthfulness fix: echo acceptance (core)

In `checkStarter` (`C/onboarding.ts:298-318`), before matching:

```ts
const echoed = normalise(reply) === normalise(task.prompt);
const accepted = !echoed && chosen.some((form) => line === concise(form));
```

- When `echoed`, return `text: \`That repeats the question. Here is one way to answer: « ${task.model} »\``. That is warm, has no "wrong", and passes `guiltIn`.
- "Ça va" alone stays accepted: it is a real answer.
- The server imports core (`server.ts:11`, `:414`; `onboardingGuest.ts:194`), so **token-server must be redeployed** for online guest attempts. Offline and `StarterContinuation` paths fix themselves with the app.
- Display fixes are covered in §5.7, §5.10, §5.11 and §5.13.

### 7. Defaults versus deliberate answers

- **Nothing is preselected.**
  - The drink tap is the hook.
  - Duolingo found no-preselect goal choices stronger (`duolingo.md` §D).
  - Consent, age and reminder permission are never defaulted (`preAccountDraft.ts:94-107`).
- **"Suggested" appears only where it is a true derivation:**
  - the goal tier from `presetMinutes` (§5.3);
  - every token on the quick route.
- **Never "most common" or "most learners".** Guest metrics store no answer values (`ONBOARDING.md:69`).
- The reminder *time* default (6:00 pm) is a convenience default, not a consent.

### 8. Reduce Motion fallbacks

All motion reads `useReduceMotion()` (`S/motion.ts:27-45`), which is watched live. Reanimated configs pass an explicit `reduceMotion` driven by that hook, because Reanimated samples once at init (`tech.md` §7 item 3).

| Animation | Fallback |
|---|---|
| Ground wash, art set/collapse | Instant |
| ChipFlight | Token fades into its slot (120 ms opacity only) |
| Row StaggerIn / selection pop | Present / instant fill swap, check visible |
| LivingBar fill and sheen | Set instantly, no sheen |
| Title rise, PageArrival | Shown at once |
| Plan expand, ring draw, CountUp, tiles, CTA reveal, Glint | Final frame, final numbers; `accessibilityLabel` always carries the final value |
| Consent facts and connectors, MorphButton | All shown / label swap |
| MicMeter, cap ring | Text states |
| Bloom, Burst, art rise | Final bloom frame, no particles |
| Flame ignite, WeekStrip fill, bell ring | Static lit state |
| Hand-off XP count-up | Final number |
| Paywall timeline | Static |

Sounds and haptics still fire once per event; they are not motion. They follow their own Settings toggles and the silent switch.

### 9. iPad and web

**iPad**
- 560 reading column for every first-run page and sheet.
- Art uses `fit="large"` on regular width (≥700).
- Plan reveal at width ≥900: ring left, tiles stacked right, inside a 720 column.
- Burst emitter clamped to the column.
- Split view follows window width (`S/responsiveLayout.ts:2-6`).
- Keyboard avoidance unchanged (`P:676`).

**Web preview**
- Reanimated runs; haptics are no-ops.
- Sound effects play without `preload` (CSP, `tech.md` §4).
- Remind card hidden (`REMINDERS_AVAILABLE` false).
- Paywall skipped; `measureInWindow` works.
- `npm run build:web` must pass. Nothing in the first-run tree may import a native-only module outside a `.native.tsx` twin.

**Dev previews**
- Optionally add `"EXDevMenuShowFloatingActionButton": false` to `R/apps/mobile/app.json` `ios.infoPlist` in the same native rebuild. It hides the expo-dev-client gear that overlaps the header in the founder's screenshots; it is not app UI.

### 10. Files touched

**Create**

| Path | Contents |
|---|---|
| `S/onboarding/firstRun/PlanCard.tsx` | |
| `S/onboarding/firstRun/DrinkTiles.tsx` | |
| `S/onboarding/firstRun/GoalTile.tsx` | |
| `S/onboarding/firstRun/PlanReveal.tsx` | |
| `S/onboarding/firstRun/ConsentFacts.tsx` | |
| `S/onboarding/firstRun/MicMeter.tsx` | |
| `S/onboarding/firstRun/WinCard.tsx` | |
| `S/onboarding/firstRun/ReminderAsk.tsx` | |
| `S/onboarding/firstRun/InvestmentList.tsx` | |
| `S/onboarding/firstRun/firstRunCopy.ts` | All new strings and token short labels |
| `S/onboarding/guestProgress.ts` (+ `.test.ts`) | `guestDays`, `guestInvestment`, `starterMinutes` |
| `S/icons/custom/TeaCup.tsx` | |

**Edit**

| Path | Change |
|---|---|
| `P` | `:83-103`, `:122-129`, `:224-228`, `:238`, `:250`, `:275-294`, `:302-305`, `:404-453`, `:470-475`, `:505-532`, `:539-671`, `:681-698`, `:703-1011`, `:1082-1162`, `:1168-1247`, `:1316-1373` |
| `S/onboarding/flow.ts` | `:3-26` |
| `S/onboarding/preAccountDraft.ts` | `:49`, `:58` |
| `S/onboarding/ChoiceCard.tsx` | Fill selection, `variant="tile"`, `gloss`, `badge` |
| `S/onboarding/ChoiceArt.tsx` | Becomes the Iconsax Bulk mapper by `kind` |
| `S/onboarding/NextButton.tsx` | "Continue", disabled styling |
| `S/onboarding/OnboardingMotion.tsx` | `SetupProgress` → LivingBar |
| `S/onboarding/GuestRecording.tsx` | Metering, IconAction |
| `S/onboarding/GuestAccountHandoff.tsx` | `:46-185` |
| `S/onboarding/StarterContinuation.tsx` | `:80`, `:110-113` |
| `S/onboarding/guestPractice.ts` | `:71` |
| `S/onboarding/plan.ts` | Retire `NO_STREAKS` (`:150`, `:181`) with the streak section |
| `C/onboarding.ts` | `:41-45`, `:241`, `:298-318` |
| `S/settings/SwitchRow.tsx` | `:57` |
| `S/components.tsx` | `Sheet` `:1811-1819` (design-system, in place) |
| `S/layout.tsx`, `S/responsiveLayout.ts` | `column="reading"`, `READING_COLUMN` |
| `S/profile/store.ts`, `S/profile/dailyGoal.ts` | 20 minutes |
| `R/apps/mobile/App.tsx` | `CelebrationHost` above `Gate`; `offerFirstRun` in `openFirstRun`; bootstrap restyle `:217-231` |
| `S/wall/wallPages.ts`, `S/wall/WallScreen.tsx`, `S/wall/WallYoursPage.tsx` | First-run entry and body |
| `S/purchases/contract.ts`, `S/purchases/adapter.native.ts` | Intro offer |
| `S/nav/types.ts:164`, `S/analytics/track.ts` | `'first-run'` entry |

### 11. Tests and docs to change

Ledger-pinned titles are never renamed; only their assertions change.

**Onboarding and consent tests**

| Test | Change |
|---|---|
| `S/onboarding/firstRun.test.ts:114` (unpinned) | Order `'reason', 'start-level', 'time', 'plan'`; keep `<NextButton disabled=\{answer == null\}`; assert `I’m not sure` and `Choose each time`; drop `No schedule`; still bans `<ProgressDots` |
| `S/onboarding/firstRun.test.ts:97`, `:110`, `:116`, `:118`, `:120`–`:128` (pinned) | No assertion change; literals preserved as specified |
| `S/onboarding/firstRun.test.ts` (new) | `the win shows the learner’s line beside the natural line and celebrates only an accepted real reply`; `the reminder is asked only after a finished practice and only on a real tap` |
| `S/onboarding/answers.test.ts:468` (pinned title) | Assertions become `5 setup pages`, the new `FULL_SETUP` literal, `thirteen-value disk registry` |
| `S/onboarding/answers.test.ts:482` | Unchanged |
| `S/onboarding/disclosure.test.ts:442` (unpinned test) | `label="Type instead" …` becomes `label="Start practice" disabled=\{busy \|\| !draft\.eligibilityConfirmed\}` plus the same for `Practise offline` |
| `S/onboarding/preAccountDraft.test.ts:175` (unpinned) | If `PageArrival` adopts `DUR.base`, assert that token instead of `duration: 270` |
| `S/onboarding/preAccountDraft.test.ts` (new) | `'frequency'` resumes at `'time'`; minutes 20 survives repair |
| `S/onboarding/flow.test.ts` | New orders; `earnedChoices` totals 4 / 3 |
| `S/onboarding/plan.test.ts:130-145` | Coordinated with the streak section: `NO_STREAKS` retired from `PLAN_COPY` (it becomes untrue). The title is not ledger-pinned |
| `S/onboarding/guestProgress.test.ts` (new) | `a guest day counts only a practice saved as finished`; `the save card lists only what this phone holds` |
| `C/onboarding.test.ts` (new) | `a reply that repeats the tutor’s question is never accepted` (fails before the fix: 'Salut ! Ça va ?' and 'Salut ! Ca Va' are accepted today); `a twenty-minute goal starts three exchanges` |
| `S/revamp/uxControls.test.ts` (new) | `no first-run page component can send, store or record activity`: applies the `:53` and `S/legal/policy.test.ts:833` bans to `onboarding/firstRun/*` |

**Contract, motion and settings tests**

| Test | Change |
|---|---|
| `S/conversationPacks/practiceDisclosure.test.ts:26` | Unchanged (keep `<SetupProgress`, `label="Back"`, no `<Chip`/`<Label`) |
| `S/surfaceContract.test.ts:640` | Stays 2; `:733-799` hold for the new files |
| `S/motion.test.ts:295` | Allow-list gains `onboarding/firstRun/PlanCard.tsx` and `onboarding/firstRun/MicMeter.tsx`. All other first-run motion composes the `motion/` primitives the motion section allow-lists |
| `S/settings/rowFeedback.test.ts` (new) | `an off switch has a visible track on iOS` |
| `wall/wallPages.test.ts` and analytics agreement | Gain `'first-run'` |

**Docs**

| Doc | Change |
|---|---|
| `R/docs/ONBOARDING.md` | Rewrite `:7-26` and `:46-52`. Keep the age paragraph `:44` verbatim (pinned). Keep the "F114" and "cannot be produced on the machine" phrases (`:71`) |
| `R/DESIGN.md:805`, `:807` | Onboarding update rewritten. `:791-792` belongs to the motion section |
| `R/docs/DEVICE_VERIFICATION.md` | Add first-run checks: VoiceOver path, Reduce Motion O3, silent switch, iPad split view, reminder permission denial |
| `R/docs/KNOWN_ISSUES.md` | File before building, IDs in order from F716 shared with other sections: P1 echo acceptance; P2 iOS off-switch; P2 sheet clipping; P2 "Start speaking" offered without speech; P2 phrasebook stores unchecked spelling; P1 first-run redesign contract |

### 12. Owner agent

| Part | Owner | Must involve |
|---|---|---|
| `P`, `onboarding/firstRun/*`, ChoiceCard, ChoiceArt, NextButton, OnboardingMotion, GuestRecording, StarterContinuation, flow, draft, guestProgress, ONBOARDING.md | `onboarding-ux-engineer` | — |
| Start-sheet order and copy, `disclosure.ts` | `privacy-safety-engineer` | — |
| `checkStarter` echo, `starterTasks` 20, `starterXp` | `learning-science-engineer` | Token-server redeploy: `backend-engineer` |
| SwitchRow, Sheet, `READING_COLUMN`, primitives, icons | `design-system-engineer` | — |
| AuthFlow, bootstrap review restyle | `auth-engineer` | — |
| Hand-off conversion, reminder pre-prompt, guest streak | `progress-retention-engineer` | — |
| Paywall entry, intro offer, copy truth | `revenue-engineer` (renders: `frontend-engineer`) | — |
| Profile 20-minute goal | `data-engineer` | — |
| Nav wiring, HomeTab, `surfaceContract` integration | `frontend-engineer` | — |
| `app.json` plist key | `deploy-engineer` | — |

### 13. Risks

1. **Production guest speech is off**, so the first win is typed for every production learner. The mic meter is dev-only until anonymous speech admission ships (`ONBOARDING.md:38`).
2. **Echo fix needs a server deploy.** Until token-server is redeployed, online guest attempts still accept echoes.
3. **20-minute goal coupling.** If any path sends `minutes: 20` to `/onboarding/start` without `starterMinutes`, the server returns 400 (`server.ts:349`).
4. **Double confirmation after OAuth sign-up.** The bootstrap review and then "Keep this practice?" add a step. It is a follow-up for `auth-engineer`, not solved here.
5. **Streak copy needs the guilt list relaxed.** It depends on the streak section narrowing `S/copy/guilt.ts:33` ("streak", "Grows, never shrinks"); first-run strings containing "streak" fail `guiltIn` until then.
6. **Celebrations must not repeat.** In-memory dedupe means a relaunch on `recap` or `remind` could replay. Arrival-source gating (§5.7, §5.8) must be implemented, not assumed.
7. **Thin overlap for the Day N−2 reminder node.** It can only be shown if a real notification is scheduled. Otherwise it is a false promise.
8. **Unconfirmed icon names.** Iconsax names are proposed (`reserve`, `discover`, `speedometer`, `cloud-cross`, `cpu`…); confirm them against the downloaded set and the licence at implementation, and record substitutions (Phosphor duotone fallback).

### 14. Open questions for the founder

1. Do you want guest **speaking** enabled in the first run? It needs an anonymous paid-admission review. Today the first win is typed.
2. Should the first-run paywall appear for learners who still have most of their **30 free minutes** (the trial is server minutes, not a store free trial)? Or only once a store introductory offer exists?
3. **Tea audio:** should we record a bundled "Bonjour, je vais prendre un thé." clip in the tutor voice, so both drinks can be heard?

### Critical Files for Implementation

- `/Users/pravz_07/Documents/StartUps/Luvani/.claude/worktrees/app-engagement-animations-de9910/apps/mobile/src/onboarding/PreAccountOnboarding.tsx`
- `/Users/pravz_07/Documents/StartUps/Luvani/.claude/worktrees/app-engagement-animations-de9910/packages/core/src/onboarding.ts`
- `/Users/pravz_07/Documents/StartUps/Luvani/.claude/worktrees/app-engagement-animations-de9910/apps/mobile/src/onboarding/GuestAccountHandoff.tsx`
- `/Users/pravz_07/Documents/StartUps/Luvani/.claude/worktrees/app-engagement-animations-de9910/apps/mobile/src/onboarding/firstRun.test.ts`
- `/Users/pravz_07/Documents/StartUps/Luvani/.claude/worktrees/app-engagement-animations-de9910/apps/mobile/src/components.tsx` (Sheet) and `/Users/pravz_07/Documents/StartUps/Luvani/.claude/worktrees/app-engagement-animations-de9910/apps/mobile/src/settings/SwitchRow.tsx`