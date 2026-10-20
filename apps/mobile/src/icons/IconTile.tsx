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
 * A tile inside a chosen `Choice` is the one exception: the choice fills with
 * the brand blue (or the sun on a blue ground), which would swallow a blue or
 * a sun tile whole, so there the tile turns white with the mark in the brand
 * blue (come alive, icons section 1.6). `Choice` says so through
 * `TileOnChosen`; nothing else provides it.
 *
 * The corner is 0.3 of the tile (12 at 40, 14 at 48), and the mark is 0.55 of
 * it. Decorative: the choice around it names itself in words.
 */

import { createContext, useContext, type ReactElement } from 'react';
import { View } from 'react-native';
import { decorative } from '../theme.ts';
import { b } from '../palette.ts';
import { useB, type B } from '../main/bTheme.tsx';
import { GoalDial, type GoalQuarters } from './GoalDial.tsx';
import { Icon } from './Icon.tsx';
import type { BulkIconName } from './names.ts';

/** The six grounds a tile may take. */
export type TileGround = 'blue' | 'coral' | 'sun' | 'mint' | 'ink' | 'skeleton';

/** Each ground and the one mark colour that may sit on it. */
// 2026-10-21 UI-008: the pairs read the theme (useB), so a tile follows dark on
// a dark-ready screen; `b.light` is the old paper and colour values exactly.
export function tileGrounds(t: B | typeof b.light): Readonly<Record<TileGround, { readonly fill: string; readonly mark: string }>> {
  return {
    blue: { fill: t.brand, mark: t.onBrand },
    coral: { fill: t.coral, mark: t.onBrand },
    sun: { fill: t.sun, mark: t.onMint },
    mint: { fill: t.mint, mark: t.onMint },
    ink: { fill: t.primary, mark: t.onPrimary },
    skeleton: { fill: t.skeleton, mark: t.text },
  };
}

/** The light pairs, for callers outside a theme. */
export const TILE_GROUND = tileGrounds(b.light);

/** A tile on a chosen choice: the card, with the mark in the brand blue (the link in dark). */
const chosenTile = (t: B | typeof b.light) => ({ fill: t.card, mark: t.link });

/** Whether the tiles inside sit on a chosen choice. Provided by `Choice` alone. */
export const TileOnChosen = createContext(false);

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
  const chosen = useContext(TileOnChosen);
  const t = useB();
  const CHOSEN = chosenTile(t);
  const TILE_GROUND = tileGrounds(t);
  const { fill, mark } = chosen ? CHOSEN : TILE_GROUND[ground];
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
