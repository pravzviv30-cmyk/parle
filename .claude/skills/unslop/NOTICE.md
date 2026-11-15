# Notice

This skill is an adaptation of **unslop** by Damir Sokolovsky
([@heydamir](https://x.com/heydamir)).

- Source: <https://github.com/heydamir/unslop>
- Commit: `620163eedb3529d9cd23a3994ed8d287d06f760d`
- Licence: Creative Commons Attribution 4.0 International (CC BY 4.0),
  <https://creativecommons.org/licenses/by/4.0/>

The adaptation is distributed under the same CC BY 4.0 terms. No endorsement by
the author is implied.

## Precedence

Luvani's `DESIGN.md` and `PRODUCT.md`, and the founder's boards in
`docs/DESIGN_PARTNERSHIP.md`, take precedence over every rule here. An unslop
rule applies only where those documents are silent.

## What was changed

- `SKILL.md` was rewritten for an Expo / React Native app: it reads DESIGN.md
  and PRODUCT.md first, settles the known clashes in Luvani's favour (bold
  Outfit display type, the press and pop springs, Luvani's radius scale and the
  onboarding radius rule, the one sanctioned sky, the mascots and pastel tints,
  the warm paper ground), and splits the workflow into a build-time use and a
  read-only push-time audit that never redesigns. "Set the direction and stop"
  runs only when the founder asks for a redesign.
- Web specifics were translated: Tailwind classes and px to `StyleSheet` values
  and `theme.ts` tokens, CSS shadows to `boxShadow` and the shadow allowlist,
  `tabular-nums` to `fontVariant: ['tabular-nums']`, CSS transitions to
  Reanimated with the `DUR`, `EASE` and `SPRING` tokens.
- `references/signs.md` keeps the sign groups with React Native examples, marks
  the landing-page group not applicable and tags the signs the mechanical
  scanner (`scripts/unslop-scan.mjs`) counts.
- `references/tokens.md` replaces unslop's starting values with a map onto
  Luvani's real tokens.
- `references/visuals.md` is cut to what applies: Luvani's visuals are already
  decided, and only AI-default filler counts.
- `references/effects.md` and `references/rtl.md` are kept close to the
  original with a Luvani note on top; `rtl.md` is for future right-to-left
  languages.

## What was omitted

- `scripts/snapshot.mjs`, the live-URL snapshot.
- `scripts/story.mjs` and the story video section (Playwright and ffmpeg).
- Paid image generation and its prompt recipe.
- `references/refs/` images, and `references/refs.md`, which only describes
  those images.
- The landing-page, hero and dashboard-shell layout rules, which do not apply
  to this app.
