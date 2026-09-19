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
  “Your French in practice”: Days active, Retained phrases, Recall and Speaking
  time in four compact tiles. The existing progress model still owns the counts.
  One swipeable Word/Phrase card sits directly below, with two labelled pills,
  the existing decorative illustrations and brief, reduced-motion-aware animation.
  The separate Real progress route is removed; evidence-backed weekly details
  expand inline. Friends and speaking-pace sections appear only for useful activity.
- Bottom destinations: Home, Speak, Practice, My French, Friends. Profile is a
  pushed screen reached from the same labelled avatar on every root tab; Settings
  is its first row. Friends is opt-in, friends-only and based on real learning
  activity, with no global leaderboard or punishment for missing a day.
- Daily collection: 1,000 words and 1,000 phrases. The first voiced subset has
  200 of each in all six tutors, bundled Flash recordings at a moderate -4 dB.
  Home picks only from that level-appropriate subset. Hear and Slow replay follow
  the selected tutor without a speech API or generic fallback. Unvoiced library
  items retain text, Save and self-recording practice; examples remain text-only.
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

### Ink identity, chartreuse feature paper

Primary actions and micro-labels share the same dark ink. `accent.label` equals
`accent.primary`; `accent.feature` is a contrasting chartreuse surface, never
body text. This separates actions, feature panels and quieter journal content.

| Token | Value | Role |
|---|---|---|
| `accent.primary` | `#182019` | Primary controls, selected glyphs and monograms |
| `accent.label` | `#182019` | Micro-labels — the caps line above a card |
| `accent.feature` | `#D8FF54` | Chartreuse feature paper with dark ink lettering |

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

### Tints: paper for a place

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

Two, and both are named in `theme.ts` so no screen ever writes a shadow number.
**The whisper** (`shadow.whisper`) is a restrained printed offset:
three points right and down, ten per cent ink, and no blur. It is on
`Card`, on the phrase card's round speaker, and nowhere else — never on a tinted
row, the tab bar, the orb, a pill or a header, because an app where everything
floats is an app where nothing does. The card keeps its hairline underneath it
on purpose: elevation renders nothing on Android below API 28 and clips oddly in
the web column, and a card without the rule would dissolve into the ground there.

**The live glow** is the second and the last: the green halo under `SpeakCircle`
while the microphone is open. It is the one shadow that reports something, which
is why it is allowed to be louder than the whisper. `surfaceContract.test.ts`
fails on a third: a `shadowOpacity` or an `elevation` written anywhere outside
`theme.ts` and that one glow.

## Type

**Fraunces** (SemiBold/Bold, the 72pt optical statics) carries anything with a
voice: screen headlines, big stats, and **every French line the learner reads**,
always sentence case, never caps. **DM Sans** (Regular/Medium/Bold) is the
furniture. Both OFL, committed in `assets/fonts/` with their licences.

| Style | Face / size | Use |
|---|---|---|
| `display` | Fraunces Bold 32 | Screen headline |
| `title` | Fraunces 24 | Section / card head, big stat (not the tab title, which is `display` in `TabHeader`) |
| `cardTitle` | Fraunces Bold 22 | The title of a card that leads a tab: the hero's scene, one size under the screen headline |
| `frenchLg` | Fraunces 28 | The line to say (`fitDisplay()` steps 28 → 24 → 20 by length) |
| `french` | Fraunces 21 | Inline French — options and cards |
| `frenchSm` | Fraunces 17 | French in a chip — the momentum hero's sample lines, where a real sentence at 21 wraps and stops reading as a chip |
| `heading` | DM Sans Bold 17 | Screen titles in chrome |
| `body` / `bodyStrong` | DM Sans 16 | Prose |
| `small` | DM Sans 13.5 | Secondary lines |
| `label` | DM Sans Bold 11.5, caps, 1.2 tracking | Micro-labels above cards |
| `button` | DM Sans Bold 16 | Pill and outline lettering |
| `notation` | DM Sans Medium 14 | IPA — real notation, not mono-as-costume |

## Surfaces and controls

- **Card** — white, radius 12, one hairline `paper.line` rule, and the whisper
  under it. Revamp A widened the corner from 14 and gave the card the one soft
  shadow; the hairline stayed, for the Android and web reasons under Shadow above.
- **PillButton** — the one primary action: dark ink (`accent.primary`),
  warm-white label, 56pt minimum, 8pt corners.
- **OutlineButton / GhostButton** — the seconds: white pill with an ink rule, or
  bare text at full touch height.
- **OptionCard** — a tappable choice: French in the serif, English gloss under,
  quiet arrow, optional replay ear. Selection is a heavier ink rule; a replay ear
  that is sounding is drawn as `accent.primary` on a `paper.groundDeep` disc.
