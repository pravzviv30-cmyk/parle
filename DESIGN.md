# Design

<!-- Recorded from the built artifact, not from intentions. Every value below is
     read out of apps/mobile/src/theme.ts and the screens as shipped. The
     previous design system (enamel wayfinding, dark Métro-plaque green) lives
     in full at the repo's baseline commit. -->

## The world

**Colourful calm.** A picture book for adults: pale lilac paper, violet-cast
ink, hand-drawn line-art illustrations, a serif that speaks and a sans that
stays out of the way. Flat white cards on a hairline rule. Colour does jobs
now: **violet is identity** (the primary pill, the micro-labels, the monogram),
**green means go** (your turn to speak, ground already covered), **amber means
thinking**, **red means the tutor is talking**.

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

Light, and committed to one *lightness*. Every raw value lives in
`apps/mobile/src/palette.ts`, which imports nothing so that
`palette.test.ts` can hold it to a contract; `theme.ts` composes its tokens
from there and its public exports are unchanged.

### Five papers, one light

**A paper with no caller is not shipped, and this table may not claim it is.**
For most of this system's life every one of these was decoration: `paperFor`
had no application caller at all, eighteen of nineteen screens rendered house,
and the column on the right described places the colour had never reached.
`palette.test.ts` now reads both sides — which ids the app actually passes to
`paperFor`, and what this table says — and fails when they disagree.

A paper is a place's light: a ground, one step deeper for chips and pressed
states, a hairline, and the accent its small type is set in.

| Paper | ground | groundDeep | line | accent | Where |
|---|---|---|---|---|---|
| `house` | `#F3E8F3` | `#E4D3EE` | `#D9C8E2` | violet `#6B3FA0` | Everything not about one subject, including the live conversation |
| `sand` | `#FEE7DB` | `#FCCFC1` | `#EFC5B6` | bronze `#8C5800` | RecapScreen and SummaryScreen: the café arc as the learner just lived it |
| `sage` | `#E8EED5` | `#DBDCB2` | `#CFD1A8` | harbour `#00689E` | Dormant social prototype screens, no longer reachable from primary navigation |
| `lagoon` | `#CFF3EB` | `#AFE4D0` | `#A4D9C6` | iris `#445EB4` | Not shipped: reserved for a topic the tutor wrote, once those have a screen of their own |
| `sky` | `#D5EFFE` | `#ABE1F5` | `#A1D6E9` | violet `#6B3FA0` | Practice and its deck: PracticeTab, ReviewScreen, DrillScreen, FocusDrillPlayer |

All five grounds sit at **L\* 93.1**, the lightness the lilac already had, and
that is the whole safety argument. Contrast is a function of relative
luminance, luminance is a function of L\*, and the a/b axes do not enter the
formula. Hold lightness still and every ink keeps the exact ratio it had, on
every paper: measured drift across the set is under 0.3%. The other two steps
are computed rather than picked, by the rule that reproduces the original
lilac trio exactly (groundDeep at L\* 86.6, chroma +8.5, hue −11; line at
L\* 82.7, chroma +8.1, hue −10).

Papers are **place identity, not mode identity**. `paperFor(id)` pins the
authored units and hashes learner topics over the rest, stably, because a
topic that changed colour between two launches reads as a different topic.

### The accents, and the one rule that keeps them safe

The micro-label used to be a lighter violet `#8A5BBF`, which read **4.08**
against the ground at 11.5pt bold and was under the floor for small text. Each
paper now carries its own accent at **L\* 42**, all clearing 5.0 on their own
paper and 4.2 on a filled chip, and all at least a Delta-E of **30** from every
signal and rung colour. Bronze is bronze rather than the obvious plum because
the contrast test refused a plum: at Delta-E 24 from `signal.correspondance`,
the label above a card and the colour meaning "change this" were one colour.

**An accent is typographic; a signal is a mark.** A label, a chip, or a
drawing's one solid fill may take an accent. A dot, a ring, or anything
reporting state never may. That separation is what lets colour vary by place
without any of it reading as a verdict.

### The house paper, unchanged

Tokens from `apps/mobile/src/theme.ts`:

| Token | Value | Role |
|---|---|---|
| `paper.ground` | `#F3E8F3` | The page — everything sits directly on it |
| `paper.groundDeep` | `#E4D3EE` | Pressed states, chips, the tab track — lavender |
| `paper.card` | `#FFFFFF` | Card surface, flat |
| `paper.ink` | `#241633` | Near-black ink with a real violet cast |
| `paper.inkSoft` | `#5F4E73` | Secondary text |
| `paper.inkFaint` | `#94849F` | Tertiary — counts, placeholders, IPA |
| `paper.line` | `#D9C8E2` | Hairline rule on the ground |
| `paper.lineOnCard` | `#EAE0F0` | Hairline divider inside a card |
| `paper.onInk` | `#FBF6FF` | Text on a filled control — violet-white, never pure |
| `accent.primary` | `#6B3FA0` | The identity violet: primary pill, monogram |
| `accent.label` | `#8A5BBF` | Micro-labels — the caps line above a card |

