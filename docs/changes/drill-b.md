# Drill and practice, direction B v2: one frame, one sheet, one ending

- Status: in progress, approved direction (UI-016); build on `claude/drill-b`
- Updated: 2026-10-31
- Checkout / starting revision: `origin/main` at `64f6a2cc` (push check landed), worktree `Luvani-worktrees/drill-b`. The tile tasks (T5 on) start after `claude/today-sky` lands, which brings `LipTile`, `radius.stat`, `bType.stat24` and `motion/PopOnce`.
- Owner / integrator: Opus orchestrator session; builders as named per task
- Existing programme / contract: [DESIGN_PARTNERSHIP.md](../DESIGN_PARTNERSHIP.md) (screen 3); decision [UI-016](../../DECISIONS.md) and LEARN-018; board <https://claude.ai/artifact/XAZR2pptSi5YgH4ncZTXiK>, page "B v2, every surface" (System, Choose, Build, Write, Speak, Review, Sound and Fixes, Endings)

## Outcome and scope

Today every practice surface draws itself:
- the drill screen has its own tiles and option cards;
- Review has its own grade tiles;
- the sound drill and Sound Check have their own layouts;
- the end card is light only, even on dark routes.

After this change every drill and practice surface is built from one set of parts. The kind decides only the stage colour and the answer control:
1. **One frame.** Close and the living bar at the top, with no digits and the sun glow on a run. Then a stage band on the family tint, with the eyebrow and the prompt. Then the answer area on the cream ground. At the foot, one chunky primary with a 4pt lip.
2. **One tile.** The lip tile from Today, used for options, word chips, review grades, the Fixes buttons and the end tiles.
3. **One field and one mic.**
4. **One feedback sheet in four tones.** It is the only place Cloud appears during a sitting.
5. **One end scene for every sitting.**

| Removed | Why it can go | Where its job went |
|---|---|---|
| `OptionCard` (`components.tsx`) | Drawn only by the drill | `LipTile` (tile size) in `drill/kinds/` |
| Tap-translate's local brand tiles, lip and slot styles (`DrillScreen.tsx:2009-2028`) | A second tile system | `LipTile` (chip size), with slots filled in place |
| Review's own grade tiles (`ReviewScreen.tsx:395-411, 536-540`) | A third tile system | `LipTile` grades with coins |
| `BButton` on practice surfaces only (Fixes Say it / Type it, buttons inside the frame) | A different button shape inside the drill frame | `LipTile` and the lip primary. `BButton` stays everywhere else. |
| `celebrate/EndCard.tsx` | Light only, and a different ending per sitting | `celebrate/EndScene.tsx`, dark aware |
| Static own-words grounds (`OUTCOME_GROUND`, `DrillScreen.tsx:170`) | Not themed | The sheet's themed tones |

**Existing seams:**
- **Session rules (unchanged):** `packages/core/src/drill/session.ts`, `missReason.ts`, `review/scheduler.ts`.
- **Sheet rules:** `drill/answerSheet.ts` with `drill/sheetEffects.ts`.
- **Endings:**
  - The practice end comes from `practice/saveState.ts`, `practice/copy.ts` and `practice/useSittingEnd.ts`.
  - The Review end comes from `review/sittingEnd.ts`.
  - First-try counts come from `drill/firstTry.ts`.
