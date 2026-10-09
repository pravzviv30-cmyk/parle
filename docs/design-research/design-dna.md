# Luvani design DNA

The source of truth for the current identity is `apps/mobile/src/palette.ts`, `theme.ts`, `responsiveLayout.ts` and the current Figma components. The older paper/lilac notebook rules and comments are history where they conflict with the user’s adopted colourful direction.

| Foundation | Keep | Refine |
|---|---|---|
| Personality | Joyful, encouraging, human-scale French practice | Confidence through fewer words and fewer competing actions |
| Colours | Paper #FFF6E9, ink #16123A, blue #3B2FE0, coral #D63A22, sun #FFC93C, mint #2FD18B | Full colour for story/milestone surfaces; paper/white for sustained reading and billing |
| Type | Outfit, 400–800; rounded, confident headings | One display headline, one body role, optional necessary helper; no decorative subheadings |
| Spacing | Four-point grid; 16–24pt content padding | Consistent 8/12/16pt internal gaps; avoid cards inside cards |
| Shapes | Flat surfaces; 16/20/24/28pt radii, pill actions | Thin selected outlines plus explicit state; no heavy shadows |
| Illustration | Existing editable café, hotel, market, notebook and celebration artwork | One scene illustration per task; compress decorative art before text |
| Live voice | Soft blue/lilac cloud orb matching the supplied reference | State label accompanies motion; activity comes from real session state |
| Navigation | Home / Speak / Practice / Progress | Profile, Friends and Settings remain secondary destinations; no fifth/sixth tab |
| Branding | Startup mark and brief startup animation | No repeated Luvani logo in screen headers |
| Motion | Short, interruptible transitions and measured celebration | 180–240ms UI transitions; gentle orb; stop offscreen/background; Reduce Motion removes transforms |

Use white text on blue/coral; ink on yellow/mint/paper. Never use yellow or mint text on paper for essential information. A selected option needs a checked/selected semantic state, not just colour. Native targets are at least 44pt with visible focus on web.

## Two directions

**A — Refined:** paper-led, compact white choices, small illustration, calm tutor canvas. Best for low stimulation and reading. It improves hierarchy but underuses the vivid, full-slide identity the user explicitly requested.

**B — Recommended evolution:** saturated story backgrounds, a single large headline, joyful contextual artwork, compact white action rows, quieter payment surface with a yellow allowance block, blue live-tutor canvas. Keep settings/forms calm. This expresses the reference without copying the theme-park visuals or adding arbitrary decoration.

| Criterion (design judgement, 1–5) | A | B |
|---|---:|---:|
| Recognisable Luvani identity | 4 | 5 |
| Reading simplicity | 5 | 4 |
| Fit to user’s vibrant reference | 3 | 5 |
| Reusable native structure | 5 | 4 |
| Focus during practice | 5 | 5 |

Recommend B with A’s restraint for legal, settings, recovery and billing details. These scores are design judgements, not usability-test results.

## Adaptive contract

Design by available width, height, safe area, keyboard and font scale—not phone model names. Verify 375×812, 390×844, 430×932, landscape/keyboard and maximum supported Dynamic Type. Future device names are not a reliable sizing specification. Maintain content widths of 560 for reading, 800 maximum content, 480 footer and 640 navigation as the current source defines. At compact height, shorten art and spacing before allowing content scroll; never hide price/recurrence or reduce readable type to force no scrolling. Tablet/desktop use centred tasks and optional supporting context, not oversized stretched cards.
