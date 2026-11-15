# Signs of slop

Go through every group and note each sign you find with `file:line`. Each line
pairs the sign with its fix. A sign that DESIGN.md or PRODUCT.md sanctions is
not slop; see "Luvani's design comes first" in [../SKILL.md](../SKILL.md). Signs
marked **(scan)** are also counted by `scripts/unslop-scan.mjs`.

## Surfaces and colour

- Hue-to-hue gradients (`LinearGradient`, `RadialGradient`, `experimental_backgroundImage`) on grounds, cards, buttons or the active tab, outside the sanctioned sky **(scan)** → a flat palette ground
- Gradient text in headings, numbers or the wordmark → solid text colour from the palette
- Coloured glows, like `boxShadow: '0px 0px 20px #6357F2'` or a coloured `shadowColor` with a large `shadowRadius` **(scan)** → remove; depth from the card on the ground and hairlines
- Any shadow outside `shadow.lift` and the reviewed allowances in `surfaceContract.test.ts` → remove
- Colour washes or blurred blobs behind content → remove
- Neon or high-contrast coloured borders → `HAIRLINE` in the palette's line colour
- Many near-identical tints for text → the palette's text roles
- Every element highlighted, so nothing leads → the saturated colour only where DESIGN.md gives it a job
- Glass cards with an inner highlight and a coloured shadow → a plain card
- A raw hex or `rgba()` in a screen → a palette token

## Type

- Outfit Black, or a heavy cut set by hand instead of through a type token **(scan)** → the `type` / `bType` / `boldType` token DESIGN.md names (ExtraBold and Bold titles are Luvani's, not slop)
- Uppercase labels with wide tracking → sentence case, no tracking
- Too many sizes and weights on one screen → the tokens the screen's spec names
- Numbers in mixed formats, like `1,240` next to `1240` → one format, `fontVariant: ['tabular-nums']`
- Negative letter spacing on small text → zero
- Italic for emphasis, or italic French → weight or colour

## Icons

- Emoji as tab icons, label decoration or status, like 🏠 🚀 🔥 ⚠️ **(scan)** → a glyph from `icons/`, or nothing
- Emoji inside pills and counts → plain number
- Icons in many sizes, strokes and colours → `STROKE` and the text role colour
- Icons nudged off the column → one icon box width in every row
- A sparkle ✨ for anything AI → remove, or a plain glyph only where it explains something

## Spacing

- Arbitrary values, like `marginTop: 13` or `height: 31` → `space(n)` steps
- Rows in one list with different heights or gaps → one height, one gap
- Groups closer to their neighbours than to their own items → `RHYTHM`: smaller inside, bigger between
- Uneven padding inside sibling cards → one padding
- A target under 44 → `HIT`

## Copy

PRODUCT.md and `copy.test.ts` govern first.

- Exclamation marks and `!!` → plain statement
- Changes without a reference, like `+12%!!` → `+12% vs last week`
- Wordy placeholders, like `Search anything...` → `Search`
- Hype words: seamless, supercharge, unlock, magic, AI-powered, effortless, revolutionary **(scan)** → what the thing actually does
- Trailing periods on labels and buttons → none
- Fake-looking data, like `123,456` or `[X]` → plausible numbers (real ones on a learner screen; every number comes from saved records)
- Scolding or guilt about a missed day → warm and plain (PRODUCT.md)

## Components

- Glowing pills for counts, plans or status → quiet text
- `PRO`, `New ✨`, `Beta 🚀` badges everywhere → remove, or one quiet text badge
- A literal `borderRadius: 12` that matches no token **(scan)** → `radius.*`, or onboarding's rule (pills, cards 20, tiles 18, inputs 14)
- Nested radii that do not add up → inner = outer minus padding, never below 4
- Charts with rainbow bars, glowing bars or uppercase labels → one series, one highlight colour
- Sparklines or mini bars added to every stat tile → the number, its label and its change
- A wordmark as a gradient tile with a sparkle → the name in Outfit, flat

## Landing pages and heroes

Not applicable: Luvani is an app with no landing page in this repo. Onboarding
follows its board (UI-021), not unslop's hero rules.

## Visuals

The mascots, `art/flat/` illustrations and pastel stage tints are Luvani's own
and stay.

- Glossy 3D blobs, orbs as decoration, liquid chrome or a nebula → remove, or a drawing from `art/` the spec names
- Stock robots, glowing brains, circuit lines for anything AI → remove
- Text or fake buttons baked into an image → real `Text`
- A visual on every section → one where DESIGN.md puts one

## Motion

- `withRepeat` loops on things that are not live, outside `motion/drive.ts` and the loops DESIGN.md names **(scan)** → static
- A raw `withSpring` / `withTiming` config instead of `SPRING.*`, `DUR.*`, `EASE.*` → the token, through `drive.ts`
- Scale-up on press or hover on cards → `PRESS_SCALE` / `PRESS_SCALE_TILE` down on the press spring (its overshoot is by design)
- Everything flying in from different directions → one short fade and rise with `STAGGER`
- Animating width, height, top, left or margins → transform and opacity
- Motion that ignores reduced motion → `DUR.instant`

## Right to left

For future right-to-left languages only; see [rtl.md](rtl.md).

## Template look

Not slop, but what a cleaned-up screen falls back to when nobody decided. Raise
these as proposals, never fix them in a push.

- A screen that would fit another language app if you swapped the name
- A drawing slot filled with an empty box or a generic picture
- Every screen getting the same layout

---

Adapted from unslop by Damir Sokolovsky ([@heydamir](https://x.com/heydamir)),
<https://github.com/heydamir/unslop>, CC BY 4.0. Changes are listed in
[../NOTICE.md](../NOTICE.md).
