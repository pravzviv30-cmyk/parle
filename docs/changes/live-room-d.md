# Live room, direction D: face to face with a notebook

- Status: in progress, approved direction (UI-014); build on `claude/live-room-d`
- Updated: 2026-10-29
- Checkout / starting revision: build from `main` at or after `d82fc957`, the Stream E merge (composer colours, tutor portraits in `LiveOrb` F945, the role line). Branch `claude/live-room-d`.
- Owner / integrator: Opus orchestrator session; builders as named per task
- Existing programme / contract: [DESIGN_PARTNERSHIP.md](../DESIGN_PARTNERSHIP.md) (screen 1); decision [UI-014](../../DECISIONS.md) (main's UI-013 is Stream E's); direction board <https://claude.ai/artifact/6GWKSY3gHZsoRKhtU63A5B> (boards "D · Face to face + notebook" and "D · Dark mode")

## Outcome and scope

Today the live room reads as a chat log: a white transcript slab on blue, three text toggles under the header and a small portrait that moves by 4%. After this change the room has one focal point:
- **Émilie, alive at the top.** The voice rings come from her portrait and move with the real sound level.
- **Her newest line, large.** It sits at the foot of a notebook sheet that grows upward as the scene goes on.
- **The learner's own lines,** marked in sun.
- **Small fixes in the margin,** brought by the toast.
- **A cloud mic** that listens.
- **Goals as stamps** under the title.

Words that repeat what the picture already says are gone. Every capability stays.

| Removed | Why it can go | Where its job went |
|---|---|---|
| The orb caption ("Émilie is speaking") as visible text | The ring colour says who is talking: sun for the tutor, mint for the learner | Still spoken: a live region that is not drawn |
| The Hide transcript / Quiet voice / Tap to send text row | Three toggles crowding the header | The room menu (`…`) |
| The report flag disc in the top bar | A second disc next to Leave | The room menu, with a dot on `…` when a report is saved |
| The English under older lines | Only the newest line needs a gloss | Kept on the newest tutor line; older lines show French only |
| The long goal sentence in the strip | Too many words above the focal point | The current goal's label next to the stamps (see T2 for the short label) |
| The white bubbles and the separate full transcript | The notebook is both | One notebook, with a "newest only" mode for `transcriptVisible = false` |

**Existing seams:**
- `live/C2LiveRoom.tsx` is presentation only. Its owners pass every action: `ConvoScreen.tsx`, `LiveSessionScreen.tsx`, `onboarding/FirstLivePractice.tsx`, and the dev preview in `dev/OnboardingPreview.tsx`.
- The parts are in `live/LiveParts.tsx`. The rules are in `live/liveRoomView.ts`.
- Lines come from `live/turns.ts` (`TurnLine`, with `recasts` on learner lines).
- The portrait is `tutor/TutorPortrait.tsx`. Live levels come from `useOrbAudio` and `orbLayers`, through `tutor/OrbPulse.tsx`.
- Motion uses `motion/tokens.ts` (`SPRING`, `DUR`, `LEVEL_RING`) and the `motion/` primitives.
- Tokens come from `useB()` (`main/bTheme.tsx`). Every hex lives in `palette.ts`.

**Context:**
- `DESIGN.md`: Inside a conversation, Motion, Dark mode.
- `docs/LIVE_VOICE.md`.
- `DECISIONS.md`: UI-008, UI-010, VOICE-011, VOICE-018 and VOICE-019, which define the room's controls and notes.

**Non-goals:**
- No change to `useLiveSession`, the session state machine, the help ladder rules, tap-to-send timing, recasts or scoring.
- No change to the waiting, error, safety-stop, recap or end-card surfaces.
- No new dependency and no Rive.
- No change to `WalkRoom` or `TutorIntro` (they use `VoiceOrb`).

