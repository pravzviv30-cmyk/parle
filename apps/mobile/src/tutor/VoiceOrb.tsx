/**
 * The voice circle — the tutor, as an object on the page.
 *
 * One gradient ball inside three faint rings, and it speaks traffic lights:
 * red, the tutor is talking, listen; green, your turn, speak; amber, it is
 * thinking, one moment. Revamp A reversed the earlier ruling: the founder had
 * chosen outline rings over a lit sphere, saw both drawn, and picked the sphere,
 * so the rings are the quiet edge of it now rather than the whole mark. The
 * gradient is the one state colour thinned by opacity, never a second hex. It
 * still carries NO shadow: the app's only shadows are the white card's whisper
 * and the live microphone's glow, and an orb that borrowed one would quietly
 * make two things look equally urgent.
 *
 * In the two states where a voice is in the room, three soundwave lines are
 * drawn either side of the ball and breathe with it.
 *
 * The colour mapping is taught, not just used: TutorIntro's final page walks
 * a new learner through exactly these three colours. Changing them here means
 * changing them there, and in theme.ts's `orb` block, together.
 *
 * Built on core `Animated` with no new dependency. Reanimated would force the
 * repo's first babel config for a screen whose JS thread is nearly idle, and
 * Skia is a WASM payload on a target that ships to the browser. Everything
 * here animates transform and opacity only, on the native driver, per the
 * motion vocabulary the splash established: the drawing itself
 * (`OrbGlyph.tsx`) holds still and every attribute on it is static, so nothing
 * ever asks the JS thread for a frame of SVG.
 *
 * Deliberately not driven by audio amplitude. An analyser feeding setState at
 * thirty to sixty times a second is exactly the churn that would then require
 * reanimated to stay smooth — the one place worth spending a dependency later,
 * and not before.
 */

import { useEffect, useRef } from 'react';
import { View, Text, Animated, Easing, StyleSheet } from 'react-native';
import { orb, paper, space, type, decorative } from '../theme.ts';
import { useReduceMotion } from '../motion.ts';
import { orbRests } from './orbRest.ts';
import { OrbGlyph, ORB_BOX, ORB_SIDE, ORB_WIDE } from './OrbGlyph.tsx';

export type OrbState = 'ready' | 'idle' | 'speaking' | 'listening' | 'thinking' | 'error';

/** The ball's box, in points, when nobody asks for a size. */
const ORB_DEFAULT = 132;

/** How far the voice lines stretch from rest, as a scale delta on Y. */
const WAVE_TRAVEL = 0.18;

interface Look {
  /** The one colour the whole orb is built from. */
  colour: string;
  /** Whether a voice is in the room, and the lines are drawn either side. */
  waves: boolean;
  /** How far the ball travels from rest, as a scale delta. */
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
    colour: orb.ready,
    waves: false,
    amplitude: 0.04,
    period: 2600,
    shimmer: false,
    caption: 'Tap to talk',
    captionColor: CAPTION_INK,
  },
  idle: {
    colour: paper.line,
    waves: false,
    amplitude: 0.03,
    period: 3400,
    shimmer: false,
    caption: 'Ready',
    captionColor: CAPTION_INK,
  },
  speaking: {
    colour: orb.speaking,
    waves: true,
    amplitude: 0.08,
    period: 900,
    shimmer: false,
    caption: 'Listen',
    captionColor: CAPTION_INK,
  },
  listening: {
    colour: orb.yourTurn,
    waves: true,
    amplitude: 0.05,
    period: 1600,
    shimmer: false,
    caption: 'Speak',
    captionColor: CAPTION_INK,
  },
  thinking: {
    colour: orb.thinking,
    waves: false,
    amplitude: 0,
    period: 1400,
    shimmer: true,
    caption: 'One moment',
    captionColor: CAPTION_INK,
  },
  error: {
    colour: paper.line,
    waves: false,
    amplitude: 0,
    period: 0,
    shimmer: false,
    caption: '',
    captionColor: CAPTION_INK,
  },
};

