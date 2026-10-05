# Design

<!-- Recorded from the built artifact, not from intentions. Every value below is
     read out of apps/mobile/src/palette.ts and the screens as shipped. The
     previous design system (enamel wayfinding, dark Métro-plaque green) lives
     in full at the repo's baseline commit. -->

## The world

Revamp B uses warm paper, dark ink, Outfit, and four purposeful colours.
Blue carries a scene or a weekly story, coral the recap cover, sun a sound or
plan, and mint a can-do. A working page uses paper and at most one colour card.
White cards carry lists. Chartreuse marks one French line on white or paper.
There are no gradients, shadows, uppercase metadata, italic French, nested
white cards, decorative badges, streaks, XP or visible Friends ranks. A white
reading surface inside a colour task card keeps French legible.

### Current composition rules

- Four tabs: Home, Speak, Practice and Progress. Profile opens from the labelled
  avatar; Settings is its first row and optional Friends follows it. Route
  identifiers and the Friends URL remain stable.
- Home offers one useful next action, a lifetime day count, starting scenes or
  evidence-based week sentences, and today's voiced French. It shows no weekly
  day quota. Loading does not claim that the learner has no history.
- Speak shows the chosen tutor and the same next task as Home: unfinished
  personal practice, usable practice, then the next scene. Offline, the bundled
  coffee line replaces a service retry as the useful primary.
  The current-level scene path uses earned evidence from core. All scenes are
  available through the grouped A0/A1 list and blue scene briefs.
- Live rooms retain the real start, pause, type, help, slower, English and leave
  paths. White tutor bubbles and ink learner bubbles distinguish speakers; only
  the newest recast is highlighted. Waiting shows the actual observed stage.
- Practice puts one concrete next action and its French line in the first
  viewport. The sound example follows, with its full guide on request; it is
  labelled as authored or tied to an actual saved check. Other doors open real
  saved work. Shadowing plays the selected tutor's bundled audio,
  records a temporary local take and offers comparison without assessing it.
  Finishing that practice records an active date only after a durable write.
- Empty Progress offers a real first task. With history, independently earned
  can-dos lead, followed by a quiet scene-path row, saved material, a story when the week
  has evidence, and earned place postcards. Its day count is weekly; Profile's is
  lifetime. Neither becomes a streak, deadline or target.
- A recap starts with actual French on a white surface within its coral result.
  It adds the learner's actual lines,
  correction or durably saved phrase, a sound page only for a saved check, an
  ability page only for a core-earned can-do, and a next page only when there is
  a useful next action or reminder. It does not draw empty story steps or infer
  pronunciation from the conversation. Closing remains available on every page.
- Profile voice/name choices and reminder choices stay over their parent page
  on a modal sheet. Choosing updates the choice; Done closes it. A hear control
  is separate from selecting a voice. Recording and playback stop on leaving.
- Paid amounts come from the catalogue and prices from the store. Max remains
  300 minutes at the agreed price. A room that runs out of minutes opens the
  central plans wall. Purchase success requires a freshly confirmed entitlement.
- Friends retains requests, privacy, moderation and shared challenges. People
  appear by name, including friends with private activity, without points or ranks.
- French content carries its language and sits larger than its English gloss.
  One primary pill is followed by quiet secondary links. Touch targets and
  wrapping accommodate the operating system's reading size.

## Colour

Luvani, bright (revamp B, 29 September): one warm paper ground, white cards,
one deep ink, and four saturated colours that each lead a screen or report the
tutor's state. Every raw value lives in `apps/mobile/src/palette.ts`, which
imports nothing so that `palette.test.ts` can hold it to a contract. `theme.ts`
composes its tokens from there and carries no raw hex of its own, and no other
source file writes one either. The tables below are that palette, read back out
of the code: `palette.test.ts` fails if this document and the export disagree on
a single value, or if either names a token the other lacks.

The contract has three floors. Words clear 4.5 against whatever they sit on. A
mark that reports state clears 3. Two colours that mean different things stay a
Delta-E of 30 apart, so neither reads as the other.

### Paper and ink

One ground, one white, one ink, one soft ink and one hairline. B has no pressed
wash, no third ink and no second hairline, so the old names that asked for one
(`groundDeep`, `inkFaint`, `lineOnCard`) are aliases of the one B value until
Stage 6 retires them. `skeleton` is new: loading blocks, and the one fill the
first three rungs share. `field` arrived with Stage 2: the border of an input
and the ring of an unchosen option, a mark and never words.

| Token | Value | Role |
|---|---|---|
| `paper.ground` | `#FFF6E9` | The page. Every working screen sits directly on it |
| `paper.skeleton` | `#EFE6D6` | Loading blocks, and the rung fill |
| `paper.groundDeep` | `#EFE6D6` | Alias of `skeleton` until Stage 6 |
| `paper.card` | `#FFFFFF` | Cards and tiles. White, no hairline, no shadow |
| `paper.ink` | `#16123A` | Primary text, the primary button, the dark live ground |
| `paper.inkSoft` | `#5C5A74` | Secondary text on paper or white, never on a colour |
| `paper.inkFaint` | `#5C5A74` | Alias of `inkSoft`: counts and placeholders are words |
| `paper.line` | `#EADFCB` | The one hairline, for decorative dividers only |
| `paper.lineOnCard` | `#EADFCB` | Alias of `line` |
| `paper.onInk` | `#FFFFFF` | Text and icons on a filled ink, blue or coral control |
| `paper.field` | `#8A8499` | The 1.5pt input border and the unchosen option ring. A mark, never words |

Ink clears 16.6 on the ground, 17.8 on a card and 14.4 on the skeleton. Soft
ink clears 6.2 on the ground and 6.6 on a card. The card lifts off the ground by
a Delta-E of 7.9, the hairline sits 8.9 off the ground and 15.5 off a card, and
the skeleton 5.9 off the ground. The field border clears 3.6 on a card, the
floor for a mark.

### Four colours

One colour leads a screen at most; the rest is paper, white and ink. What may
sit on each is fixed, and the other way round is a forbidden pair: no white on
sun or mint, no ink on blue or coral, and no soft ink on any colour.

| Token | Value | Text on it |
|---|---|---|
| `colour.blue` | `#3B2FE0` | White (7.9). The brand: onboarding, the next-scene card, the selected tab |
| `colour.coral` | `#D63A22` | White only (4.7), never below 14pt. The tutor speaking, the recap cover |
| `colour.sun` | `#FFC93C` | Ink (11.6). Thinking, the plan, the focus sound |
| `colour.mint` | `#2FD18B` | Ink (9.0). Your turn, a can-do earned, a done tick |

