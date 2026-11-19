# Learner pull: bringing beginners back

- Status: in-progress (T1.1 building; everything else waits on the decisions below)
- Updated: 2026-11-18
- Checkout / starting revision: `Luvani-worktrees/free-fix` on `claude/free-fix`, from `origin/main` a256f911
- Owner / integrator: the Opus orchestrator session of 2026-11-18
- Existing programme / contract: none. Sources are four council rounds held on 2026-11-18, recorded in
  `~/Developer/StartUps/handoffs/2026-11-18-1442-addictive-video-council.md`: the App Breakdown video
  "How to design an app SO addictive people can't stop using it", save-your-streak, design, and Preply.

## Outcome and scope

Beginners come back on most days. That return comes from French they can feel themselves keeping, not from guilt,
and it fits a business where every live minute costs about $0.048 (`packages/core/src/metering/meter.ts`).
The habit runs through the practices that are free to serve: today's phrase, review, drills, the café line and fixes.
Live talk stays the thing a learner earns and pays for.

Today, against the video's six steps:

| Step | Luvani today |
|---|---|
| Itch | Reminders state facts, at most one a day, and pause themselves. They can only say the streak, the days practised and the tutor's name (`reminders/reminder.ts:156-160`), and they never read billing (`ReminderPlanner.tsx:119`). |
| Lazy thumb | Start is one tap. Today's phrase can only be finished by speaking (`daily/DailyPracticeScreen.tsx:222`). |
| Paved path | `todayLead` picks one next action. Once a free learner is out of time, the big button is "See the plans" (`practice/NextTaskCard.tsx:222`), and Speak has only that door (`tabs/TutorTab.tsx:317`). |
| Slot machine | Refused: "no random rewards". |
| Bottomless pit | The recap's "Next:" is a label, not a door (`recap/RecapParts.tsx:54-57`). Offline end cards end on Done. |
| Piggy bank | Phrases, postcards and scenes are kept. For free learners, D24 locks review of conversation phrases, Your fixes and Then and now. Until T1.1, Today's fix hero was locked for free learners and opened the Wall. |

The pieces:

- **Existing seams:**
  - reminders: `apps/mobile/src/reminders/` (`reminder.ts`, `plan.ts`, `ReminderPlanner.tsx`, `openTarget.ts`, `copy/guilt.ts`);
  - streak: `packages/core/src/streak/` and `apps/mobile/src/game/`;
  - Today: `home/todayView.ts`, `tabs/HomeTab.tsx`, `practice/nextTask.ts`;
  - recap: `recap/afterSessionView.ts`, `RecapScreen.tsx`;
  - free-tier locks: `purchases/capabilities.ts`, `review/freeTier.ts`;
  - celebrations: `celebrate/`;
  - tutor brief: `packages/core/src/tutorBrief.ts`. It already receives the last correction for every learner (`nav/RootNavigator.tsx:409`, `services/tutor-agent/src/convo.ts:1621-1627`).
- **Context:** `PRODUCT.md` (Brand Commitments, Principles), `DESIGN.md`, `docs/DESIGN_PARTNERSHIP.md`, `docs/come-alive/README.md` (D2, D22-D24), `docs/TUTOR_BRAIN.md`, `.claude/skills/unslop/`.
- **Non-goals:**
  - random rewards;
  - autoplay or endless live talk;
  - loss, plea or countdown copy (only "save your streak" leaves the ban, once the founder approves it);
  - stranger leaderboards;
  - buying freezes;
  - speaking-speed or vocabulary scores read from open talk;
  - "track everything";
  - more than one reminder a day.
- **Risks:**
  - More live use cuts margin on the gym model; per-plan utilisation is not measured yet.
  - Reminders are planned 7 days ahead and are never re-planned from another device.
  - Speech recognition of accented A0 French can make a fix wrong.
  - Opt-in analytics give an upper-bound view.
  - Nothing can be sold or measured until the store is live.

## Founder decisions

