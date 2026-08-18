# Design

<!-- Recorded from the built artifact, not from intentions. Every value below is
     read out of apps/mobile/src/theme.ts and the screens as shipped. The
     previous design system (enamel wayfinding, dark Métro-plaque green) lives
     in full at the repo's baseline commit. -->

## The world

**Paper & ink.** A picture book for adults: pale lilac paper, warm black ink,
hand-drawn line-art illustrations, a serif that speaks and a sans that stays out
of the way. Flat white cards on a hairline rule; one solid ink pill per screen.

Chosen because the product asks a nervous adult to speak out loud twice a day,
and the surface that earns that is calm, friendly and professional — easy on the
eye, easy to come back to. It is the consumer language-app register (the founder
pointed at Babbel's stack screens) executed with our own pen.

What did **not** change from the enamel era, because it is behaviour rather than
surface: one primary action per screen; support colours that visibly cool as
help is withdrawn; the red live microphone; no scores and no scolding
mid-session; 44pt touch floors; type that respects the OS reading size.

## Colour

Light, and committed to one paper. Tokens from `apps/mobile/src/theme.ts`:

| Token | Value | Role |
|---|---|---|
| `paper.ground` | `#F3E8F3` | The page — everything sits directly on it |
| `paper.groundDeep` | `#EAD9EA` | Pressed states, chips, the tab track |
| `paper.card` | `#FFFFFF` | Card surface, flat |
| `paper.ink` | `#1A141E` | Near-black ink, a whisper of violet |
| `paper.inkSoft` | `#5F5566` | Secondary text |
| `paper.inkFaint` | `#92879A` | Tertiary — counts, placeholders, IPA |
| `paper.line` | `#DCCEDC` | Hairline rule on the ground |
| `paper.lineOnCard` | `#EAE0EA` | Hairline divider inside a card |
| `paper.onInk` | `#FFF9F2` | Text on an ink control — warm, never pure |

### Support colours still cool as help is withdrawn

| Rung | Colour | Meaning |
|---|---|---|
| 1 Echo | `#FFCD00` | Repeat after the tutor |
| 2 Cued | `#FF7E2E` | Choose a reply and say it |
| 3 Prompted | `#6EC4E8` | Say it in your own words |
| 4 Free | `#1A141E` | Plain ink — no line left to follow |

### Signals

Kept out of the rung set so state never reads as a rung:
`live #FF4B3E` (the microphone) · `good #1E8A5B` · `correspondance #B4008A`
(both darkened from the enamel era to hold on white cards).

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
- **PillButton** — the one primary action: solid ink pill, warm-white label,
  52pt tall.
- **OutlineButton / GhostButton** — the seconds: white pill with an ink rule, or
  bare text at full touch height.
- **OptionCard** — a tappable choice: French in the serif, English gloss under,
  quiet arrow, optional replay ear. Selection is a heavier ink rule.
- **Chip, Field, TabBar, ProgressDots** — chips fill `groundDeep`; inputs are
  white with a 1.5 rule that turns ink on focus; the Home tabs are a soft track
  with a white active pill; onboarding dots stretch the current page.
- **SpeakCircle** — THE microphone: one 108pt circle used by every speaking
  surface. Red-ringed when waiting, red-filled (with the app's only shadow)
  when live, hairline-muted when the tutor holds the floor.
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

Sign-in gate (Welcome / Create account / Sign in) → four onboarding pages →
**Home with two tabs**: *Speak* (the conversation and the guided lesson that
unlocks it; "Unable to speak right now?" at the bottom opens the same tutor in
text mode) and *Learn* (tutor-picked practice: review deck when due, the drill
bank always, a starter framing until generated exercises land). Screens are a
hand-rolled discriminated union in `App.tsx` — still no navigation library.

On web the app is a **460pt centred column**: a phone app that also runs in a
browser, not a stretched web page.

## Copy

**Chrome is plain English.** Sentence case on buttons; the caps look lives only
in the micro-`label`. French appears exactly where it is content: tutor lines,
lesson text, phrases and their glosses, topic chips (fr + en), review fronts,
register vocabulary — and the single flourish "Bonjour, {name}" on Home, which
is lesson-one vocabulary. The old FRENCH · ENGLISH paired furniture is retired.

Prose rules, unchanged and still enforced by `packages/core/src/copy.test.ts`
for core content: no em dashes where a learner reads, short plain sentences.

Two hard rules, held from the enamel era:

- **No mid-session message contains a number.** End cards may count; a session
  may not score.
- **No mid-session message scolds.** No "wrong", "bad", "failed", "incorrect".
  A rescue reads *"Let's take that one together."*

## What has no design yet

Motion, still. There is no authored transition between rungs or pages — the
support block changing shape remains the product's most meaningful state change
and it deserves one orchestrated moment. It survived the restyle as the first
thing to add next. The app icon and splash artwork are also still the enamel
era's placeholders on paper-coloured ground.
