# The systemic pass

- Status: built on `claude/systemic`; landing after the founder's OK on the after shots
- Updated: 2026-11-17
- Checkout / starting revision: `Luvani-worktrees/systemic`, cut at `c986b4eb`
- Owner / integrator: the systemic pass orchestrator session
- Existing programme / contract: `/forge` contract `.forge/systemic-pass/contract.md`
  (design-architect, 2026-11-16), brief `handoffs/2026-11-10-systemic-pass-brief.md`
  (outside the repo), screen queue 5 in [DESIGN_PARTNERSHIP.md](../DESIGN_PARTNERSHIP.md)

## Outcome and scope

The same kind of tap (a primary, a choice, a quiet action, a row) looked and pressed
four different ways, so each screen's one focal point competed with kickers, second
headlines and stray button styles. The pass fixes that once, in the shared parts:
one radius rule, two card parts, one quiet action, eyebrows folded into headings or
meta lines, and the type scale named by role.

- Existing seam: `theme.ts` `radius` and the nesting expression in `TabBar`; the lip
  drawn as a View in `PillButton` and `LipTile`; `scripts/unslop-scan.mjs` with its
  baseline; `fitDisplay` and the pure rules in `home/skyView.ts`; `onHeroReview`;
  `OfflineLeadBody`; `PREVIEWS` in `dev/OnboardingPreview.tsx`.
- Context: [DESIGN.md](../../DESIGN.md) (Radius rule, Type roles, Parts, Today in
  Composition rules), [DECISIONS.md](../../DECISIONS.md) UI-021 and UI-023.
- Non-goals: onboarding page layouts and their literal radii and bands; the tab bar
  (`nav/LuvaniTabBar.tsx`, `TabPill.tsx`, `TabGlyph.tsx`) and its DESIGN.md section;
  eyebrows on Journey, Speak, Practice, Recap, Profile, the answer sheet and the fix
  sheet; moving `BButton` callers outside Today's hero; the wall's own CTA; a
  mechanical check that no `LipTile` sits in any `Card` app-wide; F952; any server,
  wire, price, migration or dependency change.
- Risks / unresolved choices: bands and sheets shrink to 20 (Streak 40 to 20, Scene
  preview and My French 36 to 20, live sheets 32 to 20, the drill stage 28 to 20),
  judged at the after shots; `borderCurve` is gated to iOS because web is unverified;
  `fitTitle` uses an estimated 0.56 em per character, so the 320 shots are its proof.
