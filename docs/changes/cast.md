# The cast: Cloud's poses and blink, brief 1 of Mascots and play (1C)

- Status: brief 1 built on `claude/cast` (UI-019), uncommitted; verification not yet recorded
- Updated: 2026-11-03
- Checkout / starting revision: `main` at `a90ed36b`, worktree `Luvani-worktrees/cast`
- Owner / integrator: Opus orchestrator session; builders as named per task
- Existing programme / contract: [DESIGN_PARTNERSHIP.md](../DESIGN_PARTNERSHIP.md) (the cross-screen "Mascots and play" briefs); decision [UI-019](../../DECISIONS.md); board <https://claude.ai/artifact/FE7LqufdoHPQeArGCLct6g>; Figma canvas file `sjAwoGinWQKvhGrWbgMO18`, page "Mascots and play · picks" (node `500:364`); handoff `handoffs/2026-11-02-0110-mascots-and-play-board.md` (outside the repo)

## Outcome and scope

Today Cloud is a face on a body with no limbs. On a speak drill it sits over the mic as a face-only drawing, and on the right sheet it is a 52 wide face beside the headline. The mic sits mid-screen, away from the thumb.

After brief 1:
1. Cloud has two posed bodies. **Listen** has a hand cupped to the ear. **Cheer** has both arms up.
2. On a speak drill, Cloud listens in its pose, and blinks, while the mic is live.
3. On say it aloud, the whole speak block sits in the foot of the drill frame, the thumb zone.
4. On every right answer, the sheet's Cloud cheers in its pose, pops in and hops once.

**Existing seams:**
- `art/mascots/Cloud.tsx` and `mascotFaces.ts` draw the body and the faces. `mascotPaths.ts` holds the shapes.
- `motion/MascotMotion.tsx` holds `LevelSquish`, `Hop`, `PopIn` and `Rise`, with `drive.ts` for the engine and `landing.ts` for leaving.
- `drill/SpeakMic.tsx` is the one mic. `drill/DrillFrame.tsx` already takes a `primary` for the pinned foot.
- `drill/AnswerSheet.tsx` is the one sheet, with the rules in `answerSheet.ts` unchanged.
- Tokens come from `useB()`. Every hex lives in `palette.ts`.

**Non-goals:**
- No change to grading, the ladder, the sheet's rules or any copy.
- No change to the live room's cloud mic, `CelebrationHost` or `EndScene` (see "Blast radius").
- No new dependency and no Rive.

**Decisions:** UI-019 (this direction). It builds on UI-014 (the mascots) and UI-016 (Cloud at moments only).

**Defects:** none filed.

## Founder decisions

The picks (2026-11-02, on the Mascots and play board, from an Appllama study of Headspace, Duolingo, Finch and Focus Friend):
- **1C:** Cloud and Toast, with poses alive at moments.
- **2B:** one sky everywhere. The founder first took 2A and then chose 2B when asked.
- **3A:** the streak is the hero.
- **4A:** quiet moments, centre stage.

Answers inside 1C (2026-11-03):
- Cloud cheers on **every** right answer, in the cheer pose.
- Cloud listening on a speak drill is part of the mic, like the live room's cloud mic. It does **not** count toward the Cloud budget.
- Add the blink now.

The Cloud budget, given in another session on 2026-11-02 ("Luvani video reverse engineering review"): 3 to 4 Cloud moments in a 5-minute sitting, with the live mic not counted. That session listed the first right answer, the end of the set, the recap ending and the streak.

These two do not agree. The budget lists the first right answer, and 1C then chose every right answer for the drill sheet. This change records both and does not resolve them. The build follows the 1C answer, and nothing counts or limits cheers.

A council warning, not a founder decision, for 2B: the shared sky must not become one header skeleton for every tab. Each tab keeps its own focal point.

## What changed, per file

Art (`apps/mobile/src/art/mascots/`):
- `mascotPoses.ts` (new). `CloudPose` is `'listen' | 'cheer'`. `CLOUD_POSES` holds, for each pose, its own `viewBox`, the limbs behind the body (`rear`) and over it (`front`), the marks, a ground shadow and its face.
  - **Listen:** a hand cupped to the ear, sound arcs in brand blue, face `listening`.
  - **Cheer:** both arms up, two stars in sun, face `cheer`.
  - Limbs use the stroke of `assets/b-art/svg/cloud-cheer.svg` (`LIMB_WIDTH`). The shadow is an ink ellipse at `SHADOW_OPACITY`.
  - `cloudLayers(pose, ink)` is the pure draw list, in order: shadow, rear limbs, body (underside, silhouette, cheeks), front limbs, marks, face. With no pose it returns today's body and the original viewBox.
