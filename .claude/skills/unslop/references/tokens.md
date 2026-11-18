# Tokens

unslop's token intent, mapped onto Luvani's real tokens. The values live in
`apps/mobile/src/theme.ts`, `apps/mobile/src/palette.ts` and
`apps/mobile/src/motion/tokens.ts`; DESIGN.md documents them. Read those files
for the current numbers. This table only says which Luvani token answers each
unslop rule, and where unslop's own default does not apply.

## Spacing

| unslop intent | Luvani token |
| --- | --- |
| 4px scale | `space(n)` = n × 4 |
| Between related items | `RHYTHM.item` (12) |
| Between groups / cards | `RHYTHM.block` (20) |
| Between sections | `RHYTHM.section` (32) |
| Inline gap | `RHYTHM.inline` (8) |
| Touch row height | `HIT` (44) minimum |
| Page padding | DESIGN.md Layout: 24pt gutters, reading column at most 560 |

unslop's sidebar, top bar, dashboard shell and landing hero sizes: not
applicable.

## Colour

| unslop intent | Luvani token |
| --- | --- |
| Neutral ramp | `paper` (warm ground, white card, ink) and the B tokens `b.light` / `b.dark` |
| Text roles | `paper.ink` and the B `secondary` roles; see DESIGN.md's colour tables |
| One accent | `accent.primary` (the ink pill) and the saturated `colour` set, each with the job DESIGN.md gives it |
| Soft grounds | `pastel` (butter, lavender, peach, sage) for illustrated cards only |
| Semantic colours | `signal` |
| Hairline | `HAIRLINE` (1) with the palette's line colours, like `paper.lineOnCard` |
| Contrast floors | `palette.test.ts`: words 4.5, marks 3 |

unslop's graphite, warm and ink hex ramps: not used. Luvani's palette replaces
them.

## Type

| unslop intent | Luvani token |
| --- | --- |
| One family | Outfit only, `font.*` (Regular, Medium, SemiBold, Bold, ExtraBold) |
| Type scale | `type.*` for the main app, `bType.*` for the B artboards, `boldType.*` for onboarding |
| Weights 400 to 500 | Not applied: ExtraBold titles and heads and Bold display lines are Luvani's (DESIGN.md Type, UI-021) |
| Tabular figures | `fontVariant: ['tabular-nums']` |
| Tracking | the token's own `letterSpacing`; none added by hand on small text |

## Radius

| unslop intent | Luvani token |
| --- | --- |
| Card 12 to 16 | `radius.card` (20), drawn as `...corner.card` |
| Tile | `radius.tile` (18), `...corner.tile` |
| Row, input, button 8 to 10 | `radius.field` (14) and its aliases `chip`, `input`, `control` |
| Chip or mark inside a tile, card or field | `radius.inset` (12), `radius.mark` (8), `radius.nib` (4) |
| Pill | `radius.pill` (999), no continuous curve |
| Onboarding | the same scale (UI-021 chose it; UI-023 made it app-wide) |
| Nested radius | kept: inner = outer minus padding, never below 4 (`radius.nib`) |

## Icons

| unslop intent | Luvani token |
| --- | --- |
| lucide 16 or 18, stroke 1.5 | The project's own set in `icons/`, stroke `STROKE` (2) |
| Glyph disc in a tinted row | `DISC` (44) |

## Depth

| unslop intent | Luvani token |
| --- | --- |
| Light-theme soft shadow | `shadow.lift` / `liftStyle`, under an illustrated Explore card only |
| Other shadows | Only the reviewed allowances in `surfaceContract.test.ts` |
| Dark depth | surface steps from `b.dark`, no shadows |
| Focus | `FOCUS` (2pt ink ring with a white halo) |

## Motion

| unslop intent | Luvani token |
| --- | --- |
| One easing curve | `EASE.out` (the same `0.22, 1, 0.36, 1` unslop recommends), plus `EASE.settle`, `inOut`, `in`, `linear` |
| Press / toggle 120 to 180ms | `DUR.micro` (120), `DUR.fast` (180) |
| Entrances 300 to 500ms | `DUR.base` (260), `DUR.settle` (380), `DUR.slow` (420) |
| Stagger 40 to 60ms | `STAGGER.tight` (40), `STAGGER.base` (60) |
| Press scale 0.97 to 0.98 | `PRESS_SCALE` (0.97), `PRESS_SCALE_TILE` (0.95) |
| No bouncy springs | Not applied: `SPRING.press` and `SPRING.pop` overshoot by design; `SPRING.settle` and `SPRING.snap` barely do |
| CSS transitions | Reanimated through `motion/drive.ts` only |
| Reduced motion | `DUR.instant` |

---

Adapted from unslop by Damir Sokolovsky ([@heydamir](https://x.com/heydamir)),
<https://github.com/heydamir/unslop>, CC BY 4.0. Changes are listed in
[../NOTICE.md](../NOTICE.md).