- **Field, TabBar, ProgressDots** — inputs are
  white with a 1.5 rule that turns ink on focus, and a secure field carries a
  44pt **Show / Hide** at its trailing edge so a password is not typed blind;
  the segmented control is a soft track with a violet active pill, warm-white
  lettering on it, that can stand with nothing chosen, names its group for a
  screen reader and says which segment is selected on the web as well as on a
  device; onboarding dots stretch the current page.
- **Bottom dock** — the five destinations sit on one inset white surface with a
  complete hairline and the card radius. It has no shadow: the surrounding
  porcelain is enough to separate navigation from content, while the active
  destination keeps its lilac wash and violet word.
- **TintDisc** — a circle of one tint, decorative to assistive tech. It held a
  place's authored line art through `MissionDisc`; both that component and the
  five place drawings retired with revamp A, so nothing draws this today and it
  is recorded here as a primitive rather than as a surface a learner meets.
- **TintPanel** — the ground under a block about one place, in that place's tint.
  Not decorative: it has words in it. With `TintRow`, one of the two places a
  tint is ever drawn, and both live in `components.tsx` so no screen ever names a
  colour.
- **TintRow** — the mockup's one way into a place, a practice or a memory, and
  the shape the founder circled on every frame: a tinted ground at radius 16, a
  white 44pt disc with one line-art glyph on it, the row's name, a quiet gloss
  under it, an optional earned state, then the faint chevron that says it opens.
  One `Pressable`, never a card with a button inside it, because the whole row is
  the target and a button nested in a button is invalid on the web. It grows
  rather than clips at the largest reading size, and it names itself once so a
  screen reader meets a row and not two loose lines. Turned off, it steps down to
  soft ink rather than fading, because a faded row still looks like a row.
- **IconRowCard** — the same idea in white, for the things that belong to no
  place: Home's "Real progress", My French's phrase shelf and conversations,
  Profile's two tutor rows. The disc is the ground here and the card is white,
  the opposite way round from a tinted row, because a white disc on a white card
  cannot be seen.
- **HeroCard** — the card that leads a tab: a caps label, the scene's name in
  `cardTitle`, one plain line under it, the picture of the place, a clock glyph
  with how long it is likely to take, and the primary action. The action and the
  top-right 44pt corner slot (the bookmark) arrive as nodes the caller built, so
  the one-primary-action rule stays countable from the screen's own file.
- **PhraseCard** — one French line, large, sized by `fitDisplay` rather than
  clipped, with a round white 44pt speaker beside it carrying the whisper and the
  violet speaker mark. It says "Hear" before it sounds and "Stop" while it does.
- **TutorMark** — the tutor, drawn as the orb at 40 inside a white disc, and
  hidden from assistive tech. There is no face anywhere in this app and no
  initial either: the monogram is the learner's mark, never the tutor's.
- **SpeakCircle** — THE microphone: one 108pt circle used by every speaking
  surface. Green-ringed when waiting, green-filled (with the live glow, the
  second and last shadow in the app) when live — green means "you speak",
  matching the voice circle — hairline-muted when the tutor holds the floor.
- **Icons** — authored SVG at the illustration stroke (2.2), ink by default, in
  `components.tsx` for the controls and `glyphs.tsx` for the row marks, both held
  to the one stroke weight by `motion.test.ts`. The Google mark is a monochrome
  line-art G: no brand-colour asset in v1. Three icons wear the accent and no
  more: the replay ear while it is sounding, the phrase card's speaker, and
  **BadgeGlyph**, the tick inside a ring beside Home's recall figure. In all
  three the violet labels a thing you press and reports no state.
- **Art** — the single raster renderer, using registry sizes or its compact
  variant. Illustrations sit within content panels, never behind headings.
  The unused header renderer and its five legacy scenes have been removed.
- **TabHeader**: the tab's title block. A `display` title on the left, one plain
  purpose line beneath it in soft ink, and an optional trailing `Monogram` on the
  title row. It mounts as the first child of a tab's scroll body, never in the
  frame's `header` slot, so the fixed title and purpose can scroll at large text.
  It has a second, centred variant, and Profile is the one tab that uses it: that
  screen is about a person rather than a subject, so the monogram leads above a
  centred name. Centring is the exception and stays that way — it is the only
  place in the app where `textAlign` is written at all, and a test cuts the
  centred branch out before banning it everywhere else.
