/**
 * The one hook every animated scene uses.
 *
 * The app had exactly one animated illustration and its motion was written
 * inline. Twelve of them written the same way is twelve chances to forget the
 * reduce-motion branch, twelve `setTimeout`s nobody clears, and eventually a
 * second motion vocabulary. So the vocabulary lives here, once:
 *
 *   - transform and opacity only, always `useNativeDriver: true`
 *   - one settling entrance per scene, plus as many loops as the scene declares
 *   - loops drift rather than pump together, via a per-loop delay
 *   - reduce-motion renders the FINAL FRAME, never nothing
 *   - so does a paused scene, so leaving a tab does not blank its drawing
 *   - nothing bounces, and nothing here can spring
 *
 * Two things it deliberately does not do. It never calls `useIsFocused`:
 * that throws outside a NavigationContainer, and the splash, the welcome
 * screen and all four onboarding pages mount above the navigator, so pausing
 * is a prop the screen passes down. And it does not watch `AppState`, because
 * both platforms already suspend native-driver animations on a backgrounded
 * app and the web pauses its frame callbacks on a hidden tab.
 */

import { useEffect, useMemo, useRef, useState } from 'react';
import { AccessibilityInfo, Animated, Easing } from 'react-native';
import { SETTLE_MS, SETTLE_PX, ARRIVE_MS, STAGGER_MS, restFor } from './timing.ts';
import { useReduceMotion } from '../motion.ts';

export interface LoopSpec {
  /** Half a cycle, in ms. The driver runs 0 to 1 to 0, forever. */
  period: number;
  /** Start late, so two pieces drift instead of moving as one. */
  delay?: number;
}

export interface SceneMotion {
  /** One driver per declared loop, in order. At rest each sits at 0.5. */
  loops: Animated.Value[];
  /** One driver per staggered arrival. At rest each sits at 1. */
  arrivals: Animated.Value[];
  /** The scene's settling entrance. Spread onto the outermost view. */
  settled: {
    opacity: Animated.Value;
    transform: { translateY: Animated.AnimatedInterpolation<number> }[];
  };
  /** True once the OS has answered and said yes. Never use this for layout. */
  reduced: boolean;
}

export interface SceneMotionSpec {
  loops?: readonly LoopSpec[];
  arrivals?: number;
  paused?: boolean;
}

/** The one shape an arriving piece uses: up, in, and very slightly out. */
export function arriveStyle(driver: Animated.Value) {
  return {
    opacity: driver,
    transform: [
      { translateY: driver.interpolate({ inputRange: [0, 1], outputRange: [10, 0] }) },
      { scale: driver.interpolate({ inputRange: [0, 1], outputRange: [0.88, 1] }) },
    ],
  };
}

export function useSceneMotion(spec: SceneMotionSpec): SceneMotion {
  const { loops: loopSpecs = [], arrivals: arrivalCount = 0, paused = false } = spec;

  // A scene never changes how many pieces it has, so these counts are constant
  // and building the drivers in a memo bends no hook rule.
  const loops = useMemo(
    () => Array.from({ length: loopSpecs.length }, () => new Animated.Value(0)),
    [loopSpecs.length],
  );
  const arrivals = useMemo(
    () => Array.from({ length: arrivalCount }, () => new Animated.Value(0)),
    [arrivalCount],
  );
  const settle = useRef(new Animated.Value(0)).current;

  // Watched rather than sampled once, and now watched in one place for the
  // whole app: a learner can turn reduce motion on while something is moving,
  // which is usually exactly when they do it.
  const reduced = useReduceMotion();

  // Scenes declare their loops inline, so `loopSpecs` is a fresh array on every
  // render. Putting it in the effect's dependencies would tear down and restart
  // every animation on every render, which is both visible and expensive. The
  // specs are held in a ref and the effect keys on their VALUES instead.
  const periods = loopSpecs.map((l) => `${l.period}:${l.delay ?? 0}`).join(',');
  const specsRef = useRef(loopSpecs);
  specsRef.current = loopSpecs;

  useEffect(() => {
    const running: Animated.CompositeAnimation[] = [];
    const timers: ReturnType<typeof setTimeout>[] = [];
    let cancelled = false;

    if (reduced || paused) {
      // The final frame, immediately. The scene is the content and the
      // movement is only the flourish, so nobody should have to sit through it
      // and nobody should be shown an empty box instead.
      for (const d of loops) d.setValue(restFor('loop'));
      for (const a of arrivals) a.setValue(restFor('arrival'));
      settle.setValue(1);
      return () => {
        cancelled = true;
      };
    }

    settle.setValue(0);
    const entrance = Animated.timing(settle, {
      toValue: 1,
      duration: SETTLE_MS,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    });
    running.push(entrance);
    entrance.start();

    if (arrivals.length > 0) {
      for (const a of arrivals) a.setValue(0);
      const stagger = Animated.stagger(
        STAGGER_MS,
        arrivals.map((a) =>
          Animated.timing(a, {
            toValue: 1,
            duration: ARRIVE_MS,
            easing: Easing.out(Easing.cubic),
            useNativeDriver: true,
          }),
        ),
      );
      running.push(stagger);
      stagger.start();
    }

    specsRef.current.forEach((sp, i) => {
      const driver = loops[i];
      if (!driver) return;
      const cycle = Animated.loop(
        Animated.sequence([
          Animated.timing(driver, {
            toValue: 1,
            duration: sp.period,
            easing: Easing.inOut(Easing.quad),
            useNativeDriver: true,
          }),
          Animated.timing(driver, {
            toValue: 0,
            duration: sp.period,
            easing: Easing.inOut(Easing.quad),
            useNativeDriver: true,
          }),
        ]),
      );
      const delay = sp.delay ?? 0;
      if (delay <= 0) {
        running.push(cycle);
        cycle.start();
        return;
      }
      // The guard AND the clear both matter: a scene unmounted inside the
      // delay window would otherwise start a loop that nothing owns.
      timers.push(
        setTimeout(() => {
          if (cancelled) return;
          running.push(cycle);
          cycle.start();
        }, delay),
      );
    });

    return () => {
      cancelled = true;
      for (const t of timers) clearTimeout(t);
      for (const anim of running) anim.stop();
    };
    // `periods` carries every value the effect reads out of specsRef, so the
    // ref is never stale by the time it is used.
  }, [reduced, paused, periods, loops, arrivals, settle]);

  const settled = useMemo(
    () => ({
      opacity: settle,
      transform: [
        {
          translateY: settle.interpolate({ inputRange: [0, 1], outputRange: [SETTLE_PX, 0] }),
        },
      ],
    }),
    [settle],
  );

  return { loops, arrivals, settled, reduced };
}