Stage 1 added these four and nothing else, because an unused value is a value
somebody builds to. Stage 2 is the stage that first draws the rest of STYLE
section 4: the field border above, what sits on each ground below, and the
illustrations' lilac.

### On a colour ground

The words on each ground and the secondary line under them are fixed per
ground, so a part set on colour never chooses. `textOn` is the words: white on
blue and coral, ink on sun and mint. `onColour` is the secondary line, a meta
line or the English under a French line, because soft ink is never set on a
colour; coral has one text colour and takes white, and `ink` is the live
session's dark ground. Every one is words and clears 4.5.

| Token | Value | On |
|---|---|---|
| `textOn.blue` | `#FFFFFF` | Blue, 7.9 (aliases `paper.onInk`) |
| `textOn.coral` | `#FFFFFF` | Coral, 4.7, never below 14pt (aliases `paper.onInk`) |
| `textOn.sun` | `#16123A` | Sun, 11.6 (aliases `paper.ink`) |
| `textOn.mint` | `#16123A` | Mint, 9.0 (aliases `paper.ink`) |
| `onColour.blue` | `#E4E1FF` | Blue, 6.2 |
| `onColour.coral` | `#FFFFFF` | Coral, 4.7: white is coral's only text colour (aliases `paper.onInk`) |
| `onColour.sun` | `#3E3A56` | Sun, 7.0 |
| `onColour.mint` | `#3E3A56` | Mint, 5.5 |
| `onColour.ink` | `#C9C6DE` | Ink, 10.7 |

The story segments draw the done bars in the ground's `textOn` and the pending
bars in `segmentPending`, a decorative tint of the ground that says nothing on
its own: the segments are one element to a screen reader, "Step 2 of 6".

| Token | Value | Pending bar on |
|---|---|---|
| `segmentPending.blue` | `#7F78EB` | Blue |
| `segmentPending.coral` | `#E47F6F` | Coral |
| `segmentPending.sun` | `#D0A43C` | Sun |
| `segmentPending.mint` | `#2AAB7B` | Mint |
| `segmentPending.paper` | `#EADFCB` | Paper: the one hairline (aliases `paper.line`) |

`lilac` belongs to the flat illustrations and to nothing else, as
ILLUSTRATIONS.md allows it. `palette.test.ts` walks the source: the token is
spelled only in `palette.ts`, `theme.ts` and the files under `src/art/flat/`.

| Token | Value | Role |
|---|---|---|
| `lilac` | `#B9A7FF` | A fill inside the flat illustrations only |

### Ink identity, one highlighter

The primary action and the labels are ink, and `accent.label` equals
`accent.primary`. `accent.brand` is the blue, pinned to `colour.blue` so a second
brand cannot creep in, and held a Delta-E of 30 from every orb state, the
highlighter, the rung fill and the tutor's mark. The chartreuse is one pen,
`highlight`, legal in exactly three places: the `Highlight` band behind a French
line, the `LevelPath` "you are here" stop, and the brand mark (an SVG in
`assets/brand/`). At most one per screen, always under ink, and never the ground
of a panel, tile, avatar, tab, title, card or button.

`accent.feature` is retired. `palette.test.ts` refuses the alias in the palette
and any use in production source, with no transitional allowances.

| Token | Value | Role |
|---|---|---|
| `accent.primary` | `#16123A` | The one ink pill (aliases `paper.ink`) |
| `accent.label` | `#16123A` | Labels (aliases `paper.ink`) |
| `accent.brand` | `#3B2FE0` | The brand blue (aliases `colour.blue`) |
| `highlight` | `#D8FF54` | The highlighter: a band behind a French line, the "you are here" stop, the brand mark |

Ink clears 15.5 on the highlighter and soft ink 5.8. The highlighter stays a
Delta-E of 30 from every signal, orb state, the rung fill, the ground and the
card, so it never reads as a state, a support level or the page.
`palette.test.ts` walks the source: the hex lives only in `palette.ts`, the
token is spelled only in `palette.ts`, `theme.ts` and `components.tsx`, and
inside `components.tsx` only within `Highlight` and `LevelPath`.

**An accent is typographic; a signal is a mark.** A label, a chip, or a
drawing's one solid fill may take the accent. A dot, a ring, or anything
reporting state never may.

### Signals: words in ink, and one mark

B carries meaning in words and puts colour only on marks. The two signals that
letter words, a sound that is working and something to change, are the ink
itself, so they clear the text floor by being ink. The tutor's coral only ever
marks the orb, so it is held to the 3 floor for a mark (4.4 on the ground, 4.7
on a card) and its caption is ink. It stays a Delta-E of 30 from ink, the rung
fill, the ground and the card.

| Token | Value | Role |
|---|---|---|
| `signal.good` | `#16123A` | A sound that is working, in ink (aliases `paper.ink`) |
| `signal.correspondance` | `#16123A` | Something to change, in ink (aliases `paper.ink`) |
| `signal.live` | `#D63A22` | The tutor's voice, a mark and never words (aliases `colour.coral`) |

Earned marks use a mint fill with an ink glyph. The sound judgement remains
words in ink; colour never substitutes for its stated result.

### The voice circle

Coral, the tutor is talking; mint, your turn; sun, it is thinking; ink, ready to
be tapped. TutorIntro teaches these states in words and never by colour name,
because the glyph and the caption carry the state for a learner who cannot tell
the colours apart. The three lights stay a Delta-E of 30 from each other and
from the rung fill.

Mint and sun are far too light to be a mark on paper (1.85 and 1.43), so the
fill is never the only signal. The orb is SNIPPETS' two rings and a core in the
state colour, and every state carries one mark in the core: the seven voice
bars while the tutor speaks, a microphone whenever it is your turn or the room
is getting ready, three dots while the tutor thinks. The mark and the embedded
status are in the colour `onOrb` pairs with the fill, held to the 4.5 floor for
words on it: white on coral 4.7, ink on mint 9.0, ink on sun 11.6, white on ink
17.8. The coral and the ink ready core still clear 3 on the ground. Below 64 the
rings are too fine to read, so the tutor mark and the tutor card draw the core
alone.

| Token | Value | Caption / role |
|---|---|---|
| `orb.speaking` | `#D63A22` | Listen: the tutor is speaking (aliases `colour.coral`) |
| `orb.yourTurn` | `#2FD18B` | Speak: your turn (aliases `colour.mint`) |
| `orb.thinking` | `#FFC93C` | One moment: the tutor is thinking (aliases `colour.sun`) |
| `orb.ready` | `#16123A` | Tap to talk: the untapped control (aliases `paper.ink`) |

