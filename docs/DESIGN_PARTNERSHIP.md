# Design partnership

How the founder and Claude improve Luvani's screens together, one screen at a time,
and what has been learned about the founder's taste. Started 2026-10-29.

`DESIGN.md` records what is built. `DECISIONS.md` records each approved direction as a
UI entry. This file holds the working method, the taste log and the screen queue, so a
new session can pick up the design work without asking again.

## Why this exists

The 2026-10-29 assessment found that many screens work but feel flat. The causes were
systemic, not one screen at a time:

1. The spec described inventories, not compositions. `DESIGN.md` lists each screen's
   content in order, with data rules, and never says what the screen is for or where
   the eye should land. So every screen became a stack.
2. Every tab shared one skeleton: `ScrollScreen`, `TabHeader` with the avatar, then
   five to eight cards.
3. Parts sprawled: about 65 card, tile and hero components, about 70 local card
   re-creations, 8 button types, 9 row types, three type scales, 260 literal radii.
4. Motion was well built but sat in the wrong places: the live tutor barely moved and
   every route used the same fade.
5. Reviews checked function and fidelity to an artboard, not quality, and only on web.
6. The direction came from AI-drawn canvases and the founder's taste was never written
   down.

## The method, per screen

1. **Brief.** Claude writes half a page: who the learner is here and how they feel,
   the one focal point, the primary action, what must stay (data, locks, flows), and
   what makes this screen unlike the others. The founder corrects it.
2. **Direction board.** Two or three genuinely different directions as interactive
   phone-size prototypes on a Design canvas, using the real palette, Outfit and motion
   timing, beside today's screen. References from Appllama are described with what to
   take and what to leave. The founder picks, mixes or says "more of / less of".
3. **Decision.** Recorded as a `DECISIONS.md` UI entry, plus a line in the taste log
   below.
4. **Build.** An implementer works in a worktree to an exact spec. A change to a shared
   part names its blast radius first.
5. **Inspect.** On the iOS simulator and on web, at 320 and 375 pt, light and dark,
   large text and reduced motion. Claude fixes the top defects in one pass and shows
   before and after. Anything not inspected is said to be unverified.
6. **Review together.** What works, what is still weak, what is unverified. The next
   screen waits for the founder's OK.

Every third screen, look for a weakness that keeps recurring and fix it once in the
shared parts instead of again on each screen.

### Brief template

```
Screen:
Who and how they feel:
The job of the screen (one sentence):
Focal point:
Primary action / secondary actions:
Must stay:
Unlike other screens because:
Today's problems (with screenshot):
```

### Inspection checklist

Hierarchy and focal point, composition (not a generic stack), type and spacing on the
tokens, colour pairs on the contrast contract, interaction feedback, motion purpose and
reduced motion, safe areas and keyboard, 44 pt targets and screen reader labels,
loading, empty, error and success states, and performance of any looping animation.

## Taste log

Each line is a preference with its source. One answer is not yet a rule; a preference
becomes a principle once it holds across two or more screens.

| Date | Preference | Source |
|---|---|---|
| 2026-10-29 | Deepen Bright Luvani: keep the paper, ink, Outfit and the four colours; add composition, focal points and fewer cards. Do not change the identity. | Founder, direction question |
| 2026-10-29 | The cloud and the toast become Luvani's mascots, with expressions and animation. | Founder, characters question |
| 2026-10-29 | Motion is alive where it matters (the live room, wins, moving between places); everything else stays calm and quick. | Founder, motion question |
| 2026-10-29 | The tutor's identity is their portrait (founder decision 25, F945). Mascots are companions and must never be mistaken for the tutor. | Stream E, decision 25 |
| 2026-10-29 | Live room: B (face to face) as the base, with C's visible script, margin fixes and cloud mic, and A's goal stamps. Not taken: A's stage, seated mascots and speech bubble, B's goal bar and mascot pop-up, C's highlighter. D still marks the learner's lines in sun so they stand apart from the tutor's. | Founder, mix question on the direction board |
| 2026-10-29 | Remove words and elements that distract, as long as no core feature is lost. | Founder, same answer |
| 2026-10-29 | Direction D accepted as drawn (including the sun mark on the learner's lines) when the founder asked for its build spec with dark mode. Recorded as UI-014 (main's UI-013 is Stream E's). | Founder, build spec request |
| 2026-10-31 | Drill and practice feedback: B (sheet and coins) picked, on every practice page, made more alive. | Founder, drill board |
| 2026-10-31 | Cloud appears at moments only: the right sheet, listening on speak drills, endings. Never on the question. | Founder, drill board |
| 2026-10-31 | One stage tint per drill family from existing tokens: Choose lavender, Build butter, Write sage, Speak peach, Review butter. | Founder, drill board |

Working principles drawn from these (to confirm on the first screens):

- Mascots appear at moments (welcome, the live room, wins, empty states, help), not on
  every card. Ordinary cards use place and object drawings.
- A screen is designed around one focal point first; content is arranged to serve it.
- A card is used to group related things, never as the default container.

## Screen queue

| Order | Screen | State |
|---|---|---|
| 1 | Live conversation room | Built on `claude/live-room-d` (UI-014, [changes/live-room-d.md](changes/live-room-d.md)): gate green at 7,319, two verifier rounds to HOLDS, live replay typed and spoken, native simulator checked; the founder approved the 144 short goal labels as drafted on 2026-10-31 and the room is landing on main |
| 2 | Today | Directions A (morning sky), B (the path is home, recommended) and C (one card) on the [Today board](https://claude.ai/artifact/8hQGYBiERChAzbtXjN82Dc); waiting for the founder's pick |
| 3 | Drill and practice feedback | B v2 picked and approved on the [drill board](https://claude.ai/artifact/XAZR2pptSi5YgH4ncZTXiK) (page "B v2, every surface"); building on `claude/drill-b` (UI-016, [changes/drill-b.md](changes/drill-b.md)) |
| 4 | Journey | Candidate |

Systemic fixes waiting for evidence from the first screens: one card system, a type
scale named by role, native sheet and modal presentation, and route transitions that
show where you went.

## Tools and how they are used

- **Figma** (claude.ai connector, signed in): read the canvas file
  `sjAwoGinWQKvhGrWbgMO18` and the B screens `M2K7xWepBhsLA0QAtXTjvx`. Writing to Figma
  only with the founder's OK, once a direction is chosen.
- **Appllama** (claude.ai connector, 1,500 credits a month): two to four targeted
  references per screen. Media links expire in an hour.
- **Impeccable**: a reviewer for critique and polish. Its detector reads web markup, so
  every suggestion is checked for React Native fit before use.
- **Design canvas** (Artifact): direction boards with interactive prototypes.
- **iOS simulator**: a dev client built with `npx expo run:ios` (needs a UTF-8 locale:
  `LANG=en_US.UTF-8`, or CocoaPods fails). The `luvani-metro-design` launch entry serves
  Metro on port 8097; open it with
  `exp+luvani://expo-development-client/?url=http%3A%2F%2F127.0.0.1%3A8097`. Capture
  with `xcrun simctl io <udid> screenshot`, which stays fresh.
- **Web screenshots**: `npm run shots` (see `scripts/shots/README.md`).
- **Rive** runs on iOS (checked 2026-10-29: the streak flame plays, no Rive errors in
  the device log) and shows still frames on web by design. Mascot animation that must
  move on web too needs Reanimated with SVG, or the Rive web runtime added on purpose.
