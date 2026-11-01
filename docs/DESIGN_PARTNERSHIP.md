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
| 2026-10-30 | Today: A's morning sky (a sky that follows the hour, Bonsoir after dark, the greeting and profile in the sky, one hero card that is the first stop of today's path) over Today as it ships (the rest of the path, Today's three, Coming up and the week, flattened), keeping the icon tab bar. Not taken: A's sideways rail (it hides the third item) and text-only tabs. Recorded as UI-015. | Founder, mix question on the Today direction board |
| 2026-10-31 | The stats become chunky game-style tiles: a solid tile on a darker lip like a pressable game button, a coloured coin, a big number and one word. With no streak the tile says "Start" over "today", under a minute is "<1" with "/10", and the nudge sits in the sky. | Founder, board comment (version 18) and the build session's three questions |
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
| 2 | Today | The A × Today mix accepted (UI-015, founder 2026-10-30) with chunky stat tiles (2026-10-31); built on `claude/today-sky` from [changes/today-sky.md](changes/today-sky.md) |
| 3 | Drill and practice feedback | B v2 picked and approved on the [drill board](https://claude.ai/artifact/XAZR2pptSi5YgH4ncZTXiK) (page "B v2, every surface"); built on `claude/drill-b` (UI-016, LEARN-018, [changes/drill-b.md](changes/drill-b.md)): gate green at 7,449, four verifier rounds to HOLDS, native simulator and a live run checked; landing |
| 4 | Journey | Candidate |

Systemic fixes waiting for evidence from the first screens: one card system, a type
scale named by role, native sheet and modal presentation, and route transitions that
show where you went.

## Proposals from push-check

The Impeccable reviewer in `/push-check` looks at every frontend push. What breaks our own
rules it fixes in the push; redesign ideas it would not apply land here, and the founder
chooses per row. A screen's redesign session reads its rows here before its brief.

| Date | Screen | Problem | Direction | Branch | State |
|---|---|---|---|---|---|
| 2026-11-01 | Today, out of time past Starter | The hero holds the out-of-time words with a plain "Review N phrases" button, and Today's path still has its own Review row with the same words, so one intent shows twice. | Make the hero's single action a LipTile "Review N phrases" with the watering-plant art on sage, and drop the duplicate path row, so the screen keeps one focal point. | `claude/finish-fixes` | asked, no answer yet |
| 2026-11-01 | Today's starter-line sheet | It reads as a form: the only practice surface without a stage. | Put the prompt and translation on a Write-family sage stage band, as Drill B does, with the field and pill below; the offline note becomes one muted caption under the field. | `claude/finish-fixes` | asked, no answer yet |
| 2026-11-01 | Today and the drills (eyebrows) | Labels above headings ("One fix to try", "Build it in French", "Today's phrase") add a line the craft floor avoids; DESIGN.md defines `eyebrow` tokens, so this is not slop. | Fold the label into the heading ("One fix to try" becomes the heading and the question its caption) and retire the eyebrow tokens one screen at a time. | `claude/finish-fixes` | asked, no answer yet |
| 2026-11-01 | Tab bar at accessibility sizes | Icons only (F947) removes every word, including the one that says where you are; a long press now shows it large on iOS. | Keep the selected cell's word under the sun glyph and hide only the four resting tabs' words. This revisits the founder's F947 decision. | `claude/finish-fixes` | asked, no answer yet |

## Tools and how they are used

- **Figma** (claude.ai connector, signed in): read the canvas file
  `sjAwoGinWQKvhGrWbgMO18` and the B screens `M2K7xWepBhsLA0QAtXTjvx`. Writing to Figma
  only with the founder's OK, once a direction is chosen.
- **Appllama** (claude.ai connector, 1,500 credits a month): two to four targeted
  references per screen. Media links expire in an hour.
- **Impeccable**: a reviewer for critique and polish. Its detector reads web markup, so
  every suggestion is checked for React Native fit before use. Its
  `impeccable-finish-reviewer` reviews every frontend push in `/push-check`: slop is fixed
  in the push, redesign ideas are asked of the founder and logged under "Proposals from
  push-check".
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