| Token | Value | The glyph on |
|---|---|---|
| `onOrb.speaking` | `#FFFFFF` | Coral: white bars and status |
| `onOrb.yourTurn` | `#16123A` | Mint: ink bars and status |
| `onOrb.thinking` | `#16123A` | Sun: ink bars and status |
| `onOrb.ready` | `#FFFFFF` | The ink ready orb: its white microphone and status. SNIPPETS draws ready as ink rings and an ink core with a white mic, so it stays white |

Ink is not a fourth traffic light. A closed microphone waiting to be tapped is
the primary control of the whole product, so it takes the primary colour exactly
as the primary action does, and it changes to a state colour when the orb
reports state.

### The rungs share one fill

A rung colour is a fill under an ink numeral, not a state mark, so it is held to
ink at 4.5 on the fill rather than to the mark floor against the ground. B puts
no further colours on the rungs: the first three share the skeleton fill under
an ink numeral (14.4), the words in `rungLabel` say which rung is which, and
rung four is plain ink under a white numeral, no line left to follow. The fill
sits 5.9 off the ground and 12.2 off a card, and a Delta-E of 30 from ink, the
tutor's mark, the three orb lights and the highlighter.

| Token | Value | Meaning |
|---|---|---|
| `rungColor[1]` | `#EFE6D6` | Echo, repeat after the tutor (aliases `paper.skeleton`) |
| `rungColor[2]` | `#EFE6D6` | Cued, choose a reply and say it (aliases `paper.skeleton`) |
| `rungColor[3]` | `#EFE6D6` | Prompted, say it in your own words (aliases `paper.skeleton`) |
| `rungColor[4]` | `#16123A` | Free, plain ink, no line left to follow (aliases `paper.ink`) |

### Tints are retired

There are no tint tokens, role tables or tinted primitives. Places are named by
words and ink glyphs, not pastel surfaces. `palette.test.ts` rejects the retired
palette, and `surfaceContract.test.ts` rejects every tint token, role table and
wrapper in production source. There are no transitional allowances.
### Shadow

No interface shadow. White cards separate content from warm paper; the live
orb carries its state through the core, rings, glyph and caption. The selected
glow is a ring layer, not a shadow: a translucent blue view drawn under a
chosen tile (see Motion, The press). The live microphone glow remains the only
shadow.

**The whisper is deleted.** The theme exports no shadow token. `theme.test.ts`
refuses the retired alias, and `surfaceContract.test.ts` refuses shadow styles
anywhere outside the live microphone glow. There are no pending callers or
theme exceptions. Cards are never nested, and each screen file may host at
most one `Highlight` or `LevelPath` highlighter.

## Type

**Outfit** is the only face: every word on the screen, French and English
alike, in five cuts (Regular 400, Medium 500, SemiBold 600, Bold 700, ExtraBold
800). It is OFL, committed in `assets/fonts/` with its licence and credited in
Acknowledgements; Fraunces and DM Sans have left the bundle. Weight and size say
what a line is, never a second face, and nothing is set in italics or in caps.
French keeps its own tokens by name, set in SemiBold, and the French line is
always the largest text in its block. All callers use the five canonical font names.

Sizes are points and scale with the OS reading size. Line heights are STYLE's
ratios rounded to whole points, and tracking is STYLE's em value at the size.
`theme.test.ts` pins every row below. It fails if the theme names a face
`App.tsx` does not load or the fonts folder carries one nothing loads, if the
French hero is not larger than the screen title, and if `frenchLg` is not larger
than a heading.

| Style | Face / size | Use |
|---|---|---|
| `hero` | Outfit ExtraBold 112/95, -4.5 | The one giant number on a story or colour card, at most one per screen |
| `display` | Outfit ExtraBold 44/44, -1.3 | A headline on colour, or the centred Profile identity |
| `title` | Outfit ExtraBold 30/33, -0.6 | The title of a working screen |
| `heading` | Outfit Bold 20/25, -0.2 | Card titles and section heads |
| `cardTitle` | Outfit Bold 20/25, -0.2 | The title of a card, the same style as `heading` |
| `frenchHero` | Outfit SemiBold 34/42, -0.3 | The French line that leads a screen (`fitHero()` steps 34, 30, 26 by length, from `heroFit`) |
| `frenchLg` | Outfit SemiBold 28/34, -0.3 | The French line that leads a card or scene (`fitDisplay()` steps 28, 24, 20 by length) |
| `french` | Outfit SemiBold 20/26 | French in lists, rows and thread bubbles |
| `frenchSm` | Outfit SemiBold 17/23 | French in a chip, where the phrase is a sample |
| `body` | Outfit Regular 17/25 | Sentences |
| `bodyStrong` | Outfit SemiBold 17/25 | A sentence that carries more weight |
| `label` | Outfit SemiBold 16/20 | Buttons and row titles, sentence case, no tracking |
| `button` | Outfit SemiBold 16/20 | Pill and outline lettering, the same style as `label` |
| `small` | Outfit Medium 14/20 | Metadata lines, captions, the English under a French line |
| `tabLabel` | Outfit SemiBold 12/12 | Tab bar labels only |
| `notation` | Outfit Medium 14/20, 0.4 | IPA: real notation, not mono-as-costume |

## Surfaces and controls

The notebook system, redesign Phase 1 (27 September), restyled in place by
revamp B Stage 2 to the SNIPPETS.md parts, with the B parts appended after it.
Every screen picks it up through these primitives; no screen was edited to get
it. The old primitives that screens still call are deprecated wrappers drawing
the new look, listed at the end, and they go with their call sites.

- **Press** — the one press: every tappable part below shrinks to 0.97 on the
  press spring while the finger is down, springs back on lift, and answers
  with a light impact or, for a choice, a selection tick (see Motion).
- **Card** — the one card (SNIPPETS card-white): white at the card radius, no
  hairline, no shadow, no outline, never nested inside another card.
  `tone="feature"` is deprecated and draws white; `journal` keeps the ground
  for the phrase card.
- **Ledger / LedgerRow** — how a list is drawn. The ledger rules a hairline
  above its first row and is a list to assistive tech; each row rules the
  hairline under itself. A row is one `Press` at 56pt with an optional 24pt
  ink glyph and no disc, an optional caps label, a title in `heading`, a gloss, an optional note on its
  own line, trailing meta, an earned state, and the faint chevron that says it
  opens. It names itself once, says disabled in soft ink rather than opacity,
  and grows rather than clips at the largest reading size.
- **PillButton** — the one primary action per screen: the ink pill
  (`accent.primary`) with white lettering, 56pt, fully rounded; `tone="white"`
  is the white pill with ink lettering on a blue or coral ground.