| # | Decision | Status | Recommendation |
|---|---|---|---|
| F1 | One fix a day free: Today's fix from the newest conversation | **approved 2026-11-18** ("Yes, unlock it") | landed: PR #30, REV-002 |
| F2 | Save-your-streak line: three rotated lines, and only "save your streak" leaves `BANNED_IN_STREAK_COPY` | **approved 2026-11-18** (Set A; line 2 "Today's phrase counts. {tutor} is here.") | landed: PR #32, D25 |
| F3 | Free review of conversation phrases (D24 addendum) | **approved 2026-11-18** ("Yes, unlock") | landed: PR #33, REV-003 |
| F4 | Free earn-back repair (two practices within 2 days, once) | **approved 2026-11-18** ("Yes, once a month") | landed: PR #35, D26, REV-004 |
| F5 | Bank a freeze (a second practice in a day earns +1, at most one); planned rest days | **approved 2026-11-18** (bank a freeze yes, 7-day refill; rest days later) | landed: PR #35, D27, REV-004 |
| F6 | Out of time: free practice first, plans second, on Home and Speak (reopens 2026-11-04) | **approved 2026-11-18** ("Yes, on a board") | board B |
| F7 | Route rule: is unlocking a presentation-only lock the normal or the Fable route? | open | normal: mobile only, no server, DB or meter |
| F8 | The tutor's last correction reaches free learners' tutors today: does that fit D24? | open | yes: it comes from the phone, not tutor memory |
| F9 | Tutor postcards at 7, 30 and 100 days (bends "no biography"); tutor's week story | open | postcards yes, week story no |
| F10 | Goal with a "when" (breaks "never a date"; countdowns stay banned) | open | later, after the goal board |
| F11 | A tiny free memory or a typed line for Léa; free revisits | open | cost it first |
| F12 | Advent calendar from 1 Dec (phrases only; a scene needs the pack validator migration) | open, by 2026-11-22 | phrases-only, or skip to Valentine's |
| F13 | The four-number metrics report and a practice-day retention query | **approved 2026-11-18** ("Yes, build the report") | landed: PR #34; renewal (F1280) read in RevenueCat |

## Screens and states

Every UI item follows the not-slop checklist below and goes through `/push-check` with the Impeccable and unslop reviewers.
New screens and states go to a board first (`docs/DESIGN_PARTNERSHIP.md`), screen by screen with the founder.
Each one is checked:

- at 375 and 320 widths, light and dark;
- with reduced motion;
- at large dynamic type;
- with a screen reader;
- offline.

**Not-slop checklist** (from the round 3 Designer):

1. **Facts only.** Every state is a fact read from disk; the words carry it.
2. **Colours keep their jobs:**
   - sun means practised;
   - lavender means covered by a freeze;
   - the dashed link ring means today;
   - coral is for milestones only;
   - chartreuse appears once at most, behind the learner's own French.
3. **Art from the system only:** `game/art/` and `art/flat/`, with one freeze mark (`FreezeMark`). No faces on game art.
4. **Motion:**
   - existing timelines only, 2600 ms or less, skippable;
   - reduced motion shows the final frame;
   - no new loops.
5. **One celebration per event.** A save is ordinary weight; only a milestone is coral. No confetti on a save.
6. **Copy:**
   - it passes `BANNED_IN_STREAK_COPY`, minus the one retired phrase;
   - no emoji, no "!" and no countdown in notifications;
   - notification text is scanned like app copy.
7. **One primary action per surface.** Secondary doors are chevron rows.
8. **Checked at the widths above.** The dark butter hero is still muddy (DESIGN_PARTNERSHIP row 203).
9. **"Could this be Duolingo's screen?"** If yes, it becomes a redesign proposal, never a fix inside a push.

## Tasks in dependency order

Owners are the territory engineers from `docs/TEAM.md`, at the low effort set in their frontmatter.
"Normal" is the Opus/Sonnet route; "Fable" is `/forge`.

