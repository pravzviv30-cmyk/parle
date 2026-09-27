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

One ground, and everything else earning its place against it. Every raw value
lives in `apps/mobile/src/palette.ts`, which imports nothing so that
`palette.test.ts` can hold it to a contract; `theme.ts` composes its tokens from
there and carries no raw hex of its own. The tables below are that palette, read
back out of the code: `palette.test.ts` fails if this document and the export
disagree on a single value.

### One ground: warm paper

The five place-keyed papers are gone. The founder rejected a muted scheme of five
grounds a hair apart, so there is one warm paper ground under the whole app,
and colour earns attention by meaning something rather than by marking where the
learner happens to be. The card lifts off the ground, each hairline separates
from what it rules, and the steps are held by Delta-E rather than by matching
four siblings at one lightness.

| Token | Value | Role |
|---|---|---|
| `paper.ground` | `#F7F3E8` | The page — everything sits directly on it |
| `paper.groundDeep` | `#E6DECD` | Pressed states, chip fills, the tab track |
| `paper.card` | `#FFFEFA` | Card surface, flat, one hairline rule |
| `paper.ink` | `#182019` | Near-black ink with a subtle green cast |
| `paper.inkSoft` | `#51584C` | Secondary text |
| `paper.inkFaint` | `#6A7266` | Tertiary — counts, placeholders, the inactive tab glyph |
| `paper.line` | `#B8BCAD` | Hairline rule on the ground |
| `paper.lineOnCard` | `#DADBCF` | Hairline divider inside a card |
| `paper.onInk` | `#FFFDF5` | Warm-white text on a filled control |

`inkFaint` moved from the old `#94849F` (2.91 against the ground, under the mark
floor) to `#6A7266` so the inactive tab glyph reads as a mark.

### Ink identity, one highlighter

The French notebook with one highlighter (redesign Phase 1, 27 September).
Primary actions and micro-labels share the same dark ink, and `accent.label`
equals `accent.primary`. The chartreuse is no longer a surface. It is one pen,
`highlight`, legal in exactly three places: the `Highlight` band behind a
French line, the `LevelPath` "you are here" stop, and the brand mark (an SVG in
`assets/brand/`). At most one per screen, always under ink, and never the
ground of a panel, tile, avatar, tab, title, card or button.

`accent.feature` is retired. `palette.test.ts` refuses the alias in the palette
and any use in production source, with no transitional allowances.

| Token | Value | Role |
|---|---|---|
| `accent.primary` | `#182019` | The one ink pill |
| `accent.label` | `#182019` | Micro-labels — the caps line above a card |
| `highlight` | `#D8FF54` | The highlighter: a band behind a French line, the "you are here" stop, the brand mark |

Ink clears 14.6 on the highlighter and soft ink 6.4; the highlighter stays a
Delta-E of 30 from every signal, orb state, rung, the ground and the card, so it
never reads as a state, a support level or the page. `palette.test.ts` walks
the source: the hex lives only in `palette.ts`, the token is spelled only in
`palette.ts`, `theme.ts` and `components.tsx`, and inside `components.tsx` only
within `Highlight` and `LevelPath`.

**An accent is typographic; a signal is a mark.** A label, a chip, or a drawing's
one solid fill may take the accent. A dot, a ring, or anything reporting state
never may, and no accent comes within a Delta-E of 30 of any signal or rung.

### Signals, re-saturated

Muted greys-with-a-hue became full colour again. Green and magenta are words and
clear the 4.5 text floor on the ground and on a card; the tutor's red only ever
marks the orb, so it is held to the 3 floor for a mark and its caption is ink.

| Token | Value | Role |
|---|---|---|
| `signal.good` | `#12784A` | A sound that is working — the same green the learner speaks in |
| `signal.correspondance` | `#B4008A` | Something to change |
| `signal.live` | `#DE3B2D` | The tutor's voice, a mark and never words |

### The voice circle speaks traffic lights

`orb` is taught to every new learner by TutorIntro's final page, so these values
changing means that page is teaching a lie — change both. Each state is a mark and
clears 3 against the ground; the caption below it is ink. The three lights stay a
Delta-E of 30 from each other and from rung one's yellow.

| Token | Value | Caption / role |
|---|---|---|
| `orb.speaking` | `#DE3B2D` | Listen: the tutor is speaking (aliases `signal.live`) |
| `orb.yourTurn` | `#12784A` | Speak: your turn (aliases `signal.good`) |
| `orb.thinking` | `#B07510` | One moment: the tutor is thinking |
| `orb.ready` | `#182019` | Tap to talk: the untapped control (aliases `accent.primary`) |