- **OutlineButton / GhostButton** — the second action. `GhostButton` is
  SNIPPETS' link-text, an underlined ink word at the touch floor (white on blue
  and coral, which the caller passes), never a box, so nothing competes with the
  one pill. `OutlineButton` is the older quiet link until Stage 6.
- **OptionCard** — a legacy tappable choice: French in Outfit, English gloss under,
  quiet arrow, optional replay ear. Selection is a heavier ink rule on white; a
  replay ear that is sounding is drawn in ink on a `paper.groundDeep` disc.
- **Field, TabBar, ProgressDots** — inputs are white, 56 tall, with a 1.5
  `paper.field` rule that turns ink on focus, and a secure field carries a 44pt
  **Show / Hide** at its trailing edge so a password is not typed blind; the
  label above is small ink at SemiBold. `TabBar` is SNIPPETS' segmented: a sand
  track with a white chosen segment, ink at Bold on the chosen word and soft ink
  at SemiBold on the rest, never ink capsules. Each segment stays at the 44
  floor, presses as a choice, can stand with nothing chosen, names its group for
  a screen reader and says which segment is selected on the web as well as on a
  device. `ProgressDots` is SNIPPETS' story segments: equal bars, the done ones
  in the ground's words colour and the rest in `segmentPending`, read once as
  "Step 2 of 6".
- **Label** — the meta line a card may carry: small, soft ink, sentence case.
- **Tab bar** — white with a top hairline, four labelled icons and no dock,
  shadow, chartreuse wash or independent animation. Selected is brand blue in
  Outfit Bold; unselected is soft ink in Outfit SemiBold. Cells keep a 60pt
  floor and labels wrap at large text. The words are Home, Speak, Practice and
  Progress; Friends is an optional Profile route.
- **Highlight** — the highlighter (SNIPPETS highlight): a still band in
  `highlight` behind one French line, at most once per screen and only on white
  or paper. The band is decorative; the line on it is what is read, marked as
  French (`frenchText`) so a screen reader reads it in a French voice.
- **SoundTag** — a sound, named: its IPA as notation beside one French example
  word, such as /ʁ/ rouge, read as one element.
- **LadderMark** — the four rungs in `rungColor`, the current one drawn taller,
  beside the rung's sentence from `rungLabel`. The rungs are decorative.
- **LevelPath** — each level (A0, A1), its can-dos in order, and one "You are
  here" stop in the highlighter. A done stop is an ink dot, a stop ahead a
  hairline ring, and each stop is one sentence to a screen reader.
- **TutorCard** — the orb, the tutor's name, the voice in words, the signature
  line in French, a 44pt sample that says Stop while it sounds, and a quiet
  "Change tutor" link. No face and no initial.
- **SceneBrief** — the brief for one scene: an optional level and label as the
  one caps line, the French title as the fitted French hero, the title, "You'll
  be able to" and the can-do, two or three lines to say, minutes, support and
  tutor, the reason, then the caller's one Start and quiet "Type instead". The
  Start and the corner (the 44pt bookmark slot, in flow) arrive as nodes the
  caller built, so the one-primary-action rule stays countable from the
  screen's own file.
- **PhraseCard** — one French line, large, sized by `fitDisplay` rather than
  clipped, with a round white 44pt speaker beside it on a paper hairline and
  the ink speaker mark. It says "Hear" before it sounds and "Stop" while it does.
- **TutorMark** — the tutor, drawn as the orb at 36 in a 44pt box with no disc,
  and hidden from assistive tech. There is no face anywhere in this app and no
  initial either: the monogram is the learner's mark, never the tutor's.
- **SpeakCircle** — THE microphone: one 108pt circle used by every speaking
  surface. Green-ringed when waiting, green-filled (with the live glow, the
  only shadow in the app) when live — green means "you speak", matching the
  voice circle — hairline-muted when the tutor holds the floor.
- **Icons** — ICONS.md's marks, ported path for path at its one stroke of 2 on
  a 24 box, ink by default: `components.tsx` for the controls (with `CloseGlyph`
  and `CheckGlyph` beside the parts that draw them), `glyphs.tsx` for the row
  marks and the Round 1 additions, `nav/icons.tsx` for the tabs, where Speak is
  the same microphone as the control. All are held to the one stroke by
  `motion.test.ts` and `glyphs.test.ts`. The Apple and Google marks are the only
  filled glyphs, in the one colour they are given. The few older drawings
  ICONS.md has no match for are kept at the new stroke until their callers
  retire.
- **Art** — the single raster renderer, using registry sizes or its compact
  variant. Illustrations sit within content panels, never behind headings.
- **TabHeader**: the tab's title block. A `display` title on the left, one plain
  purpose line beneath it in soft ink, and an optional trailing `Monogram` on the
  title row. It mounts as the first child of a tab's scroll body, never in the
  frame's `header` slot, so the fixed title and purpose can scroll at large text.
  It has a second, centred variant, and Profile is the one tab that uses it: that
  screen is about a person rather than a subject, so the monogram leads above a
  centred name, straight on the page with no panel behind it. Centring is the
  exception and stays that way — it is the only place in the app where
  `textAlign` is written at all, and a test cuts the centred branch out before
  banning it everywhere else. The shared `ScreenHeader` rules a paper hairline
  under itself, and its way back is the round white back button at the touch
  floor.
- **Monogram**: the learner's initial drawn one way (SNIPPETS header-tab). A
  white initial in Outfit Bold on an ink disc, hidden from assistive tech.
  `HIT`-sized in the header, larger on Profile.

The B parts, appended in revamp B Stage 2 for Stage 3 to paste:

- **RoundButton** — back and close are a white disc at the touch floor with the
  ICONS.md mark; next is a 64 disc (sun on blue or coral, ink on sun) with its
  word beside it.
- **ColourCard** — the one colour card on a paper screen: one ground at the
  feature radius, words in `textOn`, the secondary in `onColour`. The whole card
  is a target only when it holds no pill of its own.
- **StatTile / HeroNumber** — a number and one plain line on white, and the one
  giant number with its unit on a colour board. Each is one phrase to a screen
  reader.
- **OptionRow** — a one-tap choice: a white row with a title and a line under
  it, ending in the brand-blue check when chosen and the field ring when not.
  The choice is said on a device and on the web.
- **Sheet** — a bottom sheet under an ink scrim at 0.45 that closes it, modal to
  VoiceOver, with a grabber and a title. No drag to dismiss.
- **Skeleton / QuietLine** — still sand blocks that say Loading once, and a
  small centred reassurance.
- **FrenchBlock** — a French line, large and marked as French, the English
  under it, and a 44pt hear disc that says Stop while the line sounds.

