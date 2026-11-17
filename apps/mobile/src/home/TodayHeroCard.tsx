/**
 * The frame of Today's hero (UI-015): one card overlapping the sky, `card`
 * fill, the card corner, padding 16 18 18 (the foot a spacer), and a 2pt `line` lift drawn as the
 * ground behind it rather than a shadow. Children only: the fix, the scene or
 * the lead draws itself on this card's ground, with no card of its own.
 *
 * Two more looks (F996). `plain`: no card at all, the words on the paper 20pt
 * under the sky, so a held hero's LipTile never sits on a card. `pending`: the
 * one sand block while the lead decides, with the children kept mounted but
 * hidden, so the hero loads in one look. The tree keeps one shape across all
 * three, so a child is never remounted when the look changes.
 */

import type { ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';

import { Skeleton } from '../components.tsx';
import { useThemedStyles, type B } from '../main/bTheme.tsx';
import { corner, radius, space } from '../theme.ts';

/** The lift under the card. */
const LIFT = 2;
/** The board's padding, 16 top and 18 at the sides and foot, and its 6pt gap. */
const PAD_TOP = space(4);
const PAD_SIDE = 18;
const GAP = 6;
/** The 18pt foot, as a spacer after the gap (the frame alone pads the scroll, F409). */
const FOOT = 18 - GAP;

/** The hero's sand block, shared with the page's loading skeleton. */
export const HERO_SAND = { height: 262, radius: radius.card } as const;

export function TodayHeroCard({ children, plain = false, pending = false }: { children: ReactNode; /** No card: the words on the paper (a held hero carrying Review). */ plain?: boolean; /** The lead has not decided: the sand block, the children mounted but hidden. */ pending?: boolean }) {
  const s = useThemedStyles(makeStyles);
  return (
    <View style={pending ? undefined : plain ? s.plain : s.lift}>
      {pending ? <Skeleton blocks={[HERO_SAND]} /> : null}
      <View style={pending ? s.hidden : plain ? s.plainBody : s.card}>
        {children}
        {pending || plain ? null : <View style={{ height: FOOT }} />}
      </View>
    </View>
  );
}

const makeStyles = (t: B) =>
  StyleSheet.create({
    lift: { backgroundColor: t.line, ...corner.card },
    card: { backgroundColor: t.card, ...corner.card, marginBottom: LIFT, paddingTop: PAD_TOP, paddingHorizontal: PAD_SIDE, gap: GAP },
    plain: {},
    plainBody: { paddingTop: space(5), gap: GAP },
    hidden: { display: 'none' },
  });
