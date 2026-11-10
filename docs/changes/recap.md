# The conversation recap, direction A: one ending

- Status: building on `claude/recap` (UI-020)
- Updated: 2026-11-06
- Checkout / starting revision: `origin/main` at `e8d020c3`, worktree `Luvani-worktrees/recap`
- Owner / integrator: Opus orchestrator session; builders as named per task
- Existing programme / contract:
  - [DESIGN_PARTNERSHIP.md](../DESIGN_PARTNERSHIP.md), screen 4;
  - decision [UI-020](../../DECISIONS.md);
  - board <https://claude.ai/artifact/4ftZZTVWePisXg6HWxrnJy>, artboard "A · One ending (chosen)", six phones;
  - brief `handoffs/2026-10-31-recap-build-brief.md`, outside the repo.

## Outcome and scope

Today the recap is five swiped pages behind a Continue / Next / Finish pager (`recap/pages.ts`):
- result, a blue page with "Bien joué.", the stat tiles, "You said this well" and the week;
- ability, a blue page with "You can now" and the postcard;
- lines, the lavender band, your lines, the kept phrase and small fixes;
- sound;
- next.

Leaving takes four taps. The headline and the kept phrase each show twice. The minutes tile says "spoken" even after a typed conversation.

After this change the recap is one screen, scrolled, in the end scene's frame:
1. EndScene's lavender band with Cloud and Toast.
2. The eyebrow, the headline and the credit line, then the scene's goals.
3. The stat tiles, then "You said this well".
4. Your lines, then the kept phrase, once.
5. Small fixes.
6. One sound row that opens one sheet.
7. Next time, the reminder ask, saving the text, and the report link.

A footer is pinned to the foot: "Practise this phrase", then Done. The close disc goes, because Done is always in reach.

**Existing seams:**
- `celebrate/EndScene.tsx`: the band and the tile row. They are exported as parts; the drill end is unchanged.
- `recap/afterSessionView.ts`: the tiles, eyebrow, fixes and celebration words.
- `recap/sessionCredit.ts`: one credit rule.
- `recap/moment.ts` and `useRecapMoment.ts`: the moment's clock.
- `recap/evidence.ts`: the stamp.
- `conversationPacks/closure.ts`.
- `live/keepsake.ts`: next time and the reminder offer.
- `components.tsx`: `Highlight` and `Sheet`.
- `art/mascots`: the poses and lids.
- `motion/MascotMotion.tsx`: `Blink`.
- Tokens come from `useB()`.

**Non-goals:**
- No change to the credit, settle, XP, saving, reminder, report or safety rules.
- No change to `ConvoScreen.tsx`'s props.
- No change to the drill end's look (founder, Q1).
- No new dependency and no Rive.
- No onboarding files. Onboarding's first conversation is `FirstSessionCelebration`, not this screen.

**Decisions:** UI-020 (this direction). It builds on UI-014 (the mascots), UI-016 (the end scene) and UI-019 (poses and blink).

**Defects:** none filed.

## Founder decisions

- 2026-11-01: direction A, one ending in EndScene's frame with its Cloud and Toast. Confetti falls only for a finish on the learner's own.
- 2026-11-06, in the build session:
  - **Q1:** the posed cheer Cloud goes on the recap only. Drill ends keep their face-only Cloud and Toast.
  - **Q2:** with no reply, the recap's idle Cloud blinks about every 4 s. This widens UI-019's "only while a speak drill's mic is live".
  - **Q3:** the scene's goals stay, under the title.
  - **Q4:** where the More disclosure and "You said this well" go:
    - "You said this well" stays under the tiles.
    - With no sound, "One thing to tune" takes the sound row's place.
    - "Your wins" and "New phrases" leave the screen. See "Where More went".

## Assumptions

1. EndScene is reused through its parts, the band and the tile row, not mounted whole. The whole scene runs its own GameDelta clock, and would sound twice and throw confetti on every delta.
2. After any reply Cloud is in its `cheer` pose, with the limbs in `useB().text`. With no reply Cloud is unposed, with the idle face, and blinks. Toast keeps its faces. There is no hop and no other new motion. The blink stops under Reduce Motion and on leave.
3. The tile numbers follow Today's minutes tile: "4" over "minutes", and "<1" under a minute. "minutes" is the only new word.
4. The kept phrase sits on a lip card with the shared `Highlight` pen, the screen's only chartreuse. "Practise this phrase" moves to the footer. The next page's repeat of the phrase goes.
5. Footer:
   - With a kept phrase and practice available: "Practise this phrase" is the lip primary, disabled until the save is durable. Done sits under it, and "See your journey" sits beside Done only on an earned scene.
   - Otherwise Done is the lip primary.
   - "Practise these lines, free" duplicated the primary, so it goes.
