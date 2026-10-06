/**
 * The streak flame (come alive D2 and D10): the one flame drawing, from the
 * Home card's small flame to the streak takeover's hero.
 *
 *   state    `lit` when today really counts; `unlit` is the same flame in the
 *            paper greys, waiting for the day's first practice. Nothing sad.
 *   ignite   the key of a real, persisted event (a celebration key such as
 *            `streak:${day}`). Each new key lights the flame once, the first
 *            one included when it is there at mount: the grey flame fades as
 *            the lit one grows from an ember on the pop spring, its inner
 *            flame and core a beat behind. No key, no lighting: a flame that
 *            mounts lit without one is simply lit.
 *   flicker  true while the flame is in view and today counts. It flickers
 *            `FLAME_MOTION.flickers` times each time this turns true (or the
 *            app comes back to the foreground with it true), then rests. It
 *            stops at once when this turns false, the app leaves the
 *            foreground, or the flame unmounts.
 *   ground   what it sits on, so it never vanishes into it: on coral it is
 *            drawn white and sun.
 *
 * Only transform and opacity move, each on a whole layer drawn as its own
 * still Svg; no SVG attribute is animated. Every timing goes through
 * motion/drive.ts with the live reduced-motion answer from motion.ts, and the
 * numbers come from motion/tokens.ts and artMotion.ts. Under Reduce Motion it
 * is the final frame, watched live: lit and still. Leaving the foreground or
 * unmounting lands a lighting flame on its final frame.
 *
 * Decorative: hidden from assistive technology and untouchable. The words
 * beside it say the streak. It plays no sound and no haptic; the celebration
 * that owns the moment does that, once. Never drawn inside a live room or on
 * the safety stop.
 */

import { useCallback, useEffect, useRef, useState, type ReactElement } from 'react';
import { StyleSheet, View } from 'react-native';
import Reanimated, { useAnimatedStyle, useSharedValue } from 'react-native-reanimated';
import Svg from 'react-native-svg';

import { useReduceMotion } from '../../motion.ts';
import { cancel, delay, repeat, sequence, spring, timing } from '../../motion/drive.ts';
import { useAnswered, useLandOnLeave } from '../../motion/landing.ts';
import { DUR, EASE, SPRING } from '../../motion/tokens.ts';
import { decorative } from '../../theme.ts';
import { FLAME_MOTION as M } from './artMotion.ts';
import { useForeground } from './foreground.ts';
import { artPaths } from './paths.tsx';
import { ART_VIEWBOX, FLAME_FEET, drawn, layer, originOf, type ArtGround, type DrawnPart, type FlameState } from './shapes.ts';

export type FlameProps = {
  /** Points, square. */
  size: number;
  /** `lit` when today counts; `unlit` before the day's first practice. */
  state?: FlameState;
  /** A real event's key. Each new key lights the flame once, the first one included. */
  ignite?: string | number;
  /** True while the flame is in view and today counts: a few flickers, then rest. */
  flicker?: boolean;
  /** The ground it sits on. */
  ground?: ArtGround;
};

const FEET = {
  outer: originOf(FLAME_FEET.outer),
  inner: originOf(FLAME_FEET.inner),
  core: originOf(FLAME_FEET.core),
};