**Risks / unresolved choices:**
1. **Short goal labels.** The room's goals are brain frame beats (`packages/brain/src/missions/frames.ts`, 144 tasks across 31 missions); the client keeps only `id`, `goalEn` and `achieved` (`packages/core/src/missions/tasks.ts` `readMissionTasks`). D shows "Order a coffee" for "Say hello and order a coffee". T2 adds a core-only lookup keyed `missionId:beatId` with a fallback to `goalEn`, so there is no wire change or agent redeploy. The founder approves all 144 labels before the build lands (founder, 2026-10-30).
2. **Motion rule.** `DESIGN.md` "What never moves" allows only the orb, goal ticks, arriving lines and the scene card to move in a live room. D adds the cloud mic's listening squish and a cheer on a goal. UI-014 amends the rule; `DESIGN.md` must change with T6.
3. **Mascot art.** No toast-only drawing exists today (it appears only with the cloud in `friends-cheer`). The prototype mascots were sketches. T1 builds them from the existing B-art drawings in the same hand, and their colours become palette tokens.
4. **Stream E** landed on main at `d82fc957` (2026-10-30).

**Decisions:** UI-014 (this direction; motion rule amendment; report and toggles move to the room menu).

**Defects:** none filed. If the orchestrator files ledger entries for traceability, they go in `docs/KNOWN_ISSUES.md` with named tests.

## Screens and states

The room fills the screen on the brand blue in both themes. That rule is UI-008's and is unchanged.

**Top to bottom:**
1. **Top bar.**
   - Leave: a 44pt `violetDeep` disc with `onBrand` ×.
   - The scene title in `bold17` `onBrand`, with the pace ("About 3 min") in `meta` `onBrandSoft` under it.
   - The room menu: a 44pt `violetDeep` disc with three `onBrand` dots. It gets a 10pt `sun` dot when a report is saved.
2. **Goal stamps.** Centred, 6pt apart, then the current goal's label in `bold14` `onBrand`.
   - Each stamp is 26pt.
   - Done: a `mint` disc with an `onMint` tick.
   - Current: a `sun` disc with the number in `onSun`.
   - To do: a 2pt `onBrandSoft` ring with the number in `onBrandSoft` (6.2:1 on blue). The prototype's lilac ring was 2.2:1 and is not used.
   - The whole row is one accessible element saying "1 of 3 goals done. Now: say whether it is for here or to go."
   - The existing once-only announcement of a newly reached goal (`tickAnnouncement`) is kept.
3. **Portrait stage.** It takes the space left between the stamps and the sheet (`flex: 1`, at least 168pt) and is centred in it.
   - `TutorPortrait` at 112pt (72pt while typing or with the keyboard open) with the existing `PORTRAIT_RING` (2pt).
   - The ring is `sun` while the tutor speaks or thinks, and `mint` while the learner's turn is open.
   - Two level rings driven by the real level: output while the tutor speaks, input while listening. Use the `LevelRing` primitive as it is (`LEVEL_RING.grow` 0.22), not a timed loop and not a new token. Who is talking comes from `useOrbAudio()` `outputLive` and `inputLive`, so it still shows under reduced motion.
   - Thinking: one dashed 3pt `sun` ring turning once per 2.4 s.
   - The portrait breathes (1.0 to 1.035) only while the tutor speaks.
   - The tutor's name sits under the portrait in `bold15` `onBrand`.
4. **Notebook sheet.**
   - The theme `ground`, top radius 28, natural height up to 62% of the column. It scrolls inside past that, pinned to the newest line.
   - Content sits at the foot, above the dock, so an empty scene shows only its first lines and the blue space holds the portrait.
   - The sheet's height animates with `Reflow` as lines arrive.
   - **Narration:** `meta` `muted`, centred, shown once at the top of the script.
   - **The newest tutor line:** `frenchLg` (`fitDisplay()` 28/24/20) in `text`, with the English under it in `body` `muted` and a 44pt hear button (`onReplayTutor`). It arrives with `BubbleIn`.
   - **Older tutor lines:** `french` 17/23 (the `frenchSm` size at SemiBold) in `muted`, French only.
   - **Learner lines:** right-aligned. The newest is at `french` size; older ones at 17. The words are `onSun` on a `sun` mark, radius 6, padding 1/6. The partial transcript shows with a blinking caret while the learner's turn is open.
   - **Margin fix (each `recast` on a learner line):** right-aligned under its line, max 310pt.
     - A note on `lavender` (light `#E9E3FA`, dark `#322B50`), radius 16 with a 5pt tail corner. It shows the `better` French in bold plus the short reason, in `text` (light 14.2:1, dark 12.3:1).
     - The toast mascot sits beside it at 34x41, decorative.
     - The note keeps `recastLabel()` as its spoken prefix ("Small fix, ...").
     - Tapping the note opens the existing correction detail if one exists; otherwise it is not a control.
   - **Newest only** (`transcriptVisible = false`): only the newest tutor line and the learner's current or last line show.
   - **Full script** (`transcriptVisible = true`): everything shows, and Quiet voice still turns it on.
