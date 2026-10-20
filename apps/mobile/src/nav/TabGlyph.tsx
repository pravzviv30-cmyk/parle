/**
 * The tab icon's one movement (come alive, icons section 1.5; F737).
 *
 * When a tab becomes the selected one, its icon rises two points and grows to
 * 1.15, then the pop spring brings it home, while the Bulk drawing fades in
 * over the Linear one. Only on a real change from not selected to selected:
 * never when the bar mounts, never on a tap of the tab already open. When the
 * review deck goes from nothing due to something due while the bar is open,
 * the Practice dot pops in once; a deck already due when the app opens is
 * simply there, because nothing just happened.
 *
 * The bar itself (`LuvaniTabBar.tsx`) still moves nothing: it draws the cell
 * and hands the icon here (F600). Transform and opacity only, through
 * motion/drive.ts. Under Reduce Motion, watched live, the Bulk drawing is
 * simply there and nothing scales. The app leaving the foreground, or the bar
 * unmounting, lands everything on its final frame. The dot is sun, so it reads
 * on the ink capsule (UI-008, 2026-10-20). Decorative: the cell around
 * it is the tab a screen reader hears, selected or not.
 */

import { useCallback, useEffect, useRef, type ReactElement } from 'react';
import { StyleSheet, View } from 'react-native';
import Reanimated, { useAnimatedStyle, useSharedValue } from 'react-native-reanimated';
import { TAB_POP } from '../icons/iconMotion.ts';
import { useReduceMotion } from '../motion.ts';
import { cancel, sequence, spring, timing } from '../motion/drive.ts';
import { useLandOnLeave } from '../motion/landing.ts';
import { DUR, EASE, SELECT_POP_MS, SPRING } from '../motion/tokens.ts';
import { decorative, HIT } from '../theme.ts';
import { useB } from '../main/bTheme.tsx';

export function TabGlyph({
  focused,
  badged,
  children,
}: {
  /** This tab is the selected one. */
  focused: boolean;
  /** The Practice dot: true when practice is due, false when not, null before the deck has been read. */
  badged: boolean | null;
  /** Draws the tab's icon; `bulk` is true for the selected drawing. */
  children: (bulk: boolean) => ReactElement;
}) {
  const reduced = useReduceMotion();
  const t = useB();
  /** 0 at rest, 1 at the top of the pop. */
  const pop = useSharedValue(0);
  /** How much of the Bulk drawing shows over the Linear one. */
  const fill = useSharedValue(focused ? 1 : 0);
  /** The dot's scale. */
  const dot = useSharedValue(1);
  const wasFocused = useRef(focused);
  const wasBadged = useRef(badged);

  const land = useCallback(() => {
    cancel(pop);
    cancel(fill);
    cancel(dot);
    pop.value = 0;
    fill.value = wasFocused.current ? 1 : 0;
    dot.value = 1;
  }, [pop, fill, dot]);

  useLandOnLeave(land);

  useEffect(() => {
    if (reduced) land();
  }, [reduced, land]);

  useEffect(() => {
    const before = wasFocused.current;
    wasFocused.current = focused;
    if (!focused) {
      cancel(pop);
      cancel(fill);
      pop.value = 0;
      fill.value = 0;
      return;
    }
    // Already selected: the bar mounting, or a tap on the open tab.
    if (before) return;
    if (reduced) {
      pop.value = 0;
      fill.value = 1;
      return;
    }
    fill.value = 0;
    fill.value = timing(1, DUR.micro, EASE.out, reduced);
    pop.value = sequence(reduced, timing(1, SELECT_POP_MS, EASE.out, reduced), spring(0, SPRING.pop, reduced));
  }, [focused, reduced, pop, fill]);

  useEffect(() => {
    const before = wasBadged.current;
    wasBadged.current = badged;
    // Only nothing due becoming something due; the first read of the deck is not news.
    if (badged !== true || before !== false) return;
    if (reduced) {
      dot.value = 1;
      return;
    }
    dot.value = 0;
    dot.value = spring(1, SPRING.pop, reduced);
  }, [badged, reduced, dot]);

  const lift = useAnimatedStyle(() => ({
    transform: [{ translateY: -TAB_POP.lift * pop.value }, { scale: 1 + (TAB_POP.scale - 1) * pop.value }],
  }));
  const linear = useAnimatedStyle(() => ({ opacity: 1 - fill.value }));
  const bulk = useAnimatedStyle(() => ({ opacity: fill.value }));
  const mark = useAnimatedStyle(() => ({ transform: [{ scale: dot.value }] }));

  return (
    <View style={st.box}>
      <Reanimated.View style={[st.glyph, lift]}>
        <Reanimated.View style={[st.layer, linear]}>{children(false)}</Reanimated.View>
        {focused ? <Reanimated.View style={[st.layer, bulk]}>{children(true)}</Reanimated.View> : null}
      </Reanimated.View>
      {badged === true ? <Reanimated.View {...decorative} style={[st.badge, { backgroundColor: t.sun }, mark]} /> : null}
    </View>
  );
}

const st = StyleSheet.create({
  /** The glyph's slot in the cell: the touch floor wide, the 24 icon tall. */
  box: { width: HIT, height: 24, alignItems: 'center', justifyContent: 'center' },
  glyph: { width: 24, height: 24 },
  layer: { position: 'absolute', top: 0, right: 0, bottom: 0, left: 0, alignItems: 'center', justifyContent: 'center' },
  badge: {
    position: 'absolute',
    top: -1,
    right: -2,
    width: 6,
    height: 6,
    // Sun, so it reads on the ink capsule and on the violet selected cell (UI-008).
    borderRadius: 3,
  },
});
