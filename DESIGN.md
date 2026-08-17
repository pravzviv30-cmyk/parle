# Design

<!-- Recorded from the built artifact, not from intentions. Every value below is
     read out of apps/mobile/src/theme.ts and the screens as shipped. -->

## The world

**Enamel wayfinding.** The Paris street plaque and the Métro sign: a deep bottle-green
vitreous enamel field, a struck white rim with a real bevel, a thin inner keyline, and
white caps on generous tracking.

Chosen because it is a *wayfinding* system, and scaffolding is wayfinding — you are
here, go this way. Enamel signs are calm and authoritative. They never panic and never
scold; they orient you and then get out of the way. That is the exact behaviour the
product contractually requires of its tutor.

It also happens to be the graphic system the learner will be standing in front of,
lost, when they finally reach France.

Deliberately **not**: gamified cartoon green with confetti (the category default), and
not calm cream-and-serif "mindful learning" (its predictable opposite).

Direction seed key `160dc64e`, candidate 3 of 7.

## Colour

Dark, and not by category habit. The use scene decides it: an adult on a dim evening
train, phone at chest height, headphones in, slightly self-conscious about speaking
aloud. Deep green also *is* the plaque colour, so the ground and the material agree.

Strategy: **Committed** — one saturated field owns the surface, the way a real plaque
does. Not neutrals-plus-accent.

| Token | Value | Role |
|---|---|---|
| `enamel.ground` | `#08221A` | Page ground — a plaque in shadow |
| `enamel.field` | `#0F3B2C` | The plaque body |
| `enamel.fieldRaised` | `#154836` | A raised plaque, one step up |
| `enamel.white` | `#F2EFE4` | Enamel white — warm, never pure |
| `enamel.whiteMuted` | `#A9C4B6` | Secondary text, tinted from the field's hue |
| `enamel.whiteFaint` | `#6E9384` | Tertiary — counts, IPA, tags |

Secondary text is tinted green from the ground rather than greyed, so it stays part of
the same material.

### Rung colours are real RATP line colours

Not invented. Support visibly *cools* as it is withdrawn — hot yellow while the tutor
carries the learner, plain enamel white once they are on their own.

| Rung | Colour | Line | Meaning |
|---|---|---|---|
| 1 Echo | `#FFCD00` | Ligne 1 | Repeat after the tutor |
| 2 Cued | `#FF7E2E` | Ligne 5 | Choose a reply and say it |
| 3 Prompted | `#6EC4E8` | Ligne 13 | Say it in your own words |
| 4 Free | `#F2EFE4` | — | No line left to follow |

### Signals

Kept out of the rung set so state never reads as a rung.
`correspondance #CF009E` (where you change lines to fix a sound) ·
`good #6ECA97` · `live #FF4B3E` (the microphone).

## Type

**Archivo**, self-hosted, four weights (400/600/700/800). A grotesque with genuine
signage character — the system sans would have been a failure, not a fallback.

Plaque lettering is ExtraBold, uppercase, `letterSpacing 1.6`, and **steps down by
line length** (30 → 24 → 19pt) because a real sign is cut to fit its longest word.
Nothing disables `allowFontScaling`, so everything respects the OS reading size.

| Style | Size / tracking | Use |
|---|---|---|
| `plaque` | 30 / 1.6 | The line to say |
| `plaqueSmall` | 21 / 1.1 | Section heads, stat values |
| `heading` | 19 / 0.6 | Drill titles |
| `tag` | 11 / 1.8 | Stencilled caps tags |
| `body` | 16 | Prose |
| `notation` | 14 / 0.4 | IPA — real notation, not mono-as-costume |

## The plaque

The one component everything else derives from. Anatomy, outside in: **raised white
rim (3px) → green gap → thin white keyline (1px) → content.** The bevel is an offset,
softly-blurred shadow (`0 6px 14px`, raised `0 10px 22px`), never a zero-offset halo.
Corner radius 5 — real plaques are almost square.

Two tones carry a real distinction: **green is permanent wayfinding** (the line to
say), **white is a temporary notice** (the rung-3 English instruction). The material
change tells the learner the information has a different status.

## Components

- **Line bullet** — Métro roundel, 26pt, numeral flips dark on light fills.
- **Station line** — the lesson as a line, one stop per turn, current stop struck
  larger with a ground-coloured ring.
- **Direction plaque** — a rung-2 option with an RATP arrow. Min height 56pt.
- **Speak control** — 108pt circle, red when live with a matching coloured shadow,
  hollow and muted when the tutor holds the floor.
- **Icons** — authored SVG at a consistent 2.1 stroke. No glyphs, no emoji. The arrow
  is the RATP solid head on a short thick shaft.

## Spacing

4pt base (`space(n) = n * 4`). Tight inside a group, generous between. Screen gutter
`space(5)` = 20pt.

## Platform

iOS HIG governs structure; the world expresses through tint, type, surface and
content. Safe-area insets on every screen. **44pt minimum** on every tappable control
(the `aide-moi` affordance and the drill CTA are sized to it explicitly). On web the
app is constrained to a **460pt centred column** — it is a phone app that also runs in
a browser, not a stretched web page.

## Copy

French for the product's own furniture (`SORTIE`, `CORRESPONDANCE`, `PARLEZ`,
`aide-moi`, `VOTRE CARNET`), and every French label carries its plain English
meaning beside or beneath it, via the `LabeledTag` component or an inline
`FRENCH · ENGLISH` pairing on buttons. The chrome stays part of the immersion and a
beginner is never left guessing what a control does.

Prose rules, enforced by `packages/core/src/copy.test.ts`: no em dashes anywhere a
learner reads, short plain sentences, no filler words. The tutor LLM carries the
same rules in its prompt.

Two hard rules, enforced by tests rather than by review:

- **No mid-session message contains a number.** Scores make a beginner
  self-conscious about speaking, which is the one thing the product cannot afford.
- **No mid-session message scolds.** No "wrong", "bad", "failed", "incorrect". A
  rescue reads *"Let's take that one together."*

## What has no design yet

Motion. There is no authored transition between rungs, and the ladder changing shape —
plaque to options to notice — is currently instant. That change is the product's most
meaningful state transition and it deserves one orchestrated moment. It is the first
thing to add, not more colour.
