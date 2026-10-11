# C · Bold rhythm assets

The original layered illustrations and 164 reference layers come from Luvani's
[C page](https://www.figma.com/design/sjAwoGinWQKvhGrWbgMO18?node-id=2-4), including
the revised illustration family `24:7569`. The SVG files retain editable vectors;
`source/` retains the Rive Markup Language used to compile the `.riv` files.
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
Hidden/background/reduced-motion scenes show the matching bundled static SVG.

## Rebuild

Install the official Rive CLI 1.5.1 from Rive and Python `svgpathtools` (and its
dependencies). From the repository root:

```sh
RIVE_CLI=/absolute/path/to/rive python3 scripts/build-bold-rhythm.py
```

This also runs `scripts/build-fluid-orb.py`. The compiler reported no errors or
warnings for all scenes. `boldAssets.test.ts` checks compiled headers, local
fallbacks, state machines and closed animation tracks.

Web uses pinned `@rive-app/react-webgl2` 4.36.0 and its `@rive-app/webgl2` 2.44.0
runtime. `rive.wasm` and `rive_fallback.wasm` are copied from that installed
runtime to avoid a CDN dependency. Its [MIT license](RIVE-LICENSE.txt) is bundled
from the [official repository](https://github.com/rive-app/rive-wasm/blob/master/LICENSE).
Native keeps the existing `@rive-app/react-native` 0.5.4 runtime. Outfit's actual
Black cut joins the existing cuts under [OFL-Outfit.txt](../fonts/OFL-Outfit.txt).

Frame mapping, evidence and unverified integration boundaries are recorded in
[the change plan](../../../../docs/changes/bold-rhythm.md).