The deprecated TintRow, TintPanel, TintDisc, IconRowCard and HeroCard wrappers
are deleted. Callers use LedgerRow, Card and SceneBrief directly. No tint or
retired wrapper is allowed in production source.
## Illustrations

### Flat drawings

Revamp B's pictures are ILLUSTRATIONS.md's flat drawings, one illustrator's
hand: flat fills from the palette only, no gradients, no outlines except
deliberate 3pt ink or white strokes, no words and no faces. They are vectors,
generated rather than drawn in code by hand. `node scripts/illustrations.mjs
<kit>/ILLUSTRATIONS.md` converts each drawing's `<svg>` into a react-native-svg
component at `src/art/flat/<id>.tsx` and writes the one registry,
`src/art/flat/index.ts`: the component, its viewBox, and the sizes the
catalogue displays it at. Every hex goes through one map to a palette token,
and `lilac` exists for these drawings alone. An element, an attribute or a
colour the map does not know stops the script, so a new drawing cannot bring a
colour, a gradient or a word in unannounced. Running it twice changes nothing.
Never edit a generated file: change the catalogue and run the script.

Screens draw through `Illustration` (`src/art/flat/Illustration.tsx`), by name:
`<Illustration name="state-offline" />` at the catalogue's large size, or
`fit="small"` for its second size. A caller never writes a width. On a narrow
phone the box narrows to its column and the drawing is contained in it, centred.
Every drawing is decorative, since the words beside it say what it shows, and
at most one sits on a board (STYLE section 9). `src/art/flat/scenes.ts` maps
each scene to its place drawing, `sceneIllustration(id)`, by mission rather
than by place because the café has two scenes and two drawings.

The registry ships 29 original drawings:

| Drawings | Sits on | Large | Small |
|---|---|---|---|
| `place-cafe-counter`, `place-cafe-terrace`, `place-hotel`, `place-market`, `place-directions`, `place-day`, `place-apero` | A blue or coral card | 350 by 220 | 262 by 165, a hero spot |
| `state-notebook`, `state-waiting`, `state-offline`, `state-microphone`, `state-headphones`, `state-postcard-frame` | Paper, where their ink lines carry the shapes | 160 by 160 | 120 by 120, under a headline |
| `celebrate-confetti` | Blue or coral, laid over the whole card | 390 by 260 | |
| `celebrate-wrapped` | Blue | 350 by 260 | |
| `celebrate-first-line` | Blue | 350 by 220 | |
| `postcard-cafe-counter`, `postcard-cafe-terrace`, `postcard-hotel`, `postcard-market`, `postcard-directions`, `postcard-day`, `postcard-apero` | Mint or paper, in their own white border | 300 by 190 | 165 by 105, in a row |

The six mouth guides (`mouth-y`, `mouth-u`, `mouth-r`, `mouth-nasal-an`,
`mouth-nasal-on`, `mouth-zh`) are recovered from the original local design kit,
converted at 200 by 160. Practice's sound card and the measured sound journey
map the exact IPA symbol to the corresponding guide, with an authored cue in
words. Unknown sounds draw no substitute. The seven place drawings, state drawings,
recaps, earned postcards and the weekly story reach their relevant screens.

### Raster scenes, retired

The place watercolours, `apps/mobile/assets/art/`, `Art.tsx`, the raster
registry and its map retired with revamp B (F599). Nothing in the app imports
`Image`, and every picture is a vector. The welcome, cake, wave, empty table,
recap postcard, phrasebook and wall-map rasters went before them.

The daily library and Today show no pictures. Their French, glosses, notes,
examples and audio remain.

### Inline SVG

The static pen in `src/illustrations/pen.tsx` uses ink strokes at the one
`STROKE` (2 since revamp B), round caps and joins, a 200x150 viewBox and stipple shading. Frame spreads `decorative` on
every SVG. `NobodyYet` and `StillWriting` retain their empty-state marks but no
longer animate. `RewardMark` remains the static tick beside a drill verdict.

SpeakBubbles, OnboardWave, the unused onboarding drawings and LearnStack are
deleted. All twenty daily-pack drawings, their selector and their unused card
are deleted. The illustration animation hook and moving layers are gone.
`motion.test.ts` and `surfaceContract.test.ts` enforce static illustrations;
Illustrations stay static; the bounded motion hosts are listed in the Motion section.
## Structure

First run shows a captioned, recorded French exchange silently until the learner
taps Hear. The next page offers an authored coffee choice with useful feedback
and optional help, without recording or assessing their voice. Starting level
and an editable routine lead to a catalogue-backed A0/A1 starting plan. Name
and conversation goals are optional Profile choices after setup.
The age confirmation comes before account creation. A refused microphone
offers typing, and the first scene shows one line and the live
minutes cost before either start. Returning learners sign in; the recovery flow
asks plain questions and lets them hear voices before choosing one.

The signed-in app has four tabs, each opening Profile from the labelled
avatar. Friends is a Profile route and retains shared challenges and moderation.

| Tab | What it is |
|---|---|
| Home | One shared next task: unfinished personal practice, usable practice, then a scene; a truthful plans gate when the free allowance is used; genuine local practice offline; a lifetime day count; starting scenes or two week sentences; today’s French and free local practice. |
| Speak | The chosen tutor or real continuity, the same next task as Home, then the current level scene path. The grouped scene list opens a brief before starting. |
| Practice | One ready next practice made from the learner's saved work or due review, with its French line first, then an optional sound example and guide. The three rows for replay, own phrase and due review appear only when they can start. Shadowing is free offline. The archive is one level down in Conversations. |
| Progress | A first task when empty; independently earned can-dos before the A0/A1 level card, a weekly day line, saved phrases, sound evidence, conversations and goals; earned postcards and a week story appear only with evidence. |
| Profile (avatar) | Settings first, the learner’s monogram and name, lifetime days, the chosen tutor, memory and learning choices. Voice and name choices open sheets over the page. |

Three routes carry what used to be a section of a tab. Each is pushed, each opens
with the shared header's one chevron, and each was moved rather than cut, because
a section with a learner's own data behind it is worth a page.

| Route | What it is |
|---|---|
| Friends | Optional shared challenges, privacy and moderation, opened from Profile or existing friend links. |
| Phrasebook | What My French's phrase shelf opens. The one-line card first, a single phrase from the deck with the English showing and the French withheld until an attempt lands, because the thing worth doing should never sit under a list of things already done. At twelve saved entries, local French/English search helps retrieve a line without changing evidence. Then the kept phrases as white cards grouped by where they came from, each with a speaker. Then the cadence set at the foot: ten authored connectors with the note each was written with, the ones the learner has produced unprompted lifted to the top |
| Conversations | What My French's **Your conversations** row opens, and where Practice's archive went. The filters, the vault said in words, then the feed: one row per finished conversation carrying when it was, how long they spoke and what it left behind, each one opening a drill on its own phrases. The pack library opens over it in place rather than as a second push, which is why this screen answers Android's back itself. Deleting a saved conversation, and deleting all of them, is reachable here and nowhere else |

