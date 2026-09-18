/**
 * The tutor's voice circle.
 *
 * The approved direction is UI 4, softened rather than reinvented: a misty
 * state-coloured watercolour field, three quiet rings, and a white waveform
 * drawn directly on the colour. There is deliberately no microphone icon and
 * no frosted capsule inside the orb. On the Tutor landing page the short state
 * label sits directly under the bars; in a live room the existing caption can
 * remain under the orb.
 *
 * The SVG in `OrbGlyph` is still. This wrapper animates only opacity and
 * transform with core Animated and the native driver. The waveform is a small
 * set of ordinary views, so no SVG attribute is driven from JavaScript and no
 * new animation dependency is needed.
 */

import { useEffect, useRef } from 'react';
import { Animated, Easing, StyleSheet, Text, View } from 'react-native';
import { decorative, orb, paper, space, type } from '../theme.ts';
import { useReduceMotion } from '../motion.ts';
import { orbRests } from './orbRest.ts';
import { OrbGlyph } from './OrbGlyph.tsx';

export type OrbState = 'ready' | 'idle' | 'connecting' | 'speaking' | 'listening' | 'thinking' | 'error';

/** The whole ring field when a caller does not choose a size. */
const ORB_DEFAULT = 132;

/** Seven bars, echoing the simple voice mark in UI 4 rather than a mic icon. */
const BAR_HEIGHTS = [0.1, 0.17, 0.27, 0.38, 0.27, 0.17, 0.1] as const;

interface Look {
  /** One state colour drives every wash in the glyph. */
  colour: string;
  /** Whether the direct white bars wait or respond. */
  bars: 'still' | 'moving';
  /** Scale travel from the resting frame. */
  amplitude: number;
  /** One breath, in milliseconds. */
  period: number;
  /** Thinking dims instead of travelling. */
  shimmer: boolean;
  /** The compact state word, embedded or placed underneath by the caller. */
  caption: string;
}

const LOOKS: Record<OrbState, Look> = {
  ready: {
    colour: orb.ready,
    bars: 'still',
    amplitude: 0.025,
    period: 3000,
    shimmer: false,
    caption: 'Tap to talk',
  },
  idle: {
    colour: paper.inkSoft,
    bars: 'still',
    amplitude: 0,
    period: 0,
    shimmer: false,
    caption: 'Ready',
  },
  connecting: {
    colour: orb.ready,
    bars: 'moving',
    amplitude: 0.025,
    period: 1150,
    shimmer: false,
    caption: 'Connecting',
  },
  speaking: {
    colour: orb.speaking,
    bars: 'moving',
    amplitude: 0.045,
    period: 780,
    shimmer: false,
    caption: 'Listen',
  },
  listening: {
    colour: orb.yourTurn,
    bars: 'moving',
    amplitude: 0.035,
    period: 1120,
    shimmer: false,
    caption: 'Speak',
  },
  thinking: {
    colour: orb.thinking,
    bars: 'still',
    amplitude: 0,
    period: 900,
    shimmer: true,
    caption: 'Thinking',
  },
  error: {
    colour: paper.inkSoft,
    bars: 'still',
    amplitude: 0,
    period: 0,
    shimmer: false,
    caption: 'Unavailable',
  },
};

