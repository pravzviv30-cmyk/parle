# Design

<!-- Recorded from the built artifact, not from intentions. Every value below is
     read out of apps/mobile/src/palette.ts and the screens as shipped. The
     previous design system (enamel wayfinding, dark Métro-plaque green) lives
     in full at the repo's baseline commit. -->

## The world

**Modern Atelier, with a French Journal accent.** The founder selected a blend
weighted toward direction 5 on 18 September 2026. Warm paper, near-black ink,
chartreuse feature surfaces, graphic rules and bold sans headings give the app
its structure. Fraunces French phrases, small editorial notes and contextual
illustrations bring the journal's warmth.

This replaces Colourful calm's violet identity and rounded white-card treatment.
The primary action is dark ink with warm-white lettering. Chartreuse is a
surface carrying dark lettering, never a state or a low-contrast text colour.
Secondary rows are white with a coloured place stamp, so a list stays cohesive.

Screens share the same frame, controls, typography, card geometry and navigation.
One primary action remains clear. There are no fake learning counts, no streak
pressure, no text clipping and no cap on the learner's reading size.

### Current composition rules

- Tutor revision (20 September): the chartreuse recommendation panel leads with
  an actual unfinished mission, an eligible conversation continuation, or the
  next guided mission. A compact 96pt orb reports the tutor's state and is not
  pressable. It sits beside clear Speak/Type selection and one dark Start pill,
  the single launch, and both Speak and Type note that they use live minutes.
  Pronunciation and tutor-memory controls are directly reachable. Missions says
  each situation uses live minutes before any card. Mission rows show their goals
  and recorded status. Real Moment discloses Max before setup and distinguishes a
  failed plan read from an upgrade.
- Live Tutor keeps its purpose in the header and its microphone near the reply
  controls. Corrections offer a natural alternative without crossing out the
  learner's words; scrolling back through the transcript does not force a jump
  to new messages. Guided lessons explain support in words and reveal IPA on
  request. Recaps and lesson summaries read what went well, one focus, practise
  it, then Done; everything else sits under one closed More below Done. A focus
  sound leads with an example word and its symbol is optional. Retry after a
  failed phrase save is kept. A live error leads with its recovery actions; the
  technical rows sit under a closed Support details. Memory editing and clearing
  are explicit; clearing details requires confirmation and keeps goals and saved
  conversations.

- Feature: chartreuse, an ink rule, 12pt corners. Used for the mission hero,
  onboarding story, tutor studio, profile identity and chosen plan.
- Journal: warm paper, a strong left rule and French serif text. Used for
  phrases and lesson content. Illustrations live within a scene or story.
- Utility: white paper, an ink outline, 8pt row corners and compact stamp icons.
- Display headings: DM Sans Bold 34/39. Card headlines: DM Sans Bold 26/31.
  French remains Fraunces 28/36, 21/28 or 17/23 according to context.
- Primary buttons: 56pt minimum, 8pt corners, dark ink. They grow for large text.
- Navigation: five labelled SVG icons at 24pt, 12pt labels, 60pt minimum cells,
  an inset ink-outlined dock and a chartreuse selected surface. The dock is capped
  at 640pt on iPad. Safe-area space sits outside it. Labels wrap and grow the dock.
- Tab pages begin with their screen title, not a website-style brand/tagline bar.
  Shared content is capped at 760pt with safe-area-aware gutters on both sides.
- Home: greeting and a labelled profile avatar, one useful next action, then
  “Your French in practice”: Days active, Retained phrases, Recall and Practice
  time in four compact tiles. Practice time is active learning time, typed or
  spoken, with idle gaps excluded, and is separate from billed minutes. The
  existing progress model still owns the counts.
  One swipeable Word/Phrase card sits directly below, with two labelled pills,
  the existing decorative illustrations and brief, reduced-motion-aware animation.
  The separate Real progress route is removed; evidence-backed weekly details
  expand inline. Friends appears only for useful activity. Review opens from the
  hero or the Recall tile, the optional target from the Practice time tile. After
  practice with no conversation yet, the café hero reads Your first conversation.