5. **Dock**, over the sheet on the same `ground`, laid out as space-between with 28pt sides:
   - **Left:** Type (Speak while typing), 56pt `card` disc with a 24pt `text` glyph and a `meta` label.
   - **Centre:** the cloud mic (see below).
   - **Right:** Help.
   - The room note sits above the dock as one line in `note` `muted`, only when `roomNote()` returns a line: the wrap-up, typing, tap-to-send or Quiet voice note. Nothing replaces the old caption.
   - The Tap to send pill (`sendButton`) keeps its mint 54pt pill above the dock when on.
6. **Cloud mic.**
   - The cloud mascot at 116x88 inside a 44pt-minimum hit area. White body, a 2.5pt `ink` outline (16.6:1 on light paper; on dark the white body itself is 18.4:1), sage underside and cheeks.
   - Label under it in `semi13` (the side controls' label style): "Listening" or "Paused". Accessibility labels are unchanged: "Pause microphone" / "Open microphone".
   - Expressions come from one pure rule (T2):
     - **Paused:** eyes closed, flat mouth.
     - **Listening:** eyes up and wide; the body squishes with the input level (scale X 1 to 1.07, Y 1 to 0.9, from `audio.input`, `SPRING.settle`); a `mint` 72pt ring behind it pulses with the level.
     - **Tutor speaking:** eyes look up toward the portrait, mouth closed, no squish.
     - **Thinking:** eyes up, small smile.
     - **Goal reached:** one cheer of two hops on `SPRING.pop`, within `CELEBRATION_MAX_MS`, then back to its state.
   - Disabled (`modePending`): the existing 0.55 opacity.
   - In typing mode the cloud is not drawn. The composer card sits above the dock as today, and the centre slot keeps its space.
7. **Room menu sheet** (from `…`), using the existing `HelpSheet` frame on `ground`:
   - Words: "Show every line" / "Newest line only" (`transcriptVisible`).
   - Quiet voice: On or Off, with its existing hint.
   - Tap to send: On or Off, Speak only, with its existing hint.
   - "Report this reply": opens `RoomReportSheet` in the same layer, as today.
   - Each row is a 56pt `SettingsRow`-style switch or link with the existing labels and `accessibilityRole="switch"`.
8. **Help sheet.** Unchanged content and order: `AskedCard`, `HelpLadder`, support, more help, `SheetPrimary`, footnote, tools. One addition: the toast peeks over its top-right edge (54x60, rising 40pt on `SPRING.settle` with a 200 ms delay), decorative.

**Dark mode** (the "D · Dark mode" board). The room keeps `brand` blue in both themes. Only the sheets and dock follow the theme. Every value comes from `useB()`.

| Element | Light | Dark | Contrast |
|---|---|---|---|
| Room ground, top bar, stamps, portrait, name | `brand` `#3B2FE0` | same | `onBrand` 7.9:1, `onBrandSoft` 6.2:1 |
| Notebook, dock, Help and room menu sheets | `ground` `#FFF6E9` | `ground` `#151127` | sheet edge on blue 7.4:1 / 2.3:1 (decorative) |
| French lines, labels | `text` `#16123A` | `text` `#FFF6E9` | 16.6:1 / 17.2:1 |
| English, older lines, narration, notes | `muted` `#5C5A74` | `muted` `#C6BED8` | 6.2:1 / 10.3:1 |
| Learner line mark | `sun` with `onSun` | same | 11.6:1 |
| Margin fix note | `lavender` `#E9E3FA` + `text` | `lavender` `#322B50` + `text` | 14.2:1 / 12.3:1 |
| Type and Help discs | `card` `#FFFFFF` | `card` `#25203D` | disc 1.1:1 / 1.2:1 on the sheet (decorative); the glyph and label identify the control: 17.8:1 / 14.5:1 |
| Cloud mic body / outline | white / `ink` | white / `ink` | outline 16.6:1 on light; body 18.4:1 on dark |
| Status bar | light content | light content | on blue in both |

The scrim behind sheets is the theme `scrim` at 0.4 opacity. Add a contrast test for every new pair to `palette.test.ts` (T1).

**Reduced motion** (watched live through `useReduceMotion`):
- No level-ring scale: the rings show three opacity steps, as `LevelRing` already does.
- No breathe, no squish, no cheer and no peek. Expressions still change, because a face is not motion.
- The thinking ring is static and dashed.
- New lines appear at their final frame. The sheet height jumps.

**Large text:**
- Lines wrap and never clip.
- At the largest sizes the portrait shrinks to 72pt and the sheet may take up to 75% of the column.
- Dock labels may wrap to two lines. Targets stay at least 44pt.

**Screen readers:**
- Reading order: top bar, goals, portrait (its name plus the spoken state, a live region with the old caption text), the notebook from oldest to newest, the room note, then the dock.
- Each margin fix reads after its line.
- The cloud mic reads as a button with the existing labels.

**Keyboard and web:**
- `controlsVisible` (`liveRoomControlsVisible`) still hides the dock while the keyboard is open.
- Enter submits as today (`enterSubmits`).
- Every control in the room menu is reachable by Tab, with the Stream E focus ring.

**Owners and states untouched:** waiting, connecting, error, out of minutes, safety stop, recap and end card.

## Tasks in dependency order

| ID | Outcome | Owner | Depends on | Allowed files | Status |
|---|---|---|---|---|---|
| T0 | Branch from `main` with Stream E landed; `npm ci`; baseline web and native shots of the four live previews | orchestrator | Stream E landed | none (shots to `reviews/` or the scratchpad) | todo |
| T1 | Mascot parts and tokens: cloud and toast as react-native-svg components with expression props; mascot colours in `palette.ts` with contrast tests | `design-system-engineer` | T0 | `apps/mobile/src/palette.ts`, `palette.test.ts`, `apps/mobile/src/art/mascots/*` (new), `DESIGN.md` Colour and Illustrations | todo |
| T2 | Room rules: notebook lines, goal stamps with short labels, cloud expression, ring mode, room menu rows | `frontend-engineer` | T0 | `apps/mobile/src/live/liveRoomView.ts`, `liveRoomView.test.ts`, `apps/mobile/src/live/notebookView.ts` (new), `packages/core/src/missions/shortGoals.ts` (new, ships empty) and where the client builds mission tasks, `apps/mobile/src/live/c2TranscriptPolicy.ts` if needed | todo |
| T3 | Room parts: `GoalStamps`, `PortraitStage`, `NotebookSheet`, `NotebookLine`, `MarginFix`, `CloudMic`, `RoomMenu` | `frontend-engineer` | T1, T2 | `apps/mobile/src/live/LiveParts.tsx` (or a new `live/NotebookParts.tsx`) | todo |
| T4 | Compose D in `C2LiveRoom` with every existing prop and behaviour kept; remove the old link row, bubbles and caption text | `frontend-engineer` | T3 | `apps/mobile/src/live/C2LiveRoom.tsx`, the dev preview in `dev/OnboardingPreview.tsx` | todo |
| T5 | Short goal labels for the 31 missions, for founder copy review | content (orchestrator drafts) | T2 | mission data in `packages/core` | todo |
| T6 | Docs: `DESIGN.md` "Inside a conversation", the live room bullet in Composition rules, "What never moves", Dark mode; this plan's log | orchestrator | T4 | `DESIGN.md`, `docs/changes/live-room-d.md`, `docs/DESIGN_PARTNERSHIP.md` | todo |
| T7 | Verification: tests, gate, web and native shots, live replay, fix-verifier round, founder review | orchestrator | T4, T6 | none | todo |

### T0. Start from Stream E

Confirm `git log main` contains Stream E's merge. Create `Luvani-worktrees/live-room-d` from it and run `npm ci`. Capture before shots:
- **Web:** `npm run shots -- --url 'http://localhost:<port>/?preview=live-speaking' --name before-live-speaking --views phone,small --schemes light,dark`. Repeat for `live-typing`, `live-tap-to-send` and `live-wrap-up`.
- **Native:** the same previews on the iPhone 17 Pro dev client via `xcrun simctl io <udid> screenshot`.

Acceptance:
- Eight web PNGs and four native PNGs exist and show the current room, not a splash.

### T1. Mascot parts and tokens

**Steps:**
1. Build `art/mascots/Cloud.tsx` and `art/mascots/Toast.tsx` from the cloud and toast in `assets/b-art/svg/cloud-cheer.svg` and `friends-cheer.svg`. Keep the same hand; do not redraw a new style.
2. Each takes `expression: 'paused' | 'listening' | 'tutor' | 'thinking' | 'cheer'`, `size`, and for the cloud `outline: boolean`.
3. Body parts stay static paths. Only the eyes and mouth change by expression.
4. Animation lives in the wrappers (T3), never in the drawing. This follows the rule "the flat drawings themselves do not move".
5. Add a `mascot` group to `palette.ts`: the cloud body, underside and cheek; the toast crust and face. Add each new pair to the contrast contract.
6. Update `DESIGN.md`'s palette tables so `palette.test.ts` stays in step.

Acceptance:
- `palette.test.ts` passes with the new tokens and pairs.
- `git grep -nE "#[0-9A-Fa-f]{6}" apps/mobile/src/art/mascots` finds nothing.

### T2. Room rules (pure, tested)

Add to `liveRoomView.ts`:
- **`notebookLines(turns, partial, mode)`:** returns `{ kind: 'narration' | 'tutor' | 'learner'; fr; en | null; emphasis: 'newest' | 'older'; recasts }[]`. Only the newest tutor line keeps `en`. `mode = 'newest'` keeps only the newest tutor line and the learner's current or last line. Topic lines (`topic: true`) stay out of the scene, as in F905.
- **`goalStamps(goals)`:** returns the stamps, the current label (the short-goal lookup, else `goalEn`) and the spoken summary. It reuses the existing `goalStrip()` states.
- **`cloudExpression({ micOpen, tutorSpeaking, thinking, typing, goalJustReached, modePending })`:** returns the expression or `null` while typing.
- **`ringMode(state)`:** returns `'tutor' | 'learner' | 'thinking' | 'idle'` from the `OrbState` the room already receives.
- **`roomMenuRows(...)`:** the rows and their labels, built from `quietVoiceControl` and `tapToSendControl` plus the transcript and report rows.
- **Short labels:** `packages/core/src/missions/shortGoals.ts`, a lookup keyed `missionId:beatId` that ships empty, with a fallback to `goalEn`. A test pins the fallback. The approved table fills it in T5.

Acceptance:
- `cd apps/mobile && npm test` includes new tests for each function. These cover the newest and older emphasis, the English kept only on the newest tutor line, the newest-only mode, every cloud expression branch, the stamp states and spoken summary, and the label fallback.
- The mobile floor is raised by the new count.

### T3. Room parts

Build the parts named in the table. Use `useB()` and `useThemedStyles` for every colour; there are no literal hexes and no off-scale radii. Allowed radii: 28 for the sheet, 16 for the fix note, 6 for the mark, and full circles.

**Motion:**
- `LevelRing` for the voice rings.
- `Reflow` for the sheet height.
- `BubbleIn` for arriving lines.
- `SPRING.settle` for the squish level and the peek; `SPRING.pop` for the cheer and the stamp fill.
- Every one of them goes through `motion/drive.ts` with `useReduceMotion()`.

**Accessibility:**
- Mascots carry the `decorative` props.
- Each fix note is read with its line.

Acceptance:
- Typecheck passes.
- The dev preview renders each part in light and dark (T4's preview).
- No hex or `rgba(` outside `palette.ts`; the existing `palette.test.ts` guard proves it.

### T4. Compose D

Rebuild `C2LiveRoom`'s return to the structure in "Screens and states".

**Keep exactly:**
- Its props.
- The keyboard handling and `submit`.
- The report state and its sheet layer.
- `helpOpen` and the report exclusion.
- `sayChoice`, `sendTurn` and `roomNote`.

**Remove:**
- The link row (it moves to the room menu).
- The bubbles path.
- The visible caption. The caption stays as a spoken live region.

**Dev preview:** wrap `LiveRoomPreview` in `ModeScope` so `?theme=dark` reaches it (today `App.tsx` pins the preview light), and pass `voice`, `goals`, `title`, `pace`, `report`, recasts, `onReplayTutor` and `support` so every part shows.

Acceptance:
- Existing room tests still pass unchanged. A test that asserted the removed link row is rewritten to assert the same behaviour through the room menu, with that change named in the commit message.
- All three owners (`ConvoScreen`, `LiveSessionScreen`, `FirstLivePractice`) render the new room in the preview and in a live replay.

### T5. Short goal labels

Draft a short label for each of the 144 mission tasks (review file `docs/changes/live-room-d-goal-labels.md`), two to four words each ("Order a coffee", "Here or to go", "Pay"). Plain words, no em dashes. The founder reviews the list as a copy file before it merges; Jev's copy check is advisory.

Acceptance:
- Every mission task has a short label.
- A test in `packages/core` checks it is at most 24 characters and non-empty.
- The founder's OK is recorded in the log.

### T6. Docs

Rewrite the live room bullet in `DESIGN.md` Composition rules and the "Inside a conversation" section to D. Amend "What never moves": inside a live room, the portrait's rings, the cloud mic and the toast's peek also move, and nothing else. Add the dark rows to "Dark mode and the B tokens". Update `DESIGN_PARTNERSHIP.md` (queue state) and this log.

Acceptance:
- `npm run gate` passes, including the `DESIGN.md` palette contract.
- `npm run -s jev -- --ask "Is the live room section of DESIGN.md accurate after this diff?" --pass 0.5` on the diff is advisory.

### T7. Verification

- **Gate:** `npm run gate` green; floors blessed only for the new tests.
- **Web:** after shots for the four previews at phone and small, light and dark (16 PNGs) beside the T0 before shots.
- **Native:** the iPhone 17 Pro dev client for the same previews, plus:
  - Dynamic Type at `accessibility-large` (`xcrun simctl ui <udid> content_size accessibility-large`);
  - reduced motion on;
  - VoiceOver order spot check.
- **Live replay:** one real typed and one spoken café conversation on the local token server and tutor (the harness in `scripts/shots`, `lv.mjs` with a fake mic clip). Confirm:
  - recasts land in the margin;
  - goals stamp;
  - the cloud listens to real input;
  - Help, the room menu, report, Quiet voice, Tap to send and the wrap-up note all work.
- **Fix-verifier rounds until clean** (the founder's rule: prove before landing).
- **Founder review:** before and after shots side by side, then the founder's OK, then `/land`.

## Execution log

| Date / task | Attempt and changed paths | Check / result | Next action or blocker |
|---|---|---|---|
| 2026-10-29 / design | Directions A, B, C, then the founder's mix D and D in dark on the direction board; prototype fixes (rings, goal moment, hint per question, cloud outline, sheet growth, to-do stamp ring contrast, dark fix note) | Played through a full turn and Help in the browser, light and dark | T0 |

## Integrated verification and handoff

- Focused checks: not run (no code yet)
- Full gate: not run for this plan (branch `claude/design-partnership` gate green at 7,225 before this doc)
- UI / hosted / device / paid checks: prototypes only; native build and live replay are T7
- Documentation and decisions: this plan, UI-014, `DESIGN_PARTNERSHIP.md`
- Landing disposition: the plan lands with `claude/design-partnership` (docs only); the build lands separately after T7
- Next task: T0