- `Cloud.tsx`. Takes `pose` and `ink`. It draws `cloudLayers`. With a pose, `size` is the width of that pose's box, which is wider than the body. `ink` is the limbs' colour and defaults to paper ink. A new `CloudLids` draws the blink's lids in the same box.
- `mascotFaces.ts`. A new `faceLids` returns, for each open eye, a card-white cover a little larger than the eye and the asleep face's closed curve at the same centre.
- `mascotPoses.test.ts` (new) pins the poses, the draw order, that a Cloud without a pose is unchanged, the lids, and that every posed Cloud in the app passes an ink.

Motion (`apps/mobile/src/motion/MascotMotion.tsx`):
- `Blink({ active, lids, children })` fades the lids layer in and out about every 4 seconds (`BLINK`: 4000 ms between blinks, 70 ms closing, 110 ms opening). Opacity only.
- It runs only while `active`, and `active` is only while a speak drill's mic is live. It goes back to open and stops when the mic stops, on leave (`useLandOnLeave`) and under reduced motion.
- `motion.test.ts`. `motion/MascotMotion.tsx` joins `LOOP_FILES`, the allowed loops. It is the one new loop, and it is paused by `active`.

Drill (`apps/mobile/src/drill/`):
- `SpeakMic.tsx`. Exports `ListeningCloud({ live, voice, size })`: nothing unless `live`, else the listen pose inside `LevelSquish` with `Blink` inside that, so the lids scale with the face. Limbs take the screen's text colour (`useB().text`) so they show in dark mode. By default the box is 116 wide, which draws the body about as big as the board's 96. On a surface that asks for Cloud (own words, the fix sheet), SpeakMic draws `ListeningCloud` in a slot above the circle that keeps the 77 it had before poses, whether or not it shows, so the mic never moves; Cloud there is 89 wide, as wide as its posed box allows at that height (push-check fix, found by the verifier).
- `speakFoot.ts` (new, pure). `sayFootHeight(mic, bottomInset)` adds up the say drill's foot for the armed mic and for the silent state (the controls, gaps, quiet control, bottom air, inset), so a test holds both under the screen's foot cap.
- `kinds/RepeatThisView.tsx`. The speak controls (the mic and its "Speak" or "Done" label, or "Type instead" and "I said it" when silent, and "Unable to speak right now?") are built once as `speak` and passed to `DrillFrame` as `primary`. When silent, the muted mic picture and its "Speak" label sit in the answer area: in the foot they made it 330pt against a 243pt cap at 320x640, which hid the quiet control (push-check fix, found by the verifier). The foot's mic has no Cloud; `ListeningCloud live={mic === 'live'}` sits in the answer area, centred, in the space the mic left. A first attempt kept Cloud in the foot and shrank it to fit the foot's cap; on a notched phone that left Cloud about 35 wide, so it moved out of the foot.
- `AnswerSheet.tsx`. The right sheet's Cloud is `<Cloud pose="cheer" size={CLOUD} ink={ground.ink} />` at 80 wide (`CLOUD` was 52), inside `PopIn` and a `Hop` that cues once after the sheet has risen (`DUR.fast`). It sits beside the headline, inside the sheet.
- `answerSheet.test.ts` and `speakFamily.test.ts` are re-pinned to the new markup, with the same behaviour. `speakFamily.test.ts` also pins that the speak block is the pinned `primary`, that the say foot fits under the foot cap at 320x640, 375x667 and a notched 375x812, and that Cloud listens in the answer area only while the mic is live.

## Screens and states

1. **Say it aloud** (`RepeatThisView`):
   - **At rest:** the mic, "Speak" and "Unable to speak right now?" sit in the foot. There is no Cloud.
   - **Live:** Cloud listens full size in the space above the foot, in its pose, squishes to the voice and blinks. "Speak" becomes "Done".
   - **Silent** (no microphone): the muted mic drawing, "Type instead" and "I said it", then the quiet control, all in the foot.
   - **Short screens:** the foot holds no Cloud, so it fits under its cap at 320x640, on the iPhone SE and on a notched phone, with the quiet control in sight. Cloud keeps its full size above it.
2. **Other speak surfaces:** own words (`SpokenAttempt`, through `OwnWordsView` and `FixLineSheet`) show the same listening Cloud over the mic. Their blocks stay where they were.
3. **Right sheet:** Cloud cheers on every right answer, pops in and hops once. A nearly and a miss have no Cloud, as before.
4. **Dark mode:** limbs take the screen's text colour (the sheet's word colour on the right sheet). Bodies and faces are unchanged and look the same in both modes.
5. **Reduced motion:** Cloud is still. The blink does not run, the pop and hop are off, and the sheet's Cloud is simply there.
6. **Screen reader:** Cloud and its lids are decorative and hidden, as before.

## Assumptions

1. Every right answer cheers, as the founder said inside 1C. The 3 to 4 budget is not enforced in code.
2. The listening Cloud does not count toward the budget, as the founder said.
3. A fade of the lids is enough of a blink. It needs no new eye shapes and no per-frame drawing.
4. The screen's text colour is the right ink for limbs on every ground the poses sit on. It is still to be checked on the peach stage and on the right sheet's mint, in light and dark.
5. About every 4 seconds is a natural blink for a character that is waiting.
6. Cloud's cheer standing on the sheet's top edge needs a footer layout change. The sheet's foot is a `ScrollView`, which would clip anything over its edge, so the planned fallback inside the sheet is used.