- **Monogram**: the learner's initial drawn one way. One filled violet disc
  (`accent.primary`), the initial set in the serif in warm-white (`paper.onInk`),
  hidden from assistive tech. `HIT`-sized in Home's header, larger on Profile.

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
| `hero-cafe` `hero-hotel` `hero-market` `hero-street` `hero-home` `hero-friends` | Home's hero card and the missions chooser, one per place (`heroArt`) | 300x180 |
| `welcome-bubbles` | The first page of pre-account onboarding | 220x140 |
| `onboard-cake` | The age gate | 220x140 |
| `onboard-wave` | The page that asks the learner's name | 220x140 |
| `empty-table` | Review and Drill with nothing due | 220x140 |
| `recap-postcard` | The end of a conversation and the end of a lesson | 220x140 |
| `phrasebook` | The phrasebook route | 220x140 |
| `wall-map` | The wall's map of places | 300x180 |

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
| Practice | Made from the learner's own conversations, and it is what the tab is called. The header, then one **Your next practice** card: a French line set large, a round white speaker that says it aloud, the English under it, and exactly one control for the branch it is in, which is Review when cards are due, Practise this conversation for the newest pack nobody has come back to, and the tab's one pill for a learner with no conversation yet. Under it three rows, always the same three, on peach, sky and sage: replay a moment, which speaks the better line and opens a drill on it; make this phrase yours, which is the own-words drill; and tune one sound. A learner with no conversation meets the same three shapes from the café lesson and one sentence saying the page becomes personal after the first. The archive went one level down to `Conversations` rather than off the map: the vault, the feed, the filters and the pack library all live there behind My French's own row |
| My French | The ledger of what has become the learner's, and the one tab whose unit is the place and the phrase rather than the session. The situations first, as one tinted row each on the paper of the place they happen in, with the place's line-art mark on a white disc and the state reached in a chip at the end: **You can now...** for the ones handled with nothing handed over, then **Next places** for the rest, worded as suggested and never as locked or missing. A learner with nothing stamped meets one group, so no empty ability card is ever drawn. Then **Your phrase shelf**, one white row carrying the phrase most worth keeping and a chevron into the `Phrasebook` route, present on a first morning too because the module has a sentence for an empty shelf. Then **Saved for later**, the situations bookmarked from Home, present only when there are any. Then **Your conversations**, one row into `Conversations`, present only once a conversation exists. There is no percentage anywhere on it and none is available to be drawn: the climb is the layout |
| Profile | The one tab that is a person, so it is the one tab whose header is centred: the learner's monogram at 72 above their own name, and "Your French journey, your way." under it. Then **Your tutor**, a white card of two rows: who they are talking to, drawn as the orb and never as a face, opening the voice sheet; and what the tutor remembers, in words and never as a count, opening the screen where every remembered fact can be forgotten one at a time. Then **Your speaking rhythm**, a lilac panel with the Monday-to-Sunday week as seven violet dots under their day names, one caption, and the week said as a sentence to anyone who cannot see the marks. Then **Your learning**, a white card of standing choices: the name, the flexible speaking target and the correction dial as three-way controls with the chosen gloss beneath, and prefer typing. Then the Settings row, last and alone, and everything general is behind it: the account, the plan, the subscription, the documents, the phone's own permissions, the reminder and the version line |

Three routes carry what used to be a section of a tab. Each is pushed, each opens
with the shared header's one chevron, and each was moved rather than cut, because
a section with a learner's own data behind it is worth a page.

| Route | What it is |
|---|---|
| Progress | What Home's **Real progress** row opens. A serif title, then the week told back in at most three sentences, absent entirely on a quiet week because a surface that can render empty is a quota. Then what the learner can now do, one tinted row per situation handled alone. Then the momentum block, moved here whole: **four cards**, there from the first day and worded as a start where a number would be nought, which are retained phrases with two of the learner's own lines, days active with the **week rail** under it, recall over reviews once ten of them are behind it, and **Speaking time today**, which shows truthful measured minutes beside the optional Profile target as a gentle sentence, never a fraction, percentage or progress bar. Then the word of the day at the foot, which is a fact about the day rather than a claim about the learner, drawn with one of the daily pack's twenty and stopped the moment something is pushed over the top of it |
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
component cannot go uncounted. Two tabs draw one each and three draw none. Home's
is Start conversation on tonight's card. Practice's is the first conversation,
which only a learner who has never had one ever meets. Tutor has none, because
the circle is the way into a conversation and a pill beside it would be a second
answer to the same question; My French has none, because a list of places is a
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

The app had none. It now has exactly one vocabulary. The rules live in
`apps/mobile/src/motion.ts` — `useReduceMotion` and `settleIn` — and every
surface reads them from there: the scene hook, the voice orb, the transcript,
the pre-account page transition and the selected-tab wash. That sentence used to be here while four files each asked
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

Touch has one equally restrained vocabulary. Primary pills, outline controls,
tinted rows, option cards and tab cells compress by one or two percent and move
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
shadow: the two shadows in this app are the whisper under a card and the live
microphone's glow, and neither belongs to the orb.

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
