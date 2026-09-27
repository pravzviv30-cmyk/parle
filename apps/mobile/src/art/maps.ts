/**
 * Which picture belongs to which place, which tab, and which screen.
 *
 * The registry says what exists; this says who draws it. Keeping the two apart
 * means a screen never spells a filename, and a picture can be swapped for a
 * better one by editing a single line here rather than hunting quoted strings
 * through five tabs.
 *
 * It is by place rather than by mission id for the same reason `missionTint.ts`
 * is: the café is the café whichever mission sends a learner there, and a
 * seventh mission in an existing place inherits its scene for free. A seventh
 * *place* is a compile error on the `Record` until somebody draws it.
 *
 * This file imports its key type only, so node can load it: `registry.ts` calls
 * `require` on a PNG, which is a Metro thing and nothing else understands.
 */

import type { MissionPlace } from '@luvani/core';

import type { ArtKey } from './registry.ts';

/** The scene behind a place: the hero card on Home, and the chooser's rows. */
export const HERO_ART: Record<MissionPlace, ArtKey> = {
  cafe: 'hero-cafe',
  hotel: 'hero-hotel',
  market: 'hero-market',
  street: 'hero-street',
  home: 'hero-home',
  friends: 'hero-friends',
};

/** The scene for one place. Total, because the parameter is the closed union. */
export function heroArt(place: MissionPlace): ArtKey {
  return HERO_ART[place];
}

/**
 * Every remaining scene, named by the screen that draws it.
 *
 * These are the pictures a learner meets once or rarely: the first run, the
 * empty deck, the end of a lesson, the wall. Naming them by screen rather than
 * by subject is what lets `registry.test.ts` prove nothing ships undrawn.
 */