export function VoiceOrb({
  state,
  size = ORB_DEFAULT,
  withCaption = true,
  announce = true,
  paused = false,
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
  /**
   * True when the screen holding the orb is no longer the one on top.
   *
   * The orb cannot ask for itself: `useIsFocused` throws outside a
   * NavigationContainer and the intro's mini orbs render above the navigator,
   * so this is a prop the screen passes down, exactly as every drawing in
   * `illustrations/` takes it. Defaulted to false because the live screen is a
   * pushed screen and the only orb on it, so it is never behind anything.
   */
  paused?: boolean;
}) {
  const look = LOOKS[state];
  // Two drivers: the ball's breath, and the voice lines' stretch. They are kept
  // in one list because they share a loop and a rest frame, and staggered so the
  // lines answer the ball a beat later rather than pumping in unison, which
  // reads mechanical.
  const drivers = [useRef(new Animated.Value(0)).current, useRef(new Animated.Value(0)).current];
  const dim = useRef(new Animated.Value(1)).current;
  const reduced = useReduceMotion();

  useEffect(() => {
    let cancelled = false;
    const running: Animated.CompositeAnimation[] = [];
    const timers: ReturnType<typeof setTimeout>[] = [];

    const stopAll = () => {
      for (const a of running) a.stop();
      running.length = 0;
    };

    const run = () => {
      if (cancelled) return;
      if (orbRests({ amplitude: look.amplitude, shimmer: look.shimmer, reduced, paused })) {
        // The final frame. The orb still says which state it is in through
        // colour, lines and caption; only the movement is withheld.
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
      // A state with no lines drawn has nothing for the second driver to move,
      // and a loop nothing is bound to is native work for no picture.
      const moving = look.waves ? drivers : drivers.slice(0, 1);
      moving.forEach((d, i) => {
        const loop = Animated.loop(
          Animated.sequence([
            Animated.timing(d, { toValue: 1, duration: look.period, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
            Animated.timing(d, { toValue: 0, duration: look.period, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
          ]),
        );
        running.push(loop);
        // The lines start a beat after the ball. The guard AND the handle both
        // matter, the way useSceneMotion keeps both: an orb unmounted inside the
        // delay window would otherwise start a loop that nothing owns.
        timers.push(
          setTimeout(() => {
            if (cancelled) return;
            loop.start();
          }, i * 400),
        );
      });
    };

    run();

    return () => {
      cancelled = true;
      for (const t of timers) clearTimeout(t);
      stopAll();
    };
    // `drivers` and `dim` are refs and never change identity. `reduced` is a
    // dependency because the setting is watched now: a learner who turns
    // reduce motion on while the orb is breathing is answered at once, and
    // `paused` for the same reason: a tab left behind stops on the way out and
    // picks its breathing back up when the learner comes back to it.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state, reduced, paused]);

  // The root is the wide box: the ball in the middle at `size`, and a strip
  // either side that holds nothing but the voice lines. Reserved in every state
  // so the page does not reflow each time the tutor takes the floor, and kept
  // inside the root's own bounds because Android clips what hangs outside.
  const column = (size * ORB_SIDE) / ORB_BOX;
  const breath = drivers[0]!.interpolate({
    inputRange: [0, 1],
    outputRange: [1 - look.amplitude, 1 + look.amplitude],
  });
  const stretch = drivers[1]!.interpolate({
    inputRange: [0, 1],
    outputRange: [1 - WAVE_TRAVEL, 1 + WAVE_TRAVEL],
  });

  return (
    <View
      style={[st.root, { width: (size * ORB_WIDE) / ORB_BOX, height: size }]}
      {...(announce
        ? { accessibilityRole: 'image' as const, accessibilityLabel: `Tutor: ${look.caption || 'stopped'}` }
        : decorative)}
    >
      {look.waves ? (
        // Each strip shows its own side of the wide drawing and clips the rest,
        // which is what lets the lines stretch on their own while the ball
        // breathes at its own rate. Scaling a clipped strip moves only what is
        // inside it, and inside these two there is nothing but lines.
        <>
          <Animated.View
            pointerEvents="none"
            style={[st.column, { left: 0, width: column, height: size, opacity: dim, transform: [{ scaleY: stretch }] }]}
          >
            <View style={st.lineLeft}>
              <OrbGlyph color={look.colour} size={size} waves />
            </View>
          </Animated.View>
          <Animated.View
            pointerEvents="none"
            style={[st.column, { right: 0, width: column, height: size, opacity: dim, transform: [{ scaleY: stretch }] }]}
          >
            <View style={st.lineRight}>
              <OrbGlyph color={look.colour} size={size} waves />
            </View>
          </Animated.View>
        </>
      ) : null}
      <Animated.View pointerEvents="none" style={{ opacity: dim, transform: [{ scale: breath }] }}>
        <OrbGlyph color={look.colour} size={size} />
      </Animated.View>
      {withCaption && look.caption ? (
        <Text style={[type.label, st.caption, { color: look.captionColor }]}>{look.caption}</Text>
      ) : null}
    </View>
  );
}

const st = StyleSheet.create({
  root: { alignItems: 'center', justifyContent: 'center' },
  column: { position: 'absolute', top: 0, overflow: 'hidden' },
  lineLeft: { position: 'absolute', left: 0, top: 0 },
  lineRight: { position: 'absolute', right: 0, top: 0 },
  caption: { position: 'absolute', bottom: -space(6) },
});
