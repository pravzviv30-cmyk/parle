/**
 * Which tint sits under which way into the tutor — F573.
 *
 * `missions/missionTint.ts` names the paper under a place; this names the paper
 * under a way of talking, on the same rule and for the same reason. One file
 * decides it, so the tab cannot draw "Everyday mission" on one tint today and
 * another tomorrow, and a screen names the door rather than a colour.
 *
 * The three are the peach of a real situation, the sky of talking about
 * anything, and the sage of rehearsing something small. The remembers row above
 * them takes the peach too: it is the same everyday thread picked back up, and
 * a fourth tint there would read as a fourth way in rather than as the one the
 * learner already started.
 *
 * This file imports nothing that reaches react-native, and nothing that reaches
 * the palette's values — only the name of a tint — so the test can import it
 * under plain node and `palette.test.ts`'s rule that a hex is reachable from
 * four files only still holds.
 */

import type { TintName } from '../palette.ts';
import type { EntryModeKey } from './gate.ts';

export const DOOR_TINT: Record<EntryModeKey, TintName> = {
  everyday: 'sand',
  free: 'sky',
  rehearse: 'sage',
};

/** The paper under "Alexandre remembers": the everyday thread, picked up. */
export const CONTINUITY_TINT: TintName = 'sand';

export function doorTint(key: EntryModeKey): TintName {
  return DOOR_TINT[key];
}