6. These go:
   - "Bien joué.";
   - the blue grounds;
   - `ResultArt` and its bloom. The `recap-result` timeline keeps its beats, so the chime, burst and strip times are unchanged;
   - `StreakRow`, the week bars and their read. The streak stays on Today, and its moment still plays from the queue after leaving;
   - `CloseDisc` and `CelebrateConfetti`;
   - the pager.

   The earned scene throws one confetti.
7. The sound sheet is the shared `Sheet`, holding today's sound page with its copy unchanged, plus `PrivatePractice`.
8. With no reply (`!credit.settles`) nothing was measured, so the scene's goals hide like the tiles and lines. This is the orchestrator's reading of brief item 4, and it goes to the founder with the after shots.
9. The earned scene has one sound and one haptic, the moment's chime. The stamp is silent there, so its sound does not stack on the chime.
10. The "before" shots are today's recap at the new preview keys. Each shows the first page, which is what a learner sees on arrival.

## Where More went (brief item 7)

| Was | Where it goes | Why |
|---|---|---|
| "You said this well" (`evidenceQuote`, the result page) | `SaidWellCard` under the tiles | Shown only when `currentCanDoQuote` finds an independent rung 4 finish for this session and mission and the learner's own verbatim line (`packages/core/src/canDoEvidence.ts:55`). It is the screen's one checked claim |
| "One thing to tune" (`otherFocus`, under More) | Takes the One sound row's place when there is no sound, and opens the same sheet | `focusFor` returns one focus or none, and a sound always comes first (`conversationPacks/closure.ts:104`), so a sound and `otherFocus` never exist together (`RecapScreen.tsx:256`). Still one focus, shown only when there is one |
| "Your wins" (`closure.didWell`, under More) | Leaves the screen | These are the brain's `usedWell` lines, said without help (`packages/brain/src/engine/recap.ts:110`, LEARN-006). They are a tutor judgement, not an independent check. Nothing is lost: they stay in the saved pack (`services/tutor-agent/src/convo.ts:3468`), still earn the transfer exercise (`services/token-server/src/practiceJobs.ts:59`) and still feed the revisit line (`practice/practiceTabView.ts:411`) |
| "New phrases" (`otherPhrases`, under More) | Leaves the screen | Every recap phrase is banked: the journal takes them all (`live/journalRules.ts:222`), and an early leave banks them too (`ConvoScreen.tsx:883`). The phrases tile still counts them |

Checked by the learning-science-engineer, 2026-11-06: HOLDS. One note for T4: the More pin in `RecapScreen.test.ts:68` and the 'Your wins' and 'New phrases' labels in `labels.test.ts:97` are markup pins, fine to re-pin. `closure.test.ts:42` tests the closure, which stays, so it should not change.

## Screens and states

Preview keys (`?preview=recap-*`, `dev/RecapPreview.tsx`), as built in T4. Every key is one scroll with the footer pinned:
- recap-full: posed Cloud, eyebrow, headline and credit line, goals, three tiles, your lines, the kept phrase, the "One thing to tune" row, Next time; Practise this phrase and Done.
- recap-scrolled: as full, plus "You said this well", three small fixes and the sound row ("One sound to practise next").
- recap-sound-sheet: the scrolled recap with `FocusSheet` open on the live sound (title "From this conversation", the mouth, the cue, the notation toggle, private practice).
- recap-fix-sheet: the scrolled recap with `FixLineSheet` open on the first fix.
- recap-earned: "See your journey" beside Done; "You can now", the ability and its line; the postcard still in the band (an earn again stamps lightly); "Your postcard", the postcard line and the Next pill after the tiles. The preview seeds a rung 4 finish so the can-do reads earned.
- recap-earned-first-stamp: as earned, with the band's confetti and the first stamp; "New postcard".
- recap-no-reply: resting, blinking Cloud, no confetti; the title is "You made time for your French." with no headline; no goals and no tiles; Done is the lip primary.
- recap-not-saved: the kept card says "Not saved yet" with "Try saving again"; Practise this phrase stays disabled.
- recap-settlement-not-charged: as no-reply, with the settlement message under the title in a polite live region.
- recap-left-early: one line, one phrase, the "<1 minutes" tile, no XP tile.
- recap-typed: as full (the typed fixture shares the full payload).
- recap-no-sound: "One thing to tune" takes the sound row's place (Q4).
- recap-progress-unreadable: the "Saved progress could not be read" card with its retry first, then the recap.
- recap-reminder: as full; the reminder ask cannot show on web (`REMINDERS_AVAILABLE` is false).

