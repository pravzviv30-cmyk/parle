/**
 * The speaking orb's seven bars, following the tutor's real voice (come alive,
 * core loop 3.3).
 *
 * The same seven bars as today's waveform, at the same heights, widths and gap,
 * in the glyph colour the state pairs with its fill. Instead of a sine loop,
 * bar i stands at `0.45 + 0.85 * band i` of its height, where the bands are the
 * tutor's voice from 150 Hz to 4 kHz as `live/RoomLevels` measures them, already
 * smoothed by the envelope in `live/levels.ts` (it rises with a syllable and
 * falls back gently). Each bar reads its band on the UI thread, so nothing here
 * renders per frame. Transform only.
 *
 * Drawn only while `orbLayers` says the tutor's voice is measured, the room is
 * awake and movement is not reduced (`tutor/orbLayers.ts`); otherwise the orb
 * keeps today's loop. Under Reduce Motion the bars stand still at full height,
 * watched live. Decorative: the orb's label says the tutor is speaking.
 */

import { StyleSheet, View } from 'react-native';
import Reanimated, { useAnimatedStyle, type SharedValue } from 'react-native-reanimated';

import { useReduceMotion } from '../motion.ts';
import { decorative } from '../theme.ts';
import { LIVE_BARS } from './orbLayers.ts';

export function LiveBars({
  bands,
  heights,
  size,
  width,
  gap,
  color,
}: {
  /** The tutor's voice in seven bands, 0 to 1 each, low to high. */
  bands: SharedValue<number[]>;
  /** Each bar's height as a share of the orb, the middle one the tallest. */
  heights: readonly number[];
  /** The orb's size. */
  size: number;
  /** One bar's width and the gap between bars, as the orb draws them. */
  width: number;
  gap: number;
  /** The glyph colour the state pairs with its fill. */
  color: string;
}) {
  const reduced = useReduceMotion();
  return (
    <View {...decorative} style={[st.bars, { gap, height: size * 0.4 }]}>
      {heights.map((height, index) => (
        <LiveBar key={`${height}-${index}`} index={index} bands={bands} reduced={reduced}
          style={{ backgroundColor: color, width, height: Math.max(5, size * height), borderRadius: width / 2 }} />
      ))}
    </View>
  );
}

function LiveBar({
  index,
  bands,
  reduced,
  style,
}: {
  index: number;
  bands: SharedValue<number[]>;
  reduced: boolean;
  style: { backgroundColor: string; width: number; height: number; borderRadius: number };
}) {
  const look = useAnimatedStyle(() => {
    if (reduced) return { transform: [{ scaleY: 1 }] };
    const band = bands.value[index] ?? 0;
    const level = Math.min(1, Math.max(0, band));
    return { transform: [{ scaleY: LIVE_BARS.base + LIVE_BARS.gain * level }] };
  }, [reduced, index]);
  return <Reanimated.View style={[style, look]} />;
}

const st = StyleSheet.create({
  bars: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', pointerEvents: 'none' },
});