Every tab opens the same way. A **TabHeader** is the first thing in its scroll
body: a display title on the left, one plain purpose line beneath it in soft ink,
and an optional trailing **Monogram** for the learner's initial. It is not passed
to the frame's `header` slot, because a fixed display title over a purpose line is
taller than the screen at the largest reading size and has to scroll with the
content. **Home's purpose line is the hour's question**, "Ready to speak French
this evening?", which is the one purpose line in the app that changes during the
day; `surfaceContract.test.ts` holds Home to reading it from the greeting rather
than spelling it, because a sentence typed into the tab is a sentence that stops
changing and nothing would say so. Home draws no monogram: the initial is
Profile's, once, and the greeting already says the learner's name.
The header can overlap an outgoing and incoming Home greeting in one stable
line-height slot. The caller drives one native value; the frame cross-fades the
two complete phrases and starts no timer of its own.

Two rules ride with the block. **One primary pill per door**, so the eye has one
place to go on each thing it can act on. That used to read "one per tab", and it
has only ever been tightened: the count is pinned per tab at exactly what each
one draws, over the tab AND every card it draws, so a pill that moves into a
component cannot go uncounted. Home's pill is Start conversation on tonight's
card. Practice's is its recommended action: resume, a short practice, or the
first conversation, with exactly one branch shown. Tutor has one explicit
Start action in its recommendation panel, with Speak/Type selection; My French has none, because a list of places is a
list and the next place is the first row of it; Profile has none, because nothing
on it is a thing to start.

Secondary destinations are white list rows or quiet links. Labels use sentence
case and ink; the blue is reserved for brand navigation or its colour ground.

Navigation is React Navigation: a root stack whose first screen is the tab
navigator, with the lesson, the conversation, drills, review, the mission chooser
and the three routes above (`Progress`, `Phrasebook`, `Conversations`) as
siblings *above* it. The chooser is a stack screen rather than a tab
because the same surface is needed from three doors: a first run opens on it, a
Home card pushes it, and the Tutor tab's first two doors lead to it. That is what hides the tab bar on a metered screen, and what makes
leaving a live session an explicit act rather than a tab switch — a room that
survives a tab switch is a room the meter is still counting.

Each tab is a glyph and a word. The selected tab uses brand blue and the others
soft ink, with selected state announced to assistive technology. Its shared
press supplies interaction feedback; the tab itself has no moving wash.

On web the app is still a **460pt centred column**, and the navigator mounts
inside it, so the tab bar is clamped to the column rather than spanning the
browser.

## Inside a conversation

The scene screen is the orb, the thread, the current turn's support, three
white tiles (**Help me out**, **Simpler**, **Type instead**) and quiet links
for **Give me a moment** and **In English**. They wrap rather than shrink, and each one
keeps the 44pt floor, because this is the row a learner reaches for one-handed
while something has gone wrong for them.

Three rules the row now keeps that it did not:

- **Hear it is only drawn when there is a line to hear.** `hear` speaks the
  support line, so on a hint turn, an options turn or a bare turn the button
  was pressable and silent. It is hidden instead of being taught to speak the
  tutor's line, which would hand back exactly what the support ladder withheld.
- **Replay lives on the tutor's last bubble**, not on a sixth chip. Tapping it
  plays that line again, and the bubble now shows its ear so the affordance is
  found rather than guessed: ink while quiet, the accent on a `groundDeep`
  disc while the tutor is sounding, exactly as an option card's ear. Every
  tutor bubble carries a caps label with the tutor's name above it, so a thread
  read back later still says who spoke.
- **A learner who prefers typing** opens the conversation with the reply box
  already showing and the microphone closed until the circle is tapped; the
  tutor still speaks. It is a standing choice in Profile, not the quiet door,
  which is still taken per session where the learner is standing.
- **Give me a moment stays enabled while the tutor talks.** Everything else in
  the row asks for a line and would talk over them. This one asks the clock to
  wait, and it is answered on screen in the quiet notice slot and never aloud,
  because a spoken acknowledgement of a pause is a remark on the pause. The
  line reports the tutor rather than the learner.

**One quiet line at a time**, in the slot above the control row. A voice hiccup
goes there and clears itself after eight seconds; a connection being rebuilt
goes there and does not, because a blip outlives eight seconds easily and the
one sentence explaining a dead room must not disappear while the room is still
dead. When both are true the reconnect is what shows. Neither is ever how a
safety message is drawn.

**The quiet door is taken where the learner is standing.** "Unable to speak
right now?" and "Continue by typing" both go quiet in the room that is already
open: the microphone goes down, the tutor stops speaking, and the scene, the
meter and the thread all stay. It used to rebuild the session, which asked the
account for a second grant while the first was still running and answered the
learner with a refusal.

**Coach marks** replace the four-page intro: one short note in `groundDeep` at
`radius.chip`, above the control row, dismissed by tapping it or by using any
control. At most one on screen, at most one *new* one per conversation, each
shown once ever. That last pair of rules is what stops three notes becoming the
manual again, spread out.

**The completion moment** is a card in the support card's own place, so the
screen keeps its shape. It carries the mission's own sentence about what the
learner did, one pill (**Keep talking**, with a line under it saying plainly
that carrying on uses minutes) and one ghost (**Finish and see your recap**).
No confetti, no score, no percentage, nothing about how well. It arrives on the
app's one settle and shows exactly once, at the turn the mission completes.

## Copy

**Chrome is plain English.** Sentence case on buttons; the caps look lives only
in the micro-`label`. French appears exactly where it is content: tutor lines,
lesson text, phrases and their glosses, review fronts, register vocabulary —
and on Home, where the greeting takes turns through seven words with the
learner's name, and where the word of the day and the daily situation's starting
line are French because they are the content. The greeting is the one place the
chrome speaks French.

**Seven greetings, and the hour decides which.** "Salut", "Hello" and "Coucou"
any time; "Bonjour" and "Morning" while it is still day; "Bonsoir" and "Evening"
after six, through midnight. Teaching somebody to say Bonsoir at breakfast is
teaching them wrong, so the pool is filtered by the hour rather than shuffled.
**The greeting and name move as one phrase.** The outgoing phrase rises one
complete line while the incoming phrase rises from the slot below it, on the
native driver with a cubic ease. The two opacities always add to one, so the
heading never disappears between words, while the full-line separation keeps
the phrases from doubling over the same baseline. React keeps the arriving phrase visible
until it is committed as current, then resets the animation before paint. At
accessibility text sizes the fixed-height animation stands down and the full
title wraps in normal flow. A learner who asked for less movement gets one still
word, the hour's French one, and a screen reader hears that same
line once: a header that renamed itself every few seconds to somebody listening
would be the most hostile thing in the app. The conversation OPENS in English (the spoken question, no menu)
with the French riding along on screen as exposure. The old FRENCH · ENGLISH
paired furniture is retired.

