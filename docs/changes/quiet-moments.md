# Quiet moments, centre stage: brief 4 of Mascots and play (4A)

- Status: built on `claude/quiet-moments` (UI-019); verification below
- Updated: 2026-11-04
- Checkout / starting revision: `main` at `34eae927`, worktree `Luvani-worktrees/quiet-moments`
- Owner / integrator: Opus orchestrator session; step 1 design-system-engineer, step 2 frontend-engineer (both Opus, low effort)
- Existing programme / contract: [DESIGN_PARTNERSHIP.md](../DESIGN_PARTNERSHIP.md) ("Mascots and play"); decision [UI-019](../../DECISIONS.md); brief 1 is [cast.md](cast.md)

## Outcome and scope

Before this change the quiet moments were grey cards:
- the phrasebook with nothing kept showed a card with a notebook drawing;
- Speak out of the free conversation showed a clock card;
- the nothing-to-review screens showed a static Cloud cheer whose ink arms vanish in dark mode;
- Today out of time past Starter showed Review twice, as the hero's plain button and as a path row;
- the saved-phrase toast showed a mint tick.

After brief 4:
1. **Phrasebook with nothing kept:** centre stage. Cloud holds the yellow phrasebook, with "Your first kept phrase lands here." and "Keep a line in a conversation and it waits here, ready to hear again.". Choose a scene is pinned in the foot.
2. **Speak out of the free conversation:** centre stage. Cloud rests ("z z") over the same words, with See the plans in flow. The rest of Speak is unchanged.
3. **Review's "Nothing waiting." and the drill bank's "Nothing to review.":** the same cards, with the posed Cloud cheer in the theme's ink.
4. **Today out of time past Starter, with Review due:** the hero's one action is a sage LipTile, "Review N phrases", About 2 minutes, with the watering plant and a chevron. The path drops its own Review row.
5. **The saved-phrase toast:** Toast's face beside "Saved to your phrasebook.".

**Existing seams:**
- `art/mascots/mascotPoses.ts` (the cast);
- `empty/EmptyStateCard.tsx` (the one empty-state card);
- `celebrate/Toast.tsx`;
- `practice/NextTaskCard.tsx` with `practice/nextTask.ts` (the lead);
- `home/todayView.ts` `todayStops` (the path);
- `ScrollScreen`'s `footer`.

**Non-goals:**
- no change to copy beyond the phrasebook's new body line;
- no new motion;
- no change to `layout.tsx` (a live session is there), to EndScene, to onboarding, or to the rest of Speak.

## Founder decisions

- 4A as drawn on the Mascots and play board (2026-11-02).
- Inside 4A (2026-11-04):
  - **Reach:** centre stage on the two drawn screens, plus the posed cheer on the two nothing-to-review cards. Other empty states keep their cards.
  - **Speak:** the moment replaces the out-of-time card in place. The scene hero and the rest of Speak wait for the Speak tab redesign (queue 7).

## What changed, per file

