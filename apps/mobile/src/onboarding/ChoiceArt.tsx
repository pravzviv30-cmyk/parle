/**
 * The mark at the head of a first-run choice: a delegate to `IconTile` (come
 * alive, D11; icons section 1.4). It used to draw nine small vector spots of
 * its own, several of them the same cup; now each kind is one Bulk icon from
 * the set on the ground that means it, and the tile pairs that ground with
 * the one mark colour allowed on it.
 *
 * The reasons each have their own icon and colour: food on sun, a trip on
 * blue, family on coral, moving on mint, work on ink, and exploring on the
 * quiet sand skeleton. The three start levels are all mint, so the icon alone
 * carries the step from an empty bubble to two. Coffee and tea no longer share
 * a cup.
 *
 * `ability`, `time` and `days` name a page rather than an answer, the
 * way the first-run screens still ask for them; they keep the old grounds and
 * stay until those screens pass the answer itself. Decorative, like every
 * tile: the choice around it names itself in words.
 */

import type { ReactElement } from 'react';
import { IconTile, type TileGround } from '../icons/IconTile.tsx';
import type { BulkIconName } from '../icons/names.ts';

export type ChoiceArtKind =
  | 'coffee'
  | 'tea'
  | 'food'
  | 'family'
  | 'trip'
  | 'moving'
  | 'work'
  | 'because'
  | 'ability'
  | 'zero'
  | 'few'
  | 'getby'
  | 'time'
  | 'days';

/** Each kind's icon and the ground it stands on. */
const ART: Readonly<Record<ChoiceArtKind, { readonly name: BulkIconName; readonly ground: TileGround }>> = {
  coffee: { name: 'coffee', ground: 'sun' },
  tea: { name: 'tea', ground: 'sun' },
  food: { name: 'food', ground: 'sun' },
  family: { name: 'family', ground: 'coral' },
  trip: { name: 'trip', ground: 'blue' },
  moving: { name: 'moving', ground: 'mint' },
  work: { name: 'work', ground: 'ink' },
  because: { name: 'exploring', ground: 'skeleton' },
  ability: { name: 'bubbles', ground: 'mint' },
  zero: { name: 'bubble-empty', ground: 'mint' },
  few: { name: 'bubble-line', ground: 'mint' },
  getby: { name: 'bubbles', ground: 'mint' },
  time: { name: 'clock', ground: 'coral' },
  days: { name: 'calendar', ground: 'sun' },
};

export function ChoiceArt({ kind, size = 40 }: { kind: ChoiceArtKind; size?: number }): ReactElement {
  const { name, ground } = ART[kind];
  return <IconTile name={name} ground={ground} size={size} />;
}
