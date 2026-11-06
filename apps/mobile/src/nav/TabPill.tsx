/**
 * The selected tab's violet pill (item 7, founder 2026-11-02): the one thing in
 * the bar that moves. It sits behind the selected cell's glyph, slides to a
 * tab when it is tapped, follows the finger while any tab is held and dragged
 * sideways (a drag from a closed tab first slides it to the finger, F961), and
 * under Reduce Motion, watched live, it simply jumps. Transform
 * only, through motion/drive.ts. Decorative: the cell over it is the tab a
 * screen reader hears.
 */

import { useEffect, useRef } from 'react';
import { StyleSheet } from 'react-native';
import Reanimated, { useAnimatedStyle, useSharedValue } from 'react-native-reanimated';
import { useReduceMotion } from '../motion.ts';
import { cancel, timing } from '../motion/drive.ts';
import { DUR, EASE } from '../motion/tokens.ts';
import { decorative } from '../theme.ts';
import { useB } from '../main/bTheme.tsx';

/** How far from the finger a held pill may be before it slides rather than tracks: one finger's slop. */
const CATCH_UP = 8;

export function TabPill({ to, width, left, following }: {
  /** Where the pill's left edge goes, from the first cell's left edge. */
  to: number;
  /** One cell's width. */
  width: number;
  /** The capsule's side padding, where the first cell starts. */
  left: number;
  /** A finger is dragging it: it slides to the finger first, then tracks with no easing. */
  following: boolean;
}) {
  const reduced = useReduceMotion();
  const t = useB();
  const x = useSharedValue(to);
  // Set once a held pill has reached the finger, so a quick drag tracks instead of trailing.
  const caught = useRef(false);

  useEffect(() => {
    if (!following) caught.current = false;
    else if (Math.abs(x.value - to) <= CATCH_UP) caught.current = true;
    if (reduced || caught.current) {
      cancel(x);
      x.value = to;
      return;
    }
    x.value = timing(to, DUR.fast, EASE.out, reduced);
  }, [to, following, reduced, x]);

  const slide = useAnimatedStyle(() => ({ transform: [{ translateX: x.value }] }));

  return <Reanimated.View {...decorative} pointerEvents="none" style={[st.pill, { left, width, backgroundColor: t.tabSelected }, slide]} />;
}

const st = StyleSheet.create({
  // The cell's own shape, inside the capsule's 6pt top and bottom padding.
  pill: { position: 'absolute', top: 6, bottom: 6, borderRadius: 20 },
});
