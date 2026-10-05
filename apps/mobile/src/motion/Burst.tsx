/**
 * Confetti, once (come alive section 3).
 *
 * Every piece is worked out before anything moves (`particles.ts`, seeded from
 * the event's key, so one event always throws the same burst), then one shared
 * clock runs from 0 to 1 over `DUR.burst` through motion/drive.ts and each
 * piece places itself on the UI thread with `particleFrame`. Transform and
 * opacity only. When the clock ends the burst unmounts itself.
 *
 * At most 36 pieces on a phone, 56 on an iPad and 24 on the web. Drawn in the
 * four colours and the card's white, never the highlighter or lilac, less the
 * colour of the ground it falls on. Decorative and untouchable: hidden from
 * assistive technology, and every touch passes through it.
 *
 * Reduced motion: nothing at all. Confetti is a flourish, never the content, so
 * its final frame is no confetti. Watched live: turning reduced motion on, or
 * the app leaving the foreground, clears it at once.
 */

import { useEffect, useMemo, useRef, useState } from 'react';
import { Platform, StyleSheet, View, useWindowDimensions } from 'react-native';
import Reanimated, { useAnimatedStyle, useSharedValue, type SharedValue } from 'react-native-reanimated';
import { useReduceMotion } from '../motion.ts';
import { decorative } from '../theme.ts';
import { cancel, timing } from './drive.ts';
import { useAnswered, useLandOnLeave } from './landing.ts';
import { CONFETTI_SHAPES, burstLimit, particleFrame, particles, type ConfettiColour, type Particle } from './particles.ts';
import { DUR, EASE } from './tokens.ts';

export function Burst({
  seed,
  origin,
  count,
  palette,
  ground,
  spread,
  power,
  onDone,
}: {
  /** The event's key. The same key always throws the same burst. */
  seed: string;
  /** Where the pieces leave from, in the coordinates of the burst's parent. */
  origin: { x: number; y: number };
  /** How many pieces. Defaults to, and is held to, what the device allows. */
  count?: number;
  /** The colours, by name. Defaults to blue, sun, mint and the card's white. */
  palette?: readonly ConfettiColour[];
  /** The ground it falls on, whose own colour is left out. */
  ground?: ConfettiColour;
  /** The width of the fan, in degrees. */
  spread?: number;
  /** The slowest and fastest a piece leaves at, in points a second. */
  power?: readonly [number, number];
  /** Said when the burst has finished or been cleared. */
  onDone?: () => void;
}) {
  const reduced = useAnswered(useReduceMotion(true));
  const { width } = useWindowDimensions();
  const limit = burstLimit(Platform.OS, width);
  const colours = palette?.join(',');
  const fan = power?.join(',');
  const pieces = useMemo(
    () => particles({ seed, count: count ?? limit, limit, palette, ground, spread, power }),
    // The palette and power are read by value, so a caller's fresh array is not a new burst.
    [seed, count, limit, colours, ground, spread, fan],
  );
  const clock = useSharedValue(0);
  const [live, setLive] = useState(true);
  const started = useRef(false);
  const latest = useRef(onDone);
  useEffect(() => {
    latest.current = onDone;
  });

  useEffect(() => {
    if (!live) latest.current?.();
  }, [live]);

  useEffect(() => {
    if (reduced === null) return;
    if (reduced) {
      cancel(clock);
      setLive(false);
      return;
    }
    if (started.current) return;
    started.current = true;
    clock.value = timing(1, DUR.burst, EASE.linear, reduced, () => setLive(false));
  }, [reduced, clock]);

  useLandOnLeave(() => {
    cancel(clock);
    setLive(false);
  });

  if (!live || reduced !== false || pieces.length === 0) return null;
  return (
    <View {...decorative} pointerEvents="none" style={StyleSheet.absoluteFill}>
      {pieces.map((piece, i) => (
        <Piece key={i} piece={piece} origin={origin} clock={clock} />
      ))}
    </View>
  );
}

/** One piece: its shape and colour fixed, its place on the shared clock. */
function Piece({ piece, origin, clock }: { piece: Particle; origin: { x: number; y: number }; clock: SharedValue<number> }) {
  const shape = CONFETTI_SHAPES[piece.shape];
  const flight = useAnimatedStyle(() => {
    const at = particleFrame(piece, clock.value);
    return {
      opacity: at.opacity,
      transform: [{ translateX: at.x }, { translateY: at.y }, { rotate: `${at.rotate}deg` }],
    };
  });
  const paint = piece.shape === 'ring' ? { borderWidth: shape.border, borderColor: piece.colour } : { backgroundColor: piece.colour };
  return (
    <Reanimated.View
      pointerEvents="none"
      style={[
        st.piece,
        { left: origin.x - shape.width / 2, top: origin.y - shape.height / 2, width: shape.width, height: shape.height, borderRadius: shape.radius },
        paint,
        flight,
      ]}
    />
  );
}

const st = StyleSheet.create({
  piece: { position: 'absolute' },
});