- **Review rules:** `review/cardView.ts`.
- **Fixes:** `practice/fixesView.ts`.
- **Tokens:** from `useB()` (`main/bTheme.tsx`). Every hex lives in `palette.ts`.
- **Motion:** the `motion/` primitives (`Enter`, `PopIn`, `LevelSquish`, `CountUp`, `TokenFlight`, `LevelRing`, and today-sky's `PopOnce`), plus `celebrate/Confetti`.
- **Mascots:** `art/mascots/Cloud.tsx` (faces `cheer` and `listening`) and `Toast.tsx`.

**Non-goals:**
- No change to grading, matching, the ladder, the scheduler or practice completion. The one exception is the still-settling retry, which LEARN-018 defines.
- No new dependency and no Rive.
- No change to the live room, Recap's layout outside `FixLineSheet`, or the Practice tab's list.

**Risks / unresolved choices:**
1. **Shared parts come from today-sky.** The agreed contract (today-sky, 2026-10-31):
   - `LipTile({ tone, lip, size, onPress, selected, disabled, accessibility*, style, children })` in `components.tsx`;
   - `TodayStatTiles` in `game/TodayStatTiles.tsx`;
   - the tokens `radius.stat` 18 and `bType.stat24`;
   - `motion/PopOnce`.

   T5 to T8 wait for that landing. No copies, no shims.
2. **Dark primary.** The boards draw the dark primary in sun. The app's `primary` token is brand blue in dark (UI-008). The frame keeps `primary`, so the drill matches every other dark screen. Its lip is a new decorative token pair, `primaryLip`, with a `DESIGN.md` row.
3. **Dark mint and sage are the same hex** (`#233F41`). A right sheet on a Write drill sits on the cream ground, not on the stage, so the two never touch.
4. **The eyebrow on dark butter.** `link` `#A79AFF` on `#493C2E` is 4.4:1. `drillStage` returns `text` for that one pairing; every other pairing keeps `link` (see the table).
5. **No testIDs.** The drill tests pin source text by regex. Every re-pin keeps the same behaviour and is named in its commit.

**Decisions:** UI-016 (this direction), LEARN-018 ("Practise the one still settling").

**Defects:** none filed.

## Screens and states

1. **Frame** (`drill/DrillFrame.tsx`):
   - **Header:** a 44pt close, then `SittingBar` (`LivingBar`, no digits, the sun halo on a run).
   - **Stage band:** a 28pt bottom radius on `drillStage(kind, mode).band` (the field is `band`: a pin in `surfaceContract.test.ts` refuses the bare word for a retired notebook part). It holds the eyebrow (`bold13`-size, in `drillStage(kind).eyebrow`), the prompt (`bType` 23/29 extra bold, `text`) and an optional English line (`muted`).
   - **Answer area:** on `ground`.
   - **Footer:** one `PillButton lip`. Choose kinds have no Check button; a tap answers, as today.
2. **Families** (`drill/drillStage.ts`, pure):

   | Family | Kinds or surfaces | Tint |
   |---|---|---|
   | Choose | best-sentence, appropriate-reply | lavender |
   | Build | fill-blank, tap-translate | butter |
   | Write | translate, listen-type | sage |
   | Speak | repeat-this, own-words, sound drill, sound check | peach |
   | Review | review | butter |
   | Fixes | fixes | the family of its answer: speak or write |

3. **Tile:** `LipTile`, with four states:
   - **at rest:** `card`, `line` lip;
   - **picked:** a 2pt brand edge;
   - **right:** `mintWash` with `mintWords` ink, `PopOnce` and one sparkle;
   - **set aside:** 0.45 opacity, still readable.

   Chips use the chip size.
4. **Build.**
   - **Fill-blank:** a chip flies into the sentence's gap (`TokenFlight`) and leaves a dashed slot. Tapping the landed word sends it back, with the new line "Tap the word in the sentence to send it back."
   - **Tap-translate:** fills slots in place.
5. **Field and mic.**
   - **Field:** `TypedAnswer` as a lip field (radius 18, 4pt lip).
   - **Mic:** `SpeakCircle` inside `LevelRing`. On speak drills, Cloud (`listening`) squishes to the level beside the mic, and only while listening. "Type instead" stays under it.
6. **Sheet** (`drill/answerSheet.ts` rules unchanged, `drill/AnswerSheet.tsx` redrawn). It rises with `Enter`.
   - **Right:** `mintWash`. Cloud (`cheer`) pops in with `PopIn`. Then the line, its English and Hear it. "On a roll." after a run.
   - **Nearly:** `butter`. The missing letter is lit in the answer field. "It's spelt «x». That one counts."
   - **Miss:** a calm `card` with a `line` edge. No mark, sound or haptic. It shows the French, Hear it, one Notice tip from `missReason` on the stage band colour, then Continue.
   - **Second miss:** "It'll come back in your review."
   - **Own words:** "That works." / "Nearly there." / "Here's one way to say it.", on themed tones.
   - **Screen reader on:** every sheet waits for Continue.
7. **Review:**
   - **front:** "I said it" and "Type it";
   - **typing:** then "Show me";
   - **back:** the French, IPA and Hear it on the stage, then "How did that feel?" with three `LipTile` grades, each with a coin: Again (`quiet`), Got it (`sun`), Easy (`mintWash`).
8. **Sound:**
   - **Sound drill** (`FocusDrillPlayer`): peach stage with the word, IPA and gloss; "Hear it again"; Next; Finish here. "Nothing is listening."
   - **Sound check:** one line card with Hear it, the mic, then a result sheet: "One sound to try again."
9. **Fixes.**
   - **`AttemptCard`:** "Say it" as the lip primary, "Type it" as a `LipTile`.
   - **`FixLineSheet`:** the same sheet and mic.
10. **End scene** (`celebrate/EndScene.tsx`, every sitting):
    - **Scene:** Cloud and Toast. Confetti only here, and never on the not-saved variant.
    - **Title:** "That's today's set." on a drill end, "Review complete." on a Review end. The practice end keeps its copy.
    - **Three stat tiles:** XP, minutes and first try (Review shows cards). They count up with `CountUp`.
    - **Phrases:** each with Hear it, marked settled or "Still settling".
    - **Actions:** "Practise the one still settling" (LEARN-018), then Done.
    - **Variants:** "Nothing waiting." and "Practice was not saved on this phone." with Retry save.

**Dark mode** (each board's dark Tweak). Every value comes from `useB()`.

| Element | Light | Dark | Contrast |
|---|---|---|---|
| Ground, answer area | `ground` `#FFF6E9` | `ground` `#151127` | n/a |
| Choose stage + prompt | `lavender` `#E9E3FA` + `text` | `lavender` `#322B50` + `text` | 14.2:1 / 12.3:1 |
| Build and Review stage + prompt | `butter` `#FFE8AB` + `text` | `butter` `#493C2E` + `text` | 14.7:1 / 10.0:1 |
| Write stage + prompt | `sage` `#D4E2D7` + `text` | `sage` `#233F41` + `text` | 13.3:1 / 10.6:1 |
| Speak stage + prompt | `peach` `#F7D8C7` + `text` | `peach` `#49333F` + `text` | 13.2:1 / 10.7:1 |
| Eyebrow on the stage | `link` `#3B2FE0` | `link` `#A79AFF`; `text` on butter | light 5.8 to 6.5:1; dark 5.5 / 4.7 / 4.8:1, butter 10.0:1 |
| English line on the stage | `muted` `#5C5A74` | `muted` `#C6BED8` | light 4.9 to 5.5:1; dark 6.0 to 7.4:1 |
| Tile, field, chip | `card` `#FFFFFF` + `text`, `line` lip | `card` `#25203D` + `text` | 17.8:1 / 14.5:1; lip decorative |
| Right tile and sheet | `mintWash` `#D4F5E5`, head `mintWords`, body `text` | `mintWash` `#233F41`, head `mintWords` `#2FD18B`, body `text` | head 4.5:1 / 5.7:1 (21pt bold), body 15.2:1 / 10.6:1 |
| Nearly sheet | `butter` + `text` | `butter` + `text` | 14.7:1 / 10.0:1 |
| Miss sheet | `card` + `text`, `line` edge | `card` + `text` | 17.8:1 / 14.5:1 |
| Primary pill | `primary` `#16123A` + `onPrimary` | `primary` `#3B2FE0` + `onPrimary` | 17.8:1 / 7.9:1; `primaryLip` decorative |
| Lit letter (nearly) | `sun` + `onSun` | same | 11.6:1 |
| Cloud | mascot tokens | same | decorative |

**Reduced motion:** the sheet, Cloud, the chip and the end tiles appear in their final state at once. `PopOnce`, `TokenFlight`, `LevelSquish`, `CountUp` and the confetti are all off. The level ring keeps its static fill, as today.

**Large text:** prompts and tiles wrap, and nothing truncates French. Stat tiles use today-sky's `statTileLayout` rules. Checked at accessibility-large on the simulator.

**Screen readers:**
- every sheet waits for Continue (`sheetFor`);
- Cloud and the sparkle are decorative;
- grade tiles keep `accessibilityLabel={label}`;
- the landed word is a button named "Send voudrais back" (no guillemets in a spoken name).

**Preview keys** (`dev/OnboardingPreview.tsx`, `?preview=drill-<state>&theme=light|dark`, inside `ModeScope`):
- Choose: `drill-choose`, `drill-choose-right`, `drill-reply`, `drill-roll`, `drill-reply-miss`.
- Build: `drill-blank`, `drill-blank-landed`, `drill-blank-nearly`, `drill-build`, `drill-build-right`.
- Write: `drill-translate`, `drill-translate-hint`, `drill-listen`, `drill-listen-miss2`, `drill-into-en-right`.
- Speak: `drill-say`, `drill-say-listening`, `drill-say-result`.
- Own words: `drill-own`, `drill-own-works`, `drill-own-nearly`, `drill-own-oneway`.
- Review: `drill-review-front`, `drill-review-typing`, `drill-review-back`, `drill-review-said`, `drill-review-empty`.
- Sound: `drill-sound`, `drill-soundcheck`, `drill-soundcheck-result`.
- Fixes: `drill-fixes`, `drill-fixes-compared`, `drill-fixline`.
- Endings: `drill-end`, `drill-end-unsaved`, `drill-end-review`.

## Tasks in dependency order

| ID | Outcome | Owner | Depends on | Allowed files | Status |
|---|---|---|---|---|---|
| T0 | Worktree, `npm ci`, this spec, UI-016, taste log and screen queue | orchestrator | n/a | this file, `DECISIONS.md`, `docs/DESIGN_PARTNERSHIP.md` | done |
| T1 | Kind views moved to `drill/kinds/` with no visual change; drill fixtures and every preview key; before shots | `frontend-engineer` | T0 | `DrillScreen.tsx`, `drill/kinds/*` (new), `dev/OnboardingPreview.tsx`, `dev/drillFixtures.ts` (new), tests that pin moved source | done |
| T2 | LEARN-018 and pure `practice/stillSettling.ts` with tests | `learning-science-engineer` | T0 | `DECISIONS.md` (LEARN), `docs/PEDAGOGY.md`, `practice/stillSettling.ts(+test)` | done |
| T3 | `drillStage` + `DrillFrame`; `PillButton lip`; `primaryLip` token; the 8 kinds in the frame | `practice-ux-engineer` | T1 | `drill/drillStage.ts(+test)`, `drill/DrillFrame.tsx`, `drill/kinds/*`, `DrillScreen.tsx`, `components.tsx` (`PillButton` only), `palette.ts`, `DESIGN.md` row | done |
| T4 | One sheet with Cloud, the Notice tip and the lit letter; stale comment fixed | `practice-ux-engineer` | T3 | `drill/AnswerSheet.tsx`, `drill/answerSheet.ts` (comment only), `answerSheet.test.ts`, `drill/kinds/OwnWords*` | done |
| T5 | `LipTile` everywhere a tile is drawn; chip flight; lip field; `OptionCard` deleted | `practice-ux-engineer` | T4, today-sky on main | `drill/kinds/*`, `components.tsx` (`OptionCard` removal), re-anchored tests | done |
| T6 | The speak family: one mic, Cloud listening, sound drill, Sound Check | `practice-ux-engineer` | T5 | `drill/kinds/RepeatThis*`, `drill/SpokenAttempt.tsx`, `drill/FocusDrillPlayer.tsx`, `soundcheck/SoundCheckScreen.tsx` | done |
| T7 | Review, Fixes and Fix your line | `practice-ux-engineer` | T5 | `ReviewScreen.tsx`, `practice/FixesParts.tsx`, `practice/FixesScreen.tsx`, `drill/FixLineSheet.tsx`, their tests | done |
| T8 | `EndScene` for every sitting; still-settling retry wired | `practice-ux-engineer` | T2, T5 | `celebrate/EndScene.tsx` (new), `celebrate/EndCard.tsx` (deleted), `DrillScreen.tsx`, `ReviewScreen.tsx`, `practice/*` end wiring, their tests | done |
| T9 | Docs, Jev copy check | orchestrator + `design-system-engineer` | T8 | `DESIGN.md`, `docs/CURRENT_STATE_MAP.md`, `docs/KNOWN_ISSUES.md` if wrong, this file | in progress |
| T10 | Verification: gate and bless, verifier rounds, after shots, simulator, live sitting, `/push-check`, after shots to the founder, `/land --no-ff` | orchestrator | T9 | `docs/IMPLEMENTATION_EVIDENCE.md`, `reviews/2026-10-31-drill-b/` | todo |

## Execution log

| Date / task | Attempt and changed paths | Check / result | Next action or blocker |
|---|---|---|---|
| 2026-10-31 / design | B picked; B v2 drawn on eight boards, light and dark; approved ("Build it") | Boards read in the browser | T0 |
| 2026-10-31 / T0 | Worktree `Luvani-worktrees/drill-b` from `origin/main` `64f6a2cc`; `npm ci`; this spec; UI-016; taste log; contract with today-sky for `LipTile` and `TodayStatTiles` | `npm ci` exit 0 | T1, T2 |
| 2026-10-31 / T1 | Kind views to `drill/kinds/` (pure move), `testing/drillSource.ts`, `dev/DrillPreview.tsx`, `dev/drillFixtures.ts`, 36 preview keys; 13 tests re-pointed to the moved source | Mobile 3,909 green; before shots, 144 files in `reviews/2026-10-31-drill-b/before/` | T3 |
| 2026-10-31 / T2 | LEARN-018, `practice/stillSettling.ts` (+9 tests), PEDAGOGY paragraph. The retry writes nothing: no grade, XP, first-try count, activity day or history | Tests green | T8 |
| 2026-10-31 / T3 | `drillStage` (field `band`), `DrillFrame`, `primaryLip`, `PillButton lip`, `SittingBar` 14 high, `bType.prompt23` and `eyebrow800`; 8 kinds in the frame | Mobile 3,914 green; 32 shots | T4 |
| 2026-10-31 / T4 | One `AnswerSheet` in four tones, Cloud cheer on right only, `litLetters`, `sheetLine`, Notice on a miss, Check at the foot; `sheetLayout` keeps a waiting Continue visible at 320x640 (it was clipped) | Mobile 3,926 green | T6 |
| 2026-10-31 / T6 | `SpeakMic` (Cloud listening, 96 wide, in a kept slot), FocusDrillPlayer and Sound Check in the frame; Sound Check recorder metered | Mobile 3,930 green | T7a |
| 2026-10-31 / T7a | Review, Fixes and Fix your line on the frame. Found and fixed: a new word's back put English under "In French" (`CardAnswer.french`) | Mobile 3,931 green | merge |
| 2026-10-31 / merge | `origin/main` 9c7ad093 (today-sky: `LipTile`, `radius.stat`, `bType.stat24`, `PopOnce`) merged; DECISIONS, DESIGN_PARTNERSHIP and the preview list resolved by keeping both | Mobile 3,972 green | T5 |
| 2026-10-31 / T5, T7b | `LipTile` for options (PopOnce and one Sparkle), fill-blank chips (TokenFlight into the gap, send back), tap-translate slots, the lip field, Review grades with coins, Fixes Say it and Type it; `OptionCard` and `WordChoice` deleted | Mobile 3,981 green; fill-blank flow tapped through in the browser | T8 |
| 2026-10-31 / T8 | `EndScene` for every ending (Summary and Daily use its tiles-only mode), Today's stat `Tile` exported; the still-settling retry in the same screen behind one `recordsNothing` guard; `EndCard` deleted | Mobile 3,991 green | T9 |
| 2026-10-31 / T9 | Docs. Jev copy check (advisory, yes/no at 0.5): all six new strings free of scolding (0.79 together); "Practise the one still settling" scored low on plainness (0.29) and "Notice" low on warmth (0.46). Both are on the approved board; flagged for the founder, not changed. The spoken send-back name loses its guillemets | Jev run from the main checkout (the worktree has no key) | T10 |

Built differently from the spec or the boards, on purpose:
- **The close** is the existing 44pt disc in `ScreenHeader`, not the board's bare cross: app-wide pins require one `ScreenHeader` with "Leave the drills" on every pushed screen.
- **The dark primary** stays `primary` (brand blue), with `primaryLip` under it (risk 2).
- **A fill-blank chip no longer answers on tap.** It lands in the gap and Check answers, as the Build board draws it.
- **Nearly keeps its check disc**, because `answerSheet.ts` still says `mark: true` for a typo, and the rules were kept.
- **Review typing** keeps "I said it" as a secondary under Show me, because `cardView.ts` promises it is always there.
- **"Nothing waiting."** stays the existing `EmptyStateCard`, which `emptyStates.test.ts` pins as the way out.
- **End tile words** are the existing copy ("XP earned", "Time", "Got right", "Remembered"), not the board's "XP", "minutes", "first try" and "cards". Those were not on the approved new-copy list.
- **Summary and Daily** use `EndScene` in its tiles-only mode, with no scene band: each has its own heading and is not a drill end.
- **The repeat-this result** has no "One sound to try" Notice. That copy does not exist, so the scorer's note shows as its plain line.
- **The Sound Check result** keeps today's rule of no close on the result (F317), and has no Hear it on the sheet because the line card has one.
- **Own-words "Keep phrase"** still works during a retry. It is the learner's own phrasebook save, not progress.

## Integrated verification and handoff

- Focused checks: not run yet
- Full gate: not run yet
- UI / device checks: not run yet
- Documentation and decisions: this spec, UI-016
- Landing disposition: lands after T10 and the founder sees the after shots
- Next task: T1