## Dark tokens

From `palette.ts` (light `paper`/`colour`/`pastel`, dark `b.dark`), contrast by WCAG relative luminance. Words clear 4.5; the lips and band are marks, not words.

| Element | Light | Dark | Contrast (light / dark) |
|---|---|---|---|
| Eyebrows ("At the café", "You can now", "One phrase kept", focus label) | `link` #3B2FE0 on `ground` #FFF6E9 / `card` #FFFFFF | `link` #A79AFF on `ground` #151127 / `card` #25203D | 7.35 and 7.87 / 7.63 and 6.44 |
| Title, ability | `text` #16123A on `ground` | `text` #FFF6E9 on `ground` | 16.60 / 17.18 |
| Credit line, celebrate line | `secondary` #4A4766 on `ground` | `secondary` #C6BED8 on `ground` | 8.22 / 10.30 |
| English, meta, chevron | `muted` #5C5A74 on `card` | `muted` #C6BED8 on `card` | 6.63 / 8.69 |
| Kept phrase French | `paper.ink` #16123A on `highlight` #D8FF54 | same pen in both modes | 15.53 / 15.53 |
| Lip under kept card, fixes, focus row, tiles | `line` #F0E6D6 under `card` | `line` #514967 under `card` | 1.24 / 2.19 (decorative edge) |
| Band | `lavender` #E9E3FA | `lavender` #322B50 | 1.40 against dark `ground` (decorative) |
| Footer primary | `onPrimary` #FFFFFF on `primary` #16123A | #FFFFFF on `primary` #6357F2 | 17.77 / 5.03 |

## Removed

| What | Why |
|---|---|
| `recap/pages.ts`, `recap/pages.test.ts` | The pager is gone; one scroll. The save-independence pin (:28-35) moved to `RecapScreen.test.ts` "saving is independent of the layout"; the owner-scoped text pin (:40-55) tested `savableText`, which only decided whether the next page existed. The rule lives in `SaveTextChoice.tsx:20`, now pinned from the same test |
| `recap/ResultArt.tsx` | The bloom and the result drawing went with the blue page; the band's confetti is the moment's |
| `recap/ProgressStrip.tsx` | Imported nowhere. `recap/progressStrip.ts` stays for `progressStripView` |
| `CloseDisc`, `StatTiles`, `StreakRow`, `CelebrateConfetti`, `PostcardCard` (`RecapParts.tsx`) | No longer drawn: Done is always in the footer, the tiles are EndScene's, the week left, one confetti, the postcard sits in the band |
| `streakLine`, `weekBars`, `recapWeekFrom` and their tests; the `loadActiveDays` week read in the recap | The week left the screen (assumption 6); the streak stays on Today |
| `otherPhrases`, `hasMore`, `more`, `soundDetail` (moved to `FocusSheet`), `savableText` in `RecapScreen.tsx`; the More pin and the three-phrase ceiling pin | "New phrases" and "Your wins" left (Q4); the ceiling only bounded the More list |
| "Bien joué.", "Your next practice", "Practise these lines, free", the "Finish conversation" label | Founder Q4 and assumption 5; Done's visible label is now its accessible name |
| `art/flat/celebrate-first-line.tsx`, `art/flat/state-waiting.tsx` and their `art/flat/index.ts` entries | Drawn only by the old result page; nothing reaches them now |
| Their `### celebrate-first-line` and `### state-waiting` sections in `docs/design-assets/ILLUSTRATIONS.md` | The catalogue the generator reads; left in, a regeneration would bring them back |
| Their names and sizes in `art/registry.test.ts` (77 to 75), the count in `surfaceContract.test.ts`, the two names in `sessionScreens.test.ts`'s allow pattern | The pins follow the registry. `cloud-cheer` and `cloud-heart` (BArt) stay: Explore draws them |

## Blast radius

- `celebrate/EndScene.tsx`. `EndScene` and `EndActions` are drawn by `ReviewScreen`, `DrillScreen`, `SummaryScreen`, `daily/DailyPracticeScreen` and `dev/DrillPreview`. They must draw as before; the `drill-end` shots are re-taken to show it.
- `art/mascots/Cloud.tsx`. `CloudLids` gains the unposed body; posed lids are unchanged.
- `recap/afterSessionView.ts`. `afterSessionStats` has one caller, the recap.
- `recap/KeptPhraseCard.tsx` and `recap/RecapParts.tsx`. The recap is their only caller.
- Deleted: `recap/pages.ts`, `recap/ResultArt.tsx` and `recap/ProgressStrip.tsx` (no importer). `recap/progressStrip.ts` stays: `progressStripView` reads it.
- Shared with the onboarding build, rounds 3 and 4 (S11 to S16, approved 2026-11-08):
  - **`PillButton`'s lip.** The recap's footer draws it through `EndActions`. S12 changes its press. The recap does not edit `PillButton`, so it takes whichever press lands.
  - **`ReminderAsk`.** The recap and S14's arrival sheet both draw it. Unchanged here.
  - **`Blink`, `PopIn`, `Hop` and `Confetti`.** S15 uses them too. Unchanged here.
  - **`CloudLids`** (`art/mascots/Cloud.tsx`). This build adds lids for the unposed Cloud, for the resting recap's blink (Q2). If S15's Welcome blink is on an unposed Cloud, it reuses that once this lands, so there is no second way to draw lids.
  - **`mascotPoses.test.ts`.** Its `ink=` scan covers both builds.
  - **Not shared:** `HomeArrival`, `AccountWelcome` and `FirstSessionResult` do not draw `EndScene`, `RecapParts` or `KeptPhraseCard`.

## Tasks in dependency order

| ID | Outcome | Owner | Depends on | Status |
|---|---|---|---|---|
| T0 | Worktree, `npm ci`, baseline gate, this spec | orchestrator | none | in progress |
| T1 | Recap preview keys against today's screen; before shots | `frontend-engineer` | T0 | todo |
| T2 | Where More went, checked | `learning-science-engineer` | T0 | todo |
| T3 | The band and tile row exported; recap Cloud modes; lids for the unposed body; tile numbers | `design-system-engineer` | T1 | todo |
| T4 | The recap rebuilt; parts and files retired; every pin re-pinned | `frontend-engineer` | T2, T3 | todo |
| T5 | Docs: UI-020, DESIGN.md, the partnership, the state map, cast.md, the shots README | `implementer` | T4 | todo |
| T6 | Gate, verifier rounds, after shots, simulator, live typed run | orchestrator | T5 | todo |
| T7 | `/push-check`, push | orchestrator | T6 | todo |
| T8 | Founder OK on the after shots, `/land --no-ff` | orchestrator | T7 | todo |

## Execution log

| Date / task | Attempt and changed paths | Check / result | Next action or blocker |
|---|---|---|---|
| 2026-11-01 / design | A picked on the board | n/a | Build after finish-off and impeccable-check land |
| 2026-11-06 / plan | Plan approved; Q1 to Q4 answered | n/a | T0 |
| 2026-11-06 / T0 | Worktree from `origin/main` `e8d020c3`; `npm ci`; this spec | `npm ci` exit 0; baseline `npm run gate` green, 7,619 tests, 0 failing (mobile 4,116, floor 4,112) | T1, T2 |
| 2026-11-06 / T2 | `learning-science-engineer` checked the "Where More went" table; docs only | HOLDS | T4 re-pins the More and label tests |
| 2026-11-06 / T1 | `frontend-engineer`: `dev/RecapPreview.tsx`, `dev/recapFixtures.ts`, `dev/recapPreview.test.ts`, the wiring in `dev/OnboardingPreview.tsx`, the shots README. The session stopped mid-task, and the work was committed as WIP (`a5a20bd1`) | Mobile suite green in the gate below | Merge main |
| 2026-11-08 / merge | `origin/main` `1706178b` merged (`1b01b02b`), 64 commits, no conflicts. Main's dark marks (`brandMark`, the softened mint and sun) arrive before the before shots | `npm run gate` green, 7,742 tests, 0 failing (mobile 4,150) | Before shots |
| 2026-11-08 / T1 shots | The before set, 14 keys at 375 and 320, light and dark, in `reviews/2026-11-08-recap/before/` (56 files). Today's recap shows its first page at every key. `recap-progress-unreadable` reaches its state through a seeded unreadable sound-check record. The two sheet keys and `recap-reminder` draw the full recap: the sheets open only after the rebuild, and `REMINDERS_AVAILABLE` is false on web | No console errors on any key | T3 |

| 2026-11-08 / T3 | `design-system-engineer`: `SceneBand`, `SceneTiles`, `SceneCloud` exported from `celebrate/EndScene.tsx`; `CloudLids` for the unposed body; the minutes tile (`7ce34983`) | New tests failed first; mobile 4,154 green; drill-end shots unchanged | T4 |
| 2026-11-08 / T4 | `frontend-engineer`: the one scroll, `recap/FocusSheet.tsx`, the lip `KeptPhraseCard`, the pinned footer; pages, `ResultArt`, `ProgressStrip`, unused `RecapParts` and two flat drawings retired; every pin re-pinned (`1c57db0c`) | Mobile 4,158 green; round 2 placed the postcard, hid the goals with no reply | T5 |
| 2026-11-08 / T5 | `implementer`: UI-020, `DESIGN.md`, the taste log and queue row 4, the state map, `cast.md` (`875967c5`) | `gate:fast` green | T6 |
| 2026-11-08 / T6 | Fix-verifier round 1 REFUTED: two sounds on an earned scene, a "0" minutes frame; fixed test first (`7e735979`). Five ledger ticks re-pointed (`6d6f8368`) | Gate green on `6d6f8368` | Round 2 |
| 2026-11-10 / merge | `origin/main` `d899890e` merged (`c9cc798e`), no conflicts, lockfile unchanged | Gate: 7,768 tests; one tutor-agent timing test timed out at 15.05 s under load, passed alone in 12.4 s; nothing in `services/` is ours | Round 2 follow-up |
| 2026-11-10 / T6 | Round 2's "practise guard unpinned" was wrong: `practice is the recommended next action and finishing stays available` pins it (shown failing on a mutation), now named by F700; new pin for the unavailable-text notice, named by F707 (`2abb0bf5`). Round 3 HOLDS; its low note fixed (`de25dca7`, comment only) | 323 focused tests green | After shots |
| 2026-11-10 / shots | After set in `reviews/2026-11-08-recap/after/`: 14 keys at 375 and 320, light and dark, plus tall 375x2200 for scrolled, earned first stamp and not saved, all with reduced motion so frames are final | No console errors on any key | Simulator |
| 2026-11-10 / simulator | iPhone 17 Pro, dev client built from this worktree. `recap-earned-first-stamp` at normal text, then at accessibility-large with Reduce Motion: the first and later frames are byte-identical (no count-up, confetti drawn still), the tiles stack as rows, the footer stays pinned. Shots in `reviews/2026-11-08-recap/simulator/`. The back gesture is unchanged: no recap commit touches navigation, `App.tsx` or `ConvoScreen.tsx` (checked in code, not on a device) | As described | Push-check, live run |

## Integrated verification and handoff

- Focused checks: 323 focused tests green (fix-verifier round 3).
- Full gate: see the push-check stamp.
- UI / device checks: web before and after shots, the iPhone 17 Pro simulator at normal and accessibility-large text with Reduce Motion; the live typed run is pending.
- Documentation and decisions: UI-020, `DESIGN.md`, `docs/DESIGN_PARTNERSHIP.md`, `docs/CURRENT_STATE_MAP.md`, `docs/changes/cast.md`, the ledger.
- Under Reduce Motion the confetti is drawn still (the shared `Confetti` behaviour, as on the drill end), not removed; the founder sees it in the after shots.
- Landing disposition: HOLD until push-checked, the live run is captured and the founder OKs the after shots