### Support colours still cool as help is withdrawn

| Rung | Colour | Meaning |
|---|---|---|
| 1 Echo | `#FFCD00` | Repeat after the tutor |
| 2 Cued | `#FF7E2E` | Choose a reply and say it |
| 3 Prompted | `#6EC4E8` | Say it in your own words |
| 4 Free | `#241633` | Plain ink — no line left to follow |

### Signals

Kept out of the rung set so state never reads as a rung:
`live #DE3B2D` (the tutor's voice — red never marks the learner's mic now) ·
`good #1E8A5B` · `correspondance #B4008A` (the latter two darkened from the
enamel era to hold on white cards; `live` darkened later, see below).

### The voice circle speaks traffic lights

`theme.ts`'s `orb` block, taught to every new learner by TutorIntro's final
page, so these values changing means that page is teaching a lie — change both:

| State | Colour | Caption |
|---|---|---|
| Waiting to be tapped | `orb.ready` violet `#6B3FA0` | Tap to talk |
| Tutor speaking | `orb.speaking` red `#DE3B2D` | Listen |
| Your turn | `orb.yourTurn` green `#1E8A5B` | Speak |
| Thinking | `orb.thinking` amber `#B07510` | One moment |

**Two floors, not one, and conflating them was a real bug.** A mark that
reports state is a graphical object and clears **3** against its paper; words
clear **4.5**. The captions used to be set in the state's own colour, which
quietly held the word to the mark's floor — so "One moment" shipped at 1.79 and
"Speak" at 3.64. Captions are ink now; the orb carries the colour and the word
carries the meaning. Amber and red were darkened to clear the mark floor
(`#E3A800` measured 1.79, `#FF4B3E` 2.79) and `palette.test.ts` asserts all
three, plus that no two lights and no light and rung 1 come within Delta-E 30.

`orb.thinking` sits nearer `accents.bronze` than the accent rule would normally
allow, and that is deliberate: every amber far enough from bronze to satisfy it
sits around L\* 23 and reads as dark olive. The orb owns its screen and never
shares one with a paper's accent, so legibility won. `orb.*` are therefore held
to their own contract in the tests rather than folded into `signal.*`.

**Violet is the fourth state and is not a traffic light.** A closed microphone
waiting to be tapped is the primary control of the whole product, so it takes
the primary colour exactly as the pill does. It used to be drawn in `paper.line`
— the hairline token — which made the one thing a learner must press the
faintest object in the app. It stops being violet the instant it reports
anything.

Green is the same green everywhere the learner speaks: the orb's your-turn
state, the lesson SpeakCircle, the Review button, the path's learned marks.

## Type

**Fraunces** (SemiBold/Bold, the 72pt optical statics) carries anything with a
voice: screen headlines, big stats, and **every French line the learner reads**,
always sentence case, never caps. **DM Sans** (Regular/Medium/Bold) is the
furniture. Both OFL, committed in `assets/fonts/` with their licences.

| Style | Face / size | Use |
|---|---|---|
| `display` | Fraunces Bold 32 | Screen headline |
| `title` | Fraunces 24 | Section head, big stat |
| `frenchLg` | Fraunces 28 | The line to say (`fitDisplay()` steps 28 → 24 → 20 by length) |
| `french` | Fraunces 21 | Inline French — options, cards, chips |
| `heading` | DM Sans Bold 17 | Screen titles in chrome |
| `body` / `bodyStrong` | DM Sans 16 | Prose |
| `small` | DM Sans 13.5 | Secondary lines |
| `label` | DM Sans Bold 11.5, caps, 1.2 tracking | Micro-labels above cards |
| `button` | DM Sans Bold 16 | Pill and outline lettering |
| `notation` | DM Sans Medium 14 | IPA — real notation, not mono-as-costume |

## Surfaces and controls

- **Card** — white, radius 14, one hairline `paper.line` rule, flat. No shadows
  anywhere except the live microphone's glow.
- **PillButton** — the one primary action: solid violet pill (`accent.primary`),
  warm-white label, 52pt tall.
- **OutlineButton / GhostButton** — the seconds: white pill with an ink rule, or
  bare text at full touch height.
- **OptionCard** — a tappable choice: French in the serif, English gloss under,
  quiet arrow, optional replay ear. Selection is a heavier ink rule.