- Decisions: [UI-023](../../DECISIONS.md) (board
  https://claude.ai/artifact/5ckVkiWUqifAc9pq31pbd9).
- Defects: F990 to F999 filed by the pass; F954 and F957 fixed by it.

## The founder's picks (2026-11-16, all eight as recommended)

1. **Radius and press, app-wide.** Card 20, tile 18, field 14, pill; the feature
   radius folds into card. Continuous corners on iOS. A 3pt lip under every ink
   primary.
2. **BoldChoice folds into Choice**, which draws the raised tile everywhere
   (revisiting D7). **BoldButton stays** as the named wake-glint alias of
   `PillButton`.
3. **Two card parts.** `Card` groups: flat, never nested, never holding a
   `LipTile`. `LipTile` is anything pressed as a game button, choice, answer or
   stat. `ColourCard` is the one colour surface.
4. **One quiet action.** Rows open with a chevron; at most one underlined word under
   a primary; `OutlineButton` folds into `GhostButton`.
5. **Eyebrows** retire on Today, every drill stage and the shared parts; the rest go
   with each screen's redesign; the scan stops the count rising.
6. **Every literal radius** outside onboarding and the tab bar moves to the scale.
7. **Type roles** named; the greeting fits its column (F957).
8. **All four queued Today rows:** held at Starter, hero secondaries on a pastel,
   the hero loading in one look, the 320 hero title through `fitTitle`.

Contract approval, 2026-11-17: Today's hero buttons move from `BButton` to
`PillButton` (yes); bands follow the rule to 20, judged at the after shots (yes).

## What was built, per step

| Step | Owner | Commit | What it built |
|---|---|---|---|
| 1 | design-system-engineer | `d6755c10` | `radius` scale (pill 999, card 20, tile 18, field 14, inset 12, mark 8, nib 4) with `feature`, `stat` and `row` as deprecated aliases; `continuous` and `corner`; `role` (display, screenTitle, greeting, stageTitle, section, cardHeading, frenchLead, body, meta, label); `lip` in `palette.ts` and `lipPaper`, `lipBlue` in both B themes, with four lip rows added to DESIGN.md's B tables for `palette.test` |
| 3 | design-system-engineer | `d6755c10` | The unslop scan stops counting a zero radius and gains the `eyebrow` rule; baseline regenerated |
| 2 | design-system-engineer | `3254fac3` | Card, ColourCard, Sheet panel, Ledger and LipTile take `corner`; `PillButton`'s lip defaults on for the ink primary at 3pt; `Choice` draws the raised tile with a `checkbox` role; `fitTitle`; the part's own literals to the scale |
| 4 | frontend-engineer | `0231a334` | Today: no eyebrows, `sceneHeroLine`, rows end in a chevron with no action (F954), the held hero on the paper, held at Starter through `phraseRow` and `onHeroCafe`, tutor unreachable through `OfflineLeadBody` with one Check again, one loading look, `PillButton` heroes, the pastel Review secondary, `fitTitle`, `greetingMaxScale` (F957); `greetingSubline` deleted; a `live-error` preview key |
| 5 | frontend-engineer | `0231a334` | The radius sweep and `OutlineButton` callers in the tabs and main screens; `radiusSweep.test.ts` |
| 6 | practice-ux-engineer | `0231a334` | `DrillFrame` loses `eyebrow`; `taskLine` puts the task on the meta line; Listen and type takes the tag as its header prompt; Sound check and the focus drill drop their labels; Review and the drill bank's nothing-to-review cards on butter; the empty phrasebook keeps one headline; the centre stage title is `bandTitle` 28; the sweep in practice, recap, conversation packs and My French |
| 7 | onboarding-ux-engineer | `0231a334` | Six `BoldChoice` uses become `Choice` (the interests list as `role="checkbox"`); `BoldChoice.tsx` deleted; the sweep in `auth/` and `AccountDeletedNotice`'s `OutlineButton` |
| 8 | design-system-engineer | pending | Delete `OutlineButton`, the deprecated aliases and `MorphButton`; delete the dead card and button exports; the GhostButton link list; final baseline |
| 9 | design-system-engineer | uncommitted | DESIGN.md, DECISIONS.md UI-023, DESIGN_PARTNERSHIP.md rows and taste log, this file |

## Deviations from the contract (round log)

- **Choice's unchosen ring is `field`, not the 2pt `line`.** F921 (`controls.test`)
  requires an unchosen option's ring at 3:1, and `line` is a 1.24:1 hairline. The
  orchestrator also restored Choice's paper face on a white card, which the builder
  had dropped, so a choice never matches its ground. F992's note should read "the
  field ring".
- **Role sizes where the contract was silent:** screenTitle `type.title` 34, section
  `bType.section21`, frenchLead `type.frenchLg` 28.
- **Google and Apple buttons keep `radius.pill`** (actions are pills), though rule 2's
  surface exception would have made them cards.
- **Review's tag** moved to its meta line as well, since `DrillFrame` lost the prop.
- **F995's tests are two:** `the drill stages draw no eyebrow` (step 6) and `Today
  and the drill stages draw no eyebrow` in `home/todaySkyParts.test.ts` (step 4).
  F995 should name both.
- **Left for step 8 by steps 5 and 7:** `icons/ghostLinks.json` and the GhostButton
  ceiling of 60 in `icons/callSites.test` must list the folded `OutlineButton`
  labels (they were already word-only quiet actions); `boldChoiceTone` in
  `onboarding/boldChoices.ts` has no caller; `AccountField`'s Show button corner;
  `HomeTab.test` pins QuestsCard's old literal and needs `...corner.card`.
- **For the orchestrator after step 4:** delete the `PHRASEBOOK_TITLE` header in
  `dev/OnboardingPreview.tsx`'s `quiet-phrasebook` branch.
- `TutorMemoryScreen`'s "OutlineButton" is `SettingsFormAction` under an alias and
  stays.

## Radius sites that were not mechanical

As the builders listed them in the round log:

- **Pill by role, not by rule 2:** TutorTab's Speak or Type segment and its cells;
  the wall's CTA; the Google and Apple buttons.
- **Card, by the founder's answer:** every band and sheet (the Streak band, the Scene
  preview and My French bands, the live sheets, the drill stage, the answer sheet,
  Sound check's sheet).
- **Card as surfaces:** `PracticeParts` `ready` and `savedBox`.
- **Field:** `RecapParts` `nextPill`.
- **Nib:** bubble tails. **Pill:** tracks and dots.
- **Halo, the reverse of nesting:** `drill/kinds/styles.ts` `landedHalo` and
  `landedPress` at `radius.inset + 5` (the old 17).
- **Nesting:** `wall/WallPeriodSwitch.tsx` segment at
  `Math.max(radius.nib, radius.card - space(1))`; `TabBar` keeps `radius.field - 3`;
  `AccountField`'s Show button was `radius.field - 4`, and by the nesting rule it is
  `radius.inset - 3` (step 8).

## Counts

`apps/mobile/src`, tests excluded, by the brief's method. Rows 1 and 3 to 6 come from
the counting script (`git grep` on the revision); eyebrows are `git grep -o -P
'\.eyebrow\w*'` plus `git grep -o -P 'eyebrow[=:]'`; choice parts are the exported
components that draw a choice (`Choice`, `BoldChoice`). The pass set no number to
reach except F999's: Card/Tile/Hero 60 or fewer, Button/Pill 21.

| Count | Before (`c986b4eb`) | After |
|---|---|---|
| Literal `borderRadius: <digit>` lines | 241 | pending step 8 |
| Eyebrow uses | 73 (27 + 46) | pending step 8 |
| Exported `*Card`, `*Tile`, `*Hero` | 65 | pending step 8 |
| Exported `*Button`, `*Pill` | 23 | pending step 8 |
| Exported `*Row` | 32 | pending step 8 |
| Files mentioning `ScrollScreen` | 66 | pending step 8 |
| Choice components | 2 | pending step 8 |

## Execution log

| Date / task | Attempt and changed paths | Check / result | Next action or blocker |
|---|---|---|---|
| 2026-11-17 / steps 1 to 7 | See the table above and the round log | Recorded in the contract's round log | Step 8 |
| 2026-11-17 / step 9 | `DESIGN.md`, `DECISIONS.md`, `docs/DESIGN_PARTNERSHIP.md`, this file | Docs only; no test run | Orchestrator fills the after counts once step 8 is committed, then runs the gate |

## Integrated verification and handoff

- Focused checks: not run by step 9.
- Full gate: not run by step 9.
- UI / hosted / device / paid checks: web shots at 375 and 320, light and dark, of
  every Today preview, one drill per family, `quiet-phrasebook`, Review empty,
  sign-in, `reason`, `plan` and `live-error`: not yet recorded here.
- Documentation and decisions: DESIGN.md, DECISIONS.md UI-023, DESIGN_PARTNERSHIP.md.
- Landing disposition: HOLD until step 8, the gate, push-check and the founder's OK
  on the after shots.
- Next task: step 8, then the after counts.
