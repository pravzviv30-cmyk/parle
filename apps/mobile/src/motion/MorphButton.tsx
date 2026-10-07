/**
 * The primary pill that waits in place (come alive section 3).
 *
 * The same ink pill as `PillButton`, pressed through the one `Press`, with four
 * states the caller owns:
 *
 * - idle: the pill and its label.
 * - busy: the label fades (`MORPH.fade`), the pill closes to a 56 point circle
 *   (`MORPH.close`, in-out curve) and a quarter arc turns in it, one turn per
 *   `MORPH.turn`, for at most `MORPH.spinMax`, and only while the app is
 *   active. Width and height here are the only layout props in the app that
 *   animate (motion.test.ts, rule 6).
 * - done: the arc closes to a full circle and a check draws in it
 *   (`MORPH.draw`), a success haptic answers, and after `MORPH.hold` the caller
 *   is told (`onDone`) to move on. Only ever from a real resolved result, such
 *   as a confirmed entitlement; never on a timer.
 * - error: the circle opens back into the pill and the label returns. No
 *   shake, no sound, no haptic: the caller's words say what went wrong.
 *
 * A screen reader hears the state, not the shape: the label, then `busyLabel`
 * announced and reported busy, then `doneLabel` announced. Pressing does
 * nothing while busy or done.
 *
 * Reduced motion: the pill never changes shape; only its words swap (label,
 * busyLabel, doneLabel). Watched live. Everything runs through motion/drive.ts.
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import { AccessibilityInfo, AppState, StyleSheet, Text, View, type LayoutChangeEvent } from 'react-native';
import Reanimated, { useAnimatedProps, useAnimatedStyle, useSharedValue } from 'react-native-reanimated';
import Svg, { Circle, Path } from 'react-native-svg';
import { Press } from '../components.tsx';
import { useReduceMotion } from '../motion.ts';
import { accent, decorative, onColour, paper, radius, space, STROKE, type } from '../theme.ts';
import { monotonicNow } from './clock.ts';
import { cancel, delay, repeat, timing } from './drive.ts';
import { arrived } from './haptics.ts';
import { DUR, EASE, MORPH } from './tokens.ts';

export type MorphState = 'idle' | 'busy' | 'done' | 'error';

const DrawnCircle = Reanimated.createAnimatedComponent(Circle);
const DrawnPath = Reanimated.createAnimatedComponent(Path);

/** The mark inside the circle, on the 24 point icon grid. */
const MARK = 24;
const ARC_RADIUS = (MARK - STROKE * 2) / 2;
const ARC_LENGTH = 2 * Math.PI * ARC_RADIUS;
/** CheckGlyph's tick, and its length, rounded up so the dash always covers it. */
const CHECK = 'M5 12.5l4.5 4.5L19 7';
const CHECK_LENGTH = 21;

