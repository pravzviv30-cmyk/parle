# Luvani, Come Alive — report and implementation plan

Branch `claude/app-engagement-animations-de9910` @ `47fbc2ea` (= origin/main; includes the replaced
onboarding). Written 2026-10-05 from: 5 local videos (local Whisper transcripts + frame sheets),
2 YouTube videos (full captions + storyboards), iconly.pro, Duolingo + 6 competitors, an 11-agent
code map, the live web build, six section specs each checked against source, six independent
adversarial reviews and a completeness critic. Paths are under `apps/mobile/src/` unless they start
with `packages/`, `services/`, `scripts/`, `docs/`, `supabase/` or a root file.

**How to read this.** Part 1 = binding decisions. Parts 2–4 = the report (what is wrong, why, what
the videos and Duolingo teach, the target experience). Part 5 = build spec per workstream. Part 6 =
the resolutions that override the detailed specs where they disagree. Part 7 = gate traps the
reviewers found (the specific ways this build would otherwise go red). Parts 8–11 = build order,
verification, risks, founder actions. The detailed specs (~360k characters, every file:line), the
six review notes and the critic are committed in step 0 as `docs/come-alive/` with
Parts 6–7 of this file as the authority where they conflict.

## Integration status — 7 October 2026

All six Phase 4 branches are integrated into this worktree, including the recovered reminder repairs. The completion pass addresses the remaining local findings F747–F750, F753 and F778–F782, plus the purchase-refresh race F783. The implementation and remaining release acceptance are recorded in `docs/IMPLEMENTATION_EVIDENCE.md` and `docs/DEVICE_VERIFICATION.md`. This status is not approval to deploy, enable paid provider paths, or ship store offers.

---

## Part 1. Founder decisions (binding, 2026-10-04/05)

