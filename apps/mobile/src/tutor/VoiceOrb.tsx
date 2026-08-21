/**
 * The voice circle — the tutor, as an object on the page.
 *
 * Two outline rings that breathe around one solid centre, and the three of
 * them speak traffic lights: red, the tutor is talking, listen; green, your
 * turn, speak; amber, it is thinking, one moment. The founder chose this
 * shape over a lit gradient sphere on purpose — this world is one pen on pale
 * paper — so keep it rings and a dot. It carries NO shadow: the app's only
 * shadow belongs to the live microphone, and an orb that borrowed it would
 * quietly make two things look equally urgent.
 *
 * The colour mapping is taught, not just used: TutorIntro's final page walks
 * a new learner through exactly these three colours. Changing them here means
 * changing them there, and in theme.ts's `orb` block, together.
 *
 * Built on core `Animated` with no new dependency. Reanimated would force the
 * repo's first babel config for a screen whose JS thread is nearly idle, and
 * Skia is a WASM payload on a target that ships to the browser. Everything
 * here animates transform and opacity only, on the native driver, per the
 * motion vocabulary the splash established.
 *
 * Deliberately not driven by audio amplitude. An analyser feeding setState at
 * thirty to sixty times a second is exactly the churn that would then require
 * reanimated to stay smooth — the one place worth spending a dependency later,
 * and not before.
 */

import { useEffect, useRef } from 'react';
import { View, Text, Animated, Easing, StyleSheet, AccessibilityInfo } from 'react-native';
import { orb, paper, space, type, STROKE, decorative } from '../theme.ts';

export type OrbState = 'ready' | 'idle' | 'speaking' | 'listening' | 'thinking' | 'error';

/** Outermost first: the two rings, then the solid centre's diameter. */
const RINGS = [132, 104] as const;
const CENTRE = 44;

interface Look {
  /** Ring colours, outermost first. */
  rings: readonly [string, string];
  centre: string;
  /** How far each ring travels from rest, as a scale delta. */
  amplitude: number;
  /** One breath, in milliseconds. */
  period: number;
  /** Dim the whole orb instead of moving it. */
  shimmer: boolean;
  /** What the state is called, under the orb. */
  caption: string;
  captionColor: string;
}

/**
 * Captions are set in ink, not in the state's own colour.
 *
 * A mark that reports state is held to 3 against its paper; words are held to
 * 4.5. Setting the word in the mark's colour quietly held the word to the
 * mark's floor, and "One moment" came out at 1.79 and "Speak" at 3.64. The orb
 * carries the colour, the caption carries the meaning, and both are legible.
 */
const CAPTION_INK = paper.ink;

const LOOKS: Record<OrbState, Look> = {
  ready: {
    // The one control on the screen, in the colour the primary pill uses. It
    // was paper.line — the hairline token — which made the thing a learner has
    // to press the faintest object in the app.
    rings: [orb.ready, orb.ready],
    centre: orb.ready,
    amplitude: 0.04,
    period: 2600,
    shimmer: false,
    caption: 'Tap to talk',
    captionColor: CAPTION_INK,
  },
  idle: {
    rings: [paper.line, paper.line],
    centre: paper.line,
    amplitude: 0.03,
    period: 3400,
    shimmer: false,
    caption: 'Ready',
    captionColor: CAPTION_INK,
  },
  speaking: {
    rings: [orb.speaking, orb.speaking],
    centre: orb.speaking,
    amplitude: 0.08,
    period: 900,
    shimmer: false,
    caption: 'Listen',
    captionColor: CAPTION_INK,
  },
  listening: {
    rings: [orb.yourTurn, orb.yourTurn],
    centre: orb.yourTurn,
    amplitude: 0.05,
    period: 1600,
    shimmer: false,
    caption: 'Speak',
    captionColor: CAPTION_INK,
  },
  thinking: {
    rings: [orb.thinking, orb.thinking],
    centre: orb.thinking,
    amplitude: 0,
    period: 1400,
    shimmer: true,
    caption: 'One moment',
    captionColor: CAPTION_INK,
  },
  error: {
    rings: [paper.line, 'transparent'],
    centre: 'transparent',
    amplitude: 0,
    period: 0,
    shimmer: false,
    caption: '',
    captionColor: CAPTION_INK,
  },
};

export function VoiceOrb({
  state,
  size = RINGS[0],
  withCaption = true,
  announce = true,
}: {
  state: OrbState;
  size?: number;
  /** TutorIntro's walkthrough writes its own labels beside mini orbs. */
  withCaption?: boolean;
  /**
   * Whether the orb speaks for itself.
   *
   * False when something around it already does. On the choosing screen the
   * orb sits inside a control that carries its own role and label, and two
   * labels on one thing read to a screen reader as two things.
   */
  announce?: boolean;
}) {
  const look = LOOKS[state];
  // One driver per ring so the two can be offset and drift apart rather than
  // pumping in unison, which reads mechanical.
  const drivers = [useRef(new Animated.Value(0)).current, useRef(new Animated.Value(0)).current];
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
        // The inner ring starts a beat after the outer one.
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
    <View
      style={[st.root, { width: size, height: size }]}
      {...(announce
        ? { accessibilityRole: 'image' as const, accessibilityLabel: `Tutor: ${look.caption || 'stopped'}` }
        : decorative)}
    >
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
              borderColor: look.rings[i],
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
      <Animated.View
        pointerEvents="none"
        style={[
          st.centre,
          {
            width: CENTRE * scale,
            height: CENTRE * scale,
            borderRadius: (CENTRE * scale) / 2,
            backgroundColor: look.centre,
            opacity: dim,
          },
        ]}
      />
      {withCaption && look.caption ? (
        <Text style={[type.label, st.caption, { color: look.captionColor }]}>{look.caption}</Text>
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
  centre: {},
  caption: { position: 'absolute', bottom: -space(6) },
});