Prose rules: no em dashes where a learner reads, short plain sentences.
Enforced twice — `packages/core/src/copy.test.ts` for core content, and
`apps/mobile/src/copy.test.ts` which walks every non-test app source file and
fails on an em dash outside comments.

Two hard rules, held from the enamel era:

- **No mid-session message contains a number.** End cards may count; a session
  may not score.
- **No mid-session message scolds.** No "wrong", "bad", "failed", "incorrect".
  A rescue reads *"Let's take that one together."*

## Motion

The voice orb, shared press, motion primitives, celebration host and bounded
state feedback animate. Motion answers something that really happened: a
press, a choice, a save, a finished practice. It never stands in for content,
never invents progress, and never holds the learner's next tap for long.

Built so far (come alive, Phase 0): the tokens, the one door to the engine, the
reduce-motion bridge, the press depth and selected ring, and the haptic
vocabulary. The other primitives, the celebration host and the sound effects
arrive in later come-alive phases and follow this section when they do.

### Principles

- Motion answers a real, persisted event. Nothing celebrates a guess, a fake
  count or a safety stop.
- Content is never withheld. Reduced motion shows the final frame, never
  nothing.
- Input is never blocked for more than `INPUT_READY_MS`, 600 ms, and a
  celebration's last beat ends by `CELEBRATION_MAX_MS`, 2600 ms.
- Reduced motion is watched, not sampled. `useReduceMotion` in `motion.ts`
  subscribes to the OS setting. Reanimated reads the setting once, when it
  loads, so `motion/ReduceMotionBridge.tsx`, mounted once in `App.tsx`, hands it
  the live answer, and every call through `motion/drive.ts` passes the same
  answer explicitly. In development Reanimated logs one warning when the bridge
  mounts; that warning is the bridge working.
- Transform, opacity and dash offsets only. Layout props never animate, except
  the busy `MorphButton` closing to a circle.

### Engine and tokens

Reanimated 4.5.1 with Worklets 0.10.1 is the one engine. It is imported as
`Reanimated`; `Animated` always means React Native's legacy module, which the
files still on it keep until they move. That list only shrinks. The numbers are
`motion/tokens.ts`, and nothing else writes a spring:

| Group | Tokens |
|---|---|
| `DUR` (ms) | instant 0, micro 120, fast 180, base 260, settle 380, slow 420, flight 480, reveal 650, count 900, celebrate 900, burst 1400 |
| `STAGGER` (ms) | tight 40 (words), base 60 (rows), loose 90 (icon rows), tiles 140 (stat tiles) |
| `EASE` | out (0.22, 1, 0.36, 1), settle (0.33, 1, 0.68, 1), inOut (0.65, 0, 0.35, 1), in (0.55, 0, 1, 0.45), linear |
| Press | `PRESS_SCALE` 0.97 for controls, `PRESS_SCALE_TILE` 0.95 for tiles, `SELECT_POP` 1.03 |
| Budgets | `INPUT_READY_MS` 600, `CELEBRATION_MAX_MS` 2600, `BURST_MAX` phone 36, iPad 56, web 24 |

Each spring is described the way iOS describes one, a response and a damping
ratio, and converted rather than eyeballed: stiffness = (2π / response)²,
damping = 2 × ratio × √stiffness, mass 1. `tokens.test.ts` holds every spring
to its description.

| Spring | Response | Ratio | Stiffness | Damping | Use |
|---|---|---|---|---|---|
| press | 0.30 s | 0.70 | 439 | 29.3 | the press |
| pop | 0.35 s | 0.55 | 322 | 19.7 | the select pop, chips, medals, numbers |
| settle | 0.50 s | 0.85 | 158 | 21.4 | bars and cards |
| snap | 0.20 s | 0.80 | 987 | 50.3 | detents |

### The press

Every tappable part presses through `Press` in `components.tsx`: the drawn
surface scales to `PRESS_SCALE`, 0.97, on `pressTo` and the press spring, and
springs back on lift. Option tiles and icon buttons pass `depth="tile"` and
press deeper, to 0.95. A ratio of 0.7 overshoots a little on release by design.
Do not round the numbers further; a clamped press is a change to STYLE first.

A choice passes `selected`. When it becomes the chosen one the surface rises to
1.03 and settles home on the pop spring, and a blue ring layer fades in four
points around it, resting at 0.16 opacity. The ring is a view under the
surface, not a shadow. The caller swaps fill and words at once and
`accessibilityState` says what was chosen, so the ring is decorative. There is
no second haptic on select. Under reduced motion the scale lands at once, the
ring shows at rest and nothing pops.

A press is cancelled by Pressable itself: when a scroll takes the responder it
fires `onPressOut` and never `onPress`, so the spring returns and nothing
happens.

The highlighter does not draw in. It is SNIPPETS' band, whole from the first
frame. `drawIn` and `DRAW_MS` stay exported with no caller until Stage 6
retires them.

### Primitives

The primitives live in `motion/`, and screens compose them; a screen never
imports the engine. Each takes its answer from `useReduceMotion()`, is
`pointerEvents="none"` and decorative when it is decoration, and stops on its
final frame when it unmounts or the app leaves the foreground.

- `StaggerIn`: children arrive in turn, once, on first mount.
- `CountUp`: a real number counts to its value; a screen reader hears only the
  final value.
- `ProgressRing`: a ring draws by its dash offset to a stored fraction.
- `LivingBar`: a fill springs to its real position.
- `Burst`: seeded flat confetti in the palette's colours, at most `BURST_MAX`
  pieces.
- `Bloom`: three flat discs open behind a win.
- `TokenFlight`: a chosen token travels to where it is kept.
- `Glint`: one pass of light across a pill that has just become available.
- `MorphButton`: a button that shows it is busy, and done only from a real
  result.
- `Enter`, `Reflow`, `Exit`: entrances, reflows and exits in a layout.

### Celebrations

One host in `celebrate/`, mounted once at the root, plays every celebration. It
merges what arrives together and plays at most three takeovers after one
practice. It holds while a microphone or a live room is open, a sheet is up, or
the app is in the background, and it clears its queue on a safety stop: a
safety stop gets no celebration, sound, haptic or count. The first tap skips to
the end, Continue is ready within 600 ms, and nothing dismisses itself. Each
celebration plays once per real event. A reply accepted and a finished practice
show in place, on the page they belong to.

