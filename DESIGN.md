# Design

<!-- Recorded from the built artifact, not from intentions. Every value below is
     read out of apps/mobile/src/palette.ts and the screens as shipped. The
     previous design system (enamel wayfinding, dark Métro-plaque green) lives
     in full at the repo's baseline commit. -->

## The world

**Colourful calm.** A picture book for adults: a single pale porcelain ground,
violet-cast ink, a serif that speaks and a sans that stays out of the way.

Four surfaces, and everything in the app is one of them. **White cards** on a
hairline rule, lifted off the porcelain by one whisper of a shadow. **Pastel
tinted rows**, each a soft paper under one place or one kind of practice, with a
white disc and a line-art glyph at the head of it. **Watercolour-and-line raster
scenes** — one thin violet ink line with a loose wash inside it — bleeding off a
header corner or centred in a card. And **serif headlines**: every screen title
and every card title is set in Fraunces, so the thing with a voice always looks
like the thing with a voice.

Colour does jobs: **violet is identity** (the primary pill, the active tab, the
micro-labels, the monogram, the week already spent), **green means go** (your
turn to speak, ground already covered), **amber means thinking**, **red means the
tutor is talking**.

Chosen because the product asks a nervous adult to speak out loud twice a day,
and the surface that earns that is calm, friendly and professional — easy on the
eye, easy to come back to. The founder picked this direction (option C of three
mocked) over a symphony.co-style cream/lime skin and over keeping the plain
ink-on-lilac look.

What did **not** change, because it is behaviour rather than surface: one
primary action per screen; support colours that visibly cool as help is
withdrawn; no scores and no scolding mid-session; 44pt touch floors; type that
respects the OS reading size. What deliberately DID change: the live microphone
is **green** now, not red — green means "you speak" everywhere, so the voice
circle's red can mean "the tutor is speaking" without the two ever reading as
one signal.

## Colour

One ground, and everything else earning its place against it. Every raw value
lives in `apps/mobile/src/palette.ts`, which imports nothing so that
`palette.test.ts` can hold it to a contract; `theme.ts` composes its tokens from
there and carries no raw hex of its own. The tables below are that palette, read
back out of the code: `palette.test.ts` fails if this document and the export
disagree on a single value.

### One ground: Porcelain

The five place-keyed papers are gone. The founder rejected a muted scheme of five
grounds a hair apart, so there is one ground — Porcelain — under the whole app,
and colour earns attention by meaning something rather than by marking where the
learner happens to be. The card lifts off the ground, each hairline separates
from what it rules, and the steps are held by Delta-E rather than by matching
four siblings at one lightness.

| Token | Value | Role |
|---|---|---|
| `paper.ground` | `#F4F2F7` | The page — everything sits directly on it |
| `paper.groundDeep` | `#E6E2EE` | Pressed states, chip fills, the tab track |
| `paper.card` | `#FFFFFF` | Card surface, flat, one hairline rule |
| `paper.ink` | `#241633` | Near-black ink with a real violet cast |
| `paper.inkSoft` | `#5F4E73` | Secondary text |
| `paper.inkFaint` | `#8A7996` | Tertiary — counts, placeholders, the inactive tab glyph |
| `paper.line` | `#DAD5E3` | Hairline rule on the ground |
| `paper.lineOnCard` | `#E9E5F0` | Hairline divider inside a card |
| `paper.onInk` | `#FBF6FF` | Text on a filled control — violet-white, never pure |

`inkFaint` moved from the old `#94849F` (2.91 against the ground, under the mark
floor) to `#8A7996` so the inactive tab glyph reads as a mark.

### One identity violet

There is a single accent, and both of its named jobs are the same violet. The old
"lighter label" `#8A5BBF` read 4.08 against the ground at 11.5pt bold and is gone;
`accent.label` is now simply `accent.primary`, and `palette.test.ts` pins the two
equal as a tripwire against a second identity colour creeping back in.