export function Flame({ size, state = 'lit', ignite, flicker = false, ground = 'paper' }: FlameProps): ReactElement {
  const answered = useAnswered(useReduceMotion(true));
  const awake = useForeground();
  const lit = state === 'lit';
  // A key there at mount starts from the grey flame, so the lit one never shows before it lights.
  const lightingAtMount = lit && ignite !== undefined;
  const [ember, setEmber] = useState(lightingAtMount);
  const shown = useSharedValue(lightingAtMount ? 0 : 1);
  const grow = useSharedValue(1);
  const tilt = useSharedValue(0);
  const inner = useSharedValue(1);
  const core = useSharedValue(1);
  const fade = useSharedValue(1);
  const stretch = useSharedValue(1);
  const rise = useSharedValue(0);
  const played = useRef<string | number | undefined>(undefined);

  /** The final frame of lighting: lit, upright, whole, with the grey flame gone. */
  const land = useCallback(() => {
    cancel(shown);
    cancel(grow);
    cancel(tilt);
    cancel(inner);
    cancel(core);
    cancel(fade);
    shown.value = 1;
    grow.value = 1;
    tilt.value = 0;
    inner.value = 1;
    core.value = 1;
    fade.value = 0;
    setEmber(false);
  }, [shown, grow, tilt, inner, core, fade]);
  useLandOnLeave(land);

  useEffect(() => {
    if (answered === null || !lit) return;
    const fresh = ignite !== undefined && ignite !== played.current;
    // Spent the first time it is seen, moving or not: turning Reduce Motion
    // off later never replays a moment that has passed.
    if (ignite !== undefined) played.current = ignite;
    // Reduce Motion is watched live: turned on in the middle of a lighting,
    // the flame lands on its final frame at once.
    if (answered) {
      land();
      return;
    }
    if (!fresh) return;
    const reduced = answered;
    setEmber(true);
    fade.value = 1;
    shown.value = 0;
    grow.value = M.ember;
    tilt.value = M.tilt;
    inner.value = M.innerFrom;
    core.value = 0;
    shown.value = timing(1, DUR.fast, EASE.out, reduced);
    fade.value = timing(0, M.fade, EASE.in, reduced, (done) => {
      if (done) setEmber(false);
    });
    grow.value = spring(1, SPRING.pop, reduced);
    tilt.value = timing(0, DUR.slow, EASE.out, reduced);
    inner.value = delay(M.innerLag, spring(1, SPRING.pop, reduced), reduced);
    core.value = delay(M.coreLag, spring(1, SPRING.pop, reduced), reduced);
  }, [answered, lit, ignite, land, shown, grow, tilt, inner, core, fade]);

  useEffect(() => {
    const rest = () => {
      cancel(stretch);
      cancel(rise);
      stretch.value = 1;
      rise.value = 0;
    };
    if (!lit || !flicker || !awake || answered !== false) {
      rest();
      return;
    }
    const reduced = answered;
    const half = M.flickerMs / 2;
    const up = -M.rise * size;
    /** One flicker: out to `to` and home again. */
    const once = (to: number, home: number) =>
      sequence(reduced, timing(to, half, EASE.inOut, reduced), timing(home, half, EASE.inOut, reduced));
    stretch.value = delay(M.wait, repeat(once(M.stretch, 1), M.flickers, false, reduced), reduced);
    rise.value = delay(M.wait + M.riseLag, repeat(once(up, 0), M.flickers, false, reduced), reduced);
    return rest;
  }, [lit, flicker, awake, answered, size, stretch, rise]);

  const whole = useAnimatedStyle(() => ({
    opacity: shown.value,
    transform: [{ rotate: `${tilt.value}deg` }, { scale: grow.value }, { scaleY: stretch.value }],
  }));
  const innerLook = useAnimatedStyle(() => ({ transform: [{ translateY: rise.value }, { scale: inner.value }] }));
  const coreLook = useAnimatedStyle(() => ({ transform: [{ scale: core.value }] }));
  const emberLook = useAnimatedStyle(() => ({ opacity: fade.value }));

  const box = { width: size, height: size };
  if (!lit) {
    return (
      <View {...decorative} style={[box, st.still]}>
        <Layer parts={drawn('flame', 'unlit', ground)} size={size} />
      </View>
    );
  }
  const parts = drawn('flame', 'lit', ground);
  return (
    <View {...decorative} style={[box, st.still]}>
      {ember ? (
        <Reanimated.View style={[st.layer, emberLook]}>
          <Layer parts={drawn('flame', 'unlit', ground)} size={size} />
        </Reanimated.View>
      ) : null}
      <Reanimated.View style={[st.layer, { transformOrigin: FEET.outer }, whole]}>
        <View style={st.layer}>
          <Layer parts={layer(parts, 'outer')} size={size} />
        </View>
        <Reanimated.View style={[st.layer, { transformOrigin: FEET.inner }, innerLook]}>
          <Layer parts={layer(parts, 'inner')} size={size} />
        </Reanimated.View>
        <Reanimated.View style={[st.layer, { transformOrigin: FEET.core }, coreLook]}>
          <Layer parts={layer(parts, 'core')} size={size} />
        </Reanimated.View>
      </Reanimated.View>
    </View>
  );
}

/** One still layer of the flame: the one decorative Svg this file draws. */
function Layer({ parts, size }: { parts: readonly DrawnPart[]; size: number }): ReactElement {
  return (
    <Svg width={size} height={size} viewBox={ART_VIEWBOX} {...decorative}>
      {artPaths(parts)}
    </Svg>
  );
}

const st = StyleSheet.create({
  still: { pointerEvents: 'none' },
  layer: { position: 'absolute', top: 0, right: 0, bottom: 0, left: 0 },
});