Ink is not a fourth traffic light. A closed microphone waiting to be tapped is
the primary control of the whole product, so it takes the primary colour exactly
as the primary action does, and it changes to a signal when the orb reports state.

### Support colours run hot to cool again

A rung colour is a fill under an ink numeral, not a state mark, so it is held to
ink at 4.5 on the fill rather than to the mark floor against the ground — nothing
reads a rung against the ground, an ink numeral reads against the rung. The b\*
channel falls rung by rung, so support visibly cools as it is withdrawn, and rung
four is plain ink: no line left to follow.

| Token | Value | Meaning |
|---|---|---|
| `rungColor[1]` | `#FFCD00` | Echo — repeat after the tutor |
| `rungColor[2]` | `#FF7B00` | Cued — choose a reply and say it |
| `rungColor[3]` | `#6EC4E8` | Prompted — say it in your own words |
| `rungColor[4]` | `#182019` | Free — plain ink, no line left to follow |

Green is the same green everywhere the learner speaks: the orb's your-turn state,
the lesson SpeakCircle, the Review button, the path's learned marks.

### Tints: paper for a place (retiring)

**Notebook Phase 1: tints are no longer drawn.** `TintRow`, `TintPanel` and
`TintDisc` are deprecated wrappers that draw a ledger row, plain paper and a
bare circle, and ignore the tint they are handed. The six tokens and their four
role tables stay exported until Phase 4 retires the call sites, so the table
below is still the palette the app ships. The rest of this section records the
rule the tints were held to while they were drawn.

The founder's mockups put each situation's line art on a soft coloured disc, and
that much of the retired five-paper scheme came back as six **tints**. A tint
names a **place** (the café, the hotel, the market, the street, home, friends) or
a **kind of practice** (replaying a moment, making a phrase yours, tuning one
sound) — never a state, a level or a mood. Which tint goes with which is decided
once, in a role table beside the thing it describes: `missions/missionTint.ts`,
`tutor/doorTint.ts`, `practice/madeFromTint.ts`, `profile/rhythmTint.ts`. A
screen names the role and never the colour.

A tint is a **surface**, not a mark and not an accent: it is drawn as the ground
under a row about a place or a kind of practice (`TintRow`, and `TintPanel` under
it) and as the panel behind the speaking rhythm. It was also the disc behind a
mission's authored drawing until revamp A retired those; the row's white disc
carries a `PlaceGlyph` now, so a tint is a paper and never a disc. Never as lettering, never as a stroke or
a border, never as a ring or a dot that reports state.