| Token | Value | Role |
|---|---|---|
| `accent.primary` | `#6B3FA0` | The identity violet: primary pill, active tab, monogram |
| `accent.label` | `#6B3FA0` | Micro-labels — the caps line above a card |

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
| `orb.ready` | `#6B3FA0` | Tap to talk: the untapped control (aliases `accent.primary`) |

Violet is not a fourth traffic light. A closed microphone waiting to be tapped is
the primary control of the whole product, so it takes the primary colour exactly
as the pill does, and it stops being violet the instant the orb reports anything.

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
| `rungColor[4]` | `#241633` | Free — plain ink, no line left to follow |

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

A tint is a **surface**, not a mark and not an accent: it is drawn as the disc
behind a mission's drawing (`TintDisc`, via `MissionDisc`), as the ground under a
row about that place or that practice (`TintPanel`, and `TintRow` above it), and
as the panel behind the speaking rhythm. Never as lettering, never as a stroke or
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
**The whisper** (`shadow.whisper`) is what lifts a white card off the porcelain:
four points down, six per cent of the ink, a fourteen-point blur. It is on
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

- **Card** — white, radius 20, one hairline `paper.line` rule, and the whisper
  under it. Revamp A widened the corner from 14 and gave the card the one soft
  shadow; the hairline stayed, for the Android and web reasons under Shadow above.
- **PillButton** — the one primary action: solid violet pill (`accent.primary`),
  warm-white label, 52pt tall.
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
- **TintDisc / MissionDisc** — a circle of one tint with a place's line art
  inside, decorative to assistive tech.
- **TintPanel** — the ground under a block about one place, in that place's tint.
  Not decorative: it has words in it. With the disc, one of the places a tint is
  ever drawn, and all of them live in `components.tsx` so no screen ever names a
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
- **Art / HeaderArt** — the two ways a raster scene reaches a screen. `Art` is
  the only file in the app allowed to import `Image`, it draws every picture at
  the size `art/registry.ts` gives it, and it is decorative. `HeaderArt` hangs
  one off the top-right corner of a tab header, four and five grid steps out, and
  disappears entirely once the reading size passes 1.5, where the title would
  otherwise grow underneath it.
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

Eighteen watercolour-and-line PNGs in `apps/mobile/assets/art/`, at `@2x` and
`@3x` (Metro picks the density; the web takes the `@2x`). Every one is named
once in `src/art/registry.ts` with the point size it is drawn at, and reaches a
screen only through `src/art/Art.tsx` — the one file in the app allowed to import
`Image`, which spreads `decorative` so a scene is silent to a screen reader.
`HeaderArt` is the second door, for the four tabs whose picture bleeds off the
top-right corner.

| File | Where it is drawn | Size (pt) |
|---|---|---|
| `header-home` | Home's header corner | 168x132 |
| `header-practice` | Practice's header corner | 176x140 |
| `header-myfrench` | My French's header corner | 176x132 |
| `header-profile` | Profile's header corner | 88x110 |
| `hero-cafe` `hero-hotel` `hero-market` `hero-street` `hero-home` `hero-friends` | Home's hero card and the missions chooser, one per place (`heroArt`) | 300x180 |
| `welcome-bubbles` | The first page of pre-account onboarding | 220x140 |
| `onboard-cake` | The age gate | 220x140 |
| `onboard-wave` | The page that asks the learner's name | 220x140 |
| `signin-skyline` | The corner of sign-in and sign-up | 200x90 |
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

Eighteen scenes. The original eight: café hero, name tag, birthday cake,
suitcase, winged clock, clinking speech bubbles, sprouting word cards,
postcard. Four of those now move. The winged clock left the barrel with the
daily-goal sheet that was its only caller, once the goal became a three-way
control chosen in place; it is drawn, like the suitcase, and not exported. Six
fill a place that previously said
"nothing here" in plain text on an empty screen, and four are the mission
chooser's postcards:

