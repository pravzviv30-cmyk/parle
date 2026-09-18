/**
 * Every raster scene the app ships, named once, with the size it is drawn at.
 *
 * Revamp A brought watercolour line-art PNGs into a world that had only ever
 * drawn vectors. Two rules keep that from spreading:
 *
 * ## Why one registry
 *
 * A picture referenced from the screen that draws it is a picture nobody can
 * count. Here they are all in one list, so `registry.test.ts` can hold the
 * three promises that matter without a renderer: every name has both densities
 * on disk, every file is inside the byte budget, and nothing sits in the folder
 * that no screen draws. The point sizes live here for the same reason — a width
 * written at the call site is a width that drifts between two screens showing
 * the same scene.
 *
 * ## Why `require`, spelled out longhand
 *
 * Metro resolves `require` at build time by reading the literal string, and it
 * is Metro that picks `@2x` or `@3x` from the bare name at runtime (the web
 * takes the `@2x`). A loop building `require(`../../assets/art/${key}.png`)`
 * bundles nothing at all and fails on the device, so each path is written out.
 * This is the same shape, and the same reason, as `tutor/voiceSamples.ts`.
 *
 * ## The budget
 *
 * 350 KB per file, 4 MB for the folder, enforced by the test beside this file.
 * Art is the one part of this app that can quietly triple a download, and an
 * app that takes a minute to install on a café's wifi is an app that does not
 * get installed. Two densities only, heroes no larger than 900x540 at `@3x`.
 *
 * This file cannot be imported by a node test: `require` of a PNG is a Metro
 * thing. Anything that needs the key list at runtime under node reads this file
 * as text, exactly as `tutorVoice.test.ts` does for the voice clips.
 */

/** What `require` hands back for a bundled asset: a number on native, an object on web. */
export type ArtSource = ReturnType<typeof require>;

export const ART = {
  'hero-hotel': { source: require('../../assets/art/hero-hotel.png'), width: 300, height: 180 },
  'hero-cafe': { source: require('../../assets/art/hero-cafe.png'), width: 300, height: 180 },
  'hero-market': { source: require('../../assets/art/hero-market.png'), width: 300, height: 180 },
  'hero-street': { source: require('../../assets/art/hero-street.png'), width: 300, height: 180 },
  'hero-home': { source: require('../../assets/art/hero-home.png'), width: 300, height: 180 },
  'hero-friends': { source: require('../../assets/art/hero-friends.png'), width: 300, height: 180 },
  'welcome-bubbles': { source: require('../../assets/art/welcome-bubbles.png'), width: 220, height: 140 },
  'onboard-wave': { source: require('../../assets/art/onboard-wave.png'), width: 220, height: 140 },
  'onboard-cake': { source: require('../../assets/art/onboard-cake.png'), width: 220, height: 140 },
  'empty-table': { source: require('../../assets/art/empty-table.png'), width: 220, height: 140 },
  'recap-postcard': { source: require('../../assets/art/recap-postcard.png'), width: 220, height: 140 },
  phrasebook: { source: require('../../assets/art/phrasebook.png'), width: 220, height: 140 },
  'wall-map': { source: require('../../assets/art/wall-map.png'), width: 300, height: 180 },
} as const;

/** The closed set of pictures. A name that is not here is a compile error at the call site. */
export type ArtKey = keyof typeof ART;

/** Every key, in the order they are registered. */
export const ART_KEYS = Object.keys(ART) as readonly ArtKey[];