- Bottom destinations: Home, Speak, Practice, My French, Friends. Profile is a
  pushed screen reached from the same labelled avatar on every root tab; Settings
  is its first row. Friends is opt-in, friends-only and based on real learning
  activity, with no global leaderboard or punishment for missing a day. Before
  joining, Friends shows one start and a secondary privacy link; the circle's
  own doors appear after joining.
- Daily collection: 1,000 words and 1,000 phrases, stated on the Words and
  Phrases tabs only. The first voiced subset has 200 of each in all six tutors,
  bundled Flash recordings at a moderate -4 dB. Home picks only from that
  level-appropriate subset. An empty Saved tab leads with three voiced first-tier
  starters. Every library card says whether it has tutor audio before it is
  tapped. Hear and Slow replay follow the selected tutor without a speech API or
  generic fallback. Unvoiced library items retain text, Save and self-recording
  practice; examples remain text-only.
- Phrasebook: the learner's own lines lead; the authored connectors are an
  optional collection, closed by default. Settings: Delete account sits in its own
  card at the foot. Out of minutes: the inline paywall shows the store offer with
  its renewal terms and legal links, or a store-unavailable block with Restore and
  the legal links; Back always sits outside it.
- Sound journey: My French's sound row opens the focused sound journey once more
  than one measured check exists and one has called out a sound; otherwise it
  opens the sound check. The journey leads with an example word, keeps the symbol
  behind a toggle, and shows no number except how many measured checks called the
  sound out. A line is said to come back clear only when that same line was later
  measured with nothing called out.
- Goals: written goals sit on My French under What you want from French, one row
  card each, with the goal in the learner's words and one next mission. Only a
  keyword match says matches your goal; anything else, a negated goal included, is
  a good place to start. The goal screen has one pill, Start this conversation,
  with the connection and live-minutes line under it, and a trail of the
  conversations opened from it. "I used this outside the app" is the learner's
  own word and never counts toward review, XP or Practice time. Routes carry an
  opaque key, never the goal's words.
- Conversations: a revisited conversation shows Before and after on its detail,
  with the curated correction it was briefed with, what was practised before, and
  whether that correction came up again. It never claims the variation went well.
- Listening preview: the Missions hero carries a quiet Hear an example first. Once
  known, its label names the source exactly (recorded tutor audio, device voice or
  text only), and it always says it is an authored example, not the learner's
  conversation. It stops when the chooser is left or the app goes to the
  background.
- What costs minutes is said in one vocabulary (`copy/access.ts`): every door into
  the pronunciation lesson says it uses live minutes while the tutor is connected,
  and no line calls typed tutoring free. Home's weekly details end with a short
  reflection, Your week, in short: what went well, one thing to keep working on
  and a place to go next, each drawn only from recorded evidence, and nothing when
  there is none.
- Onboarding: a chapter marker, a graphic story panel, a meaningful illustration
  and an immediate next action. The demonstration is still interactive and
  consent remains optional and initially off.
- Shared subpage headers and fixed action footers use ink rules. Forms, empty
  states, live-room controls, recaps, plans and legal pages inherit the same
  vocabulary. Functional voice-state colours keep their existing meaning.

The interaction history below remains useful for the learning flows. Where its
older visual descriptions differ, these composition rules and the current code
are authoritative.

The navigation/interaction history below also predates the 19 September Home
and Friends revision. References there to a Profile tab, a separate Progress
route or Settings at the bottom are historical, not the current navigation.
The current composition above and `docs/HOME_FRIENDS_REVIEW.md` supersede them.

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

Where `signal.good` is drawn as a fill or a mark (the SpeakCircle's live disc
and glow, an earned chip, a dot), it is ink until Stage 3 redraws each with the
mint tick.

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

