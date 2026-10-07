/**
 * A chosen token flying to where it is kept (come alive section 3; renamed
 * from ChipFlight, because `<Chip` is refused in the onboarding screen, and
 * launched from `PlanCard` in a later step).
 *
 *   const flight = useTokenFlight();
 *   flight.launch({ from: chosenRef, to: slotRef, token: <DrinkToken />, onLand: () => setPlaced(true) });
 *
 * Both ends are measured in window coordinates. The token appears 40 points
 * above the middle of where it was chosen, at 0.76. It falls to the target in
 * 360 ms on the out curve while it travels sideways in `DUR.flight` on the
 * in-out curve, which together curve its path, and grows to 1.12 before the
 * pop spring lands it at 1. On landing `onLand` is said, so the target shows
 * the real token, with a light press under the finger. Everything goes through
 * motion/drive.ts.
 *
 * It never strands its caller (`flights.ts`): with reduced motion on, no
 * `FlightLayer` mounted, two tokens already in the air, or an end that fails
 * to measure, it lands at once with nothing drawn. The flying copy is
 * decorative and untouchable; the real token is the one a screen reader meets.
 */

import { useEffect, useMemo, useRef, type ReactNode, type RefObject } from 'react';
import { StyleSheet, type View } from 'react-native';
import Reanimated, { useAnimatedStyle, useSharedValue } from 'react-native-reanimated';
import { useReduceMotion } from '../motion.ts';
import { decorative } from '../theme.ts';
import { cancel, sequence, spring, timing } from './drive.ts';
import { flights, type Box, type Flight } from './flights.ts';
import { pressed } from './haptics.ts';
import { DUR, EASE, FLIGHT, SPRING } from './tokens.ts';

export type TokenLaunch = {
  /** Where the token was chosen. */
  from: RefObject<View | null>;
  /** Where it is kept. */
  to: RefObject<View | null>;
  /** What flies: the token as it will look at the target. */
  token: ReactNode;
  /** Said once when it arrives, or at once when it cannot fly. Show the real token here. */
  onLand: () => void;
};

/** A measurement that never answers counts as a failed one after this. */
const MEASURE_GIVE_UP_MS = DUR.micro;

/** Measure one end in window coordinates, or say null: no view, a view with no size, or no answer in time. */
function measure(ref: RefObject<View | null>, answer: (box: Box | null) => void): void {
  const view = ref.current;
  if (view === null) {
    answer(null);
    return;
  }
  let said = false;
  const say = (box: Box | null) => {
    if (said) return;
    said = true;
    clearTimeout(giveUp);
    answer(box);
  };
  const giveUp = setTimeout(() => say(null), MEASURE_GIVE_UP_MS);
  try {
    view.measureInWindow((x, y, width, height) => say({ x, y, width, height }));
  } catch {
    say(null);
  }
}

/** Launch tokens. Reads reduced motion live, so a launch under it lands at once. */
export function useTokenFlight(): { launch: (flight: TokenLaunch) => void } {
  const reduced = useReduceMotion();
  const still = useRef(reduced);
  useEffect(() => {
    still.current = reduced;
  });
  return useMemo(
    () => ({
      launch({ from, to, token, onLand }: TokenLaunch) {
        if (still.current || !flights.canFly()) {
          onLand();
          return;
        }
        measure(from, (start) => {
          if (start === null) {
            onLand();
            return;
          }
          measure(to, (end) => flights.launch(start, end, token, onLand));
        });
      },
    }),
    [],
  );
}

/** One token in the air, drawn by the FlightLayer. */
export function FlightToken({ flight, reduced }: { flight: Flight; reduced: boolean }) {
  const { from, to } = flight;
  const x = useSharedValue(from.x + from.width / 2);
  const y = useSharedValue(from.y + from.height / 2 - FLIGHT.above);
  const size = useSharedValue<number>(FLIGHT.from);

  useEffect(() => {
    if (reduced) {
      flights.land(flight.id);
      return undefined;
    }
    x.value = timing(to.x + to.width / 2, DUR.flight, EASE.inOut, reduced, (finished) => {
      if (finished) pressed();
      flights.land(flight.id);
    });
    y.value = timing(to.y + to.height / 2, FLIGHT.rise, EASE.out, reduced);
    size.value = sequence(reduced, timing(FLIGHT.peak, FLIGHT.lift, EASE.out, reduced), spring(1, SPRING.pop, reduced));
    return () => {
      cancel(x);
      cancel(y);
      cancel(size);
    };
  }, [reduced, flight.id, to, x, y, size]);

  const half = { width: to.width / 2, height: to.height / 2 };
  const look = useAnimatedStyle(() => ({
    transform: [{ translateX: x.value - half.width }, { translateY: y.value - half.height }, { scale: size.value }],
  }));
  return (
    <Reanimated.View {...decorative} pointerEvents="none" style={[st.token, { width: to.width, height: to.height }, look]}>
      {flight.token}
    </Reanimated.View>
  );
}

const st = StyleSheet.create({
  token: { position: 'absolute', top: 0, left: 0, alignItems: 'center', justifyContent: 'center' },
});