| Scene | Where |
|---|---|
| `NothingDue` | An empty review deck or drill bank, drawn as a cleared table rather than a dead end |
| `NobodyYet` | The dormant social prototype's empty states; not reachable from the app navigation |
| `StillWriting` | A topic the tutor has not finished, which is the only thing the app locks |
| `Phrasebook` | The learner's own lines, kept |
| `StreetCorner` | Asking the way: a leaning signpost with two boards |
| `MarketStall` | Buying at a market: a crate of tomatoes under a scalloped awning |
| `FrontDesk` | Checking in: a desk, an oversized bell, a key on the counter |
| `EveningIn` | Talking about your day: a window, a moon, a mug on the sill |

The four mission scenes are **still**, and that is the rule rather than an
omission. Six drawings on one scrolling screen is six loops competing for the
eye at the moment somebody is trying to choose one of them, and the motion
vocabulary below is one loop per screen. The other two missions reuse
`HeroCafe` and `SpeakBubbles`, which do move, because they were already drawn
and a rushed drawing is worse than a borrowed one.

Plus `RewardMark`, which is not a scene: one tick arriving beside a drill
verdict, in the reserved-height slot the screen already keeps. There is no
`miss` variant on purpose, because a drawing scolds louder than a word.

And the **daily pack**: twenty drawings for Home's word of the day, one a day, chosen by the date
the same way the word and the situation are. `WordSprout` is one of them and the rest are a
kettle, a croissant, a candle, a casserole, a teapot, an umbrella, a cloud, a kite, falling
leaves, a snowflake, a postbox, a bicycle, a fountain, a pigeon, a lantern, shutters, a snail, a
cat and a sailboat. Every one moves, because the card is the same card every day and the drawing
is the thing that tells a learner it is a new one. They are drawn through the same switch shape
`MissionArt` uses, which is not taste: the guard that proves nothing ships unrendered finds a
scene by looking for it written as a tag, and a table of bare names would hide all twenty from it.