The second of those is F467 and it is the founder's decision, taken the way
Theme C was. A later mockup carried the colour through to the rows themselves,
and the choice was between keeping a rule that said the disc was the only place
a tint is ever drawn, or widening it to what the rule was actually protecting.
It was widened, in the open: the hex still lives in four files so a screen names
a place and never a colour, and `palette.test.ts` now catches lettering in a
tint more tightly than it did before, because the old ban missed
`backgroundColor` through an accident of casing rather than by permission. So it is held to a
paper's floors rather than a signal's. Ink clears 4.5 on every tint; every tint
sits at least a Delta-E of 8 off the ground, the chip fill, the card and the
card's hairline, so it reads as a disc; it stays 30 from every signal, the accent
and the thinking amber; 20 from every rung fill and lighter than every mark (the
lightest mark, rung one's yellow, is L* 84 and the darkest tint is 86); and no
two tints come within 10 of each other. The sky is 26 from rung three's blue,
which is why the rung floor is 20: nothing reads a disc under a café cup as a
support colour, and `palette.test.ts` walks the source so nothing can letter or
signal in a tint.

| Token | Value | Place |
|---|---|---|
| `tint.sand` | `#FEE7DB` | Café: a warm paper under the cup |
| `tint.rose` | `#F8D8DF` | Friends: a blush under the clinking bubbles |
| `tint.lilac` | `#E4D3EE` | Home: the old house lilac, under the window and the moon |
| `tint.lagoon` | `#CFF3EB` | The street: a cool lagoon under the signpost |
| `tint.sage` | `#E8EED5` | The market: sage under the crate of tomatoes |
| `tint.sky` | `#D5EFFE` | The hotel: sky under the front desk |

### Shadow

One. **The live glow** is the green halo under `SpeakCircle` while the
microphone is open, the one shadow that reports something. Nothing else in the
notebook floats: a card is told from the page by its paper hairline alone.

**The whisper is deleted.** The theme exports no shadow token. `theme.test.ts`
refuses the retired alias, and `surfaceContract.test.ts` refuses shadow styles
anywhere outside the live microphone glow. There are no pending callers or
theme exceptions. Cards are never nested, and each screen file may host at
most one `Highlight` or `LevelPath` highlighter.

## Type

**Fraunces** (SemiBold/Bold, the 72pt optical statics) is for French only:
**every French line the learner reads**, always sentence case, never caps, and
nothing else. **DM Sans** (Regular/Medium/Bold) is the furniture, and the UI
heads are DM Sans Medium. Both OFL, committed in `assets/fonts/` with their
licences. `theme.test.ts` fails if a style set in Fraunces is not a French
style by name, and if the French hero is not larger than the display.

| Style | Face / size | Use |
|---|---|---|
| `display` | DM Sans Medium 28/34 | Screen headline |
| `title` | DM Sans Medium 22/28 | Section head, big stat (not the tab title, which is `display` in `TabHeader`) |
| `cardTitle` | DM Sans Medium 20/26 | The title of a card, and of a scene brief |
| `frenchHero` | Fraunces 34/42 | The French line that leads a screen, always larger than any heading on it (`fitHero()` steps 34 → 30 → 26 by length, from `heroFit`) |
| `frenchLg` | Fraunces 28 | The line to say (`fitDisplay()` steps 28 → 24 → 20 by length) |
| `french` | Fraunces 21 | Inline French — options and cards |
| `frenchSm` | Fraunces 17 | French in a chip — the momentum hero's sample lines, where a real sentence at 21 wraps and stops reading as a chip |
| `heading` | DM Sans Medium 17/22 | Screen titles in chrome, a ledger row's title |
| `body` / `bodyStrong` | DM Sans 16 | Prose |
| `small` | DM Sans 13.5 | Secondary lines |
| `label` | DM Sans Bold 11.5, caps, 1.2 tracking | Micro-labels above cards |
| `button` | DM Sans Bold 16 | Pill and outline lettering |
| `notation` | DM Sans Medium 14 | IPA — real notation, not mono-as-costume |

## Surfaces and controls

The notebook system, redesign Phase 1 (27 September). Every screen picks it up
through these primitives; no screen was edited to get it. The old primitives
that screens still call are deprecated wrappers drawing the new look, listed at
the end, and they go with their call sites in Phase 4.

- **Card** — the one card: white, radius 16, one `paper.line` hairline, no
  shadow, no ink outline, never nested inside another card. `tone="feature"` is
  deprecated and draws plain paper; `journal` keeps the ground for the phrase
  card.
- **Ledger / LedgerRow** — how a list is drawn. The ledger rules a hairline
  above its first row and is a list to assistive tech; each row rules the
  hairline under itself. A row is one `Pressable` at 56pt with an optional 24pt
  ink glyph and no disc, an optional caps label, a title in `heading`, a gloss, an optional note on its
  own line, trailing meta, an earned state, and the faint chevron that says it
  opens. It names itself once, says disabled in soft ink rather than opacity,
  and grows rather than clips at the largest reading size.
- **PillButton** — the one primary action per screen: the ink pill
  (`accent.primary`), warm-white label, 56pt, fully rounded like the logo's L.
- **OutlineButton / GhostButton** — the seconds are quiet text links at the
  touch floor, ink or soft-ink words with no box, so nothing competes with the
  one ink pill.
- **OptionCard** — a tappable choice: French in the serif, English gloss under,
  quiet arrow, optional replay ear. Selection is a heavier ink rule on white; a
  replay ear that is sounding is drawn in ink on a `paper.groundDeep` disc.
- **Field, TabBar, ProgressDots** — inputs are white with a 1.5 rule that turns
  ink on focus, and a secure field carries a 44pt **Show / Hide** at its
  trailing edge so a password is not typed blind; the segmented control is a
  paper track with a white active segment and ink lettering, so it never
  competes with the ink pill, can stand with nothing chosen, names its group
  for a screen reader and says which segment is selected on the web as well as
  on a device; onboarding dots stretch the current page. A field's label is the
  one caps line, in soft ink.
- **Label** — one small caps label per card at most, in `inkSoft`.
- **Tab bar** — flat on the paper with a top hairline: no inset dock, no
  outline, no chartreuse, no wash and no animation. Selected is an ink glyph and
  a DM Sans Medium word; unselected is a faint glyph over a soft-ink word (the
  word stays soft ink because faint ink sits on the text floor's edge). 60pt
  cells, labels wrap at large text. The five tabs read Today, Speak, Practice,
  My French and Friends; the route names are unchanged.
- **Highlight** — the highlighter: an inline band behind a French line in
  `highlight`, drawn in once from the left through `drawIn`, resting on the
  drawn band under reduced motion. The band is decorative; the line on it is
  what is read.
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
- **Icons** — authored SVG at the illustration stroke (2.2), ink by default, in
  `components.tsx` for the controls and `glyphs.tsx` for the row marks, both held
  to the one stroke weight by `motion.test.ts`. The Google mark is a monochrome
  line-art G: no brand-colour asset in v1.
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
  under itself and its back chevron has no box.
- **Monogram**: the learner's initial drawn one way. An ink initial in DM Sans
  Medium on `paper.groundDeep`, hidden from assistive tech. `HIT`-sized in the
  header, larger on Profile.

Deprecated wrappers, kept until Phase 4 so the gate stays green without screen
edits. Each draws the notebook look and ignores what it no longer uses:

- **TintRow** draws a `LedgerRow` and no tint.
- **IconRowCard** draws a `LedgerRow`: its label stays the row's one caps line,
  its sentence becomes the title, its note its own quiet line. No card, no disc.
- **TintPanel** draws plain paper: white, radius 16, a paper hairline.
- **TintDisc** draws a bare decorative circle.
- **HeroCard** draws a `SceneBrief` with the fields it has: label, title, the
  plain line, the reason, the minutes beside the clock, the caller's Start and
  bookmark. The watercolour and the tint well are not drawn.
## Illustrations

Two kinds, drawn with the same pen. **Raster scenes** carry the places and the
moments; **inline SVG** carries the marks, the postcards and everything that
moves.

### Raster scenes

Thirteen watercolour-and-line PNGs in `apps/mobile/assets/art/`, at `@2x` and
`@3x` (Metro picks the density; the web takes the `@2x`). Every one is named
once in `src/art/registry.ts` with the point size it is drawn at, and reaches a
screen only through `src/art/Art.tsx` — the one file in the app allowed to import
`Image`, which spreads `decorative` so a scene is silent to a screen reader.

| File | Where it is drawn | Size (pt) |
|---|---|---|
| `hero-cafe` `hero-hotel` `hero-market` `hero-street` `hero-home` `hero-friends` | The missions chooser, one per place (`heroArt`); Home's hero stopped drawing it when it became a scene brief in notebook Phase 1 | 300x180 |
| `welcome-bubbles` | The first page of pre-account onboarding | 220x140 |
| `onboard-cake` | The age gate | 220x140 |
| `onboard-wave` | The page that asks the learner's name | 220x140 |
| `empty-table` | Review and Drill with nothing due | 220x140 |
| `recap-postcard` | The end of a conversation and the end of a lesson | 220x140 |
| `phrasebook` | The phrasebook route | 220x140 |
| `wall-map` | The wall's map of places | 300x180 |

**Notebook direction.** The six place watercolours and `wall-map` stay. The
`welcome-bubbles`, `onboard-cake`, `onboard-wave`, `empty-table`,
`recap-postcard` and `phrasebook` rasters, and the hashed daily-word drawings,
retire through `docs/DELETION_LEDGER.md` once the screens that draw them are
rebuilt (Phases 3 to 5). Until then they still ship and are still drawn.

Tutor has no header picture on purpose: the orb is the one thing on that screen
that means something, and a second drawing beside it is two focal points where
the design has one. There is no art in a live session, in settings, in the memory
editor or in the legal pages.

**Generator and licensing.** Generated on 2026-09-15 with Gemini
(`gemini-2.5-flash-image`) from one shared prompt plus one subject line per
scene. All of it is owned by Luvani; nothing here is third-party and nothing
needs attribution. The originals and the generation scripts live with the
founder, outside the repo, so any scene can be redrawn in a minute and dropped in
under the same name.

The shared prompt: *hand-drawn line art in one thin dark violet ink line, loose
and slightly imperfect, round line ends, with a soft translucent watercolour wash
in pale peach, pale sky blue, sage green, mint teal and lilac that stays inside
the lines only loosely and fades out at the edges; no text, no gradients, no drop
shadows, no border, generous white space, plain white background; picture book
for adults, calm, Parisian.* Colours are named in **words, never as a hex code**:
a hex in the prompt came back painted onto the picture as a swatch.

**The matte rule.** The model returns a white rectangle, and a white rectangle on
porcelain is a visible box. So every file is keyed to real transparency, trimmed
to the ink, and quantised to 256 colours before it lands: the bleed at a header
corner is painted into the alpha rather than produced with a negative margin,
because negative margins clip on Android and scroll on the web. Budget: 350 KB
per `@3x` file, 4 MB for the folder, heroes no larger than 900x540, all enforced
by `src/art/registry.test.ts`, which also fails on a picture nobody draws and a
drawn name nobody registered.

### Inline SVG

Authored inline SVG in `src/illustrations/`, one style contract stated in
`pen.tsx`: ink stroke 2.2 round-capped, `fill="none"` except tiny solid
accents (a beret, a flame, a heart — a tenth of a scene at most), stipple-dot
shading, deliberately quirky proportions, viewBox 200×150, no second colour —
the paper shows through. `src/illustrations.tsx` remains as a one-line barrel,
so the thirteen screens that import from it did not change.

Four scenes, plus the tick and plus the daily pack. Of the original eight, three
are left: name tag, clinking speech bubbles, sprouting word cards. The winged
clock left the barrel with the daily-goal sheet that was its only caller, once
the goal became a three-way control chosen in place; it is drawn, like the
suitcase, and not exported.

Revamp A retired nine, and for the opposite reason: not a caller that left but a
drawing that was replaced. The postcard, the birthday cake, the cleared table and
the phrasebook room are `recap-postcard`, `onboard-cake`, `empty-table` and
`phrasebook` in the raster table above. The café table and the four place
postcards went with the components that stood between them and a screen: a
situation's picture is `heroArt` now on the chooser's hero card and on Home, and
a situation's mark in a row is a `PlaceGlyph`, so `MissionDisc` and `MissionArt`
had nothing left to draw and left with their scenes. In every case the scene file
went too, because a vector kept beside the raster that replaced it is the next
person's coin toss. What is left is the two empty states the app still draws by
hand:

| Scene | Where |
|---|---|
| `NobodyYet` | The dormant social prototype's empty states; not reachable from the app navigation |
| `StillWriting` | A topic the tutor has not finished, which is the only thing the app locks |

The rule those five place drawings were kept under is still the rule, and the
raster that replaced them keeps it for free: **a picture of a place does not
move**. Six drawings on one scrolling screen is six loops competing for the eye
at the moment somebody is trying to choose one of them, and the motion
vocabulary below is one loop per screen.

`SpeakBubbles` is the one authored scene left outside the daily pack that a
screen still draws, on the tutor intro, and it moves.

Plus `RewardMark`, which is not a scene: one tick arriving beside a drill
verdict, in the reserved-height slot the screen already keeps. There is no
`miss` variant on purpose, because a drawing scolds louder than a word.

And the **daily pack**: twenty drawings for the word of the day, one a day, chosen by the date
the same way the word and the situation are. The card moved to the foot of the `Progress`
screen with revamp A, and the pack moved with it. `WordSprout` is one of them and the rest are a
kettle, a croissant, a candle, a casserole, a teapot, an umbrella, a cloud, a kite, falling
leaves, a snowflake, a postbox, a bicycle, a fountain, a pigeon, a lantern, shutters, a snail, a
cat and a sailboat. Every one moves, because the card is the same card every day and the drawing
is the thing that tells a learner it is a new one. They are drawn through a switch with one case each, which is not taste: the guard that
proves nothing ships unrendered finds a scene by looking for it written as a tag, and a table
of bare names would hide all twenty from it.

`WordSprout` itself is a seedling being watered. Only
the water moves, on one loop; the figure and the can stay still, because the
figure is the subject and tilting the can would pull the eye off the word beside
it. Two components left with the same pass: `TodayRow` and `PhrasebookCard` were
Home's alone, and Home now opens on the day instead of on a count of it. The
**Demo mode** label left the situation card later, for a different reason: a
badge reporting that a server is down, worn before the learner has asked for
anything, is the app talking about itself. The honest signal is the answer to the
tap, which the card already gives and still does. The
daily count's philosophy stays where it always lived, in `progress/today.ts` and
its suite, which is the standing refusal to turn it into a streak.

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

**The notebook moves two things** (redesign Phase 1): the orb, with its
existing breathing and wave lines, and the highlighter drawing in once behind a
French line (`drawIn` and `DRAW_MS` in `motion.ts`). Touch feedback stays. The
tab bar's selection wash and lift are gone. `motion.test.ts` pins the files that
animate: the orb, `components.tsx` for the highlighter, `motion.ts` itself, and
a pending list that may only shrink as later phases remove the rotating
greeting, the twenty animated daily drawings, `SpeakBubbles`, the welcome steam
and the `RewardMark` motion (which becomes static).

The app had none. It now has exactly one vocabulary. The rules live in
`apps/mobile/src/motion.ts` — `useReduceMotion`, `settleIn` and `drawIn` — and
every surface reads them from there: the scene hook, the voice orb, the
transcript, the pre-account page transition and the highlighter. That sentence used to be here while four files each asked
`AccessibilityInfo` themselves and three of them sampled it once and never
looked again, so a learner who turned reduce motion on mid-session went on
being animated at until the next launch. It is watched now, everywhere.
`src/motion.test.ts` and `src/surfaceContract.test.ts` enforce this by walking
every source file: a timing without `useNativeDriver`,
an `Animated.spring`, an `Animated.createAnimatedComponent`, or an
interpolation handed to `r`/`d`/`cx`/`cy`/`width`/`height` all fail the suite.
The rules themselves are unchanged:

- **transform and opacity only**, always `useNativeDriver: true`
- **never an SVG attribute** (`r`, `d`, `cx`) — those cannot cross to the
  native driver and drop the whole animation onto the JS thread
- one continuous loop plus one settling entrance; nothing bounces
- **reduce-motion renders the final frame**, not nothing: the scene is the
  content, the movement is the flourish
- absolutely-positioned moving pieces are placed in *container* pixels, not in
  the viewBox units the still art is drawn in

Touch has one equally restrained vocabulary. Primary pills, ledger rows, option
cards and tab cells compress by one or two percent and move
one point toward the page while held, then return without a bounce. Native taps
use selection feedback and an earned conversation closure uses one success
feedback through `motion/haptics.native.ts`; web keeps the same calls as safe
no-ops. Haptics never gate navigation or learning state, and a device refusal is
swallowed rather than turned into a failed action.

Twelve scenes move now rather than one, and they all move through the same
hook, so the reduce-motion branch cannot be forgotten and no loop can outlive
the screen that started it. A scene also stops when its screen is not on top,
via a `paused` prop rather than `useIsFocused`: five of the places that render
a scene mount *above* the navigator, where that hook throws.

`illustrations/pen.tsx` adds `Moving`, which places an animated layer from
viewBox coordinates and sizes it from the scene's own unit. That fixes a real
bug: the splash drew its café at 260 wide, so the cup's 2.2 stroke rendered at
2.86px while the steam above it, in its own 44-unit box at width 44, rendered
at 2.2px. The steam was 23% thinner than the cup it rose from.

Two things moved before. The **welcome** — steam drifting off a café cup, two speech
bubbles arriving one after the other, then a settling second page. And the
**voice circle**, which revamp A redrew.

It is a lit **gradient disc** now: one radial gradient built from the state's own
single colour at full, 0.85 and 0.45 opacity, so the sphere reads as lit without
a second token entering the palette. Three faint concentric **rings** sit behind
it, and three soundwave **lines** either side lean in. The lines are part of the
shape rather than a state: they are drawn on the untapped circle and on the
resting one too, because the founder's Tutor tab has them beside the orb before
anybody has tapped it, and hiding them until a conversation started made the one
control on that screen a bare disc. They **move** only in the two states where
somebody is talking, which is the only place the second driver runs: drawn and
still everywhere else, and absent only while the orb is thinking or stopped,
where a line either side would be a voice that is not in the room. The founder reversed the earlier decision here: rings around
a flat centre was the first choice and the lit sphere the rejected one, and after
seeing both on the mockup the founder took the sphere with the rings kept around
it.

Six states — ready, idle, speaking, listening, thinking, error — said in
traffic-light colour (red listen, green speak, amber one-moment), violet for the
untapped control, and one caption always set in ink. The disc breathes on one
`scale` and the wave lines stretch on a second `scaleY`, both transform-only on
the native driver; the gradient, the rings and the waves are static SVG and
nothing interpolates an SVG attribute. Under **reduce motion** the whole thing
rests: the gradient, its rings and its lines are drawn once, at the final frame,
because the orb is the content and the breathing is the flourish. It carries no
shadow: the one shadow in this app is the live microphone's glow, and it does
not belong to the orb.

Deliberately not driven by audio amplitude. An analyser feeding setState sixty
times a second is the churn that would force a reanimated dependency, and that
is the one place worth spending one later.

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
