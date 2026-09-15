# Art

The watercolour line-art scenes of revamp A. Every file here is named once in
`apps/mobile/src/art/registry.ts` with its point size and drawn through `src/art/Art.tsx`,
which hides it from assistive technology; `registry.test.ts` fails on an unregistered file,
a missing density, or a file over budget.

Generated on 2026-09-15 with Gemini (`gemini-2.5-flash-image`) from one shared prompt and
one subject line per scene, then the white matte was removed to real transparency, the
margins trimmed to the ink, and each file quantised to 256 colours. The prompt named the
colours in words only; a hex code in a prompt came back painted onto the picture. The
originals and the scripts live outside the repo with the founder; any scene can be
regenerated in under a minute and dropped in under the same name. All art is owned by
Luvani; nothing here is third-party.

Shared prompt: hand-drawn line art in one thin dark violet ink line, loose and slightly
imperfect, round line ends, with a soft translucent watercolour wash in pale peach, pale
sky blue, sage green, mint teal and lilac that stays inside the lines only loosely and
fades out at the edges; no text, no gradients, no drop shadows, no border, generous white
space, plain white background; picture book for adults, calm, Parisian.