One. **The live glow** is the halo under `SpeakCircle` while the microphone is
open, the one shadow that reports something. It is drawn in `signal.good`, so it
is ink until Stage 3 redraws it. Nothing else floats: a card is told from the
page by its white on the warm paper alone, with no hairline.

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
always the largest text in its block. The old font names (`serif`, `serifBold`,
`sans`, `sansMedium`, `sansBold`) are aliases of an Outfit cut until Stage 6.

Sizes are points and scale with the OS reading size. Line heights are STYLE's
ratios rounded to whole points, and tracking is STYLE's em value at the size.
`theme.test.ts` pins every row below. It fails if the theme names a face
`App.tsx` does not load or the fonts folder carries one nothing loads, if the
French hero is not larger than the screen title, and if `frenchLg` is not larger
than a heading.

| Style | Face / size | Use |
|---|---|---|
| `hero` | Outfit ExtraBold 112/95, -4.5 | The one giant number on a story or colour card, at most one per screen |
| `display` | Outfit ExtraBold 44/44, -1.3 | A headline on colour, and for now the tab title in `TabHeader` |
| `title` | Outfit ExtraBold 30/33, -0.6 | The title of a working screen (today also the section heads Stage 3 remaps) |
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
- **OptionCard** — a tappable choice: French in the serif, English gloss under,
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
- **Tab bar** — flat on the paper with a top hairline: no inset dock, no
  outline, no chartreuse, no wash and no animation. Selected is an ink glyph and
  a DM Sans Medium word; unselected is a faint glyph over a soft-ink word (the
  word stays soft ink because faint ink sits on the text floor's edge). 60pt
  cells, labels wrap at large text. The five tabs read Today, Speak, Practice,
  My French and Friends; the route names are unchanged.
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

Round 1 ships 23:

| Drawings | Sits on | Large | Small |
|---|---|---|---|
| `place-cafe-counter`, `place-cafe-terrace`, `place-hotel`, `place-market`, `place-directions`, `place-day`, `place-apero` | A blue or coral card | 350 by 220 | 262 by 165, a hero spot |
| `state-notebook`, `state-waiting`, `state-offline`, `state-microphone`, `state-headphones`, `state-postcard-frame` | Paper, where their ink lines carry the shapes | 160 by 160 | 120 by 120, under a headline |
| `celebrate-confetti` | Blue or coral, laid over the whole card | 390 by 260 | |
| `celebrate-wrapped` | Blue | 350 by 260 | |
| `celebrate-first-line` | Blue | 350 by 220 | |
| `postcard-cafe-counter`, `postcard-cafe-terrace`, `postcard-hotel`, `postcard-market`, `postcard-directions`, `postcard-day`, `postcard-apero` | Mint or paper, in their own white border | 300 by 190 | 165 by 105, in a row |

The six mouth guides (`mouth-y`, `mouth-u`, `mouth-r`, `mouth-nasal-an`,
`mouth-nasal-on`, `mouth-zh`) wait for Round 3; the script skips them by name.
The registry arrived ahead of its screens: the missions chooser and the
onboarding plan move to the place drawings next, and Stages 3 and 4 draw the
rest as they redraw the screens that need them.

### Raster scenes, retiring

Until the two screens above move, the six place watercolours ship in
`apps/mobile/assets/art/`, each at `@2x` and `@3x`, and then they retire with
`Art.tsx`, the raster registry and its map. `HERO_ART` maps each place to its
scene. The missions chooser and the onboarding plan draw them through
`src/art/Art.tsx`, the single decorative Image renderer. Each is 300x180 points, with `resizeMode="contain"` and no crop.

| File | Place |
|---|---|
| `hero-cafe` | Café |
| `hero-hotel` | Hotel |
| `hero-market` | Market |
| `hero-street` | Street |
| `hero-home` | Home |
| `hero-friends` | Friends |

The welcome, cake, wave, empty table, recap postcard and phrasebook rasters are
deleted, including both densities and their registry entries. The wall-map art
left with its last renderer, the retired map page. The daily library and Today
show no pictures. Their French, glosses, notes, examples and audio remain.

The place art was generated on 2026-09-15 from a shared watercolour-and-line
prompt and is owned by Luvani. The founder holds originals and generation
scripts outside the repo. Files are keyed to transparency, trimmed to the ink
and quantised to 256 colours. No painted hex swatches, shadows or borders.
`registry.test.ts` keeps the budget at 350 KB per file and 4 MB total, requires
both densities and refuses anything unregistered. No asset is exempt.

### Inline SVG

The static pen in `src/illustrations/pen.tsx` uses ink strokes at the one
`STROKE` (2 since revamp B), round caps and joins, a 200x150 viewBox and stipple shading. Frame spreads `decorative` on
every SVG. `NobodyYet` and `StillWriting` retain their empty-state marks but no
longer animate. `RewardMark` remains the static tick beside a drill verdict.

SpeakBubbles, OnboardWave, the unused onboarding drawings and LearnStack are
deleted. All twenty daily-pack drawings, their selector and their unused card
are deleted. The illustration animation hook and moving layers are gone.
`motion.test.ts` and `surfaceContract.test.ts` enforce static illustrations;
only the voice orb and the highlighter may animate.
## Structure

A two-page moving welcome on first launch (the café scene says hello; page two
says what Luvani is and why speaking out loud is the point) → sign-in gate
(Welcome / Create account / Sign in) → three onboarding pages (the age gate
first, then a name, then one page saying what the tutor is; everything but the
age is skippable) → the mission chooser, with the café already picked → **five
labelled tabs along the bottom**:

That age gate has a second door. A session the tutor ended because the learner
said in a scene that they are under thirteen is remembered by the account, and
the next launch shows the same page again with two lines changed: it says
nothing about what happened, and it says that everything they have learned is
still there. Passing it is one tap and nothing else is asked twice.

| Tab | What it is |
|---|---|
| Home | Tonight's French, and nothing else. The complete greeting and learner name rise together through one clipped line, with the hour's own question under it. Then one card: the situation to walk into tonight, with the kind of offer in caps above it, its French title in the serif, one line of English saying what happens there, the watercolour of the place it happens in, how long it usually takes as `Ready for 7 min` or the learner's own measured remainder, a bookmark in the top corner, and the tab's one pill. Under it one white row, **Real progress**, carrying a single sentence about what this learner can now do on their own, and a chevron into the `Progress` screen. That is the whole tab. The word of the day, the four momentum cards and the week's story are one level down behind that row rather than deleted, and the level, the evidence and the phrasebook are My French's |
| Tutor | The tutor by name, then the orb, which reads its state from the facts: away when the servers are, connecting while a probe runs, quiet with a caption when the account has no speaking time, and violet only when a tap would start something. In that ready state, **Tap to talk** is embedded directly beneath seven white voice bars inside one large misty watercolour disc; there is no microphone icon and no frosted capsule competing with it. Every live state changes those same bars, colour and plain status rather than adding a second control. No card sits behind it, because the circle is the one focal point on the page. Then what the tutor remembers, as a peach row with the tutor's own orb on its disc, one line from a real record and a way to pick the scene up, absent for a learner with nothing behind them. Then **Practice together**: three tinted rows, one per way in, and each one a row rather than a button because the circle above is the tab's only primary. An everyday mission on peach, which opens the chooser and every situation with it; an open chat on sky, which runs the circle's own probe; rehearsing something on sage, which opens the screen where a learner names a real moment, writes one line about it and runs it in French first. The quiet "Unable to speak right now?" door and the microphone notice close the page, and the pronunciation lesson moved to the chooser's own footer |
| Practice | Doing, made from the learner's own conversations. A compact header: the title **Practice**, one short purpose line and the profile avatar. Then one **Your next practice** card: a French line set large with a round white speaker and the English under it, then where the sitting comes from said once (Includes phrases from the conversation it names, or review), then one primary pill with **Uses no live minutes** directly under it: Resume practice for an unfinished sitting, Start a short practice for a bounded mix of due review and saved-conversation phrases, or Start your first conversation when there is no playable material. The line on the card is never one the sitting then asks for: it is another line from the named conversation, a phrase the learner already holds and is not due, or a café lesson line, so a preview is never credited as cold recall. Under it **More ways to practise**, up to three rows on peach, sky and sage, each drawn only when it can start: replay a moment, which speaks the better line and opens a drill on it; make this phrase yours, the own-words drill; and tune one sound, only once a sound has been measured. They name their conversation only when the card named a different one, as a quiet From line and never a second heading. A learner with no conversation meets the same three shapes from the café lesson and one sentence saying the page becomes personal after the first. The quiet doors close the page: Scheduled review when something is due, **Choose a conversation** as the one door into the archive, and an eligible tutor revisit that says it uses live minutes. Inside a practice sitting the drill header says, in words, which phrase of how many (Phrase two of six), never a score, fraction or bar. The archive went one level down to `Conversations` rather than off the map: the vault, the feed, the filters and the pack library all live there |
| My French | Evidence and saved material, kept separate from Practice. A compact header: the title **My French**, one plain purpose line and the profile avatar, with no slogan on routine visits. A failed read is a Try again row, never an empty account. Then one progress sentence, only when source-linked completed practice supports it. Then **Your conversations**, present only once a conversation exists: up to three recent rows, each with its title, a French preview and its latest recorded outcome on separate lines, named whole to a screen reader and opening that conversation's detail in `Conversations`, then one **See all your conversations** row into the whole library. Helped practice is not labelled recall; a tutor room opening is only a revisit started. Deleted conversations are absent. Then **Your collection**, in the first useful scroll: **Your phrase shelf**, one white row carrying the phrase most worth keeping and a chevron into the `Phrasebook` route, present on a first morning too, and the **Daily collection** of saved authored items. Then **Saved for later**, the situations bookmarked from Home, and a measured sound, each present only when there is one. The situations follow, as one tinted row each on the paper of the place they happen in, with the place's line-art mark on a white disc and the state reached in a chip at the end: **French you can use** for the ones handled with nothing handed over, then **Try next**, at most two suggestions with core's own pick first, worded as suggested and never as locked or missing. A learner with nothing stamped meets one group, so no empty ability card is ever drawn. Last, one **Browse situations** row into `Missions`, where the full catalogue lives. There is no percentage anywhere on it and none is available to be drawn |
| Profile | The one tab that is a person, so it is the one tab whose header is centred: the learner's monogram at 72 above their own name, and "Your French journey, your way." under it. Then **Your tutor**, a white card of two rows: who they are talking to, drawn as the orb and never as a face, opening the voice sheet; and what the tutor remembers, in words and never as a count, opening the screen where every remembered fact can be forgotten one at a time. Then **Your speaking rhythm**, a lilac panel with the Monday-to-Sunday week as seven violet dots under their day names, one caption, and the week said as a sentence to anyone who cannot see the marks. Then **Your learning**, a white card of standing choices: the name, the flexible speaking target and the correction dial as three-way controls with the chosen gloss beneath, and prefer typing. Then the Settings row, last and alone, and everything general is behind it: the account, the plan, the subscription, the documents, the phone's own permissions, the reminder and the version line |

Three routes carry what used to be a section of a tab. Each is pushed, each opens
with the shared header's one chevron, and each was moved rather than cut, because
a section with a learner's own data behind it is worth a page.

| Route | What it is |
|---|---|
| Progress | What Home's **Real progress** row opens. A serif title, then the week told back in at most three sentences, absent entirely on a quiet week because a surface that can render empty is a quota. Then what the learner can now do, one tinted row per situation handled alone. Then the momentum block, moved here whole: **four cards**, there from the first day and worded as a start where a number would be nought, which are retained phrases with two of the learner's own lines, days active with the **week rail** under it, recall over reviews once ten of them are behind it, and **Practice time today**, which shows measured active learning minutes (typed or spoken, excluding idle and away gaps and separate from the metered balance) beside the optional Profile target as a gentle sentence, never a fraction, percentage or progress bar. Then the word of the day at the foot, which is a fact about the day rather than a claim about the learner, drawn with one of the daily pack's twenty and stopped the moment something is pushed over the top of it |
| Phrasebook | What My French's phrase shelf opens. The one-line card first, a single phrase from the deck with the English showing and the French withheld until an attempt lands, because the thing worth doing should never sit under a list of things already done. Then the kept phrases as white cards grouped by where they came from, each with a speaker. Then the cadence set at the foot: ten authored connectors with the note each was written with, the ones the learner has produced unprompted lifted to the top |
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

Where a tab would once have grown a second pill it grows a **tinted row**
instead, and each list is drawn one way: the three ways in on Tutor, the three
made-from rows on Practice, the situations and the shelf on My French. And a caps
`Label` is violet, or it reports a state in ink, never faint: faint ink was only
ever cleared as a mark, not as a line a learner reads.

Navigation is React Navigation: a root stack whose first screen is the tab
navigator, with the lesson, the conversation, drills, review, the mission chooser
and the three routes above (`Progress`, `Phrasebook`, `Conversations`) as
siblings *above* it. The chooser is a stack screen rather than a tab
because the same surface is needed from three doors: a first run opens on it, a
Home card pushes it, and the Tutor tab's first two doors lead to it. That is what hides the tab bar on a metered screen, and what makes
leaving a live session an explicit act rather than a tab switch — a room that
survives a tab switch is a room the meter is still counting.

Each tab is a glyph and a word. There is no filled-icon variant, because a solid
icon would be the first two-weight mark in the app. Active is the identity violet plus a heavier
weight on both the glyph and its word, with a quiet lilac wash settling in behind
the glyph, so the whole cell answers the tap without adding a dot. The wash uses
opacity and scale on the native driver and lands immediately when reduced motion
is requested. A long word wraps and the bar grows to hold it.

On web the app is still a **460pt centred column**, and the navigator mounts
inside it, so the tab bar is clamped to the column rather than spanning the
browser.

## Inside a conversation

The scene screen is the orb, the thread, the current turn's support, and one
row of small ghost controls: **Help me out**, **Give me a moment**, **Slower**,
**In English**, **Type instead**. They wrap rather than shrink, and each one
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

The notebook's rule was "Only the voice orb and the highlighter animate."
Revamp B changes both halves (STYLE section 11): the highlighter is a still band
now, and every tappable part presses on the one spring. So two things move: the
voice orb, which loops, and the press, which springs and settles. The strict
source allow-list is `components.tsx` (`Press`), `motion.ts` (the shared drivers
and the one spring) and `tutor/VoiceOrb.tsx`. There is no PENDING allowance.
Decorative illustrations, the greeting and the tab bar are static. The old
illustration hook and moving layers are deleted, and `RewardMark` is a still
tick.

`useReduceMotion` observes the OS preference. Reduced motion shows the final
frame rather than hiding content: a press lands at its scale at once, and the
orb holds still. VoiceOrb owns its speaking, listening and thinking movement and
stands down when paused. The orb keeps its captions, its mark and its state
colours when still; motion never carries information on its own.

### The press

Every tappable part presses through `Press` in `components.tsx`: the drawn
surface scales to `PRESS_SCALE`, 0.97, on `pressTo`, the one `Animated.spring`
in the app, and springs back on lift. STYLE gives the spring the way iOS
describes one, response 0.3 s and damping ratio 0.7. Animated takes physical
numbers, so they are converted rather than eyeballed:

| Number | Derivation | Value |
|---|---|---|
| stiffness | (2π / 0.3)² = 438.6 | 439 |
| damping | 2 × 0.7 × √439 = 29.33 | 29.3 |
| mass | | 1 |

A ratio of 0.7 overshoots a little on release by design. Do not round the
numbers further; a clamped press is a change to STYLE first. The spring asks for
the native driver everywhere but the web (`NATIVE_DRIVER`), where the native
module is absent and a spring asked to cross stalls. A press is cancelled by
Pressable itself: when a scroll takes the responder it fires `onPressOut` and
never `onPress`, so the spring returns and nothing happens. `motion.test.ts`
holds the spring to `motion.ts` and to these numbers, and `components.test.ts`
holds the pill, the link, the ledger row and the segmented control to `Press`.

The highlighter no longer draws in. It is SNIPPETS' band, whole from the first
frame. `drawIn` and `DRAW_MS` stay exported with no caller until Stage 6
retires them.

The enforced rules:

- Transform and opacity only. Loops and entrances use `useNativeDriver: true`;
  the press spring uses `NATIVE_DRIVER`.
- Never animate SVG geometry or layout dimensions.
- One spring, the press, written once in `motion.ts`. Nothing else bounces.
- No scene loops, animated greeting swaps or moving tab washes.
- Reduced motion is watched, not sampled only once.

### Haptics

STYLE section 11, through `motion/haptics.native.ts`, with safe no-ops on the
web. A press is a light impact (`pressed()`), a choice or a toggle is a
selection tick (`tapSettled()`), something earned is a success
(`arrived()`), a hint arriving is soft (`soft()`), and an error is nothing.
`Press` takes `haptic`: `light` by default, `selection` for a choice, and `none`
where the caller answers for itself, as the tab bar does. A haptic refusal never
blocks navigation or learning state.

The live microphone glow remains the only shadow. The voice orb casts none.
## Three deliberate divergences

Written down so nobody "fixes" them back:

- **Practice counts, and it withholds rather than rounding down.** The archive
  is not mid-session, so it may say six conversations and ninety-two phrases.
  What it may never say is nought: a count with nothing behind it is left out
  of the rail, a session nobody timed carries no minutes line rather than "0
  min spoken", and a filter that would select everything or nothing is not
  drawn at all. `practice/archive.ts` owns every one of those decisions, so the
  screen has nothing to round.

  This replaced a different divergence, and it is worth saying why rather than
  letting the old one look forgotten. The authored practice path deliberately
  did not gate: every node was open in any order and sequence was one node
  marked next. The founder replaced the whole path with their own mockup, so
  there is no longer a path to gate or not gate. The principle it protected,
  that support is withdrawn as the learner improves and never withheld until
  earned, is unchanged and lives in the ladder.
- **Home and My French may count.** DESIGN.md's rule is that no
  *mid-session* message contains a number. Home is not mid-session, so the
  board counts and the tutor still does not — no numerals in watchdog copy, no
  counts in the transcript, dots rather than numbers on progress.
- **The calendar's dots take the identity violet.** The standing rule is that a
  state mark is never violet, so nothing on a screen reads as the primary action
  when it is only reporting. The week rail bends it: a filled day in Profile's
  speaking rhythm and in Home's momentum card is `accent.primary`, and the
  founder chose that colour deliberately. The reasoning is that a calendar is not
  a state — it is a diary of days already spent, and it asks nothing. The orb's
  traffic lights remain the only marks in this app that report a state, and none
  of them is violet. The rail still says no number: it draws seven marks and the
  day names, and whatever card it stands in says the week in a sentence.

## What has no design yet

The app icon and splash artwork in `app.json` are still the enamel era's
placeholders on paper-coloured ground.
