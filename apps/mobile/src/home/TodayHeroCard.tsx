/**
 * The frame of Today's hero (UI-015): one card overlapping the sky, `card`
 * fill, `radius.feature`, padding 16 18 18 (the foot a spacer), and a 2pt `line` lift drawn as the
 * ground behind it rather than a shadow. Children only: the fix, the scene or
 * the lead draws itself on this card's ground, with no card of its own.
 */

import type { ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';

import { useThemedStyles, type B } from '../main/bTheme.tsx';
import { radius, space } from '../theme.ts';

/** The lift under the card. */
const LIFT = 2;
/** The board's padding, 16 top and 18 at the sides and foot, and its 6pt gap. */
const PAD_TOP = space(4);
const PAD_SIDE = 18;
const GAP = 6;
/** The 18pt foot, as a spacer after the gap (the frame alone pads the scroll, F409). */
const FOOT = 18 - GAP;

export function TodayHeroCard({ children }: { children: ReactNode }) {
  const s = useThemedStyles(makeStyles);
  return (
    <View style={s.lift}>
      <View style={s.card}>
        {children}
        <View style={{ height: FOOT }} />
      </View>
    </View>
  );
}

const makeStyles = (t: B) =>
  StyleSheet.create({
    lift: { backgroundColor: t.line, borderRadius: radius.feature },
    card: { backgroundColor: t.card, borderRadius: radius.feature, marginBottom: LIFT, paddingTop: PAD_TOP, paddingHorizontal: PAD_SIDE, gap: GAP },
  });