| ID | Outcome | Owner | Depends on | Route | Status |
|---|---|---|---|---|---|
| T0.1 | Practice-day retention query and the four-number report | data-engineer | F13 | Fable (reads billing tables) | done: PR #34 |
| T0.2 | Watch 3-5 beginners; check the free practices teach | founder; learning-science-engineer (read-only) | none | none | todo |
| T1.1 | One fix a day, free | frontend-engineer | F1 | normal | done: PR #30 |
| T1.2 | Save-your-streak line | progress-retention-engineer | F2 | normal | done: PR #32 |
| T1.3 | Reminder content: phrase named, taps into practice, free talk back, goal and next lines, the fix line, the week line | progress-retention-engineer | T1.2 | normal | slice A built 2026-11-19 (D28), not landed; slice B waits on a decision |
| T1.4 | Your talk days | progress-retention-engineer | T1.3 | normal | todo |
| T2.1 | Free review of conversation phrases | practice-ux-engineer | F3, F7 | normal per F7 | done: PR #33 |
| T2.2 | Homework the next conversation checks | practice-ux-engineer, frontend-engineer | T1.1 | normal | todo |
| T2.3 | Free earn-back repair | progress-retention-engineer | F4, F7 | per F7 | done: PR #35 |
| T2.4 | Bank a freeze | progress-retention-engineer | F5, T2.3 | per F7 | done: PR #35 |
| T3.1 | One freeze mark everywhere (slop fix) | design-system-engineer | none | normal | held: `claude/freeze-mark`, folds into board A |
| T3.2 | Board A, streak moments | frontend-engineer after the board | T1.2, T3.1 | normal | todo; holds 8 queued proposals (save lines, banked row, bank moment, spent state, wraps) |
| T3.3 | Board B, never a dead end | frontend-engineer, practice-ux-engineer | F6, T1.1 | normal | blocked: F6 |
| T3.4 | Board C, French anywhere | practice-ux-engineer | board | normal | todo |
| T3.5 | Board D, your French piles up | frontend-engineer, practice-ux-engineer | board | normal | todo |
| T3.6 | Board E, a story to follow | frontend-engineer plus copy | board, F9 | normal | todo |
| T4.1 | Heard-right fixes | voice-platform-engineer, learning-science-engineer | eval on real beginner recordings | Fable (voice pipeline) | todo |
| T5.x | Later list | various | Apple membership, migrations, data | per item | todo |
| T6.x | Measure and tune | data-engineer, progress-retention-engineer | T0.1, store live | per item | todo |

The reminders engine (T1.2-T1.4) is one set of files, so it runs in one session, in order. T2.x and T3.x have their own files.
At most two builders run at once, and never on the same files.

### T0.1: Measurement first

Add a read-only query counting synced practice sittings (game namespace) next to the billed-session D1/D7/D30 in
`deployment/beta-metrics.sql`. Fold it into the four-number report: paid conversion, net price, month-one renewal, and
minutes used against the allowance. Fix the cohort source, which reads `motivation` while Settings edits write
`onboardingGoal` (`profile/store.ts:555`).

Acceptance:
- `scripts/betaMetrics.test.mjs` synthetic rows: a learner with offline sittings on days 1 and 7 counts as retained.

### T1.1: One fix a day, free (approved)

Today's fix hero (`oneFix`, `home/todayView.ts`) opens for every plan, and the Home tap goes straight to the drill
(`tabs/HomeTab.tsx`). Your fixes, older fixes and conversation-phrase review stay Core. Record it as the D24 addendum
and in a DECISIONS.md entry.

Acceptance:
- `todayView.test.ts` pins an open fix when `access('fixes')` is locked.
- A test proves Your fixes stays locked for free.
- A free learner's hero tap deals the drill. Checked in the web build at 375 and 320, light and dark.

### T1.2: Save your streak

The save line replaces the day's one slot only on a cliff day:
- run of 3 days or more;
- today not practised;
- plan known;
- no freeze would cover today.

It is decided for the next slot only, because slots are planned 7 days ahead and sync never re-plans. Guests and an
unknown plan get none.

Precedence: pause note, then milestone eve, then save, then routine. A tap opens `daily-phrase`. It never names
plans, repair, a time or a countdown.

Implementation:
- Add `RETIRED_FROM_STREAK_BAN` with the dated decision. A second `RETIRED_FROM_BAN` entry would fail
  `guilt.test.ts:84-88`.
- Move `freezeCoverDays` from `game/settle.ts` into `core streak/freeze.ts` so the streak and the reminder agree.
- Update PRODUCT.md "never 'save your streak'", come-alive D25 and `game.md:470`.

Draft lines, for founder approval:
1. "Save your 12-day streak" / "Léa has today's phrase ready. One minute keeps it going."
2. "Save your 12-day streak" / "A short review counts too. Léa is here."
3. "Keep your 12 days going" / "Today's phrase takes a minute, and Léa is ready."

