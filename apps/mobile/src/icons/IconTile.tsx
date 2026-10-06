/**
 * A Bulk icon on a coloured rounded square: the mark at the head of a choice
 * (a reason, a start level, a place, a daily goal).
 *
 * The ground and the mark on it are paired here, once, so no caller can set a
 * forbidden pair (DESIGN.md, Colour): white on blue, coral and ink; ink on sun,
 * mint and the sand skeleton. There is no sand colour in palette.ts, so the
 * quiet sixth ground is `paper.skeleton` with ink, the fill the loading blocks
 * and the first rungs already use.
 *
 * The corner is 0.3 of the tile (12 at 40, 14 at 48), and the mark is 0.55 of
 * it. Decorative: the choice around it names itself in words.
 */

import type { ReactElement } from 'react';
import { View } from 'react-native';
import { colour, decorative, paper } from '../theme.ts';
import { GoalDial, type GoalQuarters } from './GoalDial.tsx';
import { Icon } from './Icon.tsx';
import type { BulkIconName } from './names.ts';

/** The six grounds a tile may take. */
export type TileGround = 'blue' | 'coral' | 'sun' | 'mint' | 'ink' | 'skeleton';

/** Each ground and the one mark colour that may sit on it. */
export const TILE_GROUND: Readonly<Record<TileGround, { readonly fill: string; readonly mark: string }>> = {
  blue: { fill: colour.blue, mark: paper.onInk },
  coral: { fill: colour.coral, mark: paper.onInk },
  sun: { fill: colour.sun, mark: paper.ink },
  mint: { fill: colour.mint, mark: paper.ink },
  ink: { fill: paper.ink, mark: paper.onInk },
  skeleton: { fill: paper.skeleton, mark: paper.ink },
};

/** The share of the tile the mark takes. */
const MARK = 0.55;
/** The corner, as a share of the tile. */
const CORNER = 0.3;

export type IconTileProps = {
  ground: TileGround;
  /** Points. 48 by default; 40 in a dense row. */
  size?: number;
} & (
  | {
      /** A Bulk icon: only an icon with a Bulk drawing may stand on a tile. */
      name: BulkIconName;
      dial?: never;
    }
  | {
      /** A daily goal's size, drawn as a ring instead of an icon. */
      dial: GoalQuarters;
      name?: never;
    }
);

export function IconTile({ ground, size = 48, name, dial }: IconTileProps): ReactElement {
  const { fill, mark } = TILE_GROUND[ground];
  const inner = Math.round(size * MARK);
  return (
    <View
      {...decorative}
      style={{
        width: size,
        height: size,
        borderRadius: Math.round(size * CORNER),
        backgroundColor: fill,
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      {name !== undefined ? <Icon name={name} variant="bulk" size={inner} color={mark} /> : null}
      {dial !== undefined ? <GoalDial quarters={dial} size={inner} color={mark} /> : null}
    </View>
  );
}
