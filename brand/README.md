# Luvani brand kit

The mark is **Hum**: the tutor's orb, humming. A coral core sits inside a sun
ring that ripples like a voice, seven lobes with one pointing straight up, on
the brand blue. It is the orb you talk to in the app made into a sign, so the
icon promises the thing the app does.

The app's own copies of the icon, splash and favicon live in
`apps/mobile/assets/brand/`. This folder is the full kit, for the website,
marketing, stores and press.

## Which file to use

| You need | Use |
|---|---|
| Website header, documents, anything on white or cream | `svg/luvani-logo-horizontal-light.svg` |
| A dark or blue section, slides | `svg/luvani-logo-horizontal-on-blue.svg`, or `-white.svg` on any other dark colour |
| A square or centred layout, posters, the launch screen look | `svg/luvani-logo-stacked-on-blue.svg` / `-light.svg` |
| One colour only: stamps, embroidery, a fax | `svg/luvani-logo-*-ink.svg` or `-white.svg` |
| The symbol on its own | `svg/luvani-symbol.svg` on blue, `svg/luvani-symbol-light.svg` on white or cream |
| Below 32 px | `svg/luvani-symbol-small.svg`: a heavier ring so it survives a browser tab |
| The name with no symbol | `svg/luvani-wordmark-ink.svg` / `-white.svg` |
| Favicons and the web app manifest | everything in `web/`, wired with `web/head-snippet.html` |
| App Store and Google Play | `store/` |
| Social avatars and link previews | `social/luvani-avatar-1024.png` (safe in a circle crop), `social/luvani-og-image-1200x630.png` |
| Raster copies of the above | `png/` |

Send printers the SVG, never a PNG.

## Colour

| Name | HEX | RGB | CMYK (approximate) | Role |
|---|---|---|---|---|
| Brand blue | `#3B2FE0` | 59 47 224 | 74 79 0 12 | The ground the mark lives on |
| Sun | `#FFC93C` | 255 201 60 | 0 21 76 0 | The ring, on blue |
| Coral | `#D63A22` | 214 58 34 | 0 73 84 16 | The core, on blue; the ring on light |
| Ink | `#16123A` | 22 18 58 | 62 69 0 77 | The wordmark on light; one-colour versions |
| Paper | `#FFF6E9` | 255 246 233 | 0 4 9 0 | The light ground |

The CMYK values are straight conversions from RGB and need proofing on paper.
No Pantone match is claimed here; match the blue, sun and coral on a printed
swatch book before any spot-colour print run.

The pairs are fixed. On the blue the ring is sun and the core is coral, and the
wordmark is white. On white or paper the ring is coral, the core is blue and the
wordmark is ink. The sun ring is never put on white or paper, where it all but
disappears. Chartreuse is the app's highlighter and never appears in the mark.

## Space and size

- **Clear space:** keep a margin of at least half the core's diameter on every
  side of the symbol. Around a logo, keep the height of the wordmark's "u" clear.
- **Smallest symbol:** 16 px, using the small-size cut below 32 px.
- **Smallest horizontal logo:** 96 px wide on screen, 25 mm in print. Below that,
  use the symbol alone.
- **Smallest stacked logo:** 64 px tall on screen, 18 mm in print.

## Please don't

- recolour the ring or the core outside the pairs above, or put the sun ring on white;
- stretch, slant, rotate or outline the mark (the app's launch screen turns the ring; nothing else does);
- add shadows, glows, gradients or glass;
- set "luvani" in a font instead of using the wordmark file;
- put the colour mark straight onto a busy photo: put it on its blue tile, or use the white version;
- crowd it inside its clear space.

## Rebuilding the kit

Every file here comes from one generator, so nothing is redrawn by hand.

```bash
uv venv /tmp/hum-env && uv pip install --python /tmp/hum-env/bin/python skia-pathops
/tmp/hum-env/bin/python brand/source/hum_kit.py /tmp/hum
/tmp/hum-env/bin/python brand/source/write_ts.py /tmp/hum/hum-geometry.json apps/mobile/src/brand/hum.ts
```

`hum_kit.py` writes every SVG master and the geometry JSON. `write_ts.py` turns
the geometry into the module the launch screen draws. Rasters are rendered from
the SVGs at the sizes listed in `apps/mobile/assets/brand/README.md`.
`apps/mobile/src/launch/launchScreen.test.ts` fails if the app's ring and the
master's ring drift apart.

## Before launch

The name and the mark have not been through a trademark search. A professional
should check classes 9, 41 and 42 (US, EU and UK), App Store name
availability, and run a reverse-image search on the mark. One finding to know
about: Pernoire launched a fragrance called "Luvani" in 2026. That is a
different class, so it is not necessarily a conflict.