| # | Decision |
|---|---|
| D1 | No mascot, no faces. Animate the existing flat art and the interface. The living tutor **orb** only in Conversations, made voice-reactive. |
| D2 | **Full Duolingo daily streak**: flame, count, ignite animation, milestones 7/30/100/365, week + month calendar, a warm evening reminder. Never shaming. Lifetime practice-day total always visible beside it. Reverses PRODUCT.md's no-streak rule. |
| D3 | A streak day = **any finished practice** (conversation, lesson, drill, review, daily phrase, free offline practice). Running out of live minutes never breaks it. |
| D4 | **Freezes and repair are paid-plan perks.** Free learners: a missed day resets; lifetime total stays. A free learner who just broke a streak sees **one calm line** on the Streak screen: "Subscribers can repair a streak within 2 days." + See plans (no notification, no countdown, no "save your streak"). |
| D5 | Days-a-week question **replaced by a daily goal**: Casual 5 / Regular 10 / Serious 15 / Intense 20 min. **Keep** the level question → 3 questions: where, level, daily goal. |
| D6 | **XP on every win** (+5 fixed "for practising" on wins nothing grades: daily phrase, a review with nothing recalled, the guest's first reply credited once an account exists), **daily quests** (3/day), **levels**, **milestone badges**. No leagues. |
| D7 | Buttons stay **flat** with richer motion (stronger press, selected fill + glow ring, haptics). No 3D lip. |
| D8 | **Sound + haptics on** by default, follow the silent switch, separate Settings toggles. **Live rooms stay silent and still** while the mic is open; the fanfare plays at the recap. |
| D9 | Sound effects **original, synthesised for Luvani**; founder approves by ear before they ship. |
| D10 | New art (flame, chest, medals, crest, milestones) **built in code** as flat vectors in the current style. |
| D11 | Icons: **Iconsax free, licensed in the founder's name** (Phosphor MIT duotone if >5 needed names are missing); animated in code. No Iconly Pro, no Lottie. |
| D12 | **Native rebuild fine**: `react-native-reanimated` 4.5.1 + `react-native-worklets` 0.10.1 (SDK 57 pins). |
| D13 | First run: plan → **first spoken reply** + big celebration → reminder ask → save progress → **paywall** (honest timeline, "Not now"). **Guest speaking enabled** with server protection. |
| D14 | Tone at wins: **warm, plain English**. No French interface praise. |
| D15 | Ships on **iPhone + iPad** (portrait) now. Web is a preview that must not break. |
| D16 | **7-day free trial** (App Store introductory offer) with **a week's worth of the plan's minutes** (allowance × 7/30: Starter ≈ 42 min, Max ≈ 70 min, computed server-side). **Annual plans**, pre-selected: Starter **$149/yr**, Max **$229/yr** (≈35% off; founder accepts that Max annual loses ≈$1/month on a learner using all 300 minutes). |
| D17 | **Every agent runs on Opus 5.5** (builders, reviewers, judges). No Fable. |
| D18 | (2026-10-06) **All 12 sound effects approved by ear** (recipe version 1), recorded in `scripts/sfx/approvals.json` against each sound's wavSha256. A changed recipe is silent again until heard. |
| D19 | (2026-10-06) A subscriber may **repair a streak at most once every 7 days** (`REPAIR_EVERY_DAYS = 7`). Freezes still cover single missed days. |
| D20 | (2026-10-06) The first-practice **echo check keeps refusing** any reply with the same words as the tutor's question, punctuation aside, typed or spoken. The learner sees the model answer. |
| D21 | (2026-10-06) An own-words **retry reads "Nearly there."** in the nearly tone (sun, the `nearly` sound). The reveal stays calm. |
| D22 | (2026-10-06) **No chests.** Daily quests stay (3 a day, +10 XP each, the monthly quest badge). Finishing all three shows one quiet line, "All three quests done today.", on the end card and Home, with the `quest` sound. No chest drawing, no chest XP, no chest takeover; the takeovers are purchase, streak (milestone replaces extended), level, badge. The rest of the game art is approved by eye: flame, medal, crest, freeze and repair marks. |

**KEEP regardless** (legal/truth/a11y/billing/safety): AI + Deepgram disclosure before processing
and the 13+ order; opt-ins off; no pre-consent tracking in the first-run screen; every celebration
and number tied to a persisted event (no fake progress, no fake "analysing", no invented dates, no
fake social proof or friends); Reduce Motion lands on the final frame (watched live); 44 pt targets;
labels on every control with no visible label; Dynamic Type; purchase success only after a confirmed
entitlement; no countdown urgency; a safety stop (F137) gets no celebration, XP or day.

---

## Part 2. Diagnosis — why it feels flat (ruthless)

**1. The flatness is written down and enforced.**
- `DESIGN.md:14-16` "no gradients, shadows, … decorative badges, streaks, XP"; `:653` scene
  completion has "No confetti, no score"; `:701` "The orb is the only continuous animation"; `:746`
  "One spring … Nothing else bounces"; `:791-792` "No animation library, … audio"; `:805` "no
  mascot"; `:807` "No loops or blocking celebrations"; `:58-60, 348-351` "One primary pill is
  followed by quiet secondary links" — the origin of every underlined link.
- `PRODUCT.md:92-133`: no streak; XP never shown; no ranks. `copy/guilt.ts:29-47` bans "streak".
- ~140 source-reading tests pin all of it (`motion.test.ts` file allow-list, one spring, no
  `createAnimatedComponent`, still tab bar; `surfaceContract.test.ts` J7/J12/F569/F407/F440;
  `glyphs.test.ts`; `art/registry.test.ts`; `HomeTab.test.ts`).
- The 4 Oct video review re-affirmed "no mascot, no continuous motion, no new dependency".

**2. No motion engine, no sound.** RN `Animated` only; no UI sound anywhere.

**3. Rewards exist as data and are never shown.** XP (`packages/core/src/levels/levels.ts:94-115`),
levels, practice days, active minutes, scene completions, recall — computed, stored, never displayed.
`arrived()` fires in 3 places; the only confetti is one 650 ms SVG drop on the first independent finish.

**4. The interface talks in underlined words.** `GhostButton`: **222 call sites in 63 files**
(30 in the onboarding file). Screens 1 and 2 stack 4–5 of them.

**5. Icons carry no information.** One `ChoiceArt kind` per page: Coffee/Tea share a cup; 3 levels
share a bubble; 5/10/15 min share a clock; 3/5/7 days share a calendar
(`onboarding/PreAccountOnboarding.tsx:745,751,791,802,813`). Screen 8 mixes outline/solid styles.

**6. Blank space is structural.** Question pages ≈30% void; plan page ≈26%; end page ≈20%. The
personalised plan — "the moment people decide" — does not exist: four answers become "10 minutes,
every day".

**7. Real defects** (each becomes a ledger entry from F716):

| Defect | Where |
|---|---|
| **Typing the tutor's question back is accepted** ("Salut ! Ca Va" → "You answered the greeting."); the unchecked spelling is saved to the phrasebook and Home | `packages/core/src/onboarding.ts:250-318` (only `family-hello` affected); `onboarding/GuestAccountHandoff.tsx:71`; `StarterContinuation.tsx:80` |
| Partial `setAudioModeAsync` calls select iOS `.ambient`, so voice can go silent in silent mode; 4 voice players + TTS never set a mode | `GuestRecording.tsx`, `recap/PrivatePractice.tsx`, `daily/DailyPracticeScreen.tsx`; `PreAccountOnboarding.tsx:328`, `OnboardingFlow.tsx:187`, `TutorTab.tsx:112`, `ProfileTab.tsx:155`, `speech/tutorVoice.ts:66-80` |
| Only 1 of 7 recorders (not the live room) silences haptics while the mic is open | `motion/hapticPreference.ts:9-18` |
| Mic stays published after the recap arrives | `live/useLiveSession.ts:1104-1124` |
| A finished drill/review earning 0 XP records no practice day (breaks D3) | `progress/activity.ts:246` |
| Keeping an own-words phrase says "saved" even when the write failed | `DrillScreen.tsx:1301-1306` |
| Home re-reads storage every 60 s and flashes the skeleton | `home/useHomeRefresh.ts:9`, `tabs/HomeTab.tsx:100,130` |
| 335 "Unexpected text node" errors per web onboarding run (`{issue && …}` with `''`) | `PreAccountOnboarding.tsx:1014,1047,1163,1238`; `StarterContinuation.tsx:216`; `GuestAccountHandoff.tsx:177`; `SettingsScreen.tsx:871` |
| Off switches invisible on iOS (no `ios_backgroundColor`) | `settings/SwitchRow.tsx:57` |
| Start-sheet content cut by the footer rule with no scroll cue (the "truncated" subtitle) | `components.tsx:1818`, `PreAccountOnboarding.tsx:654` |
| Selected ring invisible on the blue page | `onboarding/ChoiceCard.tsx:63` |
| Disabled Next is a slate pill that looks live | `onboarding/NextButton.tsx:41`, `components.tsx:981` |
| "Start speaking" is primary but production guest speech is off → everyone lands on "Speaking is unavailable" | `PreAccountOnboarding.tsx:381,386`; `docs/ONBOARDING.md:38` |
| Drill verdicts and lesson praise are French ("Nickel.") — against D14 | `packages/core/src/drill/session.ts:136-145`; `session/session.ts:390-391` |
| Reminders name the default tutor; no notification tap handling | `reminders/reminder.ts:62,158` |
| Floating gear = **expo-dev-client Tools button** (dev builds only) | `expo-dev-menu/ios/FAB/DevMenuFABView.swift:94`; hide via `EXDevMenuShowFloatingActionButton:false` |

---

## Part 3. What the videos and Duolingo teach, applied

| Source | Lesson | Luvani application |
|---|---|---|
| Tobi, "4 UX patterns" | Account late; personalise; empty states with one CTA; hide advanced settings | Account after the win as one card listing what is saved; consent sheet keeps legal facts with fewer controls; every empty list gets art + one first action |
| Daniel Margu, onboarding | Lead with emotion; reflect answers as a personal plan; account later | Answers fly into a visible "Your French plan" card; plan reveal with real numbers; save card names the learner's real investment |
| Colin Tam (RevenueCat: 82% of trials start on install day) | 3 questions → show the result → notifications with one-line why → paywall | Where / level / daily goal → plan reveal → practice → win → reminder ask → save → paywall |
| @ayoships animation (Promise→Quiz→Plan→Paywall) | One promise, one button; each answer becomes a chip in a persistent plan header; arc + count-up + staggered tiles + CTA reveal + glint; transparent timeline; pill→spinner→check; sunrise | Measured motion spec adopted (timings, easings, staggers), re-coloured: blue promise → cream questions + sun plan card → sun reveal → coral win |
| UX psychology (11 min) | Defaults, goal gradient, reciprocity, IKEA/endowment, loss aversion, contrast | Honest versions: true "Suggested" tags; a real bar to the first reply; a useful phrase + audio before any ask; a plan the learner built; "On this phone only" stated as fact; plans anchored to the learner's own goal. Rejected: fake progress, threats, misleading price framing, invented "most common" |
| Kole Jain, "7 beginner mistakes" | Flow gaps, consistent components, icons, redundancy, interactive feedback | Skip links become real options; one back/close control; FrenchBlock for every French line with audio; one Choice component; bookmark fill + toast + tab dot; disabled states that look disabled |
| Wyatt Feaster, "psychology trick" | Goal gradient, peak-end, labour illusion, Von Restorff, choice overload | Living progress bar; the win is the peak, the end a second peak; show real waits only; one highlighted element per screen; consent sheet 9 controls → ~4 |
| Duolingo + Speak, Praktika, Babbel, ELSA | Answer sheet + chime + haptic; lesson-complete tiles; streak ignite (+1.7% D7); freezes; quests + chests; milestones; auto-stopping reminders; trial-timeline paywall after the first lesson; live waveform; thinking pose | All adopted in honest form. Rejected: guilt notifications, wagers, leagues (D6), countdown paywalls, sad mascots. Deliberately not adopted: weekend amulet, "I'M COMMITTED" CTA (pinned literal), "N phrases in your first week" (a projection) |

---

## Part 4. Target experience

**First run:** Promise (blue; pick a drink; hear real French) → Where (6 options incl. "Just
exploring") → Level (3) → Daily goal (4 tiers, "Last question") → **Plan reveal** (sun; ring + real
count-up + 3 real tiles + first exchange) → Start sheet (3 icon fact rows, 13+, opt-ins, **Start
practice**) → Practice (**speaking** with a live mic meter; Type instead; honest waits) → **Win**
(coral bloom + confetti + chime + haptic; your line beside the natural line) → **Day 1** (flame
ignites + reminder ask) → **Save progress** → account → Keep this practice (day 1 + XP recorded) →
**Paywall** (7-day trial timeline; annual pre-selected; Not now) → Home.

**Core loop:** answer → sheet slides up (mint / sun / calm) with sound + haptic → living bar with
combo glow → in-place end card (XP / time / count tiles counting up, goal ring, quest rows; the third
quest of the day lands as one quiet line, "All three quests done today.", with the `quest` sound) →
after leaving, ≤3 takeovers (streak → level-up → badge) → Home's flame, ring and level chip tick up.

**Habit loop:** Home status (flame + n, goal ring, Level n) → quests card → Streak screen (calendar,
freezes/repair, milestones) → one smart reminder a day at the learner's own time, skipped after
practice, pausing after 4 unanswered days.

**Conversations:** the orb listens (ring from the real mic level), speaks (bars from the tutor's real
audio), thinks honestly, ripples on goal ticks; silent and still for sound/haptics while the mic is
open; the fanfare plays at the recap.

---

## Part 5. Build spec by workstream (details in `docs/come-alive/`)

### A. Foundations — engine, tokens, primitives, celebration host, sound, haptics
- **Deps (one native rebuild, before 11 Oct 2026** — the founder's dev profile expires,
  `docs/REMOTE_UPDATES.md:77-80`): `npm ci` in this worktree; `cd apps/mobile && npx expo install
  react-native-reanimated react-native-worklets` (→ ~4.5.1/~0.10.1; no babel.config, no plugin);
  `app.json ios.infoPlist.EXDevMenuShowFloatingActionButton=false`; `audit:ci`; fingerprint diff in
  `REMOTE_UPDATES.md`; clean prebuild + `npm run ios:device`; EAS `staging`. Add a one-line
  `docs/TESTING.md` note that a worktree with its own `npm ci` is a root. Engine imported as
  **`import Reanimated from 'react-native-reanimated'`** — `Animated` always means RN legacy.
- **Tokens (`motion/tokens.ts`)**: `DUR` 0/120/180/260/380/420/480/650/900/900/1400; `STAGGER`
  40/60/90/140; `EASE` out `[0.22,1,0.36,1]`, inOut `[0.65,0,0.35,1]`, in `[0.55,0,1,0.45]`;
  `SPRING` press `{439, 29.3, 1}`, pop `{322, 19.7}`, settle `{158, 21.4}`, snap `{987, 50.3}`;
  `PRESS_SCALE_TILE` 0.95; budgets `INPUT_READY_MS` 600, `CELEBRATION_MAX_MS` 2600, `BURST_MAX`
  36/56/24. `motion/drive.ts` is the only caller of `withTiming/withSpring/…` and passes
  `reduceMotion` from the live `useReduceMotion()`; `motion/ReduceMotionBridge.tsx` in `App.tsx`.
- **Primitives (`motion/`)**: Press upgrade (depth control/tile; selected → 1.03 pop + blue ring
  layer, not a shadow), StaggerIn, CountUp, ProgressRing (`.web.tsx` fallback), LivingBar, Burst
  (seeded, palette colours only), Bloom (flat discs), **TokenFlight** (renamed from ChipFlight —
  `<Chip` is banned in the onboarding file), Glint, MorphButton, Enter/Reflow/Exit, BubbleIn, LevelRing.
- **Celebration host (`celebrate/`)**: mounted once in `App.tsx` outside `NavigationContainer`, above
  `Gate`. Signature `celebrate({ type, key, data, origin, kind })`. Merges, ≤3 takeovers per burst,
  holds (safety stop clears; mic live; live room; Sheet; background; sign-out), first tap skips to
  end, Continue by 600 ms, never auto-dismiss, VoiceOver modal. Idempotency: in-memory
  `FeedbackLedger(256)` + synced **`game.seen`** only.
- **Templates**: ReplyAccepted (in place), **PracticeComplete = in-place end card** (mint, kicker
  "Practice complete."), StreakExtended, StreakMilestone, GoalMet (merged as a ring row), quest rows on
  the end card (all three done = one quiet line, never a takeover; D22), LevelUp ("Level {n}", never
  names), BadgeEarned, PurchaseConfirmed, PostcardStamp. `celebrate/ConfettiStill.tsx` keeps `celebrate-confetti` drawn
  (Reduce Motion final frame) so the 29-drawing pin holds.
- **Sound (`sound/`, `scripts/sfx/`)**: 12 ids `tap select correct nearly complete streak levelup quest
  badge save count-tick whoosh`; deterministic synthesis (C-major pentatonic, ADSR, seeded) → AAC in
  `assets/sfx/` + manifest; audition page `artifacts/sfx-audition/index.html`; `SFX_APPROVED` gate
  from founder approval in chat. `sound/audioSession.ts` is the only importer of `setAudioModeAsync`
  (VOICE / RECORD / SFX modes; SFX = `.ambient`, obeys the silent switch); holds for mic, voice, live
  room; `enterVoicePlayback` awaits in-flight SFX; every voice/recorder path moves onto it. Web: no
  `preload` (CSP), play only from gesture tasks + scoped `unhandledrejection` filter. Settings "Sound
  effects" switch, default on.
- **Haptics**: add `tick()`, `thump()`, `celebrate()` (Success, +140 Medium, +280 Light),
  `cancelHaptics()`; `hapticsEnabled = pref && !micLive() && !liveRoom()`.
- **Master sound/haptic table** (one rule): reply accepted `correct` + `celebrate()`; good answer
  `correct` + `arrived()`; typo `nearly` + `soft()`; miss nothing; phrase saved `save` + `arrived()`
  everywhere; reminder set `save` + `arrived()`; plan ready `select` + one `tapSettled()` (setup is not
  learning); end card `complete` + `celebrate()` + ≤6 ticks; streak `streak`; level `levelup`; badge
  `badge`; all three quests done `quest` as the end card's quiet line lands (D22); purchase `complete` +
  `celebrate()`; anything in a live room: none.

### B. Icons and layout
- **Iconsax free** (founder is licensee): root devDependency `iconsax@0.1.1` (exact; refuse install
  scripts) → `scripts/icons/build-icons.mjs` with **step 0 `--check-names`** against
  `dist/manifest.json` (>5 missing ⇒ switch the whole set to `@phosphor-icons/core` 2.1.1 duotone, MIT)
  → generated `src/icons/*.tsx` with licence header + `index.ts`/`names.ts` + `docs/design-assets/ICON_SET.md`
  (not ICONS.md). Stroke → `STROKE` 2; colours → `{color}`/`{secondary}` @0.4; raw SVGs never committed.
  Customs: tea cup, speaker-slow, mouth, check. Acknowledgements entry.
- Runtime: `Icon`, `IconTile` (own `TILE_GROUND` map; `paper.skeleton`+ink replaces the non-existent
  "sand"), `GoalDial` (static quarter/half/¾/full), `AnimatedIcon` (kinds bell-ring, bookmark-fill,
  check-draw, speaker-waves, flame-flicker, refresh-spin, cloud-check, mic-pulse, star-pop, lock-open;
  clip windows; through `drive.ts`; fire only on persisted/confirmed results).
- Glyph exports become delegates; **keep** the `TutorIcon`/`SpeakerGlyph`/`AlertGlyph` re-exports (F598).
  Tab bar: `nav/TabGlyph.tsx` pops the selected Bulk icon (and the Practice dot); `LuvaniTabBar.tsx`
  stays still (F600 assertion holds; supersession note filed).
- Appended to `components.tsx`: `IconButton` (union back, close, speaker, bookmark, replay, bell;
  `label` required; generalises RoundButton), `IconAction`/`IconActionRow` (visible label; tile/inline;
  2–4; wraps at font scale ≥1.6; disabled colour per ground), unified `Choice` (row/tile; selected =
  blue fill + white, sun fill on blue grounds; radio role; Hear is a sibling target).
  `ChoiceArt.tsx` stays as a thin `kind → IconTile` delegate (`firstRun.test.ts:118` unchanged).
- **GhostButton sweep** ~160 of 222 (table in `docs/come-alive/icons-layout.md` §2). KEEP as words:
  legal/billing links, destructive/account actions, decline/"Not now", leave confirmations, age
  refusal. Labels kept. Ratchet test `icons/callSites.test.ts`.
- Layout: `RHYTHM` 8/12/20/32; footer hairline only when content scrolls; disabled pills =
  `paper.skeleton` + `inkSoft`, enable = ink cross-fade + pop + Glint; iPad: `READING` 560 (first run,
  takeovers, sheets), `FOOTER_MAX` 480, `layoutClass()`, `<Columns>` on regular width; text-node fix +
  `textNodes.test.ts`; empty states for Phrasebook, Conversations, Tutor memory using existing `state-*`
  drawings; day-one triple hero fixed (Practice leads with "Hear, say and compare").

### C. First run
Rules: pinned literals stay in `PreAccountOnboarding.tsx` (P); new parts in `onboarding/firstRun/`;
exactly 2 header roles in P; no fetch/storage/tracking in the first-run screen tree; explicit Continue
(F601); nothing preselected; "Suggested" only as a true derivation; Dynamic Type: tiles wrap to one
column at font scale ≥1.6.

| # | Screen | Spec |
|---|---|---|
| 1 | **Promise** (blue) | Art → "Try a little French." → "First, pick a drink." → Coffee/Tea side-by-side tiles → dashed placeholder → phrase card (FrenchBlock + speaker waves; record a bundled tea clip) → "Make my plan" (Glint on enable) + IconAction "Try a practice now". Transition: wash blue→cream, art sets (600 ms EASE.in), PlanCard with 3 dashed slots, drink token **TokenFlight**s into slot 1 (launched from `PlanCard` via `flyFrom`), bar segment fills. |
| 2 | **Where** | PlanCard pinned; why line "This picks your first practice."; 6 rows (food, trip, family `heart`, moving `truck-fast`, work, **Just exploring**); blue fill + pop + token flight; Continue. |
| 3 | **Level** | 3 rows (empty bubble → one → two); "I'm not sure" removed (gloss on "I haven't started": "Also right if you are not sure"). |
| 4 | **Daily goal** | "What's your daily goal?" "Last question. You can change it any time." Casual/Regular/Serious/Intense with `GoalDial`; true "Suggested" tag; IconAction "Choose each time". Days page removed (FULL_SETUP = hear-it, reason, start-level, time, plan); `starterMinutes()` maps 20→15 for the server. |
| 5 | **Plan reveal** (sun) | PlanCard expands (≤600 ms, no "building" text); first task title; ProgressRing + CountUp of real daily minutes; "Any finished practice counts for your streak, even offline."; 3 tiles (exchanges; "first scene in your plan"; tutor via IconAction "Choose tutor"); first-exchange card; AI row (OrbGlyph); edit → plan sheet; "Try this practice" (pinned) + Glint. `select` + one `tapSettled()`. |
| 6 | **Start sheet** | Order kept: ConsentFacts (AI · Deepgram · on this phone) → Privacy details → 13+ (unticked) + "I am younger than that" → both opt-ins visible and off (iOS track fix) → **"Start practice"** (MorphButton) + IconAction "Practise offline". Close IconButton; overflow cue (flat hairline + `flashScrollIndicators`); iPad width `READING`. No sound. |
| 7 | **Practice** | Exchange steps bar; prompt card; **speaking is the default when `speechAvailable`**: MicMeter (expo-audio metering, 5 bars + 20 s cap ring), permission on tap inside `GuestRecording.tsx`; IconAction "Type instead". Typed path: MorphButton "Send reply" → "Checking your reply…" → ≥4 s "Still checking. A slow connection can take a few seconds."; errors → "Practise this offline" / "Try again". No SFX/haptics while recording. |
| 8 | **Win** (coral if accepted & not model) | WinCard: "You said" + line; "A natural way to say it" + `task.model` + speaker; "Exactly the natural way." when identical. ReplyAccepted timeline (Bloom, art rise, Burst 36, `correct` + `celebrate()`). Primary = **"Next exchange"** while exchanges remain, else **"Continue"**; IconAction row: Keep this phrase · Retry · Details. No header Back. Not accepted: paper, "Try this small change.", highlighted model, `nearly` + `soft()`. Echo fix in core: "That repeats the question. Here is one way to answer: «…»"; phrasebook/Home save `task.model`. |
| 9 | **Day 1** (new `remind` page) | Only after `finish()` persists; `GuestPractice` v2 gains `finishedAt: number[]` (cap 31) — the streak number comes from it. Flame ignites, "1 day", "Your streak has started.", week strip, "Any finished practice counts, even offline." → shared `reminders/ReminderAsk.tsx`: "A daily nudge from {tutor}?", "One a day at about {time}, and never on a day you have already practised.", smart time (18:00 until history) + "Change time" → OS permission → plan. "Not now". Web: hidden. |
| 10 | **Save progress** (new `keep` page) | "Save your progress." InvestmentList "On this phone only" (Day n of your streak · replies that work · phrase kept · plan · tutor · reminder — each only if true) → "Save my progress" → SignUp (Apple/Google/email) · "Sign in" · "Not now" → guest home (streak card, Continue practice, IconActions Save progress / Sign in / Set a reminder). |
| 11 | **Hand-off** | Keep this practice → saves `task.model`; records guest `finishedAt` days via `recordActiveDay` and the +5 guest XP via `game.bonus`; writes `streak:{day}` to `game.seen` first so the flame does not re-ignite; plays `phrase-saved`; shows free/trial minutes left. |
| 12 | **Paywall** | `Wall {entry:'path-complete'}` via `pendingWall` set in `GuestAccountHandoff.onDone(kept)`, flushed in `onReady` after `openFirstRun()`, only after `fetchBillingStatus` says not entitled and the offering has plans. Spec in G. Never auto-reshown. |

### D. Game layer
- **Core (pure)**: `core/streak` (day = local date a sitting finishes; DST-safe string maths; future
  days ignored; covers `freeze | repair | travel` bridge but add 0; milestones 7/30/100/365 then yearly;
  week/month helpers). Freezes: cap 2, return 7 days after use, applied automatically, entitled =
  `capabilitiesFor(plan, lapsed).streakProtection`. **Repair (paid)**: gap ≤2 days, 2 finished
  practices within 48 h of the break, entitled at repair time. Travel cover entitled-only.
  `core/goal` (measured `activeMs` only; moved from `momentum.ts:719-757`). `core/quests` (12 types,
  3/day by `hash(uid|day)`, frozen on first compute, never needs live minutes when billing is unknown
  or exhausted, never requires speaking; +10 each, no chest (D22), monthly badge at 30). `core/badges`
  (streak 7/30/100/365, 50/200 days, first conversation, first scene on your own, all A0 scenes, 25/100
  phrases, 100 recalls, goal ×7, Level 10/25, first sound check, monthly quests).
- **XP/levels**: `levelFor` + 100/day cap stay for content difficulty only; `LEVEL_NAMES` kept in
  `levels.ts`, never rendered. Display: `xpLevelFor` numbered levels (L2 at 50, L10 at 1,350, L20 at
  5,225; step min(500, 50+25(n−1))); one shown cap = 100 for activity XP; quest XP and +5 fixed XP
  live in `game` (claims/bonus) outside the activity log — **never a new activity kind**. Displayed
  total never falls (monthly rollups). XP shown only on end cards ("+N XP" via `xpCreditedFor`).
- **Pipeline** `game/settle.ts` (`beginSettle`/`finishSettle`/`settleSitting` → `GameDelta`);
  `recordActivity` → `{ ack, receipt }`; 0-XP sittings still record a day; nothing settles on a safety
  stop. Sources `convo | lesson | drill | review | phrase | guest`. One key table in `celebrate/queue.ts`.
- **Storage**: synced `game` (sittings, covers, goalDays, questDays, claims, bonus, rollups, badges
  `{id, at|null}`, seen); `gameLocal` excluded; both added to `storage/scope.ts` USER_KEY_SUFFIXES and
  the policy exclusion list; **Supabase migration adding `'game'` to the namespace check applied before
  any build ships**; profile v9 (20-min goal; `upgrade.ts storedGoal` widened).
- **Existing learners**: seed from real practice days; badges with `at: null` ("Counted from practice
  already saved"); everything marked seen; intro sheet only if they have practice days.
- **Streak screen** (route `Streak`, path in `nav/theme.ts`): hero flame + CountUp + lifetime +
  longest; week strip; month calendar (no "missed"); freezes card; repair card / free-learner repair
  line (D4); milestones; month arrows are IconButtons with labels; iPad 7 columns.

### E. Core loop and the living orb
- **Answer sheet** (`drill/AnswerSheet.tsx`): good = mint, rotating "Nicely done." "That's right."
  "Spot on." "Exactly." "Yes, that's it." "Good one." (combo ≥3: "On a roll." "You're in the flow."
  "Smooth."), auto 1,400 ms; typo = sun "Nearly." "It's spelt «x». That one counts."; **first miss**
  (`closest` is null by design) = calm "This one comes round again." no French, no sound; **second
  miss** = "Here's how it goes." + «answer» + "It'll come back in your review.", waits for Continue;
  `repeat-this` = "You said it."; own-words tones keyed on `decided` via a new core
  `ownWordsFeedback()`. Core drill and lesson praise strings become English (tutor-agent redeploy).
  Screen reader on ⇒ never auto-advance. Keep one `tapSettled()` in DrillScreen.
- **LivingBar** in sittings (position only, no digits) + combo glow; **end cards** in place for drill,
  practice, review (finished split from "Nothing waiting."; bank once), daily phrase (+5 XP), lesson
  summary; numbers from `GameDelta` only.
- **Conversation**: goal ticks pop + check draw + row glint + VoiceOver announce (orb ripple on the
  final tick before the win card mounts); scene won card in place (Bloom, art, Burst 24, "Scene
  complete"), "Keep talking" stays primary; **no sound/haptic in the room**.
- **Recap**: mic closed (`setMicrophoneEnabled(false)` + `setMicOpen(false)`); result page fanfare when
  a scene was earned; progress strip (+XP, Day n, goal ring); lines `CountUp`; `PostcardStamp` for every
  independent finish.
- **Phrase saved** anywhere (durable ack only): token flies to the Progress tab anchor or a toast;
  dot on the tab via the host overlay.
- **Living orb**: `useLiveSession` exposes mic + tutor tracks; `RoomLevels.native.tsx`
  (`useTrackVolume`, `useMultibandTrackVolume` 7 bands/40 ms) and `RoomLevels.tsx` web
  (`createAudioAnalyser`); `live/levels.ts` normalises and **decays after 120 ms** (the hook never
  writes 0). Listening ring + visual "Hearing you" (accessible name stays static); speaking bars from
  real bands; thinking arc + "Still thinking. This can take a few seconds." after 6 s; fallback to
  today's loops. BubbleIn transcript; lesson SpeakCircle and recorders get LevelRings.

### F. Retention surfaces
- **Home**: greeting → `game/TodayHero.tsx` (flame + n → Streak; goal ring "m of g min"; Level chip;
  read failure ⇒ nothing, never 0) → StreakNudge line (copy in `game/copy.ts`) → lead card (MissionHero
  scene art; StarterContinuation IconActions) → **pinned lifetime `DayCount`** → day-one/week →
  `game/QuestsCard.tsx` ("Daily quests", "{done} of 3 quests done today", at three the quiet line "All
  three quests done today."; no chest, D22) → DailyCard IconAction row (Practise it ·
  Save · More phrases; label "Explore my daily collection" kept where pinned) → friends. Increments from
  `home/homeSeen.ts`, never count down. Fix `useHomeRefresh` first.
- **Progress**: `game/LevelXpCard` → `game/StreakSummaryCard` (keeps `<DayCount weekly />`) →
  `game/CountsGrid` → `game/BadgeShelf` (no "locked/remaining") → CEFR card (the only pill) →
  `progress/PostcardShelf` → IconTile ledger rows. **Profile**: `game/ProfileStats`; goal rows as 5
  `Choice` rows; days-a-week removed; `DayCount` kept.
- **Reminders** (canonical planner `reminders/plan.ts` + `ReminderPlanner.tsx`): smart time (median
  first finish − 30 min, rounded 15, clamped 08:00–21:30; 18:00 fallback), one DATE slot per day
  (`practice:{day}`), skipped when practised, pause note after 4 unanswered then silence; store v2
  (`time: preset | 'smart'`, `mentionStreak`, sent/answered/opened/paused); per-id cancel only; re-plan on
  mount, foreground, settle, settings, tutor change, after hand-off; cancel on sign-out only; 12 copy
  lines naming the chosen tutor; taps deep-link (Home / today's DailyPractice / Settings), cold start
  handled; no badge, no foreground banner. Supersede F226/F227/F230 (replace verified-by), F241 note.
- Widgets, alternate icons, share cards, friend streaks: **phase 2** (after 4 weeks of streak data).

### G. Paywall and billing (money-pinned; revenue-engineer decides, backend first)
- **Server first**: RevenueCat `period_type: TRIAL` → trial allowance = plan allowance × 7/30; yearly
  products refill the monthly allowance every 30 days inside the annual period; `meter.ts` gains
  annual rows + trial allowance; SQL projection migration; `contract.ts` `period` + `intro` +
  `introEligible`; `adapter.native.ts` 4 product ids + `introPrice` +
  `checkTrialOrIntroductoryPriceEligibility`; capability `streakProtection: { freezes, repair }`. Each
  money-pinned file re-hashed once with a dated reason and independent review.
- **Plans page**: annual + monthly rows through `Choice role="radio"`; annual of the tier covering the
  learner's goal pre-selected (no `plan_selected` fired); "{yearly} a year, about {monthly} a month"
  (numbers from the store; never "save N%"); `goalFitLine`; perk line "Every plan includes streak
  freezes and a one-tap repair."; "Not now" + "Keep practising free" (only when `canBuy`); legal
  IconAction row; `PLANS_RENEWAL` covers month and year; the 30 metered minutes renamed "free minutes".
- **Trial timeline** (only with a real eligible intro offer): Today "{plan} starts free. Nothing is
  charged today." · "During the trial: up to {cap} minutes with your AI tutor" ({cap} from the server) ·
  Day 5 "We will remind you two days before your trial ends." (only if permission granted and the
  reminder is scheduled after the server confirms: `reminders/trialReminder.ts`
  `trialReminderPromised`, scheduled by `scheduleTrialReminder`; otherwise "Cancel in your App Store settings before
  day 7 and you pay nothing.") · Day 7 "{plan} continues at {price}." CTA "Start 7-day free trial".
- **Purchase**: `PillButton` keeps its tag with a morph `state`; check + PurchaseConfirmed only after a
  confirmed entitlement (one `useEffect` hoisted above the early returns); restore stays quiet.
- **Guest speaking (D13)**: server anonymous speech admission — per-device + per-IP rate limit, ≈60 s
  speech per guest, 24 h guest token; `security-engineer` + `privacy-safety-engineer` review.
- **Founder actions**: App Store Connect (paid apps agreement, one subscription group with 4 products,
  7-day free trial on each, sandbox tester); RevenueCat (one entitlement on all four, current offering,
  webhook + server keys); EAS env keys.

---

## Part 6. Resolutions (override the detailed specs)

| Topic | Resolution |
|---|---|
| Takeovers | End card (in place) = XP/time/count tiles + goal ring row + quest rows (the third quest done = one quiet line with the `quest` sound, D22). After leaving, ≤3: purchase → streak (milestone replaces extended) → level-up → badge (merged). No chest. Never inside a live room or sitting. |
| Level / caps | Display via `useLevel()`/`useXp()` only (`xpLevelFor`); one shown activity cap 100; quest/bonus XP in `game`. A test bans `levelFor(` and `*Xp(` in screens. |
| Pipeline | One module `game/settle.ts`, one type `GameDelta`; `recordActivity` → `{ack, receipt}`; `practice/completion.ts` updated. |
| Ledger of celebrations | `game.seen` only (synced); in-memory for in-place and guest. No `userKey('celebrated')`. |
| Guest day 1 | Lights once on `remind`; hand-off writes `streak:{day}` into `seen` before settling. |
| Home / Progress / Profile files | `game/TodayHero` (flame + ring + level chip) and `game/*` cards; pinned `DayCount` slots kept. |
| Reminders | `reminders/plan.ts` canonical + `mentionStreak` + milestone-eve line; one shared `ReminderAsk`. |
| Wall entry | `path-complete` + `pendingWall` trigger. |
| Start sheet | "Start practice" + "Practise offline"; speaking offered on the practice page. |
| Icons | Semantic names, prop `icon`; one `game/art/Flame.tsx` (+ Medal, Crest, FreezeMark, RepairMark; no Chest, D22); `ChoiceArt` delegate; `GoalDial` static on setup pages. |
| Flight | `TokenFlight`, launched from `PlanCard`. |
| Press depth | `depth="tile"` 0.95 for IconButton/tile IconAction. |
| Copy ownership | `game/copy.ts` owns streak/goal/quest/badge strings; templates reference ids. |
| Docs | design-system owns DESIGN.md Motion/Shadow/Illustrations + the F407 sentence ("The voice orb, shared press, motion primitives, celebration host and bounded state feedback animate."; "…daily library and today's phrase show no pictures of places…"); progress-retention owns PRODUCT.md:92-136. Never write "icon-only" in DESIGN.md (F313). |
| Single editors | `App.tsx`, `surfaceContract.test.ts`, `HomeTab.test.ts`, `stage3.test.ts`, `KNOWN_ISSUES.md`, `IMPLEMENTATION_EVIDENCE.md` → integrator (frontend); `motion.test.ts`, `components.test.ts`, `components.tsx` → design-system. |

## Part 7. Gate traps (from the reviews — do these or the gate goes red)
- **Ledger**: entries `### F716 — title` / `- severity:` / `- status: [ ]` / `- verified-by:` before
  work (pre-commit `gate:fast` parses them); retired pinned titles get their `verified-by` **replaced**
  (`superseded:` lines are not parsed); never rename a pinned title; floors raise ⇒ matching
  `**N tests**` bullet in `IMPLEMENTATION_EVIDENCE.md` (evidenceContract).
- **Streak words**: one commit removes `streak` from `BANNED_IN_COPY` and `ONCE_BANNED`, edits F414
  assertions, rewrites PRODUCT.md, adds `BANNED_IN_STREAK_COPY`; then loosen `HomeTab.test.ts:329`,
  `TutorTab.test.ts:122`, `review/cardView.test.ts:454` (or keep "streak" out of those files),
  `progress/portfolio.test.ts:74`, `home/nextAction.test.ts` PLANS_LEAD scan.
- **Motion tests**: keep `export const PRESS_SCALE = 0.97;` literal in `motion.ts`; update F597
  assertions (`components.test.ts:703,712`, `motion.test.ts:102`); `motion.test.ts` PENS (`:230-257`)
  → generated icons; allow-list becomes a named list (adds TabGlyph, AnimatedIcon, orb layers,
  RoomLevels, LevelRing, BubbleIn, AnswerSheet, PlanCard, MicMeter, game/art; removes ChoiceCard and
  OnceConfetti); loosen `'Animated'` substring bans to `/\bAnimated\./` in HomeTab/TutorTab/Recap/
  orbRest/tabBar/components/carousel tests; `haptics.test.ts` catch count + `tapSettled()` in DrillScreen.
- **Onboarding**: no `<Chip|<Label` in P (practiceDisclosure:26); keep `<ChoiceArt`, `choose({ reason:
  v.key })`, `label="Back"`, `label="Make my plan"`, `label="Try this practice" onPress={() =>
  open('start')}`, `onPress={() => hear(voiceSample(v.value))}` (voice sheet stays before the start
  sheet); no literal widths in P; add `onboarding/firstRun/*` to `FIRST_RUN` with 0 headings;
  `flow.test.ts` lengths; `dailyGoal.test.ts:51-56`; `upgrade.ts storedGoal`.
- **Storage/nav**: `scope.ts` suffixes (`game`, `gameLocal`, `home-seen`); `policy.test.ts` exclusions;
  `Streak` path in `nav/theme.ts` (wiring F493); `goals/isolation.test.ts` LEDGERS when deleting
  `progress/today.ts`; keep `LEVEL_NAMES` (`levels.test.ts`, `daily.test.ts` F423).
- **Surfaces**: J14 every drawing drawn (`ConfettiStill`); `surfaceContract` ledger map MyFrench 5→4;
  SURFACES lists new files with 0 pills; Home skeleton literal + block list (`HomeTab.test.ts:428,445`);
  F409 no `width: <digit>` in `home/*`; `MyFrenchTab.test.ts:86` no `totalXp(` in the tab; DailyCard
  never calls `useReduceMotion/Easing/setTimeout`; RecapScreen reminder pins (`RecapScreen.test.ts:60-76`)
  move to `ReminderAsk.test.ts`; `DrillScreen.test.ts` pill count 4.
- **Reminders**: `reminder.test.ts:206` presets unchanged ('smart' is a mode); rewrite
  `weekdaySchedule.test.ts` harness and `schedule.test.ts:287-300`; never
  `cancelAllScheduledNotificationsAsync`.
- **Wall**: `PillButton` stays in the footer; `per month` pins edited for annual rows; wallCopy digit
  rule (pass numbers as arguments); hooks above early returns; one `capabilities.ts` re-pin.
- **Web/tests**: no test imports Reanimated/worklets/expo-audio/expo-haptics; `build:web` is manual
  (CI does not run it).

---

## Part 8. Build order, gates and owners

**Process (D17):** every subagent runs on **Opus 5.5** (explicit `model: "opus"` override on the
owning engineer agent type; no Fable, no `/forge` Fable steps). Per phase: integrator files ledger
entries → owner agents build in their territory → an independent read-only Opus reviewer
(`fix-verifier`/`work-judge` agent types, model opus) refutes against the spec + diff → `npm run gate`
green → `graphify update .` → landing verdict said out loud (default **HOLD until the founder has seen
the app running**; stage explicit paths only; never `--no-verify`).

| Phase | Content | Gate |
|---|---|---|
| **0 Foundations** (parallel lanes) | 0a deps + gear + builds (deploy) · 0b tokens/primitives/Press/haptics/motion tests (design-system) · 0c sound synth + audition + audio session (design-system, voice-platform) · 0d icon pipeline + IconButton/IconAction/Choice + TabGlyph (design-system; after 0b on `components.tsx`) · 0e rule rewrites + ledger (progress-retention, integrator) · 0f core pure logic: levels, streak, goal, quests, badges, echo fix, English drill/lesson copy, reminder planner (learning-science, progress-retention) · 0g data: scope, game stores, profile v9, reminder store v2, guestModel `finishedAt`, activity receipt, sync policy + Supabase migration (data, data-sync) · 0h server: trial allowance, annual refill, SQL projection, contract/adapter, guest speech admission, deploys (backend, revenue, security review) | gate; `build:web`; new dev client + staging on the founder's phone **before 11 Oct**; audition page ready |
| **1 Game core + host** | `celebrate/*`, `game/art/*`, `game/settle.ts`, hooks, seed sheet, host mount in `App.tsx`, settle at the five activity sites | queue/timelines/settle tests; safety-stop plays nothing; **founder approves the 12 sounds and the art contact sheet** |
| **2 First run** (parallel with 3) | C | onboarding tests; walk 9→Home on iPhone SE / iPhone 15 / iPad Air simulators with screenshots; web walk with 0 text-node errors; permission-denied paths; guest speech on device |
| **3 Core loop + orb** (parallel with 2) | E | answer sheet / end cards / recap on device; orb tracks voice; frame-rate check |
| **4 Retention + paywall** | F + G client | reminders skip after practice, tap deep links, pause note, sign-out cancel; sandbox monthly / annual / trial purchase shows the check only after entitlement; iPad two-column Home |
| **5 Sweep + release** | B remainder, empty states, docs (DESIGN, PRODUCT, ONBOARDING, STATE_AND_STORAGE, LIVE_VOICE, REMOTE_UPDATES, RELEASE_GATE, DEVICE_VERIFICATION, TESTING), `gate:bless` + evidence bullet, qa/release reviews | full gate + `build:web` + three-simulator walk of every tab + physical-device rows → founder sees it → LAND decision |

## Part 9. Verification (end to end)
1. `npm run gate`; `gate:bless` + IMPLEMENTATION_EVIDENCE bullet when floors rise.
2. `npm run build:web`; preview walked 9→Home with 0 "Unexpected text node", 0 CSP violations; SFX
   after a tap; ProgressRing draws.
3. iOS Simulator (iPhone SE, iPhone 15, iPad Air 11", portrait) via the simulator tool: first run, a
   drill, a review, a typed conversation to recap, Home/Progress/Streak/Profile, Settings toggles;
   screenshots of every new screen for the founder; Reduce Motion toggled mid-celebration; VoiceOver;
   largest Dynamic Type (AX5) walk.
4. Founder's iPhone: silent switch on ⇒ no SFX, voice still audible on every voice path (incl. "drill
   right → Hear within 1 s"); music mixes; no SFX/haptic during any recorder or live room; orb tracks
   voice within ~80 ms; guest speech works and is rate-limited; reminder skipped after practice; tap
   opens today's phrase; sandbox purchases; restore quiet.
5. Founder audition of sounds + art contact sheet → approvals recorded.
6. Dev safety-stop fixture ⇒ no celebration, sound, haptic, XP or day; queue empty.

## Part 10. Risks (top)
1. Dev profile expires 11 Oct → lane 0a first.
2. Supabase `game` migration must be live before shipping (else sync 400 storm).
3. Money-pinned billing + real minute cost (trial, annual Max at $229 loses ≈$1/mo at full usage) →
   server first, re-hash with review, sandbox proof, watch usage after launch.
4. Guest speech abuse/cost → rate limits, 60 s cap, 24 h token, security review.
5. Reanimated Reduce-Motion sampling → bridge + `drive.ts` + J12 additions.
6. Silent suite drops → no engine imports from tests; floors.
7. Audio-mode race muting voice → serialised session, holds, device checks.
8. Guilt creep → `BANNED_IN_STREAK_COPY` scans; one reminder/day; auto-pause; lifetime total beside every streak.
9. Celebration fatigue/replays → ≤3 takeovers, `game.seen` synced, quiet catch-up.
10. Test churn (~25 regex edits + rule rewrites) → Part 7 list, single integrators, never rename titles.
11. Iconsax 0.1.1 has ~1,200 icons → name check first; Phosphor switch.
12. Server deploy coupling (echo fix, English praise, trial/annual) → deploy order in RELEASE_GATE.
13. iOS 64 pending-notification limit → 7-day window.
14. Web not built in CI → manual `build:web` each phase.
15. Scale of the programme (6 phases, ~15 owner agents) → strict territories, phase gates, HOLD until seen.

## Part 11. Founder actions
Install the rebuilt dev client before 11 Oct; approve sounds and art by ear/eye; App Store Connect +
RevenueCat (4 products, 7-day trial, entitlement, webhook, keys); accept the Iconsax free licence in
your name; record a bundled tea line in the tutor voice (or accept coffee-only audio); confirm
friends' reactions become English ("Nicely done" etc. — default) .

---

## Step 0 on approval
1. Commit `docs/come-alive/`: `00-RESOLUTIONS.md` (Parts 1, 6, 7 of this file), the six section
   specs, the six review notes and the critic; link from `docs/README.md`.
2. Save the founder decisions and the "Opus 5.5 for everything" rule to memory.
3. Offer this report as a private Artifact for sharing.
4. Start Phase 0 (lane 0a first).