### Loops

Four things loop: the live orb, a busy `MorphButton`, a held icon state such as
a speaker that is playing, and the Home flame, which flickers three times when
Home comes into view and then rests. Each loop listens for what pauses it
(focus, the app state, or its own `playing` or `paused` prop) and stops there.

### What never moves

The tab bar, the greeting, the highlighter, the skeleton, the layout
primitives, the flat drawings themselves (a wrapper may move one; the drawing
does not), and legal or consent text. Inside a live room only the orb moves; a
win there shows in place, and its fanfare waits for the recap.

### Haptics

Through `motion/haptics.native.ts`, with safe no-ops on the web, and only while
the haptic setting is on and no microphone is open. Every native call swallows
its own refusal, so a haptic never blocks navigation or learning state.

| Moment | Haptic |
|---|---|
| Any press (the default) | `pressed()`, a light impact |
| A choice, a toggle, a tab | `tapSettled()`, a selection tick |
| A hint arriving | `soft()`, the softest impact |
| Something earned arriving | `arrived()`, one success |
| A step in a count | `tick()`, a selection tick at least 60 ms after the last |
| A weight landing, a flame lighting | `thump()`, a medium impact |
| A real win: a finished practice, a level, a confirmed purchase | `celebrate()`: success, then medium at 140 ms, then light at 280 ms |
| An error, a refusal, a safety stop, anything in a live room | nothing |

Each beat of `celebrate()` asks the setting again as it fires, so a microphone
opening mid-pattern silences the rest, and `cancelHaptics()` drops whatever has
not fired. `Press` takes `haptic`: `light` by default, `selection` for a choice,
and `none` where the caller answers for itself, as the tab bar does.

### Sound

Twelve short sounds, synthesised for Luvani: tap, select, correct, nearly,
complete, streak, levelup, quest, badge, save, count-tick and whoosh. None plays
until the founder has approved it by ear. Sound effects follow the silent
switch, have their own Settings switch, mix with the learner's music, and never
play while a microphone is open, the tutor is speaking or a live room is open.

### Enforcement

`motion.test.ts` holds the rules:

0. `Animated` means React Native's legacy module; Reanimated is imported as
   `Reanimated`.
1. The engine is imported only in `motion/`, `celebrate/`, `game/art/`,
   `onboarding/firstRun/`, `icons/AnimatedIcon.tsx`, `nav/TabGlyph.tsx`,
   `drill/AnswerSheet.tsx`, the orb layers in `tutor/`, `live/RoomLevels`,
   `speech/useRecorderLevel.ts`, and in `components.tsx` only by `Press`.
2. The legacy `Animated` file list only shrinks.
3. Every file that moves reads reduced motion from `motion.ts`, and nothing asks
   Reanimated for the system setting: no `useReducedMotion`, no
   `ReduceMotion.System`, and `ReducedMotionConfig` only in the bridge.
4. A loop runs only where it can be paused.
5. The engine's animation calls (`withTiming`, `withSpring` and the rest) live
   only in `motion/drive.ts`, and every spring is a named token.
6. Only dash offsets and opacity animate through props, and only `MorphButton`
   animates a layout prop.
7. No test imports a module that imports the engine, `expo-audio` or
   `expo-haptics`, because a suite that cannot load disappears.

`tokens.test.ts` holds the springs to their derivations, `components.test.ts`
holds the pill, the link, the ledger row and the segmented control to `Press`,
and `motion/haptics.test.ts` holds the haptic vocabulary.

No interface surface casts a shadow.
## Evidence and remaining work

Core owns earned independence. Bounded completion history preserves its strongest
valid rung and recent replays, on the device and after sync. New day counts retain
date keys when detailed activity ages out. A quiet week supplies no story. A failed
read supplies no new achievement claim.

All six mouth guides are recovered from the original local design kit.
New live task judgments, spoken own-words and hands-free background sessions still
require their backend contracts, real-domain evaluation and the required independent
review. Live pronunciation remains disabled under the founder's existing decision.
The worktree continuation report records those gaps and verification limits.

## What has no design yet

The app icon and splash artwork in `app.json` are still the enamel era's
placeholders on paper-coloured ground.

### Video review implementation, 4 October 2026

The founder approved expanding the motion contract. `motion/Feedback.tsx` is the
shared animation host for the post-onboarding app. It applies opacity and at most 4pt translation to a
real selection, setup-context change, durable save, completed local practice,
requested help or reopened kept material. Timings are 200/260/440/320/200/260ms
in `motion/feedbackPolicy.ts`; the existing earned-only confetti falls once over
650ms. These are prototype timings, not research measurements. Content and
controls remain available throughout. Reduce Motion shows the final state;
unknown settings wait conservatively. Backgrounding and unmount stop motion.
Event identifiers deduplicate responses in bounded session memory and are never persisted or transmitted.
At that review the press spring and the controlled VoiceOrb were the only
spring and continuous movement; the Motion section now governs both. No fake
progress, punitive mascot or artificial processing delay is added.

Four primary tabs: Home, Speak, Practice, Progress. Friends is an optional stack
screen reached from Profile, preserving its URL, invitations and privacy controls.
Home and Speak use `NextTaskCard`: unfinished personal practice, usable personal
practice, then the next authored scene; unavailable live service offers the same
bundled coffee line in the selected tutor's voice. Empty Practice uses that same
card. Colour belongs to meaning: blue next task, sun local café practice, coral
recap with a white French reading surface, mint independently earned can-do.
The first recap view leads with actual French, never a count or illustration.

## Onboarding interaction update — October 2026

The opening, goal choices and result use existing vibrant vector brand illustrations with no mascot. Omit decorative eyebrow labels, pills, repeated account pitches and a tall syllabus. Questions lead with one readable heading, illustrated full-width options and deliberate Next; the shared primary control uses radius.control. Keep meaningful native secondary sheets over the parent page.

Onboarding motion is interruptible and event-driven: card 180 ms; Next arrow 100/140 ms; page opacity/translation 270 ms; progress transform 220 ms; illustration pulse 140/220 ms or 300 ms success settle; sheet 310/250 ms. No loops or blocking celebrations. Native uses supported opacity/transform drivers; web uses its supported driver. Live Reduce Motion changes cancel to final states. One accepted-action haptic, no duplicate selection tick and no vibration during recording; honor the Settings preference. Preserve screen-reader heading focus, modal trapping/restoration, keyboard/safe-area behavior and the visible Close/Cancel action.