export function MorphButton({
  label,
  busyLabel,
  doneLabel,
  state,
  tone = 'ink',
  disabled = false,
  onPress,
  onDone,
  accessibilityLabel,
}: {
  label: string;
  /** Said, and shown under reduced motion, while it waits: "Checking your plan". */
  busyLabel: string;
  /** Said, and shown under reduced motion, when it is done: "You are subscribed". */
  doneLabel: string;
  state: MorphState;
  /** ink on paper, sun, mint or white; white on blue or coral. */
  tone?: 'ink' | 'white';
  disabled?: boolean;
  onPress: () => void;
  /** Said once the check has held, so the caller can move on. */
  onDone?: () => void;
  /** What a screen reader says for the idle pill, when the label alone is not enough. */
  accessibilityLabel?: string;
}) {
  const reduced = useReduceMotion();
  const [box, setBox] = useState<{ width: number; height: number } | null>(null);
  const wide = useSharedValue(0);
  const tall = useSharedValue(0);
  const round = useSharedValue<number>(radius.control);
  const words = useSharedValue(1);
  const wheel = useSharedValue(0);
  const turn = useSharedValue(0);
  const arc = useSharedValue<number>(MORPH.arc);
  const tick = useSharedValue(0);
  const latest = useRef({ state, onDone, box, busyLabel, doneLabel });
  useEffect(() => {
    latest.current = { state, onDone, box, busyLabel, doneLabel };
  });

  const stopAll = useCallback(() => {
    for (const value of [wide, tall, round, words, wheel, turn, arc, tick]) cancel(value);
  }, [wide, tall, round, words, wheel, turn, arc, tick]);

  // Every value at the final frame of a state, with nothing running. The size
  // is the measured box unless a new measure is handed in before it is stored.
  const still = useCallback(
    (now: MorphState, calm: boolean, size: { width: number; height: number } | null = latest.current.box) => {
      stopAll();
      const closed = !calm && (now === 'busy' || now === 'done');
      wide.value = closed ? MORPH.size : size?.width ?? 0;
      tall.value = closed ? MORPH.size : size?.height ?? 0;
      round.value = closed ? MORPH.size / 2 : radius.control;
      words.value = closed ? 0 : 1;
      wheel.value = closed ? 1 : 0;
      arc.value = now === 'done' ? 1 : MORPH.arc;
      tick.value = !calm && now === 'done' ? 1 : 0;
    },
    [stopAll, wide, tall, round, words, wheel, arc, tick],
  );

  // The spinner turns only while busy, the app is active and the wait is under
  // MORPH.spinMax. Past that it rests as a still arc.
  const busySince = useRef<number | null>(null);
  const spin = useCallback(
    (calm: boolean) => {
      const since = busySince.current;
      if (calm || since === null || monotonicNow() - since >= MORPH.spinMax || AppState.currentState !== 'active') return;
      turn.value = 0;
      turn.value = repeat(timing(360, MORPH.turn, EASE.linear, calm), -1, false, calm);
    },
    [turn],
  );

  useEffect(() => {
    if (state !== 'busy') {
      busySince.current = null;
      cancel(turn);
      return undefined;
    }
    busySince.current = monotonicNow();
    const rest = setTimeout(() => cancel(turn), MORPH.spinMax);
    return () => clearTimeout(rest);
  }, [state, turn]);

  useEffect(() => {
    const subscription = AppState.addEventListener('change', (now) => {
      if (now !== 'active') still(latest.current.state, reduced);
      else if (latest.current.state === 'busy') spin(reduced);
    });
    return () => subscription.remove();
  }, [reduced, still, spin]);

  useEffect(() => () => stopAll(), [stopAll]);

  // Each change of state is said aloud: the shape is not the news, the state is.
  const said = useRef<MorphState | null>(null);
  useEffect(() => {
    const from = said.current;
    said.current = state;
    if (from === null || from === state) return;
    if (state === 'busy') AccessibilityInfo.announceForAccessibility(latest.current.busyLabel);
    if (state === 'done') AccessibilityInfo.announceForAccessibility(latest.current.doneLabel);
  }, [state]);

  // When the check will have drawn, for the haptic that answers it.
  const checkAt = useRef(0);

  const shaped = useRef<{ state: MorphState; reduced: boolean } | null>(null);
  useEffect(() => {
    checkAt.current = 0;
    if (box === null) return undefined;
    const before = shaped.current;
    shaped.current = { state, reduced };
    // The first measure, a new size, or reduced motion changing: land on the frame.
    if (before === null || before.reduced !== reduced || before.state === state) {
      still(state, reduced);
      if (state === 'busy') spin(reduced);
      return undefined;
    }
    if (reduced) {
      still(state, reduced);
      return undefined;
    }
    const calm = reduced;
    if (state === 'busy') {
      words.value = timing(0, MORPH.fade, EASE.out, calm);
      wide.value = delay(MORPH.fade, timing(MORPH.size, MORPH.close, EASE.inOut, calm), calm);
      tall.value = delay(MORPH.fade, timing(MORPH.size, MORPH.close, EASE.inOut, calm), calm);
      round.value = delay(MORPH.fade, timing(MORPH.size / 2, MORPH.close, EASE.inOut, calm), calm);
      arc.value = MORPH.arc;
      tick.value = 0;
      wheel.value = delay(MORPH.fade + MORPH.close, timing(1, DUR.micro, EASE.out, calm), calm);
      spin(calm);
      return undefined;
    }
    if (state === 'done') {
      // From idle straight to done, the pill closes first; from busy it is already a circle.
      const closing = before.state === 'busy' ? 0 : MORPH.fade + MORPH.close;
      if (closing > 0) {
        words.value = timing(0, MORPH.fade, EASE.out, calm);
        wide.value = delay(MORPH.fade, timing(MORPH.size, MORPH.close, EASE.inOut, calm), calm);
        tall.value = delay(MORPH.fade, timing(MORPH.size, MORPH.close, EASE.inOut, calm), calm);
        round.value = delay(MORPH.fade, timing(MORPH.size / 2, MORPH.close, EASE.inOut, calm), calm);
        wheel.value = delay(closing, timing(1, DUR.micro, EASE.out, calm), calm);
      }
      cancel(turn);
      arc.value = delay(closing, timing(1, DUR.fast, EASE.out, calm), calm);
      tick.value = delay(closing + DUR.fast, timing(1, MORPH.draw, EASE.out, calm), calm);
      checkAt.current = closing + DUR.fast + MORPH.draw;
      return undefined;
    }
    // Idle again, or an error: open back into the pill and bring the label back.
    const size = latest.current.box ?? box;
    cancel(turn);
    tick.value = 0;
    arc.value = MORPH.arc;
    wheel.value = timing(0, DUR.micro, EASE.out, calm);
    wide.value = timing(size.width, MORPH.close, EASE.inOut, calm);
    tall.value = timing(size.height, MORPH.close, EASE.inOut, calm);
    round.value = timing(radius.control, MORPH.close, EASE.inOut, calm);
    words.value = delay(MORPH.close, timing(1, MORPH.fade, EASE.out, calm), calm);
    return undefined;
  }, [state, reduced, box, still, spin, wide, tall, round, words, wheel, turn, arc, tick]);

  // Done: the success haptic once the check has drawn, then the hold, then the caller.
  useEffect(() => {
    if (state !== 'done') return undefined;
    const drawn = checkAt.current;
    const answer = setTimeout(() => arrived(), drawn);
    const move = setTimeout(() => latest.current.onDone?.(), drawn + MORPH.hold);
    return () => {
      clearTimeout(answer);
      clearTimeout(move);
    };
  }, [state]);

  const shape = useAnimatedStyle(() => ({ width: wide.value, height: tall.value, borderRadius: round.value }));
  const lettering = useAnimatedStyle(() => ({ opacity: words.value }));
  const mark = useAnimatedStyle(() => ({ opacity: wheel.value }));
  const turning = useAnimatedStyle(() => ({ transform: [{ rotate: `${turn.value}deg` }] }));
  const arcDrawn = useAnimatedProps(() => ({ strokeDashoffset: ARC_LENGTH * (1 - arc.value) }));
  const tickDrawn = useAnimatedProps(() => ({ strokeDashoffset: CHECK_LENGTH * (1 - tick.value) }));

  const measure = (event: LayoutChangeEvent) => {
    const { width, height } = event.nativeEvent.layout;
    if (width <= 0 || height <= 0) return;
    if (box !== null && box.width === width && box.height === height) return;
    // The shape takes the measured box before the render that first draws it.
    // Left to the effect, which runs after that render is on screen, the pill
    // would be drawn for one frame at 0 by 0 and blink out.
    still(state, reduced, { width, height });
    setBox({ width, height });
  };

  const locked = disabled || state === 'busy' || state === 'done';
  const fill = disabled ? (tone === 'white' ? st.offOnColour : st.off) : tone === 'white' ? st.white : st.ink;
  const ink = disabled ? paper.inkSoft : tone === 'white' ? paper.ink : paper.onInk;
  const shown = reduced ? (state === 'busy' ? busyLabel : state === 'done' ? doneLabel : label) : label;
  const spoken = state === 'busy' ? busyLabel : state === 'done' ? doneLabel : accessibilityLabel ?? label;
  const longest = [label, busyLabel, doneLabel].reduce((a, b) => (b.length > a.length ? b : a));
  return (
    <Press
      haptic="light"
      disabled={locked}
      onPress={onPress}
      accessibilityLabel={spoken}
      accessibilityState={{ busy: state === 'busy', disabled: locked }}
    >
      <View onLayout={measure} style={st.sizer}>
        <Text {...decorative} style={[type.button, st.unseen]}>
          {longest}
        </Text>
      </View>
      <View pointerEvents="none" style={[StyleSheet.absoluteFill, st.centre]}>
        <Reanimated.View style={[st.surface, fill, box === null ? st.unmeasured : shape]}>
          <Reanimated.View style={[st.centre, box === null ? StyleSheet.absoluteFill : { width: box.width, height: box.height }, lettering]}>
            <Text style={[type.button, st.words, { color: ink }]}>{shown}</Text>
          </Reanimated.View>
          <Reanimated.View {...decorative} pointerEvents="none" style={[st.mark, mark]}>
            <Reanimated.View style={[st.markLayer, turning]}>
              <Svg width={MARK} height={MARK} {...decorative}>
                <DrawnCircle
                  cx={MARK / 2}
                  cy={MARK / 2}
                  r={ARC_RADIUS}
                  stroke={ink}
                  strokeWidth={STROKE}
                  strokeLinecap="round"
                  strokeDasharray={`${ARC_LENGTH} ${ARC_LENGTH}`}
                  fill="none"
                  animatedProps={arcDrawn}
                />
              </Svg>
            </Reanimated.View>
            <View style={st.markLayer}>
              <Svg width={MARK} height={MARK} viewBox={`0 0 ${MARK} ${MARK}`} {...decorative}>
                <DrawnPath
                  d={CHECK}
                  stroke={ink}
                  strokeWidth={STROKE}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeDasharray={`${CHECK_LENGTH} ${CHECK_LENGTH}`}
                  fill="none"
                  animatedProps={tickDrawn}
                />
              </Svg>
            </View>
          </Reanimated.View>
        </Reanimated.View>
      </View>
    </Press>
  );
}

const st = StyleSheet.create({
  // The pill's own measure (PillButton's): it holds the slot, so the circle never moves what is around it.
  sizer: {
    minHeight: MORPH.size,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: space(6),
    paddingVertical: space(3),
  },
  unseen: { opacity: 0 },
  centre: { alignItems: 'center', justifyContent: 'center' },
  surface: { overflow: 'hidden', alignItems: 'center', justifyContent: 'center' },
  // PillButton's fills: ink, white on blue or coral, and off as PillButton says
  // it (F758): the sand skeleton for ink, the blue ground's pale secondary for
  // white, both with soft ink words.
  ink: { backgroundColor: accent.primary },
  white: { backgroundColor: paper.card },
  off: { backgroundColor: paper.skeleton },
  offOnColour: { backgroundColor: onColour.blue },
  unmeasured: { alignSelf: 'stretch', flex: 1, borderRadius: radius.control },
  words: { textAlign: 'center', paddingHorizontal: space(6) },
  mark: { position: 'absolute', width: MARK, height: MARK },
  markLayer: { position: 'absolute', top: 0, left: 0, width: MARK, height: MARK },
});
