/**
 * The tutor's voice circle (SNIPPETS orb).
 *
 * Two rings and a core in the state colour, and one mark per state inside the
 * core, in the glyph colour `onOrb` pairs with that fill: the seven bars while
 * the tutor speaks, which are the waveform; a microphone whenever it is your
 * turn to talk or the room is getting ready; three dots while the tutor
 * thinks. White on coral and ink, ink on mint and sun. On the Tutor landing page
 * the short state label sits directly under the mark; in a live room the
 * existing caption can remain under the orb.
 *
 * The SVG in `OrbGlyph` is still. This wrapper animates only opacity and
 * transform with core Animated and the native driver. The waveform is a small
 * set of ordinary views, so no SVG attribute is driven from JavaScript and no
 * new animation dependency is needed.
 */

import { useEffect, useRef } from 'react';
import { Animated, Easing, StyleSheet, Text, View } from 'react-native';
import { decorative, onOrb, orb, paper, space, type } from '../theme.ts';
import { NATIVE_DRIVER, useReduceMotion } from '../motion.ts';
import { MicGlyph } from '../components.tsx';
import { orbRests } from './orbRest.ts';
import { OrbGlyph } from './OrbGlyph.tsx';

export type OrbState = 'ready' | 'idle' | 'connecting' | 'speaking' | 'listening' | 'thinking' | 'error';

/** The whole ring field when a caller does not choose a size. */
const ORB_DEFAULT = 132;

/** Seven bars: the speaking orb's waveform, the middle one the tallest. */
const BAR_HEIGHTS = [0.1, 0.17, 0.27, 0.38, 0.27, 0.17, 0.1] as const;

interface Look {
  /** One state colour draws both rings and the core. */
  colour: string;
  /** What sits on that colour: the mark and the embedded status. */
  glyph: string;
  /** The one mark in the core: bars while speaking, a microphone when it is your turn, dots while thinking. */
  mark: 'bars' | 'mic' | 'dots';
  /** Whether the bars wait or respond. Only the speaking orb's waveform moves. */
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
    glyph: onOrb.ready,
    mark: 'mic',
    bars: 'still',
    amplitude: 0.025,
    period: 3000,
    shimmer: false,
    caption: 'Tap to talk',
  },
  idle: {
    colour: paper.inkSoft,
    glyph: paper.onInk,
    mark: 'mic',
    bars: 'still',
    amplitude: 0,
    period: 0,
    shimmer: false,
    caption: 'Ready',
  },
  connecting: {
    colour: orb.ready,
    glyph: onOrb.ready,
    mark: 'mic',
    bars: 'still',
    amplitude: 0.025,
    period: 1150,
    shimmer: false,
    caption: 'Connecting',
  },
  speaking: {
    colour: orb.speaking,
    glyph: onOrb.speaking,
    mark: 'bars',
    bars: 'moving',
    amplitude: 0.045,
    period: 780,
    shimmer: false,
    caption: 'Listen',
  },
  listening: {
    colour: orb.yourTurn,
    glyph: onOrb.yourTurn,
    mark: 'mic',
    bars: 'still',
    amplitude: 0.035,
    period: 1120,
    shimmer: false,
    caption: 'Speak',
  },
  thinking: {
    colour: orb.thinking,
    glyph: onOrb.thinking,
    mark: 'dots',
    bars: 'still',
    amplitude: 0,
    period: 900,
    shimmer: true,
    caption: 'Thinking',
  },
  error: {
    colour: paper.inkSoft,
    glyph: paper.onInk,
    mark: 'mic',
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
              useNativeDriver: NATIVE_DRIVER,
            }),
            Animated.timing(dim, {
              toValue: 1,
              duration: look.period,
              easing: Easing.inOut(Easing.quad),
              useNativeDriver: NATIVE_DRIVER,
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
              useNativeDriver: NATIVE_DRIVER,
            }),
            Animated.timing(driver, {
              toValue: 0,
              duration: look.period,
              easing: Easing.inOut(Easing.sin),
              useNativeDriver: NATIVE_DRIVER,
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
      <Animated.View style={{ opacity: dim, transform: [{ scale: breath }], pointerEvents: 'none' }}>
        <OrbGlyph color={look.colour} size={size} />
      </Animated.View>

      <Animated.View style={[st.signal, { opacity: dim, pointerEvents: 'none' }]} {...decorative}>
        {look.mark === 'bars' ? (
          <View style={[st.bars, { gap: barGap, height: size * 0.4 }]}>
            {BAR_HEIGHTS.map((height, index) => (
              <Animated.View
                key={`${height}-${index}`}
                style={[
                  {
                    backgroundColor: look.glyph,
                    width: barWidth,
                    height: Math.max(5, size * height),
                    borderRadius: barWidth / 2,
                    transform: [{ scaleY: barScales[index]! }],
                  },
                ]}
              />
            ))}
          </View>
        ) : null}
        {look.mark === 'mic' ? <MicGlyph size={size * (32 / 120)} color={look.glyph} /> : null}
        {look.mark === 'dots' ? (
          <View style={[st.dots, { gap: size * (6 / 120) }]}>
            {[0, 1, 2].map((dot) => (
              <View
                key={dot}
                style={{ width: size * (8 / 120), height: size * (8 / 120), borderRadius: size * (4 / 120), backgroundColor: look.glyph }}
              />
            ))}
          </View>
        ) : null}
        {embeddedLabel !== undefined ? (
          <Text style={[st.embeddedLabel, { color: look.glyph }]}>{embeddedLabel}</Text>
        ) : null}
      </Animated.View>

      {withCaption ? <Text style={st.caption}>{look.caption}</Text> : null}
    </View>
  );
}

const st = StyleSheet.create({
  root: { alignItems: 'center', justifyContent: 'center' },
  signal: { position: 'absolute', inset: 0, alignItems: 'center', justifyContent: 'center' },
  bars: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center' },
  dots: { flexDirection: 'row', alignItems: 'center' },
  embeddedLabel: {
    ...type.bodyStrong,
    position: 'absolute',
    bottom: '16%',
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
