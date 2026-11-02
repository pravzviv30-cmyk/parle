# C · Bold rhythm assets

The original layered illustrations and 164 reference layers come from Luvani's
[C page](https://www.figma.com/design/sjAwoGinWQKvhGrWbgMO18?node-id=2-4), including
the revised illustration family `24:7569`. The SVG files retain editable vectors;
`source/` retains the Rive Markup Language those SVGs compile to. The compiled
`.riv` files and the `stills.json` bundle were deleted on 2026-11-01: since C2
nothing loaded them (the app draws the exported SVG layers in `assets/c2`), and
only `../rive/streak.riv` still plays through Rive. The build scripts no longer
write either into this folder.
Runtime code does not fetch Figma export URLs or flatten screens into images.

There are 24 bundled scenes: 18 illustrations and six fluid sphere states.
The sphere is newly authored from the user's October 11 soft-gradient reference,
superseding C's ring/bar orb. Colour communicates real connection/audio state:
ready pale violet, connecting lavender, listening sun, thinking violet, speaking
coral/peach, and error muted peach. Audio amplitude remains owned by `OrbPulse`.

`motion.json` contains retrieved Figma illustration tracks, including sampled
spring easing. Artwork follows the user's later continuous-motion instruction:
closed 4.8-second illustration loops and eight-second sphere loops. Error art is
still. Interface transitions, presses, progress and confetti remain event driven.
Hidden/background/reduced-motion scenes showed the matching bundled static SVG
while these scenes were live.

## Rebuild

Install the official Rive CLI 1.5.1 from Rive and Python `svgpathtools` (and its
dependencies). From the repository root:

```sh
RIVE_CLI=/absolute/path/to/rive python3 scripts/build-bold-rhythm.py
```

This also runs `scripts/build-fluid-orb.py`. Each scene is verified and compiled
inside its git-ignored `source/<scene>/build/` folder; nothing is copied into this
folder and no `stills.json` is written. `boldAssets.test.ts` checks that every
scene has its source and svg, that no svg depends on a remote URL, and that the
animation tracks close. The svgs are the inputs the scripts read, and nothing in
the app bundles them.

The web Rive runtime (`@rive-app/react-webgl2` and its `@rive-app/webgl2`) and the
`rive.wasm` and `rive_fallback.wasm` copies were removed on 2026-11-02: nothing loaded
them after the onboarding Rive scenes were deleted. [RIVE-LICENSE.txt](RIVE-LICENSE.txt)
was the licence for those wasm copies and is now unused.
The streak flame's native player is `@rive-app/react-native` 0.5.4 runtime. Outfit's actual
Black cut joins the existing cuts under [OFL-Outfit.txt](../fonts/OFL-Outfit.txt).

Frame mapping, evidence and unverified integration boundaries are recorded in
[the change plan](../../../../docs/changes/bold-rhythm.md).