## Blast radius

- **`Cloud` without a `pose` renders as before.** `EndScene` (drill end and recap), the live room's cloud mic and `CelebrationHost` pass no pose and are unchanged.
- **`SpeakMic` has three callers.** `RepeatThisView` (the mic in the pinned foot, with Cloud listening in the answer area through `ListeningCloud`), `SpokenAttempt` (listen pose at 89 wide in the unchanged 77 slot, reached through `OwnWordsView` and `FixLineSheet`) and `SoundCheckScreen`, which asks for no Cloud and is unchanged.
- **`LevelSquish`, `Hop` and `PopIn` are unchanged.** The new `Blink` is added beside them.
- **`LOOP_FILES` in `motion.test.ts` grows by one file.** Anything else that starts a loop in `MascotMotion.tsx` must also be paused by `active`.
- **No change** to `DrillFrame`, `answerSheet.ts`, grading or copy.

## Not done

- **`EndScene`** (drill end and recap) keeps face-only Cloud and Toast until the recap build lands.
- **Brief 4 (4A) is next.** It adds wave, hold and rest, and Toast's face in the saved-phrase toast.
- **Briefs 2 (2B) and 3 (3A)** come after the Journey board.
- **Today's out-of-time hero (4A)** waits for `claude/phone-fixes`.
- **The hello tilt** has no caller yet.
- **Cloud on the sheet's top edge** is a possible follow-up that needs a footer layout change.
- **The Cloud budget** and the cheer-on-every-right-answer answer are both recorded and not reconciled. The founder decides.

## Tasks in dependency order

| ID | Outcome | Owner | Depends on | Allowed files | Status |
|---|---|---|---|---|---|
| T1 | Cloud's poses, lids and the blink | step 1 agent | none | `art/mascots/*`, `motion/MascotMotion.tsx`, `motion.test.ts` | built |
| T2 | The listening mic, the pinned say foot and the cheering sheet | step 2 agent | T1 | `drill/SpeakMic.tsx`, `drill/speakFoot.ts`, `drill/kinds/RepeatThisView.tsx`, `drill/AnswerSheet.tsx`, their tests | built |
| T3 | Docs | step 3 agent | T2 | `DESIGN.md`, `DECISIONS.md`, `docs/DESIGN_PARTNERSHIP.md`, this file | built |
| T4 | Verification, then `/push-check` and landing | orchestrator | T3 | `docs/IMPLEMENTATION_EVIDENCE.md` | todo |

## Execution log

| Date / task | Attempt and changed paths | Check / result | Next action or blocker |
|---|---|---|---|
| 2026-11-02 / design | The Mascots and play board; picks 1C, 2B, 3A, 4A | n/a | Answers inside 1C |
| 2026-11-03 / design | Founder answers: every right answer cheers, listening is not counted, add the blink | n/a | T1 |
| 2026-11-03 / T1, T2 | Poses, lids, `Blink`, the listening mic, the pinned say foot, the cheering sheet (see "What changed") | See Verification | T4 |
| 2026-11-03 / T3 | This spec, UI-019, `DESIGN.md`, the taste log and proposals | n/a | T4 |

## Verification

- Focused checks: `mascotPoses.test.ts`, `answerSheet.test.ts`, `speakFamily.test.ts` and
  `motion.test.ts` failed first, then passed.
- Full gate: green on 2026-11-03, mobile 4069 tests; the floor was raised from 4057 with
  `gate:bless`.
- Web shots at 375 and 320, light and dark: `artifacts/cast-2026-11/after/`, which covers
  the say drill (idle and listening, plus 375x667) and the build and choose right sheets.
  The quiet control is visible at 320x640, Cloud is full size, and the limbs show on dark.
- Device or simulator (iPhone 13 mini, dev client):
  - Say drill, listening: the mic, its label and the quiet control sit in the foot, with
    Cloud listening above them. In dark mode the limbs draw in the light ink.
  - Blink: a 10 s recording changes only in three bursts of about 180 ms, about 4.1 s
    apart. The face crops show the eyes closing and opening
    (`ios-mini-blink-frames.png`).
  - Reduce Motion on: a 10 s recording holds a single frame, so there is no blink and
    Cloud stays still.
  - Choose right sheet, mid-hop: Cloud's arms and stars stay inside the sheet
    (`ios-mini-choose-right-midhop.png`).
  - Accessibility Large: the foot fits, and Cloud sits partly below the fold.
- Documentation and decisions: UI-019 in `DECISIONS.md`; the Mascots, one mic, motion,
  Loops and What never moves sections of `DESIGN.md`; and the taste log and proposals
  in `docs/DESIGN_PARTNERSHIP.md`.
- Not verified: Android. The blue sound arcs are dimmer on the dark ground; this goes to
  the design review.
- Landing disposition:
