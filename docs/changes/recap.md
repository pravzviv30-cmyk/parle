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
8. The "before" shots are today's recap at the new preview keys. Each shows the first page, which is what a learner sees on arrival.

## Where More went (brief item 7)

| Was | Where it goes | Why |
|---|---|---|
| "You said this well" (`evidenceQuote`, the result page) | `SaidWellCard` under the tiles | Shown only when `currentCanDoQuote` finds an independent rung 4 finish for this session and mission and the learner's own verbatim line (`packages/core/src/canDoEvidence.ts:55`). It is the screen's one checked claim |
| "One thing to tune" (`otherFocus`, under More) | Takes the One sound row's place when there is no sound, and opens the same sheet | `focusFor` returns one focus or none, and a sound always comes first (`conversationPacks/closure.ts:104`), so a sound and `otherFocus` never exist together (`RecapScreen.tsx:256`). Still one focus, shown only when there is one |
| "Your wins" (`closure.didWell`, under More) | Leaves the screen | These are the brain's `usedWell` lines, said without help (`packages/brain/src/engine/recap.ts:110`, LEARN-006). They are a tutor judgement, not an independent check. Nothing is lost: they stay in the saved pack (`services/tutor-agent/src/convo.ts:3468`), still earn the transfer exercise (`services/token-server/src/practiceJobs.ts:59`) and still feed the revisit line (`practice/practiceTabView.ts:411`) |
| "New phrases" (`otherPhrases`, under More) | Leaves the screen | Every recap phrase is banked: the journal takes them all (`live/journalRules.ts:222`), and an early leave banks them too (`ConvoScreen.tsx:883`). The phrases tile still counts them |

Checked by the learning-science-engineer, 2026-11-06: HOLDS. One note for T4: the More pin in `RecapScreen.test.ts:68` and the 'Your wins' and 'New phrases' labels in `labels.test.ts:97` are markup pins, fine to re-pin. `closure.test.ts:42` tests the closure, which stays, so it should not change.

## Screens and states

Preview keys (`?preview=recap-*`, `dev/RecapPreview.tsx`):
- recap-full;
- recap-scrolled;
- recap-sound-sheet;
- recap-fix-sheet;
- recap-earned;
- recap-earned-first-stamp;
- recap-no-reply;
- recap-not-saved;
- recap-settlement-not-charged;
- recap-left-early;
- recap-typed;
- recap-no-sound;
- recap-progress-unreadable;
- recap-reminder.

To be filled per state as built.

## Dark tokens

To be filled in T4.

| Element | Light | Dark | Contrast |
|---|---|---|---|

## Blast radius

- `celebrate/EndScene.tsx`. `EndScene` and `EndActions` are drawn by `ReviewScreen`, `DrillScreen`, `SummaryScreen`, `daily/DailyPracticeScreen` and `dev/DrillPreview`. They must draw as before; the `drill-end` shots are re-taken to show it.
- `art/mascots/Cloud.tsx`. `CloudLids` gains the unposed body; posed lids are unchanged.
- `recap/afterSessionView.ts`. `afterSessionStats` has one caller, the recap.
- `recap/KeptPhraseCard.tsx` and `recap/RecapParts.tsx`. The recap is their only caller.
- Deleted: `recap/pages.ts`, `recap/ResultArt.tsx` and `recap/ProgressStrip.tsx` (no importer). Also `recap/progressStrip.ts`, if nothing else uses it.

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

## Integrated verification and handoff

- Focused checks: not run
- Full gate: not run
- UI / device checks: not run
- Documentation and decisions: not yet
- Landing disposition: HOLD until built, verified and the founder OKs the after shots