- `art/mascots/mascotPoses.ts`:
  - two new poses, `hold` (legs, the idle face, the book under both arms) and `rest` (sitting with no legs, the paused face, "z z"; the board's tucked legs read as stray stubs, Impeccable);
  - a mark `tone`: `ink` strokes take the caller's ink, and `accent` strokes take the accent or brand blue. The listen arcs are `accent`, and "z z" is `ink`;
  - hold's arms and the book's outline lie on the white body and the yellow book, the same in both modes, so they are marks in the dark ink, drawn after the book. Only the legs on the ground take the screen's ink. The iOS dark check found the arms vanishing in cream ink;
  - marks draw before front limbs;
  - the `<Cloud pose ink accent>` API is unchanged.
- `empty/EmptyStateCard.tsx`:
  - `figure` (a mascot in place of the BArt drawing);
  - `stage` (no card ground, the 26 extra bold title);
  - unchanged without them.
- `celebrate/Toast.tsx`: `ToastPill` draws Toast's idle face where the tick was. The copy, position and pass-through are unchanged.
- `phrases/PhrasebookScreen.tsx`: `PhrasebookEmpty` and `PHRASEBOOK_EMPTY`, Cloud hold at 170, on stage and centred in the free space, with Choose a scene as the `ScrollScreen` footer while empty.
- `tabs/TutorTab.tsx`: `OutOfTimeMoment`, Cloud rest at 180, on stage, with the same words and action. `OUT_OF_TIME_ART` is removed.
- `ReviewScreen.tsx` and `DrillScreen.tsx`: `figure={<Cloud pose="cheer" size={150} ink />}`. `ALL_DONE_ART` is removed; the `cloud-cheer` asset stays for the recap and Explore.
- Today:
  - `practice/nextTask.ts` `heroCarriesReview`;
  - `practice/NextTaskCard.tsx`: the held hero's Review as a `LipTile`, and `onHeroReview` up to the hero's owner;
  - `home/todayView.ts` `todayStops({ …, heroReview })`;
  - `tabs/HomeTab.tsx` keeps the answer.
- `dev/OnboardingPreview.tsx`: the `quiet-toast`, `quiet-phrasebook` and `quiet-speak` previews, following the device's mode.
- `dev/TodayPreview.tsx`: `today-held` and `today-held-starter` follow the rule.

## Screens and states

1. **Phrasebook, nothing kept:**
   - Light and dark: Cloud's limbs, the book outline and the words follow the theme.
   - 320x640: the moment is centred, with Choose a scene in the foot.
2. **Speak, out of the free conversation:** shown only on the free plan with nothing left. The words come from the plan band, with "Your phrases are all still here.".
3. **Nothing to review** (Review and the drill bank): the posed cheer's arms show on the dark card.
4. **Today, held:**
   - Out of time or lapsed, past Starter, with Review due and no starter or café card under the words: the hero carries Review and the path has no Review row.
   - With the starter card or the café line, or with nothing due: the path keeps its own row when Review deals cards.
   - The fix hero always leaves the row.
   - While the hero decides, the row waits, so Review never shows twice and never flashes.
5. **Toast:** Toast's face on the ink pill. It blocks nothing and stays still while a mic is open. In dark mode the ink pill (`paper.ink`, older than this branch) nearly vanishes on the dark ground, about 1.03:1; see Not done.

## Assumptions

1. Only `hold` and `rest` are new. Wave, Toast's poses and the hello tilt still have no caller.
2. The centre-stage title is the existing `bType.title26` (26/31), the board's 28/32 being nearest to `bType.bandTitle` (28/31); 26 was chosen for the empty-state title, and the size is put to the founder (push-check proposal).
3. The toast keeps "Saved to your phrasebook.". The board's "First phrase saved." would be wrong after the first save.
4. On a cold open of Today, the path's Review row waits until the hero has answered, which takes up to the billing read's 5 s timeout when the server is slow (never offline, where billing is not read). The hero shows its loading line meanwhile, so the row arrives late rather than showing and then vanishing (push-check, accepted). When Today regains focus, NextTaskCard reloads billing. For a learner whose hero carries Review, Review is hidden for that moment rather than shown twice. The path keeps the last answer through that reload, so if the learner's minutes ran out between visits, the row can go once the hero answers; that is real data changing between visits. A hero that unmounts (the fix hero taking over) reports `null`, so the next hero starts undecided (fix-verifier round 1).

## Blast radius

- `EmptyStateCard`: every caller compiles unchanged. Only the two nothing-to-review cards and the two stage moments use the new props.
- `Cloud`: listen and cheer draw as before (their front limbs and marks do not overlap). The repo-wide test still requires `ink` on every posed Cloud and `accent` on listen.
- The toast shows on every screen that saves a phrase.
- Today's path: the Review row's rule is shared with the hero.

## Not done

- **The plans lead (free plan, out of the conversation) also shows Review twice:** a secondary pill under the sun card, and the path row. It was left unchanged as out of scope; it is a candidate follow-up for the founder.
- **Other empty states** (conversation and memory pages, tutor offline) keep their cards, by the founder's choice.
- **The toast pill in dark mode** (out of scope, older code; Impeccable, push-check): `paper.ink` on the dark ground is about 1.03:1, so only the words and Toast's face show. `CelebrationHost` mounts outside `MainAppearanceProvider` (it covers onboarding too), so the toast cannot read the screen's mode with `useB()`; the fix needs a decision on how the toast learns the mode. A follow-up for the founder.
- **Briefs 2 (2B) and 3 (3A)** come after the Journey board.

## Tasks in dependency order

| ID | Outcome | Owner | Depends on | Status |
|---|---|---|---|---|
| T1 | Poses, tones, figure and stage, the toast face | design-system-engineer | none | built (3273b24b) |
| T2 | The four screens and the previews | frontend-engineer | T1 | built (10943625, 99fa28ea) |
| T3 | Docs | orchestrator | T2 | built |
| T4 | Verification, `/push-check`, landing | orchestrator | T3 | push-checked; landing |

## Verification

- Focused checks: every new test was seen failing first.
  - T1: `mascotPoses`, `emptyStates`, `wiring`.
  - T2: `todayPath`, `todayPreview`, `empty/emptyStates`, `emptyStates`, `DrillScreen`, `PhrasebookScreen`.
  - The full mobile suite after T2: 4,111 passing.
- Web shots in `artifacts/quiet-moments-2026-11/`, at 320 and 375, light and dark, with no console errors:
  - `quiet-phrasebook`, `quiet-speak` and `quiet-toast`;
  - `today-held` and `today-held-starter`;
  - `drill-review-empty`;
  - `drill-end`, which is unchanged.
- Full gate: green on 2026-11-04, 7,576 tests, mobile 4112. Floors raised with `gate:bless`, and the gate
  recorded in `docs/IMPLEMENTATION_EVIDENCE.md`.
- iPhone 13 mini simulator:
  - the phrasebook in light and dark, and at accessibility-large (the words scroll under the pinned Choose
    a scene);
  - Speak in dark.
  The dark check found hold's arms vanishing in cream ink, fixed test first.
- Fix-verifier: round 1 refuted a stale Review answer across hero changes, fixed test first; round 2
  HOLDS.
- Push-check:
  - push-reviewers (frontend, tests) and `/code-review` at high effort;
  - the Review rule covered on every lead, and Today's undecided start pinned (each shown failing on a
    mutation);
  - the Impeccable reviewer (Opus, high): rest's stray legs fixed, the phrasebook preview drawing the
    real header, the title-size reason corrected;
  - the toast pill's dark contrast written up as older code (Not done);
  - four redesign proposals logged and asked.
- Not verified: Android; a real phrase save on device (the toast is shown through its still preview).
