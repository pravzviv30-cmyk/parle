# Luvani identity

The revamp mark is the **spoken L**: the letterform opens into a small speech
fold. It uses only the product palette and stays legible at app-icon scale.

- `luvani-mark.svg` — standalone transparent mark.
- `luvani-app-icon.svg` — 1024 × 1024 master on `paper.ground`.
- `luvani-logo-horizontal.svg` — horizontal mark and exact `Luvani` wordmark.
- `luvani-adaptive-foreground.svg` — the mark at two thirds size, inside Android's
  adaptive icon safe zone (a circle 66dp across on the 108dp layer).
- `luvani-adaptive-monochrome.svg` — the same silhouette with the play mark cut out,
  for Android's themed icons.

`app.json` reads the rasters beside them: `luvani-app-icon-1024.png` for the store
icon and the web favicon, `luvani-mark-1024.png` for the splash, and the two
`luvani-adaptive-*-1024.png` layers. Each was exported from its master with
`sips -s format png <name>.svg --out <name>-1024.png`. `src/app/deviceBuildContract.test.ts`
holds what the platforms require of them.

The wordmark uses the repository's licensed DM Sans Bold font. Keep the spelling,
letter spacing, proportions, and palette unchanged. The SVG masters are the
source of truth; raster exports should be generated from them at the target size.

Palette: ink `#182019`, chartreuse `#D8FF54`, warm paper `#F7F3E8`.