Acceptance, in `plan.test.ts`:
- (a) a cliff day sends save;
- (b) a freeze held sends none;
- (c) an unknown plan sends none;
- (d) `mentionStreak` off sends none;
- (e) a run under 3 sends none;
- (f) the pause note still wins;
- (g) the day after a freeze is spent sends save;
- (h) still one `practice:{day}` slot a day.

The guilt scans pass, and "save your" appears in the save lines only.

### T1.3: A reminder worth reading

New line kinds, all inside the one slot and through the guilt scans. The founder approves the copy.
- Today's phrase named in the line ("How do you say 'I'd like a coffee'?"), with the phrase id in the notification
  data so a late tap opens the same phrase.
- "Léa is free to talk again" when the free refill (`periodEnd`) lands before the slot.
- A goal or next can-do line ("A line for your trip"), using `onboardingGoal` and the spine's next scene, with generic
  lock-screen wording.
- "Léa kept one of your fixes for today", when T1.1's fix exists.
- A weekly "This week: 4 days of French, 6 practices" line, never compared with last week.
- Taps open a practice: Review if free cards are due, otherwise the café line. Never Home's plans card.

Precedence after T1.2: save, then free talk back, then fix, phrase or goal (rotated, demoting lines seen recently),
then routine.

Acceptance:
- `plan.test.ts` per line kind;
- `openTarget` tests ("the tap opens the phrase the line named, even after midnight").

**Slice A, as built (founder, 2026-11-19, in chat; D28).** The read rule stays: `reminder.test.ts` still bans
`progress/`, `missions/`, `review/` and `practice/` reads, so the fix line, the goal line and the Review-if-due door are
slice B, which waits on a later decision about that rule. Slice A:
- **Named phrase**, in the streak and routine rotations: "How do you say “{english}”?" / "Today's phrase, with
  {tutor}." The English only, a trailing full stop dropped, no second "?" after a question. The phrase is picked at plan
  time for the slot's own day (`todayPhrase.ts` `phraseLevel` once, then `phraseOn`), its id rides on the slot and in
  the notification data, and a tap opens it, falling back to today's pick only for older notifications. A phrase whose
  line would fail the scans is never named; the generic phrase line says it instead. `REMINDER_COPY` renders the named
  line for every phrase in the pool.
- **Free to talk**: "{tutor} is free to talk again" / "A conversation is ready when you are." On the free plan with a
  known refill (`periodEnd`) still to come, on the first slot at or after it, opening Speak. Billing is heard as
  `useTrialReminderSync` hears it (fetch plus `onBillingChange`), in memory only, and a change re-plans. A refill used on
  another device may leave the line stale: accepted.
- **Weekly**: "This week with {tutor}" / "{d} days of French, {p} practices." On a Sunday slot only, only with
  `mentionStreak` on and at least one practice day, counting the 7 local days ending that Sunday, never compared.
- **Taps open a practice**: a slot with a planned phrase that would have opened Home opens that phrase. The pause note
  keeps Settings; guest slots are unchanged (they carry no phrase).
- **Precedence**: pause, milestone eve, save, free talk, weekly, then the rotation. The one-day avoid rule stays.
- **Second round (founder, 2026-11-19, in chat).** The named line is now title "How do you say this?", body
  "“{english}” Today's phrase, with {tutor}." (English only; a trailing "." dropped, a "?" or other final mark kept). A
  phrase is named only from the everyday situations in `reminder.ts` `NAMEABLE_SITUATIONS` (scenario themes
  `cafe-and-food`, `shops-and-markets`, `transport`; `friends-and-small-talk` is left out because it holds personal lines such as "I feel awful, but I really cannot come tonight."; 352 of the 1,000 phrases, 164 of the 200
  Home can pick), and never with a digit or an empty English; every other phrase says the generic phrase line. The
  weekly line opens the Streak screen; "A moment of French" opens Speak. Free to talk goes only to a learner who ran out
  (`canStart` false or no seconds left); billing is refetched on the foreground and after a settled sitting (one fetch
  per event, then the re-plan), and a failed fetch keeps the last known refill.