`WordSprout` itself is a seedling being watered,
with the service bell `FrontDesk` already draws rather than a second one. Only
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
| Home | Tonight's French, not a summary. A greeting alone at the top, where only the word changes: it rises up out of its slot and the next comes in behind it, and the name travels with it so the two stay tight; then one situation as the hero, on the tint of the place it happens in, with its French title, why this scene, how long it usually takes in words or the learner's own pace when one was measured, the tutor's one line of memory when there is a real record behind it, and the tab's one pill; what the learner can now do, one row per situation handled on their own and nothing at all before one is; today's situation with its starting line, a bookmark and an outline to talk about it instead; daily momentum as four cards, there from the first day and worded as a start where a number would be nought: retained phrases with two of the learner's own lines, days active with the week rail, recall over reviews once ten of them are behind it, and today's speaking goal; the word of the day under them; a sprout note at the foot. The level, the evidence and the phrasebook moved to My French rather than being drawn twice |
| Tutor | The tutor by name, the voice circle, which reads its state from the facts: away when the servers are, checking while a probe runs, quiet with a caption when the account has no speaking time, and violet only when a tap would start something; then what the tutor remembers, one line from a real record with a way to pick the scene up or keep the conversation going, absent for a learner with nothing behind them; then three ways in as rows under one heading: an everyday mission, which opens the chooser, an open chat, which runs the circle's own probe, and rehearsing something, which opens a screen where a learner picks the kind of moment, writes one line about it, and runs it in French first. A scene left part way keeps its resume card above them with the scene's drawing, its French title, how long is left when their own pace has said, and the tab's one pill. The six situations are still every one its own tappable row, folded away behind a quiet word, and the pronunciation lesson is last: the café scene's drawing, its French title, one line saying the words are written out and the tutor listens to how you say them, an outline button rather than a pill, and its own quiet "Read and type this one instead" link. The four-page intro that used to stand in front of them is a quiet "How the voice circle works" link here and in Profile |
| Practice | Made from the learner's own conversations, over the archive of them. The next step is still the tab's one pill, in three branches: the deck when cards are due, the newest conversation nobody has come back to, or the first conversation for a learner with none. Under it three cards from the newest conversation: the moment worth replaying, said as what they said and a better way and never as audio, which opens a real drill on the better line with the moment drawn above it; the phrase worth making theirs, with Say it only where a sitting would have something in it and Hear it otherwise; and the sound to tune, from the newest sound check, or one line saying the next situation names one. A learner with no conversation meets the same three shapes from the café lesson and one sentence saying the page becomes personal after the first. Then the archive: a vault card counts what has been recorded, the topics opened and the phrases retained, then one card per finished conversation carrying when it was, how long they spoke, the topics it opened and the phrases it left behind, then a card that suggests the next conversation out of the authored pool. **It grows.** There is no vault and no feed until the first conversation, no ordering line until the second and no filter row until the fourth, and a count with nothing behind it is left out of the rail rather than drawn as a nought. The authored path, its rows and its mix offer are gone; the scripted café lesson is a door on Tutor and the drill bank is behind the suggestion card |
| My French | The ledger of what has become the learner's, and the one tab whose unit is the phrase rather than the session. It opens on **one line, right now**: a single card from the deck, the English showing and the French withheld until an attempt lands, chosen by where that phrase sits on the evidence ladder and carrying the reason it was chosen. One card, two grades, one closing line, and no way to ask for another, because a queue here is the sitting Practice already owns. Under it a segmented switch, absent whenever one half would be empty: **Spoken Map** is keyed by place and carries the evidence row, the saved shelf, the situations with their stamps, and one sound (the week's story left for Profile): every situation row now sits on the tint of the place it happens in, with its drawing on a white field inside. The situations come in two groups: **You can now** first, the ones handled with nothing handed over, with the count handled alone beside its heading; then **Next places**, the rest, worded as suggested and never as locked or missing. A learner with nothing stamped meets one group under the section's own heading, so no empty ability card is ever drawn. Under the list, when a sound check has ever named one, the acoustic panel: the sound, its authored articulation cue and physical trick, and the minimal pair that tells it from the English sound it is not, either half of which can be heard. No badge on either word, because nothing here keeps a per-word history to earn one; **Memory Deck** is keyed by phrase and carries the retained expression set large with the one claim its counters license, the lines that came out unasked with whole lines ordered first and the newest conversation's own lines next, then the cadence set (ten authored connectors, each with the note it was written with and a way to hear it, the ones the learner has produced unprompted marked with the passport's own green and lifted to the top), then the notebook and the conversation packs. The chooser closes the page outside both. There is no percentage anywhere on it and none is available to be drawn: the climb is the layout |
| Profile | The level under the name; then **Your French life**, a block that opens on **Your week**: at most three sentences the story module built from the lesson sessions, the activity log, the conversation packs and the finished missions of the last seven local days, an invitation in their place on a quiet week, the same seven-mark week rail Home draws beneath them with no number on it, and one caption; then **what the tutor remembers**, headed by the tutor's own name, one sentence in words about how much is held and never a count, and a row into a pushed screen where every remembered fact is listed with what kind of thing it is and can be forgotten one at a time or all at once, up to three goals can be written in the learner's own words, the correction dial sits beside them, and one plain sentence says what leaves the phone; then the plan: its name, its period as a distance in words, and how much speaking time is left as one of three bands said in words rather than as a number or a countdown, read from the server's own status rather than from anything the phone counted, with a way to change the plan and a way to the subscription and billing rows in Settings; then the daily goal and the correction dial chosen in place as three-way controls with the chosen gloss beneath; the tutor's voice; prefer typing; tutor speaks slower; account (download, permanent deletion), the reminder, sign out, the legal footer and the build's version line |

Every tab opens the same way. A **TabHeader** is the first thing in its scroll
body: a display title on the left, one plain purpose line beneath it in soft ink,
and an optional trailing **Monogram** for the learner's initial. It is not passed
to the frame's `header` slot, because a fixed display title over a purpose line is
taller than the screen at the largest reading size and has to scroll with the
content. Home is the one tab that carries no purpose line and no monogram: it
opens on the greeting and goes straight to the day, and `surfaceContract.test.ts`
names it as the single exception so a second tab cannot drop its line quietly.
The header can also fade its title, through a `titleOpacity` the caller drives;
that exists so Home's greeting can cycle without the display style leaving this
file.

Two rules ride with the block. **One primary pill per door**, so the eye has one
place to go on each thing it can act on. That used to read "one per tab". Tutor
carried two for a while, the scene to resume and the open conversation, and
carries one now: the circle at the top of the tab is the way into an open chat,
so the open conversation's pill went when the three ways in became rows; the
count is pinned per tab at exactly what each one draws, rather than loosened, so
a second cannot appear. My French draws two
primaries across two files and renders exactly one, and it did not need the
count moved: the one-line card is its own component, so each file still holds a
single pill and `myfrench/primary.ts` is the only thing that knows which of them
is on screen. And a caps `Label` is
violet, or it reports a state in ink, never faint: faint ink was only ever
cleared as a mark, not as a line a learner reads.

Navigation is React Navigation: a root stack whose first screen is the tab
navigator, with the lesson, the conversation, drills, review and the mission
chooser as siblings *above* it. The chooser is a stack screen rather than a tab
because the same surface is needed from three doors: a first run opens on it, a
Home card pushes it, and the Tutor tab's first two doors lead to it. That is what hides the tab bar on a metered screen, and what makes
leaving a live session an explicit act rather than a tab switch — a room that
survives a tab switch is a room the meter is still counting.

Each tab is a glyph and a word. There is no filled-icon variant, because a solid
icon would be the first two-weight mark in the app. Active is the identity violet plus a heavier
weight on both the glyph and its word, so the label carries the signal and there
is no dot. A long word wraps and the bar grows to hold it.

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
**The word and the name stay tight, and the name travels rather than jumping.**
The slot was sized by the widest word for exactly one build, so the name never
moved; the founder ran it and saw the cost, which was about fifty points of empty
space after `Salut,` and `Hello,` and nothing after `Morning,`. A gap-free line
and a name that never moves are the same tradeoff seen from two sides: if the
word is always tight against the name, the name's resting place moves with the
word's width. So the slot hugs the words themselves, and the movement became part
of the swipe. The header measures both words, and the name's `translateX` rides
the same value the strip does, so at the moment the words change the flow shifts
one way by exactly what the transform gives back. The name arrives; it never
jumps. Both words sit in normal flow rather than one being absolute, because an
absolutely positioned word is measured against its owner and a wide one would
arrive with its tail cut off.

**Three shapes were tried here in two days, so they are written down.** A fixed
slot sized by an invisible copy of the widest word came first, and it is the one
to not go back to: it keeps the name perfectly still and buys that with the fifty
points above. Then the slot hugged the words but took their widths by position,
which is wrong on the one frame that matters, because `onLayout` cannot report a
word until after the render that drew it: at the change the transform still
described the previous pair and the name landed inside the word. The widths are
keyed by the string that drew them now, so a pair is a lookup by text and is
right on the commit frame. Measuring was rejected in the design and then turned
out to be the only way to know how far the name has to travel; it is not an
oversight to be simplified away. If the line ever reads wrong again, the next
move is the name on its own second line, not a fourth measuring scheme.

**Only the word changes.** It slides up out of a slot that clips it and the next
rises in behind, one line, on the native driver. The name is outside the slot and
moves only as far as the words differ, so the line is never loose and never
overlaps. A learner who asked for less movement gets one still word, the hour's French one, and a screen reader hears that same
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
surface reads them from there: the scene hook, the voice orb, the transcript
and the splash. That sentence used to be here while four files each asked
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
it, and in the two states where somebody is talking, three soundwave **lines**
either side lean in. The founder reversed the earlier decision here: rings around
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
