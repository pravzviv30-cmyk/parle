# Your French: screenshot evidence (2026-10-22)

Branch `claude/your-french-evidence`, on top of `claude/your-french` (21f01514).
Every shot draws the real `YourFrenchSection` (journey/JourneyParts.tsx), the
component the Journey tab now draws, from the real `yourFrenchView` over the
fixed learners in `apps/mobile/src/journey/yourFrenchFixtures.ts`. The dev
preview is `apps/mobile/src/dev/YourFrenchPreview.tsx`, reached through the
screen preview (`EXPO_PUBLIC_LUVANI_SCREEN_PREVIEW=1`).

## States

| State | What the fixture holds | Expected |
|---|---|---|
| `full` | 8 phrases used in conversation (2 held in a new situation), a line called out then clear, 2 scenes earned on your own | Phrases with the one band, 5 chips (held ones tagged), "and 2 more in your phrasebook", the sound line, the scenes line |
| `sounds` | A line called out then clear only | The sound line alone |
| `scenes` | 2 scenes earned on your own only | The scenes line and titles alone |
| `forward` | Practised (one helped scene), no evidence | The forward line, no numeral |
| `free` | Full evidence, phrases and sounds locked | Scenes drawn; two teaser rows, no band |

## How each shot was taken

- `<state>-<light|dark>-375.png` (10): web (Expo web, port 8083), headless
  Chrome over CDP, viewport 375×812 at 2x, `?preview=your-french-<state>&theme=<mode>&controls=0`.
  The capture waits for the preview text before shooting.
- `<state>-<light|dark>-200pct[-n].png` (10 states, 15 files): iPhone 13 mini
  simulator (375pt wide, iOS 26.5), the Oct 19 dev client against this
  worktree's Metro, `xcrun simctl ui content_size accessibility-large`
  (body text about 1.94x, the nearest iOS step to 200%), mode from
  `xcrun simctl ui appearance`. Long states run over several pages (`-1`, `-2`, `-3`),
  scrolled top to bottom.

## The highlighter on the dark card (DESIGN.md Highlight rule, 2026-10-22)

Measured from the rendered DOM at 375pt (`measure-375.json`):

| | Light | Dark |
|---|---|---|
| Bands on the screen | 1 | 1 |
| Band | `#D8FF54` | `#D8FF54` |
| Words on the band | `#16123A`, `lang="fr"` | `#16123A`, `lang="fr"` |
| Card under the band | `#FFFFFF` | `#25203D` (`b.dark.card`) |
| Ink on band | 15.53:1 | 15.53:1 |
| Band against card | 1.14:1 | 13.57:1 |

Every other state draws no band (0 counted). No text was cut with an ellipsis
and nothing scrolled sideways at 375pt. At large text in the simulator, the band
grows with its phrase, which wraps to two lines on the dark card and stays
whole. Chips wrap one per line, and every part can be reached by scrolling.

## Not covered

- The live Journey tab itself was not shot. The canvas learner needs a mock
  sign-in. The tab now draws Your French only through `YourFrenchSection`, a
  markup move pinned by `evidenceScreens.test.ts`, `MyFrenchTab.test.ts` and
  `surfaceContract.test.ts`.
- Android, VoiceOver and reduced motion were not checked here. The section has
  no motion.
- Preview chrome only, not the section: on native the status bar keeps dark
  glyphs on the dark preview ground, and a hairline from the preview frame shows
  near the bottom of some light shots.