### T1.4: Your talk days

Ask "Which days and time will you talk to Léa?" instead of defaulting to `smart` (`reminder.ts:111`, `ReminderAsk.tsx`).
Free slots are at least 44 hours apart, for example Mon/Wed/Fri. On a talk day the line states "A conversation with
Léa today", and says "free to talk" only when the refill is known to be before the slot.

A missed day says nothing.

Acceptance:
- `plan.test.ts`: the talk line appears only when the refill is before the slot;
- guests and an unknown plan get none.

### T2.1: Your lines come back (F3)

`review/freeTier.ts` `dealForTier` deals conversation-only cards for the free plan. Update the D24 addendum.

Acceptance:
- A free tier is dealt conversation cards.
- Home's review row follows the same deal.

### T2.2: Homework the next conversation checks

The recap ends "For next time: say *Je voudrais un café* on your own", using `correctionFocus` (otherwise the kept
phrase). Today keeps it as the fix until the next conversation. The tutor already gets the last correction
(`tutorBrief.ts:166-168`), so no new join field is needed.

The next recap says "Homework: said on your own" only on independent evidence (`canDoEvidence.ts`). Otherwise it says
nothing, never "missed". The recap's "Next:" points at this, which is board B's door.

Acceptance:
- an `afterSessionView.test.ts` case for the line;
- an evidence test: credit only for an unaided turn.

### T2.3 and T2.4: Earn-back and bank a freeze (F4, F5)

- **Earn-back:** repair is already effort-earned (`REPAIR_PRACTICES` 2, a 2-day window, once a week,
  `core streak/repair.ts:29-44`). Open it once per 30 days to free learners through `capabilities.ts`
  `streakProtection` and the repair branch in `settle.ts`.
- **Bank a freeze:** a second finished practice in a day earns one freeze above the cap (`freezesHeld(cap)`,
  `freeze.ts:59`), at most one held.
- Copy stays plain. Repair never appears in a notification.

Acceptance:
- core tests for the 30-day limit and the +1 cap;
- a settle test showing the streak and the reminder agree.

### T3.1: One freeze mark

The Streak screen draws an outlined snowflake (`StreakParts.tsx:33-39,71`), while Progress draws `FreezeMark`
(`StreakSummaryCard.tsx:52`). Use `FreezeMark` in both.

Acceptance:
- a source test that no artboard snowflake remains;
- screenshots at 375 and 320, light and dark.

### T3.2-T3.6: Board items

The boards are drawn first and the founder picks. Built only after that.

- **Board A, streak moments** (Mascots and play brief 3A):
  - "Saved. 13 days of French." on `streak-extended`;
  - "Your freeze covered Tuesday. 12 days and counting." in Today's nudge slot (`restoredBy 'freeze'` is computed at
    `game/settle.ts:595` and read by nothing);
  - a no-freeze-today state;
  - `RepairMark` on the repair card;
  - a repair-finished moment (needs a new celebration event);
  - the dark streak hero.
- **Board B, never a dead end:**
  - out of time, free practice comes first on Home and Speak (F6);
  - recap "Next:" becomes a door into the fix or the homework;
  - "Up next" on offline end cards, with a named stop once the quests are done or the XP cap is hit ("That's today's
    French");
  - what Home shows on day two, after the fix is done.
- **Board C, French anywhere:**
  - an "On the train" silent hour across Home, today's phrase and recap practice (`drill/store.ts:198-213`; decide
    whether it syncs);
  - a silent finish for today's phrase;
  - an earbuds sitting, needing learning-science review: listening earns nothing, and one typed recall earns 5 XP.
- **Board D, your French piles up:**
  - Léa's notes, kept: "You said this well", "To work on" (tried first) and "Next step", offline;
  - the learner's own first unaided line on the celebration, the one chartreuse use;
  - a "Show big" counter card in the phrasebook;
  - collections ("14 of 20 café phrases", a passport city by city);
  - a shareable "I can now order a coffee" card;
  - "En vrai" stamps on their own page.
- **Board E, a story to follow:**
  - one hand-written hook per scene, about 31 lines, opening the free preview;
  - tutor postcards at 7, 30 and 100 days (F9).

### T4.1: Heard-right fixes

