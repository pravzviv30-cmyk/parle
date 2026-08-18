/**
 * The orb — the tutor, as an object on the page.
 *
 * Three concentric rings that breathe. Not a glowing sphere: this world is one
 * pen on pale paper, and the nearest honest translation of a voice interface is
 * ink rings that move rather than a lit surface. It carries NO shadow — the
 * app's only shadow belongs to the live microphone, and an orb that borrowed it
 * would quietly make two things look equally urgent.
 *
 * Built on core `Animated` with no new dependency. Reanimated would force the
 * repo's first babel config for a screen whose JS thread is nearly idle, and
 * Skia is a WASM payload on a target that ships to the browser. Everything here
 * animates transform and opacity only, on the native driver, per the motion
 * vocabulary the splash established.
 *
 * Deliberately not driven by audio amplitude. An analyser feeding setState at
 * thirty to sixty times a second is exactly the churn that would then require
 * reanimated to stay smooth — the one place worth spending a dependency later,
 * and not before.
 */

import { useEffect, useRef } from 'react';
import { View, Text, Animated, Easing, StyleSheet, AccessibilityInfo } from 'react-native';
import { paper, signal, space, type, STROKE } from '../theme.ts';

export type OrbState = 'idle' | 'speaking' | 'listening' | 'thinking' | 'error';

/** Outermost first. The three sizes the rings hold when still. */
const RINGS = [132, 108, 84] as const;

interface Look {
  /** Ring colours, outermost first. */
  colors: readonly [string, string, string];
  centre: string;
  /** How far each ring travels from rest, as a scale delta. */
  amplitude: number;
  /** One breath, in milliseconds. */
  period: number;
  /** Dim the whole orb instead of moving it. */
  shimmer: boolean;
  /** What the state is called, under the orb. */
  caption: string;
}

const LOOKS: Record<OrbState, Look> = {
  idle: {
    colors: [paper.line, paper.line, paper.line],
    centre: paper.inkFaint,
    amplitude: 0.03,
    period: 3400,
    shimmer: false,
    caption: 'Ready',
  },
  speaking: {
    colors: [paper.ink, paper.ink, paper.line],
    centre: paper.ink,
    amplitude: 0.08,
    period: 900,
    shimmer: false,
    caption: 'Listen',
  },
  listening: {
    colors: [paper.line, paper.line, signal.live],
    centre: signal.live,
    amplitude: 0.05,
    period: 1600,
    shimmer: false,
    caption: 'Speak',
  },
  thinking: {
    colors: [paper.inkFaint, paper.inkFaint, paper.inkFaint],
    centre: paper.inkFaint,
    amplitude: 0,
    period: 1400,
    shimmer: true,
    caption: 'One moment',
  },
  error: {
    colors: [paper.line, 'transparent', 'transparent'],
    centre: 'transparent',
    amplitude: 0,
    period: 0,
    shimmer: false,
    caption: '',
  },
};

export function VoiceOrb({ state, size = RINGS[0] }: { state: OrbState; size?: number }) {
  const look = LOOKS[state];
  // One driver per ring so the three can be offset and drift apart rather than
  // pumping in unison, which reads mechanical.
  const drivers = [useRef(new Animated.Value(0)).current, useRef(new Animated.Value(0)).current, useRef(new Animated.Value(0)).current];
  const dim = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    let cancelled = false;
    const running: Animated.CompositeAnimation[] = [];

    const stopAll = () => {
      for (const a of running) a.stop();
      running.length = 0;
    };

    void AccessibilityInfo.isReduceMotionEnabled().then((reduced) => {
      if (cancelled) return;
      if (reduced || (look.amplitude === 0 && !look.shimmer)) {
        // The final frame. The orb still says which state it is in through
        // colour and caption; only the movement is withheld.
        for (const d of drivers) d.setValue(0.5);
        dim.setValue(1);
        return;
      }

      if (look.shimmer) {
        const shimmer = Animated.loop(
          Animated.sequence([
            Animated.timing(dim, { toValue: 0.45, duration: look.period, easing: Easing.inOut(Easing.quad), useNativeDriver: true }),
            Animated.timing(dim, { toValue: 1, duration: look.period, easing: Easing.inOut(Easing.quad), useNativeDriver: true }),
          ]),
        );
        running.push(shimmer);
        shimmer.start();
        return;
      }

      dim.setValue(1);
      drivers.forEach((d, i) => {
        const loop = Animated.loop(
          Animated.sequence([
            Animated.timing(d, { toValue: 1, duration: look.period, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
            Animated.timing(d, { toValue: 0, duration: look.period, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
          ]),
        );
        running.push(loop);
        // Each ring starts a beat later than the one outside it.
        setTimeout(() => {
          if (!cancelled) loop.start();
        }, i * 400);
      });
    });

    return () => {
      cancelled = true;
      stopAll();
    };
    // `drivers` and `dim` are refs and never change identity.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state]);

  const scale = size / RINGS[0];

  return (
    <View style={[st.root, { width: size, height: size }]} accessibilityRole="image" accessibilityLabel={`Tutor: ${look.caption || 'stopped'}`}>
      {RINGS.map((ring, i) => (
        <Animated.View
          key={ring}
          pointerEvents="none"
          style={[
            st.ring,
            {
              width: ring * scale,
              height: ring * scale,
              borderRadius: (ring * scale) / 2,
              borderColor: look.colors[i],
              opacity: dim,
              transform: [
                {
                  scale: drivers[i]!.interpolate({
                    inputRange: [0, 1],
                    outputRange: [1 - look.amplitude, 1 + look.amplitude],
                  }),
                },
              ],
            },
          ]}
        />
      ))}
      <View style={[st.centre, { backgroundColor: look.centre }]} />
      {look.caption ? (
        <Text style={[type.label, st.caption, { color: state === 'listening' ? signal.live : paper.inkFaint }]}>
          {look.caption}
        </Text>
      ) : null}
    </View>
  );
}

const st = StyleSheet.create({
  root: { alignItems: 'center', justifyContent: 'center' },
  ring: {
    position: 'absolute',
    borderWidth: STROKE,
    backgroundColor: 'transparent',
  },
  centre: { width: 7, height: 7, borderRadius: 3.5 },
  caption: { position: 'absolute', bottom: -space(6) },
});