- **Field, TabBar, ProgressDots** — inputs are
  white with a 1.5 rule that turns ink on focus; the Home tabs are a soft track
  with a white active pill; onboarding dots stretch the current page.
- **SpeakCircle** — THE microphone: one 108pt circle used by every speaking
  surface. Green-ringed when waiting, green-filled (with the app's only shadow)
  when live — green means "you speak", matching the voice circle —
  hairline-muted when the tutor holds the floor.
- **Icons** — authored SVG at the illustration stroke (2.2), ink by default.
  The Google mark is a monochrome line-art G: no brand-colour asset in v1.

## Illustrations

Authored inline SVG in `src/illustrations/`, one style contract stated in
`pen.tsx`: ink stroke 2.2 round-capped, `fill="none"` except tiny solid
accents (a beret, a flame, a heart — a tenth of a scene at most), stipple-dot
shading, deliberately quirky proportions, viewBox 200×150, no second colour —
the paper shows through. `src/illustrations.tsx` remains as a one-line barrel,
so the thirteen screens that import from it did not change.

Eighteen scenes. The original eight: café hero, name tag, birthday cake,
suitcase, winged clock, clinking speech bubbles, sprouting word cards,
postcard. Four of those now move. Six fill a place that previously said
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

## Structure

A two-page moving welcome on first launch (the café scene says hello; page two
says what Luvani is and why speaking out loud is the point) → sign-in gate
(Welcome / Create account / Sign in) → three onboarding pages (the age gate
first, then a name, then one page saying what the tutor is; everything but the
age is skippable) → the mission chooser, with the café already picked → **five
icon-only tabs along the bottom**:

That age gate has a second door. A session the tutor ended because the learner
said in a scene that they are under thirteen is remembered by the account, and
the next launch shows the same page again with two lines changed: it says
nothing about what happened, and it says that everything they have learned is
still there. Passing it is one tap and nothing else is asked twice.

| Tab | What it is |
|---|---|
| Home | The level card, the evidence, the next situation to walk into, one way in |
| Tutor | Three doors: continue a recent mission, start a practical one, or talk freely. The four-page intro that used to stand in front of them is a quiet "How the circle works" link here and in Profile |
| Practice | The path, the guided lesson, the drill bank, the review deck — plus one topic card per conversation subject, projected live from the deck |
| My French | Personal evidence: situations completed, best independence, retained phrases, and honest known-reference sound checks |
| Profile | Account (the daily goal, how much the tutor corrects, and permanent account deletion), support, sign out, the legal footer |

Navigation is React Navigation: a root stack whose first screen is the tab
navigator, with the lesson, the conversation, drills, review and the mission
chooser as siblings *above* it. The chooser is a stack screen rather than a tab
because the same surface is needed from three doors: a first run opens on it, a
Home card pushes it, and the Tutor tab's first two doors lead to it. That is what hides the tab bar on a metered screen, and what makes
leaving a live session an explicit act rather than a tab switch — a room that
survives a tab switch is a room the meter is still counting.

The tab bar has no filled-icon variant, because a solid icon would be the first
two-weight mark in the app. Active is ink plus a dot beneath it, which is
ProgressDots' grammar reused.

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
  plays that line again.
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
and the single flourish "Bonjour, {name}" on Home, which is lesson-one
vocabulary. The conversation OPENS in English (the spoken question, no menu)
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
**voice circle**: two concentric outline rings breathing around one solid
centre, offset so they drift rather than pump in unison. Six states — ready,
idle, speaking, listening, thinking, error — said in traffic-light colour (red
listen, green speak, amber one-moment), violet for the untapped control, and
one caption always set in ink. The founder chose this
ring shape explicitly over a lit gradient sphere. It carries no shadow; the
app's only shadow belongs to the live microphone and nothing else may borrow
it.

Deliberately not driven by audio amplitude. An analyser feeding setState sixty
times a second is the churn that would force a reanimated dependency, and that
is the one place worth spending one later.

## Two deliberate divergences

Written down so nobody "fixes" them back:

- **The practice path does not gate.** Every authored node is open in any
  order; sequence is one node marked as next. PRODUCT.md principle 1 is that
  support is withdrawn as the learner improves, never withheld until earned.
  The only thing that locks is practice written from conversations the learner
  has not had yet.
- **Home and My French may count.** DESIGN.md's rule is that no
  *mid-session* message contains a number. Home is not mid-session, so the
  board counts and the tutor still does not — no numerals in watchdog copy, no
  counts in the transcript, dots rather than numbers on progress.

## What has no design yet

The app icon and splash artwork in `app.json` are still the enamel era's
placeholders on paper-coloured ground.
