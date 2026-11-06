/**
 * The selected tab's violet pill (item 7, founder 2026-11-02): the one thing in
 * the bar that moves. It sits behind the selected cell's glyph, slides to a
 * tab when it is tapped, follows the finger while any tab is held and dragged
 * sideways (a drag from a closed tab first slides it to the finger, F962), and
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
  // While held, the pill is drawn at the finger plus a gap that closes on the
  // fast beat, so a drag from a closed tab slides over and never trails (F962).
  const gap = useSharedValue(0);
  const held = useRef(false);

  useEffect(() => {
    if (reduced) { cancel(x); cancel(gap); gap.value = 0; x.value = to; held.current = following; return; }
    if (following) {
      if (!held.current) {
        held.current = true;
        cancel(x);
        gap.value = x.value - to;
        gap.value = timing(0, DUR.fast, EASE.out, reduced);
      }
      x.value = to;
      return;
    }
    if (held.current) {
      // Let go: the slide home starts from where the pill is drawn.
      held.current = false;
      cancel(gap);
      x.value += gap.value;
      gap.value = 0;
    }
    x.value = timing(to, DUR.fast, EASE.out, reduced);
  }, [to, following, reduced, x, gap]);

  const slide = useAnimatedStyle(() => ({ transform: [{ translateX: x.value + gap.value }] }));

  return <Reanimated.View {...decorative} pointerEvents="none" style={[st.pill, { left, width, backgroundColor: t.tabSelected }, slide]} />;
}

const st = StyleSheet.create({
  // The cell's own shape, inside the capsule's 6pt top and bottom padding.
  pill: { position: 'absolute', top: 6, bottom: 6, borderRadius: 20 },
});
