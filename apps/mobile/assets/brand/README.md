# Luvani identity: the app's copies

The mark is **Hum**: the tutor's orb, humming. A coral core inside a sun ring
that ripples in seven lobes, on the brand blue. The full kit, the colour rules
and the usage guide are in `brand/` at the repo root; this folder holds what
the app itself is built with. Every file is written by
`brand/source/hum_kit.py`, so nothing here is drawn by hand.

| File | Slot in `app.json` | Notes |
|---|---|---|
| `luvani-app-icon-1024.png` | `icon`, `ios.icon.light` | 1024 square, blue full bleed, no alpha (the App Store refuses alpha) |
| `luvani-app-icon-dark-1024.png` | `ios.icon.dark` | The mark on transparency, so iOS's dark backdrop shows through |
| `luvani-app-icon-tinted-1024.png` | `ios.icon.tinted` | Grey on black with no alpha, because Expo flattens tinted faces onto white |
| `luvani-adaptive-foreground-1024.png` | `android.adaptiveIcon.foregroundImage` | The mark at 0.29 of the width from centre, inside the 33/108 circle |
| `luvani-adaptive-monochrome-1024.png` | `android.adaptiveIcon.monochromeImage` | The same silhouette in one colour, for themed icons |
| `luvani-mark-1024.png` | `expo-splash-screen` `image` | Drawn on the same 256 canvas as the launch screen, shown at `imageWidth` 128 |
| `luvani-favicon-192.png` | `web.favicon` | The small-size cut on a blue tile |

The SVG beside each raster is its master. `luvani-logo-horizontal.*`,
`luvani-logo-stacked.svg` and `luvani-wordmark.svg` are here for anything in
the app that needs the name drawn. They are outlined paths, so no font is needed.

Two things depend on these files and are held by tests:

- **The launch screen** (`src/launch/LaunchScreen.tsx`) draws the geometry in
  `src/brand/hum.ts`, which is generated from the same source as
  `luvani-mark.svg`. The native splash and the launch screen are the same frame:
  the mark at 128pt (`LAUNCH_MARK_SIZE`) on the brand blue, so the hand-off
  between them cannot be seen. `src/launch/launchScreen.test.ts` holds the ring,
  the size and the colour together.
- **The platforms' rules** are held by `src/app/deviceBuildContract.test.ts`:
  - every slot reads a file here;
  - the store and light icons are 1024 squares without alpha;
  - the tinted icon is opaque;
  - the dark icon is transparent;
  - the splash and adaptive layers have alpha;
  - the adaptive mark stays inside the launcher circle and above Android's 48dp.

To rebuild after a geometry change, run the generator (see `brand/README.md`),
then render each raster from its master at the size in the table. For the
store icon and the tinted face, flatten to RGB.
