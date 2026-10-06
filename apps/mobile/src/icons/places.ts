/**
 * The icon for each place a conversation happens in.
 *
 * A `Record` over `MissionPlace` rather than a switch, so a seventh place added
 * to the catalogue with no icon is a typecheck failure here, not a blank disc
 * on a phone. `glyphs.test.ts` reads the union from packages/core and holds
 * every place to an icon that exists.
 */

import type { MissionPlace } from '@luvani/core';
import type { IconName } from './names.ts';

export const PLACE_ICON: Readonly<Record<MissionPlace, IconName>> = {
  cafe: 'cafe',
  friends: 'friends-place',
  home: 'home-place',
  hotel: 'hotel',
  market: 'market',
  street: 'street',
};
