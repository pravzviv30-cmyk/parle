# Visuals

How unslop's visuals guidance applies to Luvani.

## Luvani's visuals are already decided

DESIGN.md defines the world: the mascots (`art/mascots/`), the flat
illustrations (`art/flat/`), the pastel stage tints and Today's sky
(`art/sky/`), all in one flat hand with palette fills only. They are not
filler, and this skill never removes or replaces them. New art comes from a
founder board in `docs/DESIGN_PARTNERSHIP.md` and the art registry, not from
this workflow.

## What still counts as filler

Decoration no Luvani doc names, usually from an AI default:

- glossy blobs, orbs used as decoration, nebulas, chrome liquid, floating cubes
- neon circuits, holograms, glowing brains, robots, rockets, crystal shapes
- sparkles for anything AI
- text, fake buttons or a fake logo baked into an image
- a drawing on every section, where DESIGN.md puts one in a few places

The fix is to remove it, or to use the drawing the screen's spec names. A
missing moment is a **proposal** for the founder, never a change in a push.

## Does the screen need one?

From unslop, still true here: settings, lists and most working screens do not.
Empty states, onboarding and celebrations usually do, and DESIGN.md already
says which drawing each one carries.

## Put it on the page

- Decorative art spreads `decorative` from `theme.ts` so screen readers skip it.
- Fixed dimensions, so the layout does not jump.
- Static, or a loop DESIGN.md's Loops section names, pausable and quiet under
  reduced motion. No parallax.
- The art sits on the screen's own ground, with no hard rectangle of a
  different colour.

## Omitted

unslop's image generation (paid tools: fal, Replicate, OpenAI images,
Higgsfield), its prompt recipe and its landing-hero scenes are left out. See
[../NOTICE.md](../NOTICE.md).

---

Adapted from unslop by Damir Sokolovsky ([@heydamir](https://x.com/heydamir)),
<https://github.com/heydamir/unslop>, CC BY 4.0. Changes are listed in
[../NOTICE.md](../NOTICE.md).