Show a fix only when its line was heard clearly, using per-turn STT confidence into `smallFixes`, with a
"Not what I said" button. The threshold is set only after an eval on real beginner recordings.

### T5: Later

- **Waiting on the Apple membership:** a home-screen widget (today's phrase, count off by default), app-icon shortcuts,
  Siri, remote push.
- **Seasonal events (F12):** each new scene pack needs the `tutor_pack_v1` validator migration first. Without it,
  every conversation dies at its first checkpoint (F970).
- **One chosen friend's flame:** display only, after a social-systems review.
- **Founder decisions F9 to F11:** the tutor's week, a tiny free memory or a typed line for Léa, free revisits, and a
  goal with a "when".
- **Moving the launch wall** to a finished practice's end card, after launch data.

### T6: Measure and tune

- **The `reminder_opened` event:** the app, token-server and Postgres allow-lists plus a migration, on the Fable route.
- **Save line against routine line:** randomised on cliff days. Measure same-day practice, and notifications turned
  off per arm.
- **Tuning:** demote or drop lines by open rate. Read D7 practice-day retention per change.

## Measures

| Item | Works when |
|---|---|
| T1.1, T2.2 | fix drills finished per free learner per week; D7 practice-day retention |
| T1.2 | same-day practice on cliff days, against the routine line; notification permission kept |
| T1.3, T1.4 | reminder taps that end in a finished practice |
| T2.1-T2.4 | returns within 7 days after a run ends |
| Boards | the founder's 3-5 beginner watch, then retention per release |

## Never

- random rewards, mystery unlocks or double-XP hours;
- autoplay, endless live talk, or minutes as quest prizes;
- countdowns, "midnight", "hours left", "at risk";
- a sad tutor, or "misses you" / "is waiting";
- buying freezes;
- stranger leaderboards, or friend streaks a friend can break;
- a streak count on the lock screen;
- an endless drill feed;
- prepaid packs, or a missed slot treated as a debt;
- scores read from open talk.

## Execution log

| Date | Task | Result | Next |
|---|---|---|---|
| 2026-11-18 | T1.1 | Founder approved F1 in chat. frontend-engineer building in `Luvani-worktrees/free-fix`, test first. | Review, gate, `/push-check`, `/land` |
| 2026-11-18 | T1.1 | Built and committed (3ae5647d). Gate green, 7,946 tests. Push-check: browser pass on `?preview=today-fix` at 375 and 320, light and dark, clean. Reviewers found only low items: stale test names, a dead test field, DESIGN.md and today-sky.md still describing the lock. All fixed. Four design proposals logged in DESIGN_PARTNERSHIP.md. Out of scope, written up: `dev/todayPreviewFixtures.ts` uses the fix's sentence as today's phrase, so the preview shows the answer one row down; whether real data can do the same is unchecked (proposal row "fix and phrase on the same line"). | `/security-review`, stamp, PR |
| 2026-11-18 | T1.2, T2.1 | Built, push-checked and landed: PR #32 (6292a118) and PR #33 (365c711a), after PR #30 (9a894315). Each needed main merged in for docs-table conflicts only; code lines checked identical to the reviewed tips. | none |
| 2026-11-18 | T0.1 | Fable route: contract, Opus build, Fable SHIP round 1. Push-check fixed two SQL bugs and two test gaps test first; landed as PR #34 (17dbc7e9). | Read renewals in RevenueCat once the store is live (F1280) |
| 2026-11-18 | T2.3, T2.4 | Fable route: contract (founder answers Q1-Q4), three Opus builds, Fable SHIP round 1. Push-check: browser pass reached the banked state for real; Impeccable fix then ship; unslop pass; security none. Landed as PR #35 (9386bf02). | none |
| 2026-11-18 | Proposals | The founder sent all 16 push-check proposals from PRs #30, #32, #33 and #35 to a board. | Boards A-E |
| 2026-11-19 | T1.3 slice A | Founder approved the plan and copy in chat (D28). Built test first in `Luvani-worktrees/reminder-content`; mobile suite and typecheck green. | Review, gate, `/push-check`, `/land`; slice B decision |

## Landing

Each task lands as its own PR through `/push-check` and `/land`. T1.1 lands together with this plan.
Remaining acceptance gaps are recorded per task above.
