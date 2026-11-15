---
name: unslop
description: Luvani's adaptation of heydamir/unslop. Finds and removes AI-looking UI (glows, emoji labels, hype copy, stray radii, looping motion, filler visuals) in the Expo / React Native app without changing Luvani's own design. Use for UI and design work at build time, and as the audit the read-only unslop-reviewer runs at push time. DESIGN.md and PRODUCT.md win every clash.
license: CC-BY-4.0
metadata:
  author: Damir Sokolovsky
  x: https://x.com/heydamir
  source: https://github.com/heydamir/unslop
  adapted-for: Luvani (see NOTICE.md)
---

# Unslop, adapted for Luvani

unslop was created by Damir Sokolovsky ([@heydamir](https://x.com/heydamir)),
<https://github.com/heydamir/unslop>, licensed under CC BY 4.0. This is an
adaptation; what changed is in [NOTICE.md](NOTICE.md). Keep this credit in any
copy.

Vibecoded UI fails in the same predictable ways: every surface glows, every
label has an emoji, spacing is whatever the model typed that day, and the copy
shouts. Unslopping fixes the craft and keeps the product. Craft keeps the chrome
quiet and puts the richness into one or two moments of content.

## Luvani's design comes first

Luvani already has a designed system. unslop itself says a product's real brand
is kept, so this skill never replaces it.

1. **Read `DESIGN.md` and `PRODUCT.md` first**, then `apps/mobile/src/theme.ts`,
   `apps/mobile/src/palette.ts` and `apps/mobile/src/motion/tokens.ts` for the
   token names. For the screen in hand, read its row in
   `docs/DESIGN_PARTNERSHIP.md`.
2. **Each unslop rule below applies only where those docs are silent.** When a
   rule here and a Luvani doc disagree, the doc wins and the rule does not apply.
3. **Known clashes, settled in Luvani's favour:**
   - *Weight.* unslop says no 700 to 900 headings. Luvani's type is Outfit in
     five cuts with ExtraBold titles and heads (DESIGN.md, Type), and onboarding
     is "Luvani, cozy bold" with the display line at Bold (UI-021). Those stay.
     What still counts: Outfit Black (not a Luvani cut), and a heavy weight set
     by hand instead of through a `type` / `bType` / `boldType` token.
   - *Springs.* unslop says no bouncy springs. `SPRING.press` and `SPRING.pop`
     overshoot by design, and the motion tokens and DESIGN.md's Motion section
     govern. What still counts: a spring or loop that is not a named token, or
     motion written outside `motion/drive.ts`.
   - *Radius.* unslop's 8 to 10 controls and 12 to 16 cards do not apply. The
     scale is `radius` in `theme.ts` (card 24, feature 28, tile 20, stat 18,
     field 16, pill 999), and onboarding follows its own rule: pills, cards 20,
     tiles 18, inputs 14. What still counts: a literal radius that matches no
     token or documented rule, and nested radii that do not add up.
   - *Gradients.* unslop says none. Luvani has none either, except the one
     sanctioned soft sky (`art/sky/`, onboarding's sky window). The tutor orb's
     surface is the orb's own art. Anything else is slop.
   - *Visuals.* unslop says remove filler visuals. The mascots, the flat
     illustrations and the pastel stage tints are Luvani's world, not filler.
     What still counts: generic AI imagery (orbs as decoration, sparkles, robots,
     nebulas) that no Luvani doc names.
   - *Neutral surfaces.* unslop wants grey app chrome. Luvani's ground is warm
     paper, white cards and four saturated colours that lead a screen. Keep it.
4. **Never set a new direction on your own.** Screen directions come from the
   founder's boards (`docs/DESIGN_PARTNERSHIP.md`). unslop's "set the direction
   and stop" step runs only when the founder asks for a redesign.

## Two uses

### Build time: a UI implementer

1. **Look at the screen.** Find the files that render it. Run the web build and
   take a screenshot at 375 and 320, light and dark, so you judge what people
   see and not only the code.
2. **Audit.** Go through [references/signs.md](references/signs.md) and list
   every sign you find, one line each with `file:line`. Drop any sign the Luvani
   docs sanction. Run `node scripts/unslop-scan.mjs --diff <range>` for the
   mechanical ones.
3. **Decide how much to change.**
   - *Light slop* (the usual case in Luvani): fix only what the audit found,
     inside the existing tokens. Bigger ideas go into the report as proposals.
   - *No slop:* say so. Suggest at most two or three refinements with exact
     token names, and apply them only if asked.
   - *Heavy slop or a redesign:* only when the founder asked for one, and the
     direction comes from their board.
4. **Fix in the nine passes below, in order**, finishing one across the whole
   screen before the next.
5. **Check** with the checklist at the end, render again and compare with the
   audit list.
6. **Report** a few lines per pass about what changed.

### Push time: the read-only reviewer

`unslop-reviewer` (`.claude/agents/unslop-reviewer.md`) audits only. It never
proposes a new direction, never redesigns and never edits. It runs steps 1 and 2
on the diff and the Playwright screenshots, plus `scripts/unslop-scan.mjs`, and
sorts what it finds into:

- **Slop:** a break of DESIGN.md or PRODUCT.md, or a clear sign from
  `signs.md` where Luvani's docs are silent. Fixed in this push.
- **Redesign proposals:** anything that would change a direction, a layout or a
  visual. Logged in `docs/DESIGN_PARTNERSHIP.md` and never applied.

## The nine passes

Exact token names are in [references/tokens.md](references/tokens.md). Values
come from `theme.ts`, `palette.ts` and `motion/tokens.ts`; never invent one.

### 1. Spacing

- Everything sits on the 4pt grid through `space(n)`, with page gaps from
  `RHYTHM` (12 between items, 20 between cards, 32 between sections). A 2pt
  nudge inside a small control is fine; an odd value that exactly centres
  something stays.
- Same thing, same size: rows in a list share one height and gap, sibling cards
  one padding.
- Space shows grouping: smaller inside a group than between groups.
- Things line up: icons in one column, labels on one line, numbers in one
  column. Nothing nudged off with a stray `transform` or odd margin.
- Every target stays at least `HIT` (44).

### 2. Colour

- Colours come from `palette.ts` through `theme.ts` and the B tokens; no raw hex
  in a screen (`palette.test.ts` holds the floors).
- Text roles from the palette, not a dozen near-identical tints.
- The saturated colours lead a screen or report state, as DESIGN.md assigns
  them. Chartreuse is a highlighter, never a surface.
- No hue gradients outside the sanctioned sky, no gradient text, no coloured
  glows or coloured shadows, no colour blobs behind content, no neon borders.
- Depth: the one `shadow.lift` under an illustrated Explore card, and the
  reviewed allowances in `surfaceContract.test.ts`. Nothing else casts a shadow.
- Hairlines are `HAIRLINE` with the palette's line colours.

### 3. Icons

- Every emoji used as an icon or as decoration in UI chrome becomes a glyph
  from `icons/` (the project's one set), or nothing.
- One stroke, `STROKE` (2). Icons take the colour of their text role.
- The icon box has one width in every row so labels align.
- Drop icons that add nothing.

### 4. Copy

PRODUCT.md and `copy.test.ts` govern voice: warm, short plain sentences, no em
dashes, no scolding. Where they are silent:

- No exclamation marks in interface text, never `!!`.
- Short labels, no trailing period on labels, buttons and titles.
- A change says what it compares to.
- No hype words: seamless, supercharge, unlock, magic, AI-powered, effortless,
  revolutionary. Say what the thing does.
- No claims that cannot be checked, no fake-looking data, no `PRO` or `New ✨`
  badges.

### 5. Type

- Outfit only, through the `type`, `bType` and `boldType` tokens. Never Black;
  ExtraBold and Bold where DESIGN.md names them.
- Sentence case everywhere; no uppercase tracked labels.
- No negative letter spacing on small text; tight tracking only on the display
  tokens that already carry it.
- Numbers in one format with `fontVariant: ['tabular-nums']` where figures sit
  in a column or count up.
- No italic, and never italic French. The French line is the largest text in
  its block.

### 6. Layout

- Keep the sections and their order.
- DESIGN.md's Layout section governs: 24pt gutters, a reading column at most
  560pt, a 460pt centred column on the web, safe areas, font scale, rotation.
- One primary action per screen and at most one quiet secondary.
- unslop's sidebar, dashboard-shell and landing-hero rules do not apply to this
  app.

### 7. Details

- Nested radius: inner = outer minus the padding between them, never below 4.
- Counts and meta are quiet text, not glowing pills.
- Charts and stat tiles follow DESIGN.md; where it is silent, one accent per
  chart and stat tiles are numbers, not mini charts.
- Active and pressed states stay inside the palette; the focus ring is `FOCUS`.

### 8. Visuals

- Luvani's visuals are its mascots, `art/flat/` illustrations and the stage
  tints, drawn in one flat hand (DESIGN.md). Keep them.
- Decorative filler with no Luvani source goes: glossy blobs, nebulas, floating
  cubes, glowing grids, robots, sparkles for anything AI.
- No generated images in this workflow.

### 9. Motion

- Motion goes through `motion/drive.ts` with `DUR`, `STAGGER`, `EASE` and
  `SPRING`; a press is `PRESS_SCALE` (0.97) or `PRESS_SCALE_TILE` (0.95) on the
  press spring.
- Loops (`withRepeat`) only where DESIGN.md's Loops section names one, and only
  where they can pause.
- Animate transform and opacity; never width, height, top, left or margins.
- Respect reduced motion: `DUR.instant`.
- At most one entrance on load, a short fade and rise with a small stagger.

## Do not

- Do not rename the product or change what it is: features, content and order
  stay.
- Do not replace removed decoration with new decoration, or swap one trend for
  another (glass, grain, noise, neon, bento).
- Do not invent features, claims or data.
- Do not override DESIGN.md, PRODUCT.md or a founder board.

## Checklist

- [ ] DESIGN.md, PRODUCT.md and the screen's partnership row were read first
- [ ] Spacing on `space()` and `RHYTHM`; equal things have equal sizes
- [ ] Icons, labels and numbers each sit in one aligned column
- [ ] Colours from the palette tokens only, with their contrast floors
- [ ] No hue gradients outside the sky, no gradient text, glows, coloured shadows or blobs
- [ ] No emoji left in the UI chrome
- [ ] One icon set, one stroke
- [ ] Outfit through the type tokens, no Black, no uppercase tracked labels, no italic, no negative tracking on small text
- [ ] No exclamation marks, no trailing periods on short strings, no hype words, no unverified claims
- [ ] Figures in one format with `tabular-nums` where they align or count
- [ ] Radii from `radius` (or onboarding's rule), and nested radii add up
- [ ] Motion from the tokens through `drive.ts`; no unnamed loops or springs; no animated layout properties
- [ ] `node scripts/unslop-scan.mjs` exits 0
- [ ] Template check: swap the product name for another product's; if the screen still fits, say so as a proposal, do not redesign
- [ ] Right to left, for future RTL languages only: [references/rtl.md](references/rtl.md)