export function VoiceOrb({
  state,
  size = ORB_DEFAULT,
  withCaption = true,
  announce = true,
  paused = false,
  embeddedLabel,
}: {
  state: OrbState;
  size?: number;
  /** TutorIntro writes its own words beside its mini orbs. */
  withCaption?: boolean;
  /** False when the surrounding Pressable owns the accessible name. */
  announce?: boolean;
  /** A tab that is no longer focused parks every driver at its final frame. */
  paused?: boolean;
  /** A short status drawn directly inside the colour field, below the bars. */
  embeddedLabel?: string;
}) {
  const look = LOOKS[state];
  const drivers = [useRef(new Animated.Value(0)).current, useRef(new Animated.Value(0)).current];
  const dim = useRef(new Animated.Value(1)).current;
  const reduced = useReduceMotion();

  useEffect(() => {
    let cancelled = false;
    const running: Animated.CompositeAnimation[] = [];
    const timers: ReturnType<typeof setTimeout>[] = [];

    const run = () => {
      if (cancelled) return;
      if (orbRests({ amplitude: look.amplitude, shimmer: look.shimmer, reduced, paused })) {
        for (const driver of drivers) driver.setValue(0.5);
        dim.setValue(1);
        return;
      }

      if (look.shimmer) {
        drivers[1]!.setValue(0.5);
        const shimmer = Animated.loop(
          Animated.sequence([
            Animated.timing(dim, {
              toValue: 0.62,
              duration: look.period,
              easing: Easing.inOut(Easing.quad),
              useNativeDriver: true,
            }),
            Animated.timing(dim, {
              toValue: 1,
              duration: look.period,
              easing: Easing.inOut(Easing.quad),
              useNativeDriver: true,
            }),
          ]),
        );
        running.push(shimmer);
        shimmer.start();
        return;
      }

      dim.setValue(1);
      if (look.bars !== 'moving') drivers[1]!.setValue(0.5);
      const moving = look.bars === 'moving' ? drivers : drivers.slice(0, 1);
      moving.forEach((driver, index) => {
        const loop = Animated.loop(
          Animated.sequence([
            Animated.timing(driver, {
              toValue: 1,
              duration: look.period,
              easing: Easing.inOut(Easing.sin),
              useNativeDriver: true,
            }),
            Animated.timing(driver, {
              toValue: 0,
              duration: look.period,
              easing: Easing.inOut(Easing.sin),
              useNativeDriver: true,
            }),
          ]),
        );
        running.push(loop);
        timers.push(
          setTimeout(() => {
            if (cancelled) return;
            loop.start();
          }, index * 240),
        );
      });
    };

    run();
    return () => {
      cancelled = true;
      for (const t of timers) clearTimeout(t);
      for (const animation of running) animation.stop();
    };
    // Stable refs are deliberately omitted. State, reduced motion and focus are
    // the three facts that may replace a running loop.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state, reduced, paused]);

  const breath = drivers[0]!.interpolate({
    inputRange: [0, 1],
    outputRange: [1 - look.amplitude, 1 + look.amplitude],
  });

  const barWidth = Math.max(2, Math.round(size * 0.018));
  const barGap = Math.max(2, Math.round(size * 0.018));
  const barScales = BAR_HEIGHTS.map((_, index) =>
    drivers[1]!.interpolate({
      inputRange: [0, 1],
      outputRange: index % 2 === 0 ? [0.76, 1.08] : [1.08, 0.76],
    }),
  );

  return (
    <View
      style={[st.root, { width: size, height: size }]}
      {...(announce
        ? { accessibilityRole: 'image' as const, accessibilityLabel: `Tutor: ${look.caption}` }
        : decorative)}
    >
      <Animated.View pointerEvents="none" style={{ opacity: dim, transform: [{ scale: breath }] }}>
        <OrbGlyph color={look.colour} size={size} />
      </Animated.View>

      <Animated.View pointerEvents="none" style={[st.signal, { opacity: dim }]} {...decorative}>
        <View style={[st.bars, { gap: barGap, height: size * 0.4 }]}>
          {BAR_HEIGHTS.map((height, index) => (
            <Animated.View
              key={`${height}-${index}`}
              style={[
                st.bar,
                {
                  width: barWidth,
                  height: Math.max(5, size * height),
                  borderRadius: barWidth / 2,
                  transform: [{ scaleY: barScales[index]! }],
                },
              ]}
            />
          ))}
        </View>
        {embeddedLabel !== undefined ? <Text style={st.embeddedLabel}>{embeddedLabel}</Text> : null}
      </Animated.View>

      {withCaption ? <Text style={st.caption}>{look.caption}</Text> : null}
    </View>
  );
}

const st = StyleSheet.create({
  root: { alignItems: 'center', justifyContent: 'center' },
  signal: { position: 'absolute', inset: 0, alignItems: 'center', justifyContent: 'center', paddingTop: space(3) },
  bars: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center' },
  bar: { backgroundColor: paper.onInk },
  embeddedLabel: {
    ...type.bodyStrong,
    color: paper.onInk,
    marginTop: -space(2),
    textAlign: 'center',
  },
  caption: {
    ...type.label,
    position: 'absolute',
    bottom: -space(6),
    color: paper.ink,
    textAlign: 'center',
  },
});
