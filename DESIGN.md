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

Light, and committed to one paper. Tokens from `apps/mobile/src/theme.ts`:

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
`live #FF4B3E` (the tutor's voice — red never marks the learner's mic now) ·
`good #1E8A5B` · `correspondance #B4008A` (the latter two darkened from the
enamel era to hold on white cards).

### The voice circle speaks traffic lights

`theme.ts`'s `orb` block, taught to every new learner by TutorIntro's final
page, so these values changing means that page is teaching a lie — change both:

| State | Colour | Caption |
|---|---|---|
| Tutor speaking | `orb.speaking` red `#FF4B3E` | Listen |
| Your turn | `orb.yourTurn` green `#1E8A5B` | Speak |
| Thinking | `orb.thinking` amber `#E3A800` | One moment |

Amber is darker than rung 1's yellow so the caption under it stays legible on
lilac. Green is the same green everywhere the learner speaks: the orb's
your-turn state, the lesson SpeakCircle, the Review button, the path's
learned marks.

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
- **Chip, Field, TabBar, ProgressDots** — chips fill `groundDeep`; inputs are
  white with a 1.5 rule that turns ink on focus; the Home tabs are a soft track
  with a white active pill; onboarding dots stretch the current page.
- **SpeakCircle** — THE microphone: one 108pt circle used by every speaking
  surface. Green-ringed when waiting, green-filled (with the app's only shadow)
  when live — green means "you speak", matching the voice circle —
  hairline-muted when the tutor holds the floor.
- **Icons** — authored SVG at the illustration stroke (2.2), ink by default.
  The Google mark is a monochrome line-art G: no brand-colour asset in v1.

## Illustrations

Authored inline SVG in `src/illustrations.tsx`, one style contract stated in
the file header: ink stroke 2.2 round-capped, `fill="none"` except tiny solid
accents (a beret, a flame, a heart — a tenth of a scene at most), stipple-dot
shading, deliberately quirky proportions, viewBox 200×150, no second colour —
the paper shows through. Eight scenes: café hero, name tag, birthday cake,
suitcase, winged clock, clinking speech bubbles, sprouting word cards, postcard.

## Structure

A two-page moving welcome on first launch (the café scene says hello; page two
says what Parle is and why speaking out loud is the point) → sign-in gate
(Welcome / Create account / Sign in) → four onboarding pages → **five icon-only
tabs along the bottom**:

| Tab | What it is |
|---|---|
| Home | The level card, the evidence, one way in |
| Tutor | Free conversation. A one-time four-page intro whose last page teaches the traffic-light circle, and whose button genuinely starts a conversation |
| Practice | The path, the guided lesson, the drill bank, the review deck — plus one topic card per conversation subject, projected live from the deck |
| Leaderboard | Global and Friends. Friends works against clearly-labelled sample users behind an adapter until there is a server; add-friends lives one screen deeper |
| Profile | Account, support, sign out, the legal footer |

Navigation is React Navigation: a root stack whose first screen is the tab
navigator, with the lesson, the conversation, drills and review as siblings
*above* it. That is what hides the tab bar on a metered screen, and what makes
leaving a live session an explicit act rather than a tab switch — a room that
survives a tab switch is a room the meter is still counting.

The tab bar has no filled-icon variant, because a solid icon would be the first
two-weight mark in the app. Active is ink plus a dot beneath it, which is
ProgressDots' grammar reused.

On web the app is still a **460pt centred column**, and the navigator mounts
inside it, so the tab bar is clamped to the column rather than spanning the
browser.

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

The app had none. It now has exactly one vocabulary, and the next animated
screen must not invent a second:

- **transform and opacity only**, always `useNativeDriver: true`
- **never an SVG attribute** (`r`, `d`, `cx`) — those cannot cross to the
  native driver and drop the whole animation onto the JS thread
- one continuous loop plus one settling entrance; nothing bounces
- **reduce-motion renders the final frame**, not nothing: the scene is the
  content, the movement is the flourish
- absolutely-positioned moving pieces are placed in *container* pixels, not in
  the viewBox units the still art is drawn in

Two things move. The **welcome** — steam drifting off a café cup, two speech
bubbles arriving one after the other, then a settling second page. And the
**voice circle**: two concentric outline rings breathing around one solid
centre, offset so they drift rather than pump in unison. Five states — idle,
speaking, listening, thinking, error — said in traffic-light colour (red
listen, green speak, amber one-moment) and one caption. The founder chose this
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
- **Home and the leaderboard may count.** DESIGN.md's rule is that no
  *mid-session* message contains a number. Home is not mid-session, so the
  board counts and the tutor still does not — no numerals in watchdog copy, no
  counts in the transcript, dots rather than numbers on progress.

## What has no design yet

The app icon and splash artwork in `app.json` are still the enamel era's
placeholders on paper-coloured ground.
